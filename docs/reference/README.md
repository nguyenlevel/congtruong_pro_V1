# Reference Repos — Documentation Tham Chiếu

> **Mục đích:** Tài liệu hóa các repo open-source được nghiên cứu làm **tham chiếu
> nghiệp vụ / UX / cấu trúc dữ liệu** cho các module của Partner OS (TOMONI Construction).
> Thư mục này KHÔNG chứa code ngoài.

## Chính sách (BẮT BUỘC)

1. **Chỉ tham chiếu, không copy code.** Mọi repo mẫu đều là stack khác
   (MongoDB/MERN, Firebase, Java thuần …) — code của chúng sẽ **vỡ Architecture
   Guard** nếu dán vào (contract §25, §26, §52: layered architecture, không UI
   truy cập DB trực tiếp, Offline-first, RLS).
2. **Chỉ rút ra:** (a) yêu cầu nghiệp vụ, (b) bảng màn hình / flow UX,
   (c) mô hình dữ liệu tham khảo → sau đó **thiết kế lại** theo kiến trúc
   Partner OS (Domain → Contracts → Supabase/RLS → Web/Mobile).
3. **Bản sao local** của các repo nằm ở `reference/` (gitignored, không commit).
   Chỉ **ghi chú** dưới `docs/reference/` mới được commit.
4. Ghi rõ module nào trong tracker được repo tham chiếu hỗ trợ, và giới hạn của nó.

## Danh mục repo tham chiếu

| Repo (local) | Stack | Gốc GitHub | Đang hỗ trợ module | Ghi chú |
|---|---|---|---|---|
| `reference/contractor-app` (FieldBook) | MERN (MongoDB) | `Anuraj-IND/contractor-app` | 3, 5, 6, 10, 11, 13 | Gần nhất với nghiệp vụ nhà thầu: chấm công, công nhật, vật tư, nhà cung cấp, hóa đơn/quyết toán, dashboard |
| `reference/constrution-app` | Java Android + Firebase | `dvb99/Constrution-app` | 7, 9, 10, 12 | Site inspection, nhật ký công trường, thiết bị, kho Godown, yêu cầu/giao tiếp |
| `reference/erp-sync-prototype` | React + Dexie + Supabase | `seunpayne/erp-sync-prototype` | (kiểm thử sync) | Offline-first: kịch bản stress test sync, tiêu chí đạt — áp dụng cho GĐ 2.1 |
| `warpirate/momento`, `Kamaiko/halterofit-showcase` | RN + Expo + WatermelonDB + Supabase | GitHub | (kiến trúc offline) | Chưa clone (nền tảng sync của dự án đã vượt); giữ nguồn để tham khảo nếu cần |

## Ghi chú chi tiết

- [`docs/reference/fieldbook-contractor-app.md`](./fieldbook-contractor-app.md)
- [`docs/reference/constrution-app.md`](./constrution-app.md)
- [`docs/reference/erp-sync-prototype.md`](./erp-sync-prototype.md)

## Quy tắc cập nhật

- Mỗi lần clone repo mới: thêm dòng vào bảng trên + viết ghi chú riêng.
- Ghi chú phải nêu **bằng chứng** (file đọc được, dòng) và **giới hạn** của repo.
- Không cập nhật tracker `docs/3_TRACKER.md` chỉ vì có repo tham chiếu — tracker
  chỉ phản ánh code/tests thật của dự án.