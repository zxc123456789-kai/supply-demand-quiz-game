import Phaser from "phaser";
import "./style.css";
import { DIFFICULTIES, QUESTIONS } from "./game/data/questions.js";
import { GraphScene } from "./game/scenes/GraphScene.js";
import { RoomClient } from "./game/services/RoomClient.js";
import { loadQuestionBankInBrowser } from "./game/services/questionBank.js";
import { calculateScore } from "./game/systems/scoring.js";
import { loadProfile, saveProfile, SHOP_ITEMS } from "./game/systems/profile.js";

const root = document.querySelector("#game-app");
const IS_GITHUB_PAGES_BUILD = import.meta.env.VITE_STATIC_PAGES === "true";
const IMAGE_ASSETS = import.meta.glob("/assets/images/**/*", { eager: true, query: "?url", import: "default" });
const LETTERS = ["A", "B", "C", "D"];
let profile = saveProfile(loadProfile());
let graphGame = null;
let localTimer = null;
let aiTimer = null;
let notice = "";
let noticeKind = "";
let connectionStatus = "連線尚未啟動";
let game = null;
let room = null;
let playerRole = "";
let activeQuestions = QUESTIONS;
let isStartingLocalMatch = false;

const roomClient = new RoomClient(handleRoomMessage, (status) => {
  connectionStatus = status === "open" ? "連線伺服器已連接" : "連線伺服器離線";
});

