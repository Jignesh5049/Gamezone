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
import { Badge } from '@/components/ui/badge';
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
  // Green: Available | Red: Occupied | Orange/Amber: Session ending soon / Paused | Grey: Maintenance / Disabled
  let statusBarColor = 'bg-[#285943]';
  let statusBadgeTone: 'green' | 'red' | 'amber' | 'grey' = 'green';
  let statusLabel = 'Available';

  if (station.status === 'maintenance' || station.status === 'disabled') {
    statusBarColor = 'bg-[#7A827D]';
    statusBadgeTone = 'grey';
    statusLabel = station.status === 'maintenance' ? 'Maintenance' : 'Disabled';
  } else if (session && metrics) {
    if (metrics.isPaused) {
      statusBarColor = 'bg-[#D89B45]';
      statusBadgeTone = 'amber';
      statusLabel = 'Paused';
    } else if (metrics.alertLevel === 'warning' || metrics.alertLevel === 'critical') {
      statusBarColor = 'bg-[#D89B45]';
      statusBadgeTone = 'amber';
      statusLabel = 'Ending Soon';
    } else if (metrics.alertLevel === 'expired') {
      statusBarColor = 'bg-[#C65D50]';
      statusBadgeTone = 'red';
      statusLabel = 'Time Exceeded';
    } else {
      statusBarColor = 'bg-[#C65D50]';
      statusBadgeTone = 'red';
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

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-xl border bg-[#FCFBF7] transition-shadow hover:shadow-sm overflow-hidden',
        metrics?.alertLevel === 'expired'
          ? 'border-[#C65D50] ring-1 ring-[#C65D50]/35'
          : metrics?.alertLevel === 'warning' || metrics?.alertLevel === 'critical'
            ? 'border-[#D89B45]'
            : 'border-[#DFD9C8]'
      )}
    >
      {/* Top Status Accent Strip */}
      <div className={cn('h-1.5 w-full', statusBarColor)} />

      <div className={cn('flex-1 flex flex-col justify-between', compact ? 'p-3.5' : 'p-4')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#646D67]">
                {station.code}
              </span>
              <span className="text-[#D4CEBC]">•</span>
              <span className="text-[11px] font-medium text-[#646D67] truncate">
                {station.category_name}
              </span>
            </div>
            <h4 className="text-sm font-bold text-[#202723] truncate mt-0.5">
              {station.name}
            </h4>
          </div>
          <Badge tone={statusBadgeTone}>{statusLabel}</Badge>
        </div>

        {/* Body */}
        {station.status === 'maintenance' || station.status === 'disabled' ? (
          <div className="my-3 rounded-lg border border-[#DFD9C8] bg-[#EDE9DD]/60 p-3 text-xs text-[#5A635D]">
            <div className="flex items-center gap-1.5 font-semibold text-[#202723]">
              <Wrench className="h-3.5 w-3.5 text-[#646D67]" />
              {station.status === 'maintenance' ? 'Under Maintenance' : 'Temporarily Disabled'}
            </div>
            <p className="mt-1 text-[11px] line-clamp-2">
              {station.notes || 'Unavailable for customer sessions.'}
            </p>
          </div>
        ) : session && metrics && calc ? (
          <div className="my-3 space-y-2.5">
            {/* Session Code & Start Time */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[#202723] truncate">
                {session.session_code}
              </span>
              <span className="font-mono text-[11px] text-[#646D67] shrink-0">
                Started {formatISTTime(session.started_at)}
              </span>
            </div>

            {/* Live Timer & Amount Box */}
            <div className="rounded-lg border border-[#EAE5D7] bg-[#F5F2E9]/90 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#646D67] font-semibold">
                    Elapsed
                  </div>
                  <div className="font-mono text-lg font-bold text-[#202723] tabular-nums leading-tight">
                    {formatDurationHMS(metrics.billableElapsedSeconds)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-[#646D67] font-semibold">
                    {metrics.remainingSeconds !== null
                      ? metrics.remainingSeconds < 0
                        ? 'Overtime'
                        : 'Remaining'
                      : 'Charge'}
                  </div>
                  {metrics.remainingSeconds !== null ? (
                    <div
                      className={cn(
                        'font-mono text-sm font-bold tabular-nums leading-tight',
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
                    <div className="font-mono text-sm font-bold text-[#285943] tabular-nums">
                      {formatINR(calc.baseAmount)}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar for Fixed Duration */}
              {session.billing_mode === 'fixed' && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#DFD9C8] overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      metrics.alertLevel === 'expired' || metrics.alertLevel === 'critical'
                        ? 'bg-[#C65D50]'
                        : metrics.alertLevel === 'warning' || metrics.isPaused
                          ? 'bg-[#D89B45]'
                          : 'bg-[#285943]'
                    )}
                    style={{ width: `${metrics.progressPercent}%` }}
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[11px] text-[#5A635D]">
                <span>
                  Current Charge:{' '}
                  <strong className="font-mono text-[#202723]">
                    {formatINR(calc.baseAmount)}
                  </strong>
                </span>
                {metrics.estimatedEndAtIso && (
                  <span className="font-mono">
                    Ends {formatISTTime(metrics.estimatedEndAtIso)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-3 rounded-lg border border-dashed border-[#D4CEBC] bg-[#F5F2E9]/50 p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[#285943]">Ready for Play</div>
              <div className="text-[11px] text-[#646D67] mt-0.5">
                {station.effective_pricing
                  ? `₹${station.effective_pricing.rate_30min}/30m • ₹${station.effective_pricing.rate_60min}/hr`
                  : 'Standard pricing'}
              </div>
            </div>
            <Clock className="h-4 w-4 text-[#A8B8A0]" />
          </div>
        )}

        {/* Contextual Actions */}
        {station.status === 'available' && !session && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => openStartModal({ stationId: station.id })}
          >
            <Play className="h-3.5 w-3.5" />
            Start Session
          </Button>
        )}

        {session && metrics && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              {metrics.isPaused ? (
                <Button
                  size="xs"
                  variant="amber"
                  disabled={busyAction !== null}
                  onClick={() => runAction('resume', () => resumeSession(session.id))}
                >
                  <Play className="h-3 w-3" />
                  Resume
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busyAction !== null}
                  onClick={() => runAction('pause', () => pauseSession(session.id))}
                >
                  <Pause className="h-3 w-3" />
                  Pause
                </Button>
              )}

              <Button
                size="xs"
                variant="danger"
                disabled={busyAction !== null}
                onClick={() => openCheckoutModal(session.id)}
              >
                <Square className="h-3 w-3" />
                End Session
              </Button>
            </div>

            {!compact && (
              <div className="flex items-center gap-1 pt-0.5">
                <Button
                  size="xs"
                  variant="ghost"
                  className="flex-1 px-1.5 text-[11px]"
                  disabled={busyAction !== null}
                  onClick={() => runAction('ext15', () => extendSession(session.id, 15))}
                >
                  <Plus className="h-3 w-3" />
                  15m
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="flex-1 px-1.5 text-[11px]"
                  disabled={busyAction !== null}
                  onClick={() => runAction('ext30', () => extendSession(session.id, 30))}
                >
                  <Plus className="h-3 w-3" />
                  30m
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="px-2 text-[11px]"
                  title="Transfer station"
                  onClick={() => openTransferModal(session.id)}
                >
                  <ArrowRightLeft className="h-3 w-3" />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="px-2 text-[11px]"
                  title="View session details"
                  onClick={() => openSessionDetailModal(session.id)}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
