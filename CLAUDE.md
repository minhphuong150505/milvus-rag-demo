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
cd frontend && npm test                               # SSE parser tests
cd frontend && npm run test:e2e                        # browser + axe, mock API
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
- **`ChatController`** → `POST /api/chat` (JSON), `POST /api/chat/stream` (SSE), and `GET /api/health` (backend liveness only). Responses explicitly select JSON to avoid transitive XML converters.
- `ChatRequest.history` accepts at most 12 user/assistant messages, 4,000 chars each. Question limit 2,000; Top K 1–20. Prompt history uses a 6,000-character budget and is not evidence. Explicit Vietnamese follow-ups include the previous user question for retrieval.
- `OllamaStreamParser` reads bounded NDJSON frames, preserves Unicode, rejects upstream errors/truncation without `done`. `StreamingConfig` provides a bounded MVC executor and 180s timeout. SSE events: `sources`, `token`, then `done` (full ChatResponse); failures emit `error`.
- `SourceDto` retains `snippet` and adds `sourceType`/`chunkText`. LLM refusal produces `grounded=false` and empty final sources. Milvus connect/search deadlines are 5s/15s.
- **`RagOrchestrator`** is the central service. Flow per request:
  1. `EmbeddingService.embed(question)` — calls Ollama embeddings API
  2. `RetrievalService.searchTopK(vector, 64)` — Milvus COSINE candidate search with ef=64; `CandidateReranker` adds 0.2 × normalized query-term coverage + 0.2 × adjacent query-term-pair coverage and selects requested Top K, preserving original cosine scores. This keeps specific FAQ evidence from being displaced by generic annual-report chunks.
  3. Filter results ≥ `RAG_SCORE_THRESHOLD`; if none, return `fallbackAnswer` with `grounded=false`
  4. `PromptBuilder.build(question, evidence)` — Vietnamese system prompt, company name templated, context truncated to `RAG_MAX_CONTEXT_CHARS`
  5. `LlmService.chat(prompt)` — calls Ollama chat API (JSON or streaming NDJSON, temp 0.1)
- **Milvus SDK**: Uses the older Java SDK (`io.milvus.client.MilvusServiceClient` + gRPC search params). This is intentionally different from the Python ingestion's `pymilvus.MilvusClient` — they are independent implementations hitting the same Milvus collection.
- **Configuration**: `application.yml` binds env vars to `@ConfigurationProperties` records (`MilvusProperties`, `OllamaProperties`, `RagProperties`).
- **OllamaConfig**: conditionally adds `Authorization: Bearer` header if API key is set.

### Frontend (`frontend/src/`)
- **`useChat` hook** manages conversations, drafts, selected answer, Top K and the active AbortController. Storage (`lib/conversations.js`) is versioned, bounded to 50 conversations, debounced, and reports quota failures. Regenerate replaces the selected answer without deleting subsequent turns.
- **`chatApi.js`** uses native fetch with `VITE_API_BASE` (default `/api`), 180s deadline and an incremental UTF-8/SSE parser. Falls back to JSON only before any token; never after cancellation.
- **Components**: `App` composes `Sidebar`/`ConversationList`, `Settings`, `Drawer` (native modal dialog), `ChatBox`/`Welcome`/`MessageBubble`, and `SourceList`. Source selection is per answer; a Markdown AST plugin turns `[n]` text into citation buttons without touching code/links.
- **Styling**: plain CSS tokens and light/dark themes in `styles/chat.css`; self-hosted Be Vietnam Pro. Below 1200px sources use a drawer; below 701px sidebar also uses a drawer. `useTheme` follows system preference unless explicitly overridden; `useHealth` polls backend every 30s.
- **Markdown**: react-markdown + remark-gfm; raw HTML is not enabled. Source links permit only HTTP(S).
- **Testing**: `npm test` covers SSE framing; `npm run test:e2e` launches isolated mock API + Vite and Chromium/axe. Tests and mock server are in `frontend/e2e/`; screenshots in `docs/screenshots/` are explicitly mock-backed.
- **Docker**: frontend uses `npm ci`, includes public/favicon and font assets. `VITE_API_BASE` remains a build arg; Nginx disables proxy buffering for SSE.

### Ollama API compatibility
Both Python and Java handle multiple Ollama-compatible API shapes:
- Embedding request field: tries `"input"` first, falls back to `"prompt"` on 400/404/422
- Embedding response: checks `embedding`, `embeddings[0]`, `data[0].embedding`
- Chat response: checks `message.content`, `response`, `choices[0].message.content`, `choices[0].text`

### Milvus collection schema
Fields: `id` (INT64 PK auto), `chunk_text` (VARCHAR 4000), `embedding` (FLOAT_VECTOR, dim configurable), `source_url`, `source_type`, `page`, `chunk_index`, `doc_title`, `created_at`. Index: HNSW with COSINE metric, M=16, efConstruction=200.

### Key env vars
`EMBED_DIM` must match the actual embedding model dimension. Mismatch causes insertion failures. Change requires dropping and recreating the collection.
