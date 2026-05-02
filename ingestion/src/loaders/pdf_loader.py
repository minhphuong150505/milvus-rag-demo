from pathlib import Path

from pypdf import PdfReader

from src.documents import Document


def load_pdf(path: Path) -> list[Document]:
    reader = PdfReader(str(path))
    documents: list[Document] = []

    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not text.strip():
            continue
        documents.append(
            Document(
                text=text,
                doc_title=path.stem,
                source_url=str(path),
                source_type="pdf",
                page=index,
            )
        )

    return documents
