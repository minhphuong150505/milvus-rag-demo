from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    milvus_uri: str = Field("http://localhost:19530", alias="MILVUS_URI")
    milvus_collection: str = Field("company_kb", alias="MILVUS_COLLECTION")
    embed_dim: int = Field(768, alias="EMBED_DIM")

    ollama_base_url: str = Field("https://ollama.com", alias="OLLAMA_BASE_URL")
    ollama_api_key: str | None = Field(None, alias="OLLAMA_API_KEY")
    ollama_embed_base_url: str | None = Field(None, alias="OLLAMA_EMBED_BASE_URL")
    ollama_embed_api_key: str | None = Field(None, alias="OLLAMA_EMBED_API_KEY")
    ollama_embed_model: str = Field("nomic-embed-text", alias="OLLAMA_EMBED_MODEL")
    ollama_embed_path: str = Field("/api/embed", alias="OLLAMA_EMBED_PATH")

    chunk_size: int = Field(800, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(150, alias="CHUNK_OVERLAP")
    embed_batch_size: int = Field(16, alias="EMBED_BATCH_SIZE")
    search_ef: int = Field(64, alias="MILVUS_SEARCH_EF")


@lru_cache
def get_settings() -> Settings:
    return Settings()
