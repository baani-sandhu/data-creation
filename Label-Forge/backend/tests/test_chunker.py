import pytest

from app.services.chunker import chunk, chunk_auto, chunk_by_paragraph
from app.services.extractor import extract


def test_chunk_auto_returns_list(sample_txt_bytes):
    text = extract(sample_txt_bytes, "txt")
    chunks = chunk(text, strategy="auto")
    assert isinstance(chunks, list)
    assert len(chunks) > 0


def test_chunk_auto_respects_token_limit():
    # generate a long text
    text = "This is a sentence about customer service. " * 500
    chunks = chunk(text, strategy="auto", max_tokens=500)
    assert len(chunks) > 1
    # each chunk should be reasonable size
    for c in chunks:
        assert len(c.split()) <= 800  # rough upper bound


def test_chunk_by_paragraph_skips_short():
    text = "Hi.\n\nThis is a proper paragraph with enough content to be included.\n\nOk."
    chunks = chunk_by_paragraph(text, min_len=20)
    assert len(chunks) == 1
    assert "proper paragraph" in chunks[0]


def test_chunk_unknown_strategy_raises():
    with pytest.raises(ValueError):
        chunk("some text", strategy="unknown_strategy")


def test_chunk_auto_empty_text():
    chunks = chunk("", strategy="auto")
    assert chunks == []


def test_chunk_auto_on_real_pdf(sample_pdf_bytes):
    text = extract(sample_pdf_bytes, "pdf")
    chunks = chunk(text, strategy="auto")
    assert len(chunks) >= 1
    for c in chunks:
        assert len(c.strip()) > 0
