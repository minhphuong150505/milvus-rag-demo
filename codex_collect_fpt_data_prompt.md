# Prompt cho Codex: Thu thập dữ liệu FPT cho RAG demo

```text
Bạn là một coding agent đang làm việc trực tiếp trong project hiện tại của tôi.

Tôi đã cấu hình MCP browser cho bạn. Hãy sử dụng browser để tự động tìm kiếm, mở các trang web chính thức, tải/crawl nội dung công khai về FPT Corporation, sau đó lưu toàn bộ dữ liệu vào thư mục `data/` của project.

## Mục tiêu

Thu thập dữ liệu mẫu về FPT Corporation để dùng cho demo RAG chatbot.

Chatbot sau này sẽ chỉ trả lời dựa trên dữ liệu đã lưu trong thư mục `data/`, vì vậy dữ liệu cần có nguồn rõ ràng, dễ ingest, và ưu tiên nguồn chính thức.

## Nguồn ưu tiên

Hãy ưu tiên các nguồn chính thức sau:

1. Trang chủ FPT tiếng Việt:
   - https://fpt.com/vi

2. Trang chủ FPT tiếng Anh:
   - https://fpt.com/en

3. Trang giới thiệu FPT:
   - https://fpt.com/en/about-us

4. Trang Quan hệ nhà đầu tư:
   - https://fpt.com/en/ir

5. Trang báo cáo:
   - https://fpt.com/en/ir/report

6. Trang công bố thông tin:
   - https://fpt.com/en/ir/information-disclosures

7. Báo cáo thường niên FPT 2024 tiếng Việt:
   - https://fpt.com/-/media/project/fpt-corporation/fpt/ir/information-disclosures/year-report/2025/april/20250402---fpt---bao-cao-thuong-nien-nam-2024.pdf

8. Báo cáo thường niên FPT 2024 tiếng Anh:
   - https://fpt.com/-/media/project/fpt-corporation/fpt/ir/information-disclosures/year-report/2025/april/20250402---fpt---annual-report-2024.pdf

9. FPT Telecom:
   - https://fpt.vn/

10. FPT Software:
   - https://fptsoftware.com/

11. FPT Software Services & Industries:
   - https://fptsoftware.com/services-and-industries

## Việc cần làm

1. Tạo thư mục `data/` nếu chưa tồn tại.

2. Bên trong `data/`, tạo cấu trúc thư mục sau:

   ```text
   data/
   ├── raw/
   │   ├── html/
   │   ├── pdf/
   │   └── metadata/
   ├── processed/
   └── sources.json
   ```

3. Dùng MCP browser để truy cập các URL trên.

4. Với các trang HTML:
   - Lưu nội dung HTML hoặc text đã trích xuất vào `data/raw/html/`.
   - Tên file nên rõ ràng, ví dụ:
     - `fpt_home_vi.html` hoặc `fpt_home_vi.txt`
     - `fpt_about_us_en.html` hoặc `fpt_about_us_en.txt`
     - `fpt_ir_report.html` hoặc `fpt_ir_report.txt`
   - Ưu tiên lưu text sạch nếu có thể, nhưng vẫn giữ đủ nội dung chính.
   - Loại bỏ nội dung rác nếu dễ làm: navigation lặp lại, footer quá dài, script, style.

5. Với các file PDF:
   - Tải file PDF về `data/raw/pdf/`.
   - Giữ tên file rõ ràng:
     - `fpt_annual_report_2024_vi.pdf`
     - `fpt_annual_report_2024_en.pdf`
   - Nếu có thể, trích xuất text từ PDF và lưu bản `.txt` tương ứng vào `data/processed/`.

6. Tạo file `data/sources.json` ghi lại metadata của tất cả nguồn đã tải/crawl.

   Mỗi item nên có format:

   ```json
   {
     "id": "fpt_about_us_en",
     "title": "FPT About Us",
     "url": "https://fpt.com/en/about-us",
     "type": "html",
     "language": "en",
     "raw_path": "data/raw/html/fpt_about_us_en.txt",
     "processed_path": "data/processed/fpt_about_us_en.txt",
     "fetched_at": "ISO-8601 timestamp",
     "status": "success"
   }
   ```

   Nếu nguồn tải thất bại, vẫn ghi vào `sources.json` với:

   ```json
   {
     "id": "fpt_annual_report_2024_en",
     "url": "...",
     "status": "failed",
     "error": "mô tả lỗi ngắn gọn"
   }
   ```

7. Tạo thêm file `data/README.md` mô tả:
   - Dataset này dùng cho mục đích gì.
   - Các nguồn đã thu thập.
   - Cách dữ liệu được tổ chức.
   - Ghi chú rằng dữ liệu thuộc nguồn công khai và cần kiểm tra điều khoản sử dụng nếu dùng ngoài demo.

8. Sau khi hoàn tất, hãy in ra summary:
   - Số nguồn thành công.
   - Số nguồn thất bại.
   - Danh sách file đã tạo.
   - Các lỗi nếu có.
   - Gợi ý bước tiếp theo để ingest dữ liệu vào Milvus.

## Ràng buộc quan trọng

- Chỉ thu thập dữ liệu công khai.
- Ưu tiên nguồn chính thức của FPT.
- Không thu thập dữ liệu cá nhân không cần thiết.
- Không hardcode API key.
- Không sửa các phần khác của project nếu không cần.
- Không tạo backend/frontend ở bước này.
- Chỉ tập trung vào việc thu thập và lưu dữ liệu vào `data/`.

## Kết quả mong muốn

Sau khi chạy xong, project của tôi phải có thư mục:

```text
data/
├── raw/
│   ├── html/
│   ├── pdf/
│   └── metadata/
├── processed/
├── sources.json
└── README.md
```

Và dữ liệu trong đó phải sẵn sàng để dùng cho pipeline RAG ingestion tiếp theo.
```