const state = {
  screen: "home",
  difficulty: "easy",
  mode: "",
  roomCode: "",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function button(action, label, className = "secondary-button", extra = "") {
  return '<button type="button" class="' + className + '" data-action="' + esc(action) + '" ' + extra + '>' + label + "</button>";
}

function image(src, alt = "", className = "") {
  const imageSrc = src.startsWith("/assets/images/")
    ? IMAGE_ASSETS[src] || import.meta.env.BASE_URL + src.slice(1)
    : src;
  return '<img src="' + esc(imageSrc) + '" alt="' + esc(alt) + '" class="' + esc(className) + '" loading="lazy">';
}

function coinBadge() {
  return '<span class="coin-display">' + image("/assets/images/kenney-board-game-icons/coin.png", "智慧金幣") + esc(profile.coins) + " 枚</span>";
}

function topbar() {
  return '<header class="topbar row-between"><a class="brand brand-link" href="#" data-action="home">SUPPLY QUEST・供需知識王</a><div class="row">' +
    coinBadge() + button("shop", "道具商店", "secondary-button") + "</div></header>";
}

function noticeBox() {
  if (!notice) return "";
  return '<p class="notice ' + (noticeKind === "error" ? "error" : noticeKind === "success" ? "success" : "") + '">' + esc(notice) + "</p>";
}

function page(title, subtitle, content, extraClass = "") {
  return '<div class="page ' + extraClass + '">' + topbar() + noticeBox() +
    '<section class="stack"><div class="stack"><div class="brand">經濟學・供給與需求</div><h2>' + esc(title) +
    '</h2><p class="muted">' + esc(subtitle) + "</p></div>" + content + "</section></div>";
}

function modeCard(action, icon, title, description) {
  return '<button type="button" class="mode-card" data-action="' + action + '">' +
    image(icon, "", "") + "<strong>" + title + "</strong><p>" + description + "</p></button>";
}

function renderHome() {
  const content =
    '<section class="hero"><div class="stack"><div class="brand">SUPPLY QUEST</div><h1>供需知識王</h1>' +
    '<p>看懂供給、需求與市場均衡。和電腦比速度、和同學一起競賽，或用自由練習一步步拆解圖表。</p>' +
    '<div class="button-row">' + button("difficulty-solo", "開始挑戰", "primary-button") + button("shop", "準備道具", "secondary-button") + "</div></div>" +
    '<div class="hero-art"><div class="hero-badge">' + image("/assets/images/kenney-board-game-icons/winner-crown.png", "冠軍皇冠") + "</div></div></section>" +
    '<div class="row-between"><div><h2>選擇遊戲模式</h2><p class="muted small">每種模式先提供三道示範題，正式題庫將在下一階段擴充。</p></div>' + coinBadge() + "</div>" +
    '<div class="mode-grid">' +
    modeCard("difficulty-solo", "/assets/images/kenney-board-game-icons/timer-hourglass.png", "單人對電腦", "和模擬對手回答相同題目。答得又快又對，就能拿下勝利金幣。") +
    modeCard("class-options", "/assets/images/kenney-board-game-icons/winner-crown.png", "全班連線競賽", "老師建立房間、學生用手機加入，同步作答並依成績排名。") +
    modeCard("difficulty-practice", "/assets/images/kenney-board-game-icons/hint-book.png", "自由練習", "不限時作答，每題立刻看正解、供需圖和解題說明。") +
    '</div><p class="muted small">匿名玩家資料僅儲存在這個瀏覽器；連線競賽需在同一個 Wi-Fi 網路使用。</p>';
  root.innerHTML = page("準備好了嗎？", "用圖表認識均衡，用競賽練習經濟學判讀。", content);
}

function renderDifficulty() {
  const cards = Object.values(DIFFICULTIES).map((item) =>
    '<button type="button" class="difficulty-card" data-action="start-local" data-difficulty="' + item.id + '">' +
    '<span class="pill">' + item.label + "</span><strong>" + item.description + "</strong><p>每題 " +
    item.secondsPerQuestion + ' 秒・正式版本 ' + item.targetQuestions + ' 題</p><p class="cyan small">MVP 示範題：' + activeQuestions.length + ' 題</p></button>'
  ).join("");
  const title = state.mode === "practice" ? "選擇練習難度" : "選擇挑戰難度";
  root.innerHTML = page(title, "先以示範題體驗三種難度；每種難度的正式題數保留在企劃中。", '<div class="difficulty-grid">' + cards + "</div>" + button("home", "回到模式選單"), "difficulty-page");
}

function renderClassOptions() {
  if (IS_GITHUB_PAGES_BUILD) {
    const content = '<section class="panel stack"><h3>此版本尚未連接教室伺服器</h3>' +
      '<p class="muted">GitHub Pages 提供靜態網站；全班連線競賽需要另外部署 WebSocket 伺服器。</p>' +
      button("home", "回到模式選單") + "</section>";
    root.innerHTML = page("全班連線競賽", "教室模式需要獨立的即時連線服務。", content);
    return;
  }

  const content = '<div class="mode-grid">' +
    '<section class="panel stack"><h3>教師建立房間</h3><p class="muted">選好難度並建立房間，將六位數代碼投影給學生。</p>' +
    '<form data-form="create-room" class="stack"><div class="field"><label for="host-name">主持人暱稱</label><input id="host-name" name="nickname" maxlength="16" value="' + esc(profile.nickname) + '" required></div>' +
    '<div class="field"><label for="host-difficulty">比賽難度</label><select id="host-difficulty" name="difficulty">' +
    Object.values(DIFFICULTIES).map((item) => '<option value="' + item.id + '">' + item.label + "・" + item.secondsPerQuestion + " 秒</option>").join("") +
    '</select></div><button class="primary-button" type="submit">建立教室房間</button></form></section>' +
    '<section class="panel stack"><h3>學生加入房間</h3><p class="muted">輸入投影畫面上的代碼與暱稱。</p>' +
    '<form data-form="join-room" class="stack"><div class="field"><label for="join-code">六位數房間代碼</label><input id="join-code" name="code" maxlength="6" autocomplete="off" required></div>' +
    '<div class="field"><label for="join-name">玩家暱稱</label><input id="join-name" name="nickname" maxlength="16" value="' + esc(profile.nickname) + '" required></div>' +
    '<button class="primary-button" type="submit">加入比賽</button></form></section></div>' +
    '<p class="notice">連線模式需要先執行專案伺服器，教師與學生的裝置要連上同一個 Wi-Fi。</p>' +
    button("home", "回到模式選單");
  root.innerHTML = page("全班連線競賽", "主持人建立教室，學生用手機加入同一場比賽。", content);
}

function renderLobby(isHost) {
  const players = room && room.players ? room.players : [];
  const playersMarkup = players.length
    ? '<div class="player-list">' + players.map((player) => '<div class="player-chip">' + esc(player.nickname) + "</div>").join("") + "</div>"
    : '<p class="muted">還沒有學生加入。</p>';
  const startButton = isHost
    ? button("start-room", players.length ? "開始比賽" : "等待學生加入", "primary-button", players.length ? "" : "disabled")
    : '<p class="notice">請先留在此頁面，主持人開始後會自動進入答題。</p>';
  const content = '<div class="panel stack center"><div class="brand">' + (isHost ? "教師投影畫面" : "學生候場") + "</div>" +
    '<div class="large-code">' + esc(room ? room.code : state.roomCode) + "</div><p>讓學生輸入上方房間代碼加入</p>" +
    '<div class="row-between"><h3>已加入玩家</h3><span class="pill">' + players.length + " 人・" + (room ? DIFFICULTIES[room.difficulty].label : "") + "</span></div>" +
    playersMarkup + startButton + button("leave-room", "離開房間") + "</div>";
  root.innerHTML = page("比賽大廳", "同步題目會在主持人開始後出現。", content);
}

function renderShop() {
  const cards = Object.values(SHOP_ITEMS).map((item) =>
    '<article class="shop-card"><div class="shop-icon">' + image(item.icon, item.label) + '</div><div class="shop-copy"><h3>' +
    esc(item.label) + '</h3><p class="muted small">' + esc(item.description) + '</p><p class="gold">持有 ' +
    esc(profile.items[item.id] || 0) + " ・ " + item.price + " 枚金幣</p></div>" +
    button("buy-item", "購買", "primary-button", 'data-item="' + item.id + '"') + "</article>"
  ).join("");
  root.innerHTML = page("智慧金幣商店", "金幣可用來購買提示、加時、加倍、修正與防偷道具。", '<div class="shop-grid">' + cards + '</div><p class="notice">第一次遊玩提供 10 枚起始金幣。單人獲勝可得 5 枚；全班賽依排名轉移金幣。</p>' + button("home", "回到模式選單"));
}

function renderLocalMatch() {
  const question = activeQuestions[game.index];
  const difficulty = DIFFICULTIES[game.difficulty];
  const modeLabel = game.mode === "practice" ? "自由練習" : "單人對電腦";
  const timeText = game.mode === "practice" ? "不限時" : '<span id="timer-value">' + Math.ceil(game.remainingMs / 1000) + "</span> 秒";
  const historyResult = game.roundResult;
  const answers = question.options.map((option, index) => {
    const isHidden = game.hiddenIndices.includes(index);
    const selected = game.selectedIndex === index;
    const isCorrect = historyResult && historyResult.correctIndex === index;
    const className = "answer-button" + (isHidden ? " is-hidden" : "") + (isCorrect ? " answer-correct" : selected && historyResult ? " answer-wrong" : "");
    return '<button type="button" class="' + className + '" data-action="answer-local" data-index="' + index + '" ' +
      ((isHidden || historyResult || game.waiting) ? "disabled" : "") + '><span class="answer-letter">' + LETTERS[index] + "</span><span>" +
      esc(option) + "</span></button>";
  }).join("");
  let feedback = "";
  if (historyResult) {
    const playerStatus = game.mode === "practice"
      ? (historyResult.correct ? "答對了！" : "再看看正解與解析。")
      : (historyResult.correct ? "你答對了，獲得 " + historyResult.points + " 分。" : "這題沒有得分。");
    feedback = '<div class="notice ' + (historyResult.correct ? "success" : "") + '"><strong>' + playerStatus + "</strong><br>" +
      "正確答案：" + esc(question.options[historyResult.correctIndex]) +
      (game.mode === "solo" ? "<br>電腦選擇：" + (historyResult.opponentIndex === null ? "逾時未答" : esc(question.options[historyResult.opponentIndex])) +
        "・目前比分 " + game.score + " : " + game.opponentScore : "") + "<br>" + esc(question.explanation) + "</div>";
  } else if (game.mode === "solo" && game.waiting) {
    feedback = '<p class="notice">答案已送出，等待電腦完成作答…</p>';
  } else if (game.retryDue) {
    feedback = '<p class="notice">答錯了，已使用答錯修正，請再選一次。</p>';
  } else {
    feedback = '<p class="answer-state">' + (game.mode === "practice" ? "選擇答案後立即查看解析。" : game.cpuAnswered ? "電腦已完成作答，輪到你了。" : "你與電腦正在回答同一題。") + "</p>";
  }
  const tools = ["hint", "extraTime", "double", "correction"].map((id) => {
    const item = SHOP_ITEMS[id];
    return button("use-local-item", esc(item.label) + " (" + esc(profile.items[id] || 0) + ")", "tool-button", 'data-item="' + id + '"' + ((historyResult || game.waiting || !profile.items[id]) ? " disabled" : ""));
  }).join("");
  const progress = Math.round(((game.index + 1) / activeQuestions.length) * 100);
  const content = '<div class="row-between match-header"><span class="pill">' + modeLabel + "・" + difficulty.label + '</span><span class="timer">第 ' +
    (game.index + 1) + " / " + activeQuestions.length + " 題・" + timeText + "</span></div>" +
    '<div class="progress-track"><span style="width:' + progress + '%"></span></div>' +
    '<section class="panel question-panel"><div class="question-copy"><div class="question-meta"><span class="pill">' + esc(question.skill) +
    '</span><span class="pill">連勝 ' + game.streak + '</span><span class="pill">分數 ' + game.score + '</span></div>' +
    "<h2>" + esc(question.prompt) + '</h2><div class="answer-grid">' + answers + "</div>" + feedback +
    '<div class="button-row item-row">' + tools + '</div></div><div class="graph-card"><div class="row-between"><strong>供需圖</strong><span class="muted small">價格 P・數量 Q</span></div><div id="graph-stage"></div></div></section>' +
    button(historyResult ? "next-local" : "leave-local", historyResult ? (game.index === activeQuestions.length - 1 ? "查看本場結果" : "下一題") : "結束挑戰", historyResult ? "primary-button" : "secondary-button");
  root.innerHTML = page("答題時間", "快看圖表，選出最符合供需變化的答案。", content, "match-page");
  mountGraph(question);
}

function renderClassMatch(isHostProjection = false) {
  const result = game.classRoundResult;
  const question = game.roomQuestion || activeQuestions[0];
  const itemRow = isHostProjection ? "" : '<div class="button-row item-row">' +
    ["hint", "extraTime", "double"].map((id) => button(
      "use-room-item",
      esc(SHOP_ITEMS[id].label) + " (" + esc(profile.items[id] || 0) + ")",
      "tool-button",
      'data-item="' + id + '"' + ((game.classAnswered || game.classExpired || !profile.items[id]) ? " disabled" : "")
    )).join("") + "</div>";
  const answers = question.options.map((option, index) => {
    const hidden = game.hiddenIndices && game.hiddenIndices.includes(index);
    const correct = result && result.correctIndex === index;
    const selected = game.selectedIndex === index;
    const cls = "answer-button" + (hidden ? " is-hidden" : "") + (correct ? " answer-correct" : selected && result ? " answer-wrong" : "");
    return '<button type="button" class="' + cls + '" data-action="answer-room" data-index="' + index + '" ' +
      ((hidden || game.classAnswered || game.classExpired || result || isHostProjection) ? "disabled" : "") + '><span class="answer-letter">' + LETTERS[index] + "</span><span>" + esc(option) + "</span></button>";
  }).join("");
  let feedback = "";
  if (result) {
    const own = result.answers.find((answer) => answer.playerId === profile.playerId);
    feedback = '<div class="notice ' + (own && own.correct ? "success" : "") + '">' +
      (own ? (own.correct ? "答對，本題 +" + own.points + " 分。" : own.timedOut ? "時間到，尚未作答。" : "這題沒有得分。") : "本題作答結束。") +
      "<br>" + esc(question.explanation) + "</div>";
  } else if (game.answerMessage) {
    feedback = '<p class="notice">' + esc(game.answerMessage) + "</p>";
  } else if (isHostProjection) {
    feedback = '<p class="notice">學生在自己的手機上作答；投影畫面會同步顯示已加入人數與排行榜。</p>';
  } else {
    feedback = '<p class="answer-state">作答後會等待全班完成，再一起查看正解。</p>';
  }
  const ranks = room && room.players ? room.players.slice().sort((a, b) => b.score - a.score).slice(0, 8) : [];
  const rankPanel = '<div class="scoreboard">' + (ranks.length ? ranks.map((player, index) =>
    '<div class="score-row"><span class="rank">#' + (index + 1) + "</span><strong>" + esc(player.nickname) + '</strong><span class="score">' + player.score + "</span></div>"
  ).join("") : '<p class="muted">等待玩家加入…</p>') + "</div>";
  const remaining = game.deadline ? Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000)) : 0;
  const content = '<div class="row-between"><span class="pill">房間 ' + esc(state.roomCode) + '</span><span class="timer">第 ' +
    ((game.roomQuestionIndex || 0) + 1) + " / " + (game.roomTotal || activeQuestions.length) + " 題・" + (result ? "本題結束" : '<span id="room-timer-value">' + remaining + "</span> 秒") + "</span></div>" +
    '<section class="panel question-panel"><div class="question-copy"><div class="question-meta"><span class="pill">' + esc(question.skill) +
    '</span><span class="pill">' + esc(DIFFICULTIES[room ? room.difficulty : state.difficulty].label) + "</span></div><h2>" + esc(question.prompt) +
    '</h2><div class="answer-grid">' + answers + "</div>" + feedback + itemRow + "</div>" +
    '<div class="stack"><div class="graph-card"><div class="row-between"><strong>供需圖</strong><span class="muted small">即時同步</span></div><div id="graph-stage"></div></div>' +
    '<div class="panel stack"><div class="row-between"><h3>排行榜</h3><span class="pill">' + (room ? room.players.length : 0) + " 人</span></div>" + rankPanel + "</div></div></section>" +
    (isHostProjection ? button("leave-room", "結束投影") : button("leave-room", "離開比賽"));
  root.innerHTML = page(isHostProjection ? "教室投影" : "全班同步作答", "老師主持、學生手機作答；本次先使用三道示範題。", content, "match-page");
  mountGraph(question);
}

