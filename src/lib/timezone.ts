export const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function formatISTDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatISTTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatISTDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Returns YYYY-MM-DD in Asia/Kolkata regardless of host OS timezone */
export function getISTDateKey(input?: Date | string | number): string {
  const ms =
    input === undefined
      ? Date.now()
      : typeof input === 'number'
        ? input
        : typeof input === 'string'
          ? Date.parse(input)
          : input.getTime();
  const shifted = new Date(ms + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Shifts an IST YYYY-MM-DD date key by deltaDays and returns YYYY-MM-DD */
export function addDaysToISTDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d) + deltaDays * 86400_000;
  const shifted = new Date(utcMs);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Converts an IST YYYY-MM-DD key to exact UTC ISO start & end boundaries */
export function getISTDayBoundsUTC(dateKey: string): { startIso: string; endIso: string } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

export function getDateRangeBoundsUTC(
  preset: 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom',
  fromDateKey?: string | null,
  toDateKey?: string | null,
  nowMs: number = Date.now()
): { startIso: string; endIso: string; fromKey: string; toKey: string } {
  const todayKey = getISTDateKey(nowMs);
  let fromKey = todayKey;
  let toKey = todayKey;

  if (preset === 'yesterday') {
    fromKey = addDaysToISTDateKey(todayKey, -1);
    toKey = fromKey;
  } else if (preset === '7d') {
    fromKey = addDaysToISTDateKey(todayKey, -6);
    toKey = todayKey;
  } else if (preset === '30d') {
    fromKey = addDaysToISTDateKey(todayKey, -29);
    toKey = todayKey;
  } else if (preset === 'all') {
    fromKey = '2020-01-01';
    toKey = addDaysToISTDateKey(todayKey, 365);
  } else if (preset === 'custom') {
    fromKey = fromDateKey || todayKey;
    toKey = toDateKey || fromKey;
  }

  const start = getISTDayBoundsUTC(fromKey).startIso;
  const end = getISTDayBoundsUTC(toKey).endIso;
  return { startIso: start, endIso: end, fromKey, toKey };
}

export function getISTHour(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

export function istDateTimeLocalInputValue(iso?: string): string {
  const ms = iso ? Date.parse(iso) : Date.now();
  const shifted = new Date(ms + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function parseISTLocalInputToUTC(localValue: string): string {
  // Expected format: YYYY-MM-DDTHH:mm
  const [datePart, timePart] = localValue.split('T');
  if (!datePart || !timePart) return new Date(localValue).toISOString();
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}
