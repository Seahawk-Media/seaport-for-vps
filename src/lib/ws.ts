type MessageHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(userId?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (userId) {
        this.ws?.send(JSON.stringify({ type: 'auth', userId }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const { channel, data } = JSON.parse(event.data);
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          channelHandlers.forEach((handler) => handler(data));
        }
      } catch {
        // Ignore malformed WebSocket messages that fail JSON parsing
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(userId), 3000);
    };
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    this.ws?.send(JSON.stringify({ type: 'subscribe', channel }));

    return () => {
      this.handlers.get(channel)?.delete(handler);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();
