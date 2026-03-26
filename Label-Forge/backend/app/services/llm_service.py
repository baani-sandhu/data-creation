import json
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

SYSTEM_INSTRUCTION = (
    "You are a prompt engineer. Refine the following data extraction prompt to be more precise "
    "and effective for extracting training pairs from documents. Return only the refined prompt, "
    "nothing else."
)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is not set")

genai.configure(api_key=api_key)
model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    system_instruction=SYSTEM_INSTRUCTION,
)


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        # Remove the first and last fence lines, including optional language tag.
        lines = stripped.splitlines()
        if len(lines) >= 2:
            return "\n".join(lines[1:-1]).strip()
    return stripped


def refine_prompt(prompt: str) -> str:
    response = model.generate_content(prompt)
    text = getattr(response, "text", None) or ""
    return text.strip()


def extract_pairs(system_prompt: str, user_message: str) -> list[dict]:
    prompt = f"{system_prompt}\n\n{user_message}".strip()
    response = model.generate_content(prompt)
    text = getattr(response, "text", None) or ""
    cleaned = _strip_code_fences(text)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        return []
    return []
