# Chance 雲端資料庫

正式資料庫採用 Supabase project `unapiwajmgqqtdkixaab` 的獨立 `chance_` 前綴資料表，不讀取或變更 LINE 的 `so_`、標案的 `ti_` 等資料。

## 目前狀態

- `schema.sql` 已對應到已執行的非破壞式遷移，為資料庫結構留存及還原參考。
- `chance_documents`：每個 user ID + app slug 一份 JSON 備份，版本號用於避免更新時意外覆蓋。
- `chance_trial_requests`：登入者可提交及查看自己的試用申請，無權變更已建紀錄的 status；正式金流未整合。
- 公開前端只使用可公開的 Supabase publishable key，嚴禁把 `service_role` / `sb_secret_` 寫入 GitHub 或客戶網頁。
- 表格均使用 RLS，匿名使用者沒有讀寫許可，權限僅依 Auth 身分與 user_id 比對。

## 對外營運前的配置檢查

1. Supabase Dashboard → Auth → Email：確認寄信服務與確認信到達率；OTP 登入請調整郵件模板，讓信內顯示驗證碼。
2. Auth → URL Configuration：加入正式網站域名與必要的跳轉網址，避免登入確認跳轉到其他專案。
3. 以兩個**不同**真實測試帳號驗證資料隔離、登出、備份、上傳衝突；現階段尚未做真人端到端驗證。
4. 正式上線前改用專用網域和專用 Auth 專案更佳，同網域的不同 GitHub Pages 專案共用瀏覽器 origin。
5. 完成金流供應商合約、伺服器端 webhook 驗簽、收款及退款紀錄，才能啟用真正付費方案。
6. 個資告知、保存期限、資料刪除、人工客服、資安監控與例行備份需依實際營運情境完成。

**不要將收到「申請付費試用」誤判為已付款。**
