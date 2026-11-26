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
      <div className="print-only-area space-y-4 text-xs text-[#202723]">
        <div className="text-center border-b border-dashed border-[#D4CEBC] pb-3">
          <div className="text-base font-bold tracking-tight text-[#202723]">
            {receiptData.zoneName}
          </div>
          {receiptData.zoneAddress && (
            <div className="text-[11px] text-[#646D67] mt-0.5">{receiptData.zoneAddress}</div>
          )}
          {receiptData.zonePhone && (
            <div className="text-[11px] text-[#646D67]">{receiptData.zonePhone}</div>
          )}
        </div>

        <div className="space-y-1.5 border-b border-dashed border-[#D4CEBC] pb-3">
          <div className="flex justify-between">
            <span className="text-[#646D67]">Receipt No:</span>
            <span className="font-mono font-semibold">{receiptData.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#646D67]">Session ID:</span>
            <span className="font-mono">{session.session_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#646D67]">Date & Time (IST):</span>
            <span>{formatISTDateTime(receiptData.issuedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#646D67]">Facility:</span>
            <span className="font-semibold">
              {session.category_name} — {session.station_name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#646D67]">Session Time:</span>
            <span>{formatMinutesReadable(session.billable_minutes)} billable</span>
          </div>
        </div>

        <div className="space-y-1.5 border-b border-dashed border-[#D4CEBC] pb-3">
          <div className="flex justify-between">
            <span>
              Rental Charge (₹{session.rate_30min}/30m)
            </span>
            <span className="font-mono">{formatINR(session.base_amount)}</span>
          </div>
          {session.additional_charges > 0 && (
            <div className="flex justify-between">
              <span>Additional Charges</span>
              <span className="font-mono">{formatINR(session.additional_charges)}</span>
            </div>
          )}
          {session.discount_amount > 0 && (
            <div className="flex justify-between text-[#285943]">
              <span>Discount{session.discount_reason ? ` (${session.discount_reason})` : ''}</span>
              <span className="font-mono">-{formatINR(session.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-[#EAE5D7]">
            <span>Total Payable</span>
            <span className="font-mono">{formatINR(session.final_amount)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[#646D67]">Payment Method:</span>
            <span className="font-semibold uppercase">
              {latestPayment?.method || session.payment_status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#646D67]">Paid Amount:</span>
            <span className="font-mono font-semibold text-[#285943]">
              {formatINR(session.paid_amount)}
            </span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-[#C65D50] font-semibold">
              <span>Balance Pending:</span>
              <span className="font-mono">{formatINR(balance)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-[#646D67] pt-2 border-t border-dashed border-[#D4CEBC]">
          {data.settings.receipt_footer || 'Thank you for playing with us!'}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#EAE5D7] no-print">
        <Button variant="outline" onClick={closeReceiptModal}>
          Close
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print Receipt
        </Button>
      </div>
    </Modal>
  );
}
