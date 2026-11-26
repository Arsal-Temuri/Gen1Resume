import React from 'react';
import type { GeneratedResume } from '../../types/resume';
import { sanitizeUrl, stripProtocolForDisplay } from '../../utils/textUtils';

const SafeLink: React.FC<{ url: string }> = ({ url }) => {
  const safe = sanitizeUrl(url);
  const label = stripProtocolForDisplay(url);
  if (!safe) {
    return <span>{label}</span>;
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline text-inherit"
    >
      {label}
    </a>
  );
};

export const CleanAtsPreview: React.FC<{
  resume: GeneratedResume;
  className?: string;
  isPrintClone?: boolean;
}> = ({ resume, className = '', isPrintClone = false }) => {
  const h = resume.header;

  const contactNodes: React.ReactNode[] = [];
  if (h.location) contactNodes.push(<span key="loc">{h.location}</span>);
  if (h.email) contactNodes.push(<span key="email">{h.email}</span>);
  if (h.phone) contactNodes.push(<span key="phone">{h.phone}</span>);
  if (h.linkedin_url) contactNodes.push(<SafeLink key="li" url={h.linkedin_url} />);
  if (h.github_url) contactNodes.push(<SafeLink key="gh" url={h.github_url} />);
  if (h.portfolio_url) contactNodes.push(<SafeLink key="pf" url={h.portfolio_url} />);

  const Container = isPrintClone ? 'div' : 'article';

  return (
    <Container
      aria-label={isPrintClone ? undefined : 'Clean ATS Resume Preview'}
      className={`ats-resume-sheet bg-white text-[#09090B] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl p-6 sm:p-10 shadow-xs leading-[1.45] select-text ${className}`}
    >
      {/* Header */}
      <header className="ats-resume-header pb-4 border-b border-zinc-300">
        <h1 className="text-2xl font-bold tracking-tight text-black">
          {h.full_name || 'Candidate Name'}
        </h1>
        {h.professional_title && (
          <p className="ats-resume-title mt-0.5 text-sm font-medium text-zinc-700">
            {h.professional_title}
          </p>
        )}
        {contactNodes.length > 0 && (
          <div className="ats-resume-contact mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-700">
            {contactNodes.map((node, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span aria-hidden="true" className="text-zinc-400">
                    |
                  </span>
                )}
                {node}
              </React.Fragment>
            ))}
          </div>
        )}
      </header>

      {/* Body Sections */}
      <div className="ats-resume-body mt-5 space-y-5">
        {resume.sectionOrder.map((section) => {
          if (!section.enabled) return null;

          if (section.id === 'summary' && resume.summary_statements.length > 0) {
            return (
              <section key="summary" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2">
                  Professional Summary
                </h2>
                <p className="text-[13px] text-zinc-900 leading-relaxed">
                  {resume.summary_statements.map((s) => s.text.trim()).join(' ')}
                </p>
              </section>
            );
          }

          if (section.id === 'skills' && resume.skills.length > 0) {
            const populatedGroups = resume.skills.filter((g) => g.items.length > 0);
            if (populatedGroups.length === 0) return null;
            return (
              <section key="skills" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2">
                  Technical Skills
                </h2>
                <div className="space-y-1 text-[13px] text-zinc-900">
                  {populatedGroups.map((group, idx) => (
                    <p key={`${group.category}-${idx}`}>
                      <span className="font-semibold text-black">{group.category}: </span>
                      <span>{group.items.map((item) => item.name).join(', ')}</span>
                    </p>
                  ))}
                </div>
              </section>
            );
          }

          if (section.id === 'experience' && resume.experience.length > 0) {
            return (
              <section key="experience" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2.5">
                  Experience
                </h2>
                <div className="space-y-4">
                  {resume.experience.map((exp) => {
                    const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' – ');
                    return (
                      <div key={exp.entry_id} className="ats-resume-entry">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <h3 className="text-[13.5px] font-semibold text-black">
                            {exp.job_title}
                            {exp.company && (
                              <span className="font-normal text-zinc-800"> — {exp.company}</span>
                            )}
                          </h3>
                          {dates && (
                            <span className="text-xs text-zinc-700 tabular-nums shrink-0">
                              {dates}
                            </span>
                          )}
                        </div>
                        {(exp.employment_type || exp.location) && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {[exp.employment_type, exp.location].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {exp.bullets.length > 0 && (
                          <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[13px] text-zinc-900">
                            {exp.bullets.map((b) => (
                              <li key={b.bullet_id} className="ats-resume-bullet leading-snug">
                                {b.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (section.id === 'projects' && resume.projects.length > 0) {
            return (
              <section key="projects" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2.5">
                  Projects
                </h2>
                <div className="space-y-3.5">
                  {resume.projects.map((prj) => (
                    <div key={prj.entry_id} className="ats-resume-entry">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <h3 className="text-[13.5px] font-semibold text-black">
                          {prj.project_name}
                          {prj.technologies.length > 0 && (
                            <span className="font-normal text-xs text-zinc-600">
                              {' '}
                              ({prj.technologies.join(', ')})
                            </span>
                          )}
                        </h3>
                        {prj.project_url && (
                          <span className="text-xs text-zinc-700 shrink-0">
                            <SafeLink url={prj.project_url} />
                          </span>
                        )}
                      </div>
                      {prj.bullets.length > 0 && (
                        <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[13px] text-zinc-900">
                          {prj.bullets.map((b) => (
                            <li key={b.bullet_id} className="ats-resume-bullet leading-snug">
                              {b.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (section.id === 'education' && resume.education.length > 0) {
            return (
              <section key="education" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2.5">
                  Education
                </h2>
                <div className="space-y-3">
                  {resume.education.map((edu) => {
                    const dates = [edu.start_date, edu.graduation_date].filter(Boolean).join(' – ');
                    return (
                      <div key={edu.entry_id} className="ats-resume-entry">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <h3 className="text-[13.5px] font-semibold text-black">
                            {edu.institution}
                          </h3>
                          {dates && (
                            <span className="text-xs text-zinc-700 tabular-nums shrink-0">
                              {dates}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-zinc-700 mt-0.5">
                          <span>
                            {edu.degree}
                            {edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                          </span>
                          {edu.gpa && <span className="tabular-nums">GPA: {edu.gpa}</span>}
                        </div>
                        {edu.highlights.length > 0 && (
                          <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[13px] text-zinc-900">
                            {edu.highlights.map((hl) => (
                              <li key={hl.bullet_id} className="ats-resume-bullet leading-snug">
                                {hl.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (section.id === 'credentials' && (resume.credentials ?? []).length > 0) {
            return (
              <section key="credentials" className="ats-resume-section">
                <h2 className="ats-resume-heading text-xs font-bold tracking-[0.08em] uppercase text-black border-b border-zinc-800 pb-1 mb-2">
                  {section.label || 'Certifications & Awards'}
                </h2>
                <div className="space-y-1.5 text-[13px] text-zinc-900">
                  {(resume.credentials ?? []).map((crd) => (
                    <div
                      key={crd.item_id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4"
                    >
                      <p>
                        <span className="font-semibold text-black">{crd.title}</span>
                        {crd.issuer && (
                          <span className="text-zinc-800"> — {crd.issuer}</span>
                        )}
                        {crd.detail && (
                          <span className="text-zinc-700"> ({crd.detail})</span>
                        )}
                      </p>
                      {crd.date && (
                        <span className="text-xs text-zinc-700 tabular-nums shrink-0">
                          {crd.date}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          return null;
        })}
      </div>
    </Container>
  );
};
