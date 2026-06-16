const OFFSET_RE = /^(\d{1,2}):(\d{2})(?:\s+UTC([+-]\d{1,2})(?::?(\d{2}))?)?$/;

export function parseOpenFootballDateTime(date: string, time?: string): string {
  if (!time) {
    return new Date(`${date}T00:00:00.000Z`).toISOString();
  }

  const match = OFFSET_RE.exec(time.trim());
  if (!match) {
    throw new Error(`Unsupported time format: ${date} ${time}`);
  }

  const [, hourRaw, minuteRaw, offsetHourRaw, offsetMinuteRaw] = match;
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const offsetHour = offsetHourRaw ? Number(offsetHourRaw) : 0;
  const offsetMinute = offsetMinuteRaw ? Number(offsetMinuteRaw) * Math.sign(offsetHour || 1) : 0;
  const [year, month, day] = date.split("-").map(Number);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - (offsetHour * 60 + offsetMinute) * 60_000;
  return new Date(utcMs).toISOString();
}

export function formatUtcStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}
