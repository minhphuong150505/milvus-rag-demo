# Plan triển khai RAG Chatbot doanh nghiệp (Demo, Production-ready mindset)

> **Vai trò người soạn**: Solution Architect kiêm Tech Lead
> **Đối tượng**: Demo kỹ thuật RAG, có thể mở rộng lên production
> **Tech stack chính**: Spring Boot + ReactJS + Milvus + Ollama Cloud + Python ingestion (hybrid)

---

## 1. Tổng quan kiến trúc

Đây là kiến trúc **hybrid** mà tôi khuyến nghị thay vì làm tất cả bằng Java thuần. Lý do thực tế:

- **Ingestion bằng Python** vì hệ sinh thái parsing tài liệu (PDF, HTML, DOCX) và chunking ở Python trưởng thành hơn nhiều so với Java (`unstructured`, `pypdf`, `langchain-text-splitters`, `beautifulsoup4`, `trafilatura`). Bạn sẽ tiết kiệm 1-2 ngày debug parser.
- **Backend chat API bằng Spring Boot** vì đây là nơi cần ổn định, có sẵn auth, exception handling, observability, và bạn đã quen.
- **Cả hai cùng trỏ vào một instance Milvus duy nhất**. Python ghi vào collection, Java đọc từ collection.

Phân chia trách nhiệm:

| Thành phần | Trách nhiệm | Ngôn ngữ |
|---|---|---|
| Ingestion service | Crawl/parse/chunk/embed → ghi Milvus | Python |
| Chat backend | Nhận câu hỏi → embed query → search Milvus → gọi LLM → trả lời | Java Spring Boot |
| Vector DB | Lưu vector + metadata, search ANN | Milvus standalone |
| LLM provider | Sinh embedding + sinh câu trả lời | Ollama Cloud (REST API) |
| Frontend | Chat UI + hiển thị sources | React |
| Orchestration | Đóng gói toàn bộ | Docker Compose |

Một quyết định kiến trúc quan trọng: **embedding cho ingestion và embedding cho query phải dùng cùng một model, cùng một version, cùng một chuẩn hóa text**. Nếu không, similarity search sẽ ra kết quả rác. Tôi sẽ nhắc lại ở mục 8.

---

## 2. Sơ đồ luồng xử lý

### 2.1. Ingestion flow (offline, chạy 1 lần hoặc theo lịch)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PYTHON INGESTION SERVICE                       │
│                                                                      │
│  [Sources]              [Parse]            [Clean]         [Chunk]   │
│   ┌─────────┐         ┌─────────┐       ┌──────────┐    ┌─────────┐  │
│   │ Website │ ──────▶ │ HTML →  │ ────▶ │ Strip    │ ─▶ │ Split   │  │
│   │ PDF     │ ──────▶ │ text    │       │ boilerpl │    │ ~500    │  │
│   │ Docs    │         │ pypdf   │       │ dedup    │    │ tokens  │  │
│   └─────────┘         └─────────┘       └──────────┘    └────┬────┘  │
│                                                              │       │
│                                                              ▼       │
│                                       [Embed via Ollama Cloud]       │
│                                       POST /api/embeddings           │
│                                              │                       │
│                                              ▼                       │
│                                       [Insert into Milvus]           │
│                                       collection: company_kb         │
│                                              │                       │
└──────────────────────────────────────────────┼───────────────────────┘
                                               ▼
                                        ┌──────────────┐
                                        │ Milvus       │
                                        │ standalone   │
                                        └──────────────┘
```

### 2.2. Query answering flow (online, mỗi câu hỏi)

```
 User                React              Spring Boot           Milvus            Ollama Cloud
  │                    │                    │                   │                   │
  │  type question     │                    │                   │                   │
  │ ─────────────────▶ │                    │                   │                   │
  │                    │ POST /api/chat     │                   │                   │
  │                    │ ─────────────────▶ │                   │                   │
  │                    │                    │ embed(question)   │                   │
  │                    │                    │ ──────────────────────────────────▶  │
  │                    │                    │ ◀────── vector ──────────────────────│
  │                    │                    │                   │                   │
  │                    │                    │ search top-K      │                   │
  │                    │                    │ ─────────────────▶│                   │
  │                    │                    │ ◀── chunks+meta───│                   │
  │                    │                    │                   │                   │
  │                    │                    │ build prompt(ctx, q)                  │
  │                    │                    │ chat completion                       │
  │                    │                    │ ──────────────────────────────────▶  │
  │                    │                    │ ◀────── answer ──────────────────────│
  │                    │ {answer, sources}  │                   │                   │
  │                    │ ◀───────────────── │                   │                   │
  │ render             │                    │                   │                   │
  │ ◀────────────────  │                    │                   │                   │
