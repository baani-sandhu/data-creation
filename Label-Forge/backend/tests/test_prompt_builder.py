import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.prompt_builder import build_system_prompt, build_user_message

fields = ["input", "output"]
task_prompt = "Extract question and answer pairs from customer service documents"

examples = [
    {"pair": {"input": "How do I reset my password?", "output": "Go to settings and click forgot password"}},
    {"pair": {"input": "What are your business hours?", "output": "We are open Monday to Friday 9am to 6pm"}},
]

chunk = """
Customers often ask about delivery times. Our standard delivery 
takes 3-5 business days. Express delivery is available for an 
additional fee and takes 1-2 business days. For international 
orders, delivery can take up to 14 business days depending on 
the destination country.
"""

system = build_system_prompt(task_prompt, fields)
user = build_user_message(chunk, examples)

print("=== SYSTEM PROMPT ===")
print(system)
print("\n=== USER MESSAGE ===")
print(user)