function renderResults() {
  const localHistory = game && game.history ? game.history : [];
  const rankings = game && game.rankings ? game.rankings : [];
  const localWins = game && game.mode === "solo" && game.score > game.opponentScore;
  const resultTitle = game && game.mode === "practice" ? "練習完成" : localWins ? "挑戰勝利！" : "本場結束";
  const resultSummary = game && game.mode === "class"
    ? '<p class="notice">本場金幣獎池：' + (game.pool || 0) + " 枚</p>"
    : game && game.mode === "solo"
      ? '<p class="notice">你的得分 ' + game.score + "・電腦 " + game.opponentScore + (localWins ? "・獲勝獎勵 +5 金幣" : "") + "</p>"
      : '<p class="notice">自由練習不計勝負，也不發放金幣。</p>';
  const rankMarkup = rankings.length ? '<div class="scoreboard">' + rankings.map((entry) =>
    '<div class="score-row"><span class="rank">#' + entry.rank + "</span><strong>" + esc(entry.nickname) + '</strong><span class="score">' +
    entry.score + " 分・" + (entry.coins ?? 0) + " 枚</span></div>"
  ).join("") + "</div>" : "";
  const review = localHistory.length ? localHistory.map((entry, index) =>
    '<article class="review-item"><div class="row-between"><strong>第 ' + (index + 1) + " 題・" + esc(entry.question.skill) +
    '</strong><span class="' + (entry.viewerDidNotAnswer || entry.correct ? "cyan" : "muted") + '">' +
    (entry.viewerDidNotAnswer ? "主持人回顧" : entry.correct ? "答對" : "未答對") + "</span></div><p>" +
    esc(entry.question.explanation) + "</p></article>"
  ).join("") : "";
  const content = '<div class="panel stack center"><div class="hero-badge result-badge">' +
    image("/assets/images/kenney-board-game-icons/winner-crown.png", "結算") + "</div><h2>" + resultTitle +
    "</h2>" + resultSummary + "</div>" + (rankMarkup ? '<section class="panel stack"><h3>比賽排名</h3>' + rankMarkup + "</section>" : "") +
    (review ? '<section class="panel stack"><h3>逐題回顧</h3><div class="review-list">' + review + "</div></section>" : "") +
    '<div class="button-row">' + button("home", "回到模式選單", "primary-button") + button("shop", "前往商店", "secondary-button") + "</div>";
  root.innerHTML = page("結算畫面", "每題結果都附有供需圖解讀與學習回饋。", content);
}

