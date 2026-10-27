import { DIFFICULTIES } from "../data/questions.js";

export const QUESTION_API_URL = "https://script.google.com/macros/s/AKfycbzumtUADh85mWHOKogMJvJ1bHkPX65AtAeLMZ8IGLDrd48g7XFyVlzmSWjFMsfawOjL/exec";

const JSONP_CALLBACK = "__supplyQuestQuestionBankCallback";
const JSONP_TIMEOUT_MS = 10000;

function isValidPoint(point, graph) {
  return point && Number.isFinite(point.q) && Number.isFinite(point.p) &&
    point.q >= 0 && point.q <= graph.qMax && point.p >= 0 && point.p <= graph.pMax;
}

function isValidCurve(curve, graph) {
  return Array.isArray(curve) && curve.length === 2 && curve.every((point) => isValidPoint(point, graph));
}

function isSupportedGraph(graph) {
  if (!graph || typeof graph !== "object" ||
      !Number.isFinite(graph.qMax) || graph.qMax <= 0 ||
      !Number.isFinite(graph.pMax) || graph.pMax <= 0) return false;

  if (graph.type === "equilibrium") {
    return isValidCurve(graph.supply, graph) && isValidCurve(graph.demand, graph) &&
      isValidPoint(graph.equilibrium, graph);
  }
  if (graph.type === "demand-shift") {
    return isValidCurve(graph.supply, graph) && isValidCurve(graph.demand, graph) &&
      isValidCurve(graph.shiftedDemand, graph) && isValidPoint(graph.oldEquilibrium, graph) &&
      isValidPoint(graph.newEquilibrium, graph);
  }
  if (graph.type === "movement") {
    return isValidCurve(graph.demand, graph) && isValidPoint(graph.movementFrom, graph) &&
      isValidPoint(graph.movementTo, graph);
  }
  return false;
}

/** Merge public question content with locally stored answer keys. */
export function mergeQuestionBankPayload(payload, answerKeyQuestions) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.questions)) {
    throw new Error("題庫 API 回傳格式不正確。");
  }

  const answerKeys = new Map(answerKeyQuestions.map((question) => [question.id, question]));
  const seenIds = new Set();
  let skipped = 0;
  const questions = [];

  for (const item of payload.questions) {
    const id = String(item && item.id || "").trim();
    const answerKey = answerKeys.get(id);
    const difficulty = String(item && item.difficulty || "").trim();
    const optionsMatch = answerKey && Array.isArray(item.options) &&
      JSON.stringify(item.options) === JSON.stringify(answerKey.options);

    if (!id || seenIds.has(id) || !answerKey || !optionsMatch ||
        !DIFFICULTIES[difficulty] || !Number.isInteger(answerKey.correctIndex) ||
        answerKey.correctIndex < 0 || answerKey.correctIndex >= item.options.length ||
        typeof item.prompt !== "string" || !item.prompt.trim()) {
      skipped += 1;
      continue;
    }

    seenIds.add(id);
    questions.push({
      ...answerKey,
      id,
      difficulty,
      skill: typeof item.skill === "string" && item.skill.trim() ? item.skill.trim() : answerKey.skill,
      prompt: item.prompt.trim(),
      options: item.options.slice(),
      graph: isSupportedGraph(item.graph) ? item.graph : answerKey.graph,
    });
  }

  return { questions, skipped, total: payload.questions.length, source: "api" };
}

/** Load the API in Node; Apps Script's Content Service redirect is followed by fetch. */
export async function loadQuestionBankOnServer(answerKeyQuestions) {
  try {
    const response = await fetch(QUESTION_API_URL, { signal: AbortSignal.timeout(JSONP_TIMEOUT_MS) });
    if (!response.ok) throw new Error("題庫 API HTTP " + response.status);
    const payload = await response.json();
    return mergeQuestionBankPayload(payload, answerKeyQuestions);
  } catch (error) {
    return {
      questions: answerKeyQuestions,
      skipped: 0,
      total: answerKeyQuestions.length,
      source: "local",
      warning: String(error && error.message ? error.message : error),
    };
  }
}

/** Load the API in a browser without relying on cross-origin fetch permissions. */
export function loadQuestionBankInBrowser(answerKeyQuestions) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.remove();
      delete window[JSONP_CALLBACK];
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => finish({
      questions: answerKeyQuestions,
      skipped: 0,
      total: answerKeyQuestions.length,
      source: "local",
      warning: "題庫 API 連線逾時。",
    }), JSONP_TIMEOUT_MS);

    window[JSONP_CALLBACK] = (payload) => {
      try {
        finish(mergeQuestionBankPayload(payload, answerKeyQuestions));
      } catch (error) {
        finish({
          questions: answerKeyQuestions,
          skipped: 0,
          total: answerKeyQuestions.length,
          source: "local",
          warning: String(error && error.message ? error.message : error),
        });
      }
    };

    script.onerror = () => finish({
      questions: answerKeyQuestions,
      skipped: 0,
      total: answerKeyQuestions.length,
      source: "local",
      warning: "題庫 API 暫時無法連線。",
    });
    script.src = QUESTION_API_URL + "?callback=" + JSONP_CALLBACK + "&t=" + Date.now();
    document.head.appendChild(script);
  });
}
