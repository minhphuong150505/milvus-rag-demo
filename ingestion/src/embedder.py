from collections.abc import Iterable
from typing import Any

import requests

from src.config import Settings


class OllamaEmbedder:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.session = requests.Session()
        self.base_url = settings.ollama_embed_base_url or settings.ollama_base_url
        api_key = settings.ollama_embed_api_key
        if api_key is None and self.base_url.rstrip("/") == settings.ollama_base_url.rstrip("/"):
            api_key = settings.ollama_api_key
        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in texts:
            embeddings.append(self.embed_one(text))
        return embeddings

    def embed_one(self, text: str) -> list[float]:
        candidates = self._request_candidates(text)
        last_response: requests.Response | None = None
        for path, payload in candidates:
            response = self.session.post(self._url(path), json=payload, timeout=60)
            if response.ok:
                return _extract_embedding(response.json())
            if response.status_code not in {400, 404, 422}:
                response.raise_for_status()
            last_response = response

        if last_response is not None:
            last_response.raise_for_status()
        raise RuntimeError("No embedding request was attempted")

    def _request_candidates(self, text: str) -> list[tuple[str, dict[str, str]]]:
        model = self.settings.ollama_embed_model
        configured_path = self.settings.ollama_embed_path
        candidates = [
            (configured_path, {"model": model, "input": text}),
            ("/api/embed", {"model": model, "input": text}),
            ("/api/embeddings", {"model": model, "prompt": text}),
        ]

        unique: list[tuple[str, dict[str, str]]] = []
        seen: set[tuple[str, str]] = set()
        for path, payload in candidates:
            key = (_normalize_path(path), next(field for field in ("input", "prompt") if field in payload))
            if key not in seen:
                unique.append((path, payload))
                seen.add(key)
        return unique

    def _url(self, path: str) -> str:
        return self.base_url.rstrip("/") + "/" + path.lstrip("/")


def _extract_embedding(payload: dict[str, Any]) -> list[float]:
    if isinstance(payload.get("embedding"), list):
        return _to_float_list(payload["embedding"])

    if isinstance(payload.get("embeddings"), list) and payload["embeddings"]:
        first = payload["embeddings"][0]
        if isinstance(first, list):
            return _to_float_list(first)

    data = payload.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict) and isinstance(first.get("embedding"), list):
            return _to_float_list(first["embedding"])

    raise ValueError(f"Embedding response does not contain a vector: keys={list(payload.keys())}")


def _normalize_path(path: str) -> str:
    return "/" + path.strip("/")


def _to_float_list(values: Iterable[Any]) -> list[float]:
    return [float(value) for value in values]
