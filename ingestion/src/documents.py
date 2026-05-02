from dataclasses import dataclass


@dataclass(frozen=True)
class Document:
    text: str
    doc_title: str
    source_url: str
    source_type: str
    page: int = 0
