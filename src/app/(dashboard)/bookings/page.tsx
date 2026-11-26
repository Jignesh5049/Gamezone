'use client';

import * as React from 'react';
import { CalendarClock, Play, Plus, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldLabel, Input, Select, Textarea } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { createBooking, listBookings, updateBookingStatus } from '@/lib/demo-store';
import {
  formatISTDateTime,
  istDateTimeLocalInputValue,
  parseISTLocalInputToUTC,
} from '@/lib/timezone';
import type { BookingRecord } from '@/lib/types';

export default function BookingsPage() {
  const { data, openStartModal, refresh, notify } = useGameZone();
  const [statusFilter, setStatusFilter] = React.useState('confirmed');
  const [tick, setTick] = React.useState(0);

  const bookings = React.useMemo(() => {
    void data;
    void tick;
    return listBookings(statusFilter);
  }, [data, statusFilter, tick]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedStations, setSelectedStations] = React.useState<string[]>([]);
  const [startLocal, setStartLocal] = React.useState(() =>
    istDateTimeLocalInputValue(new Date(Date.now() + 60 * 60_000).toISOString())
  );
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

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
      const res = createBooking({
        stationIds: selectedStations,
        scheduledStartAt: parseISTLocalInputToUTC(startLocal),
        durationMinutes: Number(durationMinutes),
        notes: notes || null,
      });
      if (!res.ok) {
        notify(res.error || 'Could not create booking', 'error');
        return;
      }
      notify('Reservation confirmed', 'success');
      setModalOpen(false);
      setNotes('');
      setSelectedStations([]);
      setTick((t) => t + 1);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (b: BookingRecord) => {
    updateBookingStatus(b.id, 'cancelled');
    notify(`Cancelled reservation ${b.booking_code}`, 'info');
    setTick((t) => t + 1);
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            Bookings
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Reserve stations for upcoming slots (IST) and convert to live sessions
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
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New booking
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {(['confirmed', 'checked_in', 'cancelled', 'all'] as const).map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`h-8 rounded-[8px] px-3 text-xs font-medium capitalize cursor-pointer transition-colors duration-150 ${
              statusFilter === s
                ? 'bg-[#1E2420] text-[#F2EFE7]'
                : 'bg-[#FCFBF7] border border-[#1E2420]/10 text-[#525B55] hover:bg-[#EDE9DD]'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Scheduled slot (IST)</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2420]/8">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#707973]">
                    <CalendarClock className="h-4 w-4 mx-auto mb-2 text-[#707973]" strokeWidth={1.5} />
                    No bookings in this view
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F5F2E9]/50">
                    <td className="px-4 py-3 font-mono font-medium">
                      {b.booking_code}
                      {b.group_booking_id && (
                        <Badge tone="amber" className="ml-2">
                          Group
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1E2420]">{b.station_name}</div>
                      <div className="text-xs text-[#707973]">{b.category_name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {formatISTDateTime(b.scheduled_start_at)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{b.duration_minutes} min</td>
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
                        <div className="inline-flex items-center gap-2">
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
                            <Play className="h-4 w-4" strokeWidth={1.5} /> Start now
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-[#707973] hover:text-[#C65D50]"
                            onClick={() => handleCancelBooking(b)}
                            title="Cancel booking"
                          >
                            <XCircle className="h-4 w-4" strokeWidth={1.5} />
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create advance booking"
        subtitle="Select one or multiple stations for group reservations"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <FieldLabel>Select station(s)</FieldLabel>
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
                      className={`text-left rounded-[8px] border px-3 py-2 text-xs cursor-pointer transition-colors duration-150 ${
                        selected
                          ? 'border-[#285943] bg-[#285943]/10 font-medium text-[#1E2420]'
                          : 'border-[#1E2420]/15 bg-white text-[#525B55] hover:bg-[#EDE9DD]'
                      }`}
                    >
                      <div className="truncate">{st.name}</div>
                      <div className="text-xs text-[#707973] mt-0.5">{st.category_name}</div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start date & time (IST)</FieldLabel>
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
              placeholder="Extra controllers or setup notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Booking' : 'Confirm reservation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
