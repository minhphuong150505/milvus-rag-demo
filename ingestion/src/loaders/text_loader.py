from pathlib import Path

from bs4 import BeautifulSoup

from src.documents import Document


def load_text_file(path: Path) -> list[Document]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    suffix = path.suffix.lower()
    if suffix in {".html", ".htm"}:
        content = BeautifulSoup(content, "html.parser").get_text(separator="\n")

    return [
        Document(
            text=content,
            doc_title=path.stem,
            source_url=str(path),
            source_type="html" if suffix in {".html", ".htm"} else "text",
            page=0,
        )
    ]
