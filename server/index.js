import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { DIFFICULTIES, QUESTIONS as LOCAL_QUESTIONS, toPublicQuestion } from "../src/game/data/questions.js";
import { loadQuestionBankOnServer } from "../src/game/services/questionBank.js";
import { calculateScore, rankPlayers } from "../src/game/systems/scoring.js";
import { SHOP_ITEMS } from "../src/game/systems/profile.js";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const profilesFile = path.join(dataDirectory, "profiles.json");
const PORT = Number(process.env.PORT || 3001);
const WEB_PORT = Number(process.env.WEB_PORT || 5173);
let QUESTIONS = LOCAL_QUESTIONS;
let DEMO_ROUNDS = QUESTIONS.length;
const STARTING_COINS = 10;
const profiles = new Map();
const rooms = new Map();

mkdirSync(dataDirectory, { recursive: true });
try {
  const saved = JSON.parse(readFileSync(profilesFile, "utf8"));
  for (const [id, profile] of Object.entries(saved)) profiles.set(id, normalizeProfile(id, profile));
} catch {
  // A missing or unreadable save file starts with fresh anonymous profiles.
}

const questionBank = await loadQuestionBankOnServer(LOCAL_QUESTIONS);
if (questionBank.source === "api" && questionBank.questions.length > 0) {
  QUESTIONS = questionBank.questions;
  DEMO_ROUNDS = QUESTIONS.length;
  console.log("已從 Apps Script 題庫載入 " + DEMO_ROUNDS + " 題。" +
    (questionBank.skipped ? "略過 " + questionBank.skipped + " 題缺少相符答案資料的題目。" : ""));
} else {
  console.warn("Apps Script 題庫目前沒有可用題目，使用內建示範題。" +
    (questionBank.warning ? " " + questionBank.warning : ""));
}

function normalizeProfile(id, value = {}) {
  const items = {};
  for (const key of Object.keys(SHOP_ITEMS)) items[key] = Math.max(0, Math.floor(Number(value.items && value.items[key]) || 0));
  return {
    playerId: id,
    nickname: cleanName(value.nickname || ""),
    coins: Math.max(0, Math.floor(Number(value.coins) || 0)),
    items,
  };
}

function cleanName(value) {
  return String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16) || "玩家";
}

function getProfile(id, nickname) {
  const playerId = String(id || "").slice(0, 80);
  if (!playerId) return null;
  let profile = profiles.get(playerId);
  if (!profile) {
    profile = normalizeProfile(playerId, { nickname, coins: STARTING_COINS });
    profiles.set(playerId, profile);
    saveProfiles();
  } else if (nickname) {
    profile.nickname = cleanName(nickname);
    saveProfiles();
  }
  return profile;
}

function saveProfiles() {
  writeFileSync(profilesFile, JSON.stringify(Object.fromEntries(profiles), null, 2), "utf8");
}

function send(socket, type, payload = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }));
}

function sendError(socket, message) {
  send(socket, "server:error", { message });
}

function getRoom(code) {
  return rooms.get(String(code || "").toUpperCase());
}

function roomPlayers(room) {
  return [...room.players.values()];
}

function roomSnapshot(room) {
  return {
    code: room.code,
    status: room.status,
    hostName: room.hostName,
    difficulty: room.difficulty,
    roundCount: DEMO_ROUNDS,
    players: roomPlayers(room).map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      correctCount: player.correctCount,
      answered: Boolean(player.answer || player.retryDue),
    })),
  };
}

function broadcastRoom(room, type, payload = {}) {
  for (const socket of room.sockets) send(socket, type, payload);
}

function broadcastState(room) {
  broadcastRoom(room, "room:state", { room: roomSnapshot(room) });
}

function broadcastToPlayers(room, type, payload = {}) {
  for (const player of roomPlayers(room)) send(player.socket, type, payload);
}

function nextRoomCode() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function openRoom(socket, message) {
  if (!socket.playerId) return sendError(socket, "請先載入玩家資料，再建立房間。");
  if (socket.roomCode) leaveRoom(socket);

  const difficulty = DIFFICULTIES[message.difficulty] ? message.difficulty : "easy";
  const profile = getProfile(socket.playerId, message.nickname);
  const code = nextRoomCode();
  const room = {
    code,
    status: "lobby",
    hostSocket: socket,
    hostName: cleanName(message.nickname),
    difficulty,
    players: new Map(),
    sockets: new Set([socket]),
    round: null,
    roundIndex: 0,
    extraTimeUsed: false,
    timer: null,
  };
  rooms.set(code, room);
  socket.roomCode = code;
  socket.roomRole = "host";
  send(socket, "room:created", { room: roomSnapshot(room), profile });
  broadcastState(room);
}

