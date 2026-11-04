# Chance — 可操作微型商業產品

**PRD 完成／待完成清單與測試證據**：[PRD_PROGRESS.md](PRD_PROGRESS.md)　｜　**營運後台**：[網站](https://hub-google.github.io/Chance/admin/)　｜　**管理員安全開通流程**：[database/OPERATIONS.md](database/OPERATIONS.md)

從「商業機會（每日爬取）」285筆研究選出的十個 Web MVP。每個產品是自己的資料夾，內含 `index.html` 與 `PRD.md`。

**正式總入口（已部署）**：https://hub-google.github.io/Chance/

| 商機編號 | 產品 | 網站 | PRD |
| --- | --- | --- | --- |
| 20261020-001 | 接案交付與請款管理 | [開啟](https://hub-google.github.io/Chance/invoice-proof/) | [PRD](invoice-proof/PRD.md) |
| 20261022-006 | 訂製商品分期收款控管 | [開啟](https://hub-google.github.io/Chance/custom-order-payments/) | [PRD](custom-order-payments/PRD.md) |
| 20261024-005 | 整箱單包庫存換算工具 | [開啟](https://hub-google.github.io/Chance/carton-inventory/) | [PRD](carton-inventory/PRD.md) |
| 20261024-008 | 企業 SaaS 續費與閒置席次盤點 | [開啟](https://hub-google.github.io/Chance/saas-renewal-audit/) | [PRD](saas-renewal-audit/PRD.md) |
| 20261024-014 | 多據點飲水機保養台帳 | [開啟](https://hub-google.github.io/Chance/filter-service/) | [PRD](filter-service/PRD.md) |
| 20261028-006 | 信用卡拒付證據整理器 | [開啟](https://hub-google.github.io/Chance/chargeback-evidence/) | [PRD](chargeback-evidence/PRD.md) |
| 20261028-009 | 公共工程開口契約額度控管 | [開啟](https://hub-google.github.io/Chance/contract-work-orders/) | [PRD](contract-work-orders/PRD.md) |
| 20261028-014 | 短租房源每單淨利計算 | [開啟](https://hub-google.github.io/Chance/shortstay-profit/) | [PRD](shortstay-profit/PRD.md) |
| 20261028-023 | 停車場標租投報初篩 | [開啟](https://hub-google.github.io/Chance/parking-roi/) | [PRD](parking-roi/PRD.md) |
| 20261102-018 | 自助洗衣店頂讓回本試算 | [開啟](https://hub-google.github.io/Chance/laundry-payback/) | [PRD](laundry-payback/PRD.md) |

## 2026-11-04：免登入公開體驗模式

- 十個工具已改成直接開啟工作台，不顯示帳號、密碼、驗證碼或註冊面板。
- 一般訪客可立即新增、編輯、刪除、搜尋、試算、匯入／匯出 CSV、備份／還原 JSON 與列印報告。資料仍儲存於原有 localStorage，沒有刪除任何資料庫、RLS 或雲端備份。
- 請注意：免登入模式不會自動跨裝置同步。清除瀏覽紀錄前請下載 JSON，換裝置後手動匯入。
- 會員介面及私有雲端功能程式完整保留；僅於個別產品網址加上 `?member=1` 才載入，供內部／既有會員驗證。該網址仍需實際登入且受 Supabase RLS 保護。
- 訂製品的客戶專屬規格確認連結依賴業者登入，公開免登入頁暫時不顯示；內部會員預覽仍保留原服務，不提供匿名建立私人確認連結。
- `/admin/` 保留原本身分驗證與管理員白名單，不會對未登入訪客開放。

## 功能

十個工具均已具備實際新增、修改、刪除、搜尋、計算、CSV 匯入與匯出、JSON 備份與還原、列印／PDF。預設資料儲存在使用者瀏覽器本機；現已增加可選的 Supabase 登入、明確操作的個人雲端備份與付費試用意願登記。**現可自行開啟版本保護的跨裝置同步；尚無多人協作或正式金流扣款**。所有定價皆屬待驗證的市場假設。

## 部署

在 GitHub repository Settings → Pages → Build and deployment → Source 選取 **GitHub Actions**。此倉庫的 `.github/workflows/deploy-pages.yml` 會在 push 到 main 時發佈；也可 Actions 手動執行 `workflow_dispatch`。

## 架構

`assets/engine.js` 是共用的安全單機 CRUD／計算引擎，`assets/site.css` 是共用 responsive 樣式。產品差異使用各自 `index.html` 中的結構化設定與專屬公式，保存鍵值按產品隔離。此結構為靜態 MVP，後續需替換為經驗證的租戶隔離後端再對外營利。

## 來源

[Google Sheet 商機來源](https://docs.google.com/spreadsheets/d/103uxu5VmnDj7WBrByD9vjpLgauy8-M6uZXqDSnWk7tI/edit?gid=1377271577)，採用研究資料但不代表已獲市場付費驗證。請參閱各 PRD。

## 雲端功能

- Supabase project `unapiwajmgqqtdkixaab` 新增 `public.chance_documents`、`public.chance_trial_requests`；RLS 僅允許資料擁有人操作。
- `assets/engine.js` 預設不載入 `assets/cloud.js`，公開入口不顯示登入表單；內部會員體驗加上 `?member=1` 才載入原有會員面板。
- 使用者須主動確認雲端上傳／下載，本機資料不會因為登入而消失。
- Email OTP 郵件模板及 Auth 寄信配額需在 Supabase 管理端配置與驗證。未建立正式扣款系統。
- 請勿將 Supabase secret/service-role key 寫入網站前端。`assets/cloud.js` 使用可公開的 publishable key，所有資料存取依賴伺服器 RLS。

- 已加入 UTF-8 CSV 批次匯入（以欄位名稱對應、追加模式、覆蓋防護及 5,000 筆上限）；匯出內容會保護疑似公式字串。

## 2026-11-04 工程進度

- v0.2：10 種產業專用 KPI／風險試算、逐筆 A4 列印報告、新手教學已實作（`assets/insights.js`）。
- 期限提醒：請款、訂製尾款、SaaS 續約、設備保養、拒付證據、公共工程可匯出 `.ics`（`assets/reminders.js`）。
- v0.3：帳號登入、私人雲端備份、RLS、由資料庫 trigger 產生寫入審計（`chance_audit_events`），但未完成實際真人跨裝置驗收與多成員協作。
- v0.4：可公開查看方案與價格假設（`/pricing/`）、登入者可留下試用意願、網站內客服回報與客服回覆查詢、server-only 付款訂單／訂閱授權資料表。**沒有任何已開通的付款方式**。
- 隱私／使用限制：`/legal/privacy.html`、`/legal/terms.html`，均屬正式營運前的草案。
- 尚未完成：正式金流商家審核、簽名付款通知驗證、發票與退款、私人憑證正式環境 E2E、專用網域、真人付費試點及個資法遵審查。

- 使用者經手動對齊後可開啟自動同步（樂觀版本鎖；衝突時停止；僅在網頁開啟期間工作）。可自行刪除單一產品的雲端備份，不動本機紀錄。
- [站內客服](assets/cloud.js) 已串私人 support_tickets、replies；[Playwright 會員模擬測試](tests/cloud-smoke.mjs) 已覆蓋雲端備份、自動同步、客服與刪除，但正式帳號寄信／金流仍待真人驗證。

## v0.4 補充：佐證檔案與客服後台

- `/admin/`：網站內客服管理後台，需在 Supabase 安全端核對已存在的 Auth 帳號後加入 `chance_admins`，一般會員不得自助取得管理權限。
- `chance-evidence` 私人 Storage bucket：僅允許登入本人在自己路徑內上傳、下載、刪除 JPG/PNG/PDF，單檔最多 5 MiB；檔案與 cloud JSON 互不覆蓋。
- 文件與權限分別由 `chance_evidence_files`、`chance_admins`、客服及訂閱資料表保存。詳見 `database/OPERATIONS.md`。
- 商業化仍然缺實際付款憑證與金流商家審核、正式付款回呼驗簽、客服管理員確認、真人 Auth/附件 E2E、正式隱私法遵及安全測試。

## 2026-11-04 PRD 開發補充

- 訂製品工具已新增多期應收、實收與期限，並將各期未繳期限放入原有 ICS 提醒；並未實際替客戶收款。
- 箱包庫存已新增 SKU 逐筆入出庫／直接編輯的異動原因、時間及前後數量；歷史可隨 JSON 備份及雲端快照儲存，尚不是不可竄改的正式稽核帳本。
- 十個工具共用的資料儲存及 CSV／JSON 匯入驗證已強化，包含本地存檔失敗回退。會員可在站內客服送出完整資料刪除申請，實際刪除仍待管理員處理。
- **全部已開發與未完成項目**詳見 [PRD_PROGRESS.md](PRD_PROGRESS.md)。尚未完成金流開通、真人登入與付款端到端驗證。

## 2026-11-04 逐項補完 PRD（本輪）

- `filter-service`：多位技師派工、各案排程與狀態、行事曆；已完成派工支援現場手寫簽收／內容快照，仍非經身分驗證的正式電子簽章。
- `custom-order-payments`：登入業者可建立 7 天客戶規格確認連結，客戶免登入一次性確認或提出異議；業者查詢回覆並人工核對套用。需要自行分享連結，無金流或 Email／LINE 自動發送。
- 新增 `chance_order_confirmations` 和安全限權 RPC；有意公開的客戶查詢／回覆介面仍須正式安全與真人驗收。驗收工具：`tests/confirmation-smoke.mjs`。
- 完整未完成項目請見 [PRD_PROGRESS.md](PRD_PROGRESS.md)。不會將合成測試或可分享的規格確認連結描述為正式法律合約簽名。
