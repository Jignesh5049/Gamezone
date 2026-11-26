'use client';

import * as React from 'react';
import { CalendarClock, Play, Plus, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldLabel, Input, Select, Textarea } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import {
  formatISTDateTime,
  istDateTimeLocalInputValue,
  parseISTLocalInputToUTC,
} from '@/lib/timezone';
import type { BookingRecord } from '@/lib/types';

export default function BookingsPage() {
  const { data, openStartModal, notify } = useGameZone();
  const [bookings, setBookings] = React.useState<BookingRecord[]>([]);
  const [statusFilter, setStatusFilter] = React.useState('confirmed');
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedStations, setSelectedStations] = React.useState<string[]>([]);
  const [startLocal, setStartLocal] = React.useState(() =>
    istDateTimeLocalInputValue(new Date(Date.now() + 60 * 60_000).toISOString())
  );
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const loadBookings = React.useCallback(async () => {
    const res = await fetch(`/api/bookings?status=${statusFilter}`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as { bookings: BookingRecord[] };
    setBookings(json.bookings || []);
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/bookings?status=${statusFilter}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { bookings: BookingRecord[] }) => {
        if (!active) return;
        setBookings(json.bookings || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter, data.activeSessions.length]);

  const toggleStation = (id: string) => {
    setSelectedStations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStations.length === 0) {
      notify('Select at least one station to reserve', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationIds: selectedStations,
          scheduledStartAt: parseISTLocalInputToUTC(startLocal),
          durationMinutes: Number(durationMinutes),
          notes: notes || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(json.error || 'Could not create booking', 'error');
        return;
      }
      notify('Reservation confirmed', 'success');
      setModalOpen(false);
      setNotes('');
      setSelectedStations([]);
      loadBookings();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (b: BookingRecord) => {
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (res.ok) {
      notify(`Cancelled reservation ${b.booking_code}`, 'info');
      loadBookings();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Advance & Group Bookings
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            Reserve stations for upcoming time slots (IST) and convert to live sessions in one click
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setSelectedStations(data.stations[0] ? [data.stations[0].id] : []);
            setStartLocal(
              istDateTimeLocalInputValue(new Date(Date.now() + 60 * 60_000).toISOString())
            );
            setModalOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New Advance Booking
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['confirmed', 'checked_in', 'cancelled', 'all'] as const).map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize cursor-pointer ${
              statusFilter === s
                ? 'bg-[#202723] text-[#F5F2E9]'
                : 'bg-[#FCFBF7] border border-[#DFD9C8] text-[#5A635D]'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] uppercase tracking-wider text-[#5A635D]">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Scheduled Slot (IST)</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5D7]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#646D67]">
                    Loading bookings...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#646D67]">
                    <CalendarClock className="h-7 w-7 mx-auto mb-2 text-[#A8B8A0]" />
                    No bookings in this view.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F5F2E9]/50">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {b.booking_code}
                      {b.group_booking_id && (
                        <Badge tone="amber" className="ml-1.5">
                          Group
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#202723]">{b.station_name}</div>
                      <div className="text-[11px] text-[#646D67]">{b.category_name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {formatISTDateTime(b.scheduled_start_at)}
                    </td>
                    <td className="px-4 py-3 font-mono">{b.duration_minutes} min</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          b.status === 'confirmed'
                            ? 'green'
                            : b.status === 'checked_in'
                              ? 'amber'
                              : 'grey'
                        }
                        className="capitalize"
                      >
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status === 'confirmed' && (
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="xs"
                            onClick={() =>
                              openStartModal({
                                stationId: b.station_id,
                                bookingId: b.id,
                                durationMinutes: b.duration_minutes,
                              })
                            }
                          >
                            <Play className="h-3 w-3" /> Start Now
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleCancelBooking(b)}
                          >
                            <XCircle className="h-3 w-3 text-[#C65D50]" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Booking Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Advance Booking"
        subtitle="Select one or multiple stations for group reservations"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <FieldLabel>Select Station(s)</FieldLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {data.stations
                .filter((s) => s.status !== 'maintenance' && s.status !== 'disabled')
                .map((st) => {
                  const selected = selectedStations.includes(st.id);
                  return (
                    <button
                      type="button"
                      key={st.id}
                      onClick={() => toggleStation(st.id)}
                      className={`text-left rounded-lg border px-2.5 py-2 text-xs cursor-pointer ${
                        selected
                          ? 'border-[#285943] bg-[#285943]/12 font-semibold text-[#202723]'
                          : 'border-[#D4CEBC] bg-white text-[#5A635D]'
                      }`}
                    >
                      <div className="truncate">{st.name}</div>
                      <div className="text-[10px] text-[#646D67]">{st.category_name}</div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start Date & Time (IST)</FieldLabel>
              <Input
                type="datetime-local"
                required
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Duration</FieldLabel>
              <Select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
                <option value={180}>3 Hours</option>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel hint="Optional">Notes</FieldLabel>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special setup, birthday group, extra controllers..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Booking...' : 'Confirm Reservation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
