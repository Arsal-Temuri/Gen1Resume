import React, { useState } from 'react';
import { History, Pencil, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import type { AuditResult } from '../../types/audit';
import type { CareerFact } from '../../types/profile';
import { getOriginalEvidenceText } from '../../services/auditService';
import { Button, FactIdBadge, StatusPill } from '../shared/ui';

export const AuditInspector: React.FC<{
  bulletId: string;
  claimText: string;
  sourceFactIds: string[];
  auditResult?: AuditResult;
  factsLookup: Record<string, CareerFact>;
  onRevertToOriginal: (bulletId: string, originalText: string) => void;
  onEditText: (bulletId: string, nextText: string) => void;
  onRemoveBullet: (bulletId: string) => void;
  onToggleOverride: (bulletId: string, override: boolean) => void;
}> = ({
  bulletId,
  claimText,
  sourceFactIds,
  auditResult,
  factsLookup,
  onRevertToOriginal,
  onEditText,
  onRemoveBullet,
  onToggleOverride,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(claimText);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const originalEvidenceText = getOriginalEvidenceText(sourceFactIds, factsLookup);
  const status = auditResult?.status ?? 'NEEDS_REVIEW';

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onEditText(bulletId, trimmed);
    setIsEditing(false);
  };

  return (
    <div
      data-testid={`audit-inspector-${bulletId}`}
      className="mt-2.5 p-4 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-4 text-left"
    >
      {/* 1. Tailored Claim */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
            1. Tailored Claim
          </h4>
          <FactIdBadge id={bulletId} />
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              aria-label={`Edit tailored claim ${bulletId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-sm text-[#09090B] dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15"
            />
            <p className="text-xs text-[#D97706] dark:text-amber-400">
              Manual edits invalidate the previous verification status and require re-running the independent auditor.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={handleSaveEdit} disabled={!draft.trim()}>
                Save &amp; Mark Needs Re-Audit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(claimText);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#09090B] dark:text-[#FAFAFA] leading-relaxed bg-white dark:bg-[#121214] px-3 py-2 rounded-md border border-[#E4E4E7] dark:border-[#27272A]">
            {claimText}
          </p>
        )}
      </div>

      {/* 2. Original Approved Evidence */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
          2. Original Approved Evidence
        </h4>
        {sourceFactIds.length === 0 ? (
          <p className="text-xs text-[#DC2626] dark:text-red-400">
            No source fact IDs cited. Claims without approved source evidence cannot be verified.
          </p>
        ) : (
          <div className="space-y-2">
            {sourceFactIds.map((fid) => {
              const fact = factsLookup[fid];
              return (
                <div
                  key={fid}
                  className="px-3 py-2 rounded-md border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <FactIdBadge id={fid} />
                    {fact ? (
                      <StatusPill status={fact.status} />
                    ) : (
                      <span className="text-[11px] font-medium text-[#DC2626] dark:text-red-400">
                        Missing from Master Profile
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                    {fact ? fact.content : 'Referenced fact ID does not exist in the approved profile snapshot.'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Auditor Assessment */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
            3. Auditor Assessment
          </h4>
          <div className="flex items-center gap-1.5">
            <StatusPill status={status} />
            {auditResult?.user_override && <StatusPill status="USER_OVERRIDE" />}
          </div>
        </div>
        <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed bg-white dark:bg-[#121214] px-3 py-2 rounded-md border border-[#E4E4E7] dark:border-[#27272A]">
          {auditResult?.auditor_note ?? 'Pending independent verification.'}
        </p>

        {auditResult?.application_flags && auditResult.application_flags.length > 0 && (
          <div className="px-3 py-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-800/70 space-y-1">
            <p className="text-[11px] font-semibold text-[#DC2626] dark:text-red-400">
              Application-Side Integrity Flags
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-[#DC2626] dark:text-red-300">
              {auditResult.application_flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {auditResult?.previous_history && auditResult.previous_history.length > 0 && (
          <div className="pt-1 space-y-1">
            <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA]">
              <History className="w-3 h-3" aria-hidden="true" />
              Prior Audit History ({auditResult.previous_history.length})
            </p>
            {auditResult.previous_history.slice(0, 2).map((h, i) => (
              <p key={i} className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] pl-4">
                Previous ({h.status}): {h.auditor_note}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 4. Available Actions */}
      <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!originalEvidenceText || originalEvidenceText === claimText}
            onClick={() => onRevertToOriginal(bulletId, originalEvidenceText)}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Revert to Original
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(claimText);
              setIsEditing(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            Edit Text
          </Button>
          {status === 'UNSUPPORTED' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleOverride(bulletId, !auditResult?.user_override)}
              className="text-[#DC2626] dark:text-red-400"
            >
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              {auditResult?.user_override ? 'Remove Personal Override' : 'Personal-Use Override'}
            </Button>
          )}
        </div>

        {confirmRemove ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#DC2626] dark:text-red-400">Remove bullet?</span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onRemoveBullet(bulletId)}
            >
              Confirm Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Remove Bullet
          </Button>
        )}
      </div>
    </div>
  );
};
