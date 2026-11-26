'use client';

import * as React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { FieldLabel, Select } from '@/components/ui/input';
import { useGameZone } from '@/context/gamezone-context';
import { transferSessionById } from '@/lib/demo-store';

export function TransferModal() {
  const { transferSessionId, closeTransferModal } = useGameZone();
  if (!transferSessionId) return null;

  return (
    <TransferModalBody
      key={transferSessionId}
      sessionId={transferSessionId}
      onClose={closeTransferModal}
    />
  );
}

function TransferModalBody({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data, refresh, notify } = useGameZone();
  const session = data.activeSessions.find((s) => s.id === sessionId);
  const availableTargets = React.useMemo(
    () =>
      data.stations.filter(
        (s) => s.status === 'available' && s.id !== session?.station_id
      ),
    [data.stations, session?.station_id]
  );

  const [targetStationId, setTargetStationId] = React.useState(
    () => availableTargets[0]?.id || ''
  );
  const [keepOriginalRate, setKeepOriginalRate] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!session) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStationId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = transferSessionById(session.id, targetStationId, keepOriginalRate);
      if (!res.ok) {
        setError(res.error || 'Transfer failed');
        return;
      }
      notify(`Transferred ${session.session_code} successfully`, 'success');
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
      title="Transfer Gaming Station"
      subtitle={`Moving ${session.station_name} (${session.session_code})`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleTransfer} className="space-y-4">
        {availableTargets.length === 0 ? (
          <div className="rounded-[8px] border border-[#C65D50]/25 bg-[#C65D50]/10 p-3 text-xs text-[#A74438]">
            No other stations are currently available for transfer
          </div>
        ) : (
          <>
            <div>
              <FieldLabel>Destination station</FieldLabel>
              <Select
                value={targetStationId}
                onChange={(e) => setTargetStationId(e.target.value)}
              >
                {availableTargets.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.category_name}) — ₹{st.effective_pricing?.rate_30min ?? 100}/30m
                  </option>
                ))}
              </Select>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#1E2420] cursor-pointer">
              <input
                type="checkbox"
                checked={keepOriginalRate}
                onChange={(e) => setKeepOriginalRate(e.target.checked)}
                className="accent-[#285943]"
              />
              Keep original session hourly rate (₹{session.rate_30min}/30m)
            </label>
          </>
        )}

        {error && (
          <div className="rounded-[8px] border border-[#C65D50]/25 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2420]/8">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || availableTargets.length === 0}
          >
            <ArrowRightLeft className="h-4 w-4" strokeWidth={1.5} />
            {submitting ? 'Transferring' : 'Transfer session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
