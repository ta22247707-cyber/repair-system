報修登記系統
提供同事新增報修資料並查看報修清單，集中記錄與追蹤問題。
雲端任務測試
雲端任務測試
[報修欄位表（Excel）](文件/報修欄位表.xlsx)

## 網頁使用與發佈

首頁為根目錄 `index.html`，以純 HTML、CSS、JavaScript 搭配 CDN 的 supabase-js v2 運作，不需建置。`config.js` 僅含公開網址與 publishable key；不得放入 secret 或 service_role 金鑰。使用前須在 Supabase 套用並確認 `supabase/schema.sql` 的欄位、GRANT 與 RLS 設定，本次前端開發不會執行 SQL。

本機預覽：在儲存庫根目錄執行 `python -m http.server 8000`，開啟 `http://localhost:8000`。表單新增時只提交 `reporter_name`、`location`、`category`、`description`、`urgency`；狀態與時間由資料庫產生。下方顯示最新 20 筆，時間以臺北時間顯示。所有內容公開，請僅填虛構資料。

GitHub Pages：在儲存庫 Settings → Pages 選擇 Deploy from a branch，分支 `main`、目錄 `/ (root)`。未設定自訂網域時，網址為 https://ta22247707-cyber.github.io/repair-system/ 。合併程式碼不代表 Pages 已啟用或部署完成。

## 前端驗證

最近報修上方提供「全部／高／中／低」緊急程度篩選，預設全部；選取的按鈕以深色背景與按下狀態標示。篩選僅針對網頁已讀取的最近 20 筆，不會新增資料庫請求，沒有符合項目時顯示提示；重新整理或新增成功後保留篩選選項。緊急程度為「高」的標籤使用紅字與淡紅背景。本次未變更資料庫、欄位、SQL 或 `supabase/` 資料夾。

語法檢查：`node --check app.js` 與 `node --check config.js`。瀏覽器測試需 Node.js、Playwright、Chromium 及上述本機伺服器，執行 `node tests/frontend.cjs`；可用 `CHROMIUM_PATH` 指定瀏覽器、`BASE_URL` 指定預覽網址、`SDK_PATH` 指定已下載的同版本 CDN 程式。本測試模擬 API，不會寫入真實資料庫。
