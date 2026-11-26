import type { CredentialCategory, SkillCategory } from './profile';

export type ResumeSectionType =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'credentials';

export type RequirementCategory =
  | 'required_technical_skills'
  | 'relevant_responsibilities'
  | 'experience_alignment'
  | 'preferred_skills'
  | 'education_and_domain';

export type RequirementImportance = 'required' | 'preferred';

export type RequirementMatchStatus = 'matched' | 'partially_matched' | 'missing';

export interface JobDescription {
  targetRole: string;
  companyName: string;
  rawText: string;
  focusDirective: string;
}

export interface JobRequirement {
  id: string;
  name: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  status: RequirementMatchStatus;
  supporting_fact_ids: string[];
  rationale: string;
  weight: number;
}

export interface RequirementCategoryBreakdown {
  category: RequirementCategory;
  label: string;
  weightPercent: number;
  earnedPercent: number;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  totalCount: number;
}

export interface MatchScoreResult {
  overallScore: number;
  breakdown: RequirementCategoryBreakdown[];
  deduplicatedRequirements: JobRequirement[];
  totalRequirements: number;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
}

export interface ResumeBullet {
  bullet_id: string;
  text: string;
  source_fact_ids: string[];
  section: ResumeSectionType;
  userOverride?: boolean;
  userOverrideReason?: string;
}

export interface ResumeSummaryStatement {
  bullet_id: string;
  text: string;
  source_fact_ids: string[];
  userOverride?: boolean;
}

export interface ResumeSkillItem {
  name: string;
  source_fact_id: string;
}

export interface ResumeSkillGroup {
  category: SkillCategory | string;
  items: ResumeSkillItem[];
}

export interface ResumeExperienceEntry {
  entry_id: string;
  source_parent_id: string;
  source_fact_id: string;
  company: string;
  job_title: string;
  employment_type: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: ResumeBullet[];
}

export interface ResumeProjectEntry {
  entry_id: string;
  source_parent_id: string;
  source_fact_id: string;
  project_name: string;
  technologies: string[];
  project_url: string;
  bullets: ResumeBullet[];
}

export interface ResumeEducationEntry {
  entry_id: string;
  source_parent_id: string;
  source_fact_id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  graduation_date: string;
  gpa: string;
  highlights: ResumeBullet[];
}

export interface ResumeHeader {
  full_name: string;
  professional_title: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
}

export interface ResumeSection {
  id: ResumeSectionType;
  label: string;
  enabled: boolean;
}

export interface ResumeCredentialItem {
  item_id: string;
  category: CredentialCategory;
  title: string;
  issuer: string;
  date: string;
  detail: string;
  source_fact_id: string;
}

export interface GeneratedResume {
  header: ResumeHeader;
  summary_statements: ResumeSummaryStatement[];
  skills: ResumeSkillGroup[];
  experience: ResumeExperienceEntry[];
  projects: ResumeProjectEntry[];
  education: ResumeEducationEntry[];
  credentials?: ResumeCredentialItem[];
  sectionOrder: ResumeSection[];
  generation_metadata: {
    target_role: string;
    company_name: string;
    focus_directive: string;
    generated_at: string;
  };
}
