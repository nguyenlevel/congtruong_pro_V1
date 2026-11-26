# MODULE VERTICAL-SLICE PLAYBOOK — PARTNER OS

> **Mục đích:** Công thức chuẩn để triển khai một module nghiệp vụ (vertical slice)
> theo đúng kiến trúc Partner OS. Playbook này được **trích từ Module Worker**
> (module duy nhất đã hoàn thành, có test PASS) — không phải lý thuyết.
> **Phạm vi:** Mọi module mới trong GĐ 1 (Module 1, 3–13) phải theo playbook này.

## 1. Bản đồ vertical slice (7 lớp)

Mỗi module là một **lát cắt dọc** chạy từ DB xuống UI. Đúng kiến trúc
(contract §4, §24, §25):

```text
UI (Web)                                    UI (Mobile)
  ↓                                            ↓
Feature (web: api/store/page)               Feature (mobile: database/offline)
  ↓                                            ↓
Application Service (validate bằng Zod)        ↓ (local repo + outbox)
  ↓                                            ↓
Domain (entities · rules · services)        Sync Engine (flush/pull/retry/conflict)
  ↓
Contracts (Zod schemas · DTO · API interface)
  ↓
Repository Interface (packages/database)
  ↓
Adapter: Supabase (web)  ·  WatermelonDB (mobile)
  ↓
Supabase PostgreSQL + RLS
```

## 2. Ánh xạ file thực tế (Module Worker = exemplar)

| Lớp | Agent | Đường dẫn thực (Worker) | Nội dung |
|---|---|---|---|
| 0. DB + RLS | DBAgent | `supabase/migrations/20XXXX…_init_<entity>.sql` | bảng + index + trigger + RLS |
| 0b. Test DB | DBAgent | `supabase/tests/rls/<entity>.test.sql` | pgTAP: tenant isolation + role |
| 0c. Rollback | DBAgent | `supabase/rollbacks/…_<entity>.down.sql` | rollback mỗi migration |
| 1. Domain | CoreAgent | `packages/domain/src/entities/<Entity>.ts` | entity (interface thuần, không framework) |
| 1b. Domain rules | CoreAgent | `packages/domain/src/rules/<entity>-status.ts` | state machine / business rules |
| 1c. Domain service | CoreAgent | `packages/domain/src/services/<entity>-service.ts` | guard nghiệp vụ |
| 2. Contracts | CoreAgent | `packages/contracts/src/schemas/<entity>.schema.ts` | Zod schema = boundary contract |
| 2b. Contracts | CoreAgent | `packages/contracts/src/dto/<entity>.dto.ts` | Create/Update/ListQuery input |
| 2c. Contracts | CoreAgent | `packages/contracts/src/api/<entity>.api.ts` | interface API Web/Mobile đồng thuận |
| 2d. Contracts | CoreAgent | `packages/contracts/src/events/<entity>-events.ts` | events (created/updated/deleted) |
| 3. Repository | CoreAgent | `packages/database/src/repositories/<entity>-repository.ts` | interface `ScopedRepository` |
| 4. Web slice | WebAgent | `apps/web/src/features/<entity>/api/<entity>Api.ts` | adapter Supabase (snake↔camel) |
| 4b. Web slice | WebAgent | `apps/web/src/features/<entity>/services/<entity>-application.ts` | use-case (parse Zod → gọi api) |
| 4c. Web slice | WebAgent | `apps/web/src/features/<entity>/store/<entity>Store.ts` | Zustand store (status/error/data) |
| 4d. Web slice | WebAgent | `apps/web/src/features/<entity>/pages/*.tsx` | page dùng `useSyncExternalStore` |
| 5. Mobile slice | MobileAgent | `apps/mobile/src/features/<entity>/database/local<Entity>Repository.ts` | local repo + outbox enqueue |
| 5b. Mobile slice | MobileAgent | `apps/mobile/src/features/<entity>/services/offline-<entity>.ts` | use-case offline |
| 5c. Mobile slice | MobileAgent | `apps/mobile/src/features/<entity>/pages/*.tsx` | page mobile |
| 5d. Mobile slice | MobileAgent | `apps/mobile/src/database/schema.ts` | thêm table WatermelonDB (bump version) |
| 5e. Mobile slice | MobileAgent | `apps/mobile/src/sync/sync-runtime.ts` | bản sao `create<Entity>SyncRuntime` |
| 5f. Mobile slice | MobileAgent | `apps/mobile/src/app/App.tsx` | wire repo/runtime → page |
| 6. Tests | mỗi agent | `*.test.ts` + pgTAP | xem §8 |

