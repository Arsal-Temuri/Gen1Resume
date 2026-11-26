import type { AuditReport } from '../types/audit';
import type { MasterProfile } from '../types/profile';
import type { GeneratedResume, JobDescription, MatchScoreResult, ResumeSection } from '../types/resume';
import { buildApprovedProfilePayload } from '../utils/factIds';
import { runIndependentResumeAudit } from './auditService';
import { runPass1GroundedGeneration } from './geminiService';
import { calculateDeterministicMatchScore } from './scoringService';

export type TailoringStageId = 1 | 2 | 3 | 4 | 5;

export interface TailoringProgressEvent {
  stage: TailoringStageId;
  label: string;
}

export const TAILORING_STAGES: ReadonlyArray<TailoringProgressEvent> = [
  { stage: 1, label: 'Analyzing job requirements...' },
  { stage: 2, label: 'Selecting approved career evidence...' },
  { stage: 3, label: 'Generating targeted resume...' },
  { stage: 4, label: 'Independently auditing factual claims...' },
  { stage: 5, label: 'Calculating match and verification scores...' },
] as const;

export interface TailoringPipelineResult {
  resume: GeneratedResume;
  auditReport: AuditReport;
  matchScoreResult: MatchScoreResult;
  sourceFactIds: string[];
}

const DEFAULT_SECTION_ORDER: ResumeSection[] = [
  { id: 'summary', label: 'Professional Summary', enabled: true },
  { id: 'skills', label: 'Technical Skills', enabled: true },
  { id: 'experience', label: 'Experience', enabled: true },
  { id: 'projects', label: 'Projects', enabled: true },
  { id: 'education', label: 'Education', enabled: true },
  { id: 'credentials', label: 'Certifications & Awards', enabled: false },
];

