"""Compatibility entry point for live AURA system verification.

The previous file instantiated individual ASGI applications in one process and
relied on an in-process job thread.  That cannot prove the Docker gateway or
separate worker path.  Use the bounded, real-HTTP verifier instead.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from load_tests.live_gateway_scenarios import main


if __name__ == "__main__":
    main()
