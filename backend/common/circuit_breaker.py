"""
backend/common/circuit_breaker.py
Production Circuit Breaker Pattern for Downstream Fault Tolerance.
"""

import time
import asyncio
from typing import Callable, Any, Optional

class CircuitState:
    CLOSED = "CLOSED"         # Normal operation: requests pass through
    OPEN = "OPEN"             # Tripped: requests immediately routed to fallback
    HALF_OPEN = "HALF_OPEN"   # Probing: test if downstream service has recovered


class CircuitBreaker:
    """
    Resilient Circuit Breaker implementation with configurable thresholds.
    - failure_threshold: Consecutive errors before tripping circuit to OPEN.
    - recovery_timeout: Seconds in OPEN state before testing recovery (HALF_OPEN).
    """
    
    def __init__(self, service_name: str, failure_threshold: int = 5, recovery_timeout: float = 10.0):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        
    def _update_state(self):
        now = time.time()
        if self.state == CircuitState.OPEN:
            if now - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                print(f"[CIRCUIT BREAKER] {self.service_name}: Transitioned from OPEN -> HALF_OPEN (Probing recovery)")
                
    async def call(self, func: Callable, *args, fallback: Optional[Callable] = None, **kwargs) -> Any:
        self._update_state()
        
        if self.state == CircuitState.OPEN:
            print(f"[CIRCUIT BREAKER] {self.service_name}: Circuit is OPEN. Triggering fallback.")
            if fallback:
                if asyncio.iscoroutinefunction(fallback):
                    return await fallback(*args, **kwargs)
                return fallback(*args, **kwargs)
            raise RuntimeError(f"Circuit for {self.service_name} is OPEN and no fallback provided.")
            
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
                
            self._on_success()
            return result
        except Exception as e:
            self._on_failure(e)
            if fallback:
                print(f"[CIRCUIT BREAKER] {self.service_name}: Call failed ({e}). Returning fallback.")
                if asyncio.iscoroutinefunction(fallback):
                    return await fallback(*args, **kwargs)
                return fallback(*args, **kwargs)
            raise e
            
    def _on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= 2:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                print(f"[CIRCUIT BREAKER] {self.service_name}: Service recovered! Transitioned HALF_OPEN -> CLOSED")
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0
            
    def _on_failure(self, error: Exception):
        self.last_failure_time = time.time()
        self.failure_count += 1
        print(f"[CIRCUIT BREAKER] {self.service_name}: Failure detected ({error}). Count: {self.failure_count}/{self.failure_threshold}")
        
        if self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN):
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                print(f"[CIRCUIT BREAKER] {self.service_name}: Threshold breached! Circuit tripped to OPEN for {self.recovery_timeout}s.")
                
    def get_status(self) -> dict:
        self._update_state()
        return {
            "service": self.service_name,
            "state": self.state,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time
        }
