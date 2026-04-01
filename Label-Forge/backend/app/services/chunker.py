import re

def chunk(text: str, strategy: str = "auto", **kwargs) -> list[str]:
    strategies = {
        "auto":            chunk_auto,
        "paragraph":       chunk_by_paragraph,
        "sentence_window": chunk_by_sentence_window,
    }
    if strategy not in strategies:
        raise ValueError(f"Unknown strategy: {strategy}")
    return strategies[strategy](text, **kwargs)


def chunk_auto(
    text: str,
    chunk_words: int = 4000,
) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    i = 0
    while i < len(words):
        chunk_text = " ".join(words[i:i + chunk_words]).strip()
        if chunk_text:
            chunks.append(chunk_text)
        i += chunk_words

    return chunks


def chunk_by_paragraph(
    text: str,
    min_len: int = 60,
    max_len: int = 500,
) -> list[str]:
    raw_paras = [p.strip() for p in re.split(r'\n{2,}', text)]
    chunks = []
    for para in raw_paras:
        if len(para) < min_len:
            continue
        if len(para) <= max_len:
            chunks.append(para)
        else:
            chunks.extend(_split_by_sentence(para, max_len))
    return chunks


def chunk_by_sentence_window(
    text: str,
    window: int = 3,
    overlap: int = 1,
    min_len: int = 60,
) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    chunks = []
    i = 0
    while i < len(sentences):
        window_sents = sentences[i:i + window]
        chunk_text = " ".join(window_sents)
        if len(chunk_text) >= min_len:
            chunks.append(chunk_text)
        i += (window - overlap)
    return chunks


def _split_by_sentence(text: str, max_len: int) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    buffer = ""
    for sentence in sentences:
        if len(buffer) + len(sentence) <= max_len:
            buffer += (" " if buffer else "") + sentence
        else:
            if buffer:
                chunks.append(buffer.strip())
            buffer = sentence
    if buffer.strip():
        chunks.append(buffer.strip())
    return chunks
