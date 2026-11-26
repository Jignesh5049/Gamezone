'use client';

import * as React from 'react';
import { computeSessionMetrics } from '@/lib/timer';
import { playAlertChime } from '@/lib/sound';
import type {
  BootstrapPayload,
  ReceiptData,
  SessionRecord,
} from '@/lib/types';

export interface StartModalOptions {
  stationId?: string;
  groupMode?: boolean;
  bookingId?: string;
  durationMinutes?: number;
}

interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface GameZoneContextValue {
  data: BootstrapPayload;
  nowMs: number;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  notify: (message: string, tone?: ToastItem['tone']) => void;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  extendSession: (sessionId: string, minutes: number) => Promise<void>;
  openStartModal: (opts?: StartModalOptions) => void;
  closeStartModal: () => void;
  startModalOpts: StartModalOptions | null;
  openCheckoutModal: (sessionId: string) => void;
  closeCheckoutModal: () => void;
  checkoutSessionId: string | null;
  openReceiptModal: (receipt: ReceiptData) => void;
  closeReceiptModal: () => void;
  receiptData: ReceiptData | null;
  openTransferModal: (sessionId: string) => void;
  closeTransferModal: () => void;
  transferSessionId: string | null;
  openSessionDetailModal: (sessionId: string) => void;
  closeSessionDetailModal: () => void;
  detailSessionId: string | null;
  soundEnabled: boolean;
  toggleSound: () => Promise<void>;
}

const GameZoneContext = React.createContext<GameZoneContextValue | null>(null);

export function GameZoneProvider({
  initialBootstrap,
  children,
}: {
  initialBootstrap: BootstrapPayload;
  children: React.ReactNode;
}) {
  const [data, setData] = React.useState<BootstrapPayload>(initialBootstrap);
  const [clockOffsetMs, setClockOffsetMs] = React.useState<number>(() => {
    const serverMs = Date.parse(initialBootstrap.serverNow);
    return Number.isNaN(serverMs) ? 0 : serverMs - Date.now();
  });
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now() + clockOffsetMs);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const [startModalOpts, setStartModalOpts] = React.useState<StartModalOptions | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = React.useState<string | null>(null);
  const [receiptData, setReceiptData] = React.useState<ReceiptData | null>(null);
  const [transferSessionId, setTransferSessionId] = React.useState<string | null>(null);
  const [detailSessionId, setDetailSessionId] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [localSoundOverride, setLocalSoundOverride] = React.useState<boolean | null>(null);

  const alertedLevelsRef = React.useRef<Map<string, string>>(new Map());

  const soundEnabled =
    localSoundOverride !== null
      ? localSoundOverride
      : data.settings.sound_alerts !== 'false';

  const notify = React.useCallback(
    (message: string, tone: ToastItem['tone'] = 'success') => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const refresh = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/bootstrap', { cache: 'no-store' });
      if (!res.ok) return;
      const next = (await res.json()) as BootstrapPayload;
      const serverMs = Date.parse(next.serverNow);
      if (!Number.isNaN(serverMs)) {
        const offset = serverMs - Date.now();
        setClockOffsetMs(offset);
        setNowMs(Date.now() + offset);
      }
      setData(next);
    } catch {
      // Transient offline state: timers keep running accurately from timestamps
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Global 1-second timer tick using server-adjusted timestamp
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 1000);
    return () => clearInterval(interval);
  }, [clockOffsetMs]);

  // Periodic background sync + tab visibility + reconnect recovery
  React.useEffect(() => {
    const syncInterval = setInterval(() => {
      refresh();
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const handleOnline = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [refresh]);

  // Alert sound monitor for expiring / expired sessions
  React.useEffect(() => {
    if (!soundEnabled) return;
    const warnMins = Number(data.settings.warning_minutes ?? 10);
    const critMins = Number(data.settings.critical_minutes ?? 5);

    for (const ses of data.activeSessions) {
      if (ses.status !== 'active') continue;
      const m = computeSessionMetrics(ses, nowMs, warnMins, critMins);
      if (m.alertLevel === 'normal') continue;
      const prevLevel = alertedLevelsRef.current.get(ses.id);
      if (prevLevel !== m.alertLevel) {
        alertedLevelsRef.current.set(ses.id, m.alertLevel);
        playAlertChime(m.alertLevel);
      }
    }
  }, [data.activeSessions, data.settings, nowMs, soundEnabled]);

  const mutateSession = React.useCallback(
    async (url: string, body?: Record<string, unknown>, successMsg?: string) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = (await res.json()) as { error?: string; session?: SessionRecord };
        if (!res.ok) {
          notify(json.error || 'Action failed', 'error');
          return;
        }
        if (successMsg) notify(successMsg, 'success');
        await refresh();
      } catch {
        notify('Network error while updating session', 'error');
      }
    },
    [notify, refresh]
  );

  const pauseSession = React.useCallback(
    async (sessionId: string) => {
      await mutateSession(`/api/sessions/${sessionId}/pause`, undefined, 'Timer paused');
    },
    [mutateSession]
  );

  const resumeSession = React.useCallback(
    async (sessionId: string) => {
      await mutateSession(`/api/sessions/${sessionId}/resume`, undefined, 'Timer resumed');
    },
    [mutateSession]
  );

  const extendSession = React.useCallback(
    async (sessionId: string, minutes: number) => {
      await mutateSession(
        `/api/sessions/${sessionId}/extend`,
        { minutes },
        `Extended session by +${minutes}m`
      );
    },
    [mutateSession]
  );

  const toggleSound = React.useCallback(async () => {
    const next = !soundEnabled;
    setLocalSoundOverride(next);
    notify(next ? 'Expiration sound alerts enabled' : 'Sound alerts muted', 'info');
  }, [notify, soundEnabled]);

  const value: GameZoneContextValue = {
    data,
    nowMs,
    isSyncing,
    refresh,
    notify,
    pauseSession,
    resumeSession,
    extendSession,
    openStartModal: (opts = {}) => setStartModalOpts(opts),
    closeStartModal: () => setStartModalOpts(null),
    startModalOpts,
    openCheckoutModal: (id) => setCheckoutSessionId(id),
    closeCheckoutModal: () => setCheckoutSessionId(null),
    checkoutSessionId,
    openReceiptModal: (r) => setReceiptData(r),
    closeReceiptModal: () => setReceiptData(null),
    receiptData,
    openTransferModal: (id) => setTransferSessionId(id),
    closeTransferModal: () => setTransferSessionId(null),
    transferSessionId,
    openSessionDetailModal: (id) => setDetailSessionId(id),
    closeSessionDetailModal: () => setDetailSessionId(null),
    detailSessionId,
    soundEnabled,
    toggleSound,
  };

  return (
    <GameZoneContext.Provider value={value}>
      {children}
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm no-print">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg ${
                t.tone === 'error'
                  ? 'bg-[#C65D50] text-white border-[#a74438]'
                  : t.tone === 'info'
                    ? 'bg-[#202723] text-[#F5F2E9] border-[#333d37]'
                    : 'bg-[#285943] text-[#FCFBF7] border-[#214a37]'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </GameZoneContext.Provider>
  );
}

export function useGameZone() {
  const ctx = React.useContext(GameZoneContext);
  if (!ctx) {
    throw new Error('useGameZone must be used inside GameZoneProvider');
  }
  return ctx;
}
