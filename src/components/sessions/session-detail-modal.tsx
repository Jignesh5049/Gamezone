'use client';

import * as React from 'react';
import { Ban, Banknote, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldLabel, Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import {
  cancelSessionById,
  getSessionDetailById,
  settlePaymentById,
  updateSessionNotesById,
} from '@/lib/demo-store';
import { formatISTDateTime } from '@/lib/timezone';
import { formatDurationHMS, formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/types';

export function SessionDetailModal() {
  const { detailSessionId, closeSessionDetailModal } = useGameZone();
  if (!detailSessionId) return null;

  return (
    <SessionDetailModalBody
      key={detailSessionId}
      sessionId={detailSessionId}
      onClose={closeSessionDetailModal}
    />
  );
}

function SessionDetailModalBody({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data, openReceiptModal, refresh, notify } = useGameZone();
  const [tick, setTick] = React.useState(0);
  const detail = React.useMemo(() => {
    void tick;
    return getSessionDetailById(sessionId);
  }, [sessionId, tick]);

  const [notes, setNotes] = React.useState(detail?.session.notes || '');
  const [cancelReason, setCancelReason] = React.useState('');
  const [showCancelBox, setShowCancelBox] = React.useState(false);
  const [settleAmount, setSettleAmount] = React.useState(() =>
    detail ? Math.max(0, detail.session.final_amount - detail.session.paid_amount) : 0
  );
  const [settleMethod, setSettleMethod] = React.useState<PaymentMethod>('upi');

  const handleSaveDetails = async () => {
    if (!detail) return;
    if (updateSessionNotesById(detail.session.id, notes)) {
      notify('Session notes updated', 'success');
      setTick((t) => t + 1);
      await refresh();
    }
  };

  const handleCancelSession = async () => {
    if (!detail || !cancelReason.trim()) {
      notify('Enter a cancellation reason', 'error');
      return;
    }
    const res = cancelSessionById(detail.session.id, cancelReason);
    if (!res.ok) {
      notify(res.error || 'Could not cancel session', 'error');
      return;
    }
    notify('Session cancelled and station freed', 'info');
    onClose();
    await refresh();
  };

  const handleSettlePayment = async () => {
    if (!detail || settleAmount <= 0) return;
    const res = settlePaymentById(detail.session.id, settleAmount, settleMethod);
    if (!res.ok) {
      notify(res.error || 'Payment failed', 'error');
      return;
    }
    notify(`Recorded ₹${settleAmount} payment`, 'success');
    setTick((t) => t + 1);
    await refresh();
    if (res.receipt) openReceiptModal(res.receipt);
  };

  const balance = detail
    ? Math.max(0, detail.session.final_amount - detail.session.paid_amount)
    : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={detail ? `Session ${detail.session.session_code}` : 'Session Details'}
      subtitle={
        detail
          ? `${detail.session.station_name} • ${detail.session.category_name}`
          : undefined
      }
      maxWidth="max-w-2xl"
    >
      {!detail ? (
        <div className="py-8 text-center text-sm text-[#707973]">Session not found</div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Status</div>
              <Badge
                tone={
                  detail.session.status === 'active'
                    ? 'red'
                    : detail.session.status === 'paused'
                      ? 'amber'
                      : detail.session.status === 'completed'
                        ? 'green'
                        : 'grey'
                }
                className="mt-1 capitalize"
              >
                {detail.session.status}
              </Badge>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Playing time</div>
              <div className="font-mono font-medium text-sm tabular-nums mt-1">
                {formatDurationHMS(detail.metrics.billableElapsedSeconds)}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Billable</div>
              <div className="font-mono font-medium text-sm tabular-nums mt-1">
                {detail.session.status === 'completed'
                  ? formatMinutesReadable(detail.session.billable_minutes)
                  : formatMinutesReadable(detail.calculation.billableMinutes)}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-[#F5F2E9] p-3">
              <div className="text-xs text-[#707973]">Amount / paid</div>
              <div className="font-mono font-medium text-sm tabular-nums mt-1">
                {formatINR(detail.session.final_amount)} /{' '}
                <span className="text-[#285943]">{formatINR(detail.session.paid_amount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[#1E2420]/10 bg-white p-4 space-y-3">
            <div className="font-medium text-[#1E2420]">Session notes</div>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note"
            />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={handleSaveDetails}>
                Save notes
              </Button>
            </div>
          </div>

          {detail.session.status === 'completed' && balance > 0 && (
            <div className="rounded-[8px] border border-[#B77922]/30 bg-[#B77922]/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#8E5B13]">
                  Pending balance: {formatINR(balance)}
                </span>
                <Badge tone="amber" className="capitalize">
                  {detail.session.payment_status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <FieldLabel>Amount (₹)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={balance}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(Number(e.target.value))}
                  />
                </div>
                <div className="w-32">
                  <FieldLabel>Method</FieldLabel>
                  <Select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <Button size="sm" onClick={handleSettlePayment}>
                  <Banknote className="h-4 w-4" strokeWidth={1.5} />
                  Collect payment
                </Button>
              </div>
            </div>
          )}

          <div>
            <div className="font-medium text-[#1E2420] mb-2">Session audit timeline</div>
            <div className="rounded-[8px] border border-[#1E2420]/10 bg-white divide-y divide-[#1E2420]/8 max-h-40 overflow-y-auto">
              {detail.events.length === 0 ? (
                <div className="p-3 text-[#707973]">
                  Started at {formatISTDateTime(detail.session.started_at)}
                </div>
              ) : (
                detail.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <span className="font-medium text-xs text-[#285943] capitalize mr-2">
                        {ev.event_type.replace('_', ' ')}
                      </span>
                      <span className="text-[#525B55]">by {ev.actor_name || 'Owner'}</span>
                    </div>
                    <span className="font-mono text-xs text-[#707973] tabular-nums">
                      {formatISTDateTime(ev.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {(detail.session.status === 'active' || detail.session.status === 'paused') && (
            <div className="pt-3 border-t border-[#1E2420]/8">
              {!showCancelBox ? (
                <button
                  type="button"
                  onClick={() => setShowCancelBox(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#C65D50] hover:underline cursor-pointer"
                >
                  <Ban className="h-4 w-4" strokeWidth={1.5} /> Cancel this session with reason
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation"
                  />
                  <Button size="sm" variant="danger" onClick={handleCancelSession}>
                    Confirm cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-[#1E2420]/8">
            {detail.payments.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  openReceiptModal({
                    zoneName: data.settings.zone_name || 'Apex Arena Game Zone',
                    zoneAddress: data.settings.zone_address || '',
                    zonePhone: data.settings.zone_phone || '',
                    receiptNumber:
                      detail.payments[detail.payments.length - 1].receipt_number,
                    issuedAt: detail.payments[detail.payments.length - 1].paid_at,
                    session: detail.session,
                    payments: detail.payments,
                  });
                }}
              >
                <FileText className="h-4 w-4" strokeWidth={1.5} />
                View receipt
              </Button>
            ) : (
              <div />
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
