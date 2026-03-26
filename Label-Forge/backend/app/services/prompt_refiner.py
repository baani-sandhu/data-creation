import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

SYSTEM_INSTRUCTION = (
    "You are a prompt engineer. Refine the following data extraction prompt to be more precise "
    "and effective for extracting training pairs from documents. Return only the refined prompt, "
    "nothing else."
)

def refine_prompt(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_INSTRUCTION,
    )

    response = model.generate_content(prompt)
    text = getattr(response, "text", None) or ""
    return text.strip()
