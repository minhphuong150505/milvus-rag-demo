import hashlib
import time
from pathlib import Path

from tqdm import tqdm

from src.chunker import Chunker
from src.config import Settings
from src.documents import Document
from src.embedder import OllamaEmbedder
from src.loaders import load_pdf, load_text_file, load_url
from src.milvus_client import MilvusVectorStore


SUPPORTED_FILE_TYPES = {".txt", ".md", ".html", ".htm", ".pdf"}


class IngestionPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.chunker = Chunker(settings)
        self.embedder = OllamaEmbedder(settings)
        self.store = MilvusVectorStore(settings)

    def create_collection(self, drop_existing: bool = False) -> None:
        self.store.ensure_collection(drop_existing=drop_existing)

    def ingest_path(self, path: Path) -> int:
        documents = load_documents(path)
        return self.ingest_documents(documents)

    def ingest_url(self, url: str) -> int:
        return self.ingest_documents(load_url(url))

    def ingest_documents(self, documents: list[Document]) -> int:
        self.store.ensure_collection()
        seen_hashes: set[str] = set()
        rows: list[dict] = []

        for document in tqdm(documents, desc="Chunking documents"):
            chunks = self.chunker.split(document.text)
            for index, chunk in enumerate(chunks):
                digest = hashlib.md5(chunk.encode("utf-8")).hexdigest()
                if digest in seen_hashes:
                    continue
                seen_hashes.add(digest)
                rows.append(
                    {
                        "chunk_text": chunk[:4000],
                        "source_url": document.source_url[:1000],
                        "source_type": document.source_type[:50],
                        "page": document.page,
                        "chunk_index": index,
                        "doc_title": document.doc_title[:500],
                        "created_at": int(time.time()),
                    }
                )

        inserted = 0
        for start in tqdm(range(0, len(rows), self.settings.embed_batch_size), desc="Embedding and inserting"):
            batch = rows[start : start + self.settings.embed_batch_size]
            texts = [row["chunk_text"] for row in batch]
            embeddings = self.embedder.embed_batch(texts)
            for row, embedding in zip(batch, embeddings, strict=True):
                if len(embedding) != self.settings.embed_dim:
                    raise ValueError(
                        f"Embedding dim mismatch: got {len(embedding)}, expected {self.settings.embed_dim}. "
                        "Update EMBED_DIM and recreate the Milvus collection."
                    )
                row["embedding"] = embedding
            inserted += self.store.insert(batch)

        return inserted

    def query(self, question: str, top_k: int = 5) -> list[dict]:
        self.store.ensure_collection()
        embedding = self.embedder.embed_one(question)
        return self.store.search(embedding, top_k=top_k)


def load_documents(path: Path) -> list[Document]:
    if path.is_file():
        return _load_file(path)

    documents: list[Document] = []
    for file_path in sorted(path.rglob("*")):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_FILE_TYPES:
            documents.extend(_load_file(file_path))
    return documents


def _load_file(path: Path) -> list[Document]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return load_pdf(path)
    if suffix in SUPPORTED_FILE_TYPES:
        return load_text_file(path)
    return []
