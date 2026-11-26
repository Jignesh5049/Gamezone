import { getSessionStaff } from '@/lib/auth';
import { buildBootstrapPayload } from '@/lib/queries';
import { GameZoneProvider } from '@/context/gamezone-context';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const owner = await getSessionStaff();
  const initialBootstrap = buildBootstrapPayload(owner);

  return (
    <GameZoneProvider initialBootstrap={initialBootstrap}>
      <DashboardShell>{children}</DashboardShell>
    </GameZoneProvider>
  );
}
