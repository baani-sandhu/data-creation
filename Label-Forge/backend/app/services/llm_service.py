import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

SYSTEM_INSTRUCTION = (
    "You are a prompt engineer. Refine the following data extraction prompt to be more precise "
    "and effective for extracting training pairs from documents. Return only the refined prompt, "
    "nothing else."
)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=api_key)


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        # Remove the first and last fence lines, including optional language tag.
        lines = stripped.splitlines()
        if len(lines) >= 2:
            return "\n".join(lines[1:-1]).strip()
    return stripped


def refine_prompt(prompt: str) -> str:
    instruction = f"{SYSTEM_INSTRUCTION}\n\n{prompt}".strip()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=instruction,
    )
    text = getattr(response, "text", None) or ""
    return text.strip()


def extract_pairs(system_prompt: str, user_message: str) -> list[dict]:
    prompt = f"{system_prompt}\n\n{user_message}".strip()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = getattr(response, "text", None) or ""
    cleaned = _strip_code_fences(text)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        return []
    return []
