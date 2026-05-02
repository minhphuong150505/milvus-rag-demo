# Milvus trong RAG Chatbot — Tài liệu seminar

> **Mục đích tài liệu**: Giải thích Milvus là gì, tại sao nó tiện, và đặc biệt là **nó hoạt động cụ thể như thế nào trong dự án RAG chatbot doanh nghiệp** mà chúng ta đang demo.
> **Đối tượng**: Người nghe seminar — biết cơ bản về cơ sở dữ liệu, có thể chưa quen với vector database.

---

## Phần 1 — Vector Database là gì và tại sao cần?

### 1.1. Vấn đề: cơ sở dữ liệu truyền thống không hiểu ngữ nghĩa

Giả sử bạn có 1000 đoạn văn bản về một công ty. Một khách hàng hỏi:

> "Công ty cho đổi hàng trong mấy ngày?"

Trong tài liệu chính sách lại viết:

> "Khách hàng được hoàn trả sản phẩm trong vòng 30 ngày..."

Một câu lệnh SQL `WHERE content LIKE '%đổi hàng%'` sẽ **không tìm thấy gì cả**, vì tài liệu dùng từ "hoàn trả" chứ không phải "đổi hàng". Elasticsearch full-text search có khá hơn nhưng vẫn vật lộn với:

- Đồng nghĩa (đổi hàng / hoàn trả / đổi trả)
- Ngữ cảnh ("Apple" công ty hay quả táo?)
- Đa ngôn ngữ
- Câu hỏi paraphrase

### 1.2. Giải pháp: embedding + similarity search

**Bước 1 — Biến text thành vector (embedding)**

Một mô hình embedding (ví dụ `nomic-embed-text`, `bge-m3`) sẽ biến mỗi đoạn văn thành một vector số thực trong không gian nhiều chiều (768, 1024, 1536 chiều...).

```
"Khách hàng được hoàn trả sản phẩm trong 30 ngày" → [0.12, -0.45, 0.78, ..., 0.03]  (768 số)
"Công ty cho đổi hàng trong mấy ngày?"            → [0.14, -0.41, 0.81, ..., 0.05]  (768 số)
"Hôm nay trời mưa to ở Hà Nội"                    → [-0.88, 0.23, -0.15, ..., 0.67] (768 số)
```

Hai câu đầu tuy khác từ ngữ nhưng **cùng ý nghĩa**, nên hai vector của chúng **rất gần nhau** trong không gian 768 chiều. Câu thứ ba khác nghĩa hoàn toàn → vector ở rất xa.

**Bước 2 — Tìm kiếm bằng khoảng cách**

Khi user hỏi, ta embed câu hỏi rồi tìm những vector "gần" nhất trong kho. "Gần" được đo bằng **cosine similarity**, **L2 distance**, hoặc **inner product**.

### 1.3. Tại sao cần một database chuyên dụng?

Bạn có thể nghĩ: "lưu vector vào PostgreSQL hoặc trong RAM Python rồi tự tính khoảng cách thì sao?". Vấn đề là:

- **10.000 vector** → tự tính trong RAM bằng numpy: OK, vài chục ms.
- **1 triệu vector** → tự tính: chậm vài giây, RAM phình.
- **100 triệu vector** → không khả thi nếu không có cấu trúc index chuyên dụng.

**Vector database = engine** chuyên cho:

1. **ANN index** (Approximate Nearest Neighbor) — tìm gần đúng nhưng nhanh gấp hàng trăm lần so với brute force.
2. **Filter theo metadata** — "tìm chunk gần nhất NHƯNG chỉ trong các tài liệu có `source_type = 'pdf'`".
3. **Persistence + scale** — không mất data khi restart, scale ra nhiều node.
4. **CRUD API** chuẩn để insert/update/delete vector.

Đó là lý do Milvus, Pinecone, Weaviate, Qdrant tồn tại.

---

## Phần 2 — Milvus là gì và sự tiện lợi của nó

### 2.1. Milvus một dòng

