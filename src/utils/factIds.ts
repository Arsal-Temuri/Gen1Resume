import type {
  ApprovalStatus,
  ApprovedProfilePayload,
  CareerFact,
  CredentialCategory,
  CredentialItem,
  Education,
  Experience,
  FactIdCounters,
  FactSource,
  MasterProfile,
  ProfileHeader,
  Project,
  Skill,
  SkillCategory,
} from '../types/profile';
import { CREDENTIAL_CATEGORIES, SKILL_CATEGORIES } from '../types/profile';
import type { ExtractedResumeData } from '../types/gemini';

export const PROFILE_SCHEMA_VERSION = 1;

export function createEmptyCounters(): FactIdCounters {
  return {
    header: 0,
    educationEntries: 0,
    experienceEntries: 0,
    projectEntries: 0,
    skills: 0,
    credentials: 0,
    childCounters: {},
    retiredIds: [],
  };
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function isRetired(counters: FactIdCounters, id: string): boolean {
  return counters.retiredIds.includes(id);
}

export function cloneCounters(counters: FactIdCounters): FactIdCounters {
  return {
    header: counters.header,
    educationEntries: counters.educationEntries,
    experienceEntries: counters.experienceEntries,
    projectEntries: counters.projectEntries,
    skills: counters.skills,
    credentials: counters.credentials ?? 0,
    childCounters: { ...counters.childCounters },
    retiredIds: [...counters.retiredIds],
  };
}

export function retireFactId(counters: FactIdCounters, factId: string): FactIdCounters {
  const next = cloneCounters(counters);
  if (!next.retiredIds.includes(factId)) {
    next.retiredIds.push(factId);
  }
  return next;
}

export function nextHeaderFactId(counters: FactIdCounters): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let id = '';
  do {
    next.header += 1;
    id = `HDR-${padTwo(next.header)}`;
  } while (isRetired(next, id));
  return { id, counters: next };
}

export function nextEducationEntryId(counters: FactIdCounters): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let id = '';
  do {
    next.educationEntries += 1;
    id = `EDU-${next.educationEntries}`;
  } while (isRetired(next, id));
  return { id, counters: next };
}

export function nextEducationFactId(
  counters: FactIdCounters,
  parentId: string
): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let seq = next.childCounters[parentId] ?? 0;
  let id = '';
  do {
    seq += 1;
    id = `${parentId}-F${seq}`;
  } while (isRetired(next, id));
  next.childCounters[parentId] = seq;
  return { id, counters: next };
}

export function nextExperienceEntryId(counters: FactIdCounters): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let id = '';
  do {
    next.experienceEntries += 1;
    id = `EXP-${next.experienceEntries}`;
  } while (isRetired(next, id));
  return { id, counters: next };
}

export function nextExperienceBulletId(
  counters: FactIdCounters,
  parentId: string
): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let seq = next.childCounters[parentId] ?? 0;
  let id = '';
  do {
    seq += 1;
    id = `${parentId}-B${seq}`;
  } while (isRetired(next, id));
  next.childCounters[parentId] = seq;
  return { id, counters: next };
}

export function nextProjectEntryId(counters: FactIdCounters): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let id = '';
  do {
    next.projectEntries += 1;
    id = `PRJ-${next.projectEntries}`;
  } while (isRetired(next, id));
  return { id, counters: next };
}

export function nextProjectBulletId(
  counters: FactIdCounters,
  parentId: string
): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let seq = next.childCounters[parentId] ?? 0;
  let id = '';
  do {
    seq += 1;
    id = `${parentId}-B${seq}`;
  } while (isRetired(next, id));
  next.childCounters[parentId] = seq;
  return { id, counters: next };
}

export function nextSkillFactId(counters: FactIdCounters): { id: string; counters: FactIdCounters } {
  const next = cloneCounters(counters);
  let id = '';
  do {
    next.skills += 1;
    id = `SKL-${padTwo(next.skills)}`;
  } while (isRetired(next, id));
  return { id, counters: next };
}

export function nextCredentialFactId(counters: FactIdCounters): {
  id: string;
  counters: FactIdCounters;
} {
  const next = cloneCounters(counters);
  let seq = next.credentials ?? 0;
  let id = '';
  do {
    seq += 1;
    id = `CRD-${padTwo(seq)}`;
  } while (isRetired(next, id));
  next.credentials = seq;
  return { id, counters: next };
}

