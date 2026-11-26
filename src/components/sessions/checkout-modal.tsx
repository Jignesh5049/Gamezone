'use client';

import * as React from 'react';
import { Banknote, CheckCircle2, CreditCard, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGameZone } from '@/context/gamezone-context';
import { checkoutSessionById, getCheckoutPreview } from '@/lib/demo-store';
import { formatDurationHMS, formatMinutesReadable } from '@/lib/timer';
import { formatISTDateTime } from '@/lib/timezone';
import { formatINR } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/types';

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

  const initial = React.useMemo(() => getCheckoutPreview(sessionId), [sessionId]);
  const preview = initial.preview ?? null;

  const [additionalCharges, setAdditionalCharges] = React.useState(0);
  const [discountAmount, setDiscountAmount] = React.useState(0);
  const [discountReason, setDiscountReason] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');
  const [paymentMode, setPaymentMode] = React.useState<'full' | 'partial' | 'unpaid'>('full');
  const [partialAmount, setPartialAmount] = React.useState(
    () => Math.round((preview?.calculation.baseAmount ?? 0) / 2)
  );
  const [referenceNote, setReferenceNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initial.error ?? null);

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
      const res = checkoutSessionById(sessionId, {
        additionalCharges: Number(additionalCharges) || 0,
        discountAmount: Number(discountAmount) || 0,
        discountReason: discountReason.trim() || null,
        paymentMethod,
        paidAmount,
        referenceNote: referenceNote.trim() || null,
      });
      if (!res.ok) {
        setError(res.error || 'Checkout failed');
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
      if (res.receipt) {
        openReceiptModal(res.receipt);
      }
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
          : 'Session checkout'
      }
      maxWidth="max-w-xl"
    >
      {preview ? (
        <form onSubmit={handleCheckout} className="space-y-4">
          <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#707973]">Game & station</span>
              <span className="font-medium text-[#1E2420]">
                {preview.session.category_name} — {preview.session.station_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#707973]">Start to end (IST)</span>
              <span className="font-mono text-xs text-[#1E2420] tabular-nums">
                {formatISTDateTime(preview.session.started_at)} →{' '}
                {formatISTDateTime(preview.serverNow)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#1E2420]/10">
              <div>
                <div className="text-xs text-[#707973]">Total playing</div>
                <div className="font-mono font-medium text-[#1E2420] tabular-nums mt-0.5">
                  {formatDurationHMS(preview.metrics.billableElapsedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#707973]">Paused</div>
                <div className="font-mono font-medium text-[#8E5B13] tabular-nums mt-0.5">
                  {formatDurationHMS(preview.metrics.totalPausedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#707973]">Billable time</div>
                <div className="font-mono font-medium text-[#285943] tabular-nums mt-0.5">
                  {formatMinutesReadable(preview.calculation.billableMinutes)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-white p-3">
              <div className="text-xs text-[#707973]">Base rental</div>
              <div className="font-mono text-base font-medium text-[#1E2420] tabular-nums mt-1">
                {formatINR(baseAmount)}
              </div>
              {preview.calculation.overtimeMinutes > 0 && (
                <Badge tone="red" className="mt-1">
                  +{preview.calculation.overtimeMinutes}m overtime
                </Badge>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="add-charges">Additional charges (₹)</FieldLabel>
              <Input
                id="add-charges"
                type="number"
                min={0}
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                placeholder="Snacks or drinks"
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
            <div className="rounded-[8px] border border-[#B77922]/30 bg-[#B77922]/10 p-3">
              <FieldLabel htmlFor="disc-reason" hint="Optional">
                Discount reason
              </FieldLabel>
              <Input
                id="disc-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Promo or goodwill"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-[8px] bg-[#1E2420] text-[#F2EFE7] px-4 py-3">
            <span className="text-xs font-medium text-[#B4BCB5]">
              Final amount payable
            </span>
            <span className="font-mono text-2xl font-medium tabular-nums">
              {formatINR(finalPayable)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel>Payment status</FieldLabel>
              <div className="flex gap-2">
                {(['full', 'partial', 'unpaid'] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPaymentMode(m)}
                    className={`rounded-[6px] border px-3 py-1 text-xs font-medium cursor-pointer transition-colors duration-150 ${
                      paymentMode === m
                        ? 'border-[#285943] bg-[#285943] text-white'
                        : 'border-[#1E2420]/15 bg-white text-[#1E2420] hover:bg-[#EDE9DD]'
                    }`}
                  >
                    {m === 'full' ? 'Mark paid' : m === 'partial' ? 'Partial' : 'Unpaid'}
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
                      className={`flex items-center justify-center gap-2 h-9 rounded-[8px] border text-xs font-medium cursor-pointer transition-colors duration-150 ${
                        paymentMethod === id
                          ? 'border-[#285943] bg-[#285943]/10 text-[#285943]'
                          : 'border-[#1E2420]/15 bg-white text-[#1E2420] hover:bg-[#EDE9DD]'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentMode === 'partial' && (
                    <div>
                      <FieldLabel htmlFor="partial-amt">Amount received now (₹)</FieldLabel>
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
                      Payment reference
                    </FieldLabel>
                    <Input
                      id="ref-note"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      placeholder="UPI ref or last 4 digits"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-[8px] border border-[#C65D50]/25 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
            <Button variant="outline" onClick={onClose}>
              Keep running
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Finalizing'
                : paymentMode === 'unpaid'
                  ? 'End & mark unpaid'
                  : `Confirm & collect ${formatINR(paidAmount)}`}
            </Button>
          </div>
        </form>
      ) : (
        <div className="py-6 text-center text-sm text-[#C65D50]">{error}</div>
      )}
    </Modal>
  );
}
