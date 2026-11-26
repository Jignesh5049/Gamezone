import type {
  AlertLevel,
  BillingMode,
  LiveTimerMetrics,
  RentalCalculation,
  SessionRecord,
} from './types';

export interface TimerSessionInput {
  status: SessionRecord['status'];
  billing_mode: BillingMode;
  billing_increment_minutes: 15 | 30 | 60;
  rate_30min: number;
  rate_60min: number;
  offer_discount_percent?: number;
  planned_duration_minutes: number | null;
  started_at: string;
  expected_end_at: string | null;
  ended_at: string | null;
  paused_at: string | null;
  accumulated_paused_seconds: number;
}

export function computeSessionMetrics(
  session: TimerSessionInput,
  nowMs: number = Date.now(),
  warningMinutes: number = 10,
  criticalMinutes: number = 5
): LiveTimerMetrics {
  const startMs = Date.parse(session.started_at);
  const isEnded = session.status === 'completed' || session.status === 'cancelled';
  const isPaused = session.status === 'paused' && Boolean(session.paused_at);

  const effectiveEndMs =
    isEnded && session.ended_at ? Date.parse(session.ended_at) : nowMs;

  const totalWallSeconds = Math.max(0, Math.floor((effectiveEndMs - startMs) / 1000));

  let currentPauseSeconds = 0;
  if (isPaused && session.paused_at) {
    const pausedMs = Date.parse(session.paused_at);
    currentPauseSeconds = Math.max(0, Math.floor((effectiveEndMs - pausedMs) / 1000));
  }

  const totalPausedSeconds = Math.max(
    0,
    (session.accumulated_paused_seconds || 0) + currentPauseSeconds
  );

  // Rule #4: Paused time is never billable
  const billableElapsedSeconds = Math.max(0, totalWallSeconds - totalPausedSeconds);

  let remainingSeconds: number | null = null;
  let progressPercent = 0;
  let alertLevel: AlertLevel = 'normal';
  let estimatedEndAtIso: string | null = session.expected_end_at;

  if (session.billing_mode === 'fixed' && session.planned_duration_minutes) {
    const plannedSeconds = session.planned_duration_minutes * 60;
    remainingSeconds = plannedSeconds - billableElapsedSeconds;
    progressPercent = Math.min(
      100,
      Math.max(0, Math.round((billableElapsedSeconds / plannedSeconds) * 100))
    );

    if (!isEnded) {
      estimatedEndAtIso = new Date(
        startMs + (plannedSeconds + totalPausedSeconds) * 1000
      ).toISOString();

      if (remainingSeconds <= 0) {
        alertLevel = 'expired';
      } else if (remainingSeconds <= criticalMinutes * 60) {
        alertLevel = 'critical';
      } else if (remainingSeconds <= warningMinutes * 60) {
        alertLevel = 'warning';
      }
    }
  }

  return {
    totalWallSeconds,
    totalPausedSeconds,
    billableElapsedSeconds,
    remainingSeconds,
    progressPercent,
    alertLevel,
    estimatedEndAtIso,
    isPaused,
    isEnded,
  };
}

export function calculateRentalAmount(params: {
  billableElapsedSeconds: number;
  plannedDurationMinutes: number | null;
  billingMode: BillingMode;
  billingIncrementMinutes: 15 | 30 | 60;
  ratePer30Min: number;
  ratePer60Min: number;
  offerDiscountPercent?: number;
}): RentalCalculation {
  const {
    billableElapsedSeconds,
    plannedDurationMinutes,
    billingMode,
    billingIncrementMinutes,
    ratePer30Min,
    ratePer60Min,
    offerDiscountPercent = 0,
  } = params;

  const increment = billingIncrementMinutes || 30;
  const hourlyRate = ratePer60Min > 0 ? ratePer60Min : ratePer30Min * 2;
  const elapsedMinutes = billableElapsedSeconds / 60;

  const priceForMinutes = (mins: number): number => {
    if (mins <= 0) return 0;
    const fullHours = Math.floor(mins / 60);
    const remainderMins = mins % 60;
    return fullHours * hourlyRate + (remainderMins / 30) * ratePer30Min;
  };

  let billableMinutes = 0;
  let plannedAmount = 0;
  let overtimeMinutes = 0;
  let overtimeAmount = 0;

  if (billingMode === 'fixed' && plannedDurationMinutes && plannedDurationMinutes > 0) {
    plannedAmount = Math.round(priceForMinutes(plannedDurationMinutes));
    if (elapsedMinutes <= plannedDurationMinutes) {
      billableMinutes = plannedDurationMinutes;
    } else {
      const overtimeRaw = elapsedMinutes - plannedDurationMinutes;
      overtimeMinutes = Math.ceil(overtimeRaw / increment) * increment;
      billableMinutes = plannedDurationMinutes + overtimeMinutes;
      overtimeAmount = Math.round(priceForMinutes(overtimeMinutes));
    }
  } else {
    billableMinutes =
      billableElapsedSeconds <= 0
        ? 0
        : Math.max(increment, Math.ceil(elapsedMinutes / increment) * increment);
    plannedAmount = Math.round(priceForMinutes(billableMinutes));
  }

  const grossAmount = Math.round(priceForMinutes(billableMinutes));
  const offerDiscountAmount =
    offerDiscountPercent > 0
      ? Math.round((grossAmount * offerDiscountPercent) / 100)
      : 0;
  const baseAmount = Math.max(0, grossAmount - offerDiscountAmount);

  return {
    billableMinutes,
    plannedAmount,
    overtimeMinutes,
    overtimeAmount,
    offerDiscountAmount,
    baseAmount,
  };
}

export function formatDurationHMS(totalSeconds: number): string {
  const abs = Math.abs(Math.floor(totalSeconds));
  const hrs = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = abs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const prefix = totalSeconds < 0 ? '+' : '';
  return `${prefix}${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export function formatMinutesReadable(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
