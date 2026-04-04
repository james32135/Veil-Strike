import { API_BASE } from '@/constants';

type SSEHandler = (data: unknown) => void;

const handlers = new Map<string, Set<SSEHandler>>();
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (eventSource) return;

  const url = API_BASE.replace('/api', '') + '/api/events';
  eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const type = msg.type as string;
      const cbs = handlers.get(type);
      if (cbs) {
        for (const cb of cbs) cb(msg.data);
      }
    } catch { /* ignore parse errors */ }
  };

  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;
    // Reconnect after 5s
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (handlers.size > 0) connect();
      }, 5000);
    }
  };
}

export function subscribeSSE(eventType: string, handler: SSEHandler): () => void {
  let set = handlers.get(eventType);
  if (!set) {
    set = new Set();
    handlers.set(eventType, set);
  }
  set.add(handler);
  connect();

  return () => {
    set!.delete(handler);
    if (set!.size === 0) handlers.delete(eventType);
    // Disconnect if no handlers left
    if (handlers.size === 0) {
      eventSource?.close();
      eventSource = null;
    }
  };
}
