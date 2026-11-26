import { jsPDF } from 'jspdf';
import type { GeneratedResume } from '../types/resume';
import { buildExportFilename, buildPdfDocumentTitle } from './resumeFormatter';
import { sanitizeUrl, stripProtocolForDisplay } from './textUtils';

export const US_LETTER_WIDTH_PT = 612;
export const US_LETTER_HEIGHT_PT = 792;

export interface PdfLayoutPreset {
  name: string;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  nameSize: number;
  titleSize: number;
  contactSize: number;
  headingSize: number;
  entryTitleSize: number;
  submetaSize: number;
  bodySize: number;
  lineHeight: number;
  headerBottomGap: number;
  sectionGap: number;
  headingBottomGap: number;
  entryGap: number;
  bulletGap: number;
  bulletIndent: number;
}

export const PDF_LAYOUT_PRESETS: ReadonlyArray<PdfLayoutPreset> = [
  {
    name: 'spacious',
    marginX: 40,
    marginTop: 36,
    marginBottom: 34,
    nameSize: 18,
    titleSize: 10.5,
    contactSize: 9,
    headingSize: 9.5,
    entryTitleSize: 10,
    submetaSize: 8.75,
    bodySize: 9.75,
    lineHeight: 1.32,
    headerBottomGap: 10,
    sectionGap: 11,
    headingBottomGap: 5,
    entryGap: 7.5,
    bulletGap: 2.5,
    bulletIndent: 11,
  },
  {
    name: 'standard',
    marginX: 38,
    marginTop: 32,
    marginBottom: 30,
    nameSize: 17,
    titleSize: 10,
    contactSize: 8.75,
    headingSize: 9.25,
    entryTitleSize: 9.6,
    submetaSize: 8.5,
    bodySize: 9.25,
    lineHeight: 1.28,
    headerBottomGap: 9,
    sectionGap: 9.5,
    headingBottomGap: 4.5,
    entryGap: 6.5,
    bulletGap: 2,
    bulletIndent: 10.5,
  },
  {
    name: 'balanced',
    marginX: 36,
    marginTop: 28,
    marginBottom: 26,
    nameSize: 16,
    titleSize: 9.5,
    contactSize: 8.5,
    headingSize: 9,
    entryTitleSize: 9.25,
    submetaSize: 8.25,
    bodySize: 8.85,
    lineHeight: 1.25,
    headerBottomGap: 8,
    sectionGap: 8,
    headingBottomGap: 4,
    entryGap: 5.5,
    bulletGap: 1.75,
    bulletIndent: 10,
  },
  {
    name: 'compact',
    marginX: 34,
    marginTop: 25,
    marginBottom: 24,
    nameSize: 15,
    titleSize: 9.25,
    contactSize: 8.25,
    headingSize: 8.75,
    entryTitleSize: 9,
    submetaSize: 8,
    bodySize: 8.45,
    lineHeight: 1.22,
    headerBottomGap: 7,
    sectionGap: 7,
    headingBottomGap: 3.5,
    entryGap: 4.75,
    bulletGap: 1.5,
    bulletIndent: 9.5,
  },
  {
    name: 'tight',
    marginX: 31,
    marginTop: 22,
    marginBottom: 21,
    nameSize: 14.5,
    titleSize: 8.75,
    contactSize: 8,
    headingSize: 8.5,
    entryTitleSize: 8.6,
    submetaSize: 7.75,
    bodySize: 8.05,
    lineHeight: 1.18,
    headerBottomGap: 6,
    sectionGap: 6,
    headingBottomGap: 3,
    entryGap: 4,
    bulletGap: 1.2,
    bulletIndent: 9,
  },
  {
    name: 'dense',
    marginX: 28,
    marginTop: 20,
    marginBottom: 19,
    nameSize: 13.75,
    titleSize: 8.5,
    contactSize: 7.75,
    headingSize: 8.1,
    entryTitleSize: 8.25,
    submetaSize: 7.5,
    bodySize: 7.65,
    lineHeight: 1.15,
    headerBottomGap: 5.5,
    sectionGap: 5,
    headingBottomGap: 2.75,
    entryGap: 3.5,
    bulletGap: 1,
    bulletIndent: 8.5,
  },
  {
    name: 'ultra-dense',
    marginX: 26,
    marginTop: 18,
    marginBottom: 17,
    nameSize: 13,
    titleSize: 8,
    contactSize: 7.5,
    headingSize: 7.8,
    entryTitleSize: 7.9,
    submetaSize: 7.25,
    bodySize: 7.25,
    lineHeight: 1.12,
    headerBottomGap: 5,
    sectionGap: 4.25,
    headingBottomGap: 2.5,
    entryGap: 3,
    bulletGap: 0.75,
    bulletIndent: 8,
  },
];