> Milvus là một **vector database mã nguồn mở**, viết bằng Go, do Zilliz phát triển, được CNCF chứng nhận, thiết kế cho **billion-scale similarity search** với hỗ trợ filter metadata.

### 2.2. Những điểm "tiện" của Milvus mà tôi muốn nhấn mạnh trong seminar

#### Tiện 1: Mã nguồn mở, tự host được, không phụ thuộc vendor

- Pinecone là SaaS — bạn không thể self-host, không thể chạy on-premise nếu doanh nghiệp yêu cầu.
- Milvus chạy được từ **một con laptop với Docker** đến **cluster Kubernetes nhiều trăm node**.
- Cùng một SDK, cùng một API, không phải code lại khi scale.

#### Tiện 2: Standalone mode — demo trong 5 phút

Ba container là đủ để có một vector DB hoàn chỉnh: `etcd` + `minio` + `milvus`. Lệnh `docker compose up` là xong. Demo của chúng ta dùng đúng kiểu này.

#### Tiện 3: Hỗ trợ rất nhiều index type

Không phải lúc nào HNSW cũng tốt nhất. Milvus cho bạn chọn:

| Index | Dùng khi | Đặc điểm |
|---|---|---|
| `FLAT` | Dataset rất nhỏ (< 100K), cần chính xác 100% | Brute force, slow nhưng exact |
| `IVF_FLAT` | 100K - 10M vectors | Cluster + brute force trong cluster, balance tốt |
| `IVF_PQ` | 10M+ vectors, RAM hạn chế | Compress vector, mất chút accuracy |
| `HNSW` | < 10M vectors, ưu tiên recall | Graph-based, nhanh và chính xác cao, tốn RAM |
| `DISKANN` | Dataset cực lớn không vừa RAM | Lưu graph trên SSD |
| `SPARSE_INVERTED_INDEX` | Sparse vector (BM25-like) | Cho hybrid search |

Demo của chúng ta dùng **HNSW** vì dataset doanh nghiệp thường nhỏ (vài nghìn chunks), HNSW cho recall cao nhất.

#### Tiện 4: Hỗ trợ filter metadata trong cùng một query

Đây là tính năng quan trọng cho RAG. Ví dụ thực tế:

```python
# "Tìm 5 chunk gần nhất với câu hỏi, NHƯNG chỉ trong tài liệu PDF mới hơn 30 ngày"
client.search(
    collection_name="company_kb",
    data=[query_vector],
    limit=5,
    filter='source_type == "pdf" and created_at > 1735000000',
    output_fields=["chunk_text", "source_url"],
)
```

Pinecone có hỗ trợ tương tự, nhưng cú pháp Milvus rất giống SQL nên dễ học.

#### Tiện 5: Hybrid Search native (Milvus 2.4+)

Bạn có thể lưu cả `dense vector` (embedding) và `sparse vector` (BM25-like) trong cùng một collection và search kết hợp với reranking strategy như RRF. Đây là kỹ thuật state-of-the-art cho RAG hiện nay — rất nhiều vector DB khác chưa hỗ trợ tốt.

#### Tiện 6: Attu — GUI quản trị miễn phí

`zilliz/attu` là một image Docker, mở port 3000, bạn có giao diện web để:

- Xem collection nào đang tồn tại
- Browse data, xem chunk text
- Chạy thử query và xem kết quả
- Theo dõi metric (memory, query rate)

Trong seminar, mình sẽ demo Attu vì nó **trực quan hơn nhiều so với gõ pymilvus trong terminal**.

#### Tiện 7: SDK đa ngôn ngữ với API thống nhất

Cùng một logic, viết được trong:
- Python (`pymilvus`)
- Java (`milvus-sdk-java`) — đây là lý do Spring Boot kết nối được
- Go, Node.js, C#, REST API

Demo của chúng ta dùng **cả Python và Java cùng kết nối tới một Milvus**, không hề có vấn đề tương thích.

#### Tiện 8: Performance — SOTA cho open-source

Theo `vector-db-benchmark` của Qdrant team và benchmark độc lập, Milvus với index HNSW đạt latency p99 < 10ms cho dataset 1M vectors trên một con server vừa. Demo nhỏ của bạn, latency của Milvus sẽ **dưới 5ms** — coi như free.

