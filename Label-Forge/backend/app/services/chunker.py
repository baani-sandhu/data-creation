import tiktoken

def chunk(text: str, max_tokens: int = 20000) -> list[str]:
    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)

    if not tokens:
        return []

    chunks = []
    for i in range(0, len(tokens), max_tokens):
        chunk_tokens = tokens[i : i + max_tokens]
        chunk_text = encoding.decode(chunk_tokens)

        if chunk_text and chunk_text.strip():
            chunks.append(chunk_text)

    return chunks