/**
 * Normalizes resume strings into WinAnsi-safe text for standard PDF Helvetica fonts,
 * avoiding mojibake while keeping ATS parsers 100% clean.
 */
export function normalizePdfText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2248/g, '~')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2212/g, '-')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2013/g, '-')
    .replace(/\u00B7/g, ' | ')
    .replace(/\u2022/g, '-')
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GeneratedPdfResumeResult {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  filename: string;
  pageCount: number;
  presetName: string;
  fittedWithinOnePage: boolean;
  truncatedToFit: boolean;
}

interface LayoutPassResult {
  finalY: number;
  fits: boolean;
  truncated: boolean;
}

interface ContactSegment {
  label: string;
  href?: string;
}

function createDoc(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });
}

function buildContactSegments(resume: GeneratedResume): ContactSegment[] {
  const h = resume.header;
  const segments: ContactSegment[] = [];

  if (h.location?.trim()) {
    segments.push({ label: normalizePdfText(h.location) });
  }
  if (h.email?.trim()) {
    const cleanEmail = normalizePdfText(h.email);
    segments.push({ label: cleanEmail, href: `mailto:${cleanEmail}` });
  }
  if (h.phone?.trim()) {
    segments.push({ label: normalizePdfText(h.phone) });
  }
  if (h.linkedin_url?.trim()) {
    const safe = sanitizeUrl(h.linkedin_url);
    segments.push({
      label: normalizePdfText(stripProtocolForDisplay(h.linkedin_url)),
      href: safe ?? undefined,
    });
  }
  if (h.github_url?.trim()) {
    const safe = sanitizeUrl(h.github_url);
    segments.push({
      label: normalizePdfText(stripProtocolForDisplay(h.github_url)),
      href: safe ?? undefined,
    });
  }
  if (h.portfolio_url?.trim()) {
    const safe = sanitizeUrl(h.portfolio_url);
    segments.push({
      label: normalizePdfText(stripProtocolForDisplay(h.portfolio_url)),
      href: safe ?? undefined,
    });
  }

  return segments.filter((seg) => Boolean(seg.label));
}

/**
 * Unified measurement and rendering pass on a single US Letter page.
 * When `dryRun` is true, measures exact height without writing to the PDF stream.
 * When `enforceOnePageClip` is true, cleanly stops emitting overflow items so a
 * second page is NEVER created even for extraordinarily long resumes.
 */
