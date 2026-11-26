import React, { useMemo, useState } from 'react';
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import type { ProfileStats } from '../hooks/useMasterProfile';
import type { ExtractedResumeData } from '../types/gemini';
import type {
  ApprovalStatus,
  CareerFact,
  CredentialCategory,
  FactSource,
  MasterProfile,
  ProfileHeader,
  ProfileSection,
  SkillCategory,
} from '../types/profile';
import { CREDENTIAL_CATEGORIES, SKILL_CATEGORIES } from '../types/profile';
import type { MergeProfileResult } from '../utils/factIds';
import { FactCard } from '../components/profile/FactCard';
import { ProfileIntakePanel } from '../components/profile/ProfileIntakePanel';
import { ConfirmDialog, Modal } from '../components/shared/Modal';
import {
  Button,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  SegmentedControl,
  Textarea,
} from '../components/shared/ui';

type StatusFilter = 'ALL' | ApprovalStatus;
type SectionFilter = 'all' | ProfileSection;

const HEADER_FIELDS: ReadonlyArray<{
  key: keyof Omit<ProfileHeader, 'factIds'>;
  label: string;
  placeholder: string;
}> = [
  { key: 'fullName', label: 'Full Name', placeholder: 'e.g. Jordan Rivera' },
  { key: 'professionalTitle', label: 'Professional Title', placeholder: 'e.g. Software Engineer' },
  { key: 'email', label: 'Email', placeholder: 'name@domain.com' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 010-2000' },
  { key: 'location', label: 'Location', placeholder: 'City, State' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
  { key: 'githubUrl', label: 'GitHub URL', placeholder: 'https://github.com/...' },
  { key: 'portfolioUrl', label: 'Portfolio URL', placeholder: 'https://...' },
];

export const MasterProfilePage: React.FC<{
  profile: MasterProfile | null;
  stats: ProfileStats;
  onReplaceFromExtracted: (data: ExtractedResumeData, source: FactSource) => void;
  onMergeFromExtracted: (data: ExtractedResumeData, source: FactSource) => MergeProfileResult;
  onLoadSample: () => void;
  onSetFactStatus: (factId: string, status: ApprovalStatus) => void;
  onApproveAllPending: () => void;
  onEditFact: (factId: string, content: string) => void;
  onDeleteFact: (factId: string) => void;
  onUpsertHeaderField: (
    field: keyof Omit<ProfileHeader, 'factIds'>,
    label: string,
    value: string
  ) => void;
  onAddManualFact: (params: {
    section: 'experience' | 'projects' | 'education' | 'skills';
    parentId?: string;
    content: string;
    category?: SkillCategory;
    label?: string;
  }) => string | null;
  onAddExperienceEntry: (entry: {
    company: string;
    jobTitle: string;
    employmentType: string;
    location: string;
    startDate: string;
    endDate: string;
    initialBullet?: string;
  }) => void;
  onAddProjectEntry: (entry: {
    projectName: string;
    description: string;
    technologies: string[];
    projectUrl: string;
    initialBullet?: string;
  }) => void;
  onAddEducationEntry: (entry: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    graduationDate: string;
    gpa: string;
  }) => void;
  onAddCredentialEntry: (entry: {
    category: CredentialCategory;
    title: string;
    issuer: string;
    date: string;
    detail: string;
  }) => string | null;
  onGoToStudio: () => void;
  onNotify: (
    title: string,
    opts?: { description?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }
  ) => void;
}> = ({
  profile,
  stats,
  onReplaceFromExtracted,
  onMergeFromExtracted,
  onLoadSample,
  onSetFactStatus,
  onApproveAllPending,
  onEditFact,
  onDeleteFact,
  onUpsertHeaderField,
  onAddManualFact,
  onAddExperienceEntry,
  onAddProjectEntry,
  onAddEducationEntry,
  onAddCredentialEntry,
  onGoToStudio,
  onNotify,
}) => {
  const [showIntake, setShowIntake] = useState(!profile);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Quick manual add states
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<SkillCategory>('Programming Languages');
  const [bulletDrafts, setBulletDrafts] = useState<Record<string, string>>({});

  // Entry creation modals
  const [addModal, setAddModal] = useState<
    'experience' | 'project' | 'education' | 'credential' | null
  >(null);
  const [expForm, setExpForm] = useState({
    company: '',
    jobTitle: '',
    employmentType: 'Full-time',
    location: '',
    startDate: '',
    endDate: '',
    initialBullet: '',
  });
  const [prjForm, setPrjForm] = useState({
    projectName: '',
    description: '',
    technologies: '',
    projectUrl: '',
    initialBullet: '',
  });
  const [eduForm, setEduForm] = useState({
    institution: '',
    degree: '',
    fieldOfStudy: '',
    startDate: '',
    graduationDate: '',
    gpa: '',
  });
  const [credForm, setCredForm] = useState<{
    category: CredentialCategory;
    title: string;
    issuer: string;
    date: string;
    detail: string;
  }>({
    category: 'Certification',
    title: '',
    issuer: '',
    date: '',
    detail: '',
  });

  const matchesFilter = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (fact: CareerFact): boolean => {
      if (statusFilter !== 'ALL' && fact.status !== statusFilter) return false;
      if (sectionFilter !== 'all' && fact.section !== sectionFilter) return false;
      if (q) {
        const hay = `${fact.fact_id} ${fact.label} ${fact.content} ${fact.category ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
  }, [searchQuery, statusFilter, sectionFilter]);

  const handleLoadSampleClick = () => {
    onLoadSample();
    setShowIntake(false);
    onNotify('Sample CS Graduate Profile loaded', {
      description: 'Marked as fictional sample data. Review and approve facts to test tailoring.',
      tone: 'success',
    });
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    const id = onAddManualFact({
      section: 'skills',
      content: newSkillName.trim(),
      category: newSkillCategory,
    });
    if (id) {
      setNewSkillName('');
      onNotify(`Added skill fact ${id}`, {
        description: 'New facts start as Pending Review until approved.',
        tone: 'neutral',
      });
    }
  };

  const handleAddChildBullet = (section: 'experience' | 'projects' | 'education', parentId: string) => {
    const text = (bulletDrafts[parentId] ?? '').trim();
    if (!text) return;
    const id = onAddManualFact({
      section,
      parentId,
      content: text,
      label: section === 'education' ? 'Academic Highlight' : undefined,
    });
    if (id) {
      setBulletDrafts((prev) => ({ ...prev, [parentId]: '' }));
      onNotify(`Added fact ${id}`, {
        description: 'Approve this fact to include it as verified evidence.',
        tone: 'neutral',
      });
    }
  };

  const handleCreateExperience = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.company.trim() || !expForm.jobTitle.trim()) return;
    onAddExperienceEntry(expForm);
    setExpForm({
      company: '',
      jobTitle: '',
      employmentType: 'Full-time',
      location: '',
      startDate: '',
      endDate: '',
      initialBullet: '',
    });
    setAddModal(null);
    onNotify('Added experience entry', { tone: 'success' });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prjForm.projectName.trim()) return;
    onAddProjectEntry({
      projectName: prjForm.projectName,
      description: prjForm.description,
      technologies: prjForm.technologies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      projectUrl: prjForm.projectUrl,
      initialBullet: prjForm.initialBullet,
    });
    setPrjForm({
      projectName: '',
      description: '',
      technologies: '',
      projectUrl: '',
      initialBullet: '',
    });
    setAddModal(null);
    onNotify('Added project entry', { tone: 'success' });
  };

  const handleCreateEducation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduForm.institution.trim() || !eduForm.degree.trim()) return;
    onAddEducationEntry(eduForm);
    setEduForm({
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      graduationDate: '',
      gpa: '',
    });
    setAddModal(null);
    onNotify('Added education entry', { tone: 'success' });
  };

  const handleCreateCredential = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credForm.title.trim()) return;
    const id = onAddCredentialEntry(credForm);
    setCredForm({
      category: 'Certification',
      title: '',
      issuer: '',
      date: '',
      detail: '',
    });
    setAddModal(null);
    onNotify(id ? `Added credential fact ${id}` : 'Added credential entry', {
      description: 'New facts start as Pending Review until approved.',
      tone: 'success',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
            Master Profile Vault
          </h1>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
            Your single source of professional truth. Only Approved facts can enter the AI tailoring pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {profile && (
            <Button
              variant="secondary"
              onClick={() => setShowIntake((v) => !v)}
              aria-expanded={showIntake}
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Import / Replace</span>
              {showIntake ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </Button>
          )}
          {profile && stats.pendingFacts > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                onApproveAllPending();
                onNotify(`Approved ${stats.pendingFacts} pending fact(s)`, {
                  tone: 'success',
                });
              }}
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              Approve All Pending ({stats.pendingFacts})
            </Button>
          )}
          {profile && stats.isReadyForTailoring && (
            <Button variant="primary" onClick={onGoToStudio}>
              Tailor Resume
            </Button>
          )}
        </div>
      </div>

      {/* Explicit Sample Data Banner */}
      {profile?.isSampleData && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] dark:bg-amber-950/50 dark:border-amber-800/70 text-xs text-[#D97706] dark:text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>Sample Profile Active:</strong> This workspace currently contains explicitly fictional CS Graduate sample data for exploring Gen1Resume. Upload your own PDF or paste your real resume text before applying to jobs.
          </p>
        </div>
      )}

      {/* Intake Panel */}
      {(!profile || showIntake) && (
        <ProfileIntakePanel
          hasExistingProfile={Boolean(profile)}
          onExtracted={(data, source, importMode) => {
            if (importMode === 'merge' && profile) {
              const merged = onMergeFromExtracted(data, source);
              if (merged.addedFactsCount === 0) {
                onNotify('No new unique facts found', {
                  description: `Skipped ${merged.skippedDuplicatesCount} duplicate item(s). Your existing approved facts were preserved.`,
                  tone: 'neutral',
                });
              } else {
                onNotify(`Merged ${merged.addedFactsCount} new pending fact(s)`, {
                  description: `Preserved existing facts${
                    merged.skippedDuplicatesCount > 0
                      ? ` and skipped ${merged.skippedDuplicatesCount} duplicate(s)`
                      : ''
                  }. Review and approve new items before tailoring.`,
                  tone: 'success',
                });
              }
            } else {
              onReplaceFromExtracted(data, source);
              onNotify(
                source === 'pdf_upload'
                  ? 'Resume PDF extracted for review'
                  : 'Resume text extracted for review',
                {
                  description:
                    'All extracted facts start as Pending Review. Approve facts before entering the tailoring pipeline.',
                  tone: 'success',
                }
              );
            }
            setShowIntake(false);
          }}
          onLoadSample={handleLoadSampleClick}
          onNotify={onNotify}
        />
      )}

      {/* Readiness Bar + Search & Filters */}
      {profile && (
        <>
          <Card padding="md" surface="secondary" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                    Profile Readiness
                  </span>
                  <span aria-hidden="true" className="text-[#71717A]">·</span>
                  <span className="font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                    {stats.approvedFacts} Approved
                  </span>
                  <span aria-hidden="true" className="text-[#71717A]">·</span>
                  <span className="font-mono tabular-nums text-[#D97706] dark:text-amber-400">
                    {stats.pendingFacts} Pending
                  </span>
                  <span aria-hidden="true" className="text-[#71717A]">·</span>
                  <span className="font-mono tabular-nums text-[#DC2626] dark:text-red-400">
                    {stats.rejectedFacts} Rejected
                  </span>
                </div>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  {stats.isReadyForTailoring
                    ? 'Ready for Tailoring Studio. Rejected and pending facts are strictly excluded from AI generation.'
                    : 'Approve facts below to unlock the Tailoring Studio.'}
                </p>
              </div>
              <span className="text-sm font-mono tabular-nums font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                {stats.completionPercent}% complete
              </span>
            </div>
            <ProgressBar percent={stats.completionPercent} label="Profile readiness percentage" />

            {/* Search & Filters */}
            <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search facts by content or ID"
                  placeholder="Search facts, skills, or fact IDs (e.g. EXP-1-B1)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-sm text-[#09090B] dark:text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <SegmentedControl<StatusFilter>
                  ariaLabel="Filter facts by approval status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'ALL', label: 'All', count: stats.totalFacts },
                    { value: 'PENDING', label: 'Pending', count: stats.pendingFacts },
                    { value: 'APPROVED', label: 'Approved', count: stats.approvedFacts },
                    { value: 'REJECTED', label: 'Rejected', count: stats.rejectedFacts },
                  ]}
                />

                <label className="sr-only" htmlFor="section-filter-select">
                  Filter by category
                </label>
                <select
                  id="section-filter-select"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
                  className="h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-xs font-medium text-[#09090B] dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                >
                  <option value="all">All Sections</option>
                  <option value="header">Header &amp; Contact</option>
                  <option value="education">Education</option>
                  <option value="experience">Experience</option>
                  <option value="projects">Projects</option>
                  <option value="skills">Technical Skills</option>
                  <option value="credentials">Certifications, Awards &amp; Languages</option>
                </select>
              </div>
            </div>
          </Card>

          {/* SECTION A: Header & Contact */}
          {(sectionFilter === 'all' || sectionFilter === 'header') && (
            <section aria-labelledby="section-header" className="space-y-3">
              <div>
                <h2
                  id="section-header"
                  className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                >
                  Header &amp; Contact
                </h2>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  Editable contact fields backed by deterministic HDR fact records. Email and phone remain local and are never sent to Gemini during tailoring.
                </p>
              </div>

              <Card padding="md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {HEADER_FIELDS.map((field) => (
                    <Input
                      key={field.key}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={profile.header[field.key]}
                      onChange={(e) => onUpsertHeaderField(field.key, field.label, e.target.value)}
                    />
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(profile.facts)
                  .filter((f) => f.section === 'header' && matchesFilter(f))
                  .map((fact) => (
                    <FactCard
                      key={fact.fact_id}
                      fact={fact}
                      onStatusChange={onSetFactStatus}
                      onEdit={onEditFact}
                      onDelete={(id) => setDeleteTargetId(id)}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* SECTION B: Experience */}
          {(sectionFilter === 'all' || sectionFilter === 'experience') && (
            <section aria-labelledby="section-experience" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="section-experience"
                    className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                  >
                    Experience
                  </h2>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Each role and bullet point has a permanent fact ID (EXP-1-B1, EXP-1-B2...).
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAddModal('experience')}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Role
                </Button>
              </div>

              {profile.experience.length === 0 ? (
                <EmptyState
                  title="No experience entries yet"
                  description="Add work experience or internships to build verified career evidence."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setAddModal('experience')}>
                      Add Experience Role
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {profile.experience.map((exp) => {
                    const entryFactIds = [exp.metaFactId, ...exp.bulletFactIds];
                    const visibleFacts = entryFactIds
                      .map((id) => profile.facts[id])
                      .filter((f): f is CareerFact => Boolean(f && matchesFilter(f)));

                    return (
                      <Card key={exp.id} padding="md" className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 border-b border-[#E4E4E7] dark:border-[#27272A]">
                          <div>
                            <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                              {exp.jobTitle} — {exp.company}
                            </h3>
                            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                              <span className="font-mono">{exp.id}</span>
                              {exp.employmentType && ` · ${exp.employmentType}`}
                              {exp.location && ` · ${exp.location}`}
                              {(exp.startDate || exp.endDate) &&
                                ` · ${[exp.startDate, exp.endDate].filter(Boolean).join(' – ')}`}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {visibleFacts.map((fact) => (
                            <FactCard
                              key={fact.fact_id}
                              fact={fact}
                              onStatusChange={onSetFactStatus}
                              onEdit={onEditFact}
                              onDelete={(id) => setDeleteTargetId(id)}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            aria-label={`Add new bullet for ${exp.company}`}
                            placeholder={`Add a verified achievement bullet for ${exp.company}...`}
                            value={bulletDrafts[exp.id] ?? ''}
                            onChange={(e) =>
                              setBulletDrafts((prev) => ({ ...prev, [exp.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChildBullet('experience', exp.id);
                              }
                            }}
                            className="flex-1 h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-sm text-[#09090B] dark:text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAddChildBullet('experience', exp.id)}
                            disabled={!(bulletDrafts[exp.id] ?? '').trim()}
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            Add Bullet
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION C: Projects */}
          {(sectionFilter === 'all' || sectionFilter === 'projects') && (
            <section aria-labelledby="section-projects" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="section-projects"
                    className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                  >
                    Projects
                  </h2>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Technical projects indexed with PRJ fact identifiers.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAddModal('project')}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Project
                </Button>
              </div>

              {profile.projects.length === 0 ? (
                <EmptyState
                  title="No projects yet"
                  description="Add technical projects with stack details and measurable outcomes."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setAddModal('project')}>
                      Add Project
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {profile.projects.map((prj) => {
                    const entryFactIds = [prj.metaFactId, ...prj.bulletFactIds];
                    const visibleFacts = entryFactIds
                      .map((id) => profile.facts[id])
                      .filter((f): f is CareerFact => Boolean(f && matchesFilter(f)));

                    return (
                      <Card key={prj.id} padding="md" className="space-y-3">
                        <div className="pb-2.5 border-b border-[#E4E4E7] dark:border-[#27272A]">
                          <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                            {prj.projectName}
                          </h3>
                          <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                            <span className="font-mono">{prj.id}</span>
                            {prj.technologies.length > 0 && ` · ${prj.technologies.join(', ')}`}
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          {visibleFacts.map((fact) => (
                            <FactCard
                              key={fact.fact_id}
                              fact={fact}
                              onStatusChange={onSetFactStatus}
                              onEdit={onEditFact}
                              onDelete={(id) => setDeleteTargetId(id)}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            aria-label={`Add new bullet for ${prj.projectName}`}
                            placeholder={`Add a verified project bullet for ${prj.projectName}...`}
                            value={bulletDrafts[prj.id] ?? ''}
                            onChange={(e) =>
                              setBulletDrafts((prev) => ({ ...prev, [prj.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChildBullet('projects', prj.id);
                              }
                            }}
                            className="flex-1 h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-sm text-[#09090B] dark:text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAddChildBullet('projects', prj.id)}
                            disabled={!(bulletDrafts[prj.id] ?? '').trim()}
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            Add Bullet
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION D: Education */}
          {(sectionFilter === 'all' || sectionFilter === 'education') && (
            <section aria-labelledby="section-education" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="section-education"
                    className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                  >
                    Education
                  </h2>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Degrees, coursework, GPA, and honors indexed with EDU fact identifiers.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAddModal('education')}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Education
                </Button>
              </div>

              {profile.education.length === 0 ? (
                <EmptyState
                  title="No education entries yet"
                  description="Add degrees, institutions, coursework, and honors."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setAddModal('education')}>
                      Add Education
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {profile.education.map((edu) => {
                    const visibleFacts = edu.factIds
                      .map((id) => profile.facts[id])
                      .filter((f): f is CareerFact => Boolean(f && matchesFilter(f)));

                    return (
                      <Card key={edu.id} padding="md" className="space-y-3">
                        <div className="pb-2.5 border-b border-[#E4E4E7] dark:border-[#27272A]">
                          <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                            {edu.institution} — {edu.degree}
                            {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}
                          </h3>
                          <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                            <span className="font-mono">{edu.id}</span>
                            {(edu.startDate || edu.graduationDate) &&
                              ` · ${[edu.startDate, edu.graduationDate].filter(Boolean).join(' – ')}`}
                            {edu.gpa && ` · GPA ${edu.gpa}`}
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          {visibleFacts.map((fact) => (
                            <FactCard
                              key={fact.fact_id}
                              fact={fact}
                              onStatusChange={onSetFactStatus}
                              onEdit={onEditFact}
                              onDelete={(id) => setDeleteTargetId(id)}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            aria-label={`Add education fact for ${edu.institution}`}
                            placeholder="Add coursework or academic achievement..."
                            value={bulletDrafts[edu.id] ?? ''}
                            onChange={(e) =>
                              setBulletDrafts((prev) => ({ ...prev, [edu.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChildBullet('education', edu.id);
                              }
                            }}
                            className="flex-1 h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-sm text-[#09090B] dark:text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAddChildBullet('education', edu.id)}
                            disabled={!(bulletDrafts[edu.id] ?? '').trim()}
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            Add Fact
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION E: Technical Skills */}
          {(sectionFilter === 'all' || sectionFilter === 'skills') && (
            <section aria-labelledby="section-skills" className="space-y-3">
              <div>
                <h2
                  id="section-skills"
                  className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                >
                  Technical Skills
                </h2>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  Each skill carries a deterministic SKL fact ID so generated skill groups remain 100% verifiable.
                </p>
              </div>

              <Card padding="md" className="space-y-5">
                <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    aria-label="New technical skill name"
                    placeholder="Add a technical skill (e.g. FastAPI, PostgreSQL, Docker)..."
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-sm text-[#09090B] dark:text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                  />
                  <label className="sr-only" htmlFor="new-skill-category">
                    Skill category
                  </label>
                  <select
                    id="new-skill-category"
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value as SkillCategory)}
                    className="h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]"
                  >
                    {SKILL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="md" variant="secondary" disabled={!newSkillName.trim()}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Skill
                  </Button>
                </form>

                <div className="space-y-4">
                  {SKILL_CATEGORIES.map((category) => {
                    const catFacts = profile.skills
                      .filter((s) => s.category === category)
                      .map((s) => profile.facts[s.factId])
                      .filter((f): f is CareerFact => Boolean(f && matchesFilter(f)));
                    if (catFacts.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <h3 className="text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
                          {category} ({catFacts.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {catFacts.map((fact) => (
                            <FactCard
                              key={fact.fact_id}
                              fact={fact}
                              onStatusChange={onSetFactStatus}
                              onEdit={onEditFact}
                              onDelete={(id) => setDeleteTargetId(id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          {/* SECTION F: Certifications, Awards & Languages */}
          {(sectionFilter === 'all' || sectionFilter === 'credentials') && (
            <section aria-labelledby="section-credentials" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="section-credentials"
                    className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]"
                  >
                    Certifications, Awards &amp; Languages
                  </h2>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Verified credentials, honors, and language proficiencies indexed with deterministic CRD fact IDs.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAddModal('credential')}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Credential
                </Button>
              </div>

              {(profile.credentials ?? []).length === 0 ? (
                <EmptyState
                  title="No certifications, awards, or languages yet"
                  description="Add professional certifications, competition awards, or spoken languages to include them as verifiable resume evidence."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setAddModal('credential')}>
                      Add Credential
                    </Button>
                  }
                />
              ) : (
                <Card padding="md" className="space-y-4">
                  {CREDENTIAL_CATEGORIES.map((category) => {
                    const catFacts = (profile.credentials ?? [])
                      .filter((c) => c.category === category)
                      .map((c) => profile.facts[c.factId])
                      .filter((f): f is CareerFact => Boolean(f && matchesFilter(f)));
                    if (catFacts.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <h3 className="text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
                          {category}s ({catFacts.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {catFacts.map((fact) => (
                            <FactCard
                              key={fact.fact_id}
                              fact={fact}
                              onStatusChange={onSetFactStatus}
                              onEdit={onEditFact}
                              onDelete={(id) => setDeleteTargetId(id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </section>
          )}
        </>
      )}

      {/* Delete Fact Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteFact(deleteTargetId);
            onNotify(`Deleted fact ${deleteTargetId}`, {
              description: 'Fact ID has been permanently retired and will never be reassigned.',
              tone: 'neutral',
            });
          }
        }}
        title={`Delete fact ${deleteTargetId ?? ''}?`}
        description="This removes the fact from your Master Profile. Its deterministic fact ID will be permanently retired and never reused for different facts."
        confirmLabel="Delete Fact"
        destructive
      />

      {/* Add Experience Modal */}
      <Modal
        open={addModal === 'experience'}
        onClose={() => setAddModal(null)}
        title="Add Experience Role"
        description="Creates a new EXP entry with deterministic fact identifiers."
      >
        <form onSubmit={handleCreateExperience} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Company"
              required
              value={expForm.company}
              onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
            />
            <Input
              label="Job Title"
              required
              value={expForm.jobTitle}
              onChange={(e) => setExpForm({ ...expForm, jobTitle: e.target.value })}
            />
            <Input
              label="Employment Type"
              value={expForm.employmentType}
              onChange={(e) => setExpForm({ ...expForm, employmentType: e.target.value })}
            />
            <Input
              label="Location"
              value={expForm.location}
              onChange={(e) => setExpForm({ ...expForm, location: e.target.value })}
            />
            <Input
              label="Start Date"
              placeholder="e.g. May 2024"
              value={expForm.startDate}
              onChange={(e) => setExpForm({ ...expForm, startDate: e.target.value })}
            />
            <Input
              label="End Date"
              placeholder="e.g. Aug 2024 or Present"
              value={expForm.endDate}
              onChange={(e) => setExpForm({ ...expForm, endDate: e.target.value })}
            />
          </div>
          <Textarea
            label="First Achievement Bullet (Optional)"
            rows={3}
            placeholder="Describe a verifiable responsibility or outcome..."
            value={expForm.initialBullet}
            onChange={(e) => setExpForm({ ...expForm, initialBullet: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Project Modal */}
      <Modal
        open={addModal === 'project'}
        onClose={() => setAddModal(null)}
        title="Add Project"
        description="Creates a new PRJ entry with deterministic fact identifiers."
      >
        <form onSubmit={handleCreateProject} className="space-y-3">
          <Input
            label="Project Name"
            required
            value={prjForm.projectName}
            onChange={(e) => setPrjForm({ ...prjForm, projectName: e.target.value })}
          />
          <Input
            label="Short Description"
            value={prjForm.description}
            onChange={(e) => setPrjForm({ ...prjForm, description: e.target.value })}
          />
          <Input
            label="Technologies (comma-separated)"
            placeholder="Python, FastAPI, PostgreSQL"
            value={prjForm.technologies}
            onChange={(e) => setPrjForm({ ...prjForm, technologies: e.target.value })}
          />
          <Input
            label="Project URL (Optional)"
            placeholder="https://github.com/..."
            value={prjForm.projectUrl}
            onChange={(e) => setPrjForm({ ...prjForm, projectUrl: e.target.value })}
          />
          <Textarea
            label="First Project Bullet (Optional)"
            rows={3}
            value={prjForm.initialBullet}
            onChange={(e) => setPrjForm({ ...prjForm, initialBullet: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Education Modal */}
      <Modal
        open={addModal === 'education'}
        onClose={() => setAddModal(null)}
        title="Add Education"
        description="Creates a new EDU entry with deterministic fact identifiers."
      >
        <form onSubmit={handleCreateEducation} className="space-y-3">
          <Input
            label="Institution"
            required
            value={eduForm.institution}
            onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Degree"
              required
              placeholder="e.g. Bachelor of Science"
              value={eduForm.degree}
              onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
            />
            <Input
              label="Field of Study"
              placeholder="e.g. Computer Science"
              value={eduForm.fieldOfStudy}
              onChange={(e) => setEduForm({ ...eduForm, fieldOfStudy: e.target.value })}
            />
            <Input
              label="Start Date"
              placeholder="e.g. Sep 2021"
              value={eduForm.startDate}
              onChange={(e) => setEduForm({ ...eduForm, startDate: e.target.value })}
            />
            <Input
              label="Graduation Date"
              placeholder="e.g. May 2025"
              value={eduForm.graduationDate}
              onChange={(e) => setEduForm({ ...eduForm, graduationDate: e.target.value })}
            />
          </div>
          <Input
            label="GPA (Optional)"
            placeholder="e.g. 3.85 / 4.00"
            value={eduForm.gpa}
            onChange={(e) => setEduForm({ ...eduForm, gpa: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Education
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Credential Modal */}
      <Modal
        open={addModal === 'credential'}
        onClose={() => setAddModal(null)}
        title="Add Certification, Award, or Language"
        description="Creates a new CRD fact record in Pending Review status."
      >
        <form onSubmit={handleCreateCredential} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="credential-category-select"
              className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]"
            >
              Category
            </label>
            <select
              id="credential-category-select"
              value={credForm.category}
              onChange={(e) =>
                setCredForm({ ...credForm, category: e.target.value as CredentialCategory })
              }
              className="w-full h-9 px-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] text-sm text-[#09090B] dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
            >
              {CREDENTIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Title / Language Name"
            required
            placeholder={
              credForm.category === 'Language'
                ? 'e.g. Spanish'
                : credForm.category === 'Award'
                  ? 'e.g. ACM Regional Hackathon 1st Place'
                  : 'e.g. AWS Certified Solutions Architect'
            }
            value={credForm.title}
            onChange={(e) => setCredForm({ ...credForm, title: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Issuer / Organization (Optional)"
              placeholder="e.g. Amazon Web Services"
              value={credForm.issuer}
              onChange={(e) => setCredForm({ ...credForm, issuer: e.target.value })}
            />
            <Input
              label="Date (Optional)"
              placeholder="e.g. Mar 2025"
              value={credForm.date}
              onChange={(e) => setCredForm({ ...credForm, date: e.target.value })}
            />
          </div>
          <Input
            label="Proficiency or Credential Detail (Optional)"
            placeholder={
              credForm.category === 'Language'
                ? 'e.g. Native / Professional working proficiency'
                : 'e.g. Credential ID or notable context'
            }
            value={credForm.detail}
            onChange={(e) => setCredForm({ ...credForm, detail: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!credForm.title.trim()}>
              Add Credential
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
