"""
Minimal Gemini API connectivity test.
Uses google-genai SDK (already installed) + python-dotenv.

Usage:
  python test_gemini.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (same folder as this script)
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

api_key = os.getenv("GEMINI_API_KEY", "").strip()

if not api_key or api_key == "your_gemini_api_key_here":
    print("ERROR: No valid GEMINI_API_KEY found in .env")
    raise SystemExit(1)

print(f"API key loaded: {api_key[:8]}...{api_key[-4:]}")

# Try models in order — free-tier quotas vary per model
MODELS = ["gemini-flash-latest", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"]

from google import genai

client = genai.Client(api_key=api_key)

response = None
for model in MODELS:
    try:
        print(f"Trying model: {model} ...")
        response = client.models.generate_content(
            model=model,
            contents="Say hello and confirm you are working",
        )
        print(f"  [OK] {model}\n")
        break
    except Exception as e:
        print(f"  [FAIL] {model}: {str(e)[:120]}")

if response is None:
    print("\nAll models exhausted quota or failed.")
    raise SystemExit(1)

print("=== Gemini Response ===")
print(response.text)
print("=== Test PASSED ===")
