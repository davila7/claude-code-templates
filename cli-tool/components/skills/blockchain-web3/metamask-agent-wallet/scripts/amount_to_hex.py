#!/usr/bin/env python3
"""Convert a human-readable token amount to 0x-prefixed hex for EVM calldata.

Usage:
    python3 amount_to_hex.py <amount> <decimals>

Examples:
    python3 amount_to_hex.py 1.5 18       # 1.5 ETH  -> 0x14d1120d7b160000
    python3 amount_to_hex.py 100 6        # 100 USDC -> 0x5f5e100
    python3 amount_to_hex.py 0.001 8      # 0.001 WBTC -> 0x186a0
"""

import sys
from decimal import Decimal

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <amount> <decimals>", file=sys.stderr)
    sys.exit(1)

decimals = int(sys.argv[2])
value = int(Decimal(sys.argv[1]) * 10 ** decimals)

print(hex(value))
