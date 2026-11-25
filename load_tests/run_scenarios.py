"""Compatibility entry point for the live gateway load scenarios.

The previous runner imported service applications into one process, which did
not exercise Docker networking or gateway enforcement. Keep this filename for
existing documentation, but execute the real HTTP runner instead.
"""

from live_gateway_scenarios import main


if __name__ == "__main__":
    main()
