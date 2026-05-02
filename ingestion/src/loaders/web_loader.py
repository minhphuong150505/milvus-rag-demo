import requests
import trafilatura

from src.documents import Document


def load_url(url: str) -> list[Document]:
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    html = response.text
    text = trafilatura.extract(html)
    if not text:
        return []

    metadata = trafilatura.extract_metadata(html)
    title = metadata.title if metadata and metadata.title else url
    return [
        Document(
            text=text,
            doc_title=title,
            source_url=url,
            source_type="web",
            page=0,
        )
    ]