function deriveCredentialsSectionLabel(
  credentials: NonNullable<GeneratedResume['credentials']>
): string {
  const cats = new Set(credentials.map((c) => c.category));
  const labels: string[] = [];
  if (cats.has('Certification')) labels.push('Certifications');
  if (cats.has('Award')) labels.push('Awards');
  if (cats.has('Language')) labels.push('Languages');
  if (labels.length === 0) return 'Certifications & Awards';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} & ${labels[2]}`;
}

function collectAllCitedFactIds(resume: GeneratedResume): string[] {
  const ids = new Set<string>();
  for (const s of resume.summary_statements) {
    for (const id of s.source_fact_ids) ids.add(id);
  }
  for (const g of resume.skills) {
    for (const item of g.items) {
      if (item.source_fact_id) ids.add(item.source_fact_id);
    }
  }
  for (const exp of resume.experience) {
    if (exp.source_fact_id) ids.add(exp.source_fact_id);
    for (const b of exp.bullets) {
      for (const id of b.source_fact_ids) ids.add(id);
    }
  }
  for (const prj of resume.projects) {
    if (prj.source_fact_id) ids.add(prj.source_fact_id);
    for (const b of prj.bullets) {
      for (const id of b.source_fact_ids) ids.add(id);
    }
  }
  for (const edu of resume.education) {
    if (edu.source_fact_id) ids.add(edu.source_fact_id);
    for (const h of edu.highlights) {
      for (const id of h.source_fact_ids) ids.add(id);
    }
  }
  for (const crd of resume.credentials ?? []) {
    if (crd.source_fact_id) ids.add(crd.source_fact_id);
  }
  return Array.from(ids);
}

/**
 * Assembles the final resume header strictly from APPROVED Master Profile facts locally.
 * Email & phone are hydrated locally so private contact info never has to leave the browser for Pass 1/Pass 2.
 */
function buildApprovedResumeHeader(profile: MasterProfile): GeneratedResume['header'] {
  const approvedValue = (factId?: string): string => {
    if (!factId) return '';
    const fact = profile.facts[factId];
    return fact && fact.status === 'APPROVED' ? fact.content : '';
  };

  return {
    full_name: approvedValue(profile.header.factIds.fullName) || profile.header.fullName,
    professional_title: approvedValue(profile.header.factIds.professionalTitle),
    email: approvedValue(profile.header.factIds.email),
    phone: approvedValue(profile.header.factIds.phone),
    location: approvedValue(profile.header.factIds.location),
    linkedin_url: approvedValue(profile.header.factIds.linkedinUrl),
    github_url: approvedValue(profile.header.factIds.githubUrl),
    portfolio_url: approvedValue(profile.header.factIds.portfolioUrl),
  };
}

export async function runTwoPassTailoringPipeline(
  profile: MasterProfile,
  jobDescription: JobDescription,
  onProgress: (event: TailoringProgressEvent) => void,
  signal?: AbortSignal
): Promise<TailoringPipelineResult> {
  onProgress(TAILORING_STAGES[0]);
  const approvedProfile = buildApprovedProfilePayload(profile);

  if (Object.keys(approvedProfile.approvedFactIndex).length === 0) {
    throw new Error('No approved career facts are available. Approve facts in your Master Profile first.');
  }

  onProgress(TAILORING_STAGES[1]);

  onProgress(TAILORING_STAGES[2]);
  const pass1 = await runPass1GroundedGeneration(
    {
      approvedProfile,
      jobDescription: jobDescription.rawText.trim(),
      targetRole: jobDescription.targetRole.trim(),
      companyName: jobDescription.companyName.trim(),
      focusDirective: jobDescription.focusDirective.trim(),
    },
    signal
  );

  const credentials = pass1.resume.credentials ?? [];

  // Hydrate full GeneratedResume with locally approved header contact details
  const generatedResume: GeneratedResume = {
    header: buildApprovedResumeHeader(profile),
    summary_statements: pass1.resume.summary_statements.map((s) => ({
      bullet_id: s.bullet_id,
      text: s.text,
      source_fact_ids: s.source_fact_ids,
    })),
    skills: pass1.resume.skills,
    experience: pass1.resume.experience.map((exp) => ({
      ...exp,
      bullets: exp.bullets.map((b) => ({
        ...b,
        section: 'experience' as const,
      })),
    })),
    projects: pass1.resume.projects.map((prj) => ({
      ...prj,
      bullets: prj.bullets.map((b) => ({
        ...b,
        section: 'projects' as const,
      })),
    })),
    education: pass1.resume.education.map((edu) => ({
      ...edu,
      highlights: edu.highlights.map((h) => ({
        ...h,
        section: 'education' as const,
      })),
    })),
    credentials,
    sectionOrder: DEFAULT_SECTION_ORDER.map((s) =>
      s.id === 'credentials'
        ? {
            ...s,
            label: deriveCredentialsSectionLabel(credentials),
            enabled: credentials.length > 0,
          }
        : { ...s }
    ),
    generation_metadata: {
      target_role: jobDescription.targetRole.trim() || pass1.generation_metadata.target_role || 'Target Role',
      company_name: jobDescription.companyName.trim() || pass1.generation_metadata.company_name || 'Target Company',
      focus_directive: jobDescription.focusDirective.trim() || pass1.generation_metadata.focus_directive,
      generated_at: new Date().toISOString(),
    },
  };

  // PASS 2 — Separate independent factual verification call
  onProgress(TAILORING_STAGES[3]);
  const auditReport = await runIndependentResumeAudit(generatedResume, profile, null, signal);

  // STAGE 5 — Deterministic scoring
  onProgress(TAILORING_STAGES[4]);
  const matchScoreResult = calculateDeterministicMatchScore(
    pass1.requirements_analysis,
    profile.facts
  );

  const sourceFactIds = collectAllCitedFactIds(generatedResume);

  return {
    resume: generatedResume,
    auditReport,
    matchScoreResult,
    sourceFactIds,
  };
}
