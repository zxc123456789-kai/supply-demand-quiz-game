export class RoomClient {
  constructor(onMessage, onStatus = () => {}) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socket = null;
    this.connectPromise = null;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      const host = window.location.hostname || "localhost";
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(protocol + "//" + host + ":3001");
      this.socket = socket;
      const timeout = window.setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
          reject(new Error("連線伺服器逾時"));
        }
      }, 5000);

      socket.addEventListener("open", () => {
        window.clearTimeout(timeout);
        this.onStatus("open");
        resolve();
      }, { once: true });
      socket.addEventListener("error", (error) => {
        window.clearTimeout(timeout);
        this.onStatus("error");
        reject(error);
      }, { once: true });
      socket.addEventListener("close", () => {
        window.clearTimeout(timeout);
        this.connectPromise = null;
        this.onStatus("closed");
      });
      socket.addEventListener("message", (event) => {
        try {
          this.onMessage(JSON.parse(event.data));
        } catch {
          this.onStatus("error");
        }
      });
    }).finally(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) this.connectPromise = null;
    });

    return this.connectPromise;
  }

  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
    this.socket = null;
    this.connectPromise = null;
  }
}
