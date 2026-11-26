import React, { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { ApprovalStatus, CareerFact } from '../../types/profile';
import { Button, FactIdBadge, IconButton, StatusPill } from '../shared/ui';

const SECTION_LABEL: Record<CareerFact['section'], string> = {
  header: 'Header & Contact',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Technical Skills',
  credentials: 'Credentials',
};

export const FactCard: React.FC<{
  fact: CareerFact;
  onStatusChange: (factId: string, status: ApprovalStatus) => void;
  onEdit: (factId: string, newContent: string) => void;
  onDelete: (factId: string) => void;
}> = ({ fact, onStatusChange, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(fact.content);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onEdit(fact.fact_id, trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(fact.content);
    setIsEditing(false);
  };

  return (
    <div
      data-testid={`fact-card-${fact.fact_id}`}
      className="px-4 py-3.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <FactIdBadge id={fact.fact_id} />
          <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
            {SECTION_LABEL[fact.section]}
            <span className="mx-1.5" aria-hidden="true">·</span>
            {fact.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusPill status={fact.status} />
        </div>
      </div>

      <div className="mt-2.5">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              aria-label={`Edit content for ${fact.fact_id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={fact.content.length > 90 ? 3 : 2}
              className="w-full px-3 py-2 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-sm text-[#09090B] dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15"
            />
            {fact.status === 'APPROVED' && (
              <p className="text-xs text-[#D97706] dark:text-amber-400">
                Saving changes to an approved fact resets its status to Pending Review so you can re-verify it.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={handleSave} disabled={!draft.trim()}>
                Save Changes
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#09090B] dark:text-[#FAFAFA] leading-relaxed break-words">
            {fact.content}
          </p>
        )}
      </div>

      {!isEditing && (
        <div className="mt-3 pt-2.5 border-t border-[#E4E4E7]/70 dark:border-[#27272A]/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {fact.status !== 'APPROVED' && (
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Approve ${fact.fact_id}`}
                onClick={() => onStatusChange(fact.fact_id, 'APPROVED')}
                className="text-[#059669] dark:text-emerald-400 hover:bg-[#ECFDF5] dark:hover:bg-emerald-950/50"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Approve
              </Button>
            )}
            {fact.status !== 'REJECTED' && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Reject ${fact.fact_id}`}
                onClick={() => onStatusChange(fact.fact_id, 'REJECTED')}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Reject
              </Button>
            )}
            {fact.status === 'REJECTED' && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${fact.fact_id} back to pending`}
                onClick={() => onStatusChange(fact.fact_id, 'PENDING')}
              >
                Restore to Pending
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              label={`Edit ${fact.fact_id}`}
              size="sm"
              onClick={() => {
                setDraft(fact.content);
                setIsEditing(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              label={`Delete ${fact.fact_id}`}
              size="sm"
              variant="danger"
              onClick={() => onDelete(fact.fact_id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
};