function render() {
  if (state.screen !== "localMatch" && state.screen !== "classMatch" && state.screen !== "hostProjection") {
    if (graphGame) {
      graphGame.destroy(true);
      graphGame = null;
    }
  }
  switch (state.screen) {
    case "difficulty": renderDifficulty(); break;
    case "classOptions": renderClassOptions(); break;
    case "hostLobby": renderLobby(true); break;
    case "studentLobby": renderLobby(false); break;
    case "localMatch": renderLocalMatch(); break;
    case "classMatch": renderClassMatch(false); break;
    case "hostProjection": renderClassMatch(true); break;
    case "results": renderResults(); break;
    case "shop": renderShop(); break;
    default: renderHome();
  }
}

function mountGraph(question) {
  window.__currentGraphQuestion = question;
  const stage = document.getElementById("graph-stage");
  if (!stage) return;
  if (graphGame) {
    if (graphGame.canvas && graphGame.canvas.parentElement !== stage) stage.appendChild(graphGame.canvas);
    if (stage.clientWidth > 0 && stage.clientHeight > 0) graphGame.scale.resize(stage.clientWidth, stage.clientHeight);
    window.dispatchEvent(new CustomEvent("phaser-graph-question", { detail: question }));
    return;
  }
  graphGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 320,
    parent: "graph-stage",
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE, parent: "graph-stage", width: 800, height: 320 },
    render: { antialias: true, roundPixels: false },
    scene: [GraphScene],
  });
}

