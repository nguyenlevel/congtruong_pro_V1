# erp-sync-prototype — Ghi chú tham chiếu (kiểm thử sync)

> Repo: `https://github.com/seunpayne/erp-sync-prototype` (clone local: `reference/erp-sync-prototype`)
> Stack gốc: React (web) + Dexie.js/IndexedDB + Supabase + Browser Network API.
> **Không copy code** — mục đích: tham chiếu **kịch bản stress test** cho sync engine
> của Partner OS (GĐ 2.1 trong tracker: kiểm thử tự động sync).

## 1. Bối cảnh

- Là prototype offline-first **chuyển từ RN (WatermelonDB) sang web (Dexie)**.
- Sync engine của Partner OS (`packages/sync-engine`) **đã vượt** repo này
  (có outbox/queue/retry/conflict/cursor/audit + test PG + integration).
- Giá trị của repo này nằm ở **bộ kịch bản stress test** và **tiêu chí đạt**,
  dùng làm checklist để xác minh sync engine trên dữ liệu thật.

## 2. Kịch bản stress test (nguồn: `BUILD_BRIEF.md`)

1. **Basic offline write and sync** — ghi offline đơn giản rồi sync.
2. **Interrupted sync** — ngắt giữa chừng, không hỏng dữ liệu.
3. **Simultaneous writes from two devices** — hai thiết bị ghi cùng lúc.
4. **Conflict — adjustment vs sale** — ghi đè vs điều chỉnh số lượng (inventory).
5. **Device storage pressure (5,000 items)** — áp lực lưu trữ.
6. **Long offline period (48 hours)** — offline lâu, sau đó recover.

## 3. Tiêu chí đạt (success criteria)

| Tiêu chí | Giá trị |
|---|---|
| Sync rate | < 1% mất dữ liệu |
| Sync time | < 5 phút / 100 giao dịch |
| Conflict detection | phát hiện mọi xung đột thật |
| Conflict resolution | semantic merge cho inventory |
| Interrupted sync | không hỏng dữ liệu |
| Idempotency | sync lặp lại cho cùng kết quả |

## 4. Kỹ thuật đáng tham khảo

- `log-decision.js` — log từng quyết định sync (cho audit trail).
- 5 màn hình test harness: Device Setup, Data Seeder, Sync Control Panel
  (toggle offline / force sync / clear DB), Conflict Simulator, Results Log.
- Retry: 3 lần với exponential backoff.

## 5. Áp dụng vào Partner OS (đề xuất)

- Chuyển 6 kịch bản stress test thành **integration/E2E tests** cho
  `packages/sync-engine` (hiện có `create-sync-engine.test.ts`,
  `sync-engine-flow.test.ts`):
  - Interrupted sync → test idempotency + retry (đã có một phần ở sync-runtime).
  - Two-device conflict → mở rộng `conflict.test.ts`.
  - Long offline (48h) → test cursor/versioning.
- Bổ sung **Conflict Simulator** + **Results Log** tương tự để debug trên thiết bị
  (đang BLOCKED bởi build Android — xem `docs/3_TRACKER.md`).

## 6. Nguồn

- README gốc: `reference/erp-sync-prototype/README.md`
- `reference/erp-sync-prototype/BUILD_BRIEF.md`
- `reference/erp-sync-prototype/test-results.md`
- `reference/erp-sync-prototype/log-decision.js`