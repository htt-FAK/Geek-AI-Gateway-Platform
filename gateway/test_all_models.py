"""Full model smoke test for ai-gateway-platform."""
from __future__ import annotations

import base64
import math
import os
import struct
import sys
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

GW = os.environ.get("GATEWAY_TEST_BASE", "http://127.0.0.1:4001/v1")
MASTER = os.environ.get("LITELLM_MASTER_KEY", "sk-gateway-local-123")
MIMO_KEY = os.environ.get("MIMO_API_KEY", "")
MIMO = "https://api.xiaomimimo.com/v1/chat/completions"


def make_wav(path: Path) -> str:
    fr, dur = 16000, 0.6
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(fr)
        for i in range(int(fr * dur)):
            val = int(8000 * math.sin(2 * math.pi * 440 * i / fr))
            w.writeframes(struct.pack("<h", val))
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:audio/wav;base64,{b64}"


def post(url: str, headers: dict, payload: dict, timeout: float = 120.0) -> tuple[bool, str]:
    try:
        # trust_env=False: Windows system proxy can hijack 127.0.0.1 and return 502
        r = httpx.post(url, headers=headers, json=payload, timeout=timeout, trust_env=False)
        snip = r.text[:200].replace("\n", " ")
        return 200 <= r.status_code < 300, f"{r.status_code} | {snip}"
    except Exception as e:  # noqa: BLE001
        return False, f"EXC | {e}"


def main() -> int:
    gh = {"Authorization": f"Bearer {MASTER}", "Content-Type": "application/json"}
    mh = {"Authorization": f"Bearer {MIMO_KEY}", "Content-Type": "application/json"}
    wav = Path(os.environ.get("TEMP", ".")) / "mimo-test.wav"
    data_url = make_wav(wav)

    print("=== Gateway /models ===")
    try:
        r = httpx.get(
            f"{GW}/models",
            headers={"Authorization": f"Bearer {MASTER}"},
            timeout=20,
            trust_env=False,
        )
        print(r.status_code, r.text[:500])
    except Exception as e:  # noqa: BLE001
        print("EXC", e)

    print("\n=== Chat via gateway ===")
    chat_models = [
        "deepseek-v4-flash",
        "deepseek-v4-pro",
        "mimo-v2.5-pro",
        "mimo-v2.5-pro-ultraspeed",
        "mimo-v2.5",
    ]
    for m in chat_models:
        ok, msg = post(
            f"{GW}/chat/completions",
            gh,
            {"model": m, "messages": [{"role": "user", "content": "Reply with only: ok"}], "max_tokens": 16},
        )
        print(f"{m}: {'PASS' if ok else 'FAIL'} {msg}")

    print("\n=== ASR via gateway ===")
    ok, msg = post(
        f"{GW}/chat/completions",
        gh,
        {
            "model": "mimo-v2.5-asr",
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "input_audio", "input_audio": {"data": data_url}}],
                }
            ],
            "asr_options": {"language": "zh"},
        },
    )
    print(f"mimo-v2.5-asr: {'PASS' if ok else 'FAIL'} {msg}")

    print("\n=== TTS direct MiMo (gateway chat adapter cannot parse audio responses) ===")
    tts_cases = [
        (
            "mimo-v2.5-tts",
            {
                "model": "mimo-v2.5-tts",
                "messages": [
                    {"role": "user", "content": "Speak clearly."},
                    {"role": "assistant", "content": "Hello gateway."},
                ],
                "audio": {"format": "wav", "voice": "Chloe"},
            },
        ),
        (
            "mimo-v2.5-tts-voicedesign",
            {
                "model": "mimo-v2.5-tts-voicedesign",
                "messages": [
                    {"role": "user", "content": "Give me a young male tone."},
                    {"role": "assistant", "content": "Yes."},
                ],
                "audio": {"format": "wav", "optimize_text_preview": True},
            },
        ),
        (
            "mimo-v2.5-tts-voiceclone",
            {
                "model": "mimo-v2.5-tts-voiceclone",
                "messages": [
                    {"role": "user", "content": ""},
                    {"role": "assistant", "content": "Hello clone."},
                ],
                "audio": {"format": "wav", "voice": data_url},
            },
        ),
    ]
    for name, payload in tts_cases:
        ok, msg = post(MIMO, mh, payload)
        print(f"direct {name}: {'PASS' if ok else 'FAIL'} {msg}")
        ok2, msg2 = post(f"{GW}/chat/completions", gh, payload)
        print(f"gateway {name}: {'PASS' if ok2 else 'FAIL'} {msg2}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
