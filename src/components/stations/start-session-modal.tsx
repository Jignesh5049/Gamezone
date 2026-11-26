'use client';

import * as React from 'react';
import { Clock, Play, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { type StartModalOptions, useGameZone } from '@/context/gamezone-context';
import { startSessions } from '@/lib/demo-store';
import { calculateRentalAmount } from '@/lib/timer';
import { formatINR } from '@/lib/utils';
import type { BillingMode } from '@/lib/types';

export function StartSessionModal() {
  const { startModalOpts, closeStartModal } = useGameZone();
  if (!startModalOpts) return null;

  return (
    <StartSessionModalBody
      key={`${startModalOpts.stationId || 'any'}-${startModalOpts.bookingId || 'new'}-${Boolean(startModalOpts.groupMode)}`}
      opts={startModalOpts}
      onClose={closeStartModal}
    />
  );
}

function StartSessionModalBody({
  opts,
  onClose,
}: {
  opts: StartModalOptions;
  onClose: () => void;
}) {
  const { data, refresh, notify } = useGameZone();
  const availableStations = React.useMemo(
    () => data.stations.filter((s) => s.status === 'available'),
    [data.stations]
  );

  const initialStation = opts.stationId
    ? availableStations.find((s) => s.id === opts.stationId)
    : availableStations[0];

  const initialCategoryId =
    initialStation?.category_id || data.categories[0]?.id || '';

  const [groupMode, setGroupMode] = React.useState(Boolean(opts.groupMode));
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(initialCategoryId);
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() =>
    initialStation ? [initialStation.id] : []
  );

  const initialDuration = opts.durationMinutes ?? 60;
  const standardDurations = [30, 60, 90, 120, 150, 180];
  const initialDurationChoice =
    data.settings.default_billing_mode === 'pay_as_you_play' && !opts.durationMinutes
      ? 'open'
      : standardDurations.includes(initialDuration)
        ? String(initialDuration)
        : 'custom';

  const [durationChoice, setDurationChoice] = React.useState<string>(initialDurationChoice);
  const [customMinutes, setCustomMinutes] = React.useState<number>(
    standardDurations.includes(initialDuration) ? 45 : initialDuration
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categoryAvailableStations = React.useMemo(
    () => availableStations.filter((s) => s.category_id === selectedCategoryId),
    [availableStations, selectedCategoryId]
  );

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    const firstInCat = availableStations.find((s) => s.category_id === catId);
    setSelectedIds(firstInCat ? [firstInCat.id] : []);
  };

  const billingMode: BillingMode =
    durationChoice === 'open' ? 'pay_as_you_play' : 'fixed';

  const plannedMinutes =
    billingMode === 'fixed'
      ? durationChoice === 'custom'
        ? Math.max(5, Number(customMinutes) || 30)
        : Number(durationChoice)
      : null;

  const selectedStations = data.stations.filter((s) => selectedIds.includes(s.id));

  const totalCalculatedPrice = selectedStations.reduce((sum, st) => {
    const rate30 = st.effective_pricing?.rate_30min ?? 100;
    const rate60 = st.effective_pricing?.rate_60min ?? rate30 * 2;
    const inc = st.effective_pricing?.billing_increment_minutes ?? 30;
    const offerPct = st.effective_pricing?.offer_discount_percent ?? 0;
    const minsForEstimate = plannedMinutes ?? 60;
    const calc = calculateRentalAmount({
      billableElapsedSeconds: minsForEstimate * 60,
      plannedDurationMinutes: minsForEstimate,
      billingMode: 'fixed',
      billingIncrementMinutes: inc,
      ratePer30Min: rate30,
      ratePer60Min: rate60,
      offerDiscountPercent: offerPct,
    });
    return sum + calc.baseAmount;
  }, 0);

  const toggleStationSelection = (id: string) => {
    if (!groupMode) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError('Select at least one available gaming station');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = startSessions({
        stationIds: selectedIds,
        billingMode,
        plannedDurationMinutes: plannedMinutes,
        bookingId: opts.bookingId || null,
      });
      if (!res.ok) {
        setError(res.error || 'Could not start session');
        return;
      }
      notify(
        selectedIds.length > 1
          ? `Started group session across ${selectedIds.length} stations`
          : `Session started on ${selectedStations[0]?.name || 'station'}`,
        'success'
      );
      onClose();
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={groupMode ? 'Add Group Session' : 'Add Session'}
      subtitle="Select game category, available station, and booking duration"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {availableStations.length === 0 ? (
          <div className="rounded-[8px] border border-[#C65D50]/25 bg-[#C65D50]/10 p-4 text-sm text-[#A74438]">
            All gaming stations are currently occupied or under maintenance
          </div>
        ) : (
          <>
            {/* 1. Category Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel htmlFor="session-category">Game category</FieldLabel>
                <button
                  type="button"
                  onClick={() => {
                    const next = !groupMode;
                    setGroupMode(next);
                    if (!next) {
                      const first =
                        categoryAvailableStations[0] || availableStations[0];
                      setSelectedIds(first ? [first.id] : []);
                      if (first) setSelectedCategoryId(first.category_id);
                    }
                  }}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#285943] hover:underline cursor-pointer"
                >
                  <Users className="h-4 w-4" strokeWidth={1.5} />
                  {groupMode ? 'Single station' : 'Group booking'}
                </button>
              </div>
              {!groupMode && (
                <Select
                  id="session-category"
                  value={selectedCategoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  {data.categories.map((cat) => {
                    const freeCount = availableStations.filter(
                      (s) => s.category_id === cat.id
                    ).length;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({freeCount} available)
                      </option>
                    );
                  })}
                </Select>
              )}
            </div>

            {/* 2. Station Name Dropdown (Filtered to available stations in selected category) */}
            <div>
              <FieldLabel htmlFor="session-station">
                {groupMode ? 'Select available stations' : 'Station name'}
              </FieldLabel>

              {!groupMode ? (
                categoryAvailableStations.length === 0 ? (
                  <div className="rounded-[8px] border border-[#B77922]/30 bg-[#B77922]/10 px-3 py-3 text-xs text-[#8E5B13]">
                    No available stations in this category right now — choose another category
                  </div>
                ) : (
                  <Select
                    id="session-station"
                    value={selectedIds[0] || ''}
                    onChange={(e) => setSelectedIds([e.target.value])}
                  >
                    {categoryAvailableStations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — ₹{st.effective_pricing?.rate_30min ?? 100} / 30m
                      </option>
                    ))}
                  </Select>
                )
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                  {availableStations.map((st) => {
                    const checked = selectedIds.includes(st.id);
                    return (
                      <button
                        type="button"
                        key={st.id}
                        onClick={() => toggleStationSelection(st.id)}
                        className={`text-left rounded-[8px] border px-3 py-2 text-xs transition-colors duration-150 cursor-pointer ${
                          checked
                            ? 'border-[#285943] bg-[#285943]/10 text-[#1E2420] font-medium'
                            : 'border-[#1E2420]/15 bg-white text-[#525B55] hover:bg-[#EDE9DD]'
                        }`}
                      >
                        <div className="truncate">{st.name}</div>
                        <div className="font-mono text-xs text-[#707973] mt-0.5">
                          ₹{st.effective_pricing?.rate_30min ?? 100}/30m
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Booking Duration Dropdown */}
            <div>
              <FieldLabel htmlFor="session-duration">Booking duration</FieldLabel>
              <Select
                id="session-duration"
                value={durationChoice}
                onChange={(e) => setDurationChoice(e.target.value)}
              >
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="90">1.5 Hours (90 Minutes)</option>
                <option value="120">2 Hours</option>
                <option value="150">2.5 Hours</option>
                <option value="180">3 Hours</option>
                <option value="custom">Custom Duration</option>
                <option value="open">Pay-As-You-Play (Open Timer)</option>
              </Select>

              {durationChoice === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-xs text-[#707973]">minutes</span>
                </div>
              )}
            </div>

            {/* 4. Calculated Price Display */}
            <div className="flex items-center justify-between rounded-[8px] border border-[#285943]/20 bg-[#285943]/8 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-[#285943] shrink-0" strokeWidth={1.5} />
                <div>
                  <div className="text-xs font-medium text-[#1E2420]">
                    {billingMode === 'fixed'
                      ? `Calculated price (${plannedMinutes} min)`
                      : 'Open timer (est. 1 hour rate)'}
                  </div>
                  <div className="text-xs text-[#525B55] mt-0.5">
                    {selectedStations.length > 0
                      ? `${selectedStations.map((s) => s.name).join(', ')} · ₹${
                          selectedStations[0]?.effective_pricing?.rate_30min ?? 100
                        }/30m`
                      : 'Select an available station'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-medium text-[#285943] tabular-nums">
                  {formatINR(totalCalculatedPrice)}
                </div>
                {selectedStations.some(
                  (s) => (s.effective_pricing?.offer_discount_percent ?? 0) > 0
                ) && <Badge tone="amber">Offer applied</Badge>}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-[8px] border border-[#C65D50]/30 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || availableStations.length === 0 || selectedIds.length === 0}
          >
            <Play className="h-4 w-4" strokeWidth={1.5} />
            {submitting ? 'Starting' : 'Start session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
