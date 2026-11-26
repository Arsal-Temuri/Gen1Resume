import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  GitCompareArrows,
  History,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  APPLICATION_STATUSES,
  type ApplicationSettings,
  type ApplicationStatus,
  type VersionSnapshot,
} from '../types/history';
import type { MasterProfile } from '../types/profile';
import { exportApplicationBackup } from '../services/exportService';
import {
  buildBackupPayload,
  parseAndValidateBackupJson,
} from '../services/storageService';
import { formatDateTime } from '../utils/textUtils';
import { VersionDiffModal } from '../components/history/VersionDiffModal';
import { ConfirmDialog, Modal } from '../components/shared/Modal';
import {
  Button,
  Card,
  EmptyState,
  FactIdBadge,
  StatusPill,
  Textarea,
} from '../components/shared/ui';

type StatusFilter = 'all' | ApplicationStatus;

const STATUS_SELECT_STYLES: Record<ApplicationStatus, string> = {
  draft:
    'border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA]',
  applied:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300',
  interviewing:
    'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706] dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300',
  offer:
    'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669] dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300',
  rejected:
    'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300',
  archived:
    'border-[#E4E4E7] bg-zinc-100 text-[#71717A] dark:border-[#27272A] dark:bg-zinc-900 dark:text-[#71717A]',
};

