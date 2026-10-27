export const DIFFICULTIES = {
  easy: { id: "easy", label: "簡單", description: "讀圖找均衡點", targetQuestions: 25, secondsPerQuestion: 20 },
  medium: { id: "medium", label: "適中", description: "判讀單一曲線變動", targetQuestions: 20, secondsPerQuestion: 25 },
  hard: { id: "hard", label: "困難", description: "分析較複雜的供需情境", targetQuestions: 10, secondsPerQuestion: 30 },
};

// Three reviewed sample questions form the MVP vertical slice. The full
// difficulty-specific question counts remain the classroom-release target.
export const QUESTIONS = [
  {
    id: "equilibrium-point",
    skill: "讀取均衡點",
    prompt: "根據圖中的供給線 S 與需求線 D，均衡價格 P 與均衡數量 Q 是多少？",
    graph: {
      type: "equilibrium", qMax: 10, pMax: 10,
      supply: [{ q: 0, p: 0 }, { q: 10, p: 10 }],
      demand: [{ q: 0, p: 10 }, { q: 10, p: 0 }],
      equilibrium: { q: 5, p: 5 },
    },
    options: ["P = 4，Q = 6", "P = 5，Q = 5", "P = 6，Q = 4", "P = 6，Q = 7"],
    correctIndex: 1,
    explanation: "均衡點是供給線 S 和需求線 D 的交點。從座標讀取，價格 P = 5，數量 Q = 5。",
  },
  {
    id: "demand-shift",
    skill: "需求曲線移動",
    prompt: "消費者偏好上升，使需求曲線向右移動。新的均衡價格與均衡數量會如何變化？",
    graph: {
      type: "demand-shift", qMax: 10, pMax: 10,
      supply: [{ q: 0, p: 0 }, { q: 10, p: 10 }],
      demand: [{ q: 0, p: 10 }, { q: 10, p: 0 }],
      shiftedDemand: [{ q: 2, p: 10 }, { q: 10, p: 2 }],
      oldEquilibrium: { q: 5, p: 5 },
      newEquilibrium: { q: 6, p: 6 },
    },
    options: ["均衡價格上升，均衡數量上升", "均衡價格下降，均衡數量上升", "均衡價格上升，均衡數量下降", "均衡價格和數量都不變"],
    correctIndex: 0,
    explanation: "偏好上升會使需求曲線右移。供給不變時，新交點往右上方移動，因此均衡價格和均衡數量都上升。",
  },
  {
    id: "movement-on-curve",
    skill: "沿曲線移動或曲線移動",
    prompt: "其他條件不變時，商品本身價格下降，需求量增加。圖上應如何表示？",
    graph: {
      type: "movement", qMax: 10, pMax: 10,
      demand: [{ q: 0, p: 10 }, { q: 10, p: 0 }],
      movementFrom: { q: 3, p: 7 }, movementTo: { q: 7, p: 3 },
    },
    options: ["需求曲線整條向右移動", "需求曲線整條向左移動", "沿著同一條需求曲線移動", "供給曲線向右移動"],
    correctIndex: 2,
    explanation: "商品本身價格改變會造成需求量改變，圖上是沿著同一條需求曲線移動。偏好、所得等其他因素改變，才會使需求曲線移動。",
  },
];

export function toPublicQuestion(question) {
  return { id: question.id, skill: question.skill, prompt: question.prompt, graph: question.graph, options: question.options };
}
