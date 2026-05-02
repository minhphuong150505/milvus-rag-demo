# Repository Guidelines

## Project Structure & Module Organization

This repository is a RAG chatbot demo split into three runtime modules:

- `ingestion/`: Python CLI for loading files/URLs, chunking text, embedding content, and inserting vectors into Milvus. Source is in `ingestion/src/`; scripts are in `ingestion/scripts/`; mounted data lives in `ingestion/data/`.
- `backend/`: Spring Boot API for chat orchestration, retrieval, prompt building, and Ollama calls. Code is under `backend/src/main/java/com/example/ragbot/`; tests are under `backend/src/test/java/`.
- `frontend/`: Vite React chat UI. Components are in `frontend/src/components/`, hooks in `frontend/src/hooks/`, API helpers in `frontend/src/api/`, and CSS in `frontend/src/styles/`.
- `data/`: collected source dataset and processed text. Keep `ingestion/data/` in sync when changing ingestable content.

## Build, Test, and Development Commands

- `docker compose up --build`: build and run Milvus, backend, and frontend.
- `docker compose up -d etcd minio milvus-standalone attu`: start only infrastructure.
- `docker compose --profile tools run --rm ingestion python -m src.main create-collection`: create the Milvus collection.
- `docker compose --profile tools run --rm ingestion python -m src.main ingest --path data/processed`: ingest prepared text files.
- `cd backend && mvn test`: run backend unit tests.
- `cd frontend && npm install && npm run build`: install frontend dependencies and verify production build.
- `cd ingestion && python3 -m compileall src`: quick Python syntax check.

## Coding Style & Naming Conventions

Python uses 4-space indentation, type hints where practical, and `snake_case` modules/functions. Java uses Spring Boot conventions: `PascalCase` classes, `camelCase` methods/fields, and packages under `com.example.ragbot`. React components use `PascalCase.jsx`; hooks use `useName.js`; API helpers use `camelCase.js`. Prefer focused files that match existing module boundaries.

## Testing Guidelines

Backend tests use JUnit via Spring Boot starter test. Name tests `*Test.java` and keep them close to the service behavior they verify. There is no frontend or ingestion test runner yet, so use `npm run build`, `python3 -m compileall`, and Docker ingestion smoke tests for those areas.

## Commit & Pull Request Guidelines

This checkout does not include Git history, so use concise imperative commits such as `Add ingestion dataset metadata` or `Fix Attu port configuration`. Pull requests should describe behavior changes, list verification commands, mention required `.env` changes, and include screenshots for visible frontend updates.

## Security & Configuration Tips

Never commit `.env` or API keys. Keep secrets in local `.env`; use `.env.example` only for placeholder values. Confirm `EMBED_DIM` matches the embedding model before recreating or ingesting a Milvus collection.
