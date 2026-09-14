# Kiểm chứng bản demo

Ngày chạy: 14/09/2026. Không commit. Ba file được bảo vệ giữ nguyên checksum trước/sau: `OllamaConfig.java`, `docker-compose.override.yml`, `fpt_faq_vi.txt`. Giữ nguyên cả trạng thái xóa sẵn có của `codex_collect_fpt_data_prompt.md`. Không sửa Python hoặc ghi lại dữ liệu collection.

## Thay đổi theo module

- Frontend: tách layout/drawer/sidebar/settings, theme/health hooks, giao diện chat/Markdown/nguồn, lưu hội thoại, SSE/fallback/abort; tokens CSS và font Việt tự host.
- Backend: history có giới hạn, SSE UTF-8, parse NDJSON, chuẩn lỗi/timeout, metadata nguồn đầy đủ và xếp lại ứng viên theo từ/cặp từ.
- Vận hành: Docker frontend dùng lockfile/public assets, Nginx streaming và timeout kết nối, build arg `VITE_API_BASE`, README/CLAUDE và bộ ảnh.
- Thư viện mới: `remark-gfm` để render bảng; `@fontsource/be-vietnam-pro` để đóng gói font offline; `@playwright/test` và `@axe-core/playwright` chỉ dùng kiểm thử. Bỏ Axios vì fetch hỗ trợ streaming/AbortController trực tiếp.

## Build và unit test

Các checkpoint layout, chat, nguồn và lịch sử đều chạy `npm run build` và `mvn test` thành công. Sau phần backend và kiểm tra cuối:

```text
Frontend: npm run build
✓ 1854 modules transformed.
✓ built in 1.97s

Frontend: npm test
tests 3
pass 3
fail 0

Backend: mvn test
Tests run: 25, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Build frontend không có warning. Maven có thông báo từ Byte Buddy/JDK 21 về dynamic agent loading khi chạy Mockito; không có test thất bại. Không chạy `python3 -m compileall src` vì không sửa Python trong ingestion.

- Orchestrator: tương thích request cũ, nguồn đầy đủ, không có/ít bằng chứng, LLM từ chối, history, thứ tự event, stream lỗi.
- Parser Ollama: Unicode bị chia từng byte, CRLF, final token, thinking, error, EOF thiếu done, JSON sai, frame quá lớn và client disconnect.
- Controller: JSON contract, validation, lỗi không lộ thông tin upstream, SSE và lỗi giữa stream.
- Reranker: FAQ doanh thu được ưu tiên hơn đoạn báo cáo chung, giữ score gốc, chuẩn hóa dấu/chữ hoa và giới hạn Top K.
- Parser frontend: UTF-8/SSE bị chia theo byte, nhiều frame một lần đọc, data nhiều dòng, JSON sai và hủy reader.

## Trình duyệt thật với API mock

Chromium headless, Playwright; API mock là HTTP server thực trả SSE theo từng đợt token. Mock và dữ liệu kiểm thử không nằm trong production bundle.

```text
npm run test:e2e
14 passed (33.0s)
```

Các luồng đã kiểm tra:

1. Streaming → bảng Markdown → chip nguồn → copy → hỏi nối tiếp có history → hỏi lại câu cũ.
2. Câu hỏi FPT có nguồn; câu hỏi “Thời tiết Hà Nội hôm nay?” trả `grounded=false`; chọn câu cũ khôi phục đúng nguồn.
3. Lỗi kết nối giữ câu hỏi, thử lại không nhân đôi câu hỏi; dừng stream giữ phần đã nhận; stream mất `done` không tự fallback sau token đầu.
4. Endpoint streaming 404 tự chuyển sang JSON.
5. Tạo, đổi tên, chuyển hội thoại, giữ bản nháp, reload và xóa.
6. Theme hệ thống, lưu lựa chọn, Enter/Shift+Enter, Escape và trả focus sau đóng drawer.
7. Hội thoại 60 tin nhắn: đang đọc phía trên không bị kéo xuống khi token đến; nút xuống cuối hoạt động.
8. Health offline và localStorage chứa JSON lỗi.
9. 375 × 812, 768 × 1000, 1440 × 1000; cả light/dark; không cuộn ngang. Axe không phát hiện vi phạm các tag `wcag2a`, `wcag2aa`, `wcag21aa` ở màn hình chào/chat đã scan.

Ảnh nằm ở `docs/screenshots/`: `{375,768,1440}-{light,dark}-{welcome,chat}.png`, thêm `{375,768}-{light,dark}-sources.png`. Đã xem trực tiếp ảnh desktop chat, mobile chào và drawer nguồn. Kiểm tra tự động không thay thế audit accessibility thủ công đầy đủ bằng screen reader.

## Docker

Docker Desktop context không hoạt động; dùng Docker Engine ở context `default`. Lệnh Compose chuẩn đã thử nhưng build gặp lỗi DNS Maven Central trong container. Build và khởi động stack thành công với file **tạm** `/tmp/milvus-build-network.yml` có `build.network: host` cho frontend/backend, không sửa override của người dùng.

```bash
docker --context default compose -f docker-compose.yml \
  -f docker-compose.override.yml -f /tmp/milvus-build-network.yml up --build -d
