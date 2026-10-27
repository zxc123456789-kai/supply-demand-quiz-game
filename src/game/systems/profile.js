const STORAGE_KEY = "supply-quiz-profile-v1";

export const SHOP_ITEMS = {
  hint: { id: "hint", label: "提示", description: "排除兩個錯誤選項", price: 2, icon: "/assets/images/kenney-board-game-icons/hint-question.png" },
  extraTime: { id: "extraTime", label: "延長時間", description: "本題增加 5 秒", price: 3, icon: "/assets/images/kenney-board-game-icons/timer-hourglass.png" },
  double: { id: "double", label: "分數加倍", description: "下一題答對分數加倍", price: 3, icon: "/assets/images/kenney-board-game-icons/coin-add.png" },
  correction: { id: "correction", label: "答錯修正", description: "答錯後再試一次，答對可得半分", price: 4, icon: "/assets/images/kenney-board-game-icons/answer-correction.png" },
  shield: { id: "shield", label: "防偷護盾", description: "金幣結算時抵擋一次扣款", price: 4, icon: "/assets/images/kenney-board-game-icons/anti-theft-shield.png" },
};

function newPlayerId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return "player-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createProfile() {
  return { playerId: newPlayerId(), nickname: "", coins: 10, items: { hint: 0, extraTime: 0, double: 0, correction: 0, shield: 0 } };
}

export function normalizeProfile(value) {
  const base = createProfile();
  if (!value || typeof value !== "object") return base;
  return {
    playerId: typeof value.playerId === "string" ? value.playerId : base.playerId,
    nickname: typeof value.nickname === "string" ? value.nickname.slice(0, 16) : "",
    coins: Math.max(0, Math.floor(Number(value.coins) || 0)),
    items: Object.fromEntries(Object.keys(SHOP_ITEMS).map((key) => [key, Math.max(0, Math.floor(Number(value.items && value.items[key]) || 0))])),
  };
}

export function loadProfile() {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return createProfile();
  }
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