```

### 2.3. Guardrail flow (kiểm soát hallucination)

```
                ┌─────────────────────────────────────┐
                │ Top-K chunks từ Milvus              │
                └──────────────┬──────────────────────┘
                               ▼
                ┌──────────────────────────────────────┐
                │ Có chunk nào score >= threshold?     │
                │ (ví dụ cosine_sim >= 0.55)           │
                └────────┬─────────────────┬───────────┘
                         │ NO              │ YES
                         ▼                 ▼
              ┌─────────────────┐    ┌──────────────────────┐
              │ Trả về:         │    │ Build prompt với     │
              │ "Tôi không tìm  │    │ system rule:         │
              │ thấy thông tin  │    │ "Chỉ trả lời dựa     │
              │ trong tài liệu" │    │ trên CONTEXT. Nếu    │
              │ KHÔNG gọi LLM   │    │ không có thì nói     │
              └─────────────────┘    │ không biết."         │
                                     └──────────┬───────────┘
                                                ▼
                                     ┌──────────────────────┐
                                     │ Gọi Ollama chat      │
                                     │ Trả về answer +      │
                                     │ sources có score     │
                                     └──────────────────────┘
```

---

## 3. Danh sách service trong Docker Compose

| Service | Image | Port | Vai trò |
|---|---|---|---|
| `etcd` | `quay.io/coreos/etcd:v3.5.5` | 2379 | Metadata cho Milvus |
| `minio` | `minio/minio:RELEASE.2023-03-20T20-16-18Z` | 9000, 9001 | Object storage cho Milvus |
| `milvus-standalone` | `milvusdb/milvus:v2.4.x` | 19530 (gRPC), 9091 (metrics) | Vector DB |
| `attu` | `zilliz/attu:v2.4` | 3001 | (Optional) GUI quản trị Milvus, rất hữu ích cho demo |
| `ingestion` | Tự build từ Python Dockerfile | — (chạy one-shot) | Ingest dữ liệu doanh nghiệp |
| `backend` | Tự build từ Spring Boot Dockerfile | 8080 | REST API chat |
| `frontend` | Tự build từ Node Dockerfile | 3000 | UI React |

**Lưu ý**: Milvus standalone bắt buộc cần `etcd` và `minio` đi kèm — đây không phải lựa chọn, đây là yêu cầu của Milvus 2.x. Bạn không thể chạy Milvus một mình.

---

## 4. Cấu trúc thư mục project đề xuất

```
rag-chatbot-demo/
├── docker-compose.yml
├── .env                          # Các secret: OLLAMA_API_KEY, MILVUS_HOST...
├── .env.example
├── README.md
│
├── ingestion/                    # Python service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pyproject.toml            # (optional, nếu dùng poetry)
│   ├── data/
│   │   ├── raw/                  # File PDF, HTML thô
│   │   └── processed/            # JSON chunks đã clean
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py               # CLI entrypoint: python -m src.main ingest
│   │   ├── config.py             # Pydantic settings
│   │   ├── loaders/
│   │   │   ├── web_loader.py
│   │   │   ├── pdf_loader.py
│   │   │   └── text_loader.py
│   │   ├── chunker.py            # Recursive text splitter
│   │   ├── embedder.py           # Ollama Cloud client
│   │   ├── milvus_client.py      # Wrapper pymilvus
│   │   └── pipeline.py           # Orchestrator
│   └── scripts/
│       └── crawl_company.py      # Script ad-hoc thu thập data
│
├── backend/                      # Spring Boot
│   ├── Dockerfile
│   ├── pom.xml
│   ├── src/main/java/com/example/ragbot/
│   │   ├── RagbotApplication.java
│   │   ├── config/
│   │   │   ├── MilvusConfig.java
│   │   │   ├── OllamaConfig.java
│   │   │   └── WebConfig.java    # CORS
│   │   ├── controller/
│   │   │   └── ChatController.java
│   │   ├── dto/
│   │   │   ├── ChatRequest.java
│   │   │   ├── ChatResponse.java
│   │   │   └── SourceDto.java
│   │   ├── service/
│   │   │   ├── EmbeddingService.java
│   │   │   ├── RetrievalService.java
│   │   │   ├── PromptBuilder.java
│   │   │   ├── LlmService.java
│   │   │   └── RagOrchestrator.java
│   │   └── exception/
│   │       └── GlobalExceptionHandler.java
│   └── src/main/resources/
│       └── application.yml
│
└── frontend/                     # React
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js            # Hoặc CRA, tôi recommend Vite
    ├── public/
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── chatApi.js
        ├── components/
        │   ├── ChatBox.jsx
        │   ├── MessageBubble.jsx
        │   ├── SourceList.jsx
        │   └── LoadingDots.jsx
        ├── hooks/
        │   └── useChat.js
        └── styles/
            └── chat.css