## 3. Quy trình 8 bước cho mỗi module

Thứ tự **bắt buộc** (không làm UI trước DB):

1. **DBAgent**: migration + rollback + RLS test. Chạy `supabase test db`.
2. **CoreAgent**: domain entity/rules/service → contracts schemas/DTO/api → repository interface. Kèm unit test.
3. **(tùy chọn) Yêu cầu nghiệp vụ**: tham chiếu `docs/reference/*.md` nếu module trùng nghiệp vụ repo mẫu.
4. **WebAgent**: api adapter → application service → store → page. Kèm test store.
5. **MobileAgent**: schema bump → local repo → offline use-case → sync runtime → page → wire App.
6. **Verify toàn cục**: `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm architecture:check`.
7. **Cập nhật**: `docs/3_TRACKER.md` (trạng thái module) + `docs/tiendo.md` (Mục 14).
8. **Báo cáo** theo format AGENTS.md.

> **Song song hóa (đẩy nhanh):** các module **độc lập về file**
> (khác thư mục `features/<entity>`, khác migration) nên có thể giao
> **nhiều agent chạy đồng thời**, mỗi agent 1 module. Chỉ các lớp dùng chung
> (`packages/domain/src/index.ts`, `packages/contracts/src/index.ts`,
> `apps/mobile/src/database/schema.ts`) cần merge tuần tự — agent nào chạm
> trước thì update export + schema, agent sau rebase.

## 4. Lớp 0 — Database + RLS (DBAgent)

Mẫu migration `workers` (003) — **điều chỉnh theo chuẩn mới**:

```sql
create table public.<entity>s (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  ...cột nghiệp vụ...,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, <mã nghiệp vụ>)
);
create index idx_<entity>s_tenant_id on public.<entity>s (tenant_id);
create index idx_<entity>s_project_id on public.<entity>s (project_id);
create trigger <entity>s_set_updated_at before update on public.<entity>s
for each row execute function public.set_updated_at();
alter table public.<entity>s enable row level security;
```

**RLS — BẮT BUỘC dùng hàm DB-validated (ADR-008, migration 014), không dùng JWT claim trực tiếp:**

```sql
-- tenant boundary (đọc): member của tenant mới đọc được
create policy "<entity>s select within own tenant" on public.<entity>s
for select to authenticated
using (tenant_id = public.current_tenant_id());

-- ghi: tenant + role gating
create policy "<entity>s insert by tenant managers" on public.<entity>s
for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'SITE_MANAGER', '<ROLE_PHÙ_HỢP>')
);
```

**Quy tắc RLS:**
- Mọi policy dùng `public.current_tenant_id()` / `public.current_app_role()` (không khai thác `auth.jwt()->>'tenant_id'` trực tiếp — claim có thể giả mạo, migration 014 là nguồn chân lý).
- INSERT/UPDATE có `with check (tenant_id = current_tenant_id())` → chặn di chuyển tenant.
- DELETE: ưu tiên soft-delete (set `deleted_at`), hard-delete chỉ cho role cao nhất.
- Bảng nghiệp vụ: luôn có `tenant_id` (+ `project_id` nếu theo công trường) — contract §9.
- Cho mọi bảng nhạy cảm: viết pgTAP test kiểm tra (a) user đúng tenant đọc được, (b) user khác tenant bị chặn, (c) role thiếu quyền bị chặn, (d) project ngoài tenant bị chặn — contract §10.1.
- Migration mới: KHÔNG sửa lịch sử migration đã chạy production — tạo migration mới (contract §11). Rollback tương ứng trong `supabase/rollbacks/`.

