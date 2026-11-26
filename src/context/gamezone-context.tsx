'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  buildClientBootstrap,
  extendSessionById,
  pauseSessionById,
  resetDemoState,
  resumeSessionById,
} from '@/lib/demo-store';
import {
  clearStoredJwt,
  type DemoJwtPayload,
  getStoredJwt,
  verifyDemoJwt,
} from '@/lib/jwt';
import { computeSessionMetrics } from '@/lib/timer';
import { playAlertChime } from '@/lib/sound';
import type { BootstrapPayload, ReceiptData, StaffProfile } from '@/lib/types';

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
  jwtPayload: DemoJwtPayload;
  nowMs: number;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  notify: (message: string, tone?: ToastItem['tone']) => void;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  extendSession: (sessionId: string, minutes: number) => Promise<void>;
  resetDemo: () => void;
  logout: () => void;
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
  toggleSound: () => void;
}

const GameZoneContext = React.createContext<GameZoneContextValue | null>(null);

function payloadToStaff(p: DemoJwtPayload): StaffProfile {
  return {
    staffId: 'stf_admin',
    userId: p.sub,
    email: p.email,
    fullName: p.name,
    role: p.role,
    phone: null,
    isActive: true,
  };
}

export function GameZoneProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jwtPayload, setJwtPayload] = React.useState<DemoJwtPayload | null>(null);
  const [data, setData] = React.useState<BootstrapPayload | null>(null);
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

  const [startModalOpts, setStartModalOpts] = React.useState<StartModalOptions | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = React.useState<string | null>(null);
  const [receiptData, setReceiptData] = React.useState<ReceiptData | null>(null);
  const [transferSessionId, setTransferSessionId] = React.useState<string | null>(null);
  const [detailSessionId, setDetailSessionId] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [localSoundOverride, setLocalSoundOverride] = React.useState<boolean | null>(null);

  const alertedLevelsRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    let active = true;
    verifyDemoJwt(getStoredJwt()).then((verified) => {
      if (!active) return;
      if (!verified) {
        clearStoredJwt();
        router.replace('/login');
        return;
      }
      setJwtPayload(verified);
      setData(buildClientBootstrap(payloadToStaff(verified)));
    });
    return () => {
      active = false;
    };
  }, [router]);

  const soundEnabled =
    localSoundOverride !== null
      ? localSoundOverride
      : data?.settings.sound_alerts !== 'false';

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
    if (!jwtPayload) return;
    setData(buildClientBootstrap(payloadToStaff(jwtPayload)));
    setNowMs(Date.now());
  }, [jwtPayload]);

  // Global 1-second timer tick using real system clock vs persisted ISO timestamps
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Alert sound monitor for expiring / expired sessions
  React.useEffect(() => {
    if (!soundEnabled || !data) return;
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
  }, [data, nowMs, soundEnabled]);

  const pauseSession = React.useCallback(
    async (sessionId: string) => {
      const res = pauseSessionById(sessionId);
      if (!res.ok) notify(res.error || 'Could not pause timer', 'error');
      else notify('Timer paused', 'success');
      await refresh();
    },
    [notify, refresh]
  );

  const resumeSession = React.useCallback(
    async (sessionId: string) => {
      const res = resumeSessionById(sessionId);
      if (!res.ok) notify(res.error || 'Could not resume timer', 'error');
      else notify('Timer resumed', 'success');
      await refresh();
    },
    [notify, refresh]
  );

  const extendSession = React.useCallback(
    async (sessionId: string, minutes: number) => {
      const res = extendSessionById(sessionId, minutes);
      if (!res.ok) notify(res.error || 'Could not extend session', 'error');
      else notify(`Extended session by +${minutes}m`, 'success');
      await refresh();
    },
    [notify, refresh]
  );

  const resetDemo = React.useCallback(() => {
    resetDemoState();
    alertedLevelsRef.current.clear();
    notify('Demo data reset to initial floor state', 'info');
    if (jwtPayload) {
      setData(buildClientBootstrap(payloadToStaff(jwtPayload)));
      setNowMs(Date.now());
    }
  }, [jwtPayload, notify]);

  const logout = React.useCallback(() => {
    clearStoredJwt();
    router.replace('/login');
  }, [router]);

  const toggleSound = React.useCallback(() => {
    const next = !soundEnabled;
    setLocalSoundOverride(next);
    notify(next ? 'Expiration sound alerts enabled' : 'Sound alerts muted', 'info');
  }, [notify, soundEnabled]);

  if (!jwtPayload || !data) {
    return (
      <div className="min-h-screen bg-[#F5F2E9] flex items-center justify-center p-6">
        <div className="rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-6 py-4 text-xs font-medium text-[#5A635D]">
          Verifying JWT session...
        </div>
      </div>
    );
  }

  const value: GameZoneContextValue = {
    data,
    jwtPayload,
    nowMs,
    isSyncing: false,
    refresh,
    notify,
    pauseSession,
    resumeSession,
    extendSession,
    resetDemo,
    logout,
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
