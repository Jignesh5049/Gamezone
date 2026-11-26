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
import { downloadCsvFile, listFilteredSessions } from '@/lib/demo-store';
import { formatISTDateTime } from '@/lib/timezone';
import { formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';

function SessionsContent() {
  const searchParams = useSearchParams();
  const { data, openSessionDetailModal, openCheckoutModal, extendSession } = useGameZone();

  const [preset, setPreset] = React.useState(searchParams.get('preset') || '30d');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('all');
  const [stationId, setStationId] = React.useState('all');
  const [paymentStatus, setPaymentStatus] = React.useState(
    searchParams.get('paymentStatus') || 'all'
  );
  const [search, setSearch] = React.useState(searchParams.get('search') || '');

  const sessions = React.useMemo(() => {
    void data;
    return listFilteredSessions({
      preset,
      from,
      to,
      categoryId,
      stationId,
      paymentStatus,
      search,
    });
  }, [data, preset, from, to, categoryId, stationId, paymentStatus, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            All sessions
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Review, extend, end, cancel, settle pending balances, or export session logs
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsvFile('sessions', {
              preset,
              from,
              to,
              categoryId,
              stationId,
              paymentStatus,
              search,
            })
          }
        >
          <Download className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
          Export CSV
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search
              className="h-4 w-4 text-[#707973] absolute left-3 top-2.5"
              strokeWidth={1.5}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search session ID or station"
              className="pl-9"
            />
          </div>

          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom date range</option>
          </Select>

          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">All game categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="all">All stations</option>
            {data.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </Select>

          <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="all">All payment statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially paid</option>
            <option value="unpaid">Unpaid / pending</option>
          </Select>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-[#707973]">From</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
            <span className="text-xs text-[#707973]">To</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
              <tr>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Start / end (IST)</th>
                <th className="px-4 py-3 font-medium">Duration / paused</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2420]/8">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#707973]">
                    No sessions match these filters
                  </td>
                </tr>
              ) : (
                sessions.map((ses) => {
                  const isRunning = ses.status === 'active' || ses.status === 'paused';
                  return (
                    <tr key={ses.id} className="hover:bg-[#F5F2E9]/50">
                      <td className="px-4 py-3 font-mono font-medium text-[#1E2420]">
                        {ses.session_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1E2420]">{ses.station_name}</div>
                        <div className="text-xs text-[#707973]">{ses.category_name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#525B55] tabular-nums">
                        <div>{formatISTDateTime(ses.started_at)}</div>
                        <div>{ses.ended_at ? formatISTDateTime(ses.ended_at) : 'In progress'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">
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
                      <td className="px-4 py-3 font-mono font-medium tabular-nums">
                        <div>{formatINR(ses.final_amount)}</div>
                        {ses.discount_amount > 0 && (
                          <div className="text-xs text-[#285943]">
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
                                <Plus className="h-4 w-4" strokeWidth={1.5} />
                                30m
                              </Button>
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => openCheckoutModal(ses.id)}
                              >
                                <Square className="h-4 w-4" strokeWidth={1.5} />
                                End
                              </Button>
                            </>
                          )}
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => openSessionDetailModal(ses.id)}
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.5} />
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
    <Suspense fallback={<div className="p-6 text-sm text-[#707973]">Loading sessions</div>}>
      <SessionsContent />
    </Suspense>
  );
}
