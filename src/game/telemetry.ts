const TELEMETRY_KEY = 'signal-arena.telemetry.v1';
const MAX_EVENTS = 120;

export interface TelemetryEvent {
  name: string;
  at: string;
  payload?: Record<string, string | number | boolean | undefined>;
}

export function track(name: string, payload?: TelemetryEvent['payload']): void {
  try {
    const event: TelemetryEvent = {
      name,
      at: new Date().toISOString(),
      payload
    };
    const raw = window.localStorage.getItem(TELEMETRY_KEY);
    const events = raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
    events.push(event);
    window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));

    if (import.meta.env.DEV) {
      console.info('[SignalArena telemetry]', event);
    }
  } catch {
    // Telemetry must never interrupt the game loop.
  }
}

export function readTelemetry(): TelemetryEvent[] {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}