## 5. Lớp 1–3 — Domain, Contracts, Repository (CoreAgent)

**Domain** (`packages/domain`): interface thuần, không import React/Supabase/Watermelon (contract §4.1, §6).

```ts
// entities/<Entity>.ts
export interface <Entity> {
  id: string;
  tenantId: string;
  projectId: string | null;
  ...cột nghiệp vụ...;
  status: <Entity>Status;
}
```

- Rules: state machine dạng `Record<Status, readonly Status[]>` + `requireValidTransition` (xem `rules/worker-status.ts`).
- Service: `validate<Entity>Record`, `require<Entity>Exists`, `assertSameTenant`, apply transition (xem `services/worker-service.ts`).
- Export tất cả trong `packages/domain/src/index.ts` (thêm vào, không xóa).

**Contracts** (`packages/contracts`): Zod = boundary contract Web ↔ Mobile ↔ Sync (contract §7).

```ts
// schemas/<entity>.schema.ts
export const <Entity>Schema = z.object({ ... }).strict();
export function parse<Entity>(input: unknown): <Entity> { return <Entity>Schema.parse(input); }
```

- DTO: `Create<Entity>Input` = schema `.omit({id, status}).extend({status optional})`; `Update<Entity>Input` = `.partial()`; `<Entity>ListQuery` (xem `dto/worker.dto.ts`).
- API interface: `list/findById/create/update/remove` (xem `api/worker.api.ts`).
- Events: `created/updated/deleted` + helper (xem `events/worker-events.ts`).
- Export mọi thứ trong `packages/contracts/src/index.ts`.

**Repository** (`packages/database`): interface thừa kế `ScopedRepository<TRecord, TId, TScope>` với `scopeColumn: 'tenantId'`, thêm method chuyên biệt (`listByProject`, `listByStatus`…).

## 6. Lớp 4 — Web slice (WebAgent)

Cấu trúc thư mục: `apps/web/src/features/<entity>/{api,services,store,pages,index.ts}` (contract §18). **Chỉ tạo thư mục khi cần.**

1. **api adapter** (`api/<entity>Api.ts`): implement `XApi` từ contracts. Map snake_case (DB) ↔ camelCase (domain) — xem `supabaseWorkerApi.ts`. UI **không bao giờ** gọi `supabase.from()` trực tiếp.
2. **application service**: `parse(input)` (Zod) rồi gọi api — business logic không nằm trong `onClick`/`useEffect` (contract §23).
3. **store**: Zustand với `status: 'idle'|'loading'|'loaded'|'error'`, `data`, `error` + `load(api, query)`.
4. **page**: dùng `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)`; render 4 trạng thái (loading/error/empty/loaded) — xem `WorkersListPage.tsx`.
5. Wire vào `apps/web/src/app/App.tsx` (guard role nếu cần, như `WORKER` bị chặn xem danh sách).
6. Text dùng `translate('vi', '...')` từ `@partner-os/i18n`.

## 7. Lớp 5 — Mobile slice (MobileAgent)

Offline-first là lõi (contract §13). Ghi local trước, outbox sau:

1. **Schema** (`apps/mobile/src/database/schema.ts`): thêm table `<entity>` (cột snake_case, `version`, `sync_status`, `deleted_at`) + table `sync_outbox` đã có. **Bump `version: N`.**
2. **Local repository** (`features/<entity>/database/local<Entity>Repository.ts`): thực hiện interface từ `packages/database`. `create` → `store.insert(record)` + `outbox.enqueue(createOutboxRecord(...))`; `update`/`remove` tương tự với `version` tăng dần (xem `localWorkerRepository.ts`).
3. **Offline use-case** (`services/offline-<entity>.ts`): `CreateInput.parse` → `validate<Entity>Record` → `repo.create` (xem `offline-worker.ts`).
4. **Sync runtime** (`apps/mobile/src/sync/sync-runtime.ts`): bản sao `create<Entity>SyncRuntime` — `engine.flush('<entity>')` rồi pull theo cursor từng tenant (key `sync.<entity>.cursor.<tenantId>`), skip record còn pending local (xem `sync-runtime.ts`).
5. **Page + wiring**: page mobile render danh sách local; `App.tsx` tạo repo + runtime (per active tenant) + `useAutoSync`.