function layoutResumeOnSinglePage(
  doc: jsPDF,
  resume: GeneratedResume,
  preset: PdfLayoutPreset,
  options: { dryRun: boolean; enforceOnePageClip: boolean }
): LayoutPassResult {
  const { dryRun, enforceOnePageClip } = options;
  const contentWidth = US_LETTER_WIDTH_PT - preset.marginX * 2;
  const maxY = US_LETTER_HEIGHT_PT - preset.marginBottom;
  let y = preset.marginTop;
  let truncated = false;

  const setFont = (style: 'normal' | 'bold' | 'italic', size: number, gray = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    if (!dryRun) {
      doc.setTextColor(gray, gray, gray);
    }
  };

  const lineAdvance = (fontSize: number) => fontSize * preset.lineHeight;

  const canFitHeight = (neededHeight: number): boolean => {
    if (!enforceOnePageClip) return true;
    return y + neededHeight <= maxY + 0.5;
  };

  // --- HEADER ---
  const fullName = normalizePdfText(resume.header.full_name || 'Candidate Name');
  setFont('bold', preset.nameSize, 0);
  const nameLines = doc.splitTextToSize(fullName, contentWidth) as string[];
  const nameLineH = preset.nameSize * 1.15;
  for (const line of nameLines) {
    if (!dryRun) {
      doc.text(line, preset.marginX, y + preset.nameSize * 0.82);
    }
    y += nameLineH;
  }

  if (resume.header.professional_title?.trim()) {
    const profTitle = normalizePdfText(resume.header.professional_title);
    setFont('normal', preset.titleSize, 45);
    const titleLines = doc.splitTextToSize(profTitle, contentWidth) as string[];
    const titleLineH = lineAdvance(preset.titleSize);
    y += 1.5;
    for (const line of titleLines) {
      if (!dryRun) {
        doc.text(line, preset.marginX, y + preset.titleSize * 0.8);
      }
      y += titleLineH;
    }
  }

  const contacts = buildContactSegments(resume);
  if (contacts.length > 0) {
    setFont('normal', preset.contactSize, 55);
    const contactLineH = lineAdvance(preset.contactSize);
    const sepText = '  |  ';
    const sepWidth = doc.getTextWidth(sepText);
    y += 2;

    let cursorX = preset.marginX;
    let lineStart = true;

    for (let i = 0; i < contacts.length; i++) {
      const seg = contacts[i];
      const segW = doc.getTextWidth(seg.label);
      const neededW = lineStart ? segW : sepWidth + segW;

      if (!lineStart && cursorX + neededW > preset.marginX + contentWidth + 0.5) {
        y += contactLineH;
        cursorX = preset.marginX;
        lineStart = true;
      }

      if (!lineStart) {
        if (!dryRun) {
          doc.setTextColor(130, 130, 130);
          doc.text(sepText, cursorX, y + preset.contactSize * 0.8);
          doc.setTextColor(55, 55, 55);
        }
        cursorX += sepWidth;
      }

      if (!dryRun) {
        doc.text(seg.label, cursorX, y + preset.contactSize * 0.8);
        if (seg.href) {
          doc.link(cursorX, y, segW, contactLineH, { url: seg.href });
        }
      }
      cursorX += segW;
      lineStart = false;
    }
    y += contactLineH;
  }

  // Header bottom divider rule
  y += 4;
  if (!dryRun) {
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.8);
    doc.line(preset.marginX, y, US_LETTER_WIDTH_PT - preset.marginX, y);
  }
  y += preset.headerBottomGap;

  // --- HELPER: SECTION HEADING ---
  const drawSectionHeading = (label: string, isFirstSection: boolean): boolean => {
    const topGap = isFirstSection ? 0 : preset.sectionGap;
    const headingBlockH = topGap + preset.headingSize * 1.15 + 3 + preset.headingBottomGap;
    // Require enough room for heading + at least 1 line of content below it
    if (!canFitHeight(headingBlockH + lineAdvance(preset.bodySize))) {
      truncated = true;
      return false;
    }

    y += topGap;
    setFont('bold', preset.headingSize, 0);
    if (!dryRun) {
      doc.text(label.toUpperCase(), preset.marginX, y + preset.headingSize * 0.82);
    }
    y += preset.headingSize * 1.15 + 2;
    if (!dryRun) {
      doc.setDrawColor(35, 35, 35);
      doc.setLineWidth(0.55);
      doc.line(preset.marginX, y, US_LETTER_WIDTH_PT - preset.marginX, y);
    }
    y += preset.headingBottomGap;
    return true;
  };

  // --- HELPER: HANGING-INDENT BULLETS ---
  const drawBullets = (bullets: ReadonlyArray<{ text: string }>): void => {
    setFont('normal', preset.bodySize, 15);
    const bodyLineH = lineAdvance(preset.bodySize);
    const bulletTextWidth = contentWidth - preset.bulletIndent;

    for (let i = 0; i < bullets.length; i++) {
      const text = normalizePdfText(bullets[i].text);
      if (!text) continue;
      const lines = doc.splitTextToSize(text, bulletTextWidth) as string[];
      const blockH = lines.length * bodyLineH + (i > 0 ? preset.bulletGap : 0);

      if (!canFitHeight(blockH)) {
        truncated = true;
        break;
      }

      if (i > 0) y += preset.bulletGap;
      if (!dryRun) {
        // Draw crisp vector dot bullet for universal font-independent rendering
        const dotX = preset.marginX + 3.5;
        const dotY = y + preset.bodySize * 0.48;
        doc.setFillColor(20, 20, 20);
        doc.circle(dotX, dotY, Math.max(1.1, preset.bodySize * 0.14), 'F');
      }

      for (const line of lines) {
        if (!dryRun) {
          doc.text(line, preset.marginX + preset.bulletIndent, y + preset.bodySize * 0.8);
        }
        y += bodyLineH;
      }
    }
  };

  // --- HELPER: LEFT + RIGHT ALIGNED HEADER ROW ---
  const drawTwoPartRow = (params: {
    boldLeft: string;
    normalLeft?: string;
    rightText?: string;
    rightHref?: string;
    fontSize: number;
    leftGray?: number;
    rightGray?: number;
  }): boolean => {
    const {
      boldLeft,
      normalLeft = '',
      rightText = '',
      rightHref,
      fontSize,
      leftGray = 0,
      rightGray = 65,
    } = params;

    const rowLineH = lineAdvance(fontSize);
    let rightWidth = 0;
    if (rightText) {
      setFont('normal', Math.max(fontSize - 0.75, 7), rightGray);
      rightWidth = doc.getTextWidth(rightText);
    }

    const maxLeftWidth = rightText
      ? Math.max(contentWidth * 0.5, contentWidth - rightWidth - 10)
      : contentWidth;

    const combinedLeft = normalLeft ? `${boldLeft}${normalLeft}` : boldLeft;
    setFont('bold', fontSize, leftGray);
    const boldWidth = doc.getTextWidth(boldLeft);
    setFont('normal', fontSize, 40);
    const normalWidth = normalLeft ? doc.getTextWidth(normalLeft) : 0;

    if (boldWidth + normalWidth <= maxLeftWidth) {
      if (!canFitHeight(rowLineH)) {
        truncated = true;
        return false;
      }
      if (!dryRun) {
        setFont('bold', fontSize, leftGray);
        doc.text(boldLeft, preset.marginX, y + fontSize * 0.8);
        if (normalLeft) {
          setFont('normal', fontSize, 45);
          doc.text(normalLeft, preset.marginX + boldWidth, y + fontSize * 0.8);
        }
        if (rightText) {
          const rightSize = Math.max(fontSize - 0.75, 7);
          setFont('normal', rightSize, rightGray);
          const rightX = US_LETTER_WIDTH_PT - preset.marginX - rightWidth;
          doc.text(rightText, rightX, y + fontSize * 0.8);
          if (rightHref) {
            doc.link(rightX, y, rightWidth, rowLineH, { url: rightHref });
          }
        }
      }
      y += rowLineH;
      return true;
    }

    // Wrap cleanly when the left title + company/tech is long
    setFont('bold', fontSize, leftGray);
    const wrappedLeft = doc.splitTextToSize(combinedLeft, maxLeftWidth) as string[];
    const totalH = wrappedLeft.length * rowLineH;
    if (!canFitHeight(totalH)) {
      truncated = true;
      return false;
    }

    if (!dryRun && rightText) {
      const rightSize = Math.max(fontSize - 0.75, 7);
      setFont('normal', rightSize, rightGray);
      const rightX = US_LETTER_WIDTH_PT - preset.marginX - rightWidth;
      doc.text(rightText, rightX, y + fontSize * 0.8);
      if (rightHref) {
        doc.link(rightX, y, rightWidth, rowLineH, { url: rightHref });
      }
    }

    setFont('bold', fontSize, leftGray);
    for (const line of wrappedLeft) {
      if (!dryRun) {
        doc.text(line, preset.marginX, y + fontSize * 0.8);
      }
      y += rowLineH;
    }
    return true;
  };

  // --- BODY SECTIONS ---
  let renderedSections = 0;

  for (const section of resume.sectionOrder) {
    if (!section.enabled) continue;

    if (section.id === 'summary' && resume.summary_statements.length > 0) {
      const summaryText = normalizePdfText(
        resume.summary_statements.map((s) => s.text.trim()).join(' ')
      );
      if (!summaryText) continue;
      if (!drawSectionHeading('Professional Summary', renderedSections === 0)) break;
      renderedSections++;

      setFont('normal', preset.bodySize, 15);
      const bodyLineH = lineAdvance(preset.bodySize);
      const lines = doc.splitTextToSize(summaryText, contentWidth) as string[];
      for (const line of lines) {
        if (!canFitHeight(bodyLineH)) {
          truncated = true;
          break;
        }
        if (!dryRun) {
          doc.text(line, preset.marginX, y + preset.bodySize * 0.8);
        }
        y += bodyLineH;
      }
    }

    if (section.id === 'skills' && resume.skills.length > 0) {
      const populatedGroups = resume.skills.filter((g) => g.items.length > 0);
      if (populatedGroups.length === 0) continue;
      if (!drawSectionHeading('Technical Skills', renderedSections === 0)) break;
      renderedSections++;

      const bodyLineH = lineAdvance(preset.bodySize);
      for (let idx = 0; idx < populatedGroups.length; idx++) {
        const group = populatedGroups[idx];
        const categoryLabel = `${normalizePdfText(String(group.category))}: `;
        const skillsText = normalizePdfText(group.items.map((item) => item.name).join(', '));

        setFont('bold', preset.bodySize, 0);
        const labelW = doc.getTextWidth(categoryLabel) + 2;
        setFont('normal', preset.bodySize, 15);
        const firstLineAvail = Math.max(60, contentWidth - labelW);
        const firstLineCandidates = doc.splitTextToSize(skillsText, firstLineAvail) as string[];
        const firstLineText = firstLineCandidates[0] ?? '';

        let remainderLines: string[] = [];
        if (firstLineCandidates.length > 1) {
          const remainderText = skillsText.slice(firstLineText.length).trim();
          if (remainderText) {
            remainderLines = doc.splitTextToSize(remainderText, contentWidth) as string[];
          }
        }

        const totalLines = 1 + remainderLines.length;
        const neededH = totalLines * bodyLineH + (idx > 0 ? preset.bulletGap : 0);
        if (!canFitHeight(neededH)) {
          truncated = true;
          break;
        }

        if (idx > 0) y += preset.bulletGap;
        if (!dryRun) {
          setFont('bold', preset.bodySize, 0);
          doc.text(categoryLabel, preset.marginX, y + preset.bodySize * 0.8);
          setFont('normal', preset.bodySize, 15);
          doc.text(firstLineText, preset.marginX + labelW, y + preset.bodySize * 0.8);
        }
        y += bodyLineH;

        for (const remLine of remainderLines) {
          if (!dryRun) {
            setFont('normal', preset.bodySize, 15);
            doc.text(remLine, preset.marginX, y + preset.bodySize * 0.8);
          }
          y += bodyLineH;
        }
      }
    }

    if (section.id === 'experience' && resume.experience.length > 0) {
      if (!drawSectionHeading('Experience', renderedSections === 0)) break;
      renderedSections++;

      for (let i = 0; i < resume.experience.length; i++) {
        const exp = resume.experience[i];
        if (i > 0) {
          if (!canFitHeight(preset.entryGap + lineAdvance(preset.entryTitleSize))) {
            truncated = true;
            break;
          }
          y += preset.entryGap;
        }

        const dates = normalizePdfText([exp.start_date, exp.end_date].filter(Boolean).join(' - '));
        const ok = drawTwoPartRow({
          boldLeft: normalizePdfText(exp.job_title),
          normalLeft: exp.company ? ` - ${normalizePdfText(exp.company)}` : '',
          rightText: dates,
          fontSize: preset.entryTitleSize,
        });
        if (!ok) break;

        const submeta = normalizePdfText(
          [exp.employment_type, exp.location].filter(Boolean).join(' | ')
        );
        if (submeta) {
          const subH = lineAdvance(preset.submetaSize);
          if (!canFitHeight(subH)) {
            truncated = true;
            break;
          }
          setFont('italic', preset.submetaSize, 75);
          if (!dryRun) {
            doc.text(submeta, preset.marginX, y + preset.submetaSize * 0.8);
          }
          y += subH;
        }

        if (exp.bullets.length > 0) {
          y += 1.5;
          drawBullets(exp.bullets);
        }
      }
    }

    if (section.id === 'projects' && resume.projects.length > 0) {
      if (!drawSectionHeading('Projects', renderedSections === 0)) break;
      renderedSections++;

      for (let i = 0; i < resume.projects.length; i++) {
        const prj = resume.projects[i];
        if (i > 0) {
          if (!canFitHeight(preset.entryGap + lineAdvance(preset.entryTitleSize))) {
            truncated = true;
            break;
          }
          y += preset.entryGap;
        }

        const techText =
          prj.technologies.length > 0
            ? normalizePdfText(prj.technologies.join(', '))
            : '';
        const techSuffix = techText ? ` (${techText})` : '';
        const safeUrl = prj.project_url ? sanitizeUrl(prj.project_url) : null;
        const urlLabel = prj.project_url
          ? normalizePdfText(stripProtocolForDisplay(prj.project_url))
          : '';
        const cleanProjName = normalizePdfText(prj.project_name);

        // Keep tech inline only if Project Name + (Tech) + URL fit cleanly on one row;
        // otherwise place Tech Stack cleanly on a muted subline so it never wraps in bold.
        setFont('normal', Math.max(preset.entryTitleSize - 0.75, 7), 65);
        const urlW = urlLabel ? doc.getTextWidth(urlLabel) : 0;
        const maxSingleRowLeft = urlLabel
          ? Math.max(contentWidth * 0.5, contentWidth - urlW - 10)
          : contentWidth;
        setFont('bold', preset.entryTitleSize, 0);
        const nameW = doc.getTextWidth(cleanProjName);
        setFont('normal', preset.entryTitleSize, 45);
        const suffixW = techSuffix ? doc.getTextWidth(techSuffix) : 0;
        const techFitsInline = Boolean(techSuffix) && nameW + suffixW <= maxSingleRowLeft;

        const ok = drawTwoPartRow({
          boldLeft: cleanProjName,
          normalLeft: techFitsInline ? techSuffix : '',
          rightText: urlLabel,
          rightHref: safeUrl ?? undefined,
          fontSize: preset.entryTitleSize,
        });
        if (!ok) break;

        if (techText && !techFitsInline) {
          const techLineH = lineAdvance(preset.submetaSize);
          setFont('italic', preset.submetaSize, 75);
          const techLines = doc.splitTextToSize(`Tech Stack: ${techText}`, contentWidth) as string[];
          if (!canFitHeight(techLines.length * techLineH)) {
            truncated = true;
            break;
          }
          for (const line of techLines) {
            if (!dryRun) {
              doc.text(line, preset.marginX, y + preset.submetaSize * 0.8);
            }
            y += techLineH;
          }
        }

        if (prj.bullets.length > 0) {
          y += 1.5;
          drawBullets(prj.bullets);
        }
      }
    }

    if (section.id === 'education' && resume.education.length > 0) {
      if (!drawSectionHeading('Education', renderedSections === 0)) break;
      renderedSections++;

      for (let i = 0; i < resume.education.length; i++) {
        const edu = resume.education[i];
        if (i > 0) {
          if (!canFitHeight(preset.entryGap + lineAdvance(preset.entryTitleSize))) {
            truncated = true;
            break;
          }
          y += preset.entryGap;
        }

        const dates = normalizePdfText(
          [edu.start_date, edu.graduation_date].filter(Boolean).join(' - ')
        );
        const ok = drawTwoPartRow({
          boldLeft: normalizePdfText(edu.institution),
          rightText: dates,
          fontSize: preset.entryTitleSize,
        });
        if (!ok) break;

        const degreeText = normalizePdfText(
          `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''}`
        );
        const gpaText = edu.gpa ? `GPA: ${normalizePdfText(edu.gpa)}` : '';
        if (degreeText || gpaText) {
          const subH = lineAdvance(preset.submetaSize);
          if (!canFitHeight(subH)) {
            truncated = true;
            break;
          }
          setFont('normal', preset.submetaSize, 55);
          if (!dryRun) {
            if (degreeText) {
              doc.text(degreeText, preset.marginX, y + preset.submetaSize * 0.8);
            }
            if (gpaText) {
              const gpaW = doc.getTextWidth(gpaText);
              doc.text(gpaText, US_LETTER_WIDTH_PT - preset.marginX - gpaW, y + preset.submetaSize * 0.8);
            }
          }
          y += subH;
        }

        if (edu.highlights.length > 0) {
          y += 1.5;
          drawBullets(edu.highlights);
        }
      }
    }

    if (section.id === 'credentials' && (resume.credentials ?? []).length > 0) {
      if (!drawSectionHeading(section.label || 'Certifications & Awards', renderedSections === 0)) {
        break;
      }
      renderedSections++;

      const creds = resume.credentials ?? [];
      for (let i = 0; i < creds.length; i++) {
        const crd = creds[i];
        if (i > 0) {
          if (!canFitHeight(preset.bulletGap + lineAdvance(preset.bodySize))) {
            truncated = true;
            break;
          }
          y += preset.bulletGap;
        }
        const suffixParts = [
          crd.issuer ? ` - ${normalizePdfText(crd.issuer)}` : '',
          crd.detail ? ` (${normalizePdfText(crd.detail)})` : '',
        ].join('');

        const ok = drawTwoPartRow({
          boldLeft: normalizePdfText(crd.title),
          normalLeft: suffixParts,
          rightText: crd.date ? normalizePdfText(crd.date) : '',
          fontSize: preset.bodySize,
          leftGray: 0,
          rightGray: 65,
        });
        if (!ok) break;
      }
    }
  }

  return {
    finalY: y,
    fits: y <= maxY + 0.5,
    truncated,
  };
}

