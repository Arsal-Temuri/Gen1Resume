import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDown,
  FileText,
  History,
  Loader2,
  Redo2,
  Save,
  ShieldCheck,
  Undo2,
  X,
} from 'lucide-react';
import type { ProfileStats } from '../hooks/useMasterProfile';
import type { AuditReport, ExportSafetyCheckResult } from '../types/audit';
import type { UserEditRecord, VersionSnapshot } from '../types/history';
import type { CareerFact, MasterProfile } from '../types/profile';
import type {
  GeneratedResume,
  JobDescription,
  MatchScoreResult,
  ResumeSectionType,
} from '../types/resume';
import { SAMPLE_JOB_DESCRIPTION } from '../data/sampleProfile';
import {
  invalidateClaimAudit,
  removeClaimAudit,
  runIndependentResumeAudit,
  toggleUserOverrideOnClaim,
} from '../services/auditService';
import {
  copyResumeAsPlainText,
  exportResumeAsPdf,
  exportResumeAsWord,
} from '../services/exportService';
import {
  runTwoPassTailoringPipeline,
  TAILORING_STAGES,
  type TailoringProgressEvent,
} from '../services/tailoringService';
import { measureOnePageResumeFit } from '../utils/pdfResumeGenerator';
import {
  createUndoHistory,
  pushHistorySnapshot,
  redoHistoryStep,
  undoHistoryStep,
  type UndoHistoryState,
} from '../utils/undoHistory';
import { evaluateExportSafety } from '../utils/validators';
import { AuditResumeView } from '../components/resume/AuditResumeView';
import { CleanAtsPreview } from '../components/resume/CleanAtsPreview';
import {
  ExportSafetyModal,
  type ExportActionType,
} from '../components/tailoring/ExportSafetyModal';
import { ScoreCard } from '../components/tailoring/ScoreCard';
import {
  Button,
  Card,
  EmptyState,
  Input,
  SegmentedControl,
  Textarea,
} from '../components/shared/ui';

export interface ActiveWorkspaceState {
  jobDescription: JobDescription;
  resume: GeneratedResume | null;
  auditReport: AuditReport | null;
  matchScoreResult: MatchScoreResult | null;
  sourceFactIds: string[];
  factsSnapshot: Record<string, CareerFact> | null;
  loadedVersionId: string | null;
  userEdits: UserEditRecord[];
  hasUnsavedEdits: boolean;
}

interface StudioUndoSnapshot {
  resume: GeneratedResume;
  auditReport: AuditReport | null;
  userEdits: UserEditRecord[];
  hasUnsavedEdits: boolean;
}

function swapItems<T>(arr: T[], idxA: number, idxB: number): T[] {
  if (idxA < 0 || idxB < 0 || idxA >= arr.length || idxB >= arr.length) return arr;
  const copy = [...arr];
  const tmp = copy[idxA];
  copy[idxA] = copy[idxB];
  copy[idxB] = tmp;
  return copy;
}

