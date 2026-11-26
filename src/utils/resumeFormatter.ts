import type { AuditableClaim } from '../types/gemini';
import type { GeneratedResume } from '../types/resume';
import { escapeHtml, sanitizeFilename, stripProtocolForDisplay } from './textUtils';

export function extractAllAuditableClaims(resume: GeneratedResume): AuditableClaim[] {
  const claims: AuditableClaim[] = [];

  for (const stmt of resume.summary_statements) {
    claims.push({
      bullet_id: stmt.bullet_id,
      section: 'summary',
      context: 'Professional Summary',
      text: stmt.text,
      source_fact_ids: stmt.source_fact_ids,
    });
  }

  for (const exp of resume.experience) {
    const context = `${exp.job_title} at ${exp.company} (${exp.start_date} – ${exp.end_date})`;
    for (const b of exp.bullets) {
      claims.push({
        bullet_id: b.bullet_id,
        section: 'experience',
        context,
        text: b.text,
        source_fact_ids: b.source_fact_ids,
      });
    }
  }

  for (const prj of resume.projects) {
    const context = `Project: ${prj.project_name}`;
    for (const b of prj.bullets) {
      claims.push({
        bullet_id: b.bullet_id,
        section: 'projects',
        context,
        text: b.text,
        source_fact_ids: b.source_fact_ids,
      });
    }
  }

  for (const edu of resume.education) {
    const context = `Education: ${edu.degree} at ${edu.institution}`;
    for (const h of edu.highlights) {
      claims.push({
        bullet_id: h.bullet_id,
        section: 'education',
        context,
        text: h.text,
        source_fact_ids: h.source_fact_ids,
      });
    }
  }

  return claims;
}

export function buildExportFilename(
  resume: GeneratedResume,
  extension: 'doc' | 'docx' | 'json' | 'pdf'
): string {
  const namePart = sanitizeFilename(resume.header.full_name || 'Candidate');
  const rolePart = sanitizeFilename(resume.generation_metadata.target_role || 'Tailored');
  return `${namePart}_${rolePart}_Resume.${extension}`;
}

export function buildPdfDocumentTitle(resume: GeneratedResume): string {
  return buildExportFilename(resume, 'pdf').replace(/\.pdf$/i, '');
}

export function formatResumePlainText(resume: GeneratedResume): string {
  const lines: string[] = [];
  const h = resume.header;

  lines.push(h.full_name || 'Candidate Name');
  if (h.professional_title) {
    lines.push(h.professional_title);
  }

  const contactItems = [
    h.location,
    h.email,
    h.phone,
    h.linkedin_url ? stripProtocolForDisplay(h.linkedin_url) : '',
    h.github_url ? stripProtocolForDisplay(h.github_url) : '',
    h.portfolio_url ? stripProtocolForDisplay(h.portfolio_url) : '',
  ].filter(Boolean);

  if (contactItems.length > 0) {
    lines.push(contactItems.join(' | '));
  }

  for (const section of resume.sectionOrder) {
    if (!section.enabled) continue;

    if (section.id === 'summary' && resume.summary_statements.length > 0) {
      lines.push('');
      lines.push('PROFESSIONAL SUMMARY');
      lines.push(resume.summary_statements.map((s) => s.text.trim()).join(' '));
    }

    if (section.id === 'skills' && resume.skills.length > 0) {
      lines.push('');
      lines.push('TECHNICAL SKILLS');
      for (const group of resume.skills) {
        if (group.items.length === 0) continue;
        lines.push(`${group.category}: ${group.items.map((i) => i.name).join(', ')}`);
      }
    }

    if (section.id === 'experience' && resume.experience.length > 0) {
      lines.push('');
      lines.push('EXPERIENCE');
      for (const exp of resume.experience) {
        lines.push('');
        const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' – ');
        lines.push(`${exp.job_title} — ${exp.company}${exp.location ? ` (${exp.location})` : ''}${dates ? ` | ${dates}` : ''}`);
        for (const bullet of exp.bullets) {
          lines.push(`- ${bullet.text.trim()}`);
        }
      }
    }

    if (section.id === 'projects' && resume.projects.length > 0) {
      lines.push('');
      lines.push('PROJECTS');
      for (const prj of resume.projects) {
        lines.push('');
        const techStr = prj.technologies.length > 0 ? ` [${prj.technologies.join(', ')}]` : '';
        const urlStr = prj.project_url ? ` — ${stripProtocolForDisplay(prj.project_url)}` : '';
        lines.push(`${prj.project_name}${techStr}${urlStr}`);
        for (const bullet of prj.bullets) {
          lines.push(`- ${bullet.text.trim()}`);
        }
      }
    }

    if (section.id === 'education' && resume.education.length > 0) {
      lines.push('');
      lines.push('EDUCATION');
      for (const edu of resume.education) {
        lines.push('');
        const dates = [edu.start_date, edu.graduation_date].filter(Boolean).join(' – ');
        const degreeLine = `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''} — ${edu.institution}${dates ? ` | ${dates}` : ''}`;
        lines.push(degreeLine);
        if (edu.gpa) {
          lines.push(`GPA: ${edu.gpa}`);
        }
        for (const hl of edu.highlights) {
          lines.push(`- ${hl.text.trim()}`);
        }
      }
    }

    if (section.id === 'credentials' && (resume.credentials ?? []).length > 0) {
      lines.push('');
      lines.push((section.label || 'Certifications & Awards').toUpperCase());
      for (const crd of resume.credentials ?? []) {
        const parts = [
          crd.title.trim(),
          crd.issuer ? `— ${crd.issuer.trim()}` : '',
          crd.detail ? `(${crd.detail.trim()})` : '',
          crd.date ? `| ${crd.date.trim()}` : '',
        ].filter(Boolean);
        lines.push(`- ${parts.join(' ')}`);
      }
    }
  }

  return lines.join('\n').trim();
}