function joinRoom(socket, message) {
  if (!socket.playerId) return sendError(socket, "請先載入玩家資料，再加入房間。");
  if (socket.roomCode) leaveRoom(socket);

  const room = getRoom(message.code);
  if (!room) return sendError(socket, "找不到這個房間代碼，請確認後再試一次。");
  if (room.status !== "lobby") return sendError(socket, "這場比賽已經開始，無法再加入。");
  if (room.players.size >= 80) return sendError(socket, "房間已達人數上限。");

  const profile = getProfile(socket.playerId, message.nickname);
  const player = {
    id: socket.playerId,
    nickname: cleanName(message.nickname || profile.nickname),
    socket,
    score: 0,
    streak: 0,
    correctCount: 0,
    totalAnswerMs: 0,
    answer: null,
    retryDue: false,
    retryUsed: false,
    doubleNext: false,
  };
  profile.nickname = player.nickname;
  room.players.set(player.id, player);
  room.sockets.add(socket);
  socket.roomCode = room.code;
  socket.roomRole = "player";
  send(socket, "room:joined", { room: roomSnapshot(room), profile });
  broadcastState(room);
}

function startMatch(room) {
  if (room.status !== "lobby") return;
  if (room.players.size === 0) return sendError(room.hostSocket, "至少需要一位學生加入後才能開始。");
  room.status = "playing";
  room.roundIndex = 0;
  for (const player of roomPlayers(room)) {
    player.score = 0;
    player.streak = 0;
    player.correctCount = 0;
    player.totalAnswerMs = 0;
    player.answer = null;
    player.retryDue = false;
    player.retryUsed = false;
    player.doubleNext = false;
  }
  broadcastState(room);
  beginRound(room);
}

function beginRound(room) {
  if (room.roundIndex >= DEMO_ROUNDS) return finishMatch(room);
  const question = QUESTIONS[room.roundIndex];
  const seconds = DIFFICULTIES[room.difficulty].secondsPerQuestion;
  const startedAt = Date.now();
  room.extraTimeUsed = false;
  room.round = { question, startedAt, deadline: startedAt + seconds * 1000 };
  for (const player of roomPlayers(room)) {
    player.answer = null;
    player.retryDue = false;
    player.retryUsed = false;
  }
  broadcastRoom(room, "match:question", {
    index: room.roundIndex,
    total: DEMO_ROUNDS,
    timeLimitSeconds: seconds,
    deadline: room.round.deadline,
    question: toPublicQuestion(question),
  });
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    for (const player of roomPlayers(room)) {
      if (!player.answer) {
        player.retryDue = false;
        player.answer = { index: null, elapsedMs: room.round.deadline - room.round.startedAt, timedOut: true };
      }
    }
    resolveRound(room);
  }, seconds * 1000);
}

function submitAnswer(room, player, message) {
  if (room.status !== "playing" || !room.round) return;
  if (!Number.isInteger(message.index) || message.index < 0 || message.index >= room.round.question.options.length) return;
  if (Number(message.roundIndex) !== room.roundIndex) return;
  if (Date.now() >= room.round.deadline) return;
  if (player.answer && !player.retryDue) return;

  const correct = message.index === room.round.question.correctIndex;
  const elapsedMs = Math.max(0, Date.now() - room.round.startedAt);
  const profile = getProfile(player.id);
  if (!correct && !player.retryUsed && profile.items.correction > 0 && elapsedMs < room.round.deadline - room.round.startedAt) {
    profile.items.correction -= 1;
    saveProfiles();
    player.retryDue = true;
    player.retryUsed = true;
    player.answer = null;
    send(player.socket, "match:retry", { item: "correction", profile, message: "答錯了，已使用一次修正機會，請再選一次。" });
    return;
  }

  const correcting = player.retryDue;
  player.retryDue = false;
  const score = calculateScore({
    correct,
    elapsedMs,
    timeLimitMs: room.round.deadline - room.round.startedAt,
    streak: player.streak,
    doubled: player.doubleNext,
  });
  player.doubleNext = false;
  const points = correct && correcting ? Math.floor(score.score / 2) : score.score;
  player.score += points;
  player.streak = correcting ? 0 : score.streak;
  if (correct) player.correctCount += 1;
  player.totalAnswerMs += elapsedMs;
  player.answer = { index: message.index, elapsedMs, correct, points, streak: player.streak, timedOut: false };
  send(player.socket, "match:answer-status", {
    answered: true,
    correct,
    points,
    waiting: true,
    message: correct ? "答案已送出，等待全班完成。" : "答案已送出，等待全班完成。",
    profile,
  });
  if (roomPlayers(room).every((entry) => entry.answer)) resolveRound(room);
}

