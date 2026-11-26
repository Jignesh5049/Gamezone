'use client';

import * as React from 'react';
import { Banknote, CheckCircle2, CreditCard, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGameZone } from '@/context/gamezone-context';
import { formatDurationHMS, formatMinutesReadable } from '@/lib/timer';
import { formatISTDateTime } from '@/lib/timezone';
import { formatINR } from '@/lib/utils';
import type { CheckoutPreview, PaymentMethod, ReceiptData } from '@/lib/types';

export function CheckoutModal() {
  const { checkoutSessionId, closeCheckoutModal } = useGameZone();
  if (!checkoutSessionId) return null;

  return (
    <CheckoutModalBody
      key={checkoutSessionId}
      sessionId={checkoutSessionId}
      onClose={closeCheckoutModal}
    />
  );
}

function CheckoutModalBody({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { openReceiptModal, refresh, notify } = useGameZone();

  const [preview, setPreview] = React.useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [additionalCharges, setAdditionalCharges] = React.useState(0);
  const [discountAmount, setDiscountAmount] = React.useState(0);
  const [discountReason, setDiscountReason] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');
  const [paymentMode, setPaymentMode] = React.useState<'full' | 'partial' | 'unpaid'>('full');
  const [partialAmount, setPartialAmount] = React.useState(0);
  const [referenceNote, setReferenceNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/sessions/${sessionId}/checkout`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: CheckoutPreview & { error?: string }) => {
        if (!active) return;
        if (json.error) {
          setError(json.error);
          return;
        }
        setPreview(json);
        setPartialAmount(Math.round(json.calculation.baseAmount / 2));
      })
      .catch(() => {
        if (active) setError('Failed to load checkout summary');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const baseAmount = preview?.calculation.baseAmount ?? 0;
  const finalPayable = Math.max(
    0,
    Math.round(baseAmount + (Number(additionalCharges) || 0) - (Number(discountAmount) || 0))
  );
  const paidAmount =
    paymentMode === 'full'
      ? finalPayable
      : paymentMode === 'partial'
        ? Math.min(finalPayable, Math.max(0, Number(partialAmount) || 0))
        : 0;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additionalCharges: Number(additionalCharges) || 0,
          discountAmount: Number(discountAmount) || 0,
          discountReason: discountReason.trim() || null,
          paymentMethod,
          paidAmount,
          referenceNote: referenceNote.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        receipt?: ReceiptData;
      };
      if (!res.ok) {
        setError(json.error || 'Checkout failed');
        return;
      }
      notify(
        `Ended ${preview.session.station_name} • ${
          paidAmount >= finalPayable
            ? `Paid ${formatINR(paidAmount)}`
            : `Pending ${formatINR(finalPayable - paidAmount)}`
        }`,
        'success'
      );
      onClose();
      await refresh();
      if (json.receipt) {
        openReceiptModal(json.receipt);
      }
    } catch {
      setError('Network error during checkout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="End Session & Checkout"
      subtitle={
        preview
          ? `${preview.session.station_name} • ${preview.session.session_code}`
          : 'Calculating final bill...'
      }
      maxWidth="max-w-xl"
    >
      {loading ? (
        <div className="py-10 text-center text-sm text-[#646D67]">
          Calculating server-side billable duration...
        </div>
      ) : preview ? (
        <form onSubmit={handleCheckout} className="space-y-4">
          <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9]/80 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#646D67]">Game & Station</span>
              <span className="font-semibold text-[#202723]">
                {preview.session.category_name} — {preview.session.station_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#646D67]">Start → End (IST)</span>
              <span className="font-mono text-[11px] text-[#202723]">
                {formatISTDateTime(preview.session.started_at)} →{' '}
                {formatISTDateTime(preview.serverNow)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#DFD9C8]">
              <div>
                <div className="text-[11px] text-[#646D67]">Total Playing</div>
                <div className="font-mono font-semibold text-[#202723]">
                  {formatDurationHMS(preview.metrics.billableElapsedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#646D67]">Paused (Excluded)</div>
                <div className="font-mono font-semibold text-[#8E5B13]">
                  {formatDurationHMS(preview.metrics.totalPausedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#646D67]">Billable Time</div>
                <div className="font-mono font-semibold text-[#285943]">
                  {formatMinutesReadable(preview.calculation.billableMinutes)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#DFD9C8] bg-white p-3">
              <div className="text-[11px] text-[#646D67]">Base Rental</div>
              <div className="font-mono text-base font-bold text-[#202723] mt-0.5">
                {formatINR(baseAmount)}
              </div>
              {preview.calculation.overtimeMinutes > 0 && (
                <Badge tone="red" className="mt-1">
                  +{preview.calculation.overtimeMinutes}m overtime
                </Badge>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="add-charges">Additional Charges (₹)</FieldLabel>
              <Input
                id="add-charges"
                type="number"
                min={0}
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                placeholder="Snacks, drinks..."
              />
            </div>

            <div>
              <FieldLabel htmlFor="disc-amount">Discount (₹)</FieldLabel>
              <Input
                id="disc-amount"
                type="number"
                min={0}
                max={baseAmount + (Number(additionalCharges) || 0)}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
              />
            </div>
          </div>

          {Number(discountAmount) > 0 && (
            <div className="rounded-lg border border-[#D89B45]/40 bg-[#D89B45]/10 p-3">
              <FieldLabel htmlFor="disc-reason">Discount Reason (Optional)</FieldLabel>
              <Input
                id="disc-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g., Member promo / goodwill"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-[#202723] text-[#F5F2E9] px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[#A8B8A0]">
              Final Amount Payable
            </span>
            <span className="font-mono text-2xl font-bold tabular-nums">
              {formatINR(finalPayable)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel>Payment Status</FieldLabel>
              <div className="flex gap-1.5">
                {(['full', 'partial', 'unpaid'] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPaymentMode(m)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize cursor-pointer ${
                      paymentMode === m
                        ? 'border-[#285943] bg-[#285943] text-white'
                        : 'border-[#D4CEBC] bg-white text-[#202723]'
                    }`}
                  >
                    {m === 'full' ? 'Mark Paid' : m === 'partial' ? 'Partial' : 'Pending / Unpaid'}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode !== 'unpaid' && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'cash', label: 'Cash', Icon: Banknote },
                      { id: 'upi', label: 'UPI', Icon: Smartphone },
                      { id: 'card', label: 'Card', Icon: CreditCard },
                      { id: 'other', label: 'Other', Icon: CheckCircle2 },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                        paymentMethod === id
                          ? 'border-[#285943] bg-[#285943]/12 text-[#285943]'
                          : 'border-[#D4CEBC] bg-white text-[#202723]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {paymentMode === 'partial' && (
                    <div>
                      <FieldLabel htmlFor="partial-amt">Amount Received Now (₹)</FieldLabel>
                      <Input
                        id="partial-amt"
                        type="number"
                        min={1}
                        max={finalPayable}
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(Number(e.target.value))}
                      />
                    </div>
                  )}
                  <div className={paymentMode === 'partial' ? '' : 'sm:col-span-2'}>
                    <FieldLabel htmlFor="ref-note" hint="Optional">
                      Payment Reference / Note
                    </FieldLabel>
                    <Input
                      id="ref-note"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      placeholder="UPI txn ID, card last 4 digits..."
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-[#C65D50]/30 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE5D7]">
            <Button variant="outline" onClick={onClose}>
              Keep Running
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Finalizing...'
                : paymentMode === 'unpaid'
                  ? 'End & Mark Unpaid'
                  : `Confirm & Collect ${formatINR(paidAmount)}`}
            </Button>
          </div>
        </form>
      ) : (
        <div className="py-6 text-center text-sm text-[#C65D50]">{error}</div>
      )}
    </Modal>
  );
}
