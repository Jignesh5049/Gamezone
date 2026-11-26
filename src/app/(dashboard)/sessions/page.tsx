'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Eye, Plus, Search, Square } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { formatISTDateTime } from '@/lib/timezone';
import { formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';
import type { SessionRecord } from '@/lib/types';

function SessionsContent() {
  const searchParams = useSearchParams();
  const {
    data,
    openSessionDetailModal,
    openCheckoutModal,
    extendSession,
  } = useGameZone();

  const [preset, setPreset] = React.useState(searchParams.get('preset') || '30d');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('all');
  const [stationId, setStationId] = React.useState('all');
  const [paymentStatus, setPaymentStatus] = React.useState(
    searchParams.get('paymentStatus') || 'all'
  );
  const [search, setSearch] = React.useState(searchParams.get('search') || '');
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({
      preset,
      categoryId,
      stationId,
      paymentStatus,
      search,
    });
    if (preset === 'custom' && from) qs.set('from', from);
    if (preset === 'custom' && to) qs.set('to', to);

    fetch(`/api/sessions?${qs.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { sessions: SessionRecord[] }) => {
        if (!active) return;
        setSessions(json.sessions || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    preset,
    from,
    to,
    categoryId,
    stationId,
    paymentStatus,
    search,
    data.activeSessions.length,
    data.todaySummary.todayCompletedSessions,
  ]);

  const exportUrl = `/api/exports?${new URLSearchParams({
    type: 'sessions',
    preset,
    categoryId,
    stationId,
    paymentStatus,
    search,
    ...(preset === 'custom' && from ? { from } : {}),
    ...(preset === 'custom' && to ? { to } : {}),
  }).toString()}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            All Sessions & Billing History
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            Audit, extend, end, cancel, settle pending balances, or export session logs
          </p>
        </div>

        <a href={exportUrl}>
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </a>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#8E9690] absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search session ID or station..."
              className="pl-8"
            />
          </div>

          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Date Range</option>
          </Select>

          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">All Game Categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="all">All Stations</option>
            {data.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </Select>

          <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="all">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Unpaid / Pending</option>
          </Select>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-[#646D67]">From:</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
            <span className="text-xs text-[#646D67]">To:</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </Card>

      {/* Sessions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] uppercase tracking-wider text-[#5A635D]">
              <tr>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Start / End (IST)</th>
                <th className="px-4 py-3 font-semibold">Duration / Paused</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5D7]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#646D67]">
                    Loading sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#646D67]">
                    No sessions match the selected filters.
                  </td>
                </tr>
              ) : (
                sessions.map((ses) => {
                  const isRunning = ses.status === 'active' || ses.status === 'paused';
                  return (
                    <tr key={ses.id} className="hover:bg-[#F5F2E9]/50">
                      <td className="px-4 py-3 font-mono font-semibold text-[#202723]">
                        {ses.session_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#202723]">{ses.station_name}</div>
                        <div className="text-[11px] text-[#646D67]">{ses.category_name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#5A635D]">
                        <div>{formatISTDateTime(ses.started_at)}</div>
                        <div>{ses.ended_at ? formatISTDateTime(ses.ended_at) : 'In progress'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div>
                          {ses.status === 'completed'
                            ? formatMinutesReadable(ses.billable_minutes)
                            : ses.planned_duration_minutes
                              ? `Plan ${ses.planned_duration_minutes}m`
                              : 'Open'}
                        </div>
                        {ses.accumulated_paused_seconds > 0 && (
                          <div className="text-[#8E5B13]">
                            Paused {Math.round(ses.accumulated_paused_seconds / 60)}m
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        <div>{formatINR(ses.final_amount)}</div>
                        {ses.discount_amount > 0 && (
                          <div className="text-[10px] text-[#285943]">
                            -{formatINR(ses.discount_amount)} disc
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            ses.payment_status === 'paid'
                              ? 'green'
                              : ses.payment_status === 'partial'
                                ? 'amber'
                                : 'red'
                          }
                          className="capitalize"
                        >
                          {ses.payment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            ses.status === 'active'
                              ? 'red'
                              : ses.status === 'paused'
                                ? 'amber'
                                : ses.status === 'completed'
                                  ? 'green'
                                  : 'grey'
                          }
                          className="capitalize"
                        >
                          {ses.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {isRunning && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => extendSession(ses.id, 30)}
                                title="Extend +30m"
                              >
                                <Plus className="h-3 w-3" />
                                30m
                              </Button>
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => openCheckoutModal(ses.id)}
                              >
                                <Square className="h-3 w-3" />
                                End
                              </Button>
                            </>
                          )}
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => openSessionDetailModal(ses.id)}
                          >
                            <Eye className="h-3 w-3" />
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#646D67]">Loading sessions...</div>}>
      <SessionsContent />
    </Suspense>
  );
}
