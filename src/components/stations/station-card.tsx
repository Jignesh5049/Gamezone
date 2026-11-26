'use client';

import * as React from 'react';
import {
  ArrowRightLeft,
  Clock,
  Eye,
  Pause,
  Play,
  Plus,
  Square,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameZone } from '@/context/gamezone-context';
import {
  calculateRentalAmount,
  computeSessionMetrics,
  formatDurationHMS,
} from '@/lib/timer';
import { formatISTTime } from '@/lib/timezone';
import { cn, formatINR } from '@/lib/utils';
import type { GamingStation } from '@/lib/types';

export function StationCard({
  station,
  compact = false,
}: {
  station: GamingStation;
  compact?: boolean;
}) {
  const {
    data,
    nowMs,
    openStartModal,
    openCheckoutModal,
    openTransferModal,
    openSessionDetailModal,
    pauseSession,
    resumeSession,
    extendSession,
  } = useGameZone();

  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const session = station.active_session;
  const warnMins = Number(data.settings.warning_minutes ?? 10);
  const critMins = Number(data.settings.critical_minutes ?? 5);

  const metrics = session
    ? computeSessionMetrics(session, nowMs, warnMins, critMins)
    : null;
  const calc =
    session && metrics
      ? calculateRentalAmount({
          billableElapsedSeconds: metrics.billableElapsedSeconds,
          plannedDurationMinutes: session.planned_duration_minutes,
          billingMode: session.billing_mode,
          billingIncrementMinutes: session.billing_increment_minutes,
          ratePer30Min: session.rate_30min,
          ratePer60Min: session.rate_60min,
          offerDiscountPercent: session.offer_discount_percent,
        })
      : null;

  // Color coding per spec:
  // Green: Available | Red: Occupied | Amber: Ending soon / Paused | Grey: Maintenance / Disabled
  let dotColor = 'bg-[#285943]';
  let statusTextColor = 'text-[#285943]';
  let statusLabel = 'Available';

  if (station.status === 'maintenance' || station.status === 'disabled') {
    dotColor = 'bg-[#707973]';
    statusTextColor = 'text-[#525B55]';
    statusLabel = station.status === 'maintenance' ? 'Maintenance' : 'Disabled';
  } else if (session && metrics) {
    if (metrics.isPaused) {
      dotColor = 'bg-[#B77922]';
      statusTextColor = 'text-[#8E5B13]';
      statusLabel = 'Paused';
    } else if (metrics.alertLevel === 'warning' || metrics.alertLevel === 'critical') {
      dotColor = 'bg-[#B77922]';
      statusTextColor = 'text-[#8E5B13]';
      statusLabel = 'Ending soon';
    } else if (metrics.alertLevel === 'expired') {
      dotColor = 'bg-[#C65D50]';
      statusTextColor = 'text-[#A74438]';
      statusLabel = 'Time exceeded';
    } else {
      dotColor = 'bg-[#C65D50]';
      statusTextColor = 'text-[#A74438]';
      statusLabel = 'Occupied';
    }
  }

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const progressRatio = metrics
    ? Math.min(1, Math.max(0, metrics.progressPercent / 100))
    : 0;

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-xl border bg-[#FCFBF7] transition-[border-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_2px_8px_rgba(30,36,32,0.06)]',
        compact ? 'p-4' : 'p-4',
        metrics?.alertLevel === 'expired'
          ? 'border-[#C65D50]/55'
          : metrics?.alertLevel === 'warning' || metrics?.alertLevel === 'critical'
            ? 'border-[#B77922]/50'
            : 'border-[#1E2420]/10'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#707973]">
            <span className="font-mono">{station.code}</span>
            <span>·</span>
            <span className="truncate">{station.category_name}</span>
          </div>
          <h4 className="text-[15px] font-medium text-[#1E2420] truncate mt-1">
            {station.name}
          </h4>
        </div>
        <span className={cn('inline-flex items-center gap-2 text-xs font-medium shrink-0 pt-0.5', statusTextColor)}>
          <span className={cn('h-2 w-2 rounded-full', dotColor)} />
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      {station.status === 'maintenance' || station.status === 'disabled' ? (
        <div className="my-3 rounded-[8px] border border-[#1E2420]/8 bg-[#EDE9DD]/70 p-3 text-xs text-[#525B55]">
          <div className="flex items-center gap-2 font-medium text-[#1E2420]">
            <Wrench className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
            {station.status === 'maintenance' ? 'Under maintenance' : 'Temporarily disabled'}
          </div>
          <p className="mt-1 text-xs line-clamp-2">
            {station.notes || 'Unavailable for sessions'}
          </p>
        </div>
      ) : session && metrics && calc ? (
        <div className="my-3 space-y-2">
          {/* Session Code & Start Time */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-medium text-[#1E2420] truncate">
              {session.session_code}
            </span>
            <span className="font-mono text-[#707973] shrink-0 tabular-nums">
              Started {formatISTTime(session.started_at)}
            </span>
          </div>

          {/* Live Timer & Amount Box */}
          <div className="rounded-[8px] border border-[#1E2420]/8 bg-[#F5F2E9] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-xs text-[#707973]">Elapsed</div>
                <div className="font-mono text-xl font-medium text-[#1E2420] tabular-nums leading-none mt-1">
                  {formatDurationHMS(metrics.billableElapsedSeconds)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-[#707973]">
                  {metrics.remainingSeconds !== null
                    ? metrics.remainingSeconds < 0
                      ? 'Overtime'
                      : 'Remaining'
                    : 'Charge'}
                </div>
                {metrics.remainingSeconds !== null ? (
                  <div
                    className={cn(
                      'font-mono text-sm font-medium tabular-nums leading-none mt-1',
                      metrics.remainingSeconds <= 0
                        ? 'text-[#C65D50]'
                        : metrics.alertLevel === 'critical'
                          ? 'text-[#C65D50]'
                          : metrics.alertLevel === 'warning'
                            ? 'text-[#8E5B13]'
                            : 'text-[#285943]'
                    )}
                  >
                    {formatDurationHMS(metrics.remainingSeconds)}
                  </div>
                ) : (
                  <div className="font-mono text-sm font-medium text-[#285943] tabular-nums leading-none mt-1">
                    {formatINR(calc.baseAmount)}
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar for Fixed Duration */}
            {session.billing_mode === 'fixed' && (
              <div className="mt-3 h-1 w-full rounded-full bg-[#1E2420]/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full w-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    metrics.alertLevel === 'expired' || metrics.alertLevel === 'critical'
                      ? 'bg-[#C65D50]'
                      : metrics.alertLevel === 'warning' || metrics.isPaused
                        ? 'bg-[#B77922]'
                        : 'bg-[#285943]'
                  )}
                  style={{ transform: `scaleX(${progressRatio})` }}
                />
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-xs text-[#525B55]">
              <span>
                Charge:{' '}
                <span className="font-mono font-medium text-[#1E2420] tabular-nums">
                  {formatINR(calc.baseAmount)}
                </span>
              </span>
              {metrics.estimatedEndAtIso && (
                <span className="font-mono tabular-nums">
                  Ends {formatISTTime(metrics.estimatedEndAtIso)}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="my-3 rounded-[8px] border border-[#1E2420]/8 bg-[#F5F2E9]/60 p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#285943]">Ready</div>
            <div className="font-mono text-xs text-[#525B55] mt-1 tabular-nums">
              {station.effective_pricing
                ? `₹${station.effective_pricing.rate_30min}/30m · ₹${station.effective_pricing.rate_60min}/hr`
                : 'Standard pricing'}
            </div>
          </div>
          <Clock className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
        </div>
      )}

      {/* Contextual Actions */}
      {station.status === 'available' && !session && (
        <Button
          size="sm"
          className="w-full"
          onClick={() => openStartModal({ stationId: station.id })}
        >
          <Play className="h-4 w-4" strokeWidth={1.5} />
          Start session
        </Button>
      )}

      {session && metrics && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {metrics.isPaused ? (
              <Button
                size="xs"
                variant="amber"
                disabled={busyAction !== null}
                onClick={() => runAction('resume', () => resumeSession(session.id))}
              >
                <Play className="h-4 w-4" strokeWidth={1.5} />
                Resume
              </Button>
            ) : (
              <Button
                size="xs"
                variant="outline"
                disabled={busyAction !== null}
                onClick={() => runAction('pause', () => pauseSession(session.id))}
              >
                <Pause className="h-4 w-4" strokeWidth={1.5} />
                Pause
              </Button>
            )}

            <Button
              size="xs"
              variant="danger"
              disabled={busyAction !== null}
              onClick={() => openCheckoutModal(session.id)}
            >
              <Square className="h-4 w-4" strokeWidth={1.5} />
              End session
            </Button>
          </div>

          {!compact && (
            <div className="flex items-center gap-1">
              <Button
                size="xs"
                variant="ghost"
                className="flex-1 px-2"
                disabled={busyAction !== null}
                onClick={() => runAction('ext15', () => extendSession(session.id, 15))}
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                15m
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="flex-1 px-2"
                disabled={busyAction !== null}
                onClick={() => runAction('ext30', () => extendSession(session.id, 30))}
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                30m
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="px-2"
                title="Transfer station"
                onClick={() => openTransferModal(session.id)}
              >
                <ArrowRightLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="px-2"
                title="View session details"
                onClick={() => openSessionDetailModal(session.id)}
              >
                <Eye className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
