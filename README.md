# RAG Chatbot Demo

Demo RAG theo kiến trúc hybrid: Python ingestion ghi dữ liệu vào Milvus, Spring Boot xử lý API chat, React hiển thị hội thoại và nguồn trích dẫn.

## Yêu cầu

- Docker và Docker Compose
- Java 17 và Maven nếu chạy backend local
- Node.js 20 nếu chạy frontend local
- Python 3.11 nếu chạy ingestion local
- API key Ollama Cloud hoặc endpoint Ollama tương thích

## Cấu hình

```bash
cp .env.example .env
```

Cập nhật các giá trị quan trọng trong `.env`:

- `OLLAMA_API_KEY`
- `OLLAMA_CHAT_MODEL`
- `OLLAMA_EMBED_BASE_URL`
- `OLLAMA_EMBED_MODEL`
- `EMBED_DIM`
- `RAG_COMPANY_NAME`

Mặc định chat dùng Ollama Cloud qua `OLLAMA_BASE_URL=https://ollama.com`, còn embedding dùng Ollama local trong Docker qua `OLLAMA_EMBED_BASE_URL=http://ollama:11434`. `EMBED_DIM` phải khớp đúng số chiều vector mà embedding model trả về.

## Chạy hạ tầng

```bash
docker compose up -d etcd minio milvus-standalone attu
```

Attu chạy tại `http://localhost:3002` theo mặc định. Nếu cổng này bận, đặt `ATTU_PORT` trong `.env` sang cổng khác. Khi connect, dùng Milvus URI `milvus-standalone:19530` trong mạng Docker hoặc `localhost:19530` từ máy host.

## Tạo collection

```bash
docker compose --profile tools run --rm ingestion python -m src.main create-collection
```

Nếu đổi embedding model hoặc `EMBED_DIM`, tạo lại collection:

```bash
docker compose --profile tools run --rm ingestion python -m src.main create-collection --drop-existing
```

## Ingest dữ liệu

Bộ dữ liệu FPT đã được đặt trong `ingestion/data/`. Để ingest bản text đã xử lý sẵn, chạy:

```bash
docker compose --profile tools run --rm ingestion python -m src.main ingest --path data/processed
```

Nếu muốn ingest file gốc thay vì bản text đã xử lý, đặt file `.txt`, `.md`, `.html`, `.htm`, `.pdf` vào `ingestion/data/raw/` và đổi `--path` thành `data/raw`.

Ingest URL trực tiếp:

```bash
docker compose --profile tools run --rm ingestion python -m src.main ingest-url https://example.com
```

Test retrieval bằng Python:

```bash
docker compose --profile tools run --rm ingestion python -m src.main query "công ty làm gì?" --top-k 3
```

## Chạy toàn bộ demo

```bash
docker compose up --build
```

Compose tự nạp API key và model từ file `.env` ở thư mục gốc. Lần chạy đầu sẽ tự pull embedding model `nomic-embed-text` vào container `rag-ollama`.

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8081/api/health`
- Chat API: `POST http://localhost:8081/api/chat`

Ví dụ:

```bash
curl -X POST http://localhost:8081/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"Công ty có chính sách đổi trả như thế nào?","topK":5}'
```

## Chạy local khi phát triển

Backend:

```bash
cd backend
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
VITE_API_BASE=http://localhost:8081/api npm run dev
```

Ingestion:

```bash
cd ingestion
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export OLLAMA_EMBED_BASE_URL=http://localhost:11434
python -m src.main create-collection
python -m src.main ingest --path data/processed
```

## Câu hỏi demo

- Công ty cung cấp sản phẩm hoặc dịch vụ gì?
- Chính sách đổi trả hoặc hoàn tiền như thế nào?
- Thời gian giao hàng dự kiến là bao lâu?
- Tôi liên hệ bộ phận hỗ trợ bằng cách nào?
- Thời tiết hôm nay thế nào?

Câu hỏi cuối là out-of-scope và backend phải trả về fallback thay vì gọi LLM nếu retrieval không đạt threshold.
