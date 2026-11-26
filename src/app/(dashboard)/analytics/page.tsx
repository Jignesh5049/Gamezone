'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { computeAnalytics, downloadCsvFile } from '@/lib/demo-store';
import { formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data } = useGameZone();
  const [preset, setPreset] = React.useState<'today' | 'yesterday' | '7d' | '30d' | 'custom'>('30d');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [trendMode, setTrendMode] = React.useState<'daily' | 'weekly' | 'monthly'>('daily');

  const analytics = React.useMemo(() => {
    void data;
    return computeAnalytics(preset, from || undefined, to || undefined);
  }, [data, preset, from, to]);

  const trendData =
    trendMode === 'daily'
      ? analytics.dailySeries
      : trendMode === 'weekly'
        ? analytics.weeklySeries
        : analytics.monthlySeries;

  const totalCategoryRevenue = analytics.revenueByCategory.reduce(
    (sum, c) => sum + c.revenue,
    0
  );
  const maxHourSessions = Math.max(0, ...analytics.peakHours.map((h) => h.sessions));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            Revenue & analytics
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Collected payments in IST — pending dues are tracked separately
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value as typeof preset)}
            className="w-40 h-8 text-xs"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </Select>
          {preset === 'custom' && (
            <>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-36 h-8 text-xs"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-36 h-8 text-xs"
              />
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsvFile('revenue')}
          >
            <Download className="h-4 w-4 text-[#707973]" strokeWidth={1.5} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-[#707973]">Today&apos;s revenue</div>
          <div className="mt-2 font-mono text-[28px] leading-none font-medium text-[#285943] tabular-nums">
            {formatINR(analytics.summary.todayRevenue)}
          </div>
          <div className="text-xs text-[#707973] mt-2">Collected today (IST)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#707973]">Weekly revenue</div>
          <div className="mt-2 font-mono text-[28px] leading-none font-medium text-[#1E2420] tabular-nums">
            {formatINR(analytics.summary.weeklyRevenue)}
          </div>
          <div className="text-xs text-[#707973] mt-2">Last 7 days</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#707973]">Monthly revenue</div>
          <div className="mt-2 font-mono text-[28px] leading-none font-medium text-[#1E2420] tabular-nums">
            {formatINR(analytics.summary.monthlyRevenue)}
          </div>
          <div className="text-xs text-[#707973] mt-2">Last 30 days</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#707973]">Total collected</div>
          <div className="mt-2 font-mono text-[28px] leading-none font-medium text-[#1E2420] tabular-nums">
            {formatINR(analytics.summary.totalRevenue)}
          </div>
          <div className="text-xs text-[#8E5B13] mt-2 tabular-nums">
            Pending: {formatINR(analytics.summary.pendingPaymentsAmount)} (
            {analytics.summary.pendingPaymentsCount})
          </div>
        </Card>
      </div>

      {/* Compact Secondary Metrics Strip */}
      <Card className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#1E2420]/8">
        <div className="p-4">
          <div className="text-xs text-[#707973]">Completed sessions</div>
          <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
            {analytics.summary.totalSessions}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-[#707973]">Gaming hours</div>
          <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
            {analytics.summary.totalGamingHours}h
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-[#707973]">Avg duration</div>
          <div className="font-mono text-lg font-medium text-[#1E2420] mt-1 tabular-nums">
            {formatMinutesReadable(analytics.summary.avgSessionDurationMinutes)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-[#707973]">Most popular</div>
          <div className="text-sm font-medium text-[#1E2420] mt-1 truncate">
            {analytics.summary.mostPopularGame}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-[#707973]">Top station</div>
          <div className="text-sm font-medium text-[#1E2420] mt-1 truncate">
            {analytics.summary.mostProfitableStation}
          </div>
        </div>
      </Card>

      {/* Main Chart + Ranked Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-[#1E2420]">
                Collected revenue trend
              </h3>
              <p className="text-xs text-[#707973] mt-0.5">
                Daily, weekly, and monthly collections
              </p>
            </div>
            <div className="flex gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setTrendMode(m)}
                  className={`h-8 rounded-[6px] px-3 text-xs font-medium capitalize cursor-pointer transition-colors duration-150 ${
                    trendMode === m
                      ? 'bg-[#285943] text-white'
                      : 'bg-[#F5F2E9] text-[#525B55] hover:bg-[#EDE9DD]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid vertical={false} stroke="rgba(30,36,32,0.08)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#707973', fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#707973', fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip
                  formatter={(val) => [formatINR(Number(val)), 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#FCFBF7',
                    borderColor: 'rgba(30,36,32,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill="#285943" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#1E2420]">
              Revenue by game category
            </h3>
            <p className="text-xs text-[#707973] mt-0.5">
              Share of collected payments
            </p>
          </div>

          <div className="mt-4 space-y-4 flex-1">
            {analytics.revenueByCategory.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#707973]">
                No category revenue recorded
              </div>
            ) : (
              analytics.revenueByCategory.map((c, idx) => {
                const share =
                  totalCategoryRevenue > 0
                    ? Math.round((c.revenue / totalCategoryRevenue) * 100)
                    : 0;
                const ratio =
                  totalCategoryRevenue > 0 ? c.revenue / totalCategoryRevenue : 0;
                return (
                  <div key={c.categoryId} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-[#1E2420] truncate">
                        {c.categoryName}
                      </span>
                      <span className="font-mono font-medium text-[#1E2420] tabular-nums shrink-0">
                        {formatINR(c.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#1E2420]/8 overflow-hidden">
                      <div
                        className={
                          idx === 0
                            ? 'h-full w-full origin-left bg-[#285943]'
                            : 'h-full w-full origin-left bg-[#1E2420]/30'
                        }
                        style={{ transform: `scaleX(${ratio})` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#707973] tabular-nums">
                      <span>{c.sessions} sessions</span>
                      <span className="font-mono">{share}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Peak Hours & Station Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#1E2420]">
            Peak business hours (IST)
          </h3>
          <p className="text-xs text-[#707973] mt-0.5 mb-4">
            Session start volume by hour of day
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.peakHours}>
                <CartesianGrid vertical={false} stroke="rgba(30,36,32,0.08)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#707973', fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#707973', fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FCFBF7',
                    borderColor: 'rgba(30,36,32,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sessions" radius={[3, 3, 0, 0]}>
                  {analytics.peakHours.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        maxHourSessions > 0 && entry.sessions === maxHourSessions
                          ? '#285943'
                          : '#D4CFC1'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Revenue by station"
            subtitle="Collected revenue and utilization hours"
          />
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
                <tr>
                  <th className="px-4 py-3 font-medium">Station</th>
                  <th className="px-4 py-3 font-medium">Sessions</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2420]/8">
                {analytics.revenueByStation.map((row) => (
                  <tr key={row.stationId} className="hover:bg-[#F5F2E9]/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1E2420]">{row.stationName}</div>
                      <div className="text-xs text-[#707973]">{row.categoryName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.sessions}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.hours}h</td>
                    <td className="px-4 py-3 font-mono font-medium text-[#285943] text-right tabular-nums">
                      {formatINR(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