```

Đã kiểm tra favicon HTTP 200, health API HTTP 200 với `Content-Type: application/json`, proxy Nginx và streaming. Biến build arg được kiểm chứng độc lập:

```text
docker build --build-arg VITE_API_BASE=https://api.example.test/v1 ...
VITE_API_BASE build argument: PASS
```

Image kiểm tra `milvus-frontend-api-check` có URL thử nghiệm trong bundle; image ứng dụng `milvus-frontend` vẫn dùng `/api`.

## Kiểm tra dữ liệu thật và giới hạn

Collection `company_kb` có 1.282 rows; FAQ đã được nạp, không ingest trùng và không drop collection. Ollama có `nomic-embed-text`.

Phát hiện trước khi xếp lại ứng viên: câu hỏi doanh thu truy xuất các đoạn báo cáo không chứa số cần tìm; FAQ đúng ở hạng 19. Một số câu hỏi tổng quan bị từ chối hoặc trả lời chưa đầy đủ. Đã thêm xếp lại từ khóa trên 64 ứng viên, giữ nguyên ngưỡng và score cosine; kiểm tra sau thay đổi đã trả đúng doanh thu 62.849 tỷ đồng, `grounded=true`, nguồn đầu tiên là `fpt_faq_vi`. Câu thời tiết trả `grounded=false`, không có nguồn cuối cùng. Ảnh `live-1440-light-chat.png` và `live-1440-light-weather.png` dùng API thật qua Nginx, Milvus và Ollama; các ảnh theo ma trận kích thước/theme ở trên dùng mock.

Kiểm tra cuối trên Chromium qua `http://localhost:3000` với API thật:

| Luồng | Kết quả |
|---|---|
| Doanh thu FPT 2024 | 62.849 tỷ VNĐ, `grounded=true`, 3.233 ms, FAQ là nguồn đầu |
| “Còn năm 2023?” | 52.618 tỷ VNĐ, `grounded=true`, 2.466 ms; history hoạt động |
| Thời tiết Hà Nội | `grounded=false`, 1.878 ms, không có nguồn cuối cùng |
| Dừng container backend thật | Health đỏ, lỗi inline, câu hỏi vẫn còn; backend được bật lại trong `finally` |
| Lỗi runtime trình duyệt | 0 |
| Sau khôi phục | `/api/health` qua Nginx trả `{"status":"ok"}` |

```text
LIVE BROWSER PASS: real Docker UI, Milvus/Ollama revenue, weather ungrounded, actual backend shutdown.
```

Ảnh API thật: [Doanh thu](screenshots/live-1440-light-chat.png), [Hỏi nối tiếp](screenshots/live-1440-light-history.png), [Ngoài phạm vi](screenshots/live-1440-light-weather.png), [Backend bị tắt](screenshots/live-1440-light-offline.png). Chi tiết response: [logs/live-api.json](logs/live-api.json). Các con số latency là quan sát trong lần chạy, không phải benchmark.

Lượt smoke đầu cho phần backend bị tắt đặt timeout assertion 5s, trùng timeout health nên chưa kịp thấy trạng thái offline. Đã tăng thời gian chờ bài test và đặt `proxy_connect_timeout 3s`; chạy lại toàn chuỗi thành công. SSE khai báo UTF-8 rõ ràng và đã kiểm tra bằng test controller.

Các giới hạn sản phẩm còn lại:

- Chưa có tài khoản, đồng bộ hoặc cơ sở dữ liệu lưu lịch sử phía server. localStorage phụ thuộc dung lượng/chính sách trình duyệt.
- `grounded` là tín hiệu dựa trên retrieval và câu từ chối, không phải chứng minh mọi phát biểu đều đúng. Cần bộ câu hỏi đánh giá chất lượng, đặc biệt với PDF bị trộn cột và câu hỏi tổng quan.
- Heuristic xếp lại từ khóa chỉ hoạt động trong tập 64 ứng viên. Chưa có reranker học máy hoặc query rewriting đầy đủ.
- Health chỉ kiểm tra backend liveness. Dừng hủy fetch ngay; upstream đóng khi lần ghi tiếp theo phát hiện mất kết nối hoặc tới timeout.
- Kiểm tra responsive dùng Chromium desktop viewport; chưa kiểm tra bàn phím ảo trên thiết bị iOS/Android thật hoặc Firefox/Safari.
