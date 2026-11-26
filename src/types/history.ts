import type { AuditReport } from './audit';
import type { CareerFact } from './profile';
import type { GeneratedResume, JobDescription, MatchScoreResult } from './resume';

export type ThemePreference = 'light' | 'dark';

export interface ApplicationSettings {
  schemaVersion: number;
  theme: ThemePreference;
  aiNoticeDismissed: boolean;
}

export interface UserEditRecord {
  id: string;
  bullet_id: string;
  action: 'edit' | 'revert' | 'remove' | 'reorder' | 'override' | 'section_toggle';
  timestamp: string;
  detail: string;
}

export type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'archived';

export const APPLICATION_STATUSES: ReadonlyArray<{
  value: ApplicationStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
] as const;

export interface VersionSnapshot {
  versionId: string;
  targetRole: string;
  companyName: string;
  jobDescription: JobDescription;
  createdAt: string;
  updatedAt: string;
  matchScore: number;
  verificationScore: number;
  resume: GeneratedResume;
  sourceFactIds: string[];
  auditReport: AuditReport;
  matchScoreResult: MatchScoreResult;
  profileSnapshot: Record<string, CareerFact>;
  userEdits: UserEditRecord[];
  auditStatus: 'CLEAN' | 'HAS_PARAPHRASED' | 'NEEDS_ATTENTION';
  applicationStatus?: ApplicationStatus;
  applicationNotes?: string;
  statusUpdatedAt?: string;
}

export interface ApplicationBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  app: 'Gen1Resume';
  profile: unknown;
  versions: VersionSnapshot[];
  settings: ApplicationSettings;
}
