# Chance 營運與資料庫操作手冊

> 文件更新：2026-11-04。此文件對應已連線的 Supabase 專案 `unapiwajmgqqtdkixaab`。禁止把它當成建立第二套資料庫的指令直接執行在其他專案。

## 已部署的資料元件

| 元件 | 用途 | 前端權限 |
| --- | --- | --- |
| `chance_documents` | 各使用者各產品的 JSON 雲端快照及版次 | 僅擁有者讀、寫、刪 |
| `chance_audit_events` | PostgreSQL trigger 所記錄的新增／更新／刪除、版本及筆數 | 僅擁有者讀；瀏覽器不得寫入 |
| `chance_support_tickets` | 客戶站內客服問題與狀態 | 客戶只可讀／建立自己的；授權客服能讀／更新狀態 |
| `chance_support_replies` | 客服回覆及內部備註 | 客戶只讀自己的公開回覆；授權客服可建立回覆 |
| `chance_trial_requests` | 使用者付費試用意願 | 客戶只能讀／建立自己的；授權客服可查詢 |
| `chance_billing_plans` | 10 個產品研究階段定價 | 可公開讀，`checkout_enabled=false` |
| `chance_billing_orders` | 付款訂單、金流 provider 訂單 ID 等 | 使用者只讀自己的；前端**不得**建立或改為已付款 |
| `chance_entitlements` | 使用者方案、授權及有效期限 | 只能讀本人；不能由瀏覽器更改 |
| `chance_admins` | 核實過的管理員名單 | 本人可查自己的權限；只有受保護後端可授權 |
| `chance_evidence_files` | PDF／JPG／PNG 附件索引 | 僅所有者讀、上傳索引、刪除 |
| Storage `chance-evidence` | 5 MiB 上限的私人證據檔 | 私人 bucket，路徑 `auth.uid()/app_slug/record_id/object.ext` |

資料庫與 Storage RLS 都已啟用。不可在客戶端使用 service-role 或 secret key。

## 安全開通客服管理員

`https://hub-google.github.io/Chance/admin/` 已建立管理員操作介面。

**目前不自動建立測試管理員**，避免讓陌生人讀到站內客戶問題。先要求擁有人使用正式 Supabase Auth 建立或確認身分，於 Supabase Dashboard 的 Auth → Users 查證帳號身份與對應 UUID，然後由有權限的擁有人於受保護 SQL Editor 明確執行：

```sql
-- 將 UUID 替換成「已核實的本人 Auth user ID」；不可使用任意測試帳號。
insert into public.chance_admins (user_id, role, active)
values ('<verified-user-uuid>'::uuid, 'owner', true)
on conflict (user_id) do update
set role=excluded.role, active=excluded.active;
```

客服人員可使用 `role='support'`，不得授予商家帳務管理權限。若要取消權限，應透過後端撤銷 `active`，並檢查登入 session 的有效性；不要只隱藏前端選單。

## 日常使用流程

1. 用戶不登入也能使用本機試算；資料預設在瀏覽器 localStorage。
2. 使用者登入後可手動上傳／下載，每次 JSON 上傳更新 `version`，資料庫 trigger 記錄稽核 metadata。
3. 本機與雲端一致後，可選擇開啟自動同步；若版本衝突，停寫並保留本機資料。頁面關閉後不會持續同步。
4. 私人附件與 JSON 快照獨立存放；刪除 JSON 需兩次確認，不會刪除附件。附件可各自刪除。
5. 客戶可在工具內回報問題，授權客服可在後台答覆，客戶從原產品查看回覆。
6. 價格、試用與付款狀態分開。點擊「送出試用意願」不會建立付費訂單，更不會自動授權訂閱。

## 付款開通的必要條件（目前尚未完成）

取得正式商家身分及金流商審核；保管商家 Secret 於伺服器 Secrets；設計受保護的 checkout request handler；在伺服器核對金額與商品方案、交易編號、Webhook 簽名、重送冪等、退款及取消；付款確定後才可寫入 `chance_billing_orders` 和 `chance_entitlements`，且需要真人沙盒及正式環境驗收。

在完成這些條件前，不得將 `checkout_enabled` 改為 `true`，也不得用前端的 `status=paid` 判斷已付款。

## 仍需驗證與治理

- 正式會員註冊、Email OTP 模板、Supabase Auth 寄信可達性、真實兩帳號 RLS 隔離。
- 私人附件真實上傳／下載／刪除端到端及合法個資保留／刪除規則。Playwright synthetic REST mock **不是**生產驗證。
- 正式獨立自有網域（避免 GitHub Pages 多專案共享 origin）、自有隱私政策／條款法遵審查、備份方案及流量限速。
- 支付商開通、實際收款、付費試點、對帳、發票與退款流程。
- 定期執行 `tests/verify.test.mjs`、`tests/browser-smoke.mjs`、`tests/cloud-smoke.mjs`、`tests/admin-smoke.mjs`。

**不更動其他專案的資料表或資料。所有前端商品定價均為待市場驗證的假設。**