#### Tiện 9: TTL (Time-To-Live) cho data

Bạn có thể set TTL ở mức collection — Milvus tự xóa vector cũ. Hữu ích khi tài liệu doanh nghiệp được cập nhật định kỳ.

#### Tiện 10: Cộng đồng và tài liệu

GitHub > 30K stars, Discord/Slack active, blog Zilliz đăng tutorial liên tục. Khi gặp lỗi, gần như Google ra ngay.

---

## Phần 3 — Kiến trúc Milvus (giải thích cho seminar)

### 3.1. Milvus standalone (cái mà demo của chúng ta dùng)

```
┌──────────────────────────────────────────────────────────────┐
│                    MILVUS STANDALONE                          │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Milvus Process (Go)                     │   │
│   │  - Proxy: nhận request gRPC                          │   │
│   │  - QueryNode: tìm kiếm                               │   │
│   │  - DataNode: ghi data                                │   │
│   │  - IndexNode: build index                            │   │
│   │  Tất cả gộp trong 1 process                          │   │
│   └─────────────────┬─────────────┬─────────────────────┘   │
│                     │             │                          │
│            metadata │             │ vector files             │
│                     ▼             ▼                          │
│            ┌───────────┐    ┌───────────┐                    │
│            │   etcd    │    │   minio   │                    │
│            │ (stateful)│    │ (S3-like) │                    │
│            └───────────┘    └───────────┘                    │
└──────────────────────────────────────────────────────────────┘
                     ▲
                     │ gRPC port 19530
                     │
                ┌────┴────┐
                │ Clients │ (Python, Java, REST...)
                └─────────┘
```

**Tại sao cần etcd?** Để lưu **metadata về collection, schema, index** một cách bền vững và đồng bộ. etcd là cùng dòng với Kubernetes — đảm bảo strong consistency.

**Tại sao cần MinIO?** Để lưu **vector data thực tế** trên dạng file (segments). MinIO là S3-compatible. Khi Milvus restart, nó load lại các file này từ MinIO. Trên cloud production thường thay MinIO bằng AWS S3 / GCS.

### 3.2. Milvus distributed (production)

Trong cluster mode, mỗi component (Proxy, QueryNode, DataNode, IndexNode...) chạy riêng và scale độc lập. Bạn có thể có 10 QueryNodes để tăng QPS, 5 DataNodes để tăng ingestion throughput. **Demo của chúng ta không cần cái này** nhưng tốt là biết để biết Milvus scale được tới đâu.

### 3.3. Khái niệm trong Milvus

| Khái niệm | Tương đương SQL | Ghi chú |
|---|---|---|
| **Database** | Database | Container chứa nhiều collection |
| **Collection** | Table | Trong demo: `company_kb` |
| **Schema** | Table schema | Định nghĩa các field, type, dim |
| **Field** | Column | Có scalar field và vector field |
| **Entity** | Row | Một chunk với vector + metadata |
| **Partition** | Partition | Chia collection theo logic, ví dụ theo ngày |
| **Segment** | (Internal) | File data thực tế trên MinIO |
| **Index** | Index | HNSW, IVF_FLAT... build trên vector field |

---

## Phần 4 — Milvus hoạt động cụ thể trong demo của chúng ta

### 4.1. Bức tranh tổng thể

```
                 ┌──────────────────────────────────────┐
                 │           Milvus standalone          │
                 │     Collection: company_kb           │
                 │                                       │
                 │   ┌──────────────────────────────┐   │
                 │   │ Chunks (1000-5000 entities)  │   │
                 │   │                              │   │
                 │   │ id | text | vec[768] | meta  │   │
                 │   │  1 | "..." | [..]    | {..}  │   │
                 │   │  2 | "..." | [..]    | {..}  │   │
                 │   │  3 | "..." | [..]    | {..}  │   │
                 │   │ ... + HNSW index trên vec    │   │
                 │   └──────────────────────────────┘   │
                 └──────┬──────────────────────┬────────┘
                        │ (1) ghi              │ (2) đọc
                        │                      │
              ┌─────────┴─────┐      ┌─────────┴───────┐
              │  Python       │      │  Spring Boot    │
              │  Ingestion    │      │  Backend        │
              │  pymilvus     │      │  milvus-sdk     │
              └───────────────┘      └─────────────────┘
                  (offline)              (mỗi câu hỏi)
```

