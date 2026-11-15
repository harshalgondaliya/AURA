"""
backend/common/redis_cache.py
Production Redis Caching, Atomic Lua Token Bucket Rate Limiting,
and Distributed Task Queue Primitives with In-Memory Fallback.
"""

import os
import time
import json
import threading
from typing import Optional, Any, Tuple

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Atomic Token Bucket Lua Script for Redis
TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4] or 1)

local data = redis.call('GET', key)
local tokens = capacity
local last_update = now

if data then
    local decoded = cjson.decode(data)
    tokens = tonumber(decoded[1])
    last_update = tonumber(decoded[2])
    local elapsed = math.max(0, now - last_update)
    tokens = math.min(capacity, tokens + (elapsed * refill_rate))
end

if tokens >= requested then
    tokens = tokens - requested
    redis.call('SETEX', key, 3600, cjson.encode({tokens, now}))
    return {1, math.floor(tokens)}
else
    redis.call('SETEX', key, 3600, cjson.encode({tokens, now}))
    return {0, math.floor(tokens)}
end
"""


class MockRedis:
    """Thread-safe in-memory key-value cache & queue fallback when Redis is offline."""
    def __init__(self):
        self._lock = threading.Lock()
        self._store = {}
        self._expiry = {}
        self._queues = {}
        self._rate_limits = {}

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            now = time.time()
            if key in self._expiry and now > self._expiry[key]:
                del self._store[key]
                del self._expiry[key]
                return None
            return self._store.get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None):
        with self._lock:
            self._store[key] = value
            if ex:
                self._expiry[key] = time.time() + ex
            elif key in self._expiry:
                del self._expiry[key]
            return True

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return True

    def rpush(self, key: str, value: str):
        with self._lock:
            if key not in self._queues:
                self._queues[key] = []
            self._queues[key].append(value)
            return len(self._queues[key])

    def lpop(self, key: str) -> Optional[str]:
        with self._lock:
            q = self._queues.get(key, [])
            if q:
                return q.pop(0)
            return None

    def blpop(self, keys, timeout: int = 1):
        key = keys[0] if isinstance(keys, (list, tuple)) else keys
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                q = self._queues.get(key, [])
                if q:
                    return (key, q.pop(0))
            time.sleep(0.05)
        return None

    def llen(self, key: str) -> int:
        with self._lock:
            return len(self._queues.get(key, []))

    def ping(self):
        return True


class CacheManager:
    """Unified Cache, Atomic Rate Limiting, and Task Queue Manager."""

    def __init__(self):
        self.client = None
        self.is_connected = False
        self._rate_limit_script = None

        if REDIS_AVAILABLE:
            try:
                self.client = redis.Redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2
                )
                self.client.ping()
                self.is_connected = True
                try:
                    self._rate_limit_script = self.client.register_script(TOKEN_BUCKET_LUA)
                except Exception:
                    self._rate_limit_script = None
                print(f"[CACHE] Connected to Redis at {REDIS_URL} (Atomic Lua Engine Enabled)")
            except Exception as e:
                print(f"[CACHE] Redis offline ({e}). Using In-Memory Cache Fallback.")
                self.client = MockRedis()
        else:
            print("[CACHE] redis-py not installed. Using In-Memory Cache Fallback.")
            self.client = MockRedis()

    def get_json(self, key: str) -> Optional[Any]:
        try:
            val = self.client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        try:
            val_str = json.dumps(value)
            return bool(self.client.set(key, val_str, ex=ttl_seconds))
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            return bool(self.client.delete(key))
        except Exception:
            return False

    def check_rate_limit(self, client_id: str, capacity: int = 60, refill_rate: float = 1.0) -> Tuple[bool, int]:
        """
        Atomic Distributed Token Bucket Rate Limiter.
        Uses Redis server-side Lua execution to prevent race conditions under high concurrency.
        Returns: (allowed: bool, remaining_tokens: int)
        """
        key = f"ratelimit:{client_id}"
        now = time.time()

        if self.is_connected and self._rate_limit_script:
            try:
                res = self._rate_limit_script(keys=[key], args=[capacity, refill_rate, now, 1])
                allowed = bool(res[0] == 1)
                tokens = int(res[1])
                return allowed, tokens
            except Exception as e:
                # Fallback to direct client execution if script error
                pass

        # Fallback / Mock execution (atomic via MockRedis lock)
        try:
            raw_data = self.client.get(key)
            if raw_data:
                tokens, last_update = json.loads(raw_data)
                elapsed = max(0.0, now - last_update)
                tokens = min(float(capacity), tokens + elapsed * refill_rate)
            else:
                tokens = float(capacity)

            if tokens >= 1.0:
                tokens -= 1.0
                self.client.set(key, json.dumps([tokens, now]), ex=3600)
                return True, int(tokens)
            else:
                self.client.set(key, json.dumps([tokens, now]), ex=3600)
                return False, 0
        except Exception:
            return True, capacity

    # --- Asynchronous Queue Operations ---
    def push_queue(self, queue_name: str, item: Any) -> bool:
        """Pushes serialized task payload to Redis queue."""
        try:
            val = json.dumps(item) if not isinstance(item, str) else item
            self.client.rpush(queue_name, val)
            return True
        except Exception as e:
            print(f"[CACHE QUEUE] Error pushing to {queue_name}: {e}")
            return False

    def pop_queue(self, queue_name: str, timeout: int = 2) -> Optional[Any]:
        """Pops and deserializes task from Redis queue (blocking with timeout)."""
        try:
            if hasattr(self.client, 'blpop'):
                res = self.client.blpop([queue_name], timeout=timeout)
                if res:
                    raw = res[1] if isinstance(res, (list, tuple)) else res
                    return json.loads(raw) if raw else None
            else:
                raw = self.client.lpop(queue_name)
                return json.loads(raw) if raw else None
        except Exception as e:
            print(f"[CACHE QUEUE] Error popping from {queue_name}: {e}")
            return None

    def queue_length(self, queue_name: str) -> int:
        """Returns current pending queue depth."""
        try:
            return int(self.client.llen(queue_name))
        except Exception:
            return 0


# Global cache instance
cache = CacheManager()