function resolveRound(room) {
  if (!room.round || room.status !== "playing") return;
  clearTimeout(room.timer);
  const question = room.round.question;
  const answers = roomPlayers(room).map((player) => ({
    playerId: player.id,
    nickname: player.nickname,
    selectedIndex: player.answer && player.answer.index,
    timedOut: Boolean(player.answer && player.answer.timedOut),
    correct: Boolean(player.answer && player.answer.correct),
    points: player.answer ? player.answer.points || 0 : 0,
    score: player.score,
    correctCount: player.correctCount,
    streak: player.streak,
  }));
  const payload = {
    index: room.roundIndex,
    total: DEMO_ROUNDS,
    question: toPublicQuestion(question),
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    answers,
    rankings: rankPlayers(roomPlayers(room).map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      correctCount: player.correctCount,
      totalAnswerMs: player.totalAnswerMs,
    }))),
  };
  broadcastRoom(room, "match:round-result", payload);
  room.round = null;
  room.roundIndex += 1;
  room.timer = setTimeout(() => beginRound(room), 2800);
}

function useItem(room, player, message) {
  if (room.status !== "playing" || !room.round || player.answer) return;
  const item = String(message.item || "");
  const profile = getProfile(player.id);
  if (!profile || !["hint", "extraTime", "double"].includes(item)) return;
  if (profile.items[item] <= 0) return sendError(player.socket, "沒有這個道具，請先到商店購買。");

  if (item === "extraTime") {
    if (room.extraTimeUsed) return sendError(player.socket, "這一題的延長時間已使用。");
    room.extraTimeUsed = true;
    profile.items.extraTime -= 1;
    room.round.deadline += 5000;
    saveProfiles();
    broadcastRoom(room, "match:time-extended", { deadline: room.round.deadline, seconds: 5, usedBy: player.nickname });
    send(player.socket, "profile:sync", { profile });
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      for (const entry of roomPlayers(room)) {
        if (!entry.answer) entry.answer = { index: null, elapsedMs: room.round.deadline - room.round.startedAt, timedOut: true };
      }
      resolveRound(room);
    }, Math.max(0, room.round.deadline - Date.now()));
    return;
  }

  profile.items[item] -= 1;
  saveProfiles();
  if (item === "double") {
    player.doubleNext = true;
    send(player.socket, "match:item-result", { item, profile, message: "分數加倍已啟用，下一題答對分數加倍。" });
    return;
  }

  const correctIndex = room.round.question.correctIndex;
  const wrongIndices = room.round.question.options.map((_, index) => index).filter((index) => index !== correctIndex);
  const hiddenIndices = wrongIndices.slice(0, 2);
  send(player.socket, "match:item-result", { item, profile, hiddenIndices, message: "提示已啟用，已排除兩個錯誤選項。" });
}

function payout(room) {
  const ordered = rankPlayers(roomPlayers(room));
  let pool = 0;
  const transfers = [];

  for (const player of ordered.slice(1)) {
    const profile = getProfile(player.id);
    if (profile.items.shield > 0) {
      profile.items.shield -= 1;
      transfers.push({ playerId: player.id, nickname: player.nickname, paid: 0, protected: true });
      continue;
    }
    const paid = Math.min(1, profile.coins);
    profile.coins -= paid;
    pool += paid;
    transfers.push({ playerId: player.id, nickname: player.nickname, paid, protected: false });
  }

  const winners = ordered.slice(0, Math.min(3, ordered.length));
  const weights = [5, 3, 2].slice(0, winners.length);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  let distributed = 0;
  winners.forEach((player, index) => {
    const profile = getProfile(player.id);
    const share = index === winners.length - 1 ? pool - distributed : Math.floor(pool * weights[index] / totalWeight);
    profile.coins += share;
    distributed += share;
  });
  saveProfiles();

  return {
    transfers,
    pool,
    rankings: ordered.map((player, index) => ({
      rank: index + 1,
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      correctCount: player.correctCount,
      coins: getProfile(player.id).coins,
    })),
  };
}

