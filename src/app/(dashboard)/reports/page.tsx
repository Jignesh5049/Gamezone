'use client';

import * as React from 'react';
import { Download, Printer } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { formatISTDateTime, getISTDateKey } from '@/lib/timezone';
import { formatINR } from '@/lib/utils';
import type { PaymentRecord } from '@/lib/types';

interface DailyClosing {
  date: string;
  cashReceived: number;
  upiReceived: number;
  cardReceived: number;
  otherReceived: number;
  totalCollected: number;
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  totalSessions: number;
  totalGamingHours: number;
  totalDiscounts: number;
  netRevenue: number;
  payments: PaymentRecord[];
}

export default function ReportsPage() {
  const { data } = useGameZone();
  const [dateKey, setDateKey] = React.useState(() => getISTDateKey());
  const [report, setReport] = React.useState<DailyClosing | null>(null);
  const [loadedDate, setLoadedDate] = React.useState('');
  const loading = loadedDate !== dateKey;

  React.useEffect(() => {
    let active = true;
    fetch(`/api/reports/daily-closing?date=${dateKey}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active) {
          setReport(j);
          setLoadedDate(dateKey);
        }
      });
    return () => {
      active = false;
    };
  }, [dateKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Daily Closing & Data Exports
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            End-of-day cash drawer reconciliation, payment breakdown, and CSV downloads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="w-40 h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print Closing Sheet
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <div className="py-10 text-center text-sm text-[#646D67]">
          Building daily closing report...
        </div>
      ) : (
        <div className="print-only-area space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE5D7] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#202723]">
                  {data.settings.zone_name || 'Apex Arena'} — Daily Closing Summary
                </h2>
                <p className="text-xs text-[#646D67]">
                  Business Date (IST): <strong className="font-mono">{report.date}</strong>
                </p>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-[#646D67]">
                  Total Collected Revenue
                </div>
                <div className="font-mono text-2xl font-bold text-[#285943]">
                  {formatINR(report.netRevenue)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9] p-3">
                <div className="text-[11px] text-[#646D67]">Cash Received</div>
                <div className="font-mono text-lg font-bold mt-0.5">
                  {formatINR(report.cashReceived)}
                </div>
              </div>
              <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9] p-3">
                <div className="text-[11px] text-[#646D67]">UPI Received</div>
                <div className="font-mono text-lg font-bold mt-0.5">
                  {formatINR(report.upiReceived)}
                </div>
              </div>
              <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9] p-3">
                <div className="text-[11px] text-[#646D67]">Card Payments</div>
                <div className="font-mono text-lg font-bold mt-0.5">
                  {formatINR(report.cardReceived)}
                </div>
              </div>
              <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9] p-3">
                <div className="text-[11px] text-[#646D67]">Pending Payments</div>
                <div className="font-mono text-lg font-bold text-[#D89B45] mt-0.5">
                  {formatINR(report.pendingPaymentsAmount)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-[#EAE5D7]">
              <div>
                <span className="text-[#646D67]">Total Completed Sessions:</span>{' '}
                <strong className="font-mono">{report.totalSessions}</strong>
              </div>
              <div>
                <span className="text-[#646D67]">Total Gaming Hours:</span>{' '}
                <strong className="font-mono">{report.totalGamingHours}h</strong>
              </div>
              <div>
                <span className="text-[#646D67]">Total Discounts Given:</span>{' '}
                <strong className="font-mono">{formatINR(report.totalDiscounts)}</strong>
              </div>
              <div>
                <span className="text-[#646D67]">Other Payments:</span>{' '}
                <strong className="font-mono">{formatINR(report.otherReceived)}</strong>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={`Payments Collected (${report.payments.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] text-[#5A635D]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Receipt #</th>
                    <th className="px-4 py-2.5 font-semibold">Station / Session</th>
                    <th className="px-4 py-2.5 font-semibold">Method</th>
                    <th className="px-4 py-2.5 font-semibold">Time (IST)</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE5D7]">
                  {report.payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[#646D67]">
                        No completed payments on {report.date}.
                      </td>
                    </tr>
                  ) : (
                    report.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-mono font-semibold">
                          {p.receipt_number}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.station_name} ({p.session_code})
                        </td>
                        <td className="px-4 py-2.5 uppercase font-mono">{p.method}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          {formatISTDateTime(p.paid_at)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-[#285943] text-right">
                          {formatINR(p.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-5 no-print">
        <h3 className="text-sm font-bold text-[#202723] mb-1">CSV Export Center</h3>
        <p className="text-xs text-[#646D67] mb-4">
          Download full, spreadsheet-ready records with IST timestamps
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { type: 'sessions', label: 'All Sessions' },
            { type: 'payments', label: 'Payment Transactions' },
            { type: 'revenue', label: 'Station Revenue Summary' },
          ].map((item) => (
            <a key={item.type} href={`/api/exports?type=${item.type}`}>
              <Button variant="outline" className="w-full justify-between">
                <span>{item.label}</span>
                <Download className="h-3.5 w-3.5 text-[#285943]" />
              </Button>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
