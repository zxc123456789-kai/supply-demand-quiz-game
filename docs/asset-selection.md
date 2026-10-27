# 素材挑選紀錄

狀態：素材已挑選並匯入；尚未接入遊戲場景。  
設計方向：知識競賽節目感，優先確保手機作答與投影畫面易讀。

## 選用素材包

### Kenney UI Pack

- 官方頁面：[UI Pack](https://kenney.nl/assets/ui-pack)
- 官方頁標示授權：Creative Commons CC0。
- 原始 ZIP：assets/downloads/kenney-ui-pack.zip
- 執行素材：assets/images/kenney-ui-pack/
- 用途：彩色選項按鈕、勾叉回饋、連勝星星、進度條。
- 挑選理由：主色和四種選項色版適合做競賽按鈕；面板和大面積背景以 Phaser 圖形繪製，方便配合不同螢幕比例。

### Kenney Board Game Icons

- 官方頁面：[Board Game Icons](https://kenney.nl/assets/board-game-icons)
- 官方頁標示授權：Creative Commons CC0。
- 原始 ZIP：assets/downloads/kenney-board-game-icons.zip
- 執行素材：assets/images/kenney-board-game-icons/
- 用途：代幣、排行榜皇冠、計時沙漏、防偷盾牌、提示書本、答錯修正、金幣轉移與提示圖示。
- 挑選理由：圖示在競賽狀態和道具商店中有清楚的象徵用途；素材以單色為主，可用 Phaser 色調處理配合遊戲配色。

## 選取檔案

### UI Pack

| 專案檔案 | Kenney 原始路徑 | 用途 |
| --- | --- | --- |
| assets/images/kenney-ui-pack/buttons/answer-blue.png | PNG/Blue/Default/button_rectangle_depth_flat.png | 藍色選項按鈕 |
| assets/images/kenney-ui-pack/buttons/answer-red.png | PNG/Red/Default/button_rectangle_depth_flat.png | 紅色選項按鈕 |
| assets/images/kenney-ui-pack/buttons/answer-green.png | PNG/Green/Default/button_rectangle_depth_flat.png | 綠色選項按鈕 |
| assets/images/kenney-ui-pack/buttons/answer-yellow.png | PNG/Yellow/Default/button_rectangle_depth_flat.png | 黃色選項按鈕 |
| assets/images/kenney-ui-pack/icons/checkmark.png | PNG/Blue/Default/icon_checkmark.png | 答對標記 |
| assets/images/kenney-ui-pack/icons/cross.png | PNG/Blue/Default/icon_cross.png | 答錯標記 |
| assets/images/kenney-ui-pack/icons/streak-star.png | PNG/Blue/Default/star.png | 連勝或得分提示 |
| assets/images/kenney-ui-pack/icons/progress-track.png | PNG/Blue/Default/slide_horizontal_color.png | 題目進度或計時進度 |

### Board Game Icons

| 專案檔案 | Kenney 原始路徑 | 用途 |
| --- | --- | --- |
| assets/images/kenney-board-game-icons/coin.png | PNG/Default (64px)/token.png | 智慧金幣 |
| assets/images/kenney-board-game-icons/winner-crown.png | PNG/Default (64px)/crown_a.png | 排行榜冠軍 |
| assets/images/kenney-board-game-icons/timer-hourglass.png | PNG/Default (64px)/hourglass.png | 作答倒數 |
| assets/images/kenney-board-game-icons/anti-theft-shield.png | PNG/Default (64px)/shield.png | 防偷道具 |
| assets/images/kenney-board-game-icons/hint-book.png | PNG/Default (64px)/book_open.png | 提示道具 |
| assets/images/kenney-board-game-icons/answer-correction.png | PNG/Default (64px)/arrow_counterclockwise.png | 答錯修正 |
| assets/images/kenney-board-game-icons/coin-transfer.png | PNG/Default (64px)/token_give.png | 金幣轉移動畫 |
| assets/images/kenney-board-game-icons/coin-add.png | PNG/Default (64px)/token_add.png | 金幣增加 |
| assets/images/kenney-board-game-icons/coin-subtract.png | PNG/Default (64px)/token_subtract.png | 金幣扣除 |
| assets/images/kenney-board-game-icons/hint-question.png | PNG/Default (64px)/dice_question.png | 提示或問號狀態 |

## 配色、文字與自繪項目

- 選項按鈕使用 Kenney 藍、紅、綠、黃四種色版，並保留 A、B、C、D 文字標記，不單靠顏色傳達答案。
- 主要面板、競賽舞台、聚光燈、供需曲線、座標軸、均衡點與金幣外圈以 Phaser 圖形繪製。
- Board Game Icons 的圖示以白色單色輪廓為主，使用時可依按鈕背景套用色調；金幣本體以金黃色呈現。
- 繁體中文字型使用 Noto Sans TC、PingFang TC、Microsoft JhengHei、sans-serif 的 fallback 順序，不下載 Kenney 的英文字型。
- UI Pack 原始預覽圖已用於視覺檢視；手機與投影版型會在 MVP 階段實際確認。

## 來源與授權保存

- 兩個官方素材頁均標示 Creative Commons CC0。
- 原始壓縮檔及各包 License.txt 副本保留在 assets/downloads。
- 下載日期、檔案大小與 SHA-256 保存於各自的 .source.json。
- 專案素材來源總表見根目錄 ASSET-CREDITS.md。
