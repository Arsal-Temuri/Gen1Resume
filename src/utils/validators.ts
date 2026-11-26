import type {
  AuditReport,
  AuditResult,
  ExportSafetyCheckResult,
  OverallAuditSummary,
  VerificationStatus,
} from '../types/audit';
import type {
  ExtractedResumeData,
  Pass1TailorResponsePayload,
  Pass2AuditResponsePayload,
  RawRequirementItem,
} from '../types/gemini';
import type { ApplicationSettings, VersionSnapshot } from '../types/history';
import type { CareerFact, MasterProfile } from '../types/profile';
import type { GeneratedResume, RequirementCategory, RequirementImportance, RequirementMatchStatus } from '../types/resume';
import { normalizeCredentialCategory, normalizeSkillCategory } from './factIds';
import { extractAllAuditableClaims } from './resumeFormatter';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

const VALID_REQ_CATEGORIES: RequirementCategory[] = [
  'required_technical_skills',
  'relevant_responsibilities',
  'experience_alignment',
  'preferred_skills',
  'education_and_domain',
];

function normalizeReqCategory(raw: unknown, importance: RequirementImportance): RequirementCategory {
  const s = asString(raw).toLowerCase();
  if (VALID_REQ_CATEGORIES.includes(s as RequirementCategory)) {
    return s as RequirementCategory;
  }
  if (s.includes('prefer')) return 'preferred_skills';
  if (s.includes('edu') || s.includes('domain') || s.includes('degree')) return 'education_and_domain';
  if (s.includes('exp') || s.includes('year')) return 'experience_alignment';
  if (s.includes('resp') || s.includes('dut')) return 'relevant_responsibilities';
  return importance === 'preferred' ? 'preferred_skills' : 'required_technical_skills';
}

export function validateExtractedResumeData(raw: unknown): ExtractedResumeData {
  if (!isRecord(raw)) {
    throw new Error('AI extraction returned an unexpected format. Please try again.');
  }

  const rawHeader = isRecord(raw.header) ? raw.header : {};
  const rawEducation = Array.isArray(raw.education) ? raw.education : [];
  const rawExperience = Array.isArray(raw.experience) ? raw.experience : [];
  const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
  const rawSkills = Array.isArray(raw.skills) ? raw.skills : [];
  const rawCredentials = Array.isArray(raw.credentials) ? raw.credentials : [];

  const extracted: ExtractedResumeData = {
    header: {
      fullName: asString(rawHeader.fullName),
      professionalTitle: asString(rawHeader.professionalTitle),
      email: asString(rawHeader.email),
      phone: asString(rawHeader.phone),
      location: asString(rawHeader.location),
      linkedinUrl: asString(rawHeader.linkedinUrl),
      githubUrl: asString(rawHeader.githubUrl),
      portfolioUrl: asString(rawHeader.portfolioUrl),
    },
    education: rawEducation.filter(isRecord).map((e) => ({
      institution: asString(e.institution),
      degree: asString(e.degree),
      fieldOfStudy: asString(e.fieldOfStudy),
      startDate: asString(e.startDate),
      graduationDate: asString(e.graduationDate),
      gpa: asString(e.gpa),
      relevantCoursework: asStringArray(e.relevantCoursework),
      academicAchievements: asStringArray(e.academicAchievements),
    })),
    experience: rawExperience.filter(isRecord).map((e) => ({
      company: asString(e.company),
      jobTitle: asString(e.jobTitle),
      employmentType: asString(e.employmentType, 'Full-time'),
      location: asString(e.location),
      startDate: asString(e.startDate),
      endDate: asString(e.endDate),
      bullets: asStringArray(e.bullets),
    })),
    projects: rawProjects.filter(isRecord).map((p) => ({
      projectName: asString(p.projectName),
      description: asString(p.description),
      technologies: asStringArray(p.technologies),
      projectUrl: asString(p.projectUrl),
      bullets: asStringArray(p.bullets),
    })),
    skills: rawSkills
      .filter(isRecord)
      .map((s) => ({
        name: asString(s.name),
        category: normalizeSkillCategory(asString(s.category, 'Other Technical Skills')),
      }))
      .filter((s) => Boolean(s.name)),
    credentials: rawCredentials
      .filter(isRecord)
      .map((c) => ({
        category: normalizeCredentialCategory(asString(c.category, 'Certification')),
        title: asString(c.title),
        issuer: asString(c.issuer),
        date: asString(c.date),
        detail: asString(c.detail),
      }))
      .filter((c) => Boolean(c.title)),
  };

  const hasAnyContent =
    Boolean(extracted.header.fullName) ||
    extracted.education.length > 0 ||
    extracted.experience.length > 0 ||
    extracted.projects.length > 0 ||
    extracted.skills.length > 0 ||
    (extracted.credentials?.length ?? 0) > 0;

  if (!hasAnyContent) {
    throw new Error('No structured career information could be extracted from the supplied document.');
  }

  return extracted;
}

