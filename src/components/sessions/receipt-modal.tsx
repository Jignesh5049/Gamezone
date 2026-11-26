'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useGameZone } from '@/context/gamezone-context';
import { formatISTDateTime } from '@/lib/timezone';
import { formatMinutesReadable } from '@/lib/timer';
import { formatINR } from '@/lib/utils';

export function ReceiptModal() {
  const { receiptData, closeReceiptModal, data } = useGameZone();
  if (!receiptData) return null;

  const { session, payments } = receiptData;
  const latestPayment = payments[payments.length - 1];
  const balance = Math.max(0, session.final_amount - session.paid_amount);

  return (
    <Modal
      open={Boolean(receiptData)}
      onClose={closeReceiptModal}
      title="Payment Receipt"
      subtitle={`Receipt #${receiptData.receiptNumber}`}
      maxWidth="max-w-md"
    >
      <div className="print-only-area space-y-4 text-xs text-[#1E2420]">
        <div className="text-center border-b border-dashed border-[#1E2420]/20 pb-3">
          <div className="text-base font-medium text-[#1E2420]">
            {receiptData.zoneName}
          </div>
          {receiptData.zoneAddress && (
            <div className="text-xs text-[#707973] mt-1">{receiptData.zoneAddress}</div>
          )}
          {receiptData.zonePhone && (
            <div className="text-xs text-[#707973]">{receiptData.zonePhone}</div>
          )}
        </div>

        <div className="space-y-2 border-b border-dashed border-[#1E2420]/20 pb-3">
          <div className="flex justify-between">
            <span className="text-[#707973]">Receipt no</span>
            <span className="font-mono font-medium">{receiptData.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#707973]">Session ID</span>
            <span className="font-mono">{session.session_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#707973]">Date & time (IST)</span>
            <span className="font-mono tabular-nums">{formatISTDateTime(receiptData.issuedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#707973]">Facility</span>
            <span className="font-medium">
              {session.category_name} — {session.station_name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#707973]">Session time</span>
            <span>{formatMinutesReadable(session.billable_minutes)} billable</span>
          </div>
        </div>

        <div className="space-y-2 border-b border-dashed border-[#1E2420]/20 pb-3">
          <div className="flex justify-between">
            <span>Rental charge (₹{session.rate_30min}/30m)</span>
            <span className="font-mono tabular-nums">{formatINR(session.base_amount)}</span>
          </div>
          {session.additional_charges > 0 && (
            <div className="flex justify-between">
              <span>Additional charges</span>
              <span className="font-mono tabular-nums">{formatINR(session.additional_charges)}</span>
            </div>
          )}
          {session.discount_amount > 0 && (
            <div className="flex justify-between text-[#285943]">
              <span>Discount{session.discount_reason ? ` (${session.discount_reason})` : ''}</span>
              <span className="font-mono tabular-nums">-{formatINR(session.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium pt-2 border-t border-[#1E2420]/10">
            <span>Total payable</span>
            <span className="font-mono tabular-nums">{formatINR(session.final_amount)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[#707973]">Payment method</span>
            <span className="font-mono font-medium uppercase">
              {latestPayment?.method || session.payment_status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#707973]">Paid amount</span>
            <span className="font-mono font-medium text-[#285943] tabular-nums">
              {formatINR(session.paid_amount)}
            </span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-[#C65D50] font-medium">
              <span>Balance pending</span>
              <span className="font-mono tabular-nums">{formatINR(balance)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-[#707973] pt-3 border-t border-dashed border-[#1E2420]/20">
          {data.settings.receipt_footer || 'Thank you for playing at Apex Arena'}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[#1E2420]/8 no-print">
        <Button variant="outline" onClick={closeReceiptModal}>
          Close
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          Print receipt
        </Button>
      </div>
    </Modal>
  );
}
