# 經濟知識王｜Supply and Demand

以 Phaser 4.2.1 製作的高職經濟學遊戲式學習專案。第一個主題是供給、需求與市場均衡。

## 啟動

安裝 Node.js 20.19+ 或 22.12+，在專案根目錄執行 pnpm install，接著執行 pnpm dev。

Vite 網頁預設使用 port 5173，房間 WebSocket 伺服器使用 port 3001。教師與學生裝置連到同一個 Wi-Fi 後，教師在瀏覽器開啟電腦的區域網路位址，學生使用相同位址及 port 5173 加入。房間和匿名玩家的金幣、道具資料保存在 server/data/profiles.json。

## MVP 內容

- 單人對電腦：同題作答、模擬對手、速度加分、連勝倍率和勝利金幣。
- 全班連線：教師建立六位數房間代碼、學生用手機加入、同步計時、伺服器計分及金幣結算。
- 自由練習：不限時作答，每題立即顯示答案與解析。
- 道具商店：提示、延長時間、分數加倍、答錯修正及防偷護盾。
- 三道供需均衡示範題。簡單 25 題、適中 20 題、困難 10 題是後續正式題庫目標。

## Apps Script 題庫 API

- API 網址設定在 `src/game/services/questionBank.js`。單人／自由練習會在開始時用 JSONP 讀取題目；連線伺服器會在啟動時讀取同一個 API。API 無法連線時，遊戲會退回內建示範題。
- Apps Script API 只提供題目、選項與圖表；遊戲用 `src/game/data/questions.js` 依題目 ID 和完全相同的選項順序補上正確答案與解析。沒有相符答案資料的題目會略過。
- 目前三道示範題已與 API 對應。新增題目或更改選項順序前，須同步提供遊戲端答案資料，否則該題不會進入遊戲。
- 若建立新的 Apps Script 部署網址，請更新 `src/game/services/questionBank.js` 的 `QUESTION_API_URL`。

目前房間伺服器僅適合本機和同一區域網路的課堂試玩；正式部署時需要配合可公開連線的 WebSocket 主機。

## GitHub Pages

- 公開遊戲網址：<https://zxc123456789-kai.github.io/supply-demand-quiz-game/>
- 推送到 `main` 分支後，GitHub Actions 會執行 `pnpm build` 並部署 `dist/`。
- GitHub Pages 版支援單人挑戰與自由練習；全班連線需要另外部署 WebSocket 伺服器，尚未連接到這個靜態網站。
- 玩家暱稱、金幣與道具保存在各自瀏覽器的 localStorage，不會同步到其他裝置。

## 專案文件與素材

- 遊戲企劃書：docs/game-plan.md
- 素材挑選紀錄：docs/asset-selection.md
- 素材來源與授權：ASSET-CREDITS.md
- Kenney UI Pack 和 Board Game Icons 素材位於 assets/images/；原始素材包與授權記錄位於 assets/downloads/。
