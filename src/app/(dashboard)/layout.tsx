import { GameZoneProvider } from '@/context/gamezone-context';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GameZoneProvider>
      <DashboardShell>{children}</DashboardShell>
    </GameZoneProvider>
  );
}