function clearLocalTimers() {
  if (localTimer) window.clearInterval(localTimer);
  if (aiTimer) window.clearTimeout(aiTimer);
  localTimer = null;
  aiTimer = null;
}

async function startLocalMatch(mode, difficulty) {
  if (isStartingLocalMatch) return;
  isStartingLocalMatch = true;
  clearLocalTimers();
  state.mode = mode;
  state.difficulty = difficulty;
  notice = "正在載入課程題庫…";
  noticeKind = "";
  render();

  const questionBank = await loadQuestionBankInBrowser(QUESTIONS);
  activeQuestions = questionBank.questions;
  if (!activeQuestions.length) {
    notice = "題庫目前沒有可用題目，請確認試算表中有啟用且具備本機答案資料的題目。";
    noticeKind = "error";
    isStartingLocalMatch = false;
    render();
    return;
  }
  if (questionBank.source === "local") {
    notice = "題庫 API 暫時無法使用，已改用內建示範題。";
    noticeKind = "";
  } else if (questionBank.skipped > 0) {
    notice = "題庫有 " + questionBank.skipped + " 題缺少相符的本機答案資料，暫時略過。";
    noticeKind = "";
  } else {
    notice = "";
    noticeKind = "";
  }

  game = {
    mode,
    difficulty,
    index: 0,
    score: 0,
    opponentScore: 0,
    streak: 0,
    history: [],
    hiddenIndices: [],
    selectedIndex: null,
    roundResult: null,
    waiting: false,
    retryDue: false,
    retryUsed: false,
    doubleNext: false,
  };
  state.screen = "localMatch";
  isStartingLocalMatch = false;
  startLocalRound();
}

