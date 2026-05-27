#!/usr/bin/env python3
"""
AVTotal Mixer — Công cụ tạo License Key (dành cho tác giả).
Chạy: python generate_key.py
KHÔNG phân phối file này hoặc SECRET cho user.
"""
import hmac
import hashlib

# Phải trùng với HMAC_SECRET trong license.js và AVTotal Mixer.py
SECRET = "REPLACE_WITH_YOUR_SECRET_KEY"


def generate(machine_id: str, expiry: str = "00000000") -> str:
    """
    machine_id : UUID từ app (ví dụ: 3f2504e0-4f89-11d3-9a0c-0305e82c3301)
    expiry     : YYYYMMDD (ví dụ: 20261231) hoặc "00000000" = vĩnh viễn
    Trả về     : key dạng YYYYMMDD-XXXX-XXXX-XXXX
    """
    msg = f"{machine_id.strip().lower()}|{expiry}"
    h = hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:12].upper()
    return f"{expiry}-{h[:4]}-{h[4:8]}-{h[8:12]}"


if __name__ == "__main__":
    print("=" * 48)
    print("  AVTotal Mixer — Tạo License Key")
    print("=" * 48)
    mid = input("\nMachine ID của user: ").strip()
    exp_raw = input("Hết hạn YYYYMMDD (Enter = vĩnh viễn): ").strip()
    expiry = exp_raw if (exp_raw and len(exp_raw) == 8 and exp_raw.isdigit()) else "00000000"

    key = generate(mid, expiry)

    label = "Vĩnh viễn" if expiry == "00000000" else f"Hết hạn: {expiry[6:]}/{expiry[4:6]}/{expiry[:4]}"
    print(f"\n✓ License Key ({label}):\n")
    print(f"   {key}\n")
    input("Nhấn Enter để thoát...")
