import React from 'react';
import { AlertTriangle, CheckCircle2, FileDown, ShieldAlert, XCircle } from 'lucide-react';
import type { ExportSafetyCheckResult } from '../../types/audit';
import { Modal } from '../shared/Modal';
import { Button, FactIdBadge } from '../shared/ui';

export type ExportActionType = 'pdf' | 'word' | 'plaintext';

const ACTION_LABELS: Record<ExportActionType, string> = {
  pdf: 'Download as PDF',
  word: 'Export Word (.docx)',
  plaintext: 'Copy Plain Text',
};

export const ExportSafetyModal: React.FC<{
  open: boolean;
  action: ExportActionType | null;
  safety: ExportSafetyCheckResult | null;
  onClose: () => void;
  onConfirmProceed: () => void;
  onReaudit: () => void;
}> = ({ open, action, safety, onClose, onConfirmProceed, onReaudit }) => {
  if (!open || !action || !safety) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={safety.allowed ? 'Pre-Export Verification Check' : 'Export Blocked — Verification Required'}
      description={`Action: ${ACTION_LABELS[action]}`}
      footer={
        safety.allowed ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirmProceed}>
              {action === 'pdf' ? 'Download as PDF' : `Proceed with ${ACTION_LABELS[action]}`}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Return to Audit Mode
            </Button>
            {safety.needsReviewCount > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onReaudit();
                }}
              >
                Re-Run Independent Audit
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {!safety.allowed ? (
          <div className="p-3.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-800/70 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#DC2626] dark:text-red-400">
              <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Clean ATS export is blocked to protect factual integrity</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#DC2626] dark:text-red-300">
              {safety.blockedReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
            {safety.blockingBulletIds.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#DC2626] dark:text-red-300">
                  Flagged claims:
                </span>
                {safety.blockingBulletIds.map((id) => (
                  <FactIdBadge key={id} id={id} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] dark:bg-emerald-950/50 dark:border-emerald-800/70 flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="text-xs text-[#059669] dark:text-emerald-300 space-y-0.5">
                <p className="font-semibold">
                  {safety.verifiedCount} verified and {safety.paraphrasedCount} paraphrased claims checked.
                </p>
                <p>No unverified edits or unresolved unsupported claims detected.</p>
              </div>
            </div>

            {safety.hasParaphrased && (
              <div className="p-3.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] dark:bg-amber-950/50 dark:border-amber-800/70 flex items-start gap-2.5">
                <AlertTriangle
                  className="w-4 h-4 text-[#D97706] dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-[#D97706] dark:text-amber-300 leading-relaxed">
                  This resume contains <strong className="font-mono">{safety.paraphrasedCount}</strong>{' '}
                  paraphrased claim(s) whose phrasing was refined while preserving exact factual meaning. Review them in Audit Mode if you prefer verbatim source wording.
                </p>
              </div>
            )}

            {safety.hasUserOverrides && (
              <div className="p-3.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-800/70 flex items-start gap-2.5">
                <ShieldAlert
                  className="w-4 h-4 text-[#DC2626] dark:text-red-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-[#DC2626] dark:text-red-300 leading-relaxed">
                  You have enabled a <strong>Personal-Use Override</strong> on one or more unsupported claims. Those claims are NOT AI-verified. Confirm you take personal responsibility before exporting.
                </p>
              </div>
            )}

            {action === 'pdf' && (
              <div className="p-3 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] dark:bg-[#18181B] dark:border-[#27272A] flex items-start gap-2.5">
                <FileDown
                  className="w-4 h-4 text-[#52525B] dark:text-[#A1A1AA] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Generates and downloads a clean, single-column <strong className="text-[#09090B] dark:text-[#FAFAFA]">1-page ATS PDF</strong> with selectable text and automatically balanced spacing.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
