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
    <div className="flex h-full flex-col bg-[#1B211E] text-[#F2EFE7] select-none">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-[#F2EFE7]/8 px-4 shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0" onClick={onCloseMobile}>
          <svg
            viewBox="0 0 28 28"
            className="h-7 w-7 shrink-0"
            aria-hidden="true"
          >
            <rect width="28" height="28" rx="7" fill="#285943" />
            <circle cx="14" cy="14" r="5" fill="none" stroke="#F2EFE7" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="1.5" fill="#F2EFE7" />
          </svg>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[16px] leading-none font-medium text-[#F2EFE7] truncate">
                {data.settings.zone_name || 'Apex Arena'}
              </div>
              <div className="text-xs text-[#8B958D] mt-1">
                Floor desk
              </div>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8B958D] transition-colors duration-150 hover:bg-[#262E2A] hover:text-[#F2EFE7] cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8B958D] transition-colors duration-150 hover:bg-[#262E2A] hover:text-[#F2EFE7] cursor-pointer"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                'flex h-9 items-center gap-2 rounded-[8px] px-3 text-sm transition-[color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                active
                  ? 'bg-[#262E2A] text-[#F2EFE7] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#B4BCB5] font-normal hover:bg-[#262E2A]/70 hover:text-[#F2EFE7]',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-[#7EC49E]' : 'text-[#8B958D]'
                )}
                strokeWidth={1.5}
              />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badgeKey === 'live' && liveCount > 0 && (
                <span className="font-mono text-xs text-[#F2EFE7]/80 tabular-nums">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Status */}
      {!collapsed && (
        <div className="border-t border-[#F2EFE7]/8 px-4 py-4 text-xs text-[#8B958D] space-y-2">
          <div className="flex items-center justify-between">
            <span>Occupied stations</span>
            <span className="font-mono font-medium text-[#F2EFE7] tabular-nums">
              {data.todaySummary.occupiedStations}/{data.todaySummary.totalStations}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Timezone</span>
            <span className="font-mono text-[#B4BCB5]">IST (UTC+5:30)</span>
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-[8px] border border-[#F2EFE7]/10 bg-[#262E2A] px-3 text-xs font-medium text-[#F2EFE7] transition-colors duration-150 hover:bg-[#313B36] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-[#8B958D]" strokeWidth={1.5} />
            Reset demo data
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:block shrink-0 border-r border-[#F2EFE7]/8 no-print',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="fixed inset-0 bg-[#1E2420]/55" onClick={onCloseMobile} />
          <div className="relative z-10 h-full w-64">{content}</div>
        </div>
      )}
    </>
  );
}
