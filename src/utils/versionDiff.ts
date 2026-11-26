import type { VersionSnapshot } from '../types/history';
import type { GeneratedResume } from '../types/resume';

export interface ClaimDiffEntry {
  key: string;
  bulletId: string;
  section: string;
  context: string;
  status: 'added' | 'removed' | 'modified';
  beforeText?: string;
  afterText?: string;
  sourceFactIds: string[];
}

export interface VersionDiffResult {
  leftVersionId: string;
  rightVersionId: string;
  matchScoreDelta: number;
  verificationScoreDelta: number;
  sourceFactCountDelta: number;
  addedFactIds: string[];
  removedFactIds: string[];
  sharedFactIds: string[];
  addedSkills: string[];
  removedSkills: string[];
  addedCredentials: string[];
  removedCredentials: string[];
  claimDiffs: ClaimDiffEntry[];
  unchangedClaimCount: number;
}

interface NormalizedClaim {
  key: string;
  bulletId: string;
  section: string;
  context: string;
  text: string;
  normalizedText: string;
  sourceFactIds: string[];
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function extractResumeClaims(resume: GeneratedResume): NormalizedClaim[] {
  const claims: NormalizedClaim[] = [];

  for (const s of resume.summary_statements) {
    claims.push({
      key: `summary:${s.bullet_id}`,
      bulletId: s.bullet_id,
      section: 'Professional Summary',
      context: 'Summary',
      text: s.text.trim(),
      normalizedText: normalizeText(s.text),
      sourceFactIds: [...s.source_fact_ids],
    });
  }

  for (const exp of resume.experience) {
    const context = `${exp.job_title} — ${exp.company}`;
    for (const b of exp.bullets) {
      claims.push({
        key: `experience:${exp.source_parent_id || exp.company}:${b.bullet_id}`,
        bulletId: b.bullet_id,
        section: 'Experience',
        context,
        text: b.text.trim(),
        normalizedText: normalizeText(b.text),
        sourceFactIds: [...b.source_fact_ids],
      });
    }
  }

  for (const prj of resume.projects) {
    const context = prj.project_name;
    for (const b of prj.bullets) {
      claims.push({
        key: `projects:${prj.source_parent_id || prj.project_name}:${b.bullet_id}`,
        bulletId: b.bullet_id,
        section: 'Projects',
        context,
        text: b.text.trim(),
        normalizedText: normalizeText(b.text),
        sourceFactIds: [...b.source_fact_ids],
      });
    }
  }

  for (const edu of resume.education) {
    const context = `${edu.degree} — ${edu.institution}`;
    for (const hl of edu.highlights) {
      claims.push({
        key: `education:${edu.source_parent_id || edu.institution}:${hl.bullet_id}`,
        bulletId: hl.bullet_id,
        section: 'Education',
        context,
        text: hl.text.trim(),
        normalizedText: normalizeText(hl.text),
        sourceFactIds: [...hl.source_fact_ids],
      });
    }
  }

  return claims;
}

function extractSkillNames(resume: GeneratedResume): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const group of resume.skills) {
    for (const item of group.items) {
      const trimmed = item.name.trim();
      const key = trimmed.toLowerCase();
      if (trimmed && !seen.has(key)) {
        seen.add(key);
        names.push(trimmed);
      }
    }
  }
  return names;
}

function extractCredentialLabels(resume: GeneratedResume): string[] {
  const items = resume.credentials ?? [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const label = [item.category, item.title, item.issuer, item.date]
      .filter((p) => Boolean(p && p.trim()))
      .join(' · ');
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }
  return labels;
}

/**
 * Compares two immutable VersionSnapshots (`left` baseline -> `right` comparison)
 * and computes deterministic score deltas, fact-lineage diffs, skill/credential changes,
 * and claim-level additions, removals, and edits.
 */
