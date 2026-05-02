from typing import Any

from pymilvus import DataType, MilvusClient

from src.config import Settings


class MilvusVectorStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = MilvusClient(uri=settings.milvus_uri)

    def ensure_collection(self, drop_existing: bool = False) -> None:
        name = self.settings.milvus_collection
        if self.client.has_collection(name):
            if not drop_existing:
                self.client.load_collection(name)
                return
            self.client.drop_collection(name)

        schema = self.client.create_schema(auto_id=True, enable_dynamic_field=False)
        schema.add_field("id", DataType.INT64, is_primary=True)
        schema.add_field("chunk_text", DataType.VARCHAR, max_length=4000)
        schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=self.settings.embed_dim)
        schema.add_field("source_url", DataType.VARCHAR, max_length=1000)
        schema.add_field("source_type", DataType.VARCHAR, max_length=50)
        schema.add_field("page", DataType.INT32)
        schema.add_field("chunk_index", DataType.INT32)
        schema.add_field("doc_title", DataType.VARCHAR, max_length=500)
        schema.add_field("created_at", DataType.INT64)

        index_params = self.client.prepare_index_params()
        index_params.add_index(
            field_name="embedding",
            index_type="HNSW",
            metric_type="COSINE",
            params={"M": 16, "efConstruction": 200},
        )

        self.client.create_collection(
            collection_name=name,
            schema=schema,
            index_params=index_params,
        )
        self.client.load_collection(name)

    def insert(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        self.client.insert(collection_name=self.settings.milvus_collection, data=rows)
        return len(rows)

    def search(self, embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]:
        results = self.client.search(
            collection_name=self.settings.milvus_collection,
            data=[embedding],
            anns_field="embedding",
            search_params={"metric_type": "COSINE", "params": {"ef": self.settings.search_ef}},
            limit=top_k,
            output_fields=["chunk_text", "source_url", "source_type", "page", "chunk_index", "doc_title"],
        )
        return results[0] if results else []