function startLocalRound() {
  clearLocalTimers();
  game.roundResult = null;
  game.selectedIndex = null;
  game.opponentIndex = null;
  game.opponentAnswered = false;
  game.cpuAnswered = false;
  game.waiting = false;
  game.retryDue = false;
  game.retryUsed = false;
  game.extraTimeUsed = false;
  game.hiddenIndices = [];
  game.expired = false;
  game.startedAt = Date.now();
  game.timeLimitMs = DIFFICULTIES[game.difficulty].secondsPerQuestion * 1000;
  game.remainingMs = game.mode === "practice" ? 0 : game.timeLimitMs;
  render();

  if (game.mode === "solo") {
    const accuracy = game.difficulty === "easy" ? 0.62 : game.difficulty === "medium" ? 0.73 : 0.82;
    const correct = Math.random() < accuracy;
    const correctIndex = activeQuestions[game.index].correctIndex;
    const wrongOptions = activeQuestions[game.index].options.map((_, index) => index).filter((index) => index !== correctIndex);
    const answerIndex = correct ? correctIndex : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
    const delay = Math.floor(game.timeLimitMs * (0.35 + Math.random() * 0.4));
    aiTimer = window.setTimeout(() => {
      game.opponentIndex = answerIndex;
      game.cpuAnswered = true;
      const correctAnswer = answerIndex === activeQuestions[game.index].correctIndex;
      if (correctAnswer) {
        const scored = calculateScore({ correct: true, elapsedMs: delay, timeLimitMs: game.timeLimitMs, streak: game.opponentStreak || 0 });
        game.opponentScore += scored.score;
        game.opponentStreak = scored.streak;
      } else {
        game.opponentStreak = 0;
      }
      checkLocalRoundEnd();
      if (!game.roundResult) render();
    }, delay);
  }

  if (game.mode !== "practice") {
    localTimer = window.setInterval(tickLocalTimer, 200);
    updateTimerDisplay();
  }
}

function tickLocalTimer() {
  if (!game || game.mode === "practice" || game.roundResult) return;
  game.remainingMs = Math.max(0, game.timeLimitMs - (Date.now() - game.startedAt));
  updateTimerDisplay();
  if (game.remainingMs <= 0) {
    game.expired = true;
    if (game.mode === "solo" && !game.cpuAnswered) {
      game.cpuAnswered = true;
      game.opponentIndex = null;
    }
    if (game.selectedIndex === null) game.selectedIndex = null;
    checkLocalRoundEnd();
  }
}

function updateTimerDisplay() {
  const timer = document.querySelector("#timer-value");
  if (timer && game) timer.textContent = String(Math.ceil(game.remainingMs / 1000));
}

function updateRoomTimer() {
  if (!game || !game.deadline || game.classRoundResult) return;
  const remaining = Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000));
  const timer = document.querySelector("#room-timer-value");
  if (timer) timer.textContent = String(remaining);
  if (remaining === 0 && !game.classExpired) {
    game.classExpired = true;
    document.querySelectorAll('[data-action="answer-room"], [data-action="use-room-item"]').forEach((control) => { control.disabled = true; });
  }
}

function answerLocal(index) {
  if (!game || game.roundResult || game.waiting || game.remainingMs <= 0 && game.mode !== "practice") return;
  const question = activeQuestions[game.index];
  const correct = index === question.correctIndex;
  if (!correct && game.mode !== "practice" && !game.retryUsed && profile.items.correction > 0) {
    useInventory("correction");
    game.retryUsed = true;
    game.retryDue = true;
    game.selectedIndex = null;
    notice = "已消耗一個答錯修正道具，這題還可以再選一次。";
    noticeKind = "";
    render();
    return;
  }
  game.selectedIndex = index;
  if (game.mode === "practice") {
    game.roundResult = { correctIndex: question.correctIndex, correct, points: 0, selectedIndex: index };
    game.history.push({ question, correct, selectedIndex: index });
    render();
    return;
  }
  game.retryWasUsed = game.retryDue;
  game.retryDue = false;
  game.waiting = true;
  game.playerElapsedMs = Math.min(game.timeLimitMs, Date.now() - game.startedAt);
  if (game.mode === "solo") {
    render();
    checkLocalRoundEnd();
  } else {
    render();
  }
}

function checkLocalRoundEnd() {
  if (!game || game.mode !== "solo" || game.roundResult) return;
  const playerDone = game.waiting || game.expired;
  if (!playerDone || !game.cpuAnswered) return;

  const question = activeQuestions[game.index];
  const correct = game.selectedIndex !== null && game.selectedIndex === question.correctIndex;
  const playerScore = calculateScore({
    correct,
    elapsedMs: game.playerElapsedMs ?? game.timeLimitMs,
    timeLimitMs: game.timeLimitMs,
    streak: game.streak,
    doubled: game.doubleNext,
  });
  const points = correct && game.retryWasUsed ? Math.floor(playerScore.score / 2) : playerScore.score;
  game.score += points;
  game.streak = game.retryWasUsed ? 0 : playerScore.streak;
  game.doubleNext = false;
  game.roundResult = {
    correctIndex: question.correctIndex,
    correct,
    points,
    selectedIndex: game.selectedIndex,
    opponentIndex: game.opponentIndex,
  };
  game.history.push({ question, correct, selectedIndex: game.selectedIndex });
  clearLocalTimers();
  render();
}

