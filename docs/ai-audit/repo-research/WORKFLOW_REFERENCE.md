# Workflow tham chiếu

Các workflow trích từ mã nguồn tham chiếu, kèm vị trí để kiểm chứng. Chưa chạy kiểm thử của repo tham chiếu.

## 1. RFI (OpenConstructionERP)

- Trạng thái: `draft`, `open`, `answered`, `closed`, `void` (`backend/app/modules/rfi/intl.py:49`).
- Chuyển trạng thái (`backend/app/modules/rfi/service.py:88-90`):
  - `draft` → `open`, `void`
  - `open` → `answered`, `closed`, `void`
- Trạng thái đang chờ trả lời: `draft`, `open` (`intl.py:52`).
- RFI đã phát hành (`open`, `answered`, `closed`) bị ràng buộc khi sửa (`validators.py:43`).
- Kiểm tra hạn trả lời chỉ áp dụng khi `draft` hoặc `open` (`router.py:154`).

## 2. Submittal (OpenConstructionERP)

- Trạng thái: `draft`, `submitted`, `under_review`, `approved`, `approved_as_noted`, `revise_and_resubmit`, `rejected`, `closed` (`submittals/intl.py:44`, `tracking.py:84-85`).
- PATCH thường chỉ cho sửa khi `draft`, `submitted`, `under_review` (`service.py:41`). Editor không thể đặt thẳng `approved` qua PATCH.
- Không xóa khi `approved`, `approved_as_noted`, `closed` (`service.py:43`).
- Validator bắt `outcome` khớp `status` (`validators.py:305`).

Áp dụng cho TOMONI: nguyên tắc "không đổi trạng thái quyết định qua cập nhật thường" phù hợp với mô hình RPC/RLS của TOMONI.

## 3. Punchlist (OpenConstructionERP)

- Trạng thái: `open`, `in_progress`, `assigned`, `resolved`, `verified`, `closed` (`punchlist/intl.py:41`).
- Đóng: `verified`, `closed` (`service.py:99`); đang hoạt động: `open`, `in_progress` (`service.py:100`).
- Từ `open` có thể chuyển sang `assigned` hoặc `in_progress` (cho phép giao trực tiếp hoặc fast-track) (`service.py:126`).

## 4. Sự cố HSE (OpenConstructionERP)

- Sự cố: `reported`, `investigating`, `corrective_action`, `closed` (`safety/intl.py:63`).
- Hành động khắc phục đang mở: `open`, `in_progress`; đã đóng: `completed`, `closed`, `verified` (`safety/safety_indicators.py:66-67`).
- Quan sát an toàn: `open`, `in_progress`, `closed` (`safety/intl.py:65`).

## 5. Báo cáo ngày (construction_erp)

- Trạng thái theo README: `Draft` → `Submitted` → `Approved` / `Rejected`; mặc định `Draft` (`apps/daily_reports/models.py:29`).
- Vấn đề phát sinh (`DailyProblemRemark`): mặc định `Open` (`apps/daily_reports/models.py:90`).

## 6. Procurement (construction_erp)

- Purchase Request mặc định `Draft` (`apps/procurement/models.py:36`).
- Purchase Order mặc định `Ordered` (`apps/procurement/models.py:79`).

## 7. Work package → subcontractor bill (BuildSuite Core)

- Chuỗi tài liệu: `work_package` → `subcontractor_work_order` (+ `subcontractor_work_order_line`) → `measurement_book` (+ `measurement_book_entry`) → `subcontractor_bill` (+ `subcontractor_bill_line`, `subcontractor_bill_tax`).
- Khi submit bill, hệ thống tạo Purchase Invoice (README, mục Subcontractor bill).
- Bill có waterfall: schedule of values, retention, advance, net payable (README).
- Vòng đời submit / cancel / amend theo chuẩn Frappe (README).

Áp dụng cho TOMONI: chuỗi WO → đo khối lượng → bill là workflow thanh toán thầu phụ đáng tham khảo nhất. Cần thiết kế lại trên PostgreSQL/RLS, không copy DocType.

## 8. Hiện trạng TOMONI

Ngoài VS-01 (thành viên dự án), TOMONI chưa có workflow nghiệp vụ nào trong các phân hệ trên.
