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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202723]">
            Rental Pricing & Billing Rules
          </h1>
          <p className="text-xs text-[#646D67] mt-0.5">
            Configure category defaults, station-specific overrides, increments (15/30/60m), and special offers
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Pricing Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader
            title="Active Rate Cards"
            subtitle="Station overrides take precedence over category defaults"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2E9] border-b border-[#DFD9C8] text-[11px] uppercase tracking-wider text-[#5A635D]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rule Name</th>
                  <th className="px-4 py-3 font-semibold">Scope</th>
                  <th className="px-4 py-3 font-semibold">30 Min</th>
                  <th className="px-4 py-3 font-semibold">1 Hour</th>
                  <th className="px-4 py-3 font-semibold">Increment / Mode</th>
                  <th className="px-4 py-3 font-semibold">Offer</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5D7]">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F5F2E9]/50">
                    <td className="px-4 py-3 font-semibold text-[#202723]">{r.name}</td>
                    <td className="px-4 py-3">
                      {r.station_name ? (
                        <Badge tone="charcoal">{r.station_name}</Badge>
                      ) : (
                        <Badge tone="green">{r.category_name} (Default)</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">
                      {formatINR(r.rate_30min)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#285943]">
                      {formatINR(r.rate_60min)}
                    </td>
                    <td className="px-4 py-3 text-[#5A635D]">
                      {r.billing_increment_minutes}m •{' '}
                      {r.default_billing_mode === 'fixed' ? 'Fixed' : 'Pay-as-you-play'}
                    </td>
                    <td className="px-4 py-3">
                      {r.offer_discount_percent > 0 ? (
                        <Badge tone="amber">
                          {r.offer_label || 'Offer'} (-{r.offer_discount_percent}%)
                        </Badge>
                      ) : (
                        <span className="text-[#8E9690]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="xs" variant="outline" onClick={() => openEdit(r)}>
                          <Edit2 className="h-3 w-3" /> Edit
                        </Button>
                        {r.station_id && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleDelete(r)}
                          >
                            <Trash2 className="h-3 w-3 text-[#C65D50]" />
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

        <Card className="p-4 space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-[#EAE5D7] pb-3">
            <Calculator className="h-4 w-4 text-[#285943]" />
            <div>
              <h3 className="text-sm font-semibold text-[#202723]">
                Transparent Bill Simulator
              </h3>
              <p className="text-[11px] text-[#646D67]">
                Preview exact increment rounding & offer discounts
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <FieldLabel>Pricing Rule</FieldLabel>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Played Minutes</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={simMinutes}
                  onChange={(e) => setSimMinutes(Number(e.target.value))}
                />
              </div>
              <div>
                <FieldLabel>Billing Mode</FieldLabel>
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
              <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9] p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#646D67]">Increment Rounding</span>
                  <span className="font-mono font-semibold">
                    {simRule.billing_increment_minutes} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#646D67]">Billable Duration</span>
                  <span className="font-mono font-semibold">
                    {simResult.billableMinutes} min
                  </span>
                </div>
                {simResult.offerDiscountAmount > 0 && (
                  <div className="flex justify-between text-[#285943]">
                    <span>Offer Discount</span>
                    <span className="font-mono">
                      -{formatINR(simResult.offerDiscountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#DFD9C8] pt-1.5 text-sm font-bold">
                  <span>Calculated Bill</span>
                  <span className="font-mono text-[#285943]">
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
        title={editing ? 'Edit Pricing Rule' : 'New Pricing Rule'}
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <FieldLabel>Rule Name</FieldLabel>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., PS5 Weekend Rate"
            />
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Game Category</FieldLabel>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel hint="Optional override">Specific Station</FieldLabel>
                <Select value={stationId} onChange={(e) => setStationId(e.target.value)}>
                  <option value="">Category Default</option>
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
              <FieldLabel>30-Minute Rate (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                required
                value={rate30}
                onChange={(e) => setRate30(Number(e.target.value))}
              />
            </div>
            <div>
              <FieldLabel>1-Hour Rate (₹)</FieldLabel>
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
              <FieldLabel>Default Billing Mode</FieldLabel>
              <Select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as BillingMode)}
              >
                <option value="fixed">Fixed Duration</option>
                <option value="pay_as_you_play">Pay-As-You-Play</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Billing Increment</FieldLabel>
              <Select
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value) as 15 | 30 | 60)}
              >
                <option value={15}>Every 15 Minutes</option>
                <option value={30}>Every 30 Minutes</option>
                <option value={60}>Every 60 Minutes</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel hint="Optional">Special Offer Label</FieldLabel>
              <Input
                value={offerLabel}
                onChange={(e) => setOfferLabel(e.target.value)}
                placeholder="e.g., Happy Hour"
              />
            </div>
            <div>
              <FieldLabel>Offer Discount (%)</FieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                value={offerPct}
                onChange={(e) => setOfferPct(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Pricing Rule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