export function normalizeCredentialCategory(category: string): CredentialCategory {
  const trimmed = category.trim().toLowerCase();
  for (const valid of CREDENTIAL_CATEGORIES) {
    if (valid.toLowerCase() === trimmed) {
      return valid;
    }
  }
  if (trimmed.includes('lang') || trimmed.includes('fluent') || trimmed.includes('bilingual')) {
    return 'Language';
  }
  if (
    trimmed.includes('award') ||
    trimmed.includes('honor') ||
    trimmed.includes('prize') ||
    trimmed.includes('scholarship') ||
    trimmed.includes('recognition')
  ) {
    return 'Award';
  }
  return 'Certification';
}

export function formatCredentialFactContent(item: {
  title: string;
  issuer: string;
  date: string;
  detail: string;
}): string {
  return [item.title.trim(), item.issuer.trim(), item.date.trim(), item.detail.trim()]
    .filter(Boolean)
    .join(' | ');
}

export function normalizeSkillCategory(category: string): SkillCategory {
  const trimmed = category.trim().toLowerCase();
  for (const valid of SKILL_CATEGORIES) {
    if (valid.toLowerCase() === trimmed) {
      return valid;
    }
  }
  if (trimmed.includes('lang')) return 'Programming Languages';
  if (trimmed.includes('frame') || trimmed.includes('lib')) return 'Frameworks and Libraries';
  if (trimmed.includes('data') || trimmed.includes('sql')) return 'Databases';
  if (trimmed.includes('cloud') || trimmed.includes('devops') || trimmed.includes('infra')) {
    return 'Cloud and DevOps';
  }
  if (trimmed.includes('ai') || trimmed.includes('ml') || trimmed.includes('machine') || trimmed.includes('nlp')) {
    return 'AI and Machine Learning';
  }
  if (trimmed.includes('tool') || trimmed.includes('git')) return 'Developer Tools';
  return 'Other Technical Skills';
}

