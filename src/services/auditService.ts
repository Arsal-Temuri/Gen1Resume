import type { AuditHistoryEntry, AuditReport } from '../types/audit';
import type { CareerFact, MasterProfile } from '../types/profile';
import type { GeneratedResume } from '../types/resume';
import { buildApprovedProfilePayload } from '../utils/factIds';
import { extractAllAuditableClaims } from '../utils/resumeFormatter';
import { computeAuditSummary, validateAndReconcileAudit } from '../utils/validators';
import { runPass2IndependentAudit } from './geminiService';

/**
 * Runs Pass 2 (Independent Factual Auditor) as a standalone request and applies
 * application-side invariant validation.
 */
export async function runIndependentResumeAudit(
  resume: GeneratedResume,
  profile: MasterProfile,
  previousReport?: AuditReport | null,
  signal?: AbortSignal
): Promise<AuditReport> {
  const approvedProfile = buildApprovedProfilePayload(profile);
  const claims = extractAllAuditableClaims(resume);

  const pass2Response = await runPass2IndependentAudit(
    {
      claims,
      approvedProfile,
      resumeContext: {
        experience: resume.experience,
        projects: resume.projects,
        education: resume.education,
        skills: resume.skills,
      },
    },
    signal
  );

  return validateAndReconcileAudit(resume, pass2Response, profile.facts, previousReport);
}

/**
 * Invalidates a single claim's audit status after manual editing,
 * preserving its prior audit result in `previous_history`.
 */
export function invalidateClaimAudit(
  auditReport: AuditReport,
  bulletId: string,
  previousClaimText: string,
  sourceFactIds: string[]
): AuditReport {
  const existing = auditReport.resultsByBulletId[bulletId];
  const history: AuditHistoryEntry[] = existing?.previous_history ? [...existing.previous_history] : [];

  if (existing && existing.status !== 'NEEDS_REVIEW') {
    history.unshift({
      status: existing.status,
      auditor_note: existing.auditor_note,
      audited_at: existing.audited_at,
      claim_text: previousClaimText,
    });
  }

  const nextResults = {
    ...auditReport.resultsByBulletId,
    [bulletId]: {
      bullet_id: bulletId,
      status: 'NEEDS_REVIEW' as const,
      source_fact_ids: sourceFactIds,
      auditor_note: 'Manually edited since last verification. Re-run the factual auditor to verify this claim.',
      user_override: false,
      audited_at: new Date().toISOString(),
      previous_history: history.slice(0, 5),
    },
  };

  return {
    ...auditReport,
    resultsByBulletId: nextResults,
    summary: computeAuditSummary(nextResults),
  };
}

/**
 * Removes an audit entry when a bullet is deleted from the active resume.
 */
export function removeClaimAudit(auditReport: AuditReport, bulletId: string): AuditReport {
  const nextResults = { ...auditReport.resultsByBulletId };
  delete nextResults[bulletId];
  return {
    ...auditReport,
    resultsByBulletId: nextResults,
    summary: computeAuditSummary(nextResults),
  };
}

/**
 * Toggles an explicit personal-use override on an UNSUPPORTED claim.
 * The claim remains visibly marked as UNSUPPORTED + User Override and is NEVER converted to VERIFIED.
 */
export function toggleUserOverrideOnClaim(
  auditReport: AuditReport,
  bulletId: string,
  override: boolean
): AuditReport {
  const existing = auditReport.resultsByBulletId[bulletId];
  if (!existing || existing.status !== 'UNSUPPORTED') {
    return auditReport;
  }

  const nextResults = {
    ...auditReport.resultsByBulletId,
    [bulletId]: {
      ...existing,
      user_override: override,
    },
  };

  return {
    ...auditReport,
    resultsByBulletId: nextResults,
    summary: computeAuditSummary(nextResults),
  };
}

/**
 * Re-validates a claim reverted directly to its exact original approved source fact wording.
 * Re-running Pass 2 is still supported, and while reverted to verbatim approved evidence,
 * marks it NEEDS_REVIEW or keeps strict audit flow intact.
 */
export function getOriginalEvidenceText(
  sourceFactIds: string[],
  factsMap: Record<string, CareerFact>
): string {
  return sourceFactIds
    .map((id) => factsMap[id]?.content)
    .filter((content): content is string => Boolean(content))
    .join(' ');
}
