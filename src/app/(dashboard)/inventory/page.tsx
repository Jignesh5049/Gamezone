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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Inventory & Equipment Maintenance
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
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
          <Plus className="h-3.5 w-3.5" /> Log Maintenance
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Equipment Asset Registry"
          subtitle="Stations under maintenance or disabled cannot accept new sessions"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] uppercase tracking-wider text-[#5A635D]">
              <tr>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Model / Spec</th>
                <th className="px-4 py-3 font-semibold">Purchase Date</th>
                <th className="px-4 py-3 font-semibold">Purchase Cost</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5D7]">
              {data.stations.map((st) => (
                <tr key={st.id} className="hover:bg-[#F5F2E9]/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#202723]">{st.name}</div>
                    <div className="text-[11px] text-[#646D67]">
                      {st.code} • {st.category_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">{st.equipment_model || '—'}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    {st.purchase_date || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono">
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
                    <div className="inline-flex items-center gap-1.5">
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
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      {st.status !== 'occupied' && (
                        <>
                          {st.status === 'available' ? (
                            <Button
                              size="xs"
                              variant="amber"
                              onClick={() => toggleStationStatus(st, 'maintenance')}
                            >
                              <Wrench className="h-3 w-3" /> Maintenance
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => toggleStationStatus(st, 'available')}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Set Available
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
        <CardHeader title="Maintenance & Service History" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] uppercase tracking-wider text-[#5A635D]">
              <tr>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Issue / Work Done</th>
                <th className="px-4 py-3 font-semibold">Technician</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
                <th className="px-4 py-3 font-semibold">Date (IST)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5D7]">
              {records.map((rec) => (
                <tr key={rec.id}>
                  <td className="px-4 py-3 font-semibold">{rec.station_name}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#202723]">{rec.issue_title}</div>
                    {rec.description && (
                      <div className="text-[11px] text-[#646D67]">{rec.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{rec.technician || '—'}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatINR(rec.cost)}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">
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
                        Mark Completed
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
        title="Log Equipment Maintenance"
      >
        <form onSubmit={handleLogMaintenance} className="space-y-3.5">
          <div>
            <FieldLabel>Gaming Station</FieldLabel>
            <Select value={mStationId} onChange={(e) => setMStationId(e.target.value)}>
              {data.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Issue / Service Title</FieldLabel>
            <Input
              required
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="e.g., Controller drift replacement / Felt brushing"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Repair Cost (₹)</FieldLabel>
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
              Set station status to Under Maintenance (blocks new rentals)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setMaintOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Log Maintenance</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editStation)}
        onClose={() => setEditStation(null)}
        title={`Edit ${editStation?.name || 'Station'}`}
      >
        <form onSubmit={handleSaveStationEdit} className="space-y-3.5">
          <div>
            <FieldLabel>Station Name</FieldLabel>
            <Input required value={stName} onChange={(e) => setStName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Equipment Model</FieldLabel>
            <Input value={stModel} onChange={(e) => setStModel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Purchase Date</FieldLabel>
              <Input
                type="date"
                value={stPurchaseDate}
                onChange={(e) => setStPurchaseDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Purchase Cost (₹)</FieldLabel>
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
          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setEditStation(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Details</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
