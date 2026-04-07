import pytest

from app.services.extractor import extract


def test_pdf_extraction_returns_text(sample_pdf_bytes):
    text = extract(sample_pdf_bytes, "pdf")
    assert isinstance(text, str)
    assert len(text) > 100
    assert text.strip() != ""


def test_txt_extraction(sample_txt_bytes):
    text = extract(sample_txt_bytes, "txt")
    assert text == sample_txt_bytes.decode("utf-8")


def test_md_extraction():
    content = b"# Header\n\nSome paragraph text here."
    text = extract(content, "md")
    assert "Header" in text
    assert "paragraph" in text


def test_csv_extraction():
    content = b"name,age\nAlice,30\nBob,25"
    text = extract(content, "csv")
    assert "Alice" in text
    assert "Bob" in text


def test_unsupported_extension_raises():
    with pytest.raises(ValueError, match="Unsupported"):
        extract(b"some bytes", "xyz")


def test_pdf_extraction_returns_nonempty_for_real_pdf(sample_pdf_bytes):
    text = extract(sample_pdf_bytes, "pdf")
    word_count = len(text.split())
    assert word_count > 50, f"Expected >50 words, got {word_count}"
