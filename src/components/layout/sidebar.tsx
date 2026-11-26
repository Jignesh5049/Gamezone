'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Gamepad2,
  IndianRupee,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import { useGameZone } from '@/context/gamezone-context';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { href: '/', label: 'Gaming Stations', icon: Gamepad2, badgeKey: 'live' as const },
  { href: '/sessions', label: 'All Sessions', icon: ClipboardList },
  { href: '/pricing', label: 'Pricing', icon: IndianRupee },
  { href: '/bookings', label: 'Bookings', icon: CalendarClock },
  { href: '/analytics', label: 'Revenue & Analytics', icon: BarChart3 },
  { href: '/inventory', label: 'Inventory & Maintenance', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileSpreadsheet },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { data, resetDemo } = useGameZone();
  const liveCount = data.activeSessions.length;

  const content = (
    <div className="flex h-full flex-col bg-[#202723] text-[#F5F2E9] select-none">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-[#2F3933] px-3.5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={onCloseMobile}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#285943] text-[#FCFBF7] font-bold text-sm tracking-tight">
            AA
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">
                {data.settings.zone_name || 'Apex Arena'}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#A8B8A0]">
                Zone Manager
              </div>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-[#A8B8A0] hover:bg-[#2B352F] hover:text-[#F5F2E9] cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-[#A8B8A0] hover:bg-[#2B352F] cursor-pointer"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-[#285943] text-[#FCFBF7]'
                  : 'text-[#C6CEC8] hover:bg-[#2B352F] hover:text-[#FCFBF7]',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badgeKey === 'live' && liveCount > 0 && (
                <span className="rounded-full bg-[#C65D50] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Status */}
      {!collapsed && (
        <div className="border-t border-[#2F3933] px-3.5 py-3 text-[11px] text-[#A8B8A0]">
          <div className="flex items-center justify-between">
            <span>Occupied Stations</span>
            <span className="font-mono font-semibold text-[#F5F2E9]">
              {data.todaySummary.occupiedStations}/{data.todaySummary.totalStations}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Timezone</span>
            <span className="font-mono text-[#F5F2E9]">IST (UTC+5:30)</span>
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#344039] bg-[#2B352F] px-2.5 py-1.5 text-[11px] font-medium text-[#F5F2E9] hover:bg-[#344039] cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Demo Data
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:block shrink-0 border-r border-[#2F3933] transition-all duration-200 no-print',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="fixed inset-0 bg-black/50" onClick={onCloseMobile} />
          <div className="relative z-10 h-full w-64">{content}</div>
        </div>
      )}
    </>
  );
}