**Demo dùng Milvus theo 2 chiều:**

- **Chiều ghi (1)**: Python ingestion service ghi chunks vào collection. Chạy 1 lần lúc setup, hoặc chạy lại khi có tài liệu mới.
- **Chiều đọc (2)**: Spring Boot backend search collection mỗi khi user gửi câu hỏi.

Hai service này **không biết về nhau**. Chúng chỉ biết tới Milvus. Đó là vẻ đẹp của thiết kế — Milvus là **shared state**.

### 4.2. Flow chi tiết: ingestion ghi vào Milvus

```
┌───────────────────┐
│ Tài liệu doanh    │
│ nghiệp (web/PDF)  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Parse text:       │
│ "Chính sách đổi   │
│  trả: Khách hàng  │
│  được đổi trong   │
│  30 ngày..."      │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Chunk thành các   │
│ đoạn ~800 ký tự   │
│ chunk_1, chunk_2  │
│ chunk_3...        │
└────────┬──────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Gọi Ollama Cloud /api/embeddings   │
│ Mỗi chunk → vector 768 chiều       │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ pymilvus client.insert(            │
│   collection_name="company_kb",     │
│   data=[                            │
│     {chunk_text, embedding,         │
│      source_url, page,...},        │
│     ...                             │
│   ]                                 │
│ )                                   │
│                                     │
│ Milvus:                            │
│  1. Validate schema                │
│  2. Ghi entity vào segment buffer  │
│  3. Khi buffer đầy → flush ra MinIO│
│  4. Trigger build index trên vec   │
└─────────────────────────────────────┘
```

**Code ngắn (đã rút gọn từ pipeline thật):**

```python
from pymilvus import MilvusClient

client = MilvusClient(uri="http://milvus-standalone:19530")

client.insert(
    collection_name="company_kb",
    data=[
        {
            "chunk_text": "Khách hàng được hoàn trả sản phẩm trong vòng 30 ngày...",
            "embedding": [0.12, -0.45, ...],  # 768 floats
            "source_url": "https://example.com/policy",
            "source_type": "web",
            "page": 0,
            "chunk_index": 5,
            "doc_title": "Chính sách đổi trả",
            "created_at": 1735000000,
        },
        # ... thêm chunks khác
    ],
)
```

Milvus trả về số ID đã insert. Sau khi chạy ingestion xong, vào Attu (`http://localhost:3001`) → collection `company_kb` → tab "Data" → thấy hết các chunk đã ghi.

### 4.3. Flow chi tiết: backend đọc từ Milvus

Đây là phần **chạy mỗi khi user gửi 1 câu hỏi** — vì vậy phải nhanh.

