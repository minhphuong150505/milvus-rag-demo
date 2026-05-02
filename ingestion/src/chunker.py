import re

from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import Settings


class Chunker:
    def __init__(self, settings: Settings):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def split(self, text: str) -> list[str]:
        cleaned = clean_text(text)
        return [chunk.strip() for chunk in self.splitter.split_text(cleaned) if chunk.strip()]


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
