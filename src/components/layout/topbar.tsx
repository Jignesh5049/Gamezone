'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Menu,
  Play,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGameZone } from '@/context/gamezone-context';
import { formatISTDateTime } from '@/lib/timezone';

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const router = useRouter();
  const {
    data,
    nowMs,
    openStartModal,
    openSessionDetailModal,
    soundEnabled,
    toggleSound,
  } = useGameZone();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const searchRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const matchedStations = q
    ? data.stations.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category_name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      )
    : [];
  const matchedSessions = q
    ? data.activeSessions.filter(
        (ses) =>
          ses.session_code.toLowerCase().includes(q) ||
          (ses.station_name || '').toLowerCase().includes(q)
      )
    : [];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#DFD9C8] bg-[#FCFBF7]/95 backdrop-blur-xs px-4 lg:px-6 no-print">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-lg p-1.5 text-[#202723] hover:bg-[#EDE9DD] cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search */}
        <div ref={searchRef} className="relative w-full max-w-xs sm:max-w-sm">
          <Search className="h-3.5 w-3.5 text-[#8E9690] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search stations or active sessions..."
            className="h-8 w-full rounded-lg border border-[#D4CEBC] bg-[#F5F2E9]/70 pl-8 pr-3 text-xs text-[#202723] placeholder:text-[#8E9690] focus:border-[#285943] focus:bg-white focus:outline-none"
          />

          {searchOpen && q.length > 0 && (
            <div className="absolute left-0 right-0 top-10 rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] shadow-xl p-2 z-50 max-h-80 overflow-y-auto text-xs space-y-2">
              {matchedSessions.length === 0 && matchedStations.length === 0 ? (
                <div className="p-2 text-[#646D67]">
                  No quick match.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(`/sessions?search=${encodeURIComponent(searchQuery)}`);
                    }}
                    className="text-[#285943] font-semibold underline cursor-pointer"
                  >
                    Search all sessions
                  </button>
                </div>
              ) : (
                <>
                  {matchedSessions.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#646D67]">
                        Active Sessions
                      </div>
                      {matchedSessions.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => {
                            setSearchOpen(false);
                            openSessionDetailModal(s.id);
                          }}
                          className="w-full text-left flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#EDE9DD] cursor-pointer"
                        >
                          <span className="font-medium">
                            {s.station_name}
                          </span>
                          <span className="font-mono text-[11px] text-[#285943]">
                            {s.session_code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedStations.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#646D67]">
                        Gaming Stations
                      </div>
                      {matchedStations.map((st) => (
                        <button
                          type="button"
                          key={st.id}
                          onClick={() => {
                            setSearchOpen(false);
                            router.push('/');
                          }}
                          className="w-full text-left flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#EDE9DD] cursor-pointer"
                        >
                          <span className="font-medium">{st.name}</span>
                          <Badge
                            tone={
                              st.status === 'available'
                                ? 'green'
                                : st.status === 'occupied'
                                  ? 'red'
                                  : 'grey'
                            }
                          >
                            {st.status}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live IST Clock */}
        <div
          className="hidden xl:flex items-center gap-1.5 rounded-lg border border-[#EAE5D7] bg-[#F5F2E9] px-2.5 py-1 font-mono text-[11px] text-[#202723] tabular-nums"
          suppressHydrationWarning
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#285943]" />
          {formatISTDateTime(new Date(nowMs).toISOString())} IST
        </div>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={toggleSound}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4CEBC] bg-white text-[#202723] hover:bg-[#EDE9DD] cursor-pointer"
          title={soundEnabled ? 'Sound alerts on' : 'Sound alerts muted'}
        >
          {soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-[#285943]" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-[#646D67]" />
          )}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4CEBC] bg-white text-[#202723] hover:bg-[#EDE9DD] cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
            {data.notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C65D50] px-1 font-mono text-[10px] font-bold text-white">
                {data.notifications.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#EAE5D7] px-3.5 py-2.5">
                <span className="text-xs font-semibold text-[#202723]">
                  Live Alerts ({data.notifications.length})
                </span>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="text-[11px] font-medium text-[#285943] hover:underline cursor-pointer"
                >
                  {soundEnabled ? 'Mute chimes' : 'Enable chimes'}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#EAE5D7]">
                {data.notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#646D67]">
                    All clear — no pending alerts.
                  </div>
                ) : (
                  data.notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setNotifOpen(false);
                        if (n.sessionId) openSessionDetailModal(n.sessionId);
                        else if (n.type === 'pending_payment') router.push('/sessions?paymentStatus=unpaid');
                        else if (n.type === 'maintenance') router.push('/inventory');
                      }}
                      className="px-3.5 py-2.5 hover:bg-[#EDE9DD]/60 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#202723]">{n.title}</span>
                        <Badge
                          tone={
                            n.type === 'expired' || n.type === 'critical'
                              ? 'red'
                              : n.type === 'warning' || n.type === 'pending_payment'
                                ? 'amber'
                                : 'grey'
                          }
                        >
                          {n.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#646D67] mt-0.5">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Session CTA */}
        <Button size="sm" onClick={() => openStartModal()}>
          <Play className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Session</span>
          <span className="sm:hidden">Start</span>
        </Button>
      </div>
    </header>
  );
}
