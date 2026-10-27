import Phaser from "phaser";

export class GraphScene extends Phaser.Scene {
  constructor() {
    super({ key: "GraphScene" });
  }

  create() {
    this.graphics = this.add.graphics();
    this.chartLabels = [];
    this.handleQuestionChange = (event) => this.drawGraph(event.detail);
    window.addEventListener("phaser-graph-question", this.handleQuestionChange);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.drawCurrentGraph, this);
    this.drawGraph(window.__currentGraphQuestion);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("phaser-graph-question", this.handleQuestionChange);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.drawCurrentGraph, this);
    });
  }

  drawCurrentGraph() {
    this.drawGraph(window.__currentGraphQuestion);
  }

  drawGraph(question) {
    if (!question?.graph || !this.graphics) return;
    this.graphics.clear();
    for (const label of this.chartLabels) label.destroy();
    this.chartLabels = [];

    const graph = question.graph;
    const width = this.scale.width;
    const height = this.scale.height;
    const left = Math.max(42, width * 0.085);
    const right = width - Math.max(24, width * 0.045);
    const top = Math.max(22, height * 0.08);
    const bottom = height - Math.max(40, height * 0.16);
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const point = ({ q, p }) => ({
      x: left + (q / graph.qMax) * plotWidth,
      y: bottom - (p / graph.pMax) * plotHeight,
    });
    const addText = (x, y, value, color = "#d7e5ff", size = 14, originX = 0.5) => {
      const text = this.add.text(x, y, value, {
        color,
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
        fontSize: `${size}px`,
        fontStyle: "600",
      }).setOrigin(originX, 0.5);
      this.chartLabels.push(text);
    };

    this.graphics.lineStyle(1, 0x294064, 0.72);
    for (let tick = 0; tick <= 10; tick += 2) {
      const y = bottom - (tick / graph.pMax) * plotHeight;
      const x = left + (tick / graph.qMax) * plotWidth;
      this.graphics.lineBetween(left, y, right, y);
      this.graphics.lineBetween(x, top, x, bottom);
      addText(left - 12, y, String(tick), "#91a7c9", 11, 1);
      addText(x, bottom + 16, String(tick), "#91a7c9", 11);
    }

    this.graphics.lineStyle(2, 0xb8c7df, 0.95);
    this.graphics.lineBetween(left, bottom, right + 4, bottom);
    this.graphics.lineBetween(left, bottom, left, top - 4);
    this.graphics.fillStyle(0xb8c7df, 1);
    this.graphics.fillTriangle(right + 4, bottom, right - 4, bottom - 4, right - 4, bottom + 4);
    this.graphics.fillTriangle(left, top - 4, left - 4, top + 4, left + 4, top + 4);
    addText(left - 16, top - 8, "P", "#ffffff", 15);
    addText(right + 11, bottom + 18, "Q", "#ffffff", 15);

    const drawCurve = (points, color, label, lineWidth = 3) => {
      const start = point(points[0]);
      const end = point(points[1]);
      this.graphics.lineStyle(lineWidth, color, 1);
      this.graphics.lineBetween(start.x, start.y, end.x, end.y);
      const cssColor = "#" + color.toString(16).padStart(6, "0");
      addText(end.x - 8, end.y - 14, label, cssColor, 15);
    };
    if (graph.supply) drawCurve(graph.supply, 0x43d4a0, "S");
    if (graph.demand) drawCurve(graph.demand, 0x54a8ff, "D");
    if (graph.shiftedDemand) {
      drawCurve(graph.shiftedDemand, 0xffc857, "D₁");
      const oldPoint = point(graph.oldEquilibrium);
      const newPoint = point(graph.newEquilibrium);
      this.graphics.lineStyle(1, 0xffc857, 0.75);
      this.graphics.lineBetween(oldPoint.x, oldPoint.y, newPoint.x, newPoint.y);
      this.graphics.fillStyle(0xffc857, 1);
      this.graphics.fillCircle(newPoint.x, newPoint.y, 5);
      this.graphics.fillStyle(0x54a8ff, 1);
      this.graphics.fillCircle(oldPoint.x, oldPoint.y, 4);
      addText(oldPoint.x - 15, oldPoint.y + 15, "E₀", "#54a8ff", 12);
      addText(newPoint.x + 16, newPoint.y - 12, "E₁", "#ffc857", 12);
    }
    if (graph.equilibrium) {
      const equilibrium = point(graph.equilibrium);
      this.graphics.lineStyle(1, 0xffc857, 0.75);
      this.graphics.lineBetween(left, equilibrium.y, equilibrium.x, equilibrium.y);
      this.graphics.lineBetween(equilibrium.x, equilibrium.y, equilibrium.x, bottom);
      this.graphics.fillStyle(0xffc857, 1);
      this.graphics.fillCircle(equilibrium.x, equilibrium.y, 6);
      addText(equilibrium.x + 14, equilibrium.y - 14, "E", "#ffc857", 14, 0);
    }
    if (graph.movementFrom && graph.movementTo) {
      const from = point(graph.movementFrom);
      const to = point(graph.movementTo);
      this.graphics.lineStyle(3, 0xffc857, 1);
      this.graphics.lineBetween(from.x, from.y, to.x, to.y);
      this.graphics.fillStyle(0xffc857, 1);
      this.graphics.fillCircle(from.x, from.y, 5);
      this.graphics.fillCircle(to.x, to.y, 5);
      this.graphics.fillTriangle(to.x, to.y, to.x - 10, to.y - 3, to.x - 3, to.y - 10);
      addText(from.x - 13, from.y - 14, "A", "#ffc857", 12);
      addText(to.x + 12, to.y + 13, "B", "#ffc857", 12);
    }
  }
}
