export function calculateScore({ correct, elapsedMs, timeLimitMs, streak = 0, doubled = false }) {
  if (!correct) return { score: 0, streak: 0, multiplier: 1, speedBonus: 0 };

  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedMs / Math.max(1, timeLimitMs)));
  const speedBonus = Math.round(500 * remainingRatio);
  const nextStreak = streak + 1;
  const multiplier = Math.min(2, 1 + (nextStreak - 1) * 0.1);
  const score = Math.round((500 + speedBonus) * multiplier * (doubled ? 2 : 1));

  return { score, streak: nextStreak, multiplier, speedBonus };
}

export function rankPlayers(players) {
  return [...players].sort((a, b) =>
    (b.score - a.score) ||
    (b.correctCount - a.correctCount) ||
    (a.totalAnswerMs - b.totalAnswerMs) ||
    a.nickname.localeCompare(b.nickname, "zh-Hant")
  );
}