function parseRawRequirements(
  list: unknown,
  defaultStatus: RequirementMatchStatus
): RawRequirementItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .map((item) => {
      const importance: RequirementImportance =
        asString(item.importance).toLowerCase() === 'preferred' ? 'preferred' : 'required';
      return {
        name: asString(item.name),
        category: normalizeReqCategory(item.category, importance),
        importance,
        status: defaultStatus,
        supporting_fact_ids: asStringArray(item.supporting_fact_ids),
        rationale: asString(item.rationale),
      };
    })
    .filter((item) => Boolean(item.name));
}

export function validatePass1Response(raw: unknown): Pass1TailorResponsePayload {
  if (!isRecord(raw) || !isRecord(raw.resume)) {
    throw new Error('Resume generation returned a malformed response structure.');
  }

  const r = raw.resume;
  const reqAnalysis = isRecord(raw.requirements_analysis) ? raw.requirements_analysis : {};
  const meta = isRecord(raw.generation_metadata) ? raw.generation_metadata : {};

  // Ensure deterministic unique bullet IDs if the model accidentally collided any
  const usedBulletIds = new Set<string>();
  let fallbackCounter = 1;
  const ensureUniqueBulletId = (candidate: string, prefix: string): string => {
    const clean = candidate.trim();
    if (clean && !usedBulletIds.has(clean)) {
      usedBulletIds.add(clean);
      return clean;
    }
    let nextId = `${prefix}-${String(fallbackCounter).padStart(3, '0')}`;
    while (usedBulletIds.has(nextId)) {
      fallbackCounter += 1;
      nextId = `${prefix}-${String(fallbackCounter).padStart(3, '0')}`;
    }
    usedBulletIds.add(nextId);
    return nextId;
  };

  const summary_statements = Array.isArray(r.summary_statements)
    ? r.summary_statements
        .filter(isRecord)
        .map((s) => ({
          bullet_id: ensureUniqueBulletId(asString(s.bullet_id), 'SUM'),
          text: asString(s.text),
          source_fact_ids: asStringArray(s.source_fact_ids),
        }))
        .filter((s) => Boolean(s.text))
    : [];

  const skills = Array.isArray(r.skills)
    ? r.skills
        .filter(isRecord)
        .map((group) => ({
          category: asString(group.category, 'Technical Skills'),
          items: Array.isArray(group.items)
            ? group.items
                .filter(isRecord)
                .map((item) => ({
                  name: asString(item.name),
                  source_fact_id: asString(item.source_fact_id),
                }))
                .filter((item) => Boolean(item.name))
            : [],
        }))
        .filter((g) => g.items.length > 0)
    : [];

  const experience = Array.isArray(r.experience)
    ? r.experience.filter(isRecord).map((exp, idx) => ({
        entry_id: asString(exp.entry_id, `REXP-${idx + 1}`),
        source_parent_id: asString(exp.source_parent_id),
        source_fact_id: asString(exp.source_fact_id),
        company: asString(exp.company),
        job_title: asString(exp.job_title),
        employment_type: asString(exp.employment_type),
        location: asString(exp.location),
        start_date: asString(exp.start_date),
        end_date: asString(exp.end_date),
        bullets: Array.isArray(exp.bullets)
          ? exp.bullets
              .filter(isRecord)
              .map((b) => ({
                bullet_id: ensureUniqueBulletId(asString(b.bullet_id), 'BUL'),
                text: asString(b.text),
                source_fact_ids: asStringArray(b.source_fact_ids),
              }))
              .filter((b) => Boolean(b.text))
          : [],
      }))
    : [];

  const projects = Array.isArray(r.projects)
    ? r.projects.filter(isRecord).map((prj, idx) => ({
        entry_id: asString(prj.entry_id, `RPRJ-${idx + 1}`),
        source_parent_id: asString(prj.source_parent_id),
        source_fact_id: asString(prj.source_fact_id),
        project_name: asString(prj.project_name),
        technologies: asStringArray(prj.technologies),
        project_url: asString(prj.project_url),
        bullets: Array.isArray(prj.bullets)
          ? prj.bullets
              .filter(isRecord)
              .map((b) => ({
                bullet_id: ensureUniqueBulletId(asString(b.bullet_id), 'PBUL'),
                text: asString(b.text),
                source_fact_ids: asStringArray(b.source_fact_ids),
              }))
              .filter((b) => Boolean(b.text))
          : [],
      }))
    : [];

  const education = Array.isArray(r.education)
    ? r.education.filter(isRecord).map((edu, idx) => ({
        entry_id: asString(edu.entry_id, `REDU-${idx + 1}`),
        source_parent_id: asString(edu.source_parent_id),
        source_fact_id: asString(edu.source_fact_id),
        institution: asString(edu.institution),
        degree: asString(edu.degree),
        field_of_study: asString(edu.field_of_study),
        start_date: asString(edu.start_date),
        graduation_date: asString(edu.graduation_date),
        gpa: asString(edu.gpa),
        highlights: Array.isArray(edu.highlights)
          ? edu.highlights
              .filter(isRecord)
              .map((b) => ({
                bullet_id: ensureUniqueBulletId(asString(b.bullet_id), 'EBUL'),
                text: asString(b.text),
                source_fact_ids: asStringArray(b.source_fact_ids),
              }))
              .filter((b) => Boolean(b.text))
          : [],
      }))
    : [];

  const credentials = Array.isArray(r.credentials)
    ? r.credentials
        .filter(isRecord)
        .map((crd, idx) => ({
          item_id: asString(crd.item_id, `RCRD-${String(idx + 1).padStart(3, '0')}`),
          category: normalizeCredentialCategory(asString(crd.category, 'Certification')),
          title: asString(crd.title),
          issuer: asString(crd.issuer),
          date: asString(crd.date),
          detail: asString(crd.detail),
          source_fact_id: asString(crd.source_fact_id),
        }))
        .filter((crd) => Boolean(crd.title))
    : [];

  return {
    resume: {
      summary_statements,
      skills,
      experience,
      projects,
      education,
      credentials,
    },
    requirements_analysis: {
      matched: parseRawRequirements(reqAnalysis.matched, 'matched'),
      partially_matched: parseRawRequirements(reqAnalysis.partially_matched, 'partially_matched'),
      missing: parseRawRequirements(reqAnalysis.missing, 'missing'),
    },
    generation_metadata: {
      target_role: asString(meta.target_role),
      company_name: asString(meta.company_name),
      focus_directive: asString(meta.focus_directive),
    },
  };
}

