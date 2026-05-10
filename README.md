<div align="center">

# 🤖 RAG Chatbot Demo

**Hệ thống hỏi đáp thông minh dựa trên tài liệu doanh nghiệp**

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-brightgreen?logo=springboot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Milvus](https://img.shields.io/badge/Milvus-v2.4-00B4D8?logo=data:image/svg+xml;base64,)](https://milvus.io)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose)
[![Ollama](https://img.shields.io/badge/Ollama-Cloud-black?logo=ollama)](https://ollama.com)

</div>

---

## ✨ Tính năng

- **Tìm kiếm ngữ nghĩa** — Milvus vector DB với HNSW/COSINE, tìm đúng ngay cả khi câu hỏi không khớp từ khóa
- **LLM trên cloud** — Gọi `gpt-oss:20b` qua Ollama Cloud, không cần GPU cục bộ
- **Trích dẫn nguồn** — Mỗi câu trả lời hiển thị đoạn văn gốc và điểm similarity
- **Fallback thông minh** — Khi không tìm thấy thông tin liên quan, hệ thống từ chối thay vì bịa đặt
- **Ingest đa dạng** — Hỗ trợ file `.txt`, `.md`, `.pdf`, `.html` và URL trực tiếp
- **Full Docker** — Một lệnh `docker compose up` chạy toàn bộ stack

---

## 🏗️ Kiến trúc

```
Tài liệu / URL
      │
      ▼
┌─────────────────┐     embed (local)      ┌──────────────────┐
│  Python Ingest  │ ──────────────────────▶│  Milvus Vector DB│
│  (Chunker +     │                         │  (HNSW / COSINE) │
│   Embedder)     │                         └────────┬─────────┘
└─────────────────┘                                  │
                                                     │ vector search
Câu hỏi người dùng                                   ▼
      │                                   ┌──────────────────┐
      ▼                                   │  Spring Boot API │
┌─────────────┐   embed → search → prompt │  /api/chat       │
│  React UI   │ ◀────────────────────────▶│                  │
│  (Vite)     │        câu trả lời +       │  Ollama Cloud    │
└─────────────┘        nguồn trích dẫn    │  gpt-oss:20b     │
                                           └──────────────────┘
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Ingestion | Python + LangChain | Chunking, embed, ghi vào Milvus |
| Vector DB | Milvus v2.4 | Lưu trữ và tìm kiếm vector |
| Backend | Spring Boot 3.3 | Orchestrate RAG pipeline |
| Chat LLM | Ollama Cloud `gpt-oss:20b` | Sinh câu trả lời |
| Embed Model | Ollama local `nomic-embed-text` | Tạo vector 768 chiều |
| Frontend | React 18 + Vite | Giao diện hội thoại |

---

## 🚀 Khởi động nhanh

### 1. Cấu hình môi trường

```bash
cp .env.example .env
```

Điền các giá trị sau vào `.env`:

```env
OLLAMA_API_KEY=<api-key-ollama-cloud>
OLLAMA_CHAT_MODEL=gpt-oss:20b
RAG_COMPANY_NAME=<tên công ty của bạn>
```

> **Lưu ý:** Chat dùng Ollama Cloud (`https://ollama.com`), embedding dùng Ollama local trong Docker. `EMBED_DIM=768` phải khớp với model embed.

### 2. Chạy toàn bộ stack

```bash
docker compose up -d
```

> Nếu gặp lỗi DNS khi build image lần đầu, tạo file `docker-compose.override.yml` với nội dung sau để bypass:
> ```yaml
> services:
>   ollama-pull:
>     command: ["--version"]
>   ollama-pull-chat:
>     command: ["--version"]
> ```

### 3. Tạo collection và ingest dữ liệu

```bash
# Tạo collection trong Milvus
docker compose --profile tools run --rm ingestion python -m src.main create-collection

# Ingest tài liệu
docker compose --profile tools run --rm ingestion python -m src.main ingest --path data/processed

# Hoặc ingest từ URL
docker compose --profile tools run --rm ingestion python -m src.main ingest-url https://example.com
```

### 4. Mở giao diện

| URL | Dịch vụ |
|---|---|
| http://localhost:3000 | Giao diện chatbot |
| http://localhost:8081/api/health | Backend health check |
| http://localhost:3002 | Attu — Milvus UI |
| http://localhost:9001 | MinIO console |

---

## 🛠️ Phát triển local

**Backend (Spring Boot):**
```bash
cd backend && mvn spring-boot:run
```

**Frontend (React):**
```bash
cd frontend && npm install
VITE_API_BASE=http://localhost:8081/api npm run dev
```

**Ingestion (Python):**
```bash
cd ingestion
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m src.main ingest --path data/processed
```

---

## 📡 API

**POST** `/api/chat`

```json
{
  "question": "Doanh thu năm 2024 của FPT là bao nhiêu?",
  "topK": 5
}
```

```json
{
  "answer": "Doanh thu hợp nhất năm 2024 của FPT đạt...",
  "sources": [
    {
      "docTitle": "bao_cao_thuong_nien_FPT_2024",
      "score": 0.94,
      "snippet": "..."
    }
  ],
  "grounded": true,
  "latencyMs": 3200
}
```

---

## 📁 Cấu trúc dự án

```
├── ingestion/          # Python — chunking, embedding, ingest
│   ├── src/
│   │   ├── pipeline.py
│   │   ├── loaders/    # text, pdf, web loaders
│   │   └── main.py
│   └── data/
│       └── processed/  # tài liệu đã xử lý
├── backend/            # Spring Boot — RAG orchestrator
│   └── src/main/java/com/example/ragbot/
│       ├── ChatController.java
│       ├── RagOrchestrator.java
│       └── config/
├── frontend/           # React + Vite — giao diện chat
│   └── src/
│       ├── hooks/useChat.js
│       └── components/
├── docker-compose.yml
└── .env.example
```

---

<div align="center">
  <sub>Built with ❤️ · Milvus · Spring Boot · React · Ollama</sub>
</div>
