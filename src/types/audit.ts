export type VerificationStatus =
  | 'VERIFIED'
  | 'PARAPHRASED'
  | 'UNSUPPORTED'
  | 'NEEDS_REVIEW';

export interface AuditHistoryEntry {
  status: VerificationStatus;
  auditor_note: string;
  audited_at: string;
  claim_text: string;
}

export interface AuditResult {
  bullet_id: string;
  status: VerificationStatus;
  source_fact_ids: string[];
  auditor_note: string;
  application_flags?: string[];
  user_override?: boolean;
  audited_at: string;
  previous_history?: AuditHistoryEntry[];
}

export interface OverallAuditSummary {
  total_claims: number;
  verified_count: number;
  paraphrased_count: number;
  unsupported_count: number;
  needs_review_count: number;
  user_override_count: number;
  verification_score: number;
}

export interface AuditReport {
  resultsByBulletId: Record<string, AuditResult>;
  summary: OverallAuditSummary;
  validationIssues: string[];
  auditedAt: string;
}

export interface ExportSafetyCheckResult {
  allowed: boolean;
  hasParaphrased: boolean;
  hasUserOverrides: boolean;
  blockedReasons: string[];
  blockingBulletIds: string[];
  paraphrasedCount: number;
  verifiedCount: number;
  unsupportedCount: number;
  needsReviewCount: number;
  missingSourceCount: number;
}
