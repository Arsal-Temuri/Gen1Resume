import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import type { VersionSnapshot } from '../../types/history';
import { formatDateTime } from '../../utils/textUtils';
import { compareVersionSnapshots } from '../../utils/versionDiff';
import { Modal } from '../shared/Modal';
import { Button, FactIdBadge } from '../shared/ui';

function formatDelta(delta: number, suffix = ''): string {
  if (delta === 0) return `0${suffix}`;
  return `${delta > 0 ? '+' : ''}${delta}${suffix}`;
}

function deltaToneClass(delta: number): string {
  if (delta > 0) return 'text-[#059669] dark:text-emerald-400';
  if (delta < 0) return 'text-[#DC2626] dark:text-red-400';
  return 'text-[#71717A] dark:text-[#A1A1AA]';
}

function formatVersionOption(v: VersionSnapshot): string {
  return `${v.targetRole} — ${v.companyName} (${v.matchScore}% match · ${formatDateTime(v.createdAt)})`;
}

export const VersionDiffModal: React.FC<{
  open: boolean;
  onClose: () => void;
  versions: VersionSnapshot[];
  initialLeftId?: string | null;
  initialRightId?: string | null;
}> = ({ open, onClose, versions, initialLeftId, initialRightId }) => {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');

  useEffect(() => {
    if (!open || versions.length < 2) return;
    const defaultRight = initialRightId && versions.some((v) => v.versionId === initialRightId)
      ? initialRightId
      : versions[0].versionId;
    const defaultLeft =
      initialLeftId &&
      initialLeftId !== defaultRight &&
      versions.some((v) => v.versionId === initialLeftId)
        ? initialLeftId
        : (versions.find((v) => v.versionId !== defaultRight)?.versionId ?? versions[0].versionId);

    setLeftId(defaultLeft);
    setRightId(defaultRight);
  }, [open, versions, initialLeftId, initialRightId]);

  const leftVersion = useMemo(
    () => versions.find((v) => v.versionId === leftId) ?? null,
    [versions, leftId]
  );
  const rightVersion = useMemo(
    () => versions.find((v) => v.versionId === rightId) ?? null,
    [versions, rightId]
  );

  const diff = useMemo(() => {
    if (!leftVersion || !rightVersion) return null;
    return compareVersionSnapshots(leftVersion, rightVersion);
  }, [leftVersion, rightVersion]);

  const handleSwap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  const modifiedClaims = diff?.claimDiffs.filter((c) => c.status === 'modified') ?? [];
  const addedClaims = diff?.claimDiffs.filter((c) => c.status === 'added') ?? [];
  const removedClaims = diff?.claimDiffs.filter((c) => c.status === 'removed') ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare Resume Versions"
      description="Inspect score deltas, evidence lineage changes, and exact claim edits between two immutable snapshots."
      maxWidthClass="max-w-4xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close Comparison
        </Button>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Version Selectors + Swap */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 items-end">
          <div className="space-y-1">
            <label
              htmlFor="diff-left-version"
              className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]"
            >
              Version A (Baseline)
            </label>
            <select
              id="diff-left-version"
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]"
            >
              {versions.map((v) => (
                <option key={v.versionId} value={v.versionId}>
                  {formatVersionOption(v)}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleSwap}
            aria-label="Swap Version A and Version B"
            className="h-9"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
            Swap A ↔ B
          </Button>

          <div className="space-y-1">
            <label
              htmlFor="diff-right-version"
              className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]"
            >
              Version B (Comparison)
            </label>
            <select
              id="diff-right-version"
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]"
            >
              {versions.map((v) => (
                <option key={v.versionId} value={v.versionId}>
                  {formatVersionOption(v)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {leftId === rightId ? (
          <div className="p-4 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-xs text-[#52525B] dark:text-[#A1A1AA]">
            Select two different snapshots above to inspect their differences.
          </div>
        ) : (
          diff &&
          leftVersion &&
          rightVersion && (
            <>
              {/* Score & Lineage Delta Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-1">
                  <p className="text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA]">
                    Match Score Delta
                  </p>
                  <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                    <span className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
                      {leftVersion.matchScore}% → {rightVersion.matchScore}%
                    </span>
                    <span className={`text-base font-semibold ${deltaToneClass(diff.matchScoreDelta)}`}>
                      {formatDelta(diff.matchScoreDelta, '%')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-1">
                  <p className="text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA]">
                    Verification Score Delta
                  </p>
                  <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                    <span className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
                      {leftVersion.verificationScore}% → {rightVersion.verificationScore}%
                    </span>
                    <span
                      className={`text-base font-semibold ${deltaToneClass(diff.verificationScoreDelta)}`}
                    >
                      {formatDelta(diff.verificationScoreDelta, '%')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-1">
                  <p className="text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA]">
                    Cited Source Facts
                  </p>
                  <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                    <span className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
                      {leftVersion.sourceFactIds.length} → {rightVersion.sourceFactIds.length}
                    </span>
                    <span
                      className={`text-base font-semibold ${deltaToneClass(diff.sourceFactCountDelta)}`}
                    >
                      {formatDelta(diff.sourceFactCountDelta)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills & Credentials Diff */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Skills &amp; Credentials Changes
                </h3>
                {diff.addedSkills.length === 0 &&
                diff.removedSkills.length === 0 &&
                diff.addedCredentials.length === 0 &&
                diff.removedCredentials.length === 0 ? (
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                    Identical skills and credentials between Version A and Version B.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-[#A7F3D0] dark:border-emerald-900/70 bg-[#ECFDF5]/60 dark:bg-emerald-950/30 space-y-2">
                      <p className="text-xs font-semibold text-[#059669] dark:text-emerald-400 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        Added in Version B ({diff.addedSkills.length + diff.addedCredentials.length})
                      </p>
                      {diff.addedSkills.length === 0 && diff.addedCredentials.length === 0 ? (
                        <p className="text-xs text-[#71717A]">None</p>
                      ) : (
                        <div className="space-y-1 text-xs text-[#09090B] dark:text-[#FAFAFA]">
                          {diff.addedSkills.length > 0 && (
                            <p>
                              <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
                                Skills:{' '}
                              </span>
                              {diff.addedSkills.join(', ')}
                            </p>
                          )}
                          {diff.addedCredentials.length > 0 && (
                            <p>
                              <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
                                Credentials:{' '}
                              </span>
                              {diff.addedCredentials.join('; ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg border border-[#FECACA] dark:border-red-900/70 bg-[#FEF2F2]/60 dark:bg-red-950/30 space-y-2">
                      <p className="text-xs font-semibold text-[#DC2626] dark:text-red-400 flex items-center gap-1.5">
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        Removed from Version A (
                        {diff.removedSkills.length + diff.removedCredentials.length})
                      </p>
                      {diff.removedSkills.length === 0 && diff.removedCredentials.length === 0 ? (
                        <p className="text-xs text-[#71717A]">None</p>
                      ) : (
                        <div className="space-y-1 text-xs text-[#09090B] dark:text-[#FAFAFA]">
                          {diff.removedSkills.length > 0 && (
                            <p>
                              <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
                                Skills:{' '}
                              </span>
                              {diff.removedSkills.join(', ')}
                            </p>
                          )}
                          {diff.removedCredentials.length > 0 && (
                            <p>
                              <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
                                Credentials:{' '}
                              </span>
                              {diff.removedCredentials.join('; ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Lineage Diff */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                    Fact Lineage Diff
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-[#71717A] dark:text-[#A1A1AA]">
                    {diff.sharedFactIds.length} shared · +{diff.addedFactIds.length} added · -
                    {diff.removedFactIds.length} removed
                  </span>
                </div>
                {diff.addedFactIds.length === 0 && diff.removedFactIds.length === 0 ? (
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                    Both versions cite the exact same {diff.sharedFactIds.length} Master Profile fact
                    ID(s).
                  </p>
                ) : (
                  <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-2.5">
                    {diff.addedFactIds.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-[#059669] dark:text-emerald-400">
                          Added Fact IDs in Version B
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {diff.addedFactIds.map((id) => (
                            <FactIdBadge key={`add-${id}`} id={id} />
                          ))}
                        </div>
                      </div>
                    )}
                    {diff.removedFactIds.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-[#DC2626] dark:text-red-400">
                          Removed Fact IDs from Version A
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {diff.removedFactIds.map((id) => (
                            <FactIdBadge key={`rem-${id}`} id={id} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Claim-Level Diff */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                    Claim-Level Changes
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums">
                    <span className="text-[#D97706] dark:text-amber-400">
                      {modifiedClaims.length} Modified
                    </span>
                    <span className="text-[#059669] dark:text-emerald-400">
                      {addedClaims.length} Added
                    </span>
                    <span className="text-[#DC2626] dark:text-red-400">
                      {removedClaims.length} Removed
                    </span>
                    <span className="text-[#71717A] dark:text-[#A1A1AA]">
                      {diff.unchangedClaimCount} Unchanged
                    </span>
                  </div>
                </div>

                {diff.claimDiffs.length === 0 ? (
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                    All {diff.unchangedClaimCount} resume claims are identical between these two
                    snapshots.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {diff.claimDiffs.map((entry, idx) => (
                      <div
                        key={`${entry.key}-${idx}`}
                        className={`p-3 rounded-lg border bg-white dark:bg-[#121214] space-y-2 ${
                          entry.status === 'modified'
                            ? 'border-[#FDE68A] dark:border-amber-800/70 border-l-4 border-l-[#D97706]'
                            : entry.status === 'added'
                              ? 'border-[#A7F3D0] dark:border-emerald-800/70 border-l-4 border-l-[#059669]'
                              : 'border-[#FECACA] dark:border-red-800/70 border-l-4 border-l-[#DC2626]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono text-[11px] font-semibold uppercase ${
                                entry.status === 'modified'
                                  ? 'text-[#D97706] dark:text-amber-400'
                                  : entry.status === 'added'
                                    ? 'text-[#059669] dark:text-emerald-400'
                                    : 'text-[#DC2626] dark:text-red-400'
                              }`}
                            >
                              {entry.status}
                            </span>
                            <span className="font-mono text-[11px] text-[#71717A]">
                              {entry.bulletId}
                            </span>
                            <span className="text-[#52525B] dark:text-[#A1A1AA]">
                              {entry.section} · {entry.context}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {entry.sourceFactIds.map((fid) => (
                              <FactIdBadge key={fid} id={fid} />
                            ))}
                          </div>
                        </div>

                        {entry.status === 'modified' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-md bg-[#FEF2F2]/70 dark:bg-red-950/30 border border-[#FECACA]/70 dark:border-red-900/50 space-y-1">
                              <p className="text-[11px] font-medium text-[#DC2626] dark:text-red-400">
                                Version A (Before)
                              </p>
                              <p className="text-[#09090B] dark:text-[#FAFAFA] leading-relaxed">
                                {entry.beforeText}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-md bg-[#ECFDF5]/70 dark:bg-emerald-950/30 border border-[#A7F3D0]/70 dark:border-emerald-900/50 space-y-1">
                              <p className="text-[11px] font-medium text-[#059669] dark:text-emerald-400">
                                Version B (After)
                              </p>
                              <p className="text-[#09090B] dark:text-[#FAFAFA] leading-relaxed">
                                {entry.afterText}
                              </p>
                            </div>
                          </div>
                        )}

                        {entry.status === 'added' && (
                          <p className="text-xs text-[#09090B] dark:text-[#FAFAFA] leading-relaxed">
                            {entry.afterText}
                          </p>
                        )}

                        {entry.status === 'removed' && (
                          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] line-through leading-relaxed">
                            {entry.beforeText}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>
    </Modal>
  );
};
