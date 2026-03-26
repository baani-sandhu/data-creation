import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.extractor import extract
from app.services.chunker import chunk

with open("tests/sample.pdf", "rb") as f:
    text = extract(f.read(), "pdf")

chunks = chunk(text, strategy="auto")

print(f"Total chunks: {len(chunks)}")
print(f"\n--- Chunk 1 (small — for manual annotation) ---")
print(f"Word count: {len(chunks[0].split())}")
print(chunks[0][:300])

if len(chunks) > 1:
    print(f"\n--- Chunk 2 (large — for LLM) ---")
    print(f"Word count: {len(chunks[1].split())}")
    print(chunks[1][:300])

if len(chunks) > 2:
    print(f"\n--- Chunk 3 (large — for LLM) ---")
    print(f"Word count: {len(chunks[2].split())}")
    print(chunks[2][:300])