# Danh mục chức năng xây dựng theo repo tham chiếu

Ghi chú: "có" chỉ được ghi khi tìm thấy model, DocType hoặc thư mục cụ thể. "Chưa thấy" nghĩa là không tìm thấy trong phạm vi nghiên cứu, không khẳng định repo không có.

Ký hiệu đường dẫn:
- OCE = `OpenConstructionERP/backend/app/modules/<module>/`
- CE = `construction_erp/apps/<app>/`
- BS = `buildsuite_core/buildsuite_core/buildsuite_core/doctype/<doctype>/`

| # | Phân hệ | OCE | CE | BS | Bằng chứng |
|---|---|---|---|---|---|
| 1 | Company & multi-company | `core/permissions.py` (RBAC) | `accounts/models.py` (user có `role`) | Frappe Company | CE chỉ có một tổ chức |
| 2 | Project management | `projects` | `projects/models.py` | `project_settings`, `project_category`, `work_package` | |
| 3 | Project companies / MC / Sub | `contacts`, `contracts` | `subcontractors/models.py` | `subcontractor`, `subcontractor_work_order`, `subcontractor_bill` | BS: WO → bill → Purchase Invoice khi submit (README) |
| 4 | Project members & RBAC | `core/permissions.py:33-52` (admin>manager>editor>viewer) | `accounts/models.py:6-38` (`OPERATIONAL_ROLES`, `FINANCIAL_ROLES`) | `project_team`, `persona`, `persona_role`, `buildsuite_workspace_role` | |
| 5 | Worker / personnel | `field_time`, `site_supervision` (không thấy `hr`) | `hr/models.py` | `crew`, `crew_member`, `labour_trade` | |
| 6 | Attendance | `field_time` | `manpower/models.py` | `field_attendance`, `labour_attendance_register`, `overtime_attendance_register` | TOMONI: DEFERRED |
| 7 | Tasks & work packages | `tasks` (12 file) | chưa thấy | `work_package`, `stage_planning_task`, `schedule_snapshot` | |
| 8 | Construction progress | `schedule` (78 file), `boq` | `boq/models.py` | `task_progress_entry`, `task_progress_details`, `boq_wp_summary` | |
| 9 | Site diary | `daily_diary/models.py:45` (`DailyDiary`), `:152` (`DiaryEntry`), `:110` (`WeatherRecord`); `field_diary` | `daily_reports/models.py:7` (`DailyReport`), `:48` (`DailyWorkActivity`), `:71` (`DailyProblemRemark`) | `stage_delay_reason` | |
| 10 | Materials & inventory | `site_inventory` | `materials/models.py` | Material Request (ERPNext) | |
| 11 | Procurement | `procurement` (28 file) | `procurement/models.py:8-98` (Supplier, PR, PO) | Purchase flow ERPNext | |
| 12 | Equipment | `equipment` (27 file) | `equipment/models.py` | `machinery`, `machinery_type`, `machinery_usage` | |
| 13 | Document management | `documents` (23), `doc_templates` | `documents/models.py` | Frappe File | |
| 14 | RFI / requests | `rfi` (20): `models.py:65`, `service.py:88-90` | chưa thấy | chưa thấy | draft→open→answered→closed/void |
| 15 | QA/QC & inspection | `inspections` (12), `quality_concept`, `punchlist` | `quality/models.py:8` (InspectionRequest), `:75` (QualityCheckpoint), `:97` (NonConformance), `:164` (PunchList) | chưa thấy | |
| 16 | HSE / safety | `safety` (15), `hse_advanced`, `hse_frame` | `safety/models.py:6,23,49,81` (TBM, inspection, incident, JSEA) | chưa thấy | Sự cố: `safety/intl.py:63` |
| 17 | Reports & dashboards | `dashboards`, `bi_dashboards` | `dashboard`, `reports` | Workspace report | |
| 18 | Notifications | `notifications` (25) | `notifications/` | Frappe notifications | |
| 19 | Approval workflow | `approval_routes` (18), `changeorders` (18) | `change_orders` | `scope_change_order` + activity | |
| 20 | Mobile offline & sync | Không thấy | Không có | Không có | Không có nguồn tham khảo |

## Nhận xét cho TOMONI

- Các phân hệ có ở **cả ba repo**: Projects, Subcontractor, Procurement, Equipment, Daily diary, Safety, Approval/Change order.
- Chỉ **OCE** có RFI, Submittal, Punchlist, Inspection với state machine rõ ràng.
- Chỉ **BuildSuite** có chuỗi work package → measurement book → subcontractor bill gắn với thanh toán thầu phụ, liên quan phân hệ 6 và 11 của PRD TOMONI.
- Không repo nào có offline-first mobile. TOMONI tự thiết kế (WatermelonDB + outbox đã có).
