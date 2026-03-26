import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.extractor import extract

def test_pdf():
    with open("tests/sample.pdf", "rb") as f:
        text = extract(f.read(), "pdf")
    assert len(text.strip()) > 100, "Extracted text too short"
    print(f"✓ PDF extraction works — {len(text)} characters extracted")
    print("\n--- First 500 chars ---")
    print(text[:500])

def test_txt():
    text = extract(b"Hello world. This is a test document.", "txt")
    assert text == "Hello world. This is a test document."
    print("\n✓ TXT extraction works")

test_pdf()
test_txt()