> **Lưu ý cross-cutting:** cursor theo tenant, outbox có `tenant_id`/`project_id` (đã có ở schema v3, migration 016), tenant switcher chặn khi Outbox còn pending.

## 8. Lớp 6 — Tests (mỗi agent)

| Lớp | Test file | Nội dung tối thiểu |
|---|---|---|
| DB | `supabase/tests/rls/<entity>.test.sql` | pgTAP: đúng tenant ✅, khác tenant ❌, role thiếu ❌, project ngoài tenant ❌, audit ghi nhận |
| Domain | `packages/domain/src/rules/<entity>-status.test.ts` | state machine hợp lệ / bất hợp lệ |
| Domain | `packages/domain/src/services/...` | guard: tồn tại, tenant mismatch, validate |
| Contracts | `packages/contracts/src/schemas/<entity>.schema.test.ts` | parse hợp lệ / bất hợp lệ (input rác) |
| Web | `apps/web/src/features/<entity>/store/<entity>Store.test.ts` | store: loading → loaded / error |
| Mobile | `apps/mobile/src/features/<entity>/services/offline-<entity>.test.ts` | create offline: số dòng local + outbox; input rác không ghi gì; version tăng |
| Mobile | `apps/mobile/src/sync/...` (sync-runtime) | mất mạng → retry; cursor tách tenant |

Mẫu fake DB local (chạy nhanh, không cần Watermelon thật): xem `apps/mobile/src/features/workers/services/offline-worker.test.ts` — fake `LocalWorkerStore` + `LocalSyncOutboxStore` trong bộ nhớ.

## 9. Multi-tenant checklist (mọi module)

- [ ] Bảng có `tenant_id` (bắt buộc) + `project_id` (nếu theo công trường).
- [ ] RLS dùng `current_tenant_id()` / `current_app_role()` (không claim trực tiếp).
- [ ] INSERT/UPDATE `with check (tenant_id = current_tenant_id())`.
- [ ] Domain service có `assertSameTenant`.
- [ ] Mobile cursor tách theo tenantId.
- [ ] Web load theo `tenantId` đang chọn.
- [ ] pgTAP test tenant isolation cho bảng mới.

## 10. Verification gate (trước khi DONE)

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm architecture:check
pnpm build
# nếu có DB local: supabase test db (localscripts)
```

Không đánh dấu DONE nếu gate đỏ (AGENTS.md).

## 11. Definition of Done (mỗi module) — theo tracker

- [ ] Migration + rollback + RLS test IMPLEMENTED & TESTED.
- [ ] Domain + Contracts + Repository có unit test PASS.
- [ ] Web slice có store test PASS; page render 4 trạng thái.
- [ ] Mobile offline slice có test PASS (local repo + outbox).
- [ ] Sync runtime có test (trong test sync-runtime hiện có).
- [ ] Lint/typecheck/test/architecture:check/build xanh.
- [ ] Tracker + `docs/tiendo.md` cập nhật (không tự đánh dấu ACCEPTED — chờ chủ dự án).
- [ ] Không mock production data, không fake implementation (contract §31–32).

## 12. Lưu ý thừa kế (nợ kỹ thuật cần xử lý khi chạm module)

- RLS `workers` (migration 003) vẫn dùng pattern cũ `(auth.jwt()->>'tenant_id')::uuid` + literal role — khi module liên quan nhân sự được mở rộng, nâng cấp lên `current_tenant_id()`/`current_app_role()` trong migration mới.
- `memberships.role` đang deprecated — module RBAC mới dùng `project_memberships` (ADR-001 addendum).
- Tham chiếu nghiệp vụ: `docs/reference/fieldbook-contractor-app.md` (Module 3/5/6/10/11/13), `docs/reference/constrution-app.md` (Module 7/9/10/12), `docs/reference/erp-sync-prototype.md` (stress test sync).