// ── Types ────────────────────────────────────────────────────────────────────

type WsHandler = (data: unknown) => void;
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── WebSocketClient ───────────────────────────────────────────────────────────

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<WsHandler>> = new Map();
  private statusHandlers: Set<(s: WsStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseDelay = 1_000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  public status: WsStatus = 'disconnected';

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      // Subscribe to all channels
      this.send({ type: 'subscribe', channels: ['data_updates', 'conversation_updates', 'system_updates'] });
      this.startHeartbeat();
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      this.handleMessage(ev.data as string);
    };

    this.ws.onerror = () => {
      this.setStatus('error');
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.status !== 'disconnected') {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setStatus('disconnected');
    this.ws?.close();
    this.ws = null;
  }

  /** Register a handler for a channel. Returns an unsubscribe function. */
  on(channel: string, handler: WsHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
    return () => this.handlers.get(channel)?.delete(handler);
  }

  /** Register a status change handler. Returns an unsubscribe function. */
  onStatus(handler: (s: WsStatus) => void): () => void {
    this.statusHandlers.add(handler);
    // Immediately notify current status
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setStatus(s: WsStatus): void {
    this.status = s;
    this.statusHandlers.forEach(h => h(s));
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as { type?: string; channel?: string; event?: string; data?: unknown };
      const channel = msg.channel || msg.type || msg.event;
      if (!channel) return;
      const handlers = this.handlers.get(channel);
      if (handlers) handlers.forEach(h => h(msg.data ?? msg));
    } catch {
      // ignore malformed messages
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new WebSocketClient();