```

---

## 5. Các bước triển khai theo thứ tự

Đây là thứ tự tôi khuyên bạn làm. Đừng nhảy bước — mỗi bước trước là điều kiện kiểm tra cho bước sau.

**Bước 1 — Dựng hạ tầng Milvus (30 phút)**
- Viết `docker-compose.yml` với 3 service: etcd, minio, milvus-standalone, attu.
- `docker compose up -d`.
- Mở `http://localhost:3001` (Attu) → connect tới `milvus-standalone:19530` → thấy giao diện = OK.

**Bước 2 — Verify Ollama Cloud (15 phút)**
- Lấy API key từ Ollama Cloud.
- Test bằng `curl` cả 2 endpoint: chat completion và embeddings. Ghi lại tên model bạn sẽ dùng.
- Xác nhận model embedding trả về vector bao nhiêu chiều (768, 1024, hoặc 1536 — sẽ quyết định schema Milvus).

**Bước 3 — Tạo Milvus collection (15 phút)**
- Viết script Python ngắn dùng `pymilvus` để tạo collection `company_kb` với schema ở mục 6.
- Verify bằng Attu là collection đã tồn tại, có index chưa.

**Bước 4 — Ingest tài liệu (3-5 giờ)**
- Thu thập 5-10 file/trang về doanh nghiệp bạn chọn → bỏ vào `ingestion/data/raw/`.
- Viết loader → chunker → embedder → milvus insert.
- Chạy thử pipeline. Verify trên Attu là có row trong collection.
- **Test query bằng Python**: hỏi "công ty làm gì?" → search top-3 → đọc kết quả xem có liên quan không. Nếu kết quả rác, dừng lại debug chunking/embedding trước khi đi tiếp.

**Bước 5 — Backend Spring Boot (4-6 giờ)**
- Khởi tạo project (Spring Initializr): web, validation, lombok.
- Cấu hình Milvus client + Ollama client.
- Viết `RagOrchestrator` theo flow ở mục 2.2.
- Expose `POST /api/chat`.
- Test bằng Postman/curl.

**Bước 6 — Frontend React (2-3 giờ)**
- `npm create vite@latest frontend -- --template react`.
- Component `ChatBox` + `SourceList` + hook `useChat`.
- Gọi API backend, hiển thị answer + sources.

**Bước 7 — Đóng gói Docker hoàn chỉnh (1-2 giờ)**
- Viết Dockerfile cho cả 3 service (ingestion, backend, frontend).
- Update `docker-compose.yml` thêm 3 service.
- `docker compose up --build`.

**Bước 8 — Guardrail và tinh chỉnh (1-2 giờ)**
- Thêm threshold check trước khi gọi LLM.
- Tinh chỉnh prompt template.
- Test các câu hỏi out-of-scope.

**Bước 9 — Demo polish (1 giờ)**
- README ngắn gọn cách chạy.
- Vài câu hỏi mẫu để demo.
- Screenshot/video.

---

## 6. Thiết kế Milvus collection schema

Tên collection: `company_kb`

| Field | Kiểu | Thuộc tính | Ghi chú |
|---|---|---|---|
| `id` | INT64 | primary, auto_id=True | Milvus tự sinh |
| `chunk_text` | VARCHAR(4000) | — | Nội dung text gốc của chunk |
| `embedding` | FLOAT_VECTOR(dim=N) | index | N phụ thuộc model embedding (xem bước 2) |
| `source_url` | VARCHAR(1000) | — | URL gốc hoặc đường dẫn file |
| `source_type` | VARCHAR(50) | — | `web`, `pdf`, `docx` |
| `page` | INT32 | — | Số trang (PDF), nếu không có thì 0 |
| `chunk_index` | INT32 | — | Thứ tự chunk trong document, để rebuild context |
| `doc_title` | VARCHAR(500) | — | Tiêu đề tài liệu, dùng để hiển thị nguồn cho user |
| `created_at` | INT64 | — | Unix timestamp, tiện cho việc xóa data cũ |

**Index recommendation**:
- Index type: `HNSW` (chất lượng cao, phù hợp dataset nhỏ-vừa của demo)
- Metric: `COSINE` (chuẩn nhất cho text embedding đã được model normalize)
- Params: `M=16, efConstruction=200`, search với `ef=64`

**Code mẫu Python tạo collection** (`pymilvus` v2.4+):