```
User hỏi: "Có được đổi hàng không?"
          │
          ▼
┌─────────────────────────────────────────┐
│ Spring Boot: EmbeddingService.embed()    │
│ POST Ollama Cloud → vector 768          │
│ qVec = [0.14, -0.41, 0.81, ...]         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ Spring Boot: RetrievalService.searchTopK()    │
│                                               │
│ milvus.search(SearchParam.builder()           │
│   .withCollectionName("company_kb")           │
│   .withMetricType(COSINE)                    │
│   .withTopK(5)                                │
│   .withVectors([qVec])                        │
│   .withVectorFieldName("embedding")           │
│   .withParams("{\"ef\": 64}")                 │
│   .withOutFields([                            │
│      "chunk_text","source_url","page",        │
│      "doc_title"                              │
│   ])                                          │
│   .build());                                  │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Bên trong Milvus:                              │
│                                                 │
│  1. HNSW graph traversal                       │
│     - Start node → tìm neighbor gần nhất       │
│     - Greedy walk theo cosine similarity       │
│     - Backtrack theo `ef` candidates           │
│                                                 │
│  2. Trả về top-5 entities với score            │
│     (cosine similarity, càng cao càng gần)     │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Kết quả:                                       │
│ [                                               │
│   {chunk_text:"Khách hàng được hoàn trả...",    │
│    score: 0.82, source_url:"...", page: 0},    │
│   {chunk_text:"FAQ: Đổi trả hàng?...",          │
│    score: 0.74, ...},                          │
│   {chunk_text:"Liên hệ CSKH để được hỗ trợ...", │
│    score: 0.58, ...},                          │
│   {chunk_text:"Bảo hành 12 tháng...",           │
│    score: 0.41, ...},  ← DƯỚI threshold        │
│   {chunk_text:"Giờ làm việc 8h-17h...",         │
│    score: 0.29, ...},  ← DƯỚI threshold        │
│ ]                                               │
└──────────────┬──────────────────────────────────┘
               │
               ▼
       Spring Boot lọc score >= 0.55
       → 3 chunks dùng làm context
       → build prompt → gọi Ollama chat
       → trả lời cho user kèm 3 sources
```

**Toàn bộ vòng search trong Milvus với HNSW + dataset vài nghìn chunks chỉ tốn vài ms.** Phần lớn latency của RAG nằm ở 2 lời gọi Ollama (embed + chat), không phải Milvus.

### 4.4. Tại sao kết quả top-1 lại đúng dù từ ngữ khác nhau?

Đây là điểm "magic" của embedding mà bạn nên giải thích trong seminar:

| Câu | Vector (đơn giản hóa) |
|---|---|
| "Có được đổi hàng không?" (query) | `[0.14, -0.41, 0.81, ...]` |
| "Khách hàng được hoàn trả sản phẩm..." | `[0.12, -0.45, 0.78, ...]` ← cosine 0.82 |
| "Bảo hành 12 tháng..." | `[0.05, 0.31, -0.22, ...]` ← cosine 0.41 |
| "Giờ làm việc 8h-17h..." | `[-0.66, 0.19, 0.04, ...]` ← cosine 0.29 |

Embedding model đã **học từ trước** rằng "đổi hàng" và "hoàn trả" cùng ngữ cảnh, nên hai vector của chúng nằm gần nhau trong không gian 768D. Milvus không hiểu ngôn ngữ — nó chỉ tính khoảng cách giữa các vector — nhưng vì input đã được encode tốt, kết quả search về mặt ngữ nghĩa lại rất chính xác.

---

## Phần 5 — Demo command list cho seminar

Khi present, đây là chuỗi lệnh tôi gợi ý để chứng minh tính tiện lợi của Milvus:

```bash
# 1. Khởi động Milvus standalone
docker compose up -d etcd minio milvus-standalone attu

# 2. Mở browser
open http://localhost:3001  # Attu

# 3. Tạo collection bằng pymilvus (live coding)
docker compose run --rm ingestion python -m src.main create-collection

# 4. Ingest 1 file PDF doanh nghiệp
docker compose run --rm ingestion python -m src.main ingest --path ./data/raw/policy.pdf

# 5. Quay lại Attu, F5 → thấy data mới

# 6. Test search trực tiếp trên Attu
#    → Vector Search tab → paste 1 query vector → top-K kết quả

# 7. Gọi từ Spring Boot
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Có được đổi hàng không?"}'

# 8. Show kết quả: answer + sources + score
```

Trong seminar, **show Attu chiếm 30% thời lượng phần Milvus** — vì đó là cái thuyết phục người xem nhất rằng "Milvus dễ dùng". Khi người ta thấy data, schema, index, search results trên một GUI clean, họ sẽ tin Milvus là production-ready.

---

## Phần 6 — So sánh Milvus với các vector DB khác (slide so sánh)