export interface OnePageFitMetrics {
  presetName: string;
  bodyFontSizePt: number;
  pageFillPercent: number;
  fittedWithinOnePage: boolean;
  truncatedToFit: boolean;
  status: 'optimal' | 'tight' | 'overflow';
}

function selectOnePagePreset(
  measurer: jsPDF,
  resume: GeneratedResume
): { preset: PdfLayoutPreset; fittedNaturally: boolean; measuredFinalY: number } {
  let selectedPreset: PdfLayoutPreset = PDF_LAYOUT_PRESETS[PDF_LAYOUT_PRESETS.length - 1];
  let fittedNaturally = false;
  let measuredFinalY = selectedPreset.marginTop;

  for (const preset of PDF_LAYOUT_PRESETS) {
    const result = layoutResumeOnSinglePage(measurer, resume, preset, {
      dryRun: true,
      enforceOnePageClip: false,
    });
    measuredFinalY = result.finalY;
    if (result.fits) {
      selectedPreset = preset;
      fittedNaturally = true;
      break;
    }
  }

  // If even ultra-dense overflows slightly, try one final proportionally scaled preset
  // down to a legible 6.8pt ATS floor before invoking hard single-page clipping.
  if (!fittedNaturally) {
    const base = PDF_LAYOUT_PRESETS[PDF_LAYOUT_PRESETS.length - 1];
    const measured = layoutResumeOnSinglePage(measurer, resume, base, {
      dryRun: true,
      enforceOnePageClip: false,
    });
    const availH = US_LETTER_HEIGHT_PT - base.marginTop - base.marginBottom;
    const usedH = Math.max(1, measured.finalY - base.marginTop);
    const ratio = Math.max(0.88, Math.min(0.99, availH / usedH));

    const microPreset: PdfLayoutPreset = {
      name: 'micro-fit',
      marginX: 24,
      marginTop: 16,
      marginBottom: 15,
      nameSize: Math.max(12, base.nameSize * ratio),
      titleSize: Math.max(7.6, base.titleSize * ratio),
      contactSize: Math.max(7, base.contactSize * ratio),
      headingSize: Math.max(7.4, base.headingSize * ratio),
      entryTitleSize: Math.max(7.5, base.entryTitleSize * ratio),
      submetaSize: Math.max(6.8, base.submetaSize * ratio),
      bodySize: Math.max(6.8, base.bodySize * ratio),
      lineHeight: 1.09,
      headerBottomGap: 4,
      sectionGap: 3.5,
      headingBottomGap: 2,
      entryGap: 2.5,
      bulletGap: 0.5,
      bulletIndent: 7.5,
    };

    selectedPreset = microPreset;
    const microResult = layoutResumeOnSinglePage(measurer, resume, microPreset, {
      dryRun: true,
      enforceOnePageClip: false,
    });
    measuredFinalY = microResult.finalY;
    fittedNaturally = microResult.fits;
  }

  return { preset: selectedPreset, fittedNaturally, measuredFinalY };
}

