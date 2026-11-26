import { useCallback, useMemo, useState } from 'react';
import type {
  ApprovalStatus,
  CareerFact,
  CredentialCategory,
  FactSource,
  MasterProfile,
  ProfileHeader,
  SkillCategory,
} from '../types/profile';
import type { ExtractedResumeData } from '../types/gemini';
import {
  buildMasterProfileFromExtracted,
  createEmptyCounters,
  formatCredentialFactContent,
  mergeExtractedIntoMasterProfile,
  type MergeProfileResult,
  nextCredentialFactId,
  nextEducationEntryId,
  nextEducationFactId,
  nextExperienceBulletId,
  nextExperienceEntryId,
  nextHeaderFactId,
  nextProjectBulletId,
  nextProjectEntryId,
  nextSkillFactId,
  normalizeCredentialCategory,
  PROFILE_SCHEMA_VERSION,
  retireFactId,
} from '../utils/factIds';
import { createSampleCsGraduateProfile } from '../data/sampleProfile';
import { loadStoredProfile, saveStoredProfile } from '../services/storageService';

export interface ProfileStats {
  totalFacts: number;
  approvedFacts: number;
  pendingFacts: number;
  rejectedFacts: number;
  completionPercent: number;
  isReadyForTailoring: boolean;
}

export function useMasterProfile() {
  const initialLoad = useMemo(() => loadStoredProfile(), []);
  const [profile, setProfileState] = useState<MasterProfile | null>(initialLoad.data);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initialLoad.corrupted ? initialLoad.warning ?? 'Stored Master Profile was corrupted.' : null
  );

  const commitProfile = useCallback((next: MasterProfile | null) => {
    setProfileState(next);
    saveStoredProfile(next);
  }, []);

  const replaceFromExtracted = useCallback(
    (extracted: ExtractedResumeData, source: FactSource, isSampleData = false) => {
      const next = buildMasterProfileFromExtracted(extracted, source, {
        isSampleData,
        defaultStatus: 'PENDING',
      });
      commitProfile(next);
      setStorageWarning(null);
      return next;
    },
    [commitProfile]
  );

  const mergeFromExtracted = useCallback(
    (extracted: ExtractedResumeData, source: FactSource): MergeProfileResult => {
      if (!profile) {
        const created = buildMasterProfileFromExtracted(extracted, source, {
          isSampleData: false,
          defaultStatus: 'PENDING',
        });
        commitProfile(created);
        setStorageWarning(null);
        return {
          profile: created,
          addedFactsCount: Object.keys(created.facts).length,
          skippedDuplicatesCount: 0,
        };
      }
      const result = mergeExtractedIntoMasterProfile(profile, extracted, source, {
        defaultStatus: 'PENDING',
      });
      commitProfile(result.profile);
      setStorageWarning(null);
      return result;
    },
    [profile, commitProfile]
  );

  const loadSampleProfile = useCallback(() => {
    const sample = createSampleCsGraduateProfile();
    commitProfile(sample);
    setStorageWarning(null);
    return sample;
  }, [commitProfile]);

  const setFactStatus = useCallback(
    (factId: string, status: ApprovalStatus) => {
      setProfileState((prev) => {
        if (!prev || !prev.facts[factId]) return prev;
        const now = new Date().toISOString();
        const updated: MasterProfile = {
          ...prev,
          updatedAt: now,
          facts: {
            ...prev.facts,
            [factId]: {
              ...prev.facts[factId],
              status,
              updated_at: now,
            },
          },
        };
        saveStoredProfile(updated);
        return updated;
      });
    },
    []
  );

  const approveAllPending = useCallback(() => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const nextFacts: Record<string, CareerFact> = {};
      for (const [id, fact] of Object.entries(prev.facts)) {
        nextFacts[id] =
          fact.status === 'PENDING'
            ? { ...fact, status: 'APPROVED', updated_at: now }
            : fact;
      }
      const updated: MasterProfile = {
        ...prev,
        updatedAt: now,
        facts: nextFacts,
      };
      saveStoredProfile(updated);
      return updated;
    });
  }, []);

  /**
   * Editing a fact preserves its deterministic fact_id and forces re-approval (PENDING)
   * if it was previously APPROVED.
   */
  const editFactContent = useCallback((factId: string, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    setProfileState((prev) => {
      if (!prev || !prev.facts[factId]) return prev;
      const existing = prev.facts[factId];
      if (existing.content === trimmed) return prev;
      const now = new Date().toISOString();

      const nextStatus: ApprovalStatus =
        existing.status === 'APPROVED' ? 'PENDING' : existing.status;

      const nextHeader = { ...prev.header };
      if (existing.section === 'header' && existing.field in nextHeader) {
        (nextHeader as Record<string, unknown>)[existing.field] = trimmed;
      }

      const nextSkills = prev.skills.map((s) =>
        s.factId === factId ? { ...s, name: trimmed } : s
      );

      const nextCredentials = (prev.credentials ?? []).map((c) => {
        if (c.factId !== factId) return c;
        const parts = trimmed.split('|').map((p) => p.trim());
        if (parts.length === 1) {
          return { ...c, title: trimmed };
        }
        return {
          ...c,
          title: parts[0] || c.title,
          issuer: parts[1] ?? c.issuer,
          date: parts[2] ?? c.date,
          detail: parts[3] ?? c.detail,
        };
      });

      const updated: MasterProfile = {
        ...prev,
        updatedAt: now,
        header: nextHeader,
        skills: nextSkills,
        credentials: nextCredentials,
        facts: {
          ...prev.facts,
          [factId]: {
            ...existing,
            content: trimmed,
            status: nextStatus,
            updated_at: now,
          },
        },
      };
      saveStoredProfile(updated);
      return updated;
    });
  }, []);

  const deleteFact = useCallback((factId: string) => {
    setProfileState((prev) => {
      if (!prev || !prev.facts[factId]) return prev;
      const now = new Date().toISOString();
      const target = prev.facts[factId];
      const nextFacts = { ...prev.facts };
      delete nextFacts[factId];

      const nextCounters = retireFactId(prev.idCounters, factId);

      const nextHeader: ProfileHeader = {
        ...prev.header,
        factIds: { ...prev.header.factIds },
      };
      if (target.section === 'header') {
        const key = target.field as keyof Omit<ProfileHeader, 'factIds'>;
        if (nextHeader.factIds[key] === factId) {
          delete nextHeader.factIds[key];
          nextHeader[key] = '';
        }
      }

      const nextExperience = prev.experience.map((exp) => ({
        ...exp,
        bulletFactIds: exp.bulletFactIds.filter((id) => id !== factId),
      }));

      const nextProjects = prev.projects.map((prj) => ({
        ...prj,
        bulletFactIds: prj.bulletFactIds.filter((id) => id !== factId),
      }));

      const nextEducation = prev.education.map((edu) => ({
        ...edu,
        factIds: edu.factIds.filter((id) => id !== factId),
      }));

      const nextSkills = prev.skills.filter((sk) => sk.factId !== factId);
      const nextCredentials = (prev.credentials ?? []).filter((c) => c.factId !== factId);

      const updated: MasterProfile = {
        ...prev,
        updatedAt: now,
        header: nextHeader,
        experience: nextExperience,
        projects: nextProjects,
        education: nextEducation,
        skills: nextSkills,
        credentials: nextCredentials,
        facts: nextFacts,
        idCounters: nextCounters,
      };
      saveStoredProfile(updated);
      return updated;
    });
  }, []);

  const ensureBaseProfile = (prev: MasterProfile | null, now: string): MasterProfile => {
    if (prev) return prev;
    return {
      id: `prof_${Date.now().toString(36)}`,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      isSampleData: false,
      createdAt: now,
      updatedAt: now,
      header: {
        fullName: '',
        professionalTitle: '',
        email: '',
        phone: '',
        location: '',
        linkedinUrl: '',
        githubUrl: '',
        portfolioUrl: '',
        factIds: {},
      },
      education: [],
      experience: [],
      projects: [],
      skills: [],
      credentials: [],
      facts: {},
      idCounters: createEmptyCounters(),
    };
  };

  const upsertHeaderField = useCallback(
    (field: keyof Omit<ProfileHeader, 'factIds'>, label: string, value: string) => {
      const trimmed = value.trim();
      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        const existingFactId = base.header.factIds[field];

        if (!trimmed) {
          if (!existingFactId) return base;
          const nextFacts = { ...base.facts };
          delete nextFacts[existingFactId];
          const nextFactIds = { ...base.header.factIds };
          delete nextFactIds[field];
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            header: { ...base.header, [field]: '', factIds: nextFactIds },
            facts: nextFacts,
            idCounters: retireFactId(base.idCounters, existingFactId),
          };
          saveStoredProfile(updated);
          return updated;
        }

        if (existingFactId && base.facts[existingFactId]) {
          const oldFact = base.facts[existingFactId];
          if (oldFact.content === trimmed) return base;
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            header: { ...base.header, [field]: trimmed },
            facts: {
              ...base.facts,
              [existingFactId]: {
                ...oldFact,
                content: trimmed,
                status: oldFact.status === 'APPROVED' ? 'PENDING' : oldFact.status,
                updated_at: now,
              },
            },
          };
          saveStoredProfile(updated);
          return updated;
        }

        const alloc = nextHeaderFactId(base.idCounters);
        const updated: MasterProfile = {
          ...base,
          updatedAt: now,
          header: {
            ...base.header,
            [field]: trimmed,
            factIds: { ...base.header.factIds, [field]: alloc.id },
          },
          facts: {
            ...base.facts,
            [alloc.id]: {
              fact_id: alloc.id,
              section: 'header',
              parent_id: 'HDR',
              field,
              label,
              content: trimmed,
              status: 'PENDING',
              created_at: now,
              updated_at: now,
              source: 'manual_entry',
            },
          },
          idCounters: alloc.counters,
        };
        saveStoredProfile(updated);
        return updated;
      });
    },
    []
  );

  const addManualFact = useCallback(
    (params: {
      section: 'experience' | 'projects' | 'education' | 'skills';
      parentId?: string;
      content: string;
      category?: SkillCategory;
      label?: string;
    }) => {
      const trimmed = params.content.trim();
      if (!trimmed) return null;
      let createdId: string | null = null;

      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        let counters = base.idCounters;

        if (params.section === 'skills') {
          const alloc = nextSkillFactId(counters);
          counters = alloc.counters;
          createdId = alloc.id;
          const category = params.category ?? 'Other Technical Skills';
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            skills: [
              ...base.skills,
              { id: alloc.id, name: trimmed, category, factId: alloc.id },
            ],
            facts: {
              ...base.facts,
              [alloc.id]: {
                fact_id: alloc.id,
                section: 'skills',
                parent_id: 'SKL',
                field: 'skill',
                label: category,
                category,
                content: trimmed,
                status: 'PENDING',
                created_at: now,
                updated_at: now,
                source: 'manual_entry',
              },
            },
            idCounters: counters,
          };
          saveStoredProfile(updated);
          return updated;
        }

        if (params.section === 'experience') {
          const targetExp =
            base.experience.find((e) => e.id === params.parentId) ?? base.experience[0];
          if (!targetExp) return base;
          const alloc = nextExperienceBulletId(counters, targetExp.id);
          counters = alloc.counters;
          createdId = alloc.id;
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            experience: base.experience.map((e) =>
              e.id === targetExp.id
                ? { ...e, bulletFactIds: [...e.bulletFactIds, alloc.id] }
                : e
            ),
            facts: {
              ...base.facts,
              [alloc.id]: {
                fact_id: alloc.id,
                section: 'experience',
                parent_id: targetExp.id,
                field: 'bullet',
                label: `${targetExp.company} — Experience Bullet`,
                content: trimmed,
                status: 'PENDING',
                created_at: now,
                updated_at: now,
                source: 'manual_entry',
              },
            },
            idCounters: counters,
          };
          saveStoredProfile(updated);
          return updated;
        }

        if (params.section === 'projects') {
          const targetPrj =
            base.projects.find((p) => p.id === params.parentId) ?? base.projects[0];
          if (!targetPrj) return base;
          const alloc = nextProjectBulletId(counters, targetPrj.id);
          counters = alloc.counters;
          createdId = alloc.id;
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            projects: base.projects.map((p) =>
              p.id === targetPrj.id
                ? { ...p, bulletFactIds: [...p.bulletFactIds, alloc.id] }
                : p
            ),
            facts: {
              ...base.facts,
              [alloc.id]: {
                fact_id: alloc.id,
                section: 'projects',
                parent_id: targetPrj.id,
                field: 'bullet',
                label: `${targetPrj.projectName} — Project Bullet`,
                content: trimmed,
                status: 'PENDING',
                created_at: now,
                updated_at: now,
                source: 'manual_entry',
              },
            },
            idCounters: counters,
          };
          saveStoredProfile(updated);
          return updated;
        }

        if (params.section === 'education') {
          const targetEdu =
            base.education.find((e) => e.id === params.parentId) ?? base.education[0];
          if (!targetEdu) return base;
          const alloc = nextEducationFactId(counters, targetEdu.id);
          counters = alloc.counters;
          createdId = alloc.id;
          const updated: MasterProfile = {
            ...base,
            updatedAt: now,
            education: base.education.map((e) =>
              e.id === targetEdu.id ? { ...e, factIds: [...e.factIds, alloc.id] } : e
            ),
            facts: {
              ...base.facts,
              [alloc.id]: {
                fact_id: alloc.id,
                section: 'education',
                parent_id: targetEdu.id,
                field: 'achievement',
                label: params.label || 'Education Detail',
                content: trimmed,
                status: 'PENDING',
                created_at: now,
                updated_at: now,
                source: 'manual_entry',
              },
            },
            idCounters: counters,
          };
          saveStoredProfile(updated);
          return updated;
        }

        return base;
      });

      return createdId;
    },
    []
  );

  const addExperienceEntry = useCallback(
    (entry: {
      company: string;
      jobTitle: string;
      employmentType: string;
      location: string;
      startDate: string;
      endDate: string;
      initialBullet?: string;
    }) => {
      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        const entryAlloc = nextExperienceEntryId(base.idCounters);
        let counters = entryAlloc.counters;
        const parentId = entryAlloc.id;
        const metaFactId = `${parentId}-META`;
        const nextFacts: Record<string, CareerFact> = {
          ...base.facts,
          [metaFactId]: {
            fact_id: metaFactId,
            section: 'experience',
            parent_id: parentId,
            field: 'role_meta',
            label: 'Role & Dates',
            content: [
              `${entry.jobTitle.trim()} at ${entry.company.trim()}`,
              entry.employmentType.trim(),
              entry.location.trim(),
              [entry.startDate.trim(), entry.endDate.trim()].filter(Boolean).join(' – '),
            ]
              .filter(Boolean)
              .join(' | '),
            status: 'PENDING',
            created_at: now,
            updated_at: now,
            source: 'manual_entry',
          },
        };

        const bulletFactIds: string[] = [];
        if (entry.initialBullet?.trim()) {
          const bAlloc = nextExperienceBulletId(counters, parentId);
          counters = bAlloc.counters;
          bulletFactIds.push(bAlloc.id);
          nextFacts[bAlloc.id] = {
            fact_id: bAlloc.id,
            section: 'experience',
            parent_id: parentId,
            field: 'bullet',
            label: `${entry.company.trim()} — Experience Bullet`,
            content: entry.initialBullet.trim(),
            status: 'PENDING',
            created_at: now,
            updated_at: now,
            source: 'manual_entry',
          };
        }

        const updated: MasterProfile = {
          ...base,
          updatedAt: now,
          experience: [
            ...base.experience,
            {
              id: parentId,
              company: entry.company.trim(),
              jobTitle: entry.jobTitle.trim(),
              employmentType: entry.employmentType.trim() || 'Full-time',
              location: entry.location.trim(),
              startDate: entry.startDate.trim(),
              endDate: entry.endDate.trim(),
              metaFactId,
              bulletFactIds,
            },
          ],
          facts: nextFacts,
          idCounters: counters,
        };
        saveStoredProfile(updated);
        return updated;
      });
    },
    []
  );

  const addProjectEntry = useCallback(
    (entry: {
      projectName: string;
      description: string;
      technologies: string[];
      projectUrl: string;
      initialBullet?: string;
    }) => {
      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        const entryAlloc = nextProjectEntryId(base.idCounters);
        let counters = entryAlloc.counters;
        const parentId = entryAlloc.id;
        const metaFactId = `${parentId}-META`;
        const nextFacts: Record<string, CareerFact> = {
          ...base.facts,
          [metaFactId]: {
            fact_id: metaFactId,
            section: 'projects',
            parent_id: parentId,
            field: 'project_meta',
            label: 'Project Overview',
            content: [
              entry.projectName.trim(),
              entry.description.trim(),
              entry.technologies.length > 0 ? `Technologies: ${entry.technologies.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join(' | '),
            status: 'PENDING',
            created_at: now,
            updated_at: now,
            source: 'manual_entry',
          },
        };

        const bulletFactIds: string[] = [];
        if (entry.initialBullet?.trim()) {
          const bAlloc = nextProjectBulletId(counters, parentId);
          counters = bAlloc.counters;
          bulletFactIds.push(bAlloc.id);
          nextFacts[bAlloc.id] = {
            fact_id: bAlloc.id,
            section: 'projects',
            parent_id: parentId,
            field: 'bullet',
            label: `${entry.projectName.trim()} — Project Bullet`,
            content: entry.initialBullet.trim(),
            status: 'PENDING',
            created_at: now,
            updated_at: now,
            source: 'manual_entry',
          };
        }

        const updated: MasterProfile = {
          ...base,
          updatedAt: now,
          projects: [
            ...base.projects,
            {
              id: parentId,
              projectName: entry.projectName.trim(),
              description: entry.description.trim(),
              technologies: entry.technologies,
              projectUrl: entry.projectUrl.trim(),
              metaFactId,
              bulletFactIds,
            },
          ],
          facts: nextFacts,
          idCounters: counters,
        };
        saveStoredProfile(updated);
        return updated;
      });
    },
    []
  );

  const addEducationEntry = useCallback(
    (entry: {
      institution: string;
      degree: string;
      fieldOfStudy: string;
      startDate: string;
      graduationDate: string;
      gpa: string;
    }) => {
      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        const entryAlloc = nextEducationEntryId(base.idCounters);
        let counters = entryAlloc.counters;
        const parentId = entryAlloc.id;

        const fAlloc = nextEducationFactId(counters, parentId);
        counters = fAlloc.counters;
        const summary = [
          `${entry.degree.trim()}${entry.fieldOfStudy.trim() ? ` in ${entry.fieldOfStudy.trim()}` : ''}`,
          entry.institution.trim(),
          [entry.startDate.trim(), entry.graduationDate.trim()].filter(Boolean).join(' – '),
          entry.gpa.trim() ? `GPA: ${entry.gpa.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const updated: MasterProfile = {
          ...base,
          updatedAt: now,
          education: [
            ...base.education,
            {
              id: parentId,
              institution: entry.institution.trim(),
              degree: entry.degree.trim(),
              fieldOfStudy: entry.fieldOfStudy.trim(),
              startDate: entry.startDate.trim(),
              graduationDate: entry.graduationDate.trim(),
              gpa: entry.gpa.trim(),
              relevantCoursework: [],
              academicAchievements: [],
              factIds: [fAlloc.id],
            },
          ],
          facts: {
            ...base.facts,
            [fAlloc.id]: {
              fact_id: fAlloc.id,
              section: 'education',
              parent_id: parentId,
              field: 'degree_summary',
              label: 'Degree & Institution',
              content: summary,
              status: 'PENDING',
              created_at: now,
              updated_at: now,
              source: 'manual_entry',
            },
          },
          idCounters: counters,
        };
        saveStoredProfile(updated);
        return updated;
      });
    },
    []
  );

  const addCredentialEntry = useCallback(
    (entry: {
      category: CredentialCategory;
      title: string;
      issuer: string;
      date: string;
      detail: string;
    }): string | null => {
      const title = entry.title.trim();
      if (!title) return null;
      const category = normalizeCredentialCategory(entry.category);
      const issuer = entry.issuer.trim();
      const date = entry.date.trim();
      const detail = entry.detail.trim();
      let createdId: string | null = null;

      setProfileState((prev) => {
        const now = new Date().toISOString();
        const base = ensureBaseProfile(prev, now);
        const alloc = nextCredentialFactId(base.idCounters);
        createdId = alloc.id;

        const updated: MasterProfile = {
          ...base,
          updatedAt: now,
          credentials: [
            ...(base.credentials ?? []),
            {
              id: alloc.id,
              category,
              title,
              issuer,
              date,
              detail,
              factId: alloc.id,
            },
          ],
          facts: {
            ...base.facts,
            [alloc.id]: {
              fact_id: alloc.id,
              section: 'credentials',
              parent_id: 'CRD',
              field: 'credential',
              label: category,
              content: formatCredentialFactContent({ title, issuer, date, detail }),
              status: 'PENDING',
              created_at: now,
              updated_at: now,
              source: 'manual_entry',
            },
          },
          idCounters: alloc.counters,
        };
        saveStoredProfile(updated);
        return updated;
      });

      return createdId;
    },
    []
  );

  const stats: ProfileStats = useMemo(() => {
    if (!profile) {
      return {
        totalFacts: 0,
        approvedFacts: 0,
        pendingFacts: 0,
        rejectedFacts: 0,
        completionPercent: 0,
        isReadyForTailoring: false,
      };
    }
    const all = Object.values(profile.facts);
    const totalFacts = all.length;
    const approvedFacts = all.filter((f) => f.status === 'APPROVED').length;
    const pendingFacts = all.filter((f) => f.status === 'PENDING').length;
    const rejectedFacts = all.filter((f) => f.status === 'REJECTED').length;

    // Completion considers core section coverage + approval ratio
    const sectionsWithApproved = [
      all.some((f) => f.section === 'header' && f.status === 'APPROVED'),
      all.some((f) => f.section === 'education' && f.status === 'APPROVED'),
      all.some((f) => f.section === 'experience' && f.status === 'APPROVED'),
      all.some((f) => f.section === 'projects' && f.status === 'APPROVED'),
      all.some((f) => f.section === 'skills' && f.status === 'APPROVED'),
    ].filter(Boolean).length;

    const approvalRatio = totalFacts > 0 ? approvedFacts / (totalFacts - rejectedFacts || 1) : 0;
    const completionPercent =
      totalFacts === 0
        ? 0
        : Math.min(100, Math.round((sectionsWithApproved / 5) * 40 + approvalRatio * 60));

    return {
      totalFacts,
      approvedFacts,
      pendingFacts,
      rejectedFacts,
      completionPercent,
      isReadyForTailoring: approvedFacts > 0,
    };
  }, [profile]);

  return {
    profile,
    stats,
    storageWarning,
    clearStorageWarning: () => setStorageWarning(null),
    commitProfile,
    replaceFromExtracted,
    mergeFromExtracted,
    loadSampleProfile,
    setFactStatus,
    approveAllPending,
    editFactContent,
    deleteFact,
    upsertHeaderField,
    addManualFact,
    addExperienceEntry,
    addProjectEntry,
    addEducationEntry,
    addCredentialEntry,
  };
}