```python
from pymilvus import MilvusClient, DataType

client = MilvusClient(uri="http://milvus-standalone:19530")

EMBED_DIM = 768  # Đổi theo model của bạn

schema = client.create_schema(auto_id=True, enable_dynamic_field=False)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("chunk_text", DataType.VARCHAR, max_length=4000)
schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=EMBED_DIM)
schema.add_field("source_url", DataType.VARCHAR, max_length=1000)
schema.add_field("source_type", DataType.VARCHAR, max_length=50)
schema.add_field("page", DataType.INT32)
schema.add_field("chunk_index", DataType.INT32)
schema.add_field("doc_title", DataType.VARCHAR, max_length=500)
schema.add_field("created_at", DataType.INT64)

index_params = client.prepare_index_params()
index_params.add_index(
    field_name="embedding",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 200},
)

client.create_collection(
    collection_name="company_kb",
    schema=schema,
    index_params=index_params,
)
client.load_collection("company_kb")
```

---

## 7. Thiết kế API backend Spring Boot

### 7.1. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/chat` | Gửi câu hỏi, nhận về answer + sources |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/chat/history?sessionId=xxx` | (Optional) Lấy lịch sử hội thoại |

### 7.2. DTO

```java
// ChatRequest.java
public record ChatRequest(
    @NotBlank String question,
    String sessionId,         // nullable, dùng cho conversational memory về sau
    Integer topK              // nullable, default 5
) {}

// SourceDto.java
public record SourceDto(
    String docTitle,
    String sourceUrl,
    Integer page,
    Double score,
    String snippet           // 200 ký tự đầu của chunk, để show trên UI
) {}

// ChatResponse.java
public record ChatResponse(
    String answer,
    List<SourceDto> sources,
    boolean grounded,        // true nếu trả lời từ context, false nếu fallback
    Long latencyMs
) {}
```

### 7.3. Service skeleton

```java
@Service
@RequiredArgsConstructor
public class RagOrchestrator {

    private final EmbeddingService embeddingService;
    private final RetrievalService retrievalService;
    private final PromptBuilder promptBuilder;
    private final LlmService llmService;

    private static final double SCORE_THRESHOLD = 0.55;
    private static final String FALLBACK_ANSWER =
        "Tôi không tìm thấy thông tin này trong tài liệu của doanh nghiệp.";

    public ChatResponse answer(ChatRequest req) {
        long t0 = System.currentTimeMillis();
        int topK = req.topK() != null ? req.topK() : 5;

        // 1. Embed query
        float[] qVec = embeddingService.embed(req.question());

        // 2. Retrieve
        List<RetrievedChunk> chunks = retrievalService.searchTopK(qVec, topK);

        // 3. Guardrail: nếu không có chunk nào đủ tin cậy
        boolean grounded = chunks.stream().anyMatch(c -> c.score() >= SCORE_THRESHOLD);
        if (!grounded) {
            return new ChatResponse(FALLBACK_ANSWER, List.of(), false,
                System.currentTimeMillis() - t0);
        }

        // 4. Build prompt
        String prompt = promptBuilder.build(req.question(), chunks);

        // 5. Call LLM
        String answer = llmService.chat(prompt);

        // 6. Map sources
        List<SourceDto> sources = chunks.stream()
            .filter(c -> c.score() >= SCORE_THRESHOLD)
            .map(this::toSourceDto)
            .toList();

        return new ChatResponse(answer, sources, true,
            System.currentTimeMillis() - t0);
    }

    private SourceDto toSourceDto(RetrievedChunk c) {
        String snippet = c.text().length() > 200
            ? c.text().substring(0, 200) + "..."
            : c.text();
        return new SourceDto(c.docTitle(), c.sourceUrl(), c.page(), c.score(), snippet);
    }
}
```

### 7.4. Milvus client (Java)

Dùng `io.milvus:milvus-sdk-java:2.4.x`. Skeleton:

```java
@Service
public class RetrievalService {

    private final MilvusServiceClient milvus;

    public RetrievalService(@Value("${milvus.host}") String host,
                            @Value("${milvus.port}") int port) {
        this.milvus = new MilvusServiceClient(
            ConnectParam.newBuilder()
                .withHost(host)
                .withPort(port)
                .build());
    }

    public List<RetrievedChunk> searchTopK(float[] queryVec, int topK) {
        SearchParam params = SearchParam.newBuilder()
            .withCollectionName("company_kb")
            .withMetricType(MetricType.COSINE)
            .withTopK(topK)
            .withVectors(List.of(toFloatList(queryVec)))
            .withVectorFieldName("embedding")
            .withParams("{\"ef\": 64}")
            .withOutFields(List.of("chunk_text", "source_url",
                "source_type", "page", "chunk_index", "doc_title"))
            .build();

        R<SearchResults> resp = milvus.search(params);
        // ... parse resp thành List<RetrievedChunk>
    }
}
```

