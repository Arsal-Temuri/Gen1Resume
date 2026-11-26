import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { AuditReport } from '../../types/audit';
import type { CareerFact } from '../../types/profile';
import type { GeneratedResume, ResumeSectionType } from '../../types/resume';
import { AuditInspector } from '../auditor/AuditInspector';
import { Button, Card, FactIdBadge, IconButton, StatusPill } from '../shared/ui';

export const AuditResumeView: React.FC<{
  resume: GeneratedResume;
  auditReport: AuditReport | null;
  factsLookup: Record<string, CareerFact>;
  isReauditing: boolean;
  onReaudit: () => void;
  onEditClaim: (bulletId: string, nextText: string) => void;
  onRevertClaim: (bulletId: string, originalText: string) => void;
  onRemoveClaim: (bulletId: string) => void;
  onToggleOverride: (bulletId: string, override: boolean) => void;
  onToggleSection: (sectionId: ResumeSectionType) => void;
  onMoveSection: (sectionId: ResumeSectionType, direction: 'up' | 'down') => void;
  onMoveExperience: (index: number, direction: 'up' | 'down') => void;
  onMoveProject: (index: number, direction: 'up' | 'down') => void;
  onMoveBullet: (
    section: 'experience' | 'projects',
    entryId: string,
    bulletIndex: number,
    direction: 'up' | 'down'
  ) => void;
  onMoveSkillGroup: (index: number, direction: 'up' | 'down') => void;
}> = ({
  resume,
  auditReport,
  factsLookup,
  isReauditing,
  onReaudit,
  onEditClaim,
  onRevertClaim,
  onRemoveClaim,
  onToggleOverride,
  onToggleSection,
  onMoveSection,
  onMoveExperience,
  onMoveProject,
  onMoveBullet,
  onMoveSkillGroup,
}) => {
  const [selectedBulletId, setSelectedBulletId] = useState<string | null>(null);
  const summary = auditReport?.summary;

  const toggleSelect = (bulletId: string) => {
    setSelectedBulletId((prev) => (prev === bulletId ? null : bulletId));
  };

  const renderClaimRow = (params: {
    bulletId: string;
    text: string;
    sourceFactIds: string[];
    moveUp?: () => void;
    moveDown?: () => void;
  }) => {
    const audit = auditReport?.resultsByBulletId[params.bulletId];
    const status = audit?.status ?? 'NEEDS_REVIEW';
    const isExpanded = selectedBulletId === params.bulletId;

    return (
      <div
        key={params.bulletId}
        data-testid={`audit-bullet-${params.bulletId}`}
        className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214] p-3 transition-colors"
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => toggleSelect(params.bulletId)}
            className="flex-1 text-left space-y-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 rounded-md"
          >
            <div className="flex items-start gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mt-0.5 text-[#71717A] shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4 mt-0.5 text-[#71717A] shrink-0" aria-hidden="true" />
              )}
              <p className="text-sm text-[#09090B] dark:text-[#FAFAFA] leading-relaxed">
                {params.text}
              </p>
            </div>

            <div className="pl-6 flex flex-wrap items-center gap-1.5">
              <StatusPill status={status} />
              {audit?.user_override && <StatusPill status="USER_OVERRIDE" />}
              {params.sourceFactIds.length > 0 ? (
                params.sourceFactIds.map((fid) => <FactIdBadge key={fid} id={fid} />)
              ) : (
                <span className="text-[11px] font-mono text-[#DC2626] dark:text-red-400">
                  NO SOURCE ID
                </span>
              )}
            </div>
          </button>

          {(params.moveUp || params.moveDown) && (
            <div className="flex flex-col gap-0.5 shrink-0">
              {params.moveUp && (
                <IconButton label={`Move ${params.bulletId} up`} size="sm" onClick={params.moveUp}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </IconButton>
              )}
              {params.moveDown && (
                <IconButton
                  label={`Move ${params.bulletId} down`}
                  size="sm"
                  onClick={params.moveDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {isExpanded && (
          <AuditInspector
            bulletId={params.bulletId}
            claimText={params.text}
            sourceFactIds={params.sourceFactIds}
            auditResult={audit}
            factsLookup={factsLookup}
            onRevertToOriginal={onRevertClaim}
            onEditText={onEditClaim}
            onRemoveBullet={(id) => {
              onRemoveClaim(id);
              setSelectedBulletId(null);
            }}
            onToggleOverride={onToggleOverride}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Audit Summary Bar */}
      <Card padding="sm" surface="secondary" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B] dark:text-[#A1A1AA]">
              <span className="font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                Independent Audit Summary
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                {summary ? `${summary.verification_score}% verified` : 'Pending audit'}
              </span>
            </div>
            {summary && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
                <span className="text-[#059669] dark:text-emerald-400">
                  {summary.verified_count} Verified
                </span>
                <span className="text-[#D97706] dark:text-amber-400">
                  {summary.paraphrased_count} Paraphrased
                </span>
                <span className="text-[#DC2626] dark:text-red-400">
                  {summary.unsupported_count} Unsupported
                </span>
                {summary.needs_review_count > 0 && (
                  <span className="text-[#09090B] dark:text-[#FAFAFA] font-medium">
                    {summary.needs_review_count} Needs Re-Audit
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant={summary && summary.needs_review_count > 0 ? 'primary' : 'secondary'}
            onClick={onReaudit}
            disabled={isReauditing}
          >
            {isReauditing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isReauditing ? 'Running Pass 2 Auditor...' : 'Re-Run Independent Audit'}
          </Button>
        </div>

        {auditReport && auditReport.validationIssues.length > 0 && (
          <div className="px-3 py-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-800/70 text-xs text-[#DC2626] dark:text-red-300 space-y-1">
            <p className="font-semibold">Application-Side Validation Alerts</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {auditReport.validationIssues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
          Click any summary sentence or bullet below to inspect its original approved source evidence, revert wording, edit, or remove.
        </p>
      </Card>

      {/* Sections in customizable order */}
      {resume.sectionOrder.map((section, sectionIndex) => {
        const isFirst = sectionIndex === 0;
        const isLast = sectionIndex === resume.sectionOrder.length - 1;

        return (
          <Card
            key={section.id}
            padding="md"
            className={!section.enabled ? 'opacity-60' : ''}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                {section.label}
                {!section.enabled && (
                  <span className="ml-2 text-xs font-normal text-[#71717A]">(Hidden from export)</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <IconButton
                  label={`Move ${section.label} section up`}
                  size="sm"
                  disabled={isFirst}
                  onClick={() => onMoveSection(section.id, 'up')}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  label={`Move ${section.label} section down`}
                  size="sm"
                  disabled={isLast}
                  onClick={() => onMoveSection(section.id, 'down')}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  label={
                    section.enabled
                      ? `Hide ${section.label} section`
                      : `Show ${section.label} section`
                  }
                  size="sm"
                  onClick={() => onToggleSection(section.id)}
                >
                  {section.enabled ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </IconButton>
              </div>
            </div>

            {section.enabled && (
              <div className="mt-3 space-y-3">
                {section.id === 'summary' && (
                  <div className="space-y-2">
                    {resume.summary_statements.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No summary statements generated.</p>
                    ) : (
                      resume.summary_statements.map((stmt) =>
                        renderClaimRow({
                          bulletId: stmt.bullet_id,
                          text: stmt.text,
                          sourceFactIds: stmt.source_fact_ids,
                        })
                      )
                    )}
                  </div>
                )}

                {section.id === 'skills' && (
                  <div className="space-y-2.5">
                    {resume.skills.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No skills included.</p>
                    ) : (
                      resume.skills.map((group, idx) => (
                        <div
                          key={`${group.category}-${idx}`}
                          className="px-3 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                              {group.category}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                              {group.items.map((item, i) => (
                                <span key={`${item.source_fact_id}-${i}`} className="inline-flex items-center gap-1">
                                  <span className="text-[#09090B] dark:text-[#FAFAFA]">{item.name}</span>
                                  <FactIdBadge id={item.source_fact_id || 'MISSING'} />
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <IconButton
                              label={`Move ${group.category} skill group up`}
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => onMoveSkillGroup(idx, 'up')}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton
                              label={`Move ${group.category} skill group down`}
                              size="sm"
                              disabled={idx === resume.skills.length - 1}
                              onClick={() => onMoveSkillGroup(idx, 'down')}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {section.id === 'experience' && (
                  <div className="space-y-4">
                    {resume.experience.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No experience entries included.</p>
                    ) : (
                      resume.experience.map((exp, expIdx) => (
                        <div key={exp.entry_id} className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                                  {exp.job_title} — {exp.company}
                                </h4>
                                <FactIdBadge id={exp.source_fact_id || exp.source_parent_id} />
                              </div>
                              <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                                {[exp.employment_type, exp.location, [exp.start_date, exp.end_date].filter(Boolean).join(' – ')]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <IconButton
                                label={`Move ${exp.company} up`}
                                size="sm"
                                disabled={expIdx === 0}
                                onClick={() => onMoveExperience(expIdx, 'up')}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton
                                label={`Move ${exp.company} down`}
                                size="sm"
                                disabled={expIdx === resume.experience.length - 1}
                                onClick={() => onMoveExperience(expIdx, 'down')}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {exp.bullets.map((b, bIdx) =>
                              renderClaimRow({
                                bulletId: b.bullet_id,
                                text: b.text,
                                sourceFactIds: b.source_fact_ids,
                                moveUp:
                                  bIdx > 0
                                    ? () => onMoveBullet('experience', exp.entry_id, bIdx, 'up')
                                    : undefined,
                                moveDown:
                                  bIdx < exp.bullets.length - 1
                                    ? () => onMoveBullet('experience', exp.entry_id, bIdx, 'down')
                                    : undefined,
                              })
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {section.id === 'projects' && (
                  <div className="space-y-4">
                    {resume.projects.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No project entries included.</p>
                    ) : (
                      resume.projects.map((prj, prjIdx) => (
                        <div key={prj.entry_id} className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                                  {prj.project_name}
                                </h4>
                                <FactIdBadge id={prj.source_fact_id || prj.source_parent_id} />
                              </div>
                              {prj.technologies.length > 0 && (
                                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                                  {prj.technologies.join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <IconButton
                                label={`Move ${prj.project_name} up`}
                                size="sm"
                                disabled={prjIdx === 0}
                                onClick={() => onMoveProject(prjIdx, 'up')}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton
                                label={`Move ${prj.project_name} down`}
                                size="sm"
                                disabled={prjIdx === resume.projects.length - 1}
                                onClick={() => onMoveProject(prjIdx, 'down')}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {prj.bullets.map((b, bIdx) =>
                              renderClaimRow({
                                bulletId: b.bullet_id,
                                text: b.text,
                                sourceFactIds: b.source_fact_ids,
                                moveUp:
                                  bIdx > 0
                                    ? () => onMoveBullet('projects', prj.entry_id, bIdx, 'up')
                                    : undefined,
                                moveDown:
                                  bIdx < prj.bullets.length - 1
                                    ? () => onMoveBullet('projects', prj.entry_id, bIdx, 'down')
                                    : undefined,
                              })
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {section.id === 'education' && (
                  <div className="space-y-3">
                    {resume.education.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No education entries included.</p>
                    ) : (
                      resume.education.map((edu) => (
                        <div key={edu.entry_id} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                              {edu.institution} — {edu.degree}
                              {edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                            </h4>
                            <FactIdBadge id={edu.source_fact_id || edu.source_parent_id} />
                          </div>
                          <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                            {[
                              [edu.start_date, edu.graduation_date].filter(Boolean).join(' – '),
                              edu.gpa ? `GPA: ${edu.gpa}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <div className="space-y-2">
                            {edu.highlights.map((hl) =>
                              renderClaimRow({
                                bulletId: hl.bullet_id,
                                text: hl.text,
                                sourceFactIds: hl.source_fact_ids,
                              })
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {section.id === 'credentials' && (
                  <div className="space-y-2">
                    {(resume.credentials ?? []).length === 0 ? (
                      <p className="text-xs text-[#71717A]">
                        No certifications, awards, or languages included.
                      </p>
                    ) : (
                      (resume.credentials ?? []).map((crd) => (
                        <div
                          key={crd.item_id}
                          className="px-3 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] flex flex-wrap items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-mono uppercase tracking-wide text-[#71717A] dark:text-[#A1A1AA]">
                                {crd.category}
                              </span>
                              <span className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA]">
                                {crd.title}
                              </span>
                              <FactIdBadge id={crd.source_fact_id || 'MISSING'} />
                            </div>
                            {(crd.issuer || crd.date || crd.detail) && (
                              <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                                {[crd.issuer, crd.date, crd.detail].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
