# FPT RAG Demo Dataset

Dataset này chứa dữ liệu công khai về FPT Corporation và một số đơn vị liên quan để dùng cho demo RAG chatbot.

## Cấu trúc

- `raw/html/`: HTML hoặc text raw từ các trang nguồn.
- `raw/pdf/`: PDF tải được hoặc được người dùng bổ sung thủ công từ nguồn chính thức.
- `raw/metadata/`: metadata từng nguồn.
- `processed/`: text đã trích xuất, sẵn sàng đưa vào ingestion.
- `sources.json`: danh sách nguồn, trạng thái thu thập và đường dẫn file.

## Nguồn đã thu thập

- SUCCESS - fpt_home_vi: https://fpt.com/vi
- SUCCESS - fpt_home_en: https://fpt.com/en
- SUCCESS - fpt_about_us_en: https://fpt.com/en/about-us
- SUCCESS - fpt_ir_en: https://fpt.com/en/ir
- SUCCESS - fpt_ir_report_en: https://fpt.com/en/ir/report
- SUCCESS - fpt_information_disclosures_en: https://fpt.com/en/ir/information-disclosures
- SUCCESS - fpt_telecom_home_vi: https://fpt.vn/
- SUCCESS - fpt_software_home_en: https://fptsoftware.com/
- SUCCESS - fpt_software_services_industries_en: https://fptsoftware.com/services-and-industries
- SUCCESS - fpt_annual_report_2024_digital_vi: https://bctn2024.fpt.com
- SUCCESS - fpt_annual_report_2024_digital_en: https://bctn2024.fpt.com/en
- SUCCESS - fpt_annual_report_2024_vi: https://fpt.com/-/media/project/fpt-corporation/fpt/ir/information-disclosures/year-report/2025/april/20250402---fpt---bao-cao-thuong-nien-nam-2024.pdf
- SUCCESS - fpt_esg_report_2024_vi: manual_upload:bao_cao_ESG.pdf
- FAILED - fpt_annual_report_2024_en: https://fpt.com/-/media/project/fpt-corporation/fpt/ir/information-disclosures/year-report/2025/april/20250402---fpt---annual-report-2024.pdf

## Ghi chú

Dữ liệu được thu thập từ các nguồn công khai, ưu tiên website chính thức của FPT. Nếu dùng ngoài mục đích demo nội bộ, cần kiểm tra điều khoản sử dụng và bản quyền nội dung tại từng nguồn.

Các trang FPT.com có Cloudflare. `curl` trả HTTP 403 cho HTML/PDF FPT.com, nên phần text của các trang FPT.com được lấy bằng browser MCP. PDF báo cáo thường niên 2024 tiếng Việt và PDF báo cáo ESG đã được người dùng bổ sung thủ công, sau đó trích xuất text bằng `pdftotext`.

Tổng nguồn thành công: 13
Tổng nguồn thất bại: 1