export function validatePass2Response(raw: unknown): Pass2AuditResponsePayload {
  if (!isRecord(raw) || !Array.isArray(raw.audit_results)) {
    throw new Error('Independent factual audit returned an invalid response structure.');
  }

  const audit_results = raw.audit_results
    .filter(isRecord)
    .map((entry) => {
      const rawStatus = asString(entry.status).toUpperCase();
      const status: 'VERIFIED' | 'PARAPHRASED' | 'UNSUPPORTED' =
        rawStatus === 'VERIFIED'
          ? 'VERIFIED'
          : rawStatus === 'PARAPHRASED'
            ? 'PARAPHRASED'
            : 'UNSUPPORTED';

      return {
        bullet_id: asString(entry.bullet_id),
        status,
        source_fact_ids: asStringArray(entry.source_fact_ids),
        auditor_note: asString(entry.auditor_note, 'No auditor explanation provided.'),
      };
    })
    .filter((entry) => Boolean(entry.bullet_id));

  const verified_count = audit_results.filter((a) => a.status === 'VERIFIED').length;
  const paraphrased_count = audit_results.filter((a) => a.status === 'PARAPHRASED').length;
  const unsupported_count = audit_results.filter((a) => a.status === 'UNSUPPORTED').length;

  return {
    audit_results,
    overall_audit_summary: {
      total_claims: audit_results.length,
      verified_count,
      paraphrased_count,
      unsupported_count,
    },
  };
}

