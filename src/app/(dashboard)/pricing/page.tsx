'use client';

import * as React from 'react';
import { Calculator, Edit2, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldLabel, Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import {
  createPricingRule,
  deletePricingRule,
  listPricingRules,
  updatePricingRule,
} from '@/lib/demo-store';
import { calculateRentalAmount } from '@/lib/timer';
import { formatINR } from '@/lib/utils';
import type { BillingMode, PricingRule } from '@/lib/types';

export default function PricingPage() {
  const { data, refresh, notify } = useGameZone();
  const [tick, setTick] = React.useState(0);
  const rules = React.useMemo(() => {
    void data;
    void tick;
    return listPricingRules();
  }, [data, tick]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PricingRule | null>(null);
  const [categoryId, setCategoryId] = React.useState(data.categories[0]?.id || '');
  const [stationId, setStationId] = React.useState('');
  const [name, setName] = React.useState('');
  const [rate30, setRate30] = React.useState(100);
  const [rate60, setRate60] = React.useState(200);
  const [billingMode, setBillingMode] = React.useState<BillingMode>('fixed');
  const [increment, setIncrement] = React.useState<15 | 30 | 60>(30);
  const [offerLabel, setOfferLabel] = React.useState('');
  const [offerPct, setOfferPct] = React.useState(0);

  const [simRuleId, setSimRuleId] = React.useState(() => rules[0]?.id || '');
  const [simMinutes, setSimMinutes] = React.useState(75);
  const [simMode, setSimMode] = React.useState<BillingMode>('pay_as_you_play');

  const openAdd = () => {
    setEditing(null);
    setCategoryId(data.categories[0]?.id || '');
    setStationId('');
    setName('');
    setRate30(100);
    setRate60(200);
    setBillingMode('fixed');
    setIncrement(30);
    setOfferLabel('');
    setOfferPct(0);
    setModalOpen(true);
  };

  const openEdit = (r: PricingRule) => {
    setEditing(r);
    setCategoryId(r.category_id);
    setStationId(r.station_id || '');
    setName(r.name);
    setRate30(r.rate_30min);
    setRate60(r.rate_60min);
    setBillingMode(r.default_billing_mode);
    setIncrement(r.billing_increment_minutes);
    setOfferLabel(r.offer_label || '');
    setOfferPct(r.offer_discount_percent);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = editing
      ? updatePricingRule(editing.id, {
          name,
          rate30Min: Number(rate30),
          rate60Min: Number(rate60),
          defaultBillingMode: billingMode,
          billingIncrementMinutes: increment,
          offerLabel: offerLabel || null,
          offerDiscountPercent: Number(offerPct) || 0,
        })
      : createPricingRule({
          categoryId,
          stationId: stationId || null,
          name,
          rate30Min: Number(rate30),
          rate60Min: Number(rate60),
          defaultBillingMode: billingMode,
          billingIncrementMinutes: increment,
          offerLabel: offerLabel || null,
          offerDiscountPercent: Number(offerPct) || 0,
        });

    if (!res.ok) {
      notify(res.error || 'Could not save pricing rule', 'error');
      return;
    }
    notify(editing ? 'Pricing updated' : 'Pricing rule created', 'success');
    setModalOpen(false);
    setTick((t) => t + 1);
    await refresh();
  };

  const handleDelete = async (r: PricingRule) => {
    deletePricingRule(r.id);
    notify(`Deleted "${r.name}"`, 'info');
    setTick((t) => t + 1);
    await refresh();
  };

  const simRule = rules.find((r) => r.id === simRuleId) || rules[0];
  const simResult = simRule
    ? calculateRentalAmount({
        billableElapsedSeconds: simMinutes * 60,
        plannedDurationMinutes: simMode === 'fixed' ? simMinutes : null,
        billingMode: simMode,
        billingIncrementMinutes: simRule.billing_increment_minutes,
        ratePer30Min: simRule.rate_30min,
        ratePer60Min: simRule.rate_60min,
        offerDiscountPercent: simRule.offer_discount_percent,
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#1E2420]">
            Rental pricing
          </h1>
          <p className="text-sm text-[#525B55] mt-1">
            Category defaults, station overrides, billing increments (15/30/60m), and offers
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Add pricing rule
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader
            title="Active rate cards"
            subtitle="Station overrides take precedence over category defaults"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2E9] border-b border-[#1E2420]/10 text-xs font-medium text-[#525B55]">
                <tr>
                  <th className="px-4 py-3 font-medium">Rule name</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">30 min</th>
                  <th className="px-4 py-3 font-medium">1 hour</th>
                  <th className="px-4 py-3 font-medium">Increment / mode</th>
                  <th className="px-4 py-3 font-medium">Offer</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2420]/8">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F5F2E9]/50">
                    <td className="px-4 py-3 font-medium text-[#1E2420]">{r.name}</td>
                    <td className="px-4 py-3">
                      {r.station_name ? (
                        <Badge tone="charcoal">{r.station_name}</Badge>
                      ) : (
                        <Badge tone="green">{r.category_name} (Default)</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium tabular-nums">
                      {formatINR(r.rate_30min)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[#285943] tabular-nums">
                      {formatINR(r.rate_60min)}
                    </td>
                    <td className="px-4 py-3 text-[#525B55]">
                      {r.billing_increment_minutes}m ·{' '}
                      {r.default_billing_mode === 'fixed' ? 'Fixed' : 'Pay-as-you-play'}
                    </td>
                    <td className="px-4 py-3">
                      {r.offer_discount_percent > 0 ? (
                        <Badge tone="amber">
                          {r.offer_label || 'Offer'} (-{r.offer_discount_percent}%)
                        </Badge>
                      ) : (
                        <span className="text-[#707973]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="xs" variant="outline" onClick={() => openEdit(r)}>
                          <Edit2 className="h-4 w-4 text-[#707973]" strokeWidth={1.5} /> Edit
                        </Button>
                        {r.station_id && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-[#707973] hover:text-[#C65D50]"
                            onClick={() => handleDelete(r)}
                            title="Delete rule"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 space-y-4 h-fit">
          <div className="flex items-center gap-3 border-b border-[#1E2420]/8 pb-4">
            <Calculator className="h-4 w-4 text-[#707973] shrink-0" strokeWidth={1.5} />
            <div>
              <h3 className="text-sm font-medium text-[#1E2420]">
                Bill simulator
              </h3>
              <p className="text-xs text-[#707973] mt-0.5">
                Preview increment rounding and offer discounts
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <FieldLabel>Pricing rule</FieldLabel>
              <Select
                value={simRule?.id || ''}
                onChange={(e) => setSimRuleId(e.target.value)}
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Played minutes</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={simMinutes}
                  onChange={(e) => setSimMinutes(Number(e.target.value))}
                />
              </div>
              <div>
                <FieldLabel>Billing mode</FieldLabel>
                <Select
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value as BillingMode)}
                >
                  <option value="pay_as_you_play">Pay-As-You-Play</option>
                  <option value="fixed">Fixed Duration</option>
                </Select>
              </div>
            </div>

            {simResult && simRule && (
              <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#707973]">Increment rounding</span>
                  <span className="font-mono font-medium tabular-nums">
                    {simRule.billing_increment_minutes} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707973]">Billable duration</span>
                  <span className="font-mono font-medium tabular-nums">
                    {simResult.billableMinutes} min
                  </span>
                </div>
                {simResult.offerDiscountAmount > 0 && (
                  <div className="flex justify-between text-[#285943]">
                    <span>Offer discount</span>
                    <span className="font-mono tabular-nums">
                      -{formatINR(simResult.offerDiscountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#1E2420]/10 pt-2 text-sm font-medium">
                  <span>Calculated bill</span>
                  <span className="font-mono text-[#285943] tabular-nums">
                    {formatINR(simResult.baseAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit pricing rule' : 'New pricing rule'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <FieldLabel>Rule name</FieldLabel>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PS5 Weekend Rate"
            />
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Game category</FieldLabel>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel hint="Optional override">Specific station</FieldLabel>
                <Select value={stationId} onChange={(e) => setStationId(e.target.value)}>
                  <option value="">Category default</option>
                  {data.stations
                    .filter((s) => s.category_id === categoryId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>30-minute rate (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                required
                value={rate30}
                onChange={(e) => setRate30(Number(e.target.value))}
              />
            </div>
            <div>
              <FieldLabel>1-hour rate (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                required
                value={rate60}
                onChange={(e) => setRate60(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Default billing mode</FieldLabel>
              <Select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as BillingMode)}
              >
                <option value="fixed">Fixed duration</option>
                <option value="pay_as_you_play">Pay-as-you-play</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Billing increment</FieldLabel>
              <Select
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value) as 15 | 30 | 60)}
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 60 minutes</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel hint="Optional">Special offer label</FieldLabel>
              <Input
                value={offerLabel}
                onChange={(e) => setOfferLabel(e.target.value)}
                placeholder="Happy Hour"
              />
            </div>
            <div>
              <FieldLabel>Offer discount (%)</FieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                value={offerPct}
                onChange={(e) => setOfferPct(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save pricing rule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