export const VersionHistoryPage: React.FC<{
  profile: MasterProfile | null;
  versions: VersionSnapshot[];
  settings: ApplicationSettings;
  onOpenVersion: (version: VersionSnapshot) => void;
  onDuplicateVersion: (versionId: string) => VersionSnapshot | null;
  onUpdateVersionTracking: (
    versionId: string,
    patch: { applicationStatus?: ApplicationStatus; applicationNotes?: string }
  ) => void;
  onDeleteVersion: (versionId: string) => void;
  onRestoreBackup: (restored: {
    profile: MasterProfile | null;
    versions: VersionSnapshot[];
    settings: ApplicationSettings;
  }) => void;
  onResetAllData: () => void;
  onGoToStudio: () => void;
  onNotify: (
    title: string,
    opts?: { description?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }
  ) => void;
}> = ({
  profile,
  versions,
  settings,
  onOpenVersion,
  onDuplicateVersion,
  onUpdateVersionTracking,
  onDeleteVersion,
  onRestoreBackup,
  onResetAllData,
  onGoToStudio,
  onNotify,
}) => {
  const [inspectVersionId, setInspectVersionId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [diffModalState, setDiffModalState] = useState<{
    open: boolean;
    leftId: string | null;
    rightId: string | null;
  }>({ open: false, leftId: null, rightId: null });
  const [deleteTarget, setDeleteTarget] = useState<VersionSnapshot | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const inspectVersion = useMemo(
    () => versions.find((v) => v.versionId === inspectVersionId) ?? null,
    [versions, inspectVersionId]
  );

  useEffect(() => {
    if (inspectVersion) {
      setNotesDraft(inspectVersion.applicationNotes ?? '');
    }
  }, [inspectVersion?.versionId]);

  const statusCounts = useMemo(() => {
    const counts: Record<ApplicationStatus, number> = {
      draft: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      archived: 0,
    };
    for (const v of versions) {
      const s = v.applicationStatus ?? 'draft';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [versions]);

  const filteredVersions = useMemo(() => {
    if (statusFilter === 'all') return versions;
    return versions.filter((v) => (v.applicationStatus ?? 'draft') === statusFilter);
  }, [versions, statusFilter]);

  const handleStatusChange = (ver: VersionSnapshot, nextStatus: ApplicationStatus) => {
    onUpdateVersionTracking(ver.versionId, { applicationStatus: nextStatus });
    const label = APPLICATION_STATUSES.find((s) => s.value === nextStatus)?.label ?? nextStatus;
    onNotify(`Updated status to ${label}`, {
      description: `${ver.targetRole} — ${ver.companyName}`,
      tone: 'neutral',
    });
  };

  const handleSaveNotes = () => {
    if (!inspectVersion) return;
    onUpdateVersionTracking(inspectVersion.versionId, {
      applicationNotes: notesDraft.trim(),
    });
    onNotify('Application notes saved', {
      description: 'Saved locally without modifying the immutable resume snapshot.',
      tone: 'success',
    });
  };

  const openDiffForVersion = (targetVersion: VersionSnapshot) => {
    const other = versions.find((v) => v.versionId !== targetVersion.versionId) ?? null;
    setDiffModalState({
      open: true,
      leftId: other?.versionId ?? null,
      rightId: targetVersion.versionId,
    });
  };

  const handleExportBackup = () => {
    const payload = buildBackupPayload(profile, versions, settings);
    const filename = exportApplicationBackup(payload);
    onNotify('Application backup exported', {
      description: `Saved ${filename} with profile, version snapshots, and settings.`,
      tone: 'success',
    });
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const restored = parseAndValidateBackupJson(text);
      onRestoreBackup({
        profile: restored.profile,
        versions: restored.versions,
        settings: restored.settings,
      });
      onNotify('Application backup imported', {
        description:
          restored.warnings.length > 0
            ? restored.warnings.join(' ')
            : `Restored ${restored.versions.length} version snapshot(s).`,
        tone: restored.warnings.length > 0 ? 'warning' : 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import backup JSON.';
      onNotify('Backup import failed', { description: msg, tone: 'error' });
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Backup Toolbar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
            Version History
          </h1>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
            Immutable tailoring snapshots stored locally with application tracking, evidence lineage, and side-by-side comparison.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {versions.length >= 2 && (
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                setDiffModalState({
                  open: true,
                  leftId: versions[1]?.versionId ?? null,
                  rightId: versions[0]?.versionId ?? null,
                })
              }
            >
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              Compare Versions
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleExportBackup}>
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export Backup (.json)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Import Backup (.json)
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="sr-only"
            aria-label="Import Gen1Resume JSON backup"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmResetOpen(true)}
            className="text-[#DC2626] dark:text-red-400"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset Storage
          </Button>
        </div>
      </div>

      {/* Application Status Filter Bar */}
      {versions.length > 0 && (
        <div
          role="group"
          aria-label="Filter versions by application status"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            aria-pressed={statusFilter === 'all'}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'border-[#18181B] bg-[#18181B] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#09090B]'
                : 'border-[#E4E4E7] bg-white text-[#52525B] hover:text-[#09090B] dark:border-[#27272A] dark:bg-[#121214] dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
            }`}
          >
            All <span className="font-mono tabular-nums opacity-75">({versions.length})</span>
          </button>
          {APPLICATION_STATUSES.map((st) => {
            const count = statusCounts[st.value];
            const active = statusFilter === st.value;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-[#18181B] bg-[#18181B] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#09090B]'
                    : 'border-[#E4E4E7] bg-white text-[#52525B] hover:text-[#09090B] dark:border-[#27272A] dark:bg-[#121214] dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {st.label} <span className="font-mono tabular-nums opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Version List */}
      {versions.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="No saved versions yet"
          description="Every successful tailoring run is saved automatically as an immutable snapshot containing the job description, match score, audit results, and exact source facts."
          action={
            <Button variant="primary" onClick={onGoToStudio}>
              Go to Tailoring Studio
            </Button>
          }
        />
      ) : filteredVersions.length === 0 ? (
        <EmptyState
          title="No versions match this status filter"
          description="Try switching back to All or updating a version's application stage."
          action={
            <Button size="sm" variant="secondary" onClick={() => setStatusFilter('all')}>
              Show All Versions
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredVersions.map((ver) => {
            const currentStatus: ApplicationStatus = ver.applicationStatus ?? 'draft';
            return (
              <Card key={ver.versionId} padding="md" className="space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                        {ver.targetRole}
                      </h2>
                      <span className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
                        · {ver.companyName}
                      </span>
                      <StatusPill
                        status={
                          ver.auditStatus === 'CLEAN'
                            ? 'VERIFIED'
                            : ver.auditStatus === 'HAS_PARAPHRASED'
                              ? 'PARAPHRASED'
                              : 'UNSUPPORTED'
                        }
                      />
                      <select
                        aria-label={`Application status for ${ver.targetRole}`}
                        value={currentStatus}
                        onChange={(e) =>
                          handleStatusChange(ver, e.target.value as ApplicationStatus)
                        }
                        className={`h-6 px-2 rounded-md border text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900/15 ${STATUS_SELECT_STYLES[currentStatus]}`}
                      >
                        {APPLICATION_STATUSES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#71717A] dark:text-[#A1A1AA] font-mono tabular-nums">
                      <span>{ver.versionId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(ver.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Match {ver.matchScore}%</span>
                      <span aria-hidden="true">·</span>
                      <span>Verification {ver.verificationScore}%</span>
                      <span aria-hidden="true">·</span>
                      <span>{ver.sourceFactIds.length} source facts</span>
                      {ver.userEdits.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{ver.userEdits.length} manual edit(s)</span>
                        </>
                      )}
                    </div>
                    {ver.applicationNotes?.trim() && (
                      <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] line-clamp-1">
                        Note: {ver.applicationNotes.trim()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button size="sm" variant="primary" onClick={() => onOpenVersion(ver)}>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      Open
                    </Button>
                    {versions.length >= 2 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDiffForVersion(ver)}
                      >
                        <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
                        Compare
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const copy = onDuplicateVersion(ver.versionId);
                        if (copy) {
                          onNotify('Version duplicated', {
                            description: `Created editable copy ${copy.versionId}.`,
                            tone: 'success',
                          });
                        }
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setInspectVersionId(ver.versionId)}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Details
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Delete version ${ver.targetRole}`}
                      onClick={() => setDeleteTarget(ver)}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Version Diff Comparison Modal */}
      <VersionDiffModal
        open={diffModalState.open}
        onClose={() => setDiffModalState((prev) => ({ ...prev, open: false }))}
        versions={versions}
        initialLeftId={diffModalState.leftId}
        initialRightId={diffModalState.rightId}
      />

      {/* Version Details Modal */}
      <Modal
        open={Boolean(inspectVersion)}
        onClose={() => setInspectVersionId(null)}
        title={inspectVersion ? `${inspectVersion.targetRole} — ${inspectVersion.companyName}` : ''}
        description={
          inspectVersion
            ? `Snapshot ${inspectVersion.versionId} · Created ${formatDateTime(inspectVersion.createdAt)}`
            : undefined
        }
        maxWidthClass="max-w-2xl"
        footer={
          inspectVersion ? (
            <>
              <Button variant="secondary" onClick={() => setInspectVersionId(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const target = inspectVersion;
                  setInspectVersionId(null);
                  onOpenVersion(target);
                }}
              >
                Open Exact Snapshot in Studio
              </Button>
            </>
          ) : null
        }
      >
        {inspectVersion && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                <p className="text-[11px] text-[#71717A]">Match Score</p>
                <p className="text-lg font-mono font-semibold tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                  {inspectVersion.matchScore}%
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                <p className="text-[11px] text-[#71717A]">Verification</p>
                <p className="text-lg font-mono font-semibold tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                  {inspectVersion.verificationScore}%
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                <p className="text-[11px] text-[#71717A]">Claims Audited</p>
                <p className="text-lg font-mono font-semibold tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                  {inspectVersion.auditReport.summary.total_claims}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
                <p className="text-[11px] text-[#71717A]">Unsupported</p>
                <p className="text-lg font-mono font-semibold tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                  {inspectVersion.auditReport.summary.unsupported_count}
                </p>
              </div>
            </div>

            {/* Application Tracking & Notes */}
            <div className="p-3.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Application Tracking
                </h3>
                <select
                  aria-label="Modal application status"
                  value={inspectVersion.applicationStatus ?? 'draft'}
                  onChange={(e) =>
                    handleStatusChange(inspectVersion, e.target.value as ApplicationStatus)
                  }
                  className={`h-7 px-2.5 rounded-md border text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900/15 ${
                    STATUS_SELECT_STYLES[inspectVersion.applicationStatus ?? 'draft']
                  }`}
                >
                  {APPLICATION_STATUSES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <Textarea
                label="Application Notes"
                rows={3}
                placeholder="Track recruiter name, submission date, interview rounds, or follow-up reminders..."
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#71717A]">
                  Tracking metadata updates independently without altering the immutable resume snapshot.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveNotes}
                  disabled={notesDraft.trim() === (inspectVersion.applicationNotes ?? '').trim()}
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  Save Notes
                </Button>
              </div>
            </div>

            {inspectVersion.jobDescription.focusDirective && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Focus Directive
                </h3>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] bg-[#FAFAFA] dark:bg-[#18181B] p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
                  {inspectVersion.jobDescription.focusDirective}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                Cited Source Fact IDs ({inspectVersion.sourceFactIds.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {inspectVersion.sourceFactIds.map((id) => (
                  <FactIdBadge key={id} id={id} />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                Job Description Snapshot
              </h3>
              <pre className="text-xs whitespace-pre-wrap font-sans text-[#52525B] dark:text-[#A1A1AA] bg-[#FAFAFA] dark:bg-[#18181B] p-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] max-h-48 overflow-y-auto">
                {inspectVersion.jobDescription.rawText}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteVersion(deleteTarget.versionId);
            onNotify(`Deleted version "${deleteTarget.targetRole}"`, { tone: 'neutral' });
          }
        }}
        title="Delete saved version?"
        description={`This permanently deletes "${deleteTarget?.targetRole ?? ''}" (${deleteTarget?.companyName ?? ''}) from local Version History. Export a JSON backup first if you want to keep a copy.`}
        confirmLabel="Delete Version"
        destructive
      />

      {/* Reset Local Storage Confirmation */}
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          onResetAllData();
          onNotify('Local application data reset', { tone: 'neutral' });
        }}
        title="Reset all local Gen1Resume data?"
        description="This clears your Master Profile, all saved Version History snapshots, and settings from browser storage. Consider exporting a JSON backup first."
        confirmLabel="Reset All Data"
        destructive
      />
    </div>
  );
};
