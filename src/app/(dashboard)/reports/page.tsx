'use client';

import * as React from 'react';
import { Download, Printer } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { computeDailyClosing, downloadCsvFile } from '@/lib/demo-store';
import { formatISTDateTime, getISTDateKey } from '@/lib/timezone';
import { formatINR } from '@/lib/utils';

export default function ReportsPage() {
  const { data } = useGameZone();
  const [dateKey, setDateKey] = React.useState(() => getISTDateKey());

  const report = React.useMemo(() => {
    void data;
    return computeDailyClosing(dateKey);
  }, [data, dateKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            Daily closing & exports
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Cash drawer reconciliation, payment breakdown, and CSV downloads
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
            <Printer className="h-4 w-4 text-[#707973]" strokeWidth={1.5} /> Print closing sheet
          </Button>
        </div>
      </div>

      <div className="print-only-area space-y-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E2420]/8 pb-4">
            <div>
              <h2 className="text-base font-medium text-[#1E2420]">
                {data.settings.zone_name || 'Apex Arena'} — Daily closing summary
              </h2>
              <p className="text-xs text-[#707973] mt-1">
                Business date (IST): <span className="font-mono font-medium text-[#1E2420]">{report.date}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#707973]">
                Total collected revenue
              </div>
              <div className="font-mono text-[28px] leading-none font-medium text-[#285943] mt-1 tabular-nums">
                {formatINR(report.netRevenue)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Cash received</div>
              <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
                {formatINR(report.cashReceived)}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">UPI received</div>
              <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
                {formatINR(report.upiReceived)}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Card payments</div>
              <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
                {formatINR(report.cardReceived)}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Pending payments</div>
              <div className="font-mono text-lg font-medium text-[#8E5B13] mt-1 tabular-nums">
                {formatINR(report.pendingPaymentsAmount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-[#1E2420]/8">
            <div>
              <span className="text-[#707973]">Completed sessions:</span>{' '}
              <span className="font-mono font-medium text-[#1E2420] tabular-nums">{report.totalSessions}</span>
            </div>
            <div>
              <span className="text-[#707973]">Gaming hours:</span>{' '}
              <span className="font-mono font-medium text-[#1E2420] tabular-nums">{report.totalGamingHours}h</span>
            </div>
            <div>
              <span className="text-[#707973]">Discounts given:</span>{' '}
              <span className="font-mono font-medium text-[#1E2420] tabular-nums">{formatINR(report.totalDiscounts)}</span>
            </div>
            <div>
              <span className="text-[#707973]">Other payments:</span>{' '}
              <span className="font-mono font-medium text-[#1E2420] tabular-nums">{formatINR(report.otherReceived)}</span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={`Payments collected (${report.payments.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
                <tr>
                  <th className="px-4 py-3 font-medium">Receipt #</th>
                  <th className="px-4 py-3 font-medium">Station / session</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Time (IST)</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2420]/8">
                {report.payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[#707973]">
                      No completed payments on {report.date}
                    </td>
                  </tr>
                ) : (
                  report.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-medium">
                        {p.receipt_number}
                      </td>
                      <td className="px-4 py-3">
                        {p.station_name} ({p.session_code})
                      </td>
                      <td className="px-4 py-3 uppercase font-mono">{p.method}</td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">
                        {formatISTDateTime(p.paid_at)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-[#285943] text-right tabular-nums">
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

      <Card className="p-5 no-print">
        <h3 className="text-sm font-medium text-[#1E2420] mb-1">CSV export center</h3>
        <p className="text-xs text-[#707973] mb-4">
          Download spreadsheet-ready records with IST timestamps
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              { type: 'sessions', label: 'All sessions' },
              { type: 'payments', label: 'Payment transactions' },
              { type: 'revenue', label: 'Station revenue summary' },
            ] as const
          ).map((item) => (
            <Button
              key={item.type}
              variant="outline"
              className="w-full justify-between"
              onClick={() => downloadCsvFile(item.type)}
            >
              <span>{item.label}</span>
              <Download className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
