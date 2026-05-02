# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG chatbot demo: Python ingests documents into Milvus, Spring Boot orchestrates retrieval + LLM chat, React renders conversation with source citations. All three modules run in Docker Compose.

## Commands

### Infrastructure
```bash
docker compose up -d etcd minio milvus-standalone attu   # start Milvus + dependencies
```

### Ingestion (Python)
```bash
docker compose --profile tools run --rm ingestion python -m src.main create-collection
docker compose --profile tools run --rm ingestion python -m src.main create-collection --drop-existing
docker compose --profile tools run --rm ingestion python -m src.main ingest --path data/processed
docker compose --profile tools run --rm ingestion python -m src.main ingest-url https://example.com
docker compose --profile tools run --rm ingestion python -m src.main query "câu hỏi?" --top-k 3
```

### Backend (Spring Boot)
```bash
cd backend && mvn spring-boot:run              # run locally
cd backend && mvn test                          # run tests
cd backend && mvn test -Dtest=PromptBuilderTest # single test class
```

### Frontend (React/Vite)
```bash
cd frontend && npm install
VITE_API_BASE=http://localhost:8080/api npm run dev  # dev server
cd frontend && npm run build                          # production build check
```

### Full stack
```bash
docker compose up --build   # everything: Milvus + backend + frontend
```

### Python syntax check
```bash
cd ingestion && python3 -m compileall src
```

## Architecture

### Data flow
```
Documents/URLs → Ingestion Pipeline → Milvus (HNSW/COSINE)
                                         ↑
User Question → Backend (embed → search → prompt → LLM) → ChatResponse → React UI
```

### Ingestion pipeline (`ingestion/src/pipeline.py`)
`IngestionPipeline` orchestrates: `Chunker` → `OllamaEmbedder` → `MilvusVectorStore`.
- **Chunker** uses LangChain's `RecursiveCharacterTextSplitter` (default 800 chars, 150 overlap). Separators: `\n\n`, `\n`, `. `, ` `, ``.
- **Deduplication**: MD5 hash of chunk text, skipped if seen before in the same run.
- **Batch embedding**: configurable `EMBED_BATCH_SIZE` (default 16), one-at-a-time API calls.
- **Loaders** (`ingestion/src/loaders/`): `text_loader.py` (.txt/.md/.html/.htm), `pdf_loader.py` (PyMuPDF), `web_loader.py` (requests + BeautifulSoup).
- **Milvus SDK**: Uses the newer `pymilvus.MilvusClient` (not the ORM-style `Collection` API).

### Backend (`backend/src/main/java/com/example/ragbot/`)
- **`ChatController`** → `POST /api/chat` (validated `ChatRequest`) and `GET /api/health`.
- **`RagOrchestrator`** is the central service. Flow per request:
  1. `EmbeddingService.embed(question)` — calls Ollama embeddings API
  2. `RetrievalService.searchTopK(vector, topK)` — Milvus COSINE search with ef=64
  3. Filter results ≥ `RAG_SCORE_THRESHOLD`; if none, return `fallbackAnswer` with `grounded=false`
  4. `PromptBuilder.build(question, evidence)` — Vietnamese system prompt, company name templated, context truncated to `RAG_MAX_CONTEXT_CHARS`
  5. `LlmService.chat(prompt)` — calls Ollama chat API (non-streaming, temp 0.1)
- **Milvus SDK**: Uses the older Java SDK (`io.milvus.client.MilvusServiceClient` + gRPC search params). This is intentionally different from the Python ingestion's `pymilvus.MilvusClient` — they are independent implementations hitting the same Milvus collection.
- **Configuration**: `application.yml` binds env vars to `@ConfigurationProperties` records (`MilvusProperties`, `OllamaProperties`, `RagProperties`).
- **OllamaConfig**: conditionally adds `Authorization: Bearer` header if API key is set.

### Frontend (`frontend/src/`)
- **`useChat` hook** manages all state: messages array, sources, topK slider, loading, error. Each message has `{id, role, content, grounded, latencyMs, sources}`.
- **`chatApi.js`**: Axios instance, base URL from `VITE_API_BASE` env var, 120s timeout.
- **Components**: `App` (3-column shell with sidebar rail) → `ChatBox` (message list + composer) → `MessageBubble` + `SourceList` + `LoadingDots`.

### Ollama API compatibility
Both Python and Java handle multiple Ollama-compatible API shapes:
- Embedding request field: tries `"input"` first, falls back to `"prompt"` on 400/404/422
- Embedding response: checks `embedding`, `embeddings[0]`, `data[0].embedding`
- Chat response: checks `message.content`, `response`, `choices[0].message.content`, `choices[0].text`

### Milvus collection schema
Fields: `id` (INT64 PK auto), `chunk_text` (VARCHAR 4000), `embedding` (FLOAT_VECTOR, dim configurable), `source_url`, `source_type`, `page`, `chunk_index`, `doc_title`, `created_at`. Index: HNSW with COSINE metric, M=16, efConstruction=200.

### Key env vars
`EMBED_DIM` must match the actual embedding model dimension. Mismatch causes insertion failures. Change requires dropping and recreating the collection.
