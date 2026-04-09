import pdfplumber
import fitz
import io
from docx import Document

def extract(file_bytes: bytes, file_ext: str) -> str:
    file_ext = file_ext.lower().lstrip(".")

    if file_ext == "pdf":
        return _extract_pdf(file_bytes)
    elif file_ext == "docx":
        return extract_docx(file_bytes)
    elif file_ext in ["txt", "md", "csv"]:
        return _extract_text(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: .{file_ext}")

def extract_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)

def _extract_pdf(file_bytes: bytes) -> str:
    text = _try_pymupdf(file_bytes)
    if not text.strip():
        text = _try_pdfplumber(file_bytes)
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
    try:
        pages = []
        for page_index in range(doc.page_count):
            t = doc.load_page(page_index).get_text()
            if t.strip():
                pages.append(t.strip())

        return "\n\n".join(pages)
    finally:
        doc.close()

def _extract_text(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")
