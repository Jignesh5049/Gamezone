'use client';

import * as React from 'react';
import { Ban, Banknote, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldLabel, Input, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { formatISTDateTime } from '@/lib/timezone';
import { formatDurationHMS, formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';
import type {
  LiveTimerMetrics,
  PaymentMethod,
  PaymentRecord,
  ReceiptData,
  RentalCalculation,
  SessionEventRecord,
  SessionRecord,
} from '@/lib/types';

interface DetailResponse {
  session: SessionRecord;
  metrics: LiveTimerMetrics;
  calculation: RentalCalculation;
  events: SessionEventRecord[];
  payments: PaymentRecord[];
}

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

  const [detail, setDetail] = React.useState<DetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [cancelReason, setCancelReason] = React.useState('');
  const [showCancelBox, setShowCancelBox] = React.useState(false);
  const [settleAmount, setSettleAmount] = React.useState(0);
  const [settleMethod, setSettleMethod] = React.useState<PaymentMethod>('upi');
  const [busy, setBusy] = React.useState(false);

  const fetchAndApply = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
      const json = (await res.json()) as DetailResponse;
      if (res.ok && json.session) {
        setDetail(json);
        setNotes(json.session.notes || '');
        setSettleAmount(
          Math.max(0, json.session.final_amount - json.session.paid_amount)
        );
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: DetailResponse) => {
        if (!active || !json.session) return;
        setDetail(json);
        setNotes(json.session.notes || '');
        setSettleAmount(
          Math.max(0, json.session.final_amount - json.session.paid_amount)
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const handleSaveDetails = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${detail.session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        notify('Session info updated', 'success');
        await fetchAndApply();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSession = async () => {
    if (!detail || !cancelReason.trim()) {
      notify('Enter a cancellation reason', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${detail.session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancelReason }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(json.error || 'Could not cancel session', 'error');
        return;
      }
      notify('Session cancelled and station freed', 'info');
      onClose();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSettlePayment = async () => {
    if (!detail || settleAmount <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${detail.session.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: settleAmount, method: settleMethod }),
      });
      const json = (await res.json()) as { error?: string; receipt?: ReceiptData };
      if (!res.ok) {
        notify(json.error || 'Payment failed', 'error');
        return;
      }
      notify(`Recorded ₹${settleAmount} payment`, 'success');
      await fetchAndApply();
      await refresh();
      if (json.receipt) openReceiptModal(json.receipt);
    } finally {
      setBusy(false);
    }
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
      {loading || !detail ? (
        <div className="py-10 text-center text-sm text-[#646D67]">Loading session...</div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9]/70 p-2.5">
              <div className="text-[11px] text-[#646D67]">Status</div>
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
            <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9]/70 p-2.5">
              <div className="text-[11px] text-[#646D67]">Playing Time</div>
              <div className="font-mono font-bold text-sm mt-0.5">
                {formatDurationHMS(detail.metrics.billableElapsedSeconds)}
              </div>
            </div>
            <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9]/70 p-2.5">
              <div className="text-[11px] text-[#646D67]">Billable</div>
              <div className="font-mono font-bold text-sm mt-0.5">
                {detail.session.status === 'completed'
                  ? formatMinutesReadable(detail.session.billable_minutes)
                  : formatMinutesReadable(detail.calculation.billableMinutes)}
              </div>
            </div>
            <div className="rounded-lg border border-[#DFD9C8] bg-[#F5F2E9]/70 p-2.5">
              <div className="text-[11px] text-[#646D67]">Amount / Paid</div>
              <div className="font-mono font-bold text-sm mt-0.5">
                {formatINR(detail.session.final_amount)} /{' '}
                <span className="text-[#285943]">{formatINR(detail.session.paid_amount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#DFD9C8] bg-white p-3.5 space-y-2.5">
            <div className="font-semibold text-[#202723]">Session Notes</div>
            <div>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes..."
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={busy} onClick={handleSaveDetails}>
                Save Notes
              </Button>
            </div>
          </div>

          {detail.session.status === 'completed' && balance > 0 && (
            <div className="rounded-lg border border-[#D89B45]/40 bg-[#D89B45]/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#8E5B13]">
                  Pending Balance: {formatINR(balance)}
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
                <Button size="sm" disabled={busy} onClick={handleSettlePayment}>
                  <Banknote className="h-3.5 w-3.5" />
                  Collect Payment
                </Button>
              </div>
            </div>
          )}

          <div>
            <div className="font-semibold text-[#202723] mb-1.5">Session Audit Timeline</div>
            <div className="rounded-lg border border-[#DFD9C8] bg-white divide-y divide-[#EAE5D7] max-h-40 overflow-y-auto">
              {detail.events.length === 0 ? (
                <div className="p-3 text-[#646D67]">
                  Started at {formatISTDateTime(detail.session.started_at)}
                </div>
              ) : (
                detail.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <span className="font-semibold uppercase text-[10px] text-[#285943] mr-2">
                        {ev.event_type}
                      </span>
                      <span className="text-[#5A635D]">by {ev.actor_name || 'Staff'}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#646D67]">
                      {formatISTDateTime(ev.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {(detail.session.status === 'active' || detail.session.status === 'paused') && (
            <div className="pt-2 border-t border-[#EAE5D7]">
              {!showCancelBox ? (
                <button
                  type="button"
                  onClick={() => setShowCancelBox(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C65D50] hover:underline cursor-pointer"
                >
                  <Ban className="h-3.5 w-3.5" /> Cancel this session with reason
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (e.g., power outage, customer left early)..."
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={handleCancelSession}
                  >
                    Confirm Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#EAE5D7]">
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
                <FileText className="h-3.5 w-3.5" />
                View Receipt
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