/**
 * Measures exact 1-page US Letter fit using the identical typography/line-wrap engine
 * used during PDF generation so the UI can show real-time 1-page fit feedback.
 */
export function measureOnePageResumeFit(resume: GeneratedResume): OnePageFitMetrics {
  const measurer = createDoc();
  const { preset, fittedNaturally, measuredFinalY } = selectOnePagePreset(measurer, resume);
  const availH = US_LETTER_HEIGHT_PT - preset.marginTop - preset.marginBottom;
  const usedH = Math.max(0, measuredFinalY - preset.marginTop);
  const pageFillPercent = Math.min(100, Math.max(1, Math.round((usedH / availH) * 100)));

  const status: OnePageFitMetrics['status'] = !fittedNaturally
    ? 'overflow'
    : preset.bodySize < 8.4
      ? 'tight'
      : 'optimal';

  return {
    presetName: preset.name,
    bodyFontSizePt: Number(preset.bodySize.toFixed(1)),
    pageFillPercent,
    fittedWithinOnePage: fittedNaturally,
    truncatedToFit: !fittedNaturally,
    status,
  };
}

/**
 * Generates an ATS-friendly, selectable-text, strictly 1-page US Letter vector PDF.
 * Automatically picks the most legible typography preset that fits cleanly within 1 page,
 * and guarantees pageCount === 1 even for extremely dense resumes.
 */
export function generateOnePageResumePdf(resume: GeneratedResume): GeneratedPdfResumeResult {
  const measurer = createDoc();
  const { preset: selectedPreset, fittedNaturally } = selectOnePagePreset(measurer, resume);

  const doc = createDoc();
  const filename = buildExportFilename(resume, 'pdf');
  const title = buildPdfDocumentTitle(resume);

  doc.setProperties({
    title,
    subject: 'ATS-Friendly Single-Page Resume',
    author: normalizePdfText(resume.header.full_name || 'Candidate'),
    creator: 'Gen1Resume',
  });

  const renderResult = layoutResumeOnSinglePage(doc, resume, selectedPreset, {
    dryRun: false,
    enforceOnePageClip: true,
  });

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

  return {
    blob,
    arrayBuffer,
    filename,
    pageCount: doc.getNumberOfPages(),
    presetName: selectedPreset.name,
    fittedWithinOnePage: fittedNaturally,
    truncatedToFit: renderResult.truncated,
  };
}
