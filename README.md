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

## PWA 安裝與離線使用

本網站附有 Web App Manifest、192／512 像素圖示、maskable 圖示、Apple 主畫面圖示與 Service Worker，不需要建置。GitHub Pages 的 HTTPS 與 `/repair-system/` 子路徑均可使用。

- Android／電腦：用 Chrome 或 Edge 開啟網站，符合安裝條件時點選「安裝報修登記」，或使用瀏覽器的安裝選單。
- iPhone／iPad：使用 Safari 開啟網站，從分享選單選擇「加入主畫面」。
- 第一次須連線開啟並完成離線資源下載；之後可離線開啟畫面。報修清單與送出功能仍需網路，離線不會新增或自動重送資料。未送出的表單只保留在目前頁面，重新載入或關閉會遺失。
- 僅快取靜態畫面資源，不快取 Supabase API、報修內容或 POST。外部 Supabase CDN 離線時可能無法載入，頁面會顯示連線錯誤；恢復連線後重新整理即可使用。
- 更新靜態資源時同步遞增 `sw.js` 的快取版本。新版會等待舊頁面關閉再接手；更新後請關閉所有此網站分頁與已安裝視窗，再重新開啟。

PWA 驗證：在 `/workspace` 執行 `python -m http.server 8765 --bind 127.0.0.1`，再於專案目錄執行 `BASE_URL=http://127.0.0.1:8765/repair-system/ node tests/pwa.cjs`。此測試檢查子路徑、Chromium 安裝條件、圖示尺寸、離線重載與快取範圍。原有 `node tests/frontend.cjs` 仍用於驗證表單與清單。
