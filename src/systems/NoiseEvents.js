export class NoiseEvents {
  constructor() {
    this.listeners = new Set();
    this.sequence = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit({ type, source, x, y, level, urgent = false }) {
    const event = Object.freeze({
      id: ++this.sequence,
      type,
      source,
      x,
      y,
      level: Math.max(0, Math.min(1, level)),
      urgent: Boolean(urgent || type === "destroy"),
      createdAt: performance.now(),
    });
    for (const listener of this.listeners) listener(event);
    return event;
  }
}