export function computeAuditSummary(resultsByBulletId: Record<string, AuditResult>): OverallAuditSummary {
  const entries = Object.values(resultsByBulletId);
  const total_claims = entries.length;
  let verified_count = 0;
  let paraphrased_count = 0;
  let unsupported_count = 0;
  let needs_review_count = 0;
  let user_override_count = 0;

  for (const r of entries) {
    if (r.user_override) user_override_count += 1;
    if (r.status === 'VERIFIED') verified_count += 1;
    else if (r.status === 'PARAPHRASED') paraphrased_count += 1;
    else if (r.status === 'NEEDS_REVIEW') needs_review_count += 1;
    else unsupported_count += 1;
  }

  // Deterministic verification score: VERIFIED = 1.0, PARAPHRASED = 0.85, UNSUPPORTED / NEEDS_REVIEW = 0.0
  const verification_score =
    total_claims === 0
      ? 0
      : Math.round(((verified_count * 1 + paraphrased_count * 0.85) / total_claims) * 100);

  return {
    total_claims,
    verified_count,
    paraphrased_count,
    unsupported_count,
    needs_review_count,
    user_override_count,
    verification_score,
  };
}

/**
 * Application-side independent validation on top of Pass 2 AI auditor.
 * Enforces every integrity invariant:
 * - Every generated bullet has a unique bullet ID
 * - Every bullet has at least one source_fact_id
 * - Every source_fact_id exists in the Master Profile AND is APPROVED
 * - Every bullet receives exactly one audit result (flags duplicates or missing entries)
 * - Never silently upgrades UNSUPPORTED to VERIFIED
 */