### 7.5. Ollama Cloud client (Java)

Dùng `WebClient` hoặc `RestClient` của Spring 6.

```java
@Service
public class EmbeddingService {

    private final RestClient restClient;
    private final String model;

    public EmbeddingService(@Value("${ollama.base-url}") String baseUrl,
                            @Value("${ollama.api-key}") String apiKey,
                            @Value("${ollama.embed-model}") String model) {
        this.restClient = RestClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .build();
        this.model = model;
    }

    public float[] embed(String text) {
        var req = Map.of("model", model, "input", text);
        var resp = restClient.post()
            .uri("/api/embeddings")
            .body(req)
            .retrieve()
            .body(EmbeddingResponse.class);
        return resp.embedding();
    }
}
```

> **Lưu ý**: Endpoint chính xác (`/api/embeddings` vs `/v1/embeddings`) và format request của Ollama Cloud có thể khác bản local. Bước 2 của roadmap (verify bằng curl) là để xác nhận điều này. Nếu Ollama Cloud không expose embedding model, fallback option: dùng `nomic-embed-text` hoặc `bge-m3` chạy local trong cùng compose.

### 7.6. `application.yml`

```yaml
server:
  port: 8080

milvus:
  host: ${MILVUS_HOST:milvus-standalone}
  port: ${MILVUS_PORT:19530}
  collection: company_kb

ollama:
  base-url: ${OLLAMA_BASE_URL:https://ollama.com}
  api-key: ${OLLAMA_API_KEY}
  chat-model: ${OLLAMA_CHAT_MODEL:gpt-oss:20b}
  embed-model: ${OLLAMA_EMBED_MODEL:nomic-embed-text}

rag:
  top-k: 5
  score-threshold: 0.55
  max-context-chars: 6000
```

---

## 8. Thiết kế Python ingestion pipeline

### 8.1. Triết lý

- **Mỗi document → nhiều chunk.** Một chunk là 1 row trong Milvus.
- **Chunking quyết định chất lượng RAG nhiều hơn cả embedding model.** Đừng tiết kiệm thời gian ở bước này.
- **Dedup chunk** trước khi insert (hash MD5 của chunk_text) để tránh duplicate khi ingest lại.

### 8.2. Pipeline

```
Loader → Cleaner → Splitter → Embedder → Inserter
```

### 8.3. Chunking strategy đề xuất

- **Splitter**: `RecursiveCharacterTextSplitter` từ `langchain-text-splitters`
- **chunk_size**: 800 ký tự (~ 200-300 tokens)
- **chunk_overlap**: 150 ký tự (overlap giúp ngữ nghĩa không bị cắt giữa câu)
- **separators**: `["\n\n", "\n", ". ", " ", ""]` — ưu tiên cắt ở ranh giới đoạn văn

### 8.4. Code mẫu (rút gọn)

```python
# embedder.py
import os, requests

OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "https://ollama.com")
OLLAMA_KEY = os.getenv("OLLAMA_API_KEY")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed nhiều text trong một request nếu API hỗ trợ batch.
    Nếu không, fallback sang loop."""
    headers = {"Authorization": f"Bearer {OLLAMA_KEY}"}
    out = []
    for t in texts:
        r = requests.post(
            f"{OLLAMA_BASE}/api/embeddings",
            headers=headers,
            json={"model": EMBED_MODEL, "input": t},
            timeout=30,
        )
        r.raise_for_status()
        out.append(r.json()["embedding"])
    return out
```

```python
# pipeline.py
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymilvus import MilvusClient
import time, hashlib

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " ", ""],
)

client = MilvusClient(uri=os.getenv("MILVUS_URI", "http://milvus-standalone:19530"))

def ingest_document(text: str, doc_title: str, source_url: str,
                    source_type: str = "web", page: int = 0):
    chunks = splitter.split_text(text)
    if not chunks:
        return 0

    # Dedup trong batch hiện tại
    seen = set()
    unique_chunks = []
    for c in chunks:
        h = hashlib.md5(c.encode("utf-8")).hexdigest()
        if h not in seen:
            seen.add(h)
            unique_chunks.append(c)

    embeddings = embed_batch(unique_chunks)
    rows = [
        {
            "chunk_text": c,
            "embedding": e,
            "source_url": source_url,
            "source_type": source_type,
            "page": page,
            "chunk_index": i,
            "doc_title": doc_title,
            "created_at": int(time.time()),
        }
        for i, (c, e) in enumerate(zip(unique_chunks, embeddings))
    ]
    client.insert(collection_name="company_kb", data=rows)
    return len(rows)
```

