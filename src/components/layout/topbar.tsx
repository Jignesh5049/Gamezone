'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  LogOut,
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
    logout,
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#1E2420]/10 bg-[#FCFBF7] px-4 lg:px-6 no-print">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-[8px] p-2 text-[#1E2420] hover:bg-[#EDE9DD] cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Global Search */}
        <div ref={searchRef} className="relative w-full max-w-xs sm:max-w-sm">
          <Search
            className="h-4 w-4 text-[#707973] absolute left-3 top-2.5"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search stations or sessions"
            className="h-9 w-full rounded-[8px] border border-[#1E2420]/12 bg-[#F5F2E9] pl-9 pr-3 text-sm text-[#1E2420] placeholder:text-[#707973] transition-[border-color,background-color] duration-150 focus:border-[#285943] focus:bg-white focus:outline-none"
          />

          {searchOpen && q.length > 0 && (
            <div className="absolute left-0 right-0 top-11 rounded-xl border border-[#1E2420]/10 bg-[#FCFBF7] shadow-[0_8px_24px_rgba(30,36,32,0.08)] p-2 z-50 max-h-80 overflow-y-auto text-xs space-y-2">
              {matchedSessions.length === 0 && matchedStations.length === 0 ? (
                <div className="p-2 text-[#525B55]">
                  No quick match.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(`/sessions?search=${encodeURIComponent(searchQuery)}`);
                    }}
                    className="text-[#285943] font-medium underline cursor-pointer"
                  >
                    Search all sessions
                  </button>
                </div>
              ) : (
                <>
                  {matchedSessions.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-[#707973]">
                        Active sessions
                      </div>
                      {matchedSessions.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => {
                            setSearchOpen(false);
                            openSessionDetailModal(s.id);
                          }}
                          className="w-full text-left flex items-center justify-between rounded-[8px] px-2 py-2 hover:bg-[#EDE9DD] cursor-pointer"
                        >
                          <span className="font-medium text-[#1E2420]">
                            {s.station_name}
                          </span>
                          <span className="font-mono text-xs text-[#285943]">
                            {s.session_code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedStations.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-[#707973]">
                        Gaming stations
                      </div>
                      {matchedStations.map((st) => (
                        <button
                          type="button"
                          key={st.id}
                          onClick={() => {
                            setSearchOpen(false);
                            router.push('/');
                          }}
                          className="w-full text-left flex items-center justify-between rounded-[8px] px-2 py-2 hover:bg-[#EDE9DD] cursor-pointer"
                        >
                          <span className="font-medium text-[#1E2420]">{st.name}</span>
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
          className="hidden xl:flex items-center gap-2 font-mono text-xs text-[#525B55] tabular-nums pr-1"
          suppressHydrationWarning
        >
          <span className="h-2 w-2 rounded-full bg-[#285943]" />
          {formatISTDateTime(new Date(nowMs).toISOString())} IST
        </div>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={toggleSound}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1E2420]/12 bg-white text-[#525B55] transition-colors duration-150 hover:bg-[#EDE9DD] hover:text-[#1E2420] cursor-pointer"
          title={soundEnabled ? 'Sound alerts on' : 'Sound alerts muted'}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-[#285943]" strokeWidth={1.5} />
          ) : (
            <VolumeX className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
          )}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1E2420]/12 bg-white text-[#525B55] transition-colors duration-150 hover:bg-[#EDE9DD] hover:text-[#1E2420] cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            {data.notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C65D50] px-1 font-mono text-[10px] font-medium text-white tabular-nums">
                {data.notifications.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 rounded-xl border border-[#1E2420]/10 bg-[#FCFBF7] shadow-[0_8px_24px_rgba(30,36,32,0.08)] z-50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#1E2420]/8 px-4 py-3">
                <span className="text-xs font-medium text-[#1E2420]">
                  Live alerts ({data.notifications.length})
                </span>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="text-xs font-medium text-[#285943] hover:underline cursor-pointer"
                >
                  {soundEnabled ? 'Mute chimes' : 'Enable chimes'}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#1E2420]/8">
                {data.notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#707973]">
                    No pending alerts
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
                      className="px-4 py-3 hover:bg-[#EDE9DD]/60 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#1E2420]">{n.title}</span>
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
                      <p className="text-xs text-[#525B55] mt-1">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Session CTA */}
        <Button size="sm" onClick={() => openStartModal()}>
          <Play className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Add Session</span>
          <span className="sm:hidden">Start</span>
        </Button>

        {/* Sign Out */}
        <button
          type="button"
          onClick={logout}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1E2420]/12 bg-white text-[#707973] transition-colors duration-150 hover:bg-[#C65D50]/10 hover:text-[#C65D50] cursor-pointer"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
