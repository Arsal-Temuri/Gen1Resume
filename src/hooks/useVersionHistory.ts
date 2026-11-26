import { useCallback, useMemo, useState } from 'react';
import type { AuditReport } from '../types/audit';
import type { ApplicationStatus, UserEditRecord, VersionSnapshot } from '../types/history';
import type { CareerFact } from '../types/profile';
import type { GeneratedResume, JobDescription, MatchScoreResult } from '../types/resume';
import { loadStoredVersions, saveStoredVersions } from '../services/storageService';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function computeAuditStatus(auditReport: AuditReport): VersionSnapshot['auditStatus'] {
  if (auditReport.summary.unsupported_count > 0 || auditReport.summary.needs_review_count > 0) {
    return 'NEEDS_ATTENTION';
  }
  if (auditReport.summary.paraphrased_count > 0) {
    return 'HAS_PARAPHRASED';
  }
  return 'CLEAN';
}

export function useVersionHistory() {
  const initialLoad = useMemo(() => loadStoredVersions(), []);
  const [versions, setVersions] = useState<VersionSnapshot[]>(initialLoad.data);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initialLoad.corrupted ? initialLoad.warning ?? 'Some Version History data could not be loaded.' : null
  );

  const commitVersions = useCallback((next: VersionSnapshot[]) => {
    setVersions(next);
    saveStoredVersions(next);
  }, []);

  const saveNewVersion = useCallback(
    (params: {
      jobDescription: JobDescription;
      resume: GeneratedResume;
      sourceFactIds: string[];
      auditReport: AuditReport;
      matchScoreResult: MatchScoreResult;
      profileFacts: Record<string, CareerFact>;
      userEdits?: UserEditRecord[];
    }): VersionSnapshot => {
      const now = new Date().toISOString();
      const snapshot: VersionSnapshot = {
        versionId: `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        targetRole: params.jobDescription.targetRole.trim() || params.resume.generation_metadata.target_role || 'Untitled Role',
        companyName: params.jobDescription.companyName.trim() || params.resume.generation_metadata.company_name || 'Unspecified Company',
        jobDescription: deepClone(params.jobDescription),
        createdAt: now,
        updatedAt: now,
        matchScore: params.matchScoreResult.overallScore,
        verificationScore: params.auditReport.summary.verification_score,
        resume: deepClone(params.resume),
        sourceFactIds: [...params.sourceFactIds],
        auditReport: deepClone(params.auditReport),
        matchScoreResult: deepClone(params.matchScoreResult),
        profileSnapshot: deepClone(params.profileFacts),
        userEdits: deepClone(params.userEdits ?? []),
        auditStatus: computeAuditStatus(params.auditReport),
        applicationStatus: 'draft',
        applicationNotes: '',
        statusUpdatedAt: now,
      };

      setVersions((prev) => {
        const next = [snapshot, ...prev];
        saveStoredVersions(next);
        return next;
      });
      return snapshot;
    },
    []
  );

  const duplicateVersion = useCallback((versionId: string): VersionSnapshot | null => {
    let created: VersionSnapshot | null = null;
    setVersions((prev) => {
      const source = prev.find((v) => v.versionId === versionId);
      if (!source) return prev;
      const now = new Date().toISOString();
      const copy: VersionSnapshot = {
        ...deepClone(source),
        versionId: `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        targetRole: `${source.targetRole} (Copy)`,
        createdAt: now,
        updatedAt: now,
        applicationStatus: 'draft',
        applicationNotes: '',
        statusUpdatedAt: now,
      };
      created = copy;
      const next = [copy, ...prev];
      saveStoredVersions(next);
      return next;
    });
    return created;
  }, []);

  const updateVersionTracking = useCallback(
    (
      versionId: string,
      patch: {
        applicationStatus?: ApplicationStatus;
        applicationNotes?: string;
      }
    ) => {
      setVersions((prev) => {
        const now = new Date().toISOString();
        const next = prev.map((v) =>
          v.versionId === versionId
            ? {
                ...v,
                applicationStatus:
                  patch.applicationStatus !== undefined
                    ? patch.applicationStatus
                    : (v.applicationStatus ?? 'draft'),
                applicationNotes:
                  patch.applicationNotes !== undefined
                    ? patch.applicationNotes
                    : (v.applicationNotes ?? ''),
                statusUpdatedAt: now,
              }
            : v
        );
        saveStoredVersions(next);
        return next;
      });
    },
    []
  );

  const deleteVersion = useCallback((versionId: string) => {
    setVersions((prev) => {
      const next = prev.filter((v) => v.versionId !== versionId);
      saveStoredVersions(next);
      return next;
    });
  }, []);

  const averageVerificationScore = useMemo(() => {
    if (versions.length === 0) return null;
    const sum = versions.reduce((acc, v) => acc + v.verificationScore, 0);
    return Math.round(sum / versions.length);
  }, [versions]);

  const latestActivityDate = useMemo(() => {
    if (versions.length === 0) return null;
    return versions[0].createdAt;
  }, [versions]);

  return {
    versions,
    storageWarning,
    clearStorageWarning: () => setStorageWarning(null),
    commitVersions,
    saveNewVersion,
    duplicateVersion,
    updateVersionTracking,
    deleteVersion,
    averageVerificationScore,
    latestActivityDate,
  };
}
