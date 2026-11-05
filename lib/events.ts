type Listener = (data: string) => void;

class GlobalEventEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(eventName: string, payload: any = {}) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify({ ...payload, timestamp: Date.now() })}\n\n`;
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        this.listeners.delete(listener);
      }
    });
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

const globalForEvents = globalThis as unknown as { eventEmitter?: GlobalEventEmitter };
export const eventEmitter = globalForEvents.eventEmitter || new GlobalEventEmitter();
if (process.env.NODE_ENV !== 'production') globalForEvents.eventEmitter = eventEmitter;
