# Kiểm tra license và khả năng tái sử dụng

Trạng thái: **chỉ nghiên cứu**. Không sao chép mã, không thêm dependency từ các repo này vào TOMONI. Đây không phải tư vấn pháp lý; cần luật sư xác nhận trước khi quyết định tái sử dụng.

| Repo | License phát hiện | Bằng chứng | Rủi ro nếu sao chép mã | Quyết định |
|---|---|---|---|---|
| OpenConstructionERP | GNU AGPL-3.0 | `OpenConstructionERP/LICENSE` (dòng đầu: "GNU AFFERO GENERAL PUBLIC LICENSE Version 3") | AGPL là copyleft mạnh, có điều khoản áp dụng khi cung cấp phần mềm qua mạng. Có thể phát sinh nghĩa vụ công bố mã nguồn của TOMONI, không phù hợp với SaaS đóng | **Không sao chép mã.** Chỉ học ý tưởng state machine, cấu trúc nghiệp vụ; viết lại theo thiết kế riêng |
| construction_erp | **Không có file LICENSE, COPYING hoặc NOTICE** | Kiểm tra toàn bộ cây thư mục | Theo mặc định bản quyền, mọi quyền được bảo lưu; không có quyền sử dụng | **Không sao chép mã.** Chỉ tham khảo ý tưởng form. Cần xin phép tác giả nếu muốn dùng |
| BuildSuite Core | MIT | `buildsuite_core/license.txt` (MIT License, Copyright 2026 Infraholic Innovations Pvt. Ltd) | Thấp. MIT cho phép dùng, sửa; yêu cầu giữ thông báo bản quyền và license | Có thể tham khảo. Nếu sao chép đoạn mã, giữ thông báo bản quyền MIT. Ưu tiên học thiết kế, không copy DocType vì phụ thuộc Frappe |

## File nhạy cảm không được sao chép

- `construction_erp`: `.env.backup.*`, `db.sqlite3.*`, `data_backup.json`. Có thể chứa dữ liệu và cấu hình nhạy cảm.
- `OpenConstructionERP`: thư mục `signatures/` và cấu hình `.gitleaks.toml`. Không sao chép.

## Điều kiện nếu sau này cần tái sử dụng

1. Construction_erp: có văn bản cấp quyền từ chủ repo.
2. BuildSuite (MIT): giữ thông báo bản quyền trong file được sao chép và ghi nguồn.
3. OpenConstructionERP (AGPL): không sao chép mã; viết lại theo thiết kế riêng và ghi nguồn ý tưởng trong ADR.
4. Mọi đoạn chuyển hóa phải qua review kiến trúc (`docs/0_ARCHITECTURE.md`) và không kéo Django, Frappe, FastAPI hay SQLAlchemy vào TOMONI.