export function formatResumeWordHtml(resume: GeneratedResume): string {
  const h = resume.header;
  const contactItems = [
    h.location,
    h.email,
    h.phone,
    h.linkedin_url ? stripProtocolForDisplay(h.linkedin_url) : '',
    h.github_url ? stripProtocolForDisplay(h.github_url) : '',
    h.portfolio_url ? stripProtocolForDisplay(h.portfolio_url) : '',
  ]
    .filter(Boolean)
    .map((item) => escapeHtml(item));

  const sectionHtmlParts: string[] = [];

  for (const section of resume.sectionOrder) {
    if (!section.enabled) continue;

    if (section.id === 'summary' && resume.summary_statements.length > 0) {
      const summaryText = resume.summary_statements.map((s) => escapeHtml(s.text.trim())).join(' ');
      sectionHtmlParts.push(`
        <div class="section">
          <h2>PROFESSIONAL SUMMARY</h2>
          <p class="summary">${summaryText}</p>
        </div>
      `);
    }

    if (section.id === 'skills' && resume.skills.length > 0) {
      const rows = resume.skills
        .filter((g) => g.items.length > 0)
        .map(
          (g) =>
            `<p class="skill-row"><strong>${escapeHtml(g.category)}:</strong> ${escapeHtml(
              g.items.map((i) => i.name).join(', ')
            )}</p>`
        )
        .join('');
      if (rows) {
        sectionHtmlParts.push(`
          <div class="section">
            <h2>TECHNICAL SKILLS</h2>
            ${rows}
          </div>
        `);
      }
    }

    if (section.id === 'experience' && resume.experience.length > 0) {
      const entries = resume.experience
        .map((exp) => {
          const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' – ');
          const bullets = exp.bullets
            .map((b) => `<li>${escapeHtml(b.text.trim())}</li>`)
            .join('');
          return `
            <div class="entry">
              <table class="entry-header" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left"><strong>${escapeHtml(exp.job_title)}</strong> — ${escapeHtml(exp.company)}</td>
                  <td align="right" class="meta">${escapeHtml(dates)}</td>
                </tr>
                ${
                  exp.location || exp.employment_type
                    ? `<tr><td colspan="2" class="submeta">${escapeHtml(
                        [exp.employment_type, exp.location].filter(Boolean).join(' · ')
                      )}</td></tr>`
                    : ''
                }
              </table>
              ${bullets ? `<ul>${bullets}</ul>` : ''}
            </div>
          `;
        })
        .join('');

      sectionHtmlParts.push(`
        <div class="section">
          <h2>EXPERIENCE</h2>
          ${entries}
        </div>
      `);
    }

    if (section.id === 'projects' && resume.projects.length > 0) {
      const entries = resume.projects
        .map((prj) => {
          const bullets = prj.bullets
            .map((b) => `<li>${escapeHtml(b.text.trim())}</li>`)
            .join('');
          const metaRight = prj.project_url ? stripProtocolForDisplay(prj.project_url) : '';
          return `
            <div class="entry">
              <table class="entry-header" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left"><strong>${escapeHtml(prj.project_name)}</strong>${
                    prj.technologies.length > 0
                      ? ` <span class="submeta">(${escapeHtml(prj.technologies.join(', '))})</span>`
                      : ''
                  }</td>
                  <td align="right" class="meta">${escapeHtml(metaRight)}</td>
                </tr>
              </table>
              ${bullets ? `<ul>${bullets}</ul>` : ''}
            </div>
          `;
        })
        .join('');

      sectionHtmlParts.push(`
        <div class="section">
          <h2>PROJECTS</h2>
          ${entries}
        </div>
      `);
    }

    if (section.id === 'education' && resume.education.length > 0) {
      const entries = resume.education
        .map((edu) => {
          const dates = [edu.start_date, edu.graduation_date].filter(Boolean).join(' – ');
          const degreeTitle = `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''}`;
          const bullets = edu.highlights
            .map((hl) => `<li>${escapeHtml(hl.text.trim())}</li>`)
            .join('');
          return `
            <div class="entry">
              <table class="entry-header" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left"><strong>${escapeHtml(edu.institution)}</strong></td>
                  <td align="right" class="meta">${escapeHtml(dates)}</td>
                </tr>
                <tr>
                  <td align="left" class="submeta">${escapeHtml(degreeTitle)}</td>
                  <td align="right" class="submeta">${edu.gpa ? `GPA: ${escapeHtml(edu.gpa)}` : ''}</td>
                </tr>
              </table>
              ${bullets ? `<ul>${bullets}</ul>` : ''}
            </div>
          `;
        })
        .join('');

      sectionHtmlParts.push(`
        <div class="section">
          <h2>EDUCATION</h2>
          ${entries}
        </div>
      `);
    }

    if (section.id === 'credentials' && (resume.credentials ?? []).length > 0) {
      const rows = (resume.credentials ?? [])
        .map((crd) => {
          const right = crd.date ? escapeHtml(crd.date) : '';
          const issuerPart = crd.issuer ? ` — ${escapeHtml(crd.issuer)}` : '';
          const detailPart = crd.detail
            ? ` <span class="submeta">(${escapeHtml(crd.detail)})</span>`
            : '';
          return `
            <table class="entry-header" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left"><strong>${escapeHtml(crd.title)}</strong>${issuerPart}${detailPart}</td>
                <td align="right" class="meta">${right}</td>
              </tr>
            </table>
          `;
        })
        .join('');

      sectionHtmlParts.push(`
        <div class="section">
          <h2>${escapeHtml((section.label || 'Certifications & Awards').toUpperCase())}</h2>
          ${rows}
        </div>
      `);
    }
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(h.full_name || 'Resume')}</title>
  <style>
    @page { margin: 0.6in; }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      line-height: 1.38;
      color: #111111;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18pt;
      margin: 0 0 2pt 0;
      font-weight: 700;
      color: #000000;
    }
    .title {
      font-size: 11pt;
      color: #333333;
      margin: 0 0 4pt 0;
    }
    .contact {
      font-size: 9.5pt;
      color: #333333;
      margin: 0 0 12pt 0;
    }
    .section {
      margin-top: 10pt;
    }
    h2 {
      font-size: 10.5pt;
      font-weight: 700;
      letter-spacing: 0.5pt;
      border-bottom: 1pt solid #222222;
      padding-bottom: 2pt;
      margin: 0 0 6pt 0;
      color: #000000;
    }
    .summary {
      margin: 0 0 4pt 0;
    }
    .skill-row {
      margin: 0 0 3pt 0;
    }
    .entry {
      margin-bottom: 8pt;
    }
    .entry-header {
      border-collapse: collapse;
      margin-bottom: 2pt;
    }
    .meta {
      font-size: 9.5pt;
      color: #333333;
    }
    .submeta {
      font-size: 9.5pt;
      color: #444444;
    }
    ul {
      margin: 3pt 0 0 16pt;
      padding: 0;
    }
    li {
      margin-bottom: 2.5pt;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(h.full_name || 'Candidate Name')}</h1>
  ${h.professional_title ? `<p class="title">${escapeHtml(h.professional_title)}</p>` : ''}
  ${contactItems.length > 0 ? `<p class="contact">${contactItems.join(' &nbsp;|&nbsp; ')}</p>` : ''}
  ${sectionHtmlParts.join('\n')}
</body>
</html>`;
}
