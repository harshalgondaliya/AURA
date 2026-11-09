"""
backend/common/redis_cache.py
Production Redis Caching and Distributed Token Bucket Rate Limiter with In-Memory Fallback.
"""

import os
import time
import json
from typing import Optional, Any

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class MockRedis:
    """Thread-safe in-memory key-value cache fallback when Redis is offline."""
    def __init__(self):
        self._store = {}
        self._expiry = {}
        self._rate_limits = {} # {client_id: [tokens, last_update]}
        
    def get(self, key: str) -> Optional[str]:
        now = time.time()
        if key in self._expiry and now > self._expiry[key]:
            del self._store[key]
            del self._expiry[key]
            return None
        return self._store.get(key)
        
    def set(self, key: str, value: str, ex: Optional[int] = None):
        self._store[key] = value
        if ex:
            self._expiry[key] = time.time() + ex
        elif key in self._expiry:
            del self._expiry[key]
        return True
        
    def delete(self, key: str):
        self._store.pop(key, None)
        self._expiry.pop(key, None)
        return True
        
    def ping(self):
        return True


class CacheManager:
    """Unified Cache & Rate Limiting Manager with Redis & In-Memory Fallback."""
    
    def __init__(self):
        self.client = None
        self.is_connected = False
        
        if REDIS_AVAILABLE:
            try:
                self.client = redis.Redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1
                )
                self.client.ping()
                self.is_connected = True
                print(f"[CACHE] Connected to Redis at {REDIS_URL}")
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
            
    def check_rate_limit(self, client_id: str, capacity: int = 60, refill_rate: float = 1.0) -> tuple[bool, int]:
        """
        Distributed Token Bucket Rate Limiter.
        - capacity: Maximum burst token capacity (e.g. 60 requests).
        - refill_rate: Tokens added per second (e.g. 1 token/sec = 60 req/min).
        Returns: (allowed: bool, remaining_tokens: int)
        """
        key = f"ratelimit:{client_id}"
        now = time.time()
        
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

# Global cache instance
cache = CacheManager()