function nextLocalRound() {
  if (game.index + 1 < activeQuestions.length) {
    game.index += 1;
    startLocalRound();
    return;
  }
  if (game.mode === "solo" && game.score > game.opponentScore && !game.rewarded) {
    game.rewarded = true;
    if (!roomClient.send("profile:solo-win")) {
      profile.coins += 5;
      saveProfile(profile);
    }
  }
  state.screen = "results";
  render();
}

function useInventory(itemId) {
  if (!profile.items[itemId] || profile.items[itemId] < 1) {
    notice = "沒有這個道具，請先到智慧金幣商店購買。";
    noticeKind = "error";
    render();
    return false;
  }
  profile.items[itemId] -= 1;
  profile = saveProfile(profile);
  roomClient.send("profile:consume", { item: itemId });
  return true;
}

function useLocalItem(itemId) {
  if (!game || game.roundResult || game.waiting) return;
  if (itemId === "hint") {
    if (!useInventory(itemId)) return;
    const correct = activeQuestions[game.index].correctIndex;
    game.hiddenIndices = activeQuestions[game.index].options.map((_, index) => index).filter((index) => index !== correct).slice(0, 2);
    notice = "提示已啟用，已排除兩個錯誤選項。";
  } else if (itemId === "extraTime") {
    if (game.extraTimeUsed) return;
    if (!useInventory(itemId)) return;
    game.extraTimeUsed = true;
    game.timeLimitMs += 5000;
    game.remainingMs += 5000;
    notice = "本題延長 5 秒。";
  } else if (itemId === "double") {
    if (!useInventory(itemId)) return;
    game.doubleNext = true;
    notice = "分數加倍已啟用，答對本題可獲得雙倍分數。";
  } else if (itemId === "correction") {
    notice = "答錯修正會在本題第一次答錯時自動使用。";
    noticeKind = "";
  }
  if (itemId !== "correction") noticeKind = "success";
  render();
}

async function ensureRoomConnection() {
  try {
    await roomClient.connect();
    roomClient.send("profile:hello", { playerId: profile.playerId, nickname: profile.nickname });
    return true;
  } catch {
    connectionStatus = "連線伺服器離線";
    notice = "連線伺服器目前無法連接。請先執行 pnpm dev，再重新加入房間。";
    noticeKind = "error";
    render();
    return false;
  }
}

function handleRoomMessage(message) {
  if (message.profile) {
    profile = saveProfile(message.profile);
    if (message.message) {
      notice = message.message;
      noticeKind = "success";
    }
  }

  switch (message.type) {
    case "profile:sync":
      render();
      break;
    case "room:created":
    case "room:joined":
      room = message.room;
      state.roomCode = room.code;
      game = { mode: "class", difficulty: room.difficulty, history: [], score: 0, opponentScore: 0 };
      playerRole = message.type === "room:created" ? "host" : "player";
      state.screen = playerRole === "host" ? "hostLobby" : "studentLobby";
      notice = playerRole === "host" ? "房間已建立，請把代碼投影給學生。" : "已加入房間，等待主持人開始。";
      noticeKind = "success";
      break;
    case "room:state":
      room = message.room;
      if (state.screen === "hostLobby") renderLobby(true);
      else if (state.screen === "studentLobby") renderLobby(false);
      else if (state.screen === "classMatch" || state.screen === "hostProjection") render();
      break;
    case "match:question":
      if (localTimer) window.clearInterval(localTimer);
      game.roomQuestion = message.question;
      game.roomQuestionIndex = message.index;
      game.roomTotal = message.total;
      game.deadline = message.deadline;
      game.classAnswered = false;
      game.classExpired = false;
      game.classRoundResult = null;
      game.selectedIndex = null;
      game.hiddenIndices = [];
      game.answerMessage = "";
      state.screen = playerRole === "host" ? "hostProjection" : "classMatch";
      render();
      localTimer = window.setInterval(updateRoomTimer, 250);
      break;
    case "match:answer-status":
      game.classAnswered = true;
      game.answerMessage = message.message;
      render();
      break;
    case "match:retry":
      game.classAnswered = false;
      game.answerMessage = message.message;
      render();
      break;
    case "match:item-result":
      game.hiddenIndices = message.hiddenIndices || game.hiddenIndices;
      game.answerMessage = message.message;
      render();
      break;
    case "match:time-extended":
      game.deadline = message.deadline;
      game.answerMessage = message.usedBy + " 使用了延長時間，全房間增加 5 秒。";
      render();
      break;
    case "match:round-result": {
      if (localTimer) window.clearInterval(localTimer);
      localTimer = null;
      game.classRoundResult = message;
      const ownAnswer = message.answers.find((answer) => answer.playerId === profile.playerId);
      game.history.push({
        question: { ...message.question, explanation: message.explanation },
        correct: Boolean(ownAnswer && ownAnswer.correct),
        selectedIndex: ownAnswer ? ownAnswer.selectedIndex : null,
        viewerDidNotAnswer: playerRole === "host",
      });
      room.players = message.rankings.map((entry) => ({ ...entry, answered: true }));
      render();
      break;
    }
    case "match:finished": {
      if (localTimer) window.clearInterval(localTimer);
      localTimer = null;
      game.rankings = message.rankings;
      game.pool = message.pool;
      game.transfers = message.transfers;
      if (message.profile) profile = saveProfile(message.profile);
      state.screen = "results";
      render();
      break;
    }
    case "room:closed":
      clearLocalTimers();
      room = null;
      game = null;
      state.roomCode = "";
      state.screen = "classOptions";
      notice = message.message;
      noticeKind = "error";
      render();
      break;
    case "server:error":
      notice = message.message;
      noticeKind = "error";
      render();
      break;
    default:
      break;
  }
}