| Tiêu chí | Milvus | Pinecone | Weaviate | Qdrant | pgvector |
|---|---|---|---|---|---|
| Open-source | ✅ | ❌ (SaaS only) | ✅ | ✅ | ✅ |
| Self-host | ✅ | ❌ | ✅ | ✅ | ✅ |
| Java SDK chính chủ | ✅ | ✅ | ✅ | ✅ (community) | (qua JDBC) |
| Hybrid search native | ✅ (2.4+) | ✅ | ✅ | ✅ | Hạn chế |
| Index types | 9+ | ~3 | 2 | 2 | 2 |
| GUI miễn phí | ✅ Attu | ✅ Console | ❌ | ✅ Web UI | ❌ |
| Scale tới billion vectors | ✅ | ✅ | ✅ | ✅ | ❌ |
| Đường cong học | Trung bình | Dễ | Trung bình | Dễ | Rất dễ |
| Dễ cài đặt local | Dễ (docker) | N/A | Dễ | Rất dễ | Rất dễ |
| Phù hợp cho demo này | **Rất phù hợp** | Tốt nhưng tốn $$ | Tốt | Tốt | OK với data nhỏ |

**Lý do mình chọn Milvus cho dự án này:**
1. Open-source + self-host → demo trên laptop được, scale ra production cũng được, không bị khóa vendor.
2. SDK Java chính chủ → tích hợp Spring Boot mượt.
3. Attu cho seminar — giá trị visual rất cao.
4. Hybrid search native → mở đường nâng cấp sau demo.

---

## Phần 7 — Câu hỏi có thể hỏi/được hỏi trong seminar

**Q: "Sao không dùng PostgreSQL với pgvector cho gọn?"**
A: Với dataset < 100K chunks thì pgvector hoàn toàn đủ. Nhưng pgvector kém Milvus ở: index types (chỉ có HNSW và IVFFlat), không có hybrid search native, không có GUI quản trị riêng, và scale ra distributed thì khó. Milvus vừa đáp ứng demo, vừa không phải migrate khi scale.

**Q: "Milvus standalone có ổn cho production không?"**
A: Cho startup/SMB với data dưới vài chục triệu vectors và QPS dưới 1000 — hoàn toàn ổn. Khi vượt qua mức đó hoặc cần HA, chuyển sang Milvus distributed (cùng codebase, chỉ khác cách deploy).

**Q: "Tại sao cần etcd và MinIO, không gộp được à?"**
A: Tách stateful (etcd) và blob (MinIO) là design choice giống Kubernetes. Nó cho phép scale 2 phần độc lập, và trên cloud production có thể thay MinIO bằng S3, etcd bằng managed etcd. Cái phức tạp ban đầu này trả công bằng linh hoạt sau này.

**Q: "Embedding model đổi thì sao?"**
A: Bắt buộc **drop collection và ingest lại từ đầu**. Vector từ model A và model B sống ở 2 không gian khác nhau, không thể trộn. Đây là bài học quan trọng — đừng tiếc dataset cũ khi đổi model.

**Q: "Có thể search nhiều vector cùng lúc không?"**
A: Có, batch search. Milvus cho phép truyền `withVectors([v1, v2, v3])` và trả về top-K cho mỗi vector. Hữu ích khi rerank hoặc multi-query.

**Q: "Latency thực tế cho 1 query là bao nhiêu?"**
A: Riêng phần Milvus search: dưới 5ms cho dataset vài nghìn chunks với HNSW. Toàn bộ RAG pipeline (embed query + search + LLM): 1-3 giây, trong đó LLM chiếm 90%. Milvus không bao giờ là bottleneck.

---

## Tóm tắt một slide

> **Milvus tiện vì**: open-source, self-host được, standalone chạy 5 phút, SDK đa ngôn ngữ chia sẻ cùng một backend, hybrid search native, có GUI Attu miễn phí, 9+ loại index để chọn, và scale từ laptop đến cluster billion-scale với cùng API.
> **Trong demo của chúng ta**: Milvus là **shared state** giữa Python ingestion (ghi) và Spring Boot backend (đọc), dùng HNSW + cosine similarity trên vector 768D, trả về top-5 chunks trong vài mili-giây để Spring Boot ghép vào prompt và gọi Ollama Cloud sinh câu trả lời.