export const TailoringStudio: React.FC<{
  profile: MasterProfile | null;
  profileStats: ProfileStats;
  workspace: ActiveWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ActiveWorkspaceState>>;
  onSaveVersion: (params: {
    jobDescription: JobDescription;
    resume: GeneratedResume;
    sourceFactIds: string[];
    auditReport: AuditReport;
    matchScoreResult: MatchScoreResult;
    profileFacts: Record<string, CareerFact>;
    userEdits: UserEditRecord[];
  }) => VersionSnapshot;
  onGoToProfile: () => void;
  onNotify: (
    title: string,
    opts?: { description?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }
  ) => void;
}> = ({
  profile,
  profileStats,
  workspace,
  onWorkspaceChange,
  onSaveVersion,
  onGoToProfile,
  onNotify,
}) => {
  const [rightMode, setRightMode] = useState<'audit' | 'preview'>('audit');
  const [mobilePane, setMobilePane] = useState<'input' | 'resume'>('input');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReauditing, setIsReauditing] = useState(false);
  const [progress, setProgress] = useState<TailoringProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Export safety modal state
  const [pendingExportAction, setPendingExportAction] = useState<ExportActionType | null>(null);
  const [pendingSafetyResult, setPendingSafetyResult] = useState<ExportSafetyCheckResult | null>(
    null
  );

  const abortRef = useRef<AbortController | null>(null);

  // Bounded Undo / Redo history for Audit Mode claim & layout mutations
  const [undoHistory, setUndoHistory] = useState<UndoHistoryState<StudioUndoSnapshot>>(() =>
    createUndoHistory<StudioUndoSnapshot>()
  );
  const undoHistoryRef = useRef(undoHistory);
  undoHistoryRef.current = undoHistory;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const prevLoadedVersionIdRef = useRef<string | null>(workspace.loadedVersionId);
  const justSavedVersionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspace.resume) {
      setUndoHistory(createUndoHistory<StudioUndoSnapshot>());
      prevLoadedVersionIdRef.current = workspace.loadedVersionId;
      return;
    }
    if (workspace.loadedVersionId !== prevLoadedVersionIdRef.current) {
      prevLoadedVersionIdRef.current = workspace.loadedVersionId;
      if (justSavedVersionIdRef.current === workspace.loadedVersionId) {
        justSavedVersionIdRef.current = null;
      } else {
        setUndoHistory(createUndoHistory<StudioUndoSnapshot>());
      }
    }
  }, [workspace.loadedVersionId, workspace.resume]);

  const captureUndoSnapshot = useCallback(() => {
    const current = workspaceRef.current;
    if (!current.resume) return;
    setUndoHistory((prev) =>
      pushHistorySnapshot(prev, {
        resume: current.resume!,
        auditReport: current.auditReport,
        userEdits: current.userEdits,
        hasUnsavedEdits: current.hasUnsavedEdits,
      })
    );
  }, []);

  const handleUndo = useCallback(() => {
    const current = workspaceRef.current;
    if (!current.resume) return;
    const { history, restored } = undoHistoryStep(undoHistoryRef.current, {
      resume: current.resume,
      auditReport: current.auditReport,
      userEdits: current.userEdits,
      hasUnsavedEdits: current.hasUnsavedEdits,
    });
    if (!restored) return;
    undoHistoryRef.current = history;
    setUndoHistory(history);
    onWorkspaceChange((ws) => ({
      ...ws,
      resume: restored.resume,
      auditReport: restored.auditReport,
      userEdits: restored.userEdits,
      hasUnsavedEdits: restored.hasUnsavedEdits,
    }));
  }, [onWorkspaceChange]);

  const handleRedo = useCallback(() => {
    const current = workspaceRef.current;
    if (!current.resume) return;
    const { history, restored } = redoHistoryStep(undoHistoryRef.current, {
      resume: current.resume,
      auditReport: current.auditReport,
      userEdits: current.userEdits,
      hasUnsavedEdits: current.hasUnsavedEdits,
    });
    if (!restored) return;
    undoHistoryRef.current = history;
    setUndoHistory(history);
    onWorkspaceChange((ws) => ({
      ...ws,
      resume: restored.resume,
      auditReport: restored.auditReport,
      userEdits: restored.userEdits,
      hasUnsavedEdits: restored.hasUnsavedEdits,
    }));
  }, [onWorkspaceChange]);

  useEffect(() => {
    if (!workspace.resume || rightMode !== 'audit') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspace.resume, rightMode, handleUndo, handleRedo]);

  // Use immutable snapshot facts when inspecting a reopened historical version,
  // otherwise use current Master Profile facts.
  const activeFactsLookup: Record<string, CareerFact> = useMemo(() => {
    if (workspace.loadedVersionId && workspace.factsSnapshot) {
      return workspace.factsSnapshot;
    }
    return profile?.facts ?? workspace.factsSnapshot ?? {};
  }, [workspace.loadedVersionId, workspace.factsSnapshot, profile]);

  const onePageFit = useMemo(
    () => (workspace.resume ? measureOnePageResumeFit(workspace.resume) : null),
    [workspace.resume]
  );

  const canTailor =
    Boolean(profile) &&
    profileStats.approvedFacts > 0 &&
    workspace.jobDescription.rawText.trim().length >= 30 &&
    !isGenerating &&
    !isReauditing;

  const updateJdField = <K extends keyof JobDescription>(field: K, value: JobDescription[K]) => {
    onWorkspaceChange((prev) => ({
      ...prev,
      jobDescription: {
        ...prev.jobDescription,
        [field]: value,
      },
    }));
  };

  const handleLoadSampleJd = () => {
    onWorkspaceChange((prev) => ({
      ...prev,
      jobDescription: { ...SAMPLE_JOB_DESCRIPTION },
    }));
    setError(null);
  };

  const handleCancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setProgress(null);
    onNotify('Tailoring cancelled', {
      description: 'Your job description and any previous resume were preserved.',
      tone: 'neutral',
    });
  };

  const handleTailorAndVerify = async () => {
    if (!profile || !canTailor) return;
    setError(null);
    setIsGenerating(true);
    setProgress(TAILORING_STAGES[0]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runTwoPassTailoringPipeline(
        profile,
        workspace.jobDescription,
        (event) => setProgress(event),
        controller.signal
      );

      const saved = onSaveVersion({
        jobDescription: workspace.jobDescription,
        resume: result.resume,
        sourceFactIds: result.sourceFactIds,
        auditReport: result.auditReport,
        matchScoreResult: result.matchScoreResult,
        profileFacts: profile.facts,
        userEdits: [],
      });

      onWorkspaceChange((prev) => ({
        ...prev,
        resume: result.resume,
        auditReport: result.auditReport,
        matchScoreResult: result.matchScoreResult,
        sourceFactIds: result.sourceFactIds,
        factsSnapshot: saved.profileSnapshot,
        loadedVersionId: saved.versionId,
        userEdits: [],
        hasUnsavedEdits: false,
      }));

      setUndoHistory(createUndoHistory<StudioUndoSnapshot>());
      setRightMode('audit');
      setMobilePane('resume');

      const unsupported = result.auditReport.summary.unsupported_count;
      onNotify(
        unsupported > 0
          ? `Tailored resume audited with ${unsupported} flagged claim(s)`
          : 'Tailored resume generated and verified',
        {
          description: `Profile Match: ${result.matchScoreResult.overallScore}% · Verification: ${result.auditReport.summary.verification_score}%`,
          tone: unsupported > 0 ? 'warning' : 'success',
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resume tailoring failed.';
      // Preserve previous generated resume and user JD inputs on failure
      setError(msg);
      if (msg !== 'Operation was cancelled.') {
        onNotify('Tailoring failed — previous resume preserved', {
          description: msg,
          tone: 'error',
        });
      }
    } finally {
      setIsGenerating(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const handleReaudit = async () => {
    if (!workspace.resume || isReauditing || isGenerating) return;

    // Build a MasterProfile-compatible wrapper using the active facts snapshot so historical snapshots audit faithfully
    const auditProfile: MasterProfile | null = profile
      ? {
          ...profile,
          facts: activeFactsLookup,
        }
      : null;

    if (!auditProfile) {
      onNotify('Master Profile required to re-run audit', { tone: 'error' });
      return;
    }

    setIsReauditing(true);
    setError(null);
    try {
      const nextAudit = await runIndependentResumeAudit(
        workspace.resume,
        auditProfile,
        workspace.auditReport
      );
      onWorkspaceChange((prev) => ({
        ...prev,
        auditReport: nextAudit,
        hasUnsavedEdits: true,
      }));
      onNotify('Independent Pass 2 audit completed', {
        description: `Verification score: ${nextAudit.summary.verification_score}% (${nextAudit.summary.verified_count} verified, ${nextAudit.summary.paraphrased_count} paraphrased, ${nextAudit.summary.unsupported_count} unsupported).`,
        tone: nextAudit.summary.unsupported_count > 0 ? 'warning' : 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Independent audit failed.';
      setError(msg);
      onNotify('Re-audit failed', { description: msg, tone: 'error' });
    } finally {
      setIsReauditing(false);
    }
  };

  const recordEdit = (
    prev: ActiveWorkspaceState,
    bulletId: string,
    action: UserEditRecord['action'],
    detail: string
  ): UserEditRecord[] => [
    ...prev.userEdits,
    {
      id: `ed_${Date.now().toString(36)}`,
      bullet_id: bulletId,
      action,
      timestamp: new Date().toISOString(),
      detail,
    },
  ];

  const mutateClaimText = (
    bulletId: string,
    nextText: string,
    action: 'edit' | 'revert'
  ) => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume || !prev.auditReport) return prev;
      let oldText = '';
      let sourceIds: string[] = [];

      const nextSummary = prev.resume.summary_statements.map((s) => {
        if (s.bullet_id !== bulletId) return s;
        oldText = s.text;
        sourceIds = s.source_fact_ids;
        return { ...s, text: nextText };
      });

      const nextExp = prev.resume.experience.map((exp) => ({
        ...exp,
        bullets: exp.bullets.map((b) => {
          if (b.bullet_id !== bulletId) return b;
          oldText = b.text;
          sourceIds = b.source_fact_ids;
          return { ...b, text: nextText };
        }),
      }));

      const nextPrj = prev.resume.projects.map((prj) => ({
        ...prj,
        bullets: prj.bullets.map((b) => {
          if (b.bullet_id !== bulletId) return b;
          oldText = b.text;
          sourceIds = b.source_fact_ids;
          return { ...b, text: nextText };
        }),
      }));

      const nextEdu = prev.resume.education.map((edu) => ({
        ...edu,
        highlights: edu.highlights.map((h) => {
          if (h.bullet_id !== bulletId) return h;
          oldText = h.text;
          sourceIds = h.source_fact_ids;
          return { ...h, text: nextText };
        }),
      }));

      const nextAudit = invalidateClaimAudit(prev.auditReport, bulletId, oldText, sourceIds);

      return {
        ...prev,
        resume: {
          ...prev.resume,
          summary_statements: nextSummary,
          experience: nextExp,
          projects: nextPrj,
          education: nextEdu,
        },
        auditReport: nextAudit,
        userEdits: recordEdit(
          prev,
          bulletId,
          action,
          action === 'revert' ? 'Reverted to original approved evidence' : 'Edited claim text'
        ),
        hasUnsavedEdits: true,
      };
    });

    onNotify(
      action === 'revert' ? 'Reverted to original wording' : 'Claim updated — re-audit required',
      {
        description: 'Run "Re-Run Independent Audit" to verify this change before exporting.',
        tone: 'neutral',
      }
    );
  };

  const handleRemoveClaim = (bulletId: string) => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume || !prev.auditReport) return prev;
      const nextResume: GeneratedResume = {
        ...prev.resume,
        summary_statements: prev.resume.summary_statements.filter((s) => s.bullet_id !== bulletId),
        experience: prev.resume.experience.map((e) => ({
          ...e,
          bullets: e.bullets.filter((b) => b.bullet_id !== bulletId),
        })),
        projects: prev.resume.projects.map((p) => ({
          ...p,
          bullets: p.bullets.filter((b) => b.bullet_id !== bulletId),
        })),
        education: prev.resume.education.map((e) => ({
          ...e,
          highlights: e.highlights.filter((h) => h.bullet_id !== bulletId),
        })),
      };
      return {
        ...prev,
        resume: nextResume,
        auditReport: removeClaimAudit(prev.auditReport, bulletId),
        userEdits: recordEdit(prev, bulletId, 'remove', 'Removed bullet from resume'),
        hasUnsavedEdits: true,
      };
    });
    onNotify(`Removed claim ${bulletId}`, { tone: 'neutral' });
  };

  const handleToggleOverride = (bulletId: string, override: boolean) => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.auditReport) return prev;
      return {
        ...prev,
        auditReport: toggleUserOverrideOnClaim(prev.auditReport, bulletId, override),
        userEdits: recordEdit(
          prev,
          bulletId,
          'override',
          override ? 'Enabled personal-use override (not AI-verified)' : 'Removed personal-use override'
        ),
        hasUnsavedEdits: true,
      };
    });
  };

  const handleToggleSection = (sectionId: ResumeSectionType) => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      return {
        ...prev,
        resume: {
          ...prev.resume,
          sectionOrder: prev.resume.sectionOrder.map((s) =>
            s.id === sectionId ? { ...s, enabled: !s.enabled } : s
          ),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleMoveSection = (sectionId: ResumeSectionType, direction: 'up' | 'down') => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      const idx = prev.resume.sectionOrder.findIndex((s) => s.id === sectionId);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      return {
        ...prev,
        resume: {
          ...prev.resume,
          sectionOrder: swapItems(prev.resume.sectionOrder, idx, target),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleMoveExperience = (idx: number, direction: 'up' | 'down') => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      return {
        ...prev,
        resume: {
          ...prev.resume,
          experience: swapItems(prev.resume.experience, idx, target),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleMoveProject = (idx: number, direction: 'up' | 'down') => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      return {
        ...prev,
        resume: {
          ...prev.resume,
          projects: swapItems(prev.resume.projects, idx, target),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleMoveBullet = (
    section: 'experience' | 'projects',
    entryId: string,
    bulletIdx: number,
    direction: 'up' | 'down'
  ) => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      const target = direction === 'up' ? bulletIdx - 1 : bulletIdx + 1;
      if (section === 'experience') {
        return {
          ...prev,
          resume: {
            ...prev.resume,
            experience: prev.resume.experience.map((e) =>
              e.entry_id === entryId ? { ...e, bullets: swapItems(e.bullets, bulletIdx, target) } : e
            ),
          },
          hasUnsavedEdits: true,
        };
      }
      return {
        ...prev,
        resume: {
          ...prev.resume,
          projects: prev.resume.projects.map((p) =>
            p.entry_id === entryId ? { ...p, bullets: swapItems(p.bullets, bulletIdx, target) } : p
          ),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleMoveSkillGroup = (idx: number, direction: 'up' | 'down') => {
    captureUndoSnapshot();
    onWorkspaceChange((prev) => {
      if (!prev.resume) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      return {
        ...prev,
        resume: {
          ...prev.resume,
          skills: swapItems(prev.resume.skills, idx, target),
        },
        hasUnsavedEdits: true,
      };
    });
  };

  const handleSaveEditedSnapshot = () => {
    if (!workspace.resume || !workspace.auditReport || !workspace.matchScoreResult) return;
    const saved = onSaveVersion({
      jobDescription: workspace.jobDescription,
      resume: workspace.resume,
      sourceFactIds: workspace.sourceFactIds,
      auditReport: workspace.auditReport,
      matchScoreResult: workspace.matchScoreResult,
      profileFacts: activeFactsLookup,
      userEdits: workspace.userEdits,
    });
    justSavedVersionIdRef.current = saved.versionId;
    onWorkspaceChange((prev) => ({
      ...prev,
      loadedVersionId: saved.versionId,
      hasUnsavedEdits: false,
    }));
    onNotify('Saved new immutable snapshot to Version History', {
      description: `Version ${saved.versionId} preserved without mutating earlier records.`,
      tone: 'success',
    });
  };

  const executeExport = async (action: ExportActionType) => {
    if (!workspace.resume) return;
    try {
      if (action === 'pdf') {
        const result = exportResumeAsPdf(workspace.resume);
        onNotify(
          result.truncatedToFit
            ? '1-page PDF downloaded (auto-fitted)'
            : '1-page PDF downloaded',
          {
            description: result.truncatedToFit
              ? `Saved ${result.filename} · Content was condensed to stay strictly on 1 page.`
              : `Saved ${result.filename} (1 page, ATS-ready selectable text).`,
            tone: result.truncatedToFit ? 'warning' : 'success',
          }
        );
      } else if (action === 'word') {
        const filename = await exportResumeAsWord(workspace.resume);
        onNotify('Word document exported', {
          description: `Downloaded ${filename} (ATS-safe OpenXML .docx)`,
          tone: 'success',
        });
      } else if (action === 'plaintext') {
        await copyResumeAsPlainText(workspace.resume);
        onNotify('Resume copied successfully.', { tone: 'success' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      onNotify('Export failed', { description: msg, tone: 'error' });
    }
  };

  const requestExport = (action: ExportActionType) => {
    if (!workspace.resume) return;
    const safety = evaluateExportSafety(
      workspace.resume,
      workspace.auditReport,
      activeFactsLookup
    );

    // If completely verified with no paraphrased or override warnings, export immediately
    if (safety.allowed && !safety.hasParaphrased && !safety.hasUserOverrides) {
      void executeExport(action);
      return;
    }

    // Otherwise display the Export Safety Check dialog (blocking or awareness confirmation)
    setPendingExportAction(action);
    setPendingSafetyResult(safety);
  };

  return (
    <div className="space-y-5">
      {/* Studio Header & Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E4E4E7] dark:border-[#27272A] no-print">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
            Tailoring Studio
          </h1>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
            Two-pass grounded resume generation with independent claim-level factual verification.
          </p>
        </div>

        {/* Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {workspace.resume && workspace.hasUnsavedEdits && (
            <Button size="sm" variant="secondary" onClick={handleSaveEditedSnapshot}>
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              Save Snapshot
            </Button>
          )}
          <Button
            size="sm"
            variant={workspace.resume ? 'primary' : 'secondary'}
            disabled={!workspace.resume || isGenerating || isReauditing}
            onClick={() => requestExport('pdf')}
            title="Download a clean 1-page ATS-friendly PDF with selectable text"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            Download as PDF
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!workspace.resume || isGenerating || isReauditing}
            onClick={() => requestExport('word')}
            title="Download a clean ATS-safe Microsoft Word (.docx) document"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export Word (.docx)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!workspace.resume || isGenerating || isReauditing}
            onClick={() => requestExport('plaintext')}
          >
            <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />
            Copy Plain Text
          </Button>
        </div>
      </div>

      {/* Mobile Panel Switcher */}
      <div className="lg:hidden no-print">
        <SegmentedControl<'input' | 'resume'>
          ariaLabel="Switch studio pane"
          value={mobilePane}
          onChange={setMobilePane}
          className="w-full grid grid-cols-2"
          options={[
            { value: 'input', label: 'Job & Gap Analysis' },
            { value: 'resume', label: 'Resume & Auditor' },
          ]}
        />
      </div>

      {/* Split-Pane Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        {/* LEFT PANEL: Job Description Input + Gap Analysis */}
        <div
          className={`lg:col-span-5 space-y-5 ${mobilePane === 'input' ? 'block' : 'hidden lg:block'}`}
        >
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Target Opportunity
                </h2>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  Using <span className="font-mono tabular-nums font-medium">{profileStats.approvedFacts}</span>{' '}
                  approved facts as ground truth.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleLoadSampleJd} disabled={isGenerating}>
                Load Sample JD
              </Button>
            </div>

            {(!profile || profileStats.approvedFacts === 0) && (
              <div className="p-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] dark:bg-amber-950/50 dark:border-amber-800/70 text-xs text-[#D97706] dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  {!profile
                    ? 'Create a Master Profile and approve facts to enable tailoring.'
                    : 'Approve at least one Master Profile fact before tailoring.'}
                </span>
                <Button size="sm" variant="secondary" onClick={onGoToProfile}>
                  Open Vault
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Target Job Title"
                placeholder="e.g. Backend Software Engineer"
                value={workspace.jobDescription.targetRole}
                onChange={(e) => updateJdField('targetRole', e.target.value)}
                disabled={isGenerating}
              />
              <Input
                label="Company Name"
                placeholder="e.g. Acme Cloud"
                value={workspace.jobDescription.companyName}
                onChange={(e) => updateJdField('companyName', e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <Textarea
              label="Job Description"
              placeholder="Paste the full job description including required qualifications, preferred skills, and responsibilities..."
              rows={9}
              value={workspace.jobDescription.rawText}
              onChange={(e) => {
                updateJdField('rawText', e.target.value);
                if (error) setError(null);
              }}
              disabled={isGenerating}
              helperText={`${workspace.jobDescription.rawText.trim().length.toLocaleString()} characters (minimum 30)`}
            />

            <Textarea
              label="Focus Directive (Optional)"
              placeholder="e.g. Emphasize my Python backend experience, API development, and NLP project. Prioritize relevant technical achievements."
              rows={3}
              value={workspace.jobDescription.focusDirective}
              onChange={(e) => updateJdField('focusDirective', e.target.value)}
              disabled={isGenerating}
            />

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="primary"
                onClick={handleTailorAndVerify}
                disabled={!canTailor}
                className="flex-1 sm:flex-initial"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isGenerating ? 'Running Two-Pass Pipeline...' : 'Tailor & Verify Resume'}</span>
              </Button>
              {isGenerating && (
                <Button variant="secondary" onClick={handleCancelGeneration}>
                  <X className="w-4 h-4" aria-hidden="true" />
                  Cancel
                </Button>
              )}
            </div>

            {/* Staged Loading Experience */}
            {isGenerating && progress && (
              <div
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                  <span>{progress.label}</span>
                </div>
                <ol className="space-y-1.5">
                  {TAILORING_STAGES.map((st) => {
                    const done = st.stage < progress.stage;
                    const active = st.stage === progress.stage;
                    return (
                      <li
                        key={st.stage}
                        className={`flex items-center gap-2 text-xs ${
                          done
                            ? 'text-[#059669] dark:text-emerald-400'
                            : active
                              ? 'text-[#09090B] dark:text-[#FAFAFA] font-medium'
                              : 'text-[#71717A] dark:text-zinc-500'
                        }`}
                      >
                        <span className="font-mono text-[11px] w-4">
                          {done ? '✓' : active ? '→' : `${st.stage}.`}
                        </span>
                        <span>{st.label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#DC2626] dark:bg-red-950/60 dark:border-red-800/70 dark:text-red-400"
              >
                {error}
              </div>
            )}
          </Card>

          {/* Deterministic Match Score & Gap Analysis */}
          {workspace.matchScoreResult && (
            <ScoreCard matchScoreResult={workspace.matchScoreResult} />
          )}
        </div>

        {/* RIGHT PANEL: Resume Preview & Fact Auditor */}
        <div
          className={`lg:col-span-7 space-y-4 ${mobilePane === 'resume' ? 'block' : 'hidden lg:block'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl<'audit' | 'preview'>
                ariaLabel="Resume view mode"
                value={rightMode}
                onChange={setRightMode}
                options={[
                  { value: 'audit', label: 'Audit Mode' },
                  { value: 'preview', label: 'Clean ATS Preview' },
                ]}
              />
              {workspace.resume && rightMode === 'audit' && (
                <div
                  className="inline-flex items-center gap-1 pl-1"
                  role="group"
                  aria-label="Edit history controls"
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUndo}
                    disabled={undoHistory.past.length === 0 || isGenerating || isReauditing}
                    aria-label="Undo last edit"
                    title="Undo last edit (Ctrl/Cmd+Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Undo</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRedo}
                    disabled={undoHistory.future.length === 0 || isGenerating || isReauditing}
                    aria-label="Redo edit"
                    title="Redo edit (Ctrl/Cmd+Shift+Z)"
                  >
                    <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Redo</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onePageFit && (
                <span
                  title={`PDF layout preset: ${onePageFit.presetName} (${onePageFit.bodyFontSizePt}pt body text)`}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    onePageFit.status === 'optimal'
                      ? 'text-[#059669] dark:text-emerald-400'
                      : onePageFit.status === 'tight'
                        ? 'text-[#D97706] dark:text-amber-400'
                        : 'text-[#DC2626] dark:text-red-400'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      onePageFit.status === 'optimal'
                        ? 'bg-[#059669] dark:bg-emerald-400'
                        : onePageFit.status === 'tight'
                          ? 'bg-[#D97706] dark:bg-amber-400'
                          : 'bg-[#DC2626] dark:bg-red-400'
                    }`}
                  />
                  {onePageFit.status === 'overflow' ? (
                    <span>1-Page Overflow · Trim bullets for full fit</span>
                  ) : onePageFit.status === 'tight' ? (
                    <span className="tabular-nums">
                      1-Page Fit · Compact ({onePageFit.bodyFontSizePt}pt)
                    </span>
                  ) : (
                    <span className="tabular-nums">
                      1-Page Fit · {onePageFit.pageFillPercent}% full
                    </span>
                  )}
                </span>
              )}

              {workspace.loadedVersionId && (
                <div className="inline-flex items-center gap-1.5 text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  <History className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Snapshot</span>
                  <span className="font-mono">{workspace.loadedVersionId}</span>
                  {workspace.hasUnsavedEdits && (
                    <span className="text-[#D97706] dark:text-amber-400">· Unsaved edits</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!workspace.resume ? (
            <EmptyState
              icon={<ShieldCheck className="w-7 h-7" />}
              title="No tailored resume in workspace yet"
              description="Enter a target job description on the left and click 'Tailor & Verify Resume'. Pass 1 builds a grounded draft strictly from your approved facts, and Pass 2 independently audits every claim."
              action={
                !profile || profileStats.approvedFacts === 0 ? (
                  <Button variant="primary" onClick={onGoToProfile}>
                    Go to Master Profile Vault
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleLoadSampleJd}>
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    Load Sample Job Description
                  </Button>
                )
              }
            />
          ) : rightMode === 'audit' ? (
            <AuditResumeView
              resume={workspace.resume}
              auditReport={workspace.auditReport}
              factsLookup={activeFactsLookup}
              isReauditing={isReauditing}
              onReaudit={handleReaudit}
              onEditClaim={(bulletId, nextText) => mutateClaimText(bulletId, nextText, 'edit')}
              onRevertClaim={(bulletId, origText) => mutateClaimText(bulletId, origText, 'revert')}
              onRemoveClaim={handleRemoveClaim}
              onToggleOverride={handleToggleOverride}
              onToggleSection={handleToggleSection}
              onMoveSection={handleMoveSection}
              onMoveExperience={handleMoveExperience}
              onMoveProject={handleMoveProject}
              onMoveBullet={handleMoveBullet}
              onMoveSkillGroup={handleMoveSkillGroup}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                  Clean ATS preview — audit badges and fact IDs stripped.
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums">
                    {workspace.auditReport?.summary.verification_score ?? 0}% verified
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isGenerating || isReauditing}
                    onClick={() => requestExport('pdf')}
                  >
                    <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                    Download as PDF
                  </Button>
                </div>
              </div>
              <CleanAtsPreview resume={workspace.resume} />
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Print-Only Container: guarantees Export PDF prints ONLY the clean ATS resume */}
      {workspace.resume && (
        <div className="hidden print-only-root" aria-hidden="true">
          <CleanAtsPreview resume={workspace.resume} isPrintClone />
        </div>
      )}

      {/* Pre-Export Safety Check Modal */}
      <ExportSafetyModal
        open={Boolean(pendingExportAction)}
        action={pendingExportAction}
        safety={pendingSafetyResult}
        onClose={() => {
          setPendingExportAction(null);
          setPendingSafetyResult(null);
        }}
        onConfirmProceed={() => {
          const action = pendingExportAction;
          setPendingExportAction(null);
          setPendingSafetyResult(null);
          if (action) void executeExport(action);
        }}
        onReaudit={handleReaudit}
      />
    </div>
  );
};
