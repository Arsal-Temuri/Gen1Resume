import type { CareerFact } from '../types/profile';
import type { RawRequirementItem } from '../types/gemini';
import type {
  JobRequirement,
  MatchScoreResult,
  RequirementCategory,
  RequirementCategoryBreakdown,
  RequirementMatchStatus,
} from '../types/resume';
import { normalizeRequirementKey } from '../utils/textUtils';

export const CATEGORY_CONFIG: ReadonlyArray<{
  category: RequirementCategory;
  label: string;
  weightPercent: number;
}> = [
  { category: 'required_technical_skills', label: 'Required Technical Skills', weightPercent: 40 },
  { category: 'relevant_responsibilities', label: 'Relevant Responsibilities', weightPercent: 25 },
  { category: 'experience_alignment', label: 'Experience Alignment', weightPercent: 20 },
  { category: 'preferred_skills', label: 'Preferred Skills', weightPercent: 10 },
  { category: 'education_and_domain', label: 'Education & Domain Alignment', weightPercent: 5 },
] as const;

const STATUS_RANK: Record<RequirementMatchStatus, number> = {
  missing: 0,
  partially_matched: 1,
  matched: 2,
};

const EVIDENCE_MULTIPLIER: Record<RequirementMatchStatus, number> = {
  matched: 1.0,
  partially_matched: 0.45,
  missing: 0.0,
};

/**
 * Deterministically computes the evidence-based Profile Match Score.
 * Rules:
 * - Never trusts unapproved or nonexistent source_fact_ids.
 * - Deduplicates repeated requirements across buckets so nothing is double-counted.
 * - Missing requirements contribute 0.
 * - Partially matched requirements contribute 45% of full credit.
 * - Category weights follow 40 / 25 / 20 / 10 / 5% (proportionally normalized if a category has 0 JD requirements).
 */
export function calculateDeterministicMatchScore(
  rawAnalysis: {
    matched: RawRequirementItem[];
    partially_matched: RawRequirementItem[];
    missing: RawRequirementItem[];
  },
  profileFacts: Record<string, CareerFact>
): MatchScoreResult {
  const combined: RawRequirementItem[] = [
    ...rawAnalysis.matched.map((r) => ({ ...r, status: 'matched' as const })),
    ...rawAnalysis.partially_matched.map((r) => ({ ...r, status: 'partially_matched' as const })),
    ...rawAnalysis.missing.map((r) => ({ ...r, status: 'missing' as const })),
  ];

  // Validate supporting facts and deduplicate by normalized requirement name
  const dedupedMap = new Map<string, JobRequirement>();
  let seq = 1;

  for (const item of combined) {
    const key = normalizeRequirementKey(item.name);
    if (!key) continue;

    // Strictly verify every cited fact ID exists AND is APPROVED
    const validFactIds = Array.from(
      new Set(
        item.supporting_fact_ids.filter((id) => {
          const fact = profileFacts[id];
          return Boolean(fact && fact.status === 'APPROVED');
        })
      )
    );

    // Never allow matched / partially_matched without approved factual evidence
    let verifiedStatus: RequirementMatchStatus = item.status;
    if (verifiedStatus !== 'missing' && validFactIds.length === 0) {
      verifiedStatus = 'missing';
    }

    const existing = dedupedMap.get(key);
    if (!existing) {
      const catWeight =
        CATEGORY_CONFIG.find((c) => c.category === item.category)?.weightPercent ?? 10;
      dedupedMap.set(key, {
        id: `REQ-${String(seq++).padStart(2, '0')}`,
        name: item.name.trim(),
        category: item.category,
        importance: item.importance,
        status: verifiedStatus,
        supporting_fact_ids: verifiedStatus === 'missing' ? [] : validFactIds,
        rationale:
          verifiedStatus === 'missing' && item.status !== 'missing'
            ? 'No approved Master Profile evidence supports this requirement.'
            : item.rationale || 'Evaluated against approved Master Profile evidence.',
        weight: catWeight,
      });
    } else if (STATUS_RANK[verifiedStatus] > STATUS_RANK[existing.status]) {
      existing.status = verifiedStatus;
      existing.supporting_fact_ids = Array.from(
        new Set([...existing.supporting_fact_ids, ...validFactIds])
      );
      if (item.rationale) {
        existing.rationale = item.rationale;
      }
    }
  }

  const deduplicatedRequirements = Array.from(dedupedMap.values());

  // Determine active weight sum across categories that actually have requirements
  const populatedWeightSum = CATEGORY_CONFIG.reduce((sum, cfg) => {
    const count = deduplicatedRequirements.filter((r) => r.category === cfg.category).length;
    return count > 0 ? sum + cfg.weightPercent : sum;
  }, 0);

  const breakdown: RequirementCategoryBreakdown[] = CATEGORY_CONFIG.map((cfg) => {
    const reqs = deduplicatedRequirements.filter((r) => r.category === cfg.category);
    const totalCount = reqs.length;
    const matchedCount = reqs.filter((r) => r.status === 'matched').length;
    const partialCount = reqs.filter((r) => r.status === 'partially_matched').length;
    const missingCount = reqs.filter((r) => r.status === 'missing').length;

    const effectiveWeight =
      totalCount > 0 && populatedWeightSum > 0
        ? (cfg.weightPercent / populatedWeightSum) * 100
        : 0;

    const avgCoverage =
      totalCount === 0
        ? 0
        : reqs.reduce((acc, r) => acc + EVIDENCE_MULTIPLIER[r.status], 0) / totalCount;

    const earnedPercent = Number((effectiveWeight * avgCoverage).toFixed(1));

    return {
      category: cfg.category,
      label: cfg.label,
      weightPercent: Number(effectiveWeight.toFixed(1)),
      earnedPercent,
      matchedCount,
      partialCount,
      missingCount,
      totalCount,
    };
  });

  const overallScore =
    deduplicatedRequirements.length === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(breakdown.reduce((sum, b) => sum + b.earnedPercent, 0))
          )
        );

  return {
    overallScore,
    breakdown,
    deduplicatedRequirements,
    totalRequirements: deduplicatedRequirements.length,
    matchedCount: deduplicatedRequirements.filter((r) => r.status === 'matched').length,
    partialCount: deduplicatedRequirements.filter((r) => r.status === 'partially_matched').length,
    missingCount: deduplicatedRequirements.filter((r) => r.status === 'missing').length,
  };
}
