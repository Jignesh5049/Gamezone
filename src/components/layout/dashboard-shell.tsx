'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { StartSessionModal } from '@/components/stations/start-session-modal';
import { CheckoutModal } from '@/components/sessions/checkout-modal';
import { ReceiptModal } from '@/components/sessions/receipt-modal';
import { TransferModal } from '@/components/stations/transfer-modal';
import { SessionDetailModal } from '@/components/sessions/session-detail-modal';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-[#F5F2E9] text-[#202723]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Operational Modals */}
      <StartSessionModal />
      <CheckoutModal />
      <ReceiptModal />
      <TransferModal />
      <SessionDetailModal />
    </div>
  );
}
