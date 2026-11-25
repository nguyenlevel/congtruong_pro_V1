# So sánh repository tham chiếu

Ngày nghiên cứu: 2026-11-23. Phương pháp: clone read-only vào thư mục nghiên cứu ngoài TOMONI (`files\repo-research` trong session), đọc cấu trúc, manifest, model, status, test, CI và LICENSE. Không cài đặt, không chạy test của repo tham chiếu.

## 1. Bảng tổng quan

| Tiêu chí | OpenConstructionERP | construction_erp (Django) | BuildSuite Core (Frappe) |
|---|---|---|---|
| Đường dẫn | `OpenConstructionERP/` | `construction_erp/` | `buildsuite_core/` |
| Commit | ≥300 (clone depth 300; release 20.2.1, 2026-11-22) | 131 (2026-08-30) | ≥1065 (clone depth 300; 2026-11-23) |
| Stack | FastAPI + SQLAlchemy/Alembic (`backend/`), React/TS (`frontend/`) | Django + SQLite/DRF (`apps/`) | Frappe/ERPNext v16 (Python + JS) |
| LICENSE | AGPL-3.0 (`LICENSE`) | **Không có file LICENSE** | MIT (`license.txt`) |
| Quy mô | 261 thư mục trong `backend/app/modules/`, 194 module được nạp (`MODULES.md`), 540 migration Alembic | 24 app Django | 69 DocType (`buildsuite_core/buildsuite_core/buildsuite_core/doctype/`) |
| Test | ~3.560 file `test_*.py` trong `backend/tests`, ~1.721 file test frontend | 2 file test trong `tests/` | 106 file `test_*.py`; CI `ci.yml`, `linter.yml` |
| Đa công ty/tenant | RBAC phân cấp (`backend/app/core/permissions.py:33-52`) | Một tổ chức, vai trò theo user (`apps/accounts/models.py:6-38`) | Frappe multi-company, Workspace/Persona |
| Offline mobile | Không thấy bằng chứng trong frontend (tìm `indexedDB`, `serviceWorker`, `navigator.onLine`: không có kết quả) | Không có | Không có |
| Điểm đáng học nhất | Phạm vi nghiệp vụ rộng, permission registry, state machine rõ ràng cho RFI/Submittal/Punchlist | Quy trình daily report, manpower, equipment, materials, safety đơn giản | Quy trình thi công thực tế: work package → stage plan → measurement book → subcontractor bill |

## 2. Đánh giá mức độ hoàn thiện (không lấy README làm bằng chứng)

- **OpenConstructionERP**: nhiều module có đủ models, schemas, router, service, validators, export (ví dụ `rfi/`, `submittals/`, `punchlist/`, `inspections/`, `safety/`). Phạm vi 194 module rất lớn và chất lượng không đồng đều; nhiều module (estimating, CAD/BIM, AI) không liên quan MVP TOMONI. Chưa kiểm tra từng module có test pass hay không.
- **construction_erp**: dự án nhỏ, test gần như không có. Repo chứa các file không nên sao chép: `db.sqlite3.backup.*`, `data_backup.json`, `.env.backup.*`, `cloudflared-linux-amd64.deb`. Vệ sinh repo kém; không dùng làm nguồn mã.
- **BuildSuite Core**: có CI và 106 file test; README tự ghi là "Beta". Nghiệp vụ thi công sâu hơn construction_erp, nhưng phụ thuộc Frappe và ERPNext ledger.

## 3. Kết luận chọn repo học

1. **BuildSuite Core**: học nhiều nhất về nghiệp vụ thi công (work package, stage plan, measurement book, subcontractor bill, labour attendance). Kiến trúc Frappe không mang sang TOMONI được.
2. **OpenConstructionERP**: học nhiều nhất về trạng thái, permission registry và cách tách module, nhưng license AGPL-3.0 hạn chế việc tái sử dụng mã.
3. **construction_erp**: chỉ tham khảo ý tưởng form nhật báo và quy trình duyệt đơn giản; không tái sử dụng mã vì không có license.

Chi tiết license: xem [REUSE_AND_LICENSE_AUDIT.md](./REUSE_AND_LICENSE_AUDIT.md).
Chi tiết module: xem [CONSTRUCTION_FEATURE_CATALOG.md](./CONSTRUCTION_FEATURE_CATALOG.md) và [FEATURE_GAP_ANALYSIS.md](./FEATURE_GAP_ANALYSIS.md).
