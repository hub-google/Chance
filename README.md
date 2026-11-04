# Chance — 可操作微型商業產品

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
- 每個 App 的雲端面板自動由 `assets/engine.js` 載入 `assets/cloud.js`。
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
- 尚未完成：正式金流商家審核、簽名付款通知驗證、發票與退款、原始憑證檔案上傳、專用網域、真人付費試點及個資法遵審查。

- 使用者經手動對齊後可開啟自動同步（樂觀版本鎖；衝突時停止；僅在網頁開啟期間工作）。可自行刪除單一產品的雲端備份，不動本機紀錄。
- [站內客服](assets/cloud.js) 已串私人 support_tickets、replies；[Playwright 會員模擬測試](tests/cloud-smoke.mjs) 已覆蓋雲端備份、自動同步、客服與刪除，但正式帳號寄信／金流仍待真人驗證。