export function validateAndReconcileAudit(
  resume: GeneratedResume,
  pass2: Pass2AuditResponsePayload,
  profileFacts: Record<string, CareerFact>,
  previousAuditReport?: AuditReport | null
): AuditReport {
  const auditedAt = new Date().toISOString();
  const claims = extractAllAuditableClaims(resume);
  const validationIssues: string[] = [];

  const seenClaimIds = new Set<string>();
  const duplicateClaimIds = new Set<string>();
  for (const claim of claims) {
    if (seenClaimIds.has(claim.bullet_id)) {
      duplicateClaimIds.add(claim.bullet_id);
      validationIssues.push(`Duplicate bullet_id detected: ${claim.bullet_id}`);
    }
    seenClaimIds.add(claim.bullet_id);
  }

  const aiResultMap = new Map<string, Pass2AuditResponsePayload['audit_results'][number]>();
  const duplicateAuditIds = new Set<string>();
  for (const entry of pass2.audit_results) {
    if (!seenClaimIds.has(entry.bullet_id)) {
      validationIssues.push(`Unexpected audit entry for unknown bullet_id: ${entry.bullet_id}`);
      continue;
    }
    if (aiResultMap.has(entry.bullet_id)) {
      duplicateAuditIds.add(entry.bullet_id);
      validationIssues.push(`Duplicate audit entry returned by auditor for ${entry.bullet_id}`);
      continue;
    }
    aiResultMap.set(entry.bullet_id, entry);
  }

  const resultsByBulletId: Record<string, AuditResult> = {};

  for (const claim of claims) {
    const flags: string[] = [];
    const aiEntry = aiResultMap.get(claim.bullet_id);

    if (duplicateClaimIds.has(claim.bullet_id)) {
      flags.push('Duplicate bullet identifier detected.');
    }
    if (duplicateAuditIds.has(claim.bullet_id)) {
      flags.push('Auditor returned duplicate entries for this claim.');
    }
    if (claim.source_fact_ids.length === 0) {
      flags.push('Claim has no cited source_fact_ids.');
    }

    for (const fid of claim.source_fact_ids) {
      const fact = profileFacts[fid];
      if (!fact) {
        flags.push(`Cited source fact "${fid}" does not exist in Master Profile.`);
      } else if (fact.status !== 'APPROVED') {
        flags.push(`Cited source fact "${fid}" is ${fact.status}, not APPROVED.`);
      }
    }

    if (!aiEntry) {
      flags.push('Independent auditor omitted this claim from its report.');
    }

    let finalStatus: VerificationStatus = aiEntry ? aiEntry.status : 'UNSUPPORTED';
    let finalNote = aiEntry?.auditor_note ?? 'Missing independent audit verification result.';

    if (flags.length > 0) {
      finalStatus = 'UNSUPPORTED';
      finalNote = `${flags.join(' ')}${aiEntry ? ` Auditor note: ${aiEntry.auditor_note}` : ''}`;
    }

    const prev = previousAuditReport?.resultsByBulletId[claim.bullet_id];
    const previousHistory = prev?.previous_history ? [...prev.previous_history] : [];

    resultsByBulletId[claim.bullet_id] = {
      bullet_id: claim.bullet_id,
      status: finalStatus,
      source_fact_ids: [...claim.source_fact_ids],
      auditor_note: finalNote,
      application_flags: flags.length > 0 ? flags : undefined,
      user_override: prev?.user_override && finalStatus === 'UNSUPPORTED' ? true : false,
      audited_at: auditedAt,
      previous_history: previousHistory.length > 0 ? previousHistory : undefined,
    };
  }

  // Also verify skills reference approved skill facts
  for (const group of resume.skills) {
    for (const item of group.items) {
      const fact = profileFacts[item.source_fact_id];
      if (!item.source_fact_id || !fact || fact.status !== 'APPROVED') {
        validationIssues.push(
          `Skill "${item.name}" references missing or unapproved fact "${item.source_fact_id || 'none'}".`
        );
      }
    }
  }

  // Also verify credentials reference approved credential facts
  for (const crd of resume.credentials ?? []) {
    const fact = profileFacts[crd.source_fact_id];
    if (!crd.source_fact_id || !fact || fact.status !== 'APPROVED') {
      validationIssues.push(
        `Credential "${crd.title}" references missing or unapproved fact "${crd.source_fact_id || 'none'}".`
      );
    }
  }

  return {
    resultsByBulletId,
    summary: computeAuditSummary(resultsByBulletId),
    validationIssues,
    auditedAt,
  };
}

