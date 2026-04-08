import tiktoken

from app.services.chunker import chunk


def test_chunk_empty_input_returns_empty_list():
    assert chunk("") == []


def test_chunk_small_text_returns_single_chunk():
    text = "This is a short piece of text for chunking."

    chunks = chunk(text, max_tokens=100)

    assert chunks == [text]


def test_chunk_large_text_returns_multiple_chunks():
    text = ("Token based chunking should split long text into multiple parts. " * 100).strip()

    chunks = chunk(text, max_tokens=20)

    assert len(chunks) > 1


def test_chunk_never_returns_empty_or_whitespace_chunks():
    text = ("Meaningful content " * 50).strip()

    chunks = chunk(text, max_tokens=10)

    assert chunks
    assert all(part.strip() for part in chunks)


def test_chunk_respects_max_tokens_limit():
    encoding = tiktoken.get_encoding("cl100k_base")
    text = ("Chunk sizes should stay within the token limit. " * 100).strip()
    max_tokens = 15

    chunks = chunk(text, max_tokens=max_tokens)

    assert chunks
    for part in chunks:
        assert len(encoding.encode(part)) <= max_tokens
