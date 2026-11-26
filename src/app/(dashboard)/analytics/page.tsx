'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Download, Trophy } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { computeAnalytics, downloadCsvFile } from '@/lib/demo-store';
import { formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';

const CHART_COLORS = ['#285943', '#D89B45', '#202723', '#A8B8A0', '#C65D50'];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Revenue & Business Analytics
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            Calculated strictly from recorded payment transactions; pending payments tracked separately
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
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
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
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-[#646D67]">Today&apos;s Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#285943]">
            {formatINR(analytics.summary.todayRevenue)}
          </div>
          <div className="text-[11px] text-[#646D67] mt-0.5">Collected today (IST)</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-[#646D67]">Weekly Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#202723]">
            {formatINR(analytics.summary.weeklyRevenue)}
          </div>
          <div className="text-[11px] text-[#646D67] mt-0.5">Last 7 days</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-[#646D67]">Monthly Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#202723]">
            {formatINR(analytics.summary.monthlyRevenue)}
          </div>
          <div className="text-[11px] text-[#646D67] mt-0.5">Last 30 days</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold text-[#646D67]">Total Collected</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#202723]">
            {formatINR(analytics.summary.totalRevenue)}
          </div>
          <div className="text-[11px] text-[#8E5B13] mt-0.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Pending: {formatINR(analytics.summary.pendingPaymentsAmount)} (
            {analytics.summary.pendingPaymentsCount})
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3.5">
          <div className="text-[11px] text-[#646D67]">Completed Sessions</div>
          <div className="font-mono text-lg font-bold mt-1">
            {analytics.summary.totalSessions}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[11px] text-[#646D67]">Total Gaming Hours</div>
          <div className="font-mono text-lg font-bold mt-1">
            {analytics.summary.totalGamingHours}h
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[11px] text-[#646D67]">Avg Session Duration</div>
          <div className="font-mono text-lg font-bold mt-1">
            {formatMinutesReadable(analytics.summary.avgSessionDurationMinutes)}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[11px] text-[#646D67] flex items-center gap-1">
            <Trophy className="h-3 w-3 text-[#D89B45]" /> Most Popular Game
          </div>
          <div className="text-sm font-bold mt-1 truncate">
            {analytics.summary.mostPopularGame}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[11px] text-[#646D67] flex items-center gap-1">
            <Trophy className="h-3 w-3 text-[#285943]" /> Top Station
          </div>
          <div className="text-sm font-bold mt-1 truncate">
            {analytics.summary.mostProfitableStation}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#202723]">
                Collected Revenue Trend
              </h3>
              <p className="text-[11px] text-[#646D67]">
                Switch between daily, weekly, and monthly views
              </p>
            </div>
            <div className="flex gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setTrendMode(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize cursor-pointer ${
                    trendMode === m
                      ? 'bg-[#285943] text-white'
                      : 'bg-[#F5F2E9] text-[#5A635D]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE5D7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5A635D' }} />
                <YAxis tick={{ fontSize: 11, fill: '#5A635D' }} />
                <Tooltip
                  formatter={(val) => [formatINR(Number(val)), 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#FCFBF7',
                    borderColor: '#DFD9C8',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill="#285943" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[#202723]">
            Revenue by Game Category
          </h3>
          <p className="text-[11px] text-[#646D67] mb-3">Share of collected payments</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.revenueByCategory}
                  dataKey="revenue"
                  nameKey="categoryName"
                  innerRadius={42}
                  outerRadius={76}
                  paddingAngle={3}
                >
                  {analytics.revenueByCategory.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatINR(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 text-xs mt-2">
            {analytics.revenueByCategory.map((c, idx) => (
              <div key={c.categoryId} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  {c.categoryName} ({c.sessions} sessions)
                </span>
                <span className="font-mono font-semibold">{formatINR(c.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[#202723]">
            Peak Business Hours (IST)
          </h3>
          <p className="text-[11px] text-[#646D67] mb-3">
            Session start volume by hour of day
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE5D7" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5A635D' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5A635D' }} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#D89B45" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Revenue by Individual Station"
            subtitle="Collected revenue & utilization hours"
          />
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] text-[#5A635D]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Station</th>
                  <th className="px-4 py-2.5 font-semibold">Sessions</th>
                  <th className="px-4 py-2.5 font-semibold">Hours</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5D7]">
                {analytics.revenueByStation.map((row) => (
                  <tr key={row.stationId}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{row.stationName}</div>
                      <div className="text-[10px] text-[#646D67]">{row.categoryName}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{row.sessions}</td>
                    <td className="px-4 py-2.5 font-mono">{row.hours}h</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#285943] text-right">
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
