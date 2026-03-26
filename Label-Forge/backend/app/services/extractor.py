import pdfplumber
import fitz
import io

def extract(file_bytes: bytes, file_ext: str) -> str:
    file_ext = file_ext.lower().lstrip(".")

    if file_ext == "pdf":
        return _extract_pdf(file_bytes)
    elif file_ext in ["txt", "md", "csv"]:
        return _extract_text(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: .{file_ext}")

def _extract_pdf(file_bytes: bytes) -> str:
    # try pdfplumber first
    text = _try_pdfplumber(file_bytes)

    # if it returned nothing, fall back to pymupdf
    if not text.strip():
        text = _try_pymupdf(file_bytes)

    return text

def _try_pdfplumber(file_bytes: bytes) -> str:
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
    return "\n\n".join(pages)

def _try_pymupdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        t = page.get_text()
        if t.strip():
            pages.append(t.strip())
    return "\n\n".join(pages)

def _extract_text(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")