### 8.5. Crawler đơn giản (gợi ý)

Cho demo, bạn không cần Scrapy. Dùng `requests + trafilatura`:

```python
import requests, trafilatura
from src.pipeline import ingest_document

def crawl_url(url: str):
    html = requests.get(url, timeout=20).text
    text = trafilatura.extract(html)  # tự động bỏ menu/footer/quảng cáo
    if text:
        title = trafilatura.extract_metadata(html).title or url
        ingest_document(text, doc_title=title, source_url=url, source_type="web")
```

---

## 9. Thiết kế prompt template cho RAG

### 9.1. System prompt

```
Bạn là trợ lý AI của công ty {COMPANY_NAME}. Nhiệm vụ của bạn là trả lời
câu hỏi của khách hàng CHỈ DỰA VÀO phần CONTEXT được cung cấp bên dưới.

QUY TẮC BẮT BUỘC:
1. Nếu CONTEXT không chứa thông tin để trả lời câu hỏi, hãy nói chính xác:
   "Tôi không tìm thấy thông tin này trong tài liệu của công ty."
2. KHÔNG được dùng kiến thức bên ngoài CONTEXT, kể cả khi bạn biết câu trả lời.
3. KHÔNG được suy đoán, bịa đặt, hoặc bổ sung thông tin không có trong CONTEXT.
4. Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm.
5. Nếu CONTEXT có thông tin trái ngược nhau, hãy nêu cả hai và chỉ ra sự khác biệt.
6. KHÔNG nhắc lại từ "CONTEXT" trong câu trả lời. Trả lời tự nhiên như nhân viên CSKH.
```

### 9.2. User prompt template

```
CONTEXT:
---
[1] (Nguồn: {source_1_title} - trang {page_1})
{chunk_1_text}

[2] (Nguồn: {source_2_title} - trang {page_2})
{chunk_2_text}

[3] (Nguồn: {source_3_title})
{chunk_3_text}
---

CÂU HỎI: {user_question}

TRẢ LỜI:
```

### 9.3. Java implementation

```java
@Component
public class PromptBuilder {

    private static final String SYSTEM = """
        Bạn là trợ lý AI của công ty %s. Chỉ trả lời dựa vào CONTEXT.
        Nếu CONTEXT không có thông tin, nói: "Tôi không tìm thấy thông tin
        này trong tài liệu của công ty." KHÔNG bịa, KHÔNG dùng kiến thức ngoài.
        """;

    @Value("${rag.company-name}")
    private String companyName;

    @Value("${rag.max-context-chars}")
    private int maxContextChars;

    public String build(String question, List<RetrievedChunk> chunks) {
        StringBuilder ctx = new StringBuilder();
        int used = 0;
        int idx = 1;
        for (var c : chunks) {
            String block = String.format("[%d] (Nguồn: %s - trang %d)%n%s%n%n",
                idx++, c.docTitle(), c.page(), c.text());
            if (used + block.length() > maxContextChars) break;
            ctx.append(block);
            used += block.length();
        }

        return String.format(SYSTEM, companyName)
            + "\n\nCONTEXT:\n---\n" + ctx
            + "---\n\nCÂU HỎI: " + question + "\n\nTRẢ LỜI:";
    }
}
```

---

## 10. Ví dụ request/response API

### Request

```http
POST /api/chat HTTP/1.1
Content-Type: application/json

{
  "question": "Công ty có chính sách đổi trả hàng trong bao nhiêu ngày?",
  "topK": 5
}
```

### Response (grounded)

```json
{
  "answer": "Công ty cho phép đổi trả hàng trong vòng 30 ngày kể từ ngày nhận hàng, với điều kiện sản phẩm còn nguyên tem mác và chưa qua sử dụng.",
  "sources": [
    {
      "docTitle": "Chính sách đổi trả 2024",
      "sourceUrl": "https://example.com/policy/return",
      "page": 0,
      "score": 0.82,
      "snippet": "Khách hàng có thể đổi trả sản phẩm trong vòng 30 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem mác..."
    },
    {
      "docTitle": "FAQ Khách hàng",
      "sourceUrl": "https://example.com/faq",
      "page": 0,
      "score": 0.74,
      "snippet": "Q: Tôi có thể đổi trả hàng không? A: Có, trong 30 ngày..."
    }
  ],
  "grounded": true,
  "latencyMs": 1245
}
```

### Response (out-of-scope)

```json
{
  "answer": "Tôi không tìm thấy thông tin này trong tài liệu của doanh nghiệp.",
  "sources": [],
  "grounded": false,
  "latencyMs": 320
}
```

---

## 11. Ví dụ `docker-compose.yml`

```yaml
version: "3.8"

services:
  etcd:
    container_name: rag-etcd
    image: quay.io/coreos/etcd:v3.5.5
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
      - ETCD_SNAPSHOT_COUNT=50000
    volumes:
      - ./volumes/etcd:/etcd
    command: >
      etcd -advertise-client-urls=http://127.0.0.1:2379
           -listen-client-urls http://0.0.0.0:2379
           --data-dir /etcd
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 30s
      timeout: 20s
      retries: 3

  minio:
    container_name: rag-minio
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    ports:
      - "9001:9001"
      - "9000:9000"
    volumes:
      - ./volumes/minio:/minio_data
    command: minio server /minio_data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  milvus-standalone:
    container_name: rag-milvus
    image: milvusdb/milvus:v2.4.10
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - ./volumes/milvus:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      - "etcd"
      - "minio"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/healthz"]
      interval: 30s
      timeout: 20s
      retries: 3

  attu:
    container_name: rag-attu
    image: zilliz/attu:v2.4
    environment:
      MILVUS_URL: milvus-standalone:19530
    ports:
      - "3001:3000"
    depends_on:
      - milvus-standalone

  ingestion:
    container_name: rag-ingestion
    build: ./ingestion
    environment:
      MILVUS_URI: http://milvus-standalone:19530
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}
      OLLAMA_API_KEY: ${OLLAMA_API_KEY}
      OLLAMA_EMBED_MODEL: ${OLLAMA_EMBED_MODEL}
    volumes:
      - ./ingestion/data:/app/data
    depends_on:
      milvus-standalone:
        condition: service_healthy
    # Service này chạy on-demand, không cần restart:
    # docker compose run --rm ingestion python -m src.main ingest

  backend:
    container_name: rag-backend
    build: ./backend
    environment:
      MILVUS_HOST: milvus-standalone
      MILVUS_PORT: 19530
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}
      OLLAMA_API_KEY: ${OLLAMA_API_KEY}
      OLLAMA_CHAT_MODEL: ${OLLAMA_CHAT_MODEL}
      OLLAMA_EMBED_MODEL: ${OLLAMA_EMBED_MODEL}
    ports:
      - "8080:8080"
    depends_on:
      milvus-standalone:
        condition: service_healthy

  frontend:
    container_name: rag-frontend
    build: ./frontend
    environment:
      VITE_API_BASE: http://localhost:8080
    ports:
      - "3000:3000"
    depends_on:
      - backend

networks:
  default:
    name: rag-net
```

`.env`:
```
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=sk-xxxxxxxxxxxx
OLLAMA_CHAT_MODEL=gpt-oss:20b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

## 12. Package/library cần dùng

### Java (pom.xml)

```xml
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Milvus Java SDK -->
    <dependency>
        <groupId>io.milvus</groupId>
        <artifactId>milvus-sdk-java</artifactId>
        <version>2.4.4</version>
    </dependency>

    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>

    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

> Có thể thay thế bằng `spring-ai-ollama-spring-boot-starter` nếu muốn abstraction cao hơn, nhưng `RestClient` thuần đơn giản và đủ dùng cho demo.

### Python (`requirements.txt`)

```
pymilvus==2.4.6
requests==2.32.3
trafilatura==1.12.2
pypdf==5.0.1
beautifulsoup4==4.12.3
langchain-text-splitters==0.3.0
pydantic==2.9.2
pydantic-settings==2.5.2
python-dotenv==1.0.1
tqdm==4.66.5
```

### React (`package.json`)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7",
    "react-markdown": "^9.0.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

---

## 13. Checklist MVP trong 1–2 ngày

**Ngày 1 — Foundation (8h)**
- [ ] Khởi tạo repo + cấu trúc thư mục
- [ ] `docker-compose up` cho etcd + minio + milvus + attu, vào được Attu
- [ ] Curl thành công endpoint embedding + chat của Ollama Cloud, ghi nhận dim của vector
- [ ] Tạo collection `company_kb` với schema đúng dim
- [ ] Thu thập 5-10 tài liệu doanh nghiệp (URL + 1-2 PDF)
- [ ] Pipeline ingestion chạy end-to-end, có row trong Attu
- [ ] Test query Python → top-3 ra kết quả relevant

**Ngày 2 — Application (8h)**
- [ ] Spring Boot project khởi tạo
- [ ] EmbeddingService + RetrievalService + LlmService + RagOrchestrator
- [ ] Endpoint `/api/chat` trả về JSON đúng format
- [ ] Guardrail threshold check hoạt động
- [ ] React UI: input + send + render answer + render sources
- [ ] Dockerize backend + frontend
- [ ] `docker compose up --build` chạy toàn bộ trong 1 lệnh
- [ ] README + 5 câu hỏi mẫu để demo

**Definition of Done**:
1. Hỏi câu in-scope → ra answer có nguồn, score hợp lý.
2. Hỏi câu out-of-scope ("thời tiết hôm nay?") → trả lời "không tìm thấy".
3. Hỏi câu tricky (paraphrase câu in FAQ) → vẫn ra đúng nguồn.
4. Toàn bộ chạy bằng `docker compose up`.

---

## 14. Rủi ro kỹ thuật và cách xử lý

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| **Ollama Cloud không expose embedding API** hoặc API khác local | Cao | Verify ngay bước 2. Fallback: chạy `nomic-embed-text` local (thêm container `ollama` vào compose) |
| **Mismatch dim giữa schema Milvus và model embedding** | Cao | Hardcode `EMBED_DIM` trong 1 file `config.py`, dùng cho cả tạo collection và embed |
| **Chunking cắt giữa câu/bảng làm mất ngữ nghĩa** | Cao | Dùng `RecursiveCharacterTextSplitter` với separators ưu tiên; với PDF nhiều bảng dùng `unstructured` hoặc `pdfplumber` |
| **Score threshold quá cao → fallback liên tục** | Trung bình | Bắt đầu với 0.55, tinh chỉnh theo dataset thực. Log score của mọi query trong demo để dễ debug |
| **Latency cao do gọi Ollama Cloud xa** | Trung bình | Đo từng bước (embed, search, LLM). Nếu LLM chậm, dùng streaming response |
| **Hallucination dù có context** | Trung bình | Prompt template ép buộc + temperature thấp (0.1-0.2) + thêm quy tắc "trích dẫn số nguồn [1][2]" |
| **Milvus không persist data sau `docker compose down`** | Thấp | Mount volume `./volumes/milvus` đúng (đã có trong compose mẫu) |
| **CORS lỗi giữa React và Spring Boot** | Thấp | Cấu hình `WebMvcConfigurer.addCorsMappings` cho `localhost:3000` |
| **Tài liệu tiếng Việt embedding kém** | Cao | Test với `bge-m3` (đa ngôn ngữ tốt) hoặc `multilingual-e5-large` thay vì `nomic-embed-text` |
| **Inject API key vào frontend** | An ninh | KHÔNG bao giờ. Mọi lời gọi Ollama đi qua backend |
| **Re-ingest tạo duplicate** | Thấp | Hash MD5 chunk_text + check trong Milvus trước insert, hoặc xoá-ghi lại theo `source_url` |

---

## 15. Gợi ý nâng cấp sau demo

**Chất lượng RAG**
- **Hybrid search**: kết hợp BM25 (full-text) với vector search → Milvus 2.4+ hỗ trợ native (`SPARSE_FLOAT_VECTOR`).
- **Reranker**: thêm cross-encoder reranker (ví dụ `bge-reranker-v2-m3`) sau khi lấy top-20, rerank xuống top-5.
- **Query rewriting**: LLM viết lại câu hỏi mơ hồ thành nhiều biến thể trước khi search.
- **Parent-child chunking**: embed chunk nhỏ, nhưng đưa vào prompt parent chunk lớn hơn → context rich hơn.

**Production readiness**
- **Conversational memory**: lưu lịch sử chat theo `sessionId` (Redis), kèm summary để không vượt context window.
- **Streaming response**: SSE từ backend ra React, UX tốt hơn nhiều.
- **Observability**: integrate Langfuse hoặc OpenTelemetry để trace từng bước RAG.
- **Eval**: bộ test 30-50 câu hỏi-đáp chuẩn, chạy hồi quy mỗi lần đổi prompt/model.
- **Rate limiting + auth**: API key cho frontend, rate limit theo IP.

**Scale**
- Chuyển Milvus standalone → Milvus distributed khi data > 10M vectors.
- Tách ingestion thành job định kỳ (Airflow / cron + queue) khi nguồn data nhiều.
- CDN cho frontend, ALB cho backend.

**UX**
- Suggested questions ở UI khi user mới vào.
- Click vào source → preview chunk + link đến trang gốc.
- Feedback button (👍/👎) lưu lại để retrain hoặc cải thiện prompt.

---

## Tóm tắt một dòng

> Python ingest → Milvus lưu vector → Spring Boot orchestrate retrieval + LLM → React hiển thị, tất cả đóng gói trong một `docker compose up`. Guardrail bằng score threshold + system prompt nghiêm ngặt. Chunking và prompt template là hai thứ quyết định 80% chất lượng demo.