export function evaluateExportSafety(
  resume: GeneratedResume,
  auditReport: AuditReport | null,
  profileFacts: Record<string, CareerFact>
): ExportSafetyCheckResult {
  const claims = extractAllAuditableClaims(resume);
  const blockedReasons: string[] = [];
  const blockingBulletIds: string[] = [];

  let verifiedCount = 0;
  let paraphrasedCount = 0;
  let unsupportedCount = 0;
  let needsReviewCount = 0;
  let missingSourceCount = 0;
  let hasUserOverrides = false;

  if (!auditReport) {
    return {
      allowed: false,
      hasParaphrased: false,
      hasUserOverrides: false,
      blockedReasons: ['Resume has not completed independent factual auditing.'],
      blockingBulletIds: claims.map((c) => c.bullet_id),
      paraphrasedCount: 0,
      verifiedCount: 0,
      unsupportedCount: 0,
      needsReviewCount: claims.length,
      missingSourceCount: 0,
    };
  }

  for (const claim of claims) {
    const audit = auditReport.resultsByBulletId[claim.bullet_id];
    const hasMissingSource =
      claim.source_fact_ids.length === 0 ||
      claim.source_fact_ids.some((id) => {
        const fact = profileFacts[id];
        return !fact || fact.status !== 'APPROVED';
      });

    if (hasMissingSource) {
      missingSourceCount += 1;
      if (!audit?.user_override) {
        blockingBulletIds.push(claim.bullet_id);
      }
    }

    if (!audit) {
      needsReviewCount += 1;
      blockingBulletIds.push(claim.bullet_id);
      continue;
    }

    if (audit.user_override) {
      hasUserOverrides = true;
    }

    if (audit.status === 'VERIFIED') {
      verifiedCount += 1;
    } else if (audit.status === 'PARAPHRASED') {
      paraphrasedCount += 1;
    } else if (audit.status === 'NEEDS_REVIEW') {
      needsReviewCount += 1;
      blockingBulletIds.push(claim.bullet_id);
    } else if (audit.status === 'UNSUPPORTED') {
      unsupportedCount += 1;
      if (!audit.user_override) {
        blockingBulletIds.push(claim.bullet_id);
      }
    }
  }

  const uniqueBlocking = Array.from(new Set(blockingBulletIds));

  if (needsReviewCount > 0) {
    blockedReasons.push(
      `${needsReviewCount} edited ${needsReviewCount === 1 ? 'claim requires' : 'claims require'} re-audit before export.`
    );
  }
  if (unsupportedCount > 0 && uniqueBlocking.some((id) => auditReport.resultsByBulletId[id]?.status === 'UNSUPPORTED')) {
    const unoverriddenCount = claims.filter(
      (c) =>
        auditReport.resultsByBulletId[c.bullet_id]?.status === 'UNSUPPORTED' &&
        !auditReport.resultsByBulletId[c.bullet_id]?.user_override
    ).length;
    if (unoverriddenCount > 0) {
      blockedReasons.push(
        `${unoverriddenCount} unsupported ${unoverriddenCount === 1 ? 'claim' : 'claims'} must be reverted, removed, or explicitly resolved.`
      );
    }
  }
  if (missingSourceCount > 0 && uniqueBlocking.length > 0) {
    blockedReasons.push(
      `${missingSourceCount} ${missingSourceCount === 1 ? 'claim lacks' : 'claims lack'} approved source fact references.`
    );
  }

  return {
    allowed: uniqueBlocking.length === 0,
    hasParaphrased: paraphrasedCount > 0,
    hasUserOverrides,
    blockedReasons,
    blockingBulletIds: uniqueBlocking,
    paraphrasedCount,
    verifiedCount,
    unsupportedCount,
    needsReviewCount,
    missingSourceCount,
  };
}

export function isValidMasterProfile(raw: unknown): raw is MasterProfile {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.id === 'string' &&
    typeof raw.schemaVersion === 'number' &&
    isRecord(raw.header) &&
    Array.isArray(raw.education) &&
    Array.isArray(raw.experience) &&
    Array.isArray(raw.projects) &&
    Array.isArray(raw.skills) &&
    isRecord(raw.facts) &&
    isRecord(raw.idCounters)
  );
}

export function isValidVersionSnapshot(raw: unknown): raw is VersionSnapshot {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.versionId === 'string' &&
    typeof raw.targetRole === 'string' &&
    typeof raw.createdAt === 'string' &&
    typeof raw.matchScore === 'number' &&
    typeof raw.verificationScore === 'number' &&
    isRecord(raw.resume) &&
    isRecord(raw.auditReport) &&
    isRecord(raw.matchScoreResult) &&
    isRecord(raw.jobDescription)
  );
}

export function isValidSettings(raw: unknown): raw is ApplicationSettings {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.schemaVersion === 'number' &&
    (raw.theme === 'light' || raw.theme === 'dark')
  );
}
