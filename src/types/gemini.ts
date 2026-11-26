import type { ApprovedProfilePayload, CredentialCategory, SkillCategory } from './profile';
import type {
  GeneratedResume,
  RequirementCategory,
  RequirementImportance,
  RequirementMatchStatus,
} from './resume';

export interface ExtractedResumeData {
  header: {
    fullName: string;
    professionalTitle: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
  };
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    graduationDate: string;
    gpa: string;
    relevantCoursework: string[];
    academicAchievements: string[];
  }>;
  experience: Array<{
    company: string;
    jobTitle: string;
    employmentType: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  projects: Array<{
    projectName: string;
    description: string;
    technologies: string[];
    projectUrl: string;
    bullets: string[];
  }>;
  skills: Array<{
    name: string;
    category: SkillCategory;
  }>;
  credentials?: Array<{
    category: CredentialCategory;
    title: string;
    issuer: string;
    date: string;
    detail: string;
  }>;
}

export interface ExtractRequestPayload {
  mode: 'text' | 'pdf';
  resumeText?: string;
  pdfBase64?: string;
  fileName?: string;
}

export interface Pass1TailorRequestPayload {
  approvedProfile: ApprovedProfilePayload;
  jobDescription: string;
  targetRole: string;
  companyName: string;
  focusDirective: string;
}

export interface RawRequirementItem {
  name: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  status: RequirementMatchStatus;
  supporting_fact_ids: string[];
  rationale: string;
}

export interface Pass1TailorResponsePayload {
  resume: {
    summary_statements: Array<{
      bullet_id: string;
      text: string;
      source_fact_ids: string[];
    }>;
    skills: Array<{
      category: string;
      items: Array<{
        name: string;
        source_fact_id: string;
      }>;
    }>;
    experience: Array<{
      entry_id: string;
      source_parent_id: string;
      source_fact_id: string;
      company: string;
      job_title: string;
      employment_type: string;
      location: string;
      start_date: string;
      end_date: string;
      bullets: Array<{
        bullet_id: string;
        text: string;
        source_fact_ids: string[];
      }>;
    }>;
    projects: Array<{
      entry_id: string;
      source_parent_id: string;
      source_fact_id: string;
      project_name: string;
      technologies: string[];
      project_url: string;
      bullets: Array<{
        bullet_id: string;
        text: string;
        source_fact_ids: string[];
      }>;
    }>;
    education: Array<{
      entry_id: string;
      source_parent_id: string;
      source_fact_id: string;
      institution: string;
      degree: string;
      field_of_study: string;
      start_date: string;
      graduation_date: string;
      gpa: string;
      highlights: Array<{
        bullet_id: string;
        text: string;
        source_fact_ids: string[];
      }>;
    }>;
    credentials?: Array<{
      item_id: string;
      category: CredentialCategory;
      title: string;
      issuer: string;
      date: string;
      detail: string;
      source_fact_id: string;
    }>;
  };
  requirements_analysis: {
    matched: RawRequirementItem[];
    partially_matched: RawRequirementItem[];
    missing: RawRequirementItem[];
  };
  generation_metadata: {
    target_role: string;
    company_name: string;
    focus_directive: string;
  };
}

export interface AuditableClaim {
  bullet_id: string;
  section: string;
  context: string;
  text: string;
  source_fact_ids: string[];
}

export interface Pass2AuditRequestPayload {
  claims: AuditableClaim[];
  approvedProfile: ApprovedProfilePayload;
  resumeContext: Pick<GeneratedResume, 'experience' | 'projects' | 'education' | 'skills'>;
}

export interface Pass2AuditResponsePayload {
  audit_results: Array<{
    bullet_id: string;
    status: 'VERIFIED' | 'PARAPHRASED' | 'UNSUPPORTED';
    source_fact_ids: string[];
    auditor_note: string;
  }>;
  overall_audit_summary: {
    total_claims: number;
    verified_count: number;
    paraphrased_count: number;
    unsupported_count: number;
  };
}