function finishMatch(room) {
  clearTimeout(room.timer);
  room.status = "finished";
  const result = payout(room);
  for (const player of roomPlayers(room)) {
    send(player.socket, "match:finished", { ...result, profile: getProfile(player.id) });
  }
  send(room.hostSocket, "match:finished", { ...result, profile: getProfile(room.hostSocket.playerId) });
  broadcastState(room);
  room.timer = setTimeout(() => {
    for (const socket of room.sockets) {
      socket.roomCode = null;
      socket.roomRole = null;
    }
    rooms.delete(room.code);
  }, 30000);
}

function leaveRoom(socket) {
  const room = getRoom(socket.roomCode);
  if (!room) {
    socket.roomCode = null;
    socket.roomRole = null;
    return;
  }
  room.sockets.delete(socket);
  if (socket.roomRole === "host") {
    clearTimeout(room.timer);
    broadcastRoom(room, "room:closed", { message: "主持人已結束房間。" });
    rooms.delete(room.code);
  } else {
    room.players.delete(socket.playerId);
    if (room.status === "playing" && room.players.size === 0) {
      clearTimeout(room.timer);
      rooms.delete(room.code);
    } else {
      broadcastState(room);
    }
  }
  socket.roomCode = null;
  socket.roomRole = null;
}

async function handleMessage(socket, message) {
  switch (message.type) {
    case "profile:hello": {
      socket.playerId = String(message.playerId || "").slice(0, 80);
      const profile = getProfile(socket.playerId, message.nickname);
      if (!profile) return sendError(socket, "玩家資料無效。");
      send(socket, "profile:sync", { profile });
      break;
    }
    case "profile:purchase": {
      if (!socket.playerId) return sendError(socket, "玩家資料尚未載入。");
      const item = SHOP_ITEMS[message.item];
      const profile = getProfile(socket.playerId);
      if (!item) return sendError(socket, "找不到這項道具。");
      if (profile.coins < item.price) return sendError(socket, "智慧金幣不足。");
      profile.coins -= item.price;
      profile.items[item.id] += 1;
      saveProfiles();
      send(socket, "profile:sync", { profile, message: "已購買「" + item.label + "」。" });
      break;
    }
    case "profile:consume": {
      if (!socket.playerId) return sendError(socket, "玩家資料尚未載入。");
      const profile = getProfile(socket.playerId);
      const item = String(message.item || "");
      if (!Object.prototype.hasOwnProperty.call(profile.items, item) || item === "shield" || profile.items[item] < 1) {
        return sendError(socket, "沒有可使用的道具。");
      }
      profile.items[item] -= 1;
      saveProfiles();
      send(socket, "profile:sync", { profile });
      break;
    }
    case "profile:solo-win": {
      if (!socket.playerId) return sendError(socket, "玩家資料尚未載入。");
      const profile = getProfile(socket.playerId);
      profile.coins += 5;
      saveProfiles();
      send(socket, "profile:sync", { profile, message: "獲勝獎勵：智慧金幣 +5。" });
      break;
    }
    case "room:create":
      openRoom(socket, message);
      break;
    case "room:join":
      joinRoom(socket, message);
      break;
    case "room:start": {
      const room = getRoom(socket.roomCode);
      if (!room || socket.roomRole !== "host") return sendError(socket, "只有主持人可以開始比賽。");
      startMatch(room);
      break;
    }
    case "room:answer": {
      const room = getRoom(socket.roomCode);
      const player = room && room.players.get(socket.playerId);
      if (!room || !player) return sendError(socket, "你目前不在這個比賽房間。");
      submitAnswer(room, player, message);
      break;
    }
    case "room:use-item": {
      const room = getRoom(socket.roomCode);
      const player = room && room.players.get(socket.playerId);
      if (!room || !player) return sendError(socket, "你目前不在這個比賽房間。");
      useItem(room, player, message);
      break;
    }
    case "room:leave":
      leaveRoom(socket);
      break;
    default:
      sendError(socket, "不支援的遊戲訊息。");
  }
}

const webServer = await createViteServer({
  configFile: false,
  root: rootDirectory,
  server: { host: "0.0.0.0", port: WEB_PORT, strictPort: false },
});
await webServer.listen();
webServer.printUrls();

const httpServer = createServer();
const socketServer = new WebSocketServer({ server: httpServer, maxPayload: 65536 });
socketServer.on("connection", (socket) => {
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      void handleMessage(socket, message);
    } catch {
      sendError(socket, "訊息格式錯誤。");
    }
  });
  socket.on("close", () => leaveRoom(socket));
});
httpServer.listen(PORT, "0.0.0.0", () => console.log("課堂連線伺服器已啟動，WebSocket port " + PORT));

async function shutdown() {
  for (const room of rooms.values()) clearTimeout(room.timer);
  socketServer.close();
  httpServer.close();
  await webServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