export function compareVersionSnapshots(
  left: VersionSnapshot,
  right: VersionSnapshot
): VersionDiffResult {
  const leftFacts = new Set(left.sourceFactIds);
  const rightFacts = new Set(right.sourceFactIds);

  const addedFactIds = Array.from(rightFacts).filter((id) => !leftFacts.has(id)).sort();
  const removedFactIds = Array.from(leftFacts).filter((id) => !rightFacts.has(id)).sort();
  const sharedFactIds = Array.from(rightFacts).filter((id) => leftFacts.has(id)).sort();

  // Skills diff (case-insensitive)
  const leftSkills = extractSkillNames(left.resume);
  const rightSkills = extractSkillNames(right.resume);
  const leftSkillKeys = new Set(leftSkills.map((s) => s.toLowerCase()));
  const rightSkillKeys = new Set(rightSkills.map((s) => s.toLowerCase()));

  const addedSkills = rightSkills.filter((s) => !leftSkillKeys.has(s.toLowerCase()));
  const removedSkills = leftSkills.filter((s) => !rightSkillKeys.has(s.toLowerCase()));

  // Credentials diff
  const leftCreds = extractCredentialLabels(left.resume);
  const rightCreds = extractCredentialLabels(right.resume);
  const leftCredKeys = new Set(leftCreds.map((c) => c.toLowerCase()));
  const rightCredKeys = new Set(rightCreds.map((c) => c.toLowerCase()));

  const addedCredentials = rightCreds.filter((c) => !leftCredKeys.has(c.toLowerCase()));
  const removedCredentials = leftCreds.filter((c) => !rightCredKeys.has(c.toLowerCase()));

  // Claim-level diff: match first by identical normalized text within same section, then by key/bulletId
  const leftClaims = extractResumeClaims(left.resume);
  const rightClaims = extractResumeClaims(right.resume);

  const matchedLeftIndices = new Set<number>();
  const matchedRightIndices = new Set<number>();
  let unchangedClaimCount = 0;

  // Pass 1: exact text match within same section + context
  for (let ri = 0; ri < rightClaims.length; ri++) {
    const rc = rightClaims[ri];
    const li = leftClaims.findIndex(
      (lc, idx) =>
        !matchedLeftIndices.has(idx) &&
        lc.section === rc.section &&
        lc.normalizedText === rc.normalizedText
    );
    if (li !== -1) {
      matchedLeftIndices.add(li);
      matchedRightIndices.add(ri);
      unchangedClaimCount += 1;
    }
  }

  const claimDiffs: ClaimDiffEntry[] = [];

  // Pass 2: match modified claims by key (same entry + bullet_id) or shared source_fact_ids in same section
  for (let ri = 0; ri < rightClaims.length; ri++) {
    if (matchedRightIndices.has(ri)) continue;
    const rc = rightClaims[ri];
    let li = leftClaims.findIndex(
      (lc, idx) => !matchedLeftIndices.has(idx) && lc.key === rc.key
    );
    if (li === -1 && rc.sourceFactIds.length > 0) {
      const rightFactKey = [...rc.sourceFactIds].sort().join(',');
      li = leftClaims.findIndex(
        (lc, idx) =>
          !matchedLeftIndices.has(idx) &&
          lc.section === rc.section &&
          lc.context === rc.context &&
          [...lc.sourceFactIds].sort().join(',') === rightFactKey
      );
    }

    if (li !== -1) {
      const lc = leftClaims[li];
      matchedLeftIndices.add(li);
      matchedRightIndices.add(ri);
      claimDiffs.push({
        key: rc.key,
        bulletId: rc.bulletId,
        section: rc.section,
        context: rc.context,
        status: 'modified',
        beforeText: lc.text,
        afterText: rc.text,
        sourceFactIds: Array.from(new Set([...lc.sourceFactIds, ...rc.sourceFactIds])),
      });
    }
  }

  // Pass 3: remaining unmatched right claims are Added
  for (let ri = 0; ri < rightClaims.length; ri++) {
    if (matchedRightIndices.has(ri)) continue;
    const rc = rightClaims[ri];
    claimDiffs.push({
      key: rc.key,
      bulletId: rc.bulletId,
      section: rc.section,
      context: rc.context,
      status: 'added',
      afterText: rc.text,
      sourceFactIds: rc.sourceFactIds,
    });
  }

  // Pass 4: remaining unmatched left claims are Removed
  for (let li = 0; li < leftClaims.length; li++) {
    if (matchedLeftIndices.has(li)) continue;
    const lc = leftClaims[li];
    claimDiffs.push({
      key: lc.key,
      bulletId: lc.bulletId,
      section: lc.section,
      context: lc.context,
      status: 'removed',
      beforeText: lc.text,
      sourceFactIds: lc.sourceFactIds,
    });
  }

  return {
    leftVersionId: left.versionId,
    rightVersionId: right.versionId,
    matchScoreDelta: right.matchScore - left.matchScore,
    verificationScoreDelta: right.verificationScore - left.verificationScore,
    sourceFactCountDelta: right.sourceFactIds.length - left.sourceFactIds.length,
    addedFactIds,
    removedFactIds,
    sharedFactIds,
    addedSkills,
    removedSkills,
    addedCredentials,
    removedCredentials,
    claimDiffs,
    unchangedClaimCount,
  };
}