function buyItem(itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return;
  if (profile.coins < item.price) {
    notice = "智慧金幣不足，先完成挑戰或參加班級比賽吧。";
    noticeKind = "error";
    render();
    return;
  }
  if (roomClient.send("profile:purchase", { item: itemId })) {
    notice = "正在更新商店資料…";
    noticeKind = "";
    render();
    return;
  }
  profile.coins -= item.price;
  profile.items[itemId] += 1;
  profile = saveProfile(profile);
  notice = "已購買「" + item.label + "」。";
  noticeKind = "success";
  render();
}

function leaveRoom() {
  roomClient.send("room:leave");
  clearLocalTimers();
  room = null;
  game = null;
  state.roomCode = "";
  state.screen = "classOptions";
  notice = "已離開房間。";
  noticeKind = "";
  render();
}

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  notice = "";
  noticeKind = "";

  if (action === "home") {
    if (state.roomCode) roomClient.send("room:leave");
    clearLocalTimers();
    room = null;
    game = null;
    state.screen = "home";
    state.roomCode = "";
    render();
  } else if (action === "difficulty-solo" || action === "difficulty-practice") {
    state.mode = action.endsWith("practice") ? "practice" : "solo";
    state.screen = "difficulty";
    render();
  } else if (action === "start-local") {
    await startLocalMatch(state.mode, target.dataset.difficulty);
  } else if (action === "class-options") {
    state.screen = "classOptions";
    render();
  } else if (action === "answer-local") {
    answerLocal(Number(target.dataset.index));
  } else if (action === "next-local") {
    nextLocalRound();
  } else if (action === "leave-local") {
    clearLocalTimers();
    state.screen = "home";
    render();
  } else if (action === "use-local-item") {
    useLocalItem(target.dataset.item);
  } else if (action === "use-room-item") {
    if (!roomClient.send("room:use-item", { item: target.dataset.item })) {
      notice = "連線已中斷，請重新加入房間。";
      noticeKind = "error";
      render();
    }
  } else if (action === "start-room") {
    roomClient.send("room:start");
  } else if (action === "leave-room") {
    leaveRoom();
  } else if (action === "shop") {
    state.screen = "shop";
    render();
  } else if (action === "buy-item") {
    buyItem(target.dataset.item);
  }
});

root.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  if (form.dataset.form === "create-room") {
    profile.nickname = String(formData.get("nickname") || "").trim().slice(0, 16);
    profile = saveProfile(profile);
    const difficulty = String(formData.get("difficulty") || "easy");
    state.difficulty = DIFFICULTIES[difficulty] ? difficulty : "easy";
    if (await ensureRoomConnection()) {
      playerRole = "host";
      roomClient.send("room:create", { nickname: profile.nickname, difficulty: state.difficulty });
    }
  } else if (form.dataset.form === "join-room") {
    profile.nickname = String(formData.get("nickname") || "").trim().slice(0, 16);
    profile = saveProfile(profile);
    if (!profile.nickname) {
      notice = "請輸入暱稱。";
      noticeKind = "error";
      render();
      return;
    }
    if (await ensureRoomConnection()) {
      playerRole = "player";
      roomClient.send("room:join", { code: String(formData.get("code") || "").trim().toUpperCase(), nickname: profile.nickname });
    }
  }
});

root.addEventListener("input", (event) => {
  if (event.target.id === "join-code") event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

root.addEventListener("click", (event) => {
  const answer = event.target.closest('[data-action="answer-room"]');
  if (!answer || game.classAnswered || game.classRoundResult || playerRole === "host") return;
  const sent = roomClient.send("room:answer", {
    index: Number(answer.dataset.index),
    roundIndex: game.roomQuestionIndex,
  });
  if (!sent) {
    notice = "連線已中斷，答案沒有送出。";
    noticeKind = "error";
    render();
  } else {
    game.selectedIndex = Number(answer.dataset.index);
    game.classAnswered = true;
    game.answerMessage = "答案已送出，等待全班完成。";
    render();
  }
});

window.addEventListener("beforeunload", () => {
  clearLocalTimers();
  if (graphGame) graphGame.destroy(true);
});

function connectProfile() {
  roomClient.connect().then(() => {
    roomClient.send("profile:hello", { playerId: profile.playerId, nickname: profile.nickname });
  }).catch(() => {
    connectionStatus = "連線伺服器離線";
  });
}

connectProfile();
render();
