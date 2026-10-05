"""API 키·인증서 암호를 설정 파일에 저장할 때 암호화합니다.

Windows: DPAPI(CryptProtectData) — 같은 PC의 같은 윈도우 계정에서만 복호화됩니다.
그 외 OS: 암호화 없이 저장하고 파일 권한만 본인 전용(600)으로 둡니다 (개발·테스트용).
"""

from __future__ import annotations

import base64
import sys
from typing import Any

_ENTROPY = b"EdufineAutoPumui/v1"


def _dpapi(data: bytes, protect: bool) -> bytes:
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    def blob(b: bytes) -> tuple[DATA_BLOB, Any]:
        buf = ctypes.create_string_buffer(b, len(b))
        return DATA_BLOB(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf

    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    data_in, _keep1 = blob(data)
    entropy, _keep2 = blob(_ENTROPY)
    out = DATA_BLOB()
    CRYPTPROTECT_UI_FORBIDDEN = 0x01
    if protect:
        ok = crypt32.CryptProtectData(ctypes.byref(data_in), ctypes.c_wchar_p("pumui"), ctypes.byref(entropy),
                                      None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out))
    else:
        ok = crypt32.CryptUnprotectData(ctypes.byref(data_in), None, ctypes.byref(entropy),
                                        None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out))
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(out.pbData, ctypes.c_void_p))


def seal(value: str) -> dict[str, str]:
    raw = value.encode("utf-8")
    if sys.platform == "win32":
        return {"scheme": "dpapi", "data": base64.b64encode(_dpapi(raw, True)).decode()}
    return {"scheme": "plain", "data": base64.b64encode(raw).decode()}


def unseal(sealed: Any) -> str:
    if not isinstance(sealed, dict) or "data" not in sealed:
        return ""
    try:
        raw = base64.b64decode(sealed["data"])
        if sealed.get("scheme") == "dpapi":
            if sys.platform != "win32":
                return ""
            raw = _dpapi(raw, False)
        return raw.decode("utf-8")
    except Exception:  # noqa: BLE001 — 다른 PC에서 복사해 온 설정 등: 저장 안 된 것으로 취급
        return ""
