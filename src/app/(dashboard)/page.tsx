'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, FolderPlus, Play, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldLabel, Input, Select } from '@/components/ui/input';
import { StationCard } from '@/components/stations/station-card';
import { useGameZone } from '@/context/gamezone-context';
import { formatINR } from '@/lib/utils';

export default function GamingStationsPage() {
  const { data, openStartModal, refresh, notify } = useGameZone();
  const [selectedCat, setSelectedCat] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [addStationOpen, setAddStationOpen] = React.useState(false);
  const [addCatOpen, setAddCatOpen] = React.useState(false);

  // Add Station form
  const [stName, setStName] = React.useState('');
  const [stCatId, setStCatId] = React.useState(data.categories[0]?.id || '');
  const [stRate30, setStRate30] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Add Category form
  const [catName, setCatName] = React.useState('');
  const [catDesc, setCatDesc] = React.useState('');
  const [catRate30, setCatRate30] = React.useState('100');

  const summary = data.todaySummary;

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: stCatId || data.categories[0]?.id,
          name: stName,
          customRate30: stRate30 ? Number(stRate30) : null,
          customRate60: stRate30 ? Number(stRate30) * 2 : null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(json.error || 'Failed to add station', 'error');
        return;
      }
      notify(`Added station "${stName}"`, 'success');
      setAddStationOpen(false);
      setStName('');
      setStRate30('');
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: catName,
          description: catDesc || null,
          defaultRate30: Number(catRate30) || 100,
          defaultRate60: (Number(catRate30) || 100) * 2,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(json.error || 'Failed to add category', 'error');
        return;
      }
      notify(`Added category "${catName}"`, 'success');
      setAddCatOpen(false);
      setCatName('');
      setCatDesc('');
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const visibleCategories =
    selectedCat === 'all'
      ? data.categories
      : data.categories.filter((c) => c.id === selectedCat);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Gaming Stations
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            Every station operates with an independent live timer and real-time billing tracker
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openStartModal()}>
            <Play className="h-3.5 w-3.5" />
            Add Session
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openStartModal({ groupMode: true })}
          >
            <Users className="h-3.5 w-3.5" />
            Group Booking
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddCatOpen(true)}>
            <FolderPlus className="h-3.5 w-3.5" />
            Add Game Category
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStCatId(data.categories[0]?.id || '');
              setAddStationOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Station
          </Button>
        </div>
      </div>

      {/* Compact Floor & Daily Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-4 py-3">
          <div className="text-[11px] font-semibold text-[#646D67]">Occupied</div>
          <div className="font-mono text-xl font-bold text-[#C65D50] mt-0.5 tabular-nums">
            {summary.occupiedStations}/{summary.totalStations}
          </div>
        </div>
        <div className="rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-4 py-3">
          <div className="text-[11px] font-semibold text-[#646D67]">Available</div>
          <div className="font-mono text-xl font-bold text-[#285943] mt-0.5 tabular-nums">
            {summary.availableStations}
          </div>
        </div>
        <div className="rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-4 py-3">
          <div className="text-[11px] font-semibold text-[#646D67]">Active Timers</div>
          <div className="font-mono text-xl font-bold text-[#D89B45] mt-0.5 tabular-nums">
            {summary.activeSessionsCount}
          </div>
        </div>
        <div className="rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-4 py-3">
          <div className="text-[11px] font-semibold text-[#646D67]">Today&apos;s Revenue</div>
          <div className="font-mono text-xl font-bold text-[#285943] mt-0.5 tabular-nums">
            {formatINR(summary.todayRevenue)}
          </div>
        </div>
      </div>

      {summary.pendingPaymentsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D89B45]/45 bg-[#D89B45]/12 px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-2 font-medium text-[#202723]">
            <AlertTriangle className="h-4 w-4 text-[#8E5B13]" />
            {summary.pendingPaymentsCount} session{summary.pendingPaymentsCount > 1 ? 's' : ''} with pending payment ({formatINR(summary.pendingPaymentsAmount)})
          </span>
          <Link href="/sessions?paymentStatus=unpaid">
            <Button size="xs" variant="amber">
              View Pending
            </Button>
          </Link>
        </div>
      )}

      {/* Category & Status Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              selectedCat === 'all'
                ? 'bg-[#202723] text-[#F5F2E9]'
                : 'bg-[#F5F2E9] text-[#5A635D] hover:bg-[#EDE9DD]'
            }`}
          >
            All Games ({data.stations.length})
          </button>
          {data.categories.map((cat) => {
            const count = data.stations.filter((s) => s.category_id === cat.id).length;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  selectedCat === cat.id
                    ? 'bg-[#285943] text-[#FCFBF7]'
                    : 'bg-[#F5F2E9] text-[#5A635D] hover:bg-[#EDE9DD]'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available Only</option>
            <option value="occupied">Occupied Only</option>
            <option value="maintenance">Maintenance / Disabled</option>
          </Select>
        </div>
      </div>

      {/* Stations Grouped by Category */}
      <div className="space-y-6">
        {visibleCategories.map((cat) => {
          const stations = data.stations.filter((st) => {
            if (st.category_id !== cat.id) return false;
            if (statusFilter === 'all') return true;
            if (statusFilter === 'maintenance') {
              return st.status === 'maintenance' || st.status === 'disabled';
            }
            return st.status === statusFilter;
          });

          if (stations.length === 0) return null;

          return (
            <section key={cat.id} className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-[#DFD9C8] pb-2">
                <div>
                  <h2 className="text-base font-bold text-[#202723]">{cat.name}</h2>
                  {cat.description && (
                    <p className="text-xs text-[#646D67]">{cat.description}</p>
                  )}
                </div>
                <span className="font-mono text-xs text-[#5A635D]">
                  {stations.filter((x) => x.status === 'available').length} available /{' '}
                  {stations.length} total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stations.map((st) => (
                  <StationCard key={st.id} station={st} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add Station Modal */}
      <Modal
        open={addStationOpen}
        onClose={() => setAddStationOpen(false)}
        title="Add Gaming Station"
        subtitle="Create a new rentable table, console, or bay"
      >
        <form onSubmit={handleCreateStation} className="space-y-3.5">
          <div>
            <FieldLabel>Category</FieldLabel>
            <Select value={stCatId} onChange={(e) => setStCatId(e.target.value)}>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Station Name</FieldLabel>
            <Input
              required
              value={stName}
              onChange={(e) => setStName(e.target.value)}
              placeholder="e.g., Pool Table 04"
            />
          </div>
          <div>
            <FieldLabel hint="Leave blank for category rate">Custom Rate ₹ / 30m</FieldLabel>
            <Input
              type="number"
              min={0}
              value={stRate30}
              onChange={(e) => setStRate30(e.target.value)}
              placeholder="e.g., 120"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setAddStationOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Create Station'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        open={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        title="Add Game Category"
        subtitle="Add a new facility type such as VR Arena, Snooker, or Sim Racing"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3.5">
          <div>
            <FieldLabel>Category Name</FieldLabel>
            <Input
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g., VR Racing Sim"
            />
          </div>
          <div>
            <FieldLabel>Default Rate per 30 Minutes (₹)</FieldLabel>
            <Input
              type="number"
              min={0}
              required
              value={catRate30}
              onChange={(e) => setCatRate30(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel hint="Optional">Description</FieldLabel>
            <Input
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Short description of this gaming zone"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setAddCatOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