export function buildMasterProfileFromExtracted(
  extracted: ExtractedResumeData,
  source: FactSource,
  options: {
    isSampleData?: boolean;
    defaultStatus?: ApprovalStatus;
    nowIso?: string;
  } = {}
): MasterProfile {
  const now = options.nowIso ?? new Date().toISOString();
  const defaultStatus: ApprovalStatus = options.defaultStatus ?? 'PENDING';
  let counters = createEmptyCounters();
  const facts: Record<string, CareerFact> = {};

  const headerFields: Array<{
    key: keyof Omit<ProfileHeader, 'factIds'>;
    label: string;
    value: string;
  }> = [
    { key: 'fullName', label: 'Full Name', value: extracted.header.fullName.trim() },
    { key: 'professionalTitle', label: 'Professional Title', value: extracted.header.professionalTitle.trim() },
    { key: 'email', label: 'Email', value: extracted.header.email.trim() },
    { key: 'phone', label: 'Phone', value: extracted.header.phone.trim() },
    { key: 'location', label: 'Location', value: extracted.header.location.trim() },
    { key: 'linkedinUrl', label: 'LinkedIn URL', value: extracted.header.linkedinUrl.trim() },
    { key: 'githubUrl', label: 'GitHub URL', value: extracted.header.githubUrl.trim() },
    { key: 'portfolioUrl', label: 'Portfolio URL', value: extracted.header.portfolioUrl.trim() },
  ];

  const header: ProfileHeader = {
    fullName: extracted.header.fullName.trim(),
    professionalTitle: extracted.header.professionalTitle.trim(),
    email: extracted.header.email.trim(),
    phone: extracted.header.phone.trim(),
    location: extracted.header.location.trim(),
    linkedinUrl: extracted.header.linkedinUrl.trim(),
    githubUrl: extracted.header.githubUrl.trim(),
    portfolioUrl: extracted.header.portfolioUrl.trim(),
    factIds: {},
  };

  for (const field of headerFields) {
    if (!field.value) continue;
    const alloc = nextHeaderFactId(counters);
    counters = alloc.counters;
    header.factIds[field.key] = alloc.id;
    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'header',
      parent_id: 'HDR',
      field: field.key,
      label: field.label,
      content: field.value,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };
  }

  const education: Education[] = [];
  for (const edu of extracted.education) {
    const entryAlloc = nextEducationEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;
    const factIds: string[] = [];

    const coreSummary = [
      `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`,
      edu.institution,
      [edu.startDate, edu.graduationDate].filter(Boolean).join(' – '),
      edu.gpa ? `GPA: ${edu.gpa}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (coreSummary) {
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'degree_summary',
        label: 'Degree & Institution',
        content: coreSummary,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
    }

    if (edu.relevantCoursework.length > 0) {
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'coursework',
        label: 'Relevant Coursework',
        content: `Relevant Coursework: ${edu.relevantCoursework.join(', ')}`,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
    }

    for (const ach of edu.academicAchievements) {
      const trimmed = ach.trim();
      if (!trimmed) continue;
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'achievement',
        label: 'Academic Achievement',
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
    }

    education.push({
      id: parentId,
      institution: edu.institution.trim(),
      degree: edu.degree.trim(),
      fieldOfStudy: edu.fieldOfStudy.trim(),
      startDate: edu.startDate.trim(),
      graduationDate: edu.graduationDate.trim(),
      gpa: edu.gpa.trim(),
      relevantCoursework: edu.relevantCoursework.map((c) => c.trim()).filter(Boolean),
      academicAchievements: edu.academicAchievements.map((a) => a.trim()).filter(Boolean),
      factIds,
    });
  }

  const experience: Experience[] = [];
  for (const exp of extracted.experience) {
    const entryAlloc = nextExperienceEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;

    const metaFactId = `${parentId}-META`;
    const roleMetaContent = [
      `${exp.jobTitle} at ${exp.company}`,
      exp.employmentType,
      exp.location,
      [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
    ]
      .filter(Boolean)
      .join(' | ');

    facts[metaFactId] = {
      fact_id: metaFactId,
      section: 'experience',
      parent_id: parentId,
      field: 'role_meta',
      label: 'Role & Dates',
      content: roleMetaContent,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    const bulletFactIds: string[] = [];
    for (const bullet of exp.bullets) {
      const trimmed = bullet.trim();
      if (!trimmed) continue;
      const b = nextExperienceBulletId(counters, parentId);
      counters = b.counters;
      bulletFactIds.push(b.id);
      facts[b.id] = {
        fact_id: b.id,
        section: 'experience',
        parent_id: parentId,
        field: 'bullet',
        label: `${exp.company} — Experience Bullet`,
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
    }

    experience.push({
      id: parentId,
      company: exp.company.trim(),
      jobTitle: exp.jobTitle.trim(),
      employmentType: exp.employmentType.trim() || 'Full-time',
      location: exp.location.trim(),
      startDate: exp.startDate.trim(),
      endDate: exp.endDate.trim(),
      metaFactId,
      bulletFactIds,
    });
  }

  const projects: Project[] = [];
  for (const prj of extracted.projects) {
    const entryAlloc = nextProjectEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;

    const metaFactId = `${parentId}-META`;
    const metaContent = [
      prj.projectName,
      prj.description,
      prj.technologies.length > 0 ? `Technologies: ${prj.technologies.join(', ')}` : '',
      prj.projectUrl ? `URL: ${prj.projectUrl}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    facts[metaFactId] = {
      fact_id: metaFactId,
      section: 'projects',
      parent_id: parentId,
      field: 'project_meta',
      label: 'Project Overview',
      content: metaContent,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    const bulletFactIds: string[] = [];
    for (const bullet of prj.bullets) {
      const trimmed = bullet.trim();
      if (!trimmed) continue;
      const b = nextProjectBulletId(counters, parentId);
      counters = b.counters;
      bulletFactIds.push(b.id);
      facts[b.id] = {
        fact_id: b.id,
        section: 'projects',
        parent_id: parentId,
        field: 'bullet',
        label: `${prj.projectName} — Project Bullet`,
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
    }

    projects.push({
      id: parentId,
      projectName: prj.projectName.trim(),
      description: prj.description.trim(),
      technologies: prj.technologies.map((t) => t.trim()).filter(Boolean),
      projectUrl: prj.projectUrl.trim(),
      metaFactId,
      bulletFactIds,
    });
  }

  const skills: Skill[] = [];
  const seenSkills = new Set<string>();
  for (const sk of extracted.skills) {
    const name = sk.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);

    const category = normalizeSkillCategory(sk.category);
    const alloc = nextSkillFactId(counters);
    counters = alloc.counters;

    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'skills',
      parent_id: 'SKL',
      field: 'skill',
      label: category,
      category,
      content: name,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    skills.push({
      id: alloc.id,
      name,
      category,
      factId: alloc.id,
    });
  }

  const credentials: CredentialItem[] = [];
  const seenCredentials = new Set<string>();
  for (const crd of extracted.credentials ?? []) {
    const title = crd.title.trim();
    if (!title) continue;
    const category = normalizeCredentialCategory(crd.category);
    const issuer = crd.issuer.trim();
    const date = crd.date.trim();
    const detail = crd.detail.trim();
    const dedupeKey = `${category.toLowerCase()}|${title.toLowerCase()}|${issuer.toLowerCase()}`;
    if (seenCredentials.has(dedupeKey)) continue;
    seenCredentials.add(dedupeKey);

    const alloc = nextCredentialFactId(counters);
    counters = alloc.counters;

    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'credentials',
      parent_id: 'CRD',
      field: 'credential',
      label: category,
      content: formatCredentialFactContent({ title, issuer, date, detail }),
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    credentials.push({
      id: alloc.id,
      category,
      title,
      issuer,
      date,
      detail,
      factId: alloc.id,
    });
  }

  return {
    id: `prof_${Date.now().toString(36)}`,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    isSampleData: Boolean(options.isSampleData),
    createdAt: now,
    updatedAt: now,
    header,
    education,
    experience,
    projects,
    skills,
    credentials,
    facts,
    idCounters: counters,
  };
}

export interface MergeProfileResult {
  profile: MasterProfile;
  addedFactsCount: number;
  skippedDuplicatesCount: number;
}

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Safely merges newly extracted resume data into an existing Master Profile:
 * - Preserves all existing APPROVED, PENDING, and REJECTED facts and retired fact IDs.
 * - Fills empty header fields without overwriting existing contact details.
 * - Matches existing Experience, Project, and Education entries and appends only new unique bullets/facts.
 * - Deduplicates technical skills case-insensitively.
 * - Assigns monotonically increasing deterministic fact IDs to all newly added facts (default PENDING).
 */
export function mergeExtractedIntoMasterProfile(
  existing: MasterProfile,
  extracted: ExtractedResumeData,
  source: FactSource,
  options: {
    defaultStatus?: ApprovalStatus;
    nowIso?: string;
  } = {}
): MergeProfileResult {
  const now = options.nowIso ?? new Date().toISOString();
  const defaultStatus: ApprovalStatus = options.defaultStatus ?? 'PENDING';
  let counters = cloneCounters(existing.idCounters);
  const facts: Record<string, CareerFact> = { ...existing.facts };
  let addedFactsCount = 0;
  let skippedDuplicatesCount = 0;

  // 1. Header: fill only currently blank fields; preserve existing non-empty values
  const header: ProfileHeader = {
    ...existing.header,
    factIds: { ...existing.header.factIds },
  };
  const headerFields: Array<{
    key: keyof Omit<ProfileHeader, 'factIds'>;
    label: string;
    value: string;
  }> = [
    { key: 'fullName', label: 'Full Name', value: extracted.header.fullName.trim() },
    { key: 'professionalTitle', label: 'Professional Title', value: extracted.header.professionalTitle.trim() },
    { key: 'email', label: 'Email', value: extracted.header.email.trim() },
    { key: 'phone', label: 'Phone', value: extracted.header.phone.trim() },
    { key: 'location', label: 'Location', value: extracted.header.location.trim() },
    { key: 'linkedinUrl', label: 'LinkedIn URL', value: extracted.header.linkedinUrl.trim() },
    { key: 'githubUrl', label: 'GitHub URL', value: extracted.header.githubUrl.trim() },
    { key: 'portfolioUrl', label: 'Portfolio URL', value: extracted.header.portfolioUrl.trim() },
  ];

  for (const field of headerFields) {
    if (!field.value) continue;
    const currentValue = header[field.key].trim();
    if (currentValue) {
      skippedDuplicatesCount += 1;
      continue;
    }
    const alloc = nextHeaderFactId(counters);
    counters = alloc.counters;
    header[field.key] = field.value;
    header.factIds[field.key] = alloc.id;
    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'header',
      parent_id: 'HDR',
      field: field.key,
      label: field.label,
      content: field.value,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };
    addedFactsCount += 1;
  }

  // 2. Education: merge into matching institution+degree or append new entry
  const education: Education[] = existing.education.map((e) => ({
    ...e,
    relevantCoursework: [...e.relevantCoursework],
    academicAchievements: [...e.academicAchievements],
    factIds: [...e.factIds],
  }));

  for (const edu of extracted.education) {
    const instKey = normalizeMatchKey(edu.institution);
    const degKey = normalizeMatchKey(edu.degree);
    if (!instKey && !degKey) continue;

    const matched = education.find(
      (e) =>
        normalizeMatchKey(e.institution) === instKey &&
        normalizeMatchKey(e.degree) === degKey
    );

    if (matched) {
      const existingFactTexts = new Set(
        matched.factIds
          .map((id) => facts[id]?.content)
          .filter((c): c is string => Boolean(c))
          .map(normalizeMatchKey)
      );
      skippedDuplicatesCount += 1; // matched degree_summary

      const newCoursework = edu.relevantCoursework
        .map((c) => c.trim())
        .filter((c) => {
          if (!c) return false;
          const exists = matched.relevantCoursework.some(
            (existingC) => normalizeMatchKey(existingC) === normalizeMatchKey(c)
          );
          if (exists) {
            skippedDuplicatesCount += 1;
            return false;
          }
          return true;
        });

      if (newCoursework.length > 0) {
        matched.relevantCoursework.push(...newCoursework);
        const courseworkContent = `Relevant Coursework: ${newCoursework.join(', ')}`;
        if (!existingFactTexts.has(normalizeMatchKey(courseworkContent))) {
          const f = nextEducationFactId(counters, matched.id);
          counters = f.counters;
          matched.factIds.push(f.id);
          facts[f.id] = {
            fact_id: f.id,
            section: 'education',
            parent_id: matched.id,
            field: 'coursework',
            label: 'Relevant Coursework',
            content: courseworkContent,
            status: defaultStatus,
            created_at: now,
            updated_at: now,
            source,
          };
          existingFactTexts.add(normalizeMatchKey(courseworkContent));
          addedFactsCount += 1;
        }
      }

      for (const ach of edu.academicAchievements) {
        const trimmed = ach.trim();
        if (!trimmed) continue;
        const key = normalizeMatchKey(trimmed);
        if (existingFactTexts.has(key)) {
          skippedDuplicatesCount += 1;
          continue;
        }
        const f = nextEducationFactId(counters, matched.id);
        counters = f.counters;
        matched.factIds.push(f.id);
        matched.academicAchievements.push(trimmed);
        facts[f.id] = {
          fact_id: f.id,
          section: 'education',
          parent_id: matched.id,
          field: 'achievement',
          label: 'Academic Achievement',
          content: trimmed,
          status: defaultStatus,
          created_at: now,
          updated_at: now,
          source,
        };
        existingFactTexts.add(key);
        addedFactsCount += 1;
      }
      continue;
    }

    const entryAlloc = nextEducationEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;
    const factIds: string[] = [];

    const coreSummary = [
      `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`,
      edu.institution,
      [edu.startDate, edu.graduationDate].filter(Boolean).join(' – '),
      edu.gpa ? `GPA: ${edu.gpa}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (coreSummary) {
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'degree_summary',
        label: 'Degree & Institution',
        content: coreSummary,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
      addedFactsCount += 1;
    }

    if (edu.relevantCoursework.length > 0) {
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'coursework',
        label: 'Relevant Coursework',
        content: `Relevant Coursework: ${edu.relevantCoursework.join(', ')}`,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
      addedFactsCount += 1;
    }

    for (const ach of edu.academicAchievements) {
      const trimmed = ach.trim();
      if (!trimmed) continue;
      const f = nextEducationFactId(counters, parentId);
      counters = f.counters;
      factIds.push(f.id);
      facts[f.id] = {
        fact_id: f.id,
        section: 'education',
        parent_id: parentId,
        field: 'achievement',
        label: 'Academic Achievement',
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
      addedFactsCount += 1;
    }

    education.push({
      id: parentId,
      institution: edu.institution.trim(),
      degree: edu.degree.trim(),
      fieldOfStudy: edu.fieldOfStudy.trim(),
      startDate: edu.startDate.trim(),
      graduationDate: edu.graduationDate.trim(),
      gpa: edu.gpa.trim(),
      relevantCoursework: edu.relevantCoursework.map((c) => c.trim()).filter(Boolean),
      academicAchievements: edu.academicAchievements.map((a) => a.trim()).filter(Boolean),
      factIds,
    });
  }

  // 3. Experience: merge unique bullets into matching company+title or add new role
  const experience: Experience[] = existing.experience.map((e) => ({
    ...e,
    bulletFactIds: [...e.bulletFactIds],
  }));

  for (const exp of extracted.experience) {
    const compKey = normalizeMatchKey(exp.company);
    const titleKey = normalizeMatchKey(exp.jobTitle);
    if (!compKey && !titleKey) continue;

    const matched = experience.find(
      (e) =>
        normalizeMatchKey(e.company) === compKey &&
        normalizeMatchKey(e.jobTitle) === titleKey
    );

    if (matched) {
      skippedDuplicatesCount += 1; // matched role meta
      const existingBullets = new Set(
        matched.bulletFactIds
          .map((id) => facts[id]?.content)
          .filter((c): c is string => Boolean(c))
          .map(normalizeMatchKey)
      );

      for (const bullet of exp.bullets) {
        const trimmed = bullet.trim();
        if (!trimmed) continue;
        const key = normalizeMatchKey(trimmed);
        if (existingBullets.has(key)) {
          skippedDuplicatesCount += 1;
          continue;
        }
        const b = nextExperienceBulletId(counters, matched.id);
        counters = b.counters;
        matched.bulletFactIds.push(b.id);
        facts[b.id] = {
          fact_id: b.id,
          section: 'experience',
          parent_id: matched.id,
          field: 'bullet',
          label: `${matched.company} — Experience Bullet`,
          content: trimmed,
          status: defaultStatus,
          created_at: now,
          updated_at: now,
          source,
        };
        existingBullets.add(key);
        addedFactsCount += 1;
      }
      continue;
    }

    const entryAlloc = nextExperienceEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;
    const metaFactId = `${parentId}-META`;
    const roleMetaContent = [
      `${exp.jobTitle} at ${exp.company}`,
      exp.employmentType,
      exp.location,
      [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
    ]
      .filter(Boolean)
      .join(' | ');

    facts[metaFactId] = {
      fact_id: metaFactId,
      section: 'experience',
      parent_id: parentId,
      field: 'role_meta',
      label: 'Role & Dates',
      content: roleMetaContent,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };
    addedFactsCount += 1;

    const bulletFactIds: string[] = [];
    for (const bullet of exp.bullets) {
      const trimmed = bullet.trim();
      if (!trimmed) continue;
      const b = nextExperienceBulletId(counters, parentId);
      counters = b.counters;
      bulletFactIds.push(b.id);
      facts[b.id] = {
        fact_id: b.id,
        section: 'experience',
        parent_id: parentId,
        field: 'bullet',
        label: `${exp.company} — Experience Bullet`,
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
      addedFactsCount += 1;
    }

    experience.push({
      id: parentId,
      company: exp.company.trim(),
      jobTitle: exp.jobTitle.trim(),
      employmentType: exp.employmentType.trim() || 'Full-time',
      location: exp.location.trim(),
      startDate: exp.startDate.trim(),
      endDate: exp.endDate.trim(),
      metaFactId,
      bulletFactIds,
    });
  }

  // 4. Projects: merge unique bullets/tech into matching projectName or add new project
  const projects: Project[] = existing.projects.map((p) => ({
    ...p,
    technologies: [...p.technologies],
    bulletFactIds: [...p.bulletFactIds],
  }));

  for (const prj of extracted.projects) {
    const nameKey = normalizeMatchKey(prj.projectName);
    if (!nameKey) continue;

    const matched = projects.find((p) => normalizeMatchKey(p.projectName) === nameKey);

    if (matched) {
      skippedDuplicatesCount += 1; // matched project meta
      const existingTech = new Set(matched.technologies.map(normalizeMatchKey));
      for (const tech of prj.technologies) {
        const trimmed = tech.trim();
        if (trimmed && !existingTech.has(normalizeMatchKey(trimmed))) {
          matched.technologies.push(trimmed);
          existingTech.add(normalizeMatchKey(trimmed));
        }
      }

      const existingBullets = new Set(
        matched.bulletFactIds
          .map((id) => facts[id]?.content)
          .filter((c): c is string => Boolean(c))
          .map(normalizeMatchKey)
      );

      for (const bullet of prj.bullets) {
        const trimmed = bullet.trim();
        if (!trimmed) continue;
        const key = normalizeMatchKey(trimmed);
        if (existingBullets.has(key)) {
          skippedDuplicatesCount += 1;
          continue;
        }
        const b = nextProjectBulletId(counters, matched.id);
        counters = b.counters;
        matched.bulletFactIds.push(b.id);
        facts[b.id] = {
          fact_id: b.id,
          section: 'projects',
          parent_id: matched.id,
          field: 'bullet',
          label: `${matched.projectName} — Project Bullet`,
          content: trimmed,
          status: defaultStatus,
          created_at: now,
          updated_at: now,
          source,
        };
        existingBullets.add(key);
        addedFactsCount += 1;
      }
      continue;
    }

    const entryAlloc = nextProjectEntryId(counters);
    counters = entryAlloc.counters;
    const parentId = entryAlloc.id;
    const metaFactId = `${parentId}-META`;
    const metaContent = [
      prj.projectName,
      prj.description,
      prj.technologies.length > 0 ? `Technologies: ${prj.technologies.join(', ')}` : '',
      prj.projectUrl ? `URL: ${prj.projectUrl}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    facts[metaFactId] = {
      fact_id: metaFactId,
      section: 'projects',
      parent_id: parentId,
      field: 'project_meta',
      label: 'Project Overview',
      content: metaContent,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };
    addedFactsCount += 1;

    const bulletFactIds: string[] = [];
    for (const bullet of prj.bullets) {
      const trimmed = bullet.trim();
      if (!trimmed) continue;
      const b = nextProjectBulletId(counters, parentId);
      counters = b.counters;
      bulletFactIds.push(b.id);
      facts[b.id] = {
        fact_id: b.id,
        section: 'projects',
        parent_id: parentId,
        field: 'bullet',
        label: `${prj.projectName} — Project Bullet`,
        content: trimmed,
        status: defaultStatus,
        created_at: now,
        updated_at: now,
        source,
      };
      addedFactsCount += 1;
    }

    projects.push({
      id: parentId,
      projectName: prj.projectName.trim(),
      description: prj.description.trim(),
      technologies: prj.technologies.map((t) => t.trim()).filter(Boolean),
      projectUrl: prj.projectUrl.trim(),
      metaFactId,
      bulletFactIds,
    });
  }

  // 5. Skills: case-insensitive deduplication
  const skills: Skill[] = [...existing.skills];
  const seenSkills = new Set<string>(existing.skills.map((s) => normalizeMatchKey(s.name)));

  for (const sk of extracted.skills) {
    const name = sk.name.trim();
    if (!name) continue;
    const key = normalizeMatchKey(name);
    if (seenSkills.has(key)) {
      skippedDuplicatesCount += 1;
      continue;
    }
    seenSkills.add(key);

    const category = normalizeSkillCategory(sk.category);
    const alloc = nextSkillFactId(counters);
    counters = alloc.counters;

    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'skills',
      parent_id: 'SKL',
      field: 'skill',
      label: category,
      category,
      content: name,
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    skills.push({
      id: alloc.id,
      name,
      category,
      factId: alloc.id,
    });
    addedFactsCount += 1;
  }

  // 6. Credentials (Certifications, Awards, Languages): deduplicate by category + title + issuer
  const credentials: CredentialItem[] = [...(existing.credentials ?? [])];
  const seenCredentials = new Set<string>(
    credentials.map(
      (c) =>
        `${c.category.toLowerCase()}|${normalizeMatchKey(c.title)}|${normalizeMatchKey(c.issuer)}`
    )
  );

  for (const crd of extracted.credentials ?? []) {
    const title = crd.title.trim();
    if (!title) continue;
    const category = normalizeCredentialCategory(crd.category);
    const issuer = crd.issuer.trim();
    const date = crd.date.trim();
    const detail = crd.detail.trim();
    const key = `${category.toLowerCase()}|${normalizeMatchKey(title)}|${normalizeMatchKey(issuer)}`;
    if (seenCredentials.has(key)) {
      skippedDuplicatesCount += 1;
      continue;
    }
    seenCredentials.add(key);

    const alloc = nextCredentialFactId(counters);
    counters = alloc.counters;

    facts[alloc.id] = {
      fact_id: alloc.id,
      section: 'credentials',
      parent_id: 'CRD',
      field: 'credential',
      label: category,
      content: formatCredentialFactContent({ title, issuer, date, detail }),
      status: defaultStatus,
      created_at: now,
      updated_at: now,
      source,
    };

    credentials.push({
      id: alloc.id,
      category,
      title,
      issuer,
      date,
      detail,
      factId: alloc.id,
    });
    addedFactsCount += 1;
  }

  return {
    profile: {
      ...existing,
      updatedAt: now,
      header,
      education,
      experience,
      projects,
      skills,
      credentials,
      facts,
      idCounters: counters,
    },
    addedFactsCount,
    skippedDuplicatesCount,
  };
}

export function getApprovedFactsMap(profile: MasterProfile): Record<string, CareerFact> {
  const approved: Record<string, CareerFact> = {};
  for (const [id, fact] of Object.entries(profile.facts)) {
    if (fact.status === 'APPROVED') {
      approved[id] = fact;
    }
  }
  return approved;
}

/**
 * Builds the privacy-minimized, strictly-approved evidence payload sent to Gemini.
 * - Excludes all PENDING and REJECTED facts.
 * - Strips direct personal contact details (email, phone) so unnecessary PII is never sent to Gemini.
 */
export function buildApprovedProfilePayload(profile: MasterProfile): ApprovedProfilePayload {
  const isApproved = (factId?: string): boolean => {
    if (!factId) return false;
    return profile.facts[factId]?.status === 'APPROVED';
  };

  const approvedFactIndex: ApprovedProfilePayload['approvedFactIndex'] = {};
  for (const fact of Object.values(profile.facts)) {
    if (fact.status !== 'APPROVED') continue;
    // Do not transmit personal email or phone to external AI service
    if (fact.section === 'header' && (fact.field === 'email' || fact.field === 'phone')) {
      continue;
    }
    approvedFactIndex[fact.fact_id] = {
      fact_id: fact.fact_id,
      section: fact.section,
      parent_id: fact.parent_id,
      content: fact.content,
    };
  }

  return {
    header: {
      fullName: isApproved(profile.header.factIds.fullName)
        ? profile.facts[profile.header.factIds.fullName!]?.content ?? profile.header.fullName
        : '',
      professionalTitle: isApproved(profile.header.factIds.professionalTitle)
        ? profile.facts[profile.header.factIds.professionalTitle!]?.content ?? profile.header.professionalTitle
        : '',
      location: isApproved(profile.header.factIds.location)
        ? profile.facts[profile.header.factIds.location!]?.content ?? profile.header.location
        : '',
      linkedinUrl: isApproved(profile.header.factIds.linkedinUrl)
        ? profile.facts[profile.header.factIds.linkedinUrl!]?.content ?? profile.header.linkedinUrl
        : '',
      githubUrl: isApproved(profile.header.factIds.githubUrl)
        ? profile.facts[profile.header.factIds.githubUrl!]?.content ?? profile.header.githubUrl
        : '',
      portfolioUrl: isApproved(profile.header.factIds.portfolioUrl)
        ? profile.facts[profile.header.factIds.portfolioUrl!]?.content ?? profile.header.portfolioUrl
        : '',
    },
    education: profile.education
      .map((edu) => {
        const approvedFacts = edu.factIds
          .filter((id) => isApproved(id))
          .map((id) => ({
            fact_id: id,
            label: profile.facts[id].label,
            content: profile.facts[id].content,
          }));
        if (approvedFacts.length === 0) return null;
        return {
          id: edu.id,
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.fieldOfStudy,
          startDate: edu.startDate,
          graduationDate: edu.graduationDate,
          gpa: edu.gpa,
          facts: approvedFacts,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    experience: profile.experience
      .map((exp) => {
        const metaOk = isApproved(exp.metaFactId);
        const approvedBullets = exp.bulletFactIds
          .filter((id) => isApproved(id))
          .map((id) => ({
            fact_id: id,
            content: profile.facts[id].content,
          }));
        if (!metaOk && approvedBullets.length === 0) return null;
        return {
          id: exp.id,
          company: exp.company,
          jobTitle: exp.jobTitle,
          employmentType: exp.employmentType,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          metaFactId: metaOk ? exp.metaFactId : approvedBullets[0]?.fact_id ?? exp.metaFactId,
          bullets: approvedBullets,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    projects: profile.projects
      .map((prj) => {
        const metaOk = isApproved(prj.metaFactId);
        const approvedBullets = prj.bulletFactIds
          .filter((id) => isApproved(id))
          .map((id) => ({
            fact_id: id,
            content: profile.facts[id].content,
          }));
        if (!metaOk && approvedBullets.length === 0) return null;
        return {
          id: prj.id,
          projectName: prj.projectName,
          description: prj.description,
          technologies: prj.technologies,
          projectUrl: prj.projectUrl,
          metaFactId: metaOk ? prj.metaFactId : approvedBullets[0]?.fact_id ?? prj.metaFactId,
          bullets: approvedBullets,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    skills: profile.skills
      .filter((sk) => isApproved(sk.factId))
      .map((sk) => ({
        fact_id: sk.factId,
        name: profile.facts[sk.factId]?.content ?? sk.name,
        category: profile.facts[sk.factId]?.category ?? sk.category,
      })),
    credentials: (profile.credentials ?? [])
      .filter((crd) => isApproved(crd.factId))
      .map((crd) => ({
        fact_id: crd.factId,
        category: crd.category,
        title: crd.title,
        issuer: crd.issuer,
        date: crd.date,
        detail: crd.detail,
      })),
    approvedFactIndex,
  };
}
