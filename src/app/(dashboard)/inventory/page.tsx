'use client';

import * as React from 'react';
import { CheckCircle2, Edit2, Plus, Wrench } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldLabel, Input, Select, Textarea } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import {
  completeMaintenance,
  createMaintenance,
  listMaintenance,
  updateStation,
} from '@/lib/demo-store';
import { formatISTDateTime } from '@/lib/timezone';
import { formatINR } from '@/lib/utils';
import type { GamingStation, MaintenanceRecord } from '@/lib/types';

export default function InventoryPage() {
  const { data, refresh, notify } = useGameZone();
  const [tick, setTick] = React.useState(0);
  const records = React.useMemo(() => {
    void data;
    void tick;
    return listMaintenance();
  }, [data, tick]);

  const [maintOpen, setMaintOpen] = React.useState(false);
  const [mStationId, setMStationId] = React.useState(data.stations[0]?.id || '');
  const [mTitle, setMTitle] = React.useState('');
  const [mDesc, setMDesc] = React.useState('');
  const [mCost, setMCost] = React.useState(0);
  const [mTech, setMTech] = React.useState('');
  const [mSetMaint, setMSetMaint] = React.useState(true);

  const [editStation, setEditStation] = React.useState<GamingStation | null>(null);
  const [stName, setStName] = React.useState('');
  const [stModel, setStModel] = React.useState('');
  const [stPurchaseDate, setStPurchaseDate] = React.useState('');
  const [stPurchaseCost, setStPurchaseCost] = React.useState('');
  const [stNotes, setStNotes] = React.useState('');

  const toggleStationStatus = async (
    st: GamingStation,
    nextStatus: 'available' | 'maintenance' | 'disabled'
  ) => {
    const res = updateStation(st.id, { status: nextStatus });
    if (!res.ok) {
      notify(res.error || 'Could not update station status', 'error');
      return;
    }
    notify(`${st.name} marked as ${nextStatus}`, 'success');
    await refresh();
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = createMaintenance({
      stationId: mStationId,
      issueTitle: mTitle,
      description: mDesc || null,
      cost: Number(mCost) || 0,
      technician: mTech || null,
      setStationMaintenance: mSetMaint,
    });
    if (!res.ok) {
      notify(res.error || 'Failed to log maintenance', 'error');
      return;
    }
    notify('Maintenance logged', 'success');
    setMaintOpen(false);
    setMTitle('');
    setMDesc('');
    setMCost(0);
    setMTech('');
    setTick((t) => t + 1);
    await refresh();
  };

  const handleCompleteMaint = async (rec: MaintenanceRecord) => {
    completeMaintenance(rec.id);
    notify('Maintenance marked completed & station restored', 'success');
    setTick((t) => t + 1);
    await refresh();
  };

  const handleSaveStationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStation) return;
    const res = updateStation(editStation.id, {
      name: stName,
      equipmentModel: stModel || null,
      purchaseDate: stPurchaseDate || null,
      purchaseCost: stPurchaseCost ? Number(stPurchaseCost) : null,
      notes: stNotes || null,
    });
    if (res.ok) {
      notify('Equipment details updated', 'success');
      setEditStation(null);
      await refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            Inventory & maintenance
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Track hardware assets, purchase details, maintenance state, and repair history
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setMStationId(data.stations[0]?.id || '');
            setMaintOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Log maintenance
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Equipment asset registry"
          subtitle="Stations under maintenance or disabled cannot accept new sessions"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
              <tr>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Model / spec</th>
                <th className="px-4 py-3 font-medium">Purchase date</th>
                <th className="px-4 py-3 font-medium">Purchase cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2420]/8">
              {data.stations.map((st) => (
                <tr key={st.id} className="hover:bg-[#F5F2E9]/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E2420]">{st.name}</div>
                    <div className="text-xs text-[#707973]">
                      {st.code} · {st.category_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#525B55]">{st.equipment_model || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {st.purchase_date || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {st.purchase_cost ? formatINR(st.purchase_cost) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        st.status === 'available'
                          ? 'green'
                          : st.status === 'occupied'
                            ? 'red'
                            : 'grey'
                      }
                      className="capitalize"
                    >
                      {st.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditStation(st);
                          setStName(st.name);
                          setStModel(st.equipment_model || '');
                          setStPurchaseDate(st.purchase_date || '');
                          setStPurchaseCost(st.purchase_cost ? String(st.purchase_cost) : '');
                          setStNotes(st.notes || '');
                        }}
                      >
                        <Edit2 className="h-4 w-4 text-[#707973]" strokeWidth={1.5} /> Edit
                      </Button>
                      {st.status !== 'occupied' && (
                        <>
                          {st.status === 'available' ? (
                            <Button
                              size="xs"
                              variant="amber"
                              onClick={() => toggleStationStatus(st, 'maintenance')}
                            >
                              <Wrench className="h-4 w-4" strokeWidth={1.5} /> Maintenance
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => toggleStationStatus(st, 'available')}
                            >
                              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Set available
                            </Button>
                          )}
                          {st.status !== 'disabled' && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => toggleStationStatus(st, 'disabled')}
                            >
                              Disable
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Maintenance & service history" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
              <tr>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Issue / work done</th>
                <th className="px-4 py-3 font-medium">Technician</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Date (IST)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2420]/8">
              {records.map((rec) => (
                <tr key={rec.id}>
                  <td className="px-4 py-3 font-medium text-[#1E2420]">{rec.station_name}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E2420]">{rec.issue_title}</div>
                    {rec.description && (
                      <div className="text-xs text-[#707973]">{rec.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{rec.technician || '—'}</td>
                  <td className="px-4 py-3 font-mono font-medium tabular-nums">
                    {formatINR(rec.cost)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {formatISTDateTime(rec.started_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={rec.status === 'completed' ? 'green' : 'amber'}
                      className="capitalize"
                    >
                      {rec.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rec.status !== 'completed' && (
                      <Button size="xs" onClick={() => handleCompleteMaint(rec)}>
                        Mark completed
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={maintOpen}
        onClose={() => setMaintOpen(false)}
        title="Log equipment maintenance"
      >
        <form onSubmit={handleLogMaintenance} className="space-y-4">
          <div>
            <FieldLabel>Gaming station</FieldLabel>
            <Select value={mStationId} onChange={(e) => setMStationId(e.target.value)}>
              {data.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Issue / service title</FieldLabel>
            <Input
              required
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="Controller drift repair or felt brushing"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Repair cost (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={mCost}
                onChange={(e) => setMCost(Number(e.target.value))}
              />
            </div>
            <div>
              <FieldLabel hint="Optional">Technician</FieldLabel>
              <Input
                value={mTech}
                onChange={(e) => setMTech(e.target.value)}
                placeholder="Technician name"
              />
            </div>
          </div>
          <div>
            <FieldLabel hint="Optional">Description</FieldLabel>
            <Textarea rows={2} value={mDesc} onChange={(e) => setMDesc(e.target.value)} />
          </div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mSetMaint}
                onChange={(e) => setMSetMaint(e.target.checked)}
                className="accent-[#285943]"
              />
              Set station status to under maintenance (blocks new rentals)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
            <Button variant="outline" onClick={() => setMaintOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Log maintenance</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editStation)}
        onClose={() => setEditStation(null)}
        title={`Edit ${editStation?.name || 'Station'}`}
      >
        <form onSubmit={handleSaveStationEdit} className="space-y-4">
          <div>
            <FieldLabel>Station name</FieldLabel>
            <Input required value={stName} onChange={(e) => setStName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Equipment model</FieldLabel>
            <Input value={stModel} onChange={(e) => setStModel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Purchase date</FieldLabel>
              <Input
                type="date"
                value={stPurchaseDate}
                onChange={(e) => setStPurchaseDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Purchase cost (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={stPurchaseCost}
                onChange={(e) => setStPurchaseCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <Textarea rows={2} value={stNotes} onChange={(e) => setStNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
            <Button variant="outline" onClick={() => setEditStation(null)}>
              Cancel
            </Button>
            <Button type="submit">Save details</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
