export type ProfileSection =
  | 'header'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'credentials';

export type CredentialCategory = 'Certification' | 'Award' | 'Language';

export const CREDENTIAL_CATEGORIES: readonly CredentialCategory[] = [
  'Certification',
  'Award',
  'Language',
] as const;

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type FactSource =
  | 'user_supplied_resume'
  | 'pdf_upload'
  | 'manual_entry'
  | 'sample_profile';

export type SkillCategory =
  | 'Programming Languages'
  | 'Frameworks and Libraries'
  | 'Databases'
  | 'Cloud and DevOps'
  | 'AI and Machine Learning'
  | 'Developer Tools'
  | 'Other Technical Skills';

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  'Programming Languages',
  'Frameworks and Libraries',
  'Databases',
  'Cloud and DevOps',
  'AI and Machine Learning',
  'Developer Tools',
  'Other Technical Skills',
] as const;

export interface CareerFact {
  fact_id: string;
  section: ProfileSection;
  parent_id: string;
  field: string;
  label: string;
  content: string;
  status: ApprovalStatus;
  category?: SkillCategory;
  created_at: string;
  updated_at: string;
  source: FactSource;
}

export interface ProfileHeader {
  fullName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  factIds: {
    fullName?: string;
    professionalTitle?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  graduationDate: string;
  gpa: string;
  relevantCoursework: string[];
  academicAchievements: string[];
  factIds: string[];
}

export interface Experience {
  id: string;
  company: string;
  jobTitle: string;
  employmentType: string;
  location: string;
  startDate: string;
  endDate: string;
  metaFactId: string;
  bulletFactIds: string[];
}

export interface Project {
  id: string;
  projectName: string;
  description: string;
  technologies: string[];
  projectUrl: string;
  metaFactId: string;
  bulletFactIds: string[];
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  factId: string;
}

export interface CredentialItem {
  id: string;
  category: CredentialCategory;
  title: string;
  issuer: string;
  date: string;
  detail: string;
  factId: string;
}

export interface FactIdCounters {
  header: number;
  educationEntries: number;
  experienceEntries: number;
  projectEntries: number;
  skills: number;
  credentials?: number;
  childCounters: Record<string, number>;
  retiredIds: string[];
}

export interface MasterProfile {
  id: string;
  schemaVersion: number;
  isSampleData: boolean;
  createdAt: string;
  updatedAt: string;
  header: ProfileHeader;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: Skill[];
  credentials?: CredentialItem[];
  facts: Record<string, CareerFact>;
  idCounters: FactIdCounters;
}

export interface ApprovedProfilePayload {
  header: {
    fullName: string;
    professionalTitle: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
  };
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    graduationDate: string;
    gpa: string;
    facts: Array<{ fact_id: string; label: string; content: string }>;
  }>;
  experience: Array<{
    id: string;
    company: string;
    jobTitle: string;
    employmentType: string;
    location: string;
    startDate: string;
    endDate: string;
    metaFactId: string;
    bullets: Array<{ fact_id: string; content: string }>;
  }>;
  projects: Array<{
    id: string;
    projectName: string;
    description: string;
    technologies: string[];
    projectUrl: string;
    metaFactId: string;
    bullets: Array<{ fact_id: string; content: string }>;
  }>;
  skills: Array<{
    fact_id: string;
    name: string;
    category: SkillCategory;
  }>;
  credentials?: Array<{
    fact_id: string;
    category: CredentialCategory;
    title: string;
    issuer: string;
    date: string;
    detail: string;
  }>;
  approvedFactIndex: Record<string, { fact_id: string; section: ProfileSection; parent_id: string; content: string }>;
}
