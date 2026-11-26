import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from 'docx';
import type { GeneratedResume } from '../types/resume';
import { buildExportFilename } from './resumeFormatter';
import { sanitizeUrl, stripProtocolForDisplay } from './textUtils';

const FONT_FAMILY = 'Calibri';
const COLOR_BLACK = '000000';
const COLOR_DARK = '1F2937';
const COLOR_MUTED = '4B5563';
const COLOR_RULE = '111111';
const RIGHT_TAB_POS = TabStopPosition.MAX; // Right margin at 7.4in (8.5in - 2 * 0.55in)

function cleanText(input: string): string {
  return (input ?? '').replace(/\s+/g, ' ').trim();
}

function makeSectionHeading(title: string, isFirst: boolean): Paragraph {
  return new Paragraph({
    spacing: {
      before: isFirst ? 100 : 180,
      after: 80,
    },
    border: {
      bottom: {
        color: COLOR_RULE,
        space: 2,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    keepNext: true,
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        font: FONT_FAMILY,
        size: 20, // 10pt
        color: COLOR_BLACK,
      }),
    ],
  });
}

function makeBulletParagraph(text: string): Paragraph {
  return new Paragraph({
    numbering: {
      reference: 'ats-bullet-list',
      level: 0,
    },
    spacing: {
      before: 20,
      after: 35,
      line: 260,
    },
    children: [
      new TextRun({
        text: cleanText(text),
        font: FONT_FAMILY,
        size: 20, // 10pt
        color: COLOR_DARK,
      }),
    ],
  });
}

function buildContactChildren(resume: GeneratedResume): Array<TextRun | ExternalHyperlink> {
  const h = resume.header;
  const items: Array<{ label: string; href?: string }> = [];

  if (h.location?.trim()) items.push({ label: cleanText(h.location) });
  if (h.email?.trim()) {
    const email = cleanText(h.email);
    items.push({ label: email, href: `mailto:${email}` });
  }
  if (h.phone?.trim()) items.push({ label: cleanText(h.phone) });
  if (h.linkedin_url?.trim()) {
    items.push({
      label: cleanText(stripProtocolForDisplay(h.linkedin_url)),
      href: sanitizeUrl(h.linkedin_url) ?? undefined,
    });
  }
  if (h.github_url?.trim()) {
    items.push({
      label: cleanText(stripProtocolForDisplay(h.github_url)),
      href: sanitizeUrl(h.github_url) ?? undefined,
    });
  }
  if (h.portfolio_url?.trim()) {
    items.push({
      label: cleanText(stripProtocolForDisplay(h.portfolio_url)),
      href: sanitizeUrl(h.portfolio_url) ?? undefined,
    });
  }

  const children: Array<TextRun | ExternalHyperlink> = [];
  items.forEach((item, idx) => {
    if (idx > 0) {
      children.push(
        new TextRun({
          text: '  |  ',
          font: FONT_FAMILY,
          size: 18,
          color: COLOR_MUTED,
        })
      );
    }

    if (item.href) {
      children.push(
        new ExternalHyperlink({
          link: item.href,
          children: [
            new TextRun({
              text: item.label,
              font: FONT_FAMILY,
              size: 18,
              color: COLOR_DARK,
            }),
          ],
        })
      );
    } else {
      children.push(
        new TextRun({
          text: item.label,
          font: FONT_FAMILY,
          size: 18,
          color: COLOR_DARK,
        })
      );
    }
  });

  return children;
}

export function buildResumeDocxDocument(resume: GeneratedResume): Document {
  const h = resume.header;
  const paragraphs: Paragraph[] = [];

  // Candidate Full Name
  paragraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: cleanText(h.full_name || 'Candidate Name'),
          bold: true,
          font: FONT_FAMILY,
          size: 34, // 17pt
          color: COLOR_BLACK,
        }),
      ],
    })
  );

  // Optional Professional Title
  if (h.professional_title?.trim()) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 50 },
        children: [
          new TextRun({
            text: cleanText(h.professional_title),
            font: FONT_FAMILY,
            size: 21, // 10.5pt
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  }

  // Contact Bar with bottom divider rule
  const contactChildren = buildContactChildren(resume);
  if (contactChildren.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 120 },
        border: {
          bottom: {
            color: COLOR_RULE,
            space: 6,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        children: contactChildren,
      })
    );
  }

  let sectionCount = 0;

  for (const section of resume.sectionOrder) {
    if (!section.enabled) continue;

    if (section.id === 'summary' && resume.summary_statements.length > 0) {
      const summaryText = cleanText(
        resume.summary_statements.map((s) => s.text.trim()).join(' ')
      );
      if (!summaryText) continue;

      paragraphs.push(makeSectionHeading('Professional Summary', sectionCount === 0));
      sectionCount++;

      paragraphs.push(
        new Paragraph({
          spacing: { before: 20, after: 60, line: 265 },
          children: [
            new TextRun({
              text: summaryText,
              font: FONT_FAMILY,
              size: 20,
              color: COLOR_DARK,
            }),
          ],
        })
      );
    }

    if (section.id === 'skills' && resume.skills.length > 0) {
      const populated = resume.skills.filter((g) => g.items.length > 0);
      if (populated.length === 0) continue;

      paragraphs.push(makeSectionHeading('Technical Skills', sectionCount === 0));
      sectionCount++;

      for (const group of populated) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 20, after: 40, line: 260 },
            children: [
              new TextRun({
                text: `${cleanText(String(group.category))}: `,
                bold: true,
                font: FONT_FAMILY,
                size: 20,
                color: COLOR_BLACK,
              }),
              new TextRun({
                text: cleanText(group.items.map((item) => item.name).join(', ')),
                font: FONT_FAMILY,
                size: 20,
                color: COLOR_DARK,
              }),
            ],
          })
        );
      }
    }

    if (section.id === 'experience' && resume.experience.length > 0) {
      paragraphs.push(makeSectionHeading('Experience', sectionCount === 0));
      sectionCount++;

      resume.experience.forEach((exp, idx) => {
        const dates = cleanText([exp.start_date, exp.end_date].filter(Boolean).join(' – '));
        const headerRuns: TextRun[] = [
          new TextRun({
            text: cleanText(exp.job_title),
            bold: true,
            font: FONT_FAMILY,
            size: 21, // 10.5pt
            color: COLOR_BLACK,
          }),
        ];
        if (exp.company?.trim()) {
          headerRuns.push(
            new TextRun({
              text: ` — ${cleanText(exp.company)}`,
              font: FONT_FAMILY,
              size: 21,
              color: COLOR_DARK,
            })
          );
        }
        if (dates) {
          headerRuns.push(
            new TextRun({
              text: `\t${dates}`,
              font: FONT_FAMILY,
              size: 19,
              color: COLOR_MUTED,
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            spacing: { before: idx === 0 ? 30 : 120, after: 20 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
            keepNext: true,
            children: headerRuns,
          })
        );

        const submeta = cleanText(
          [exp.employment_type, exp.location].filter(Boolean).join(' · ')
        );
        if (submeta) {
          paragraphs.push(
            new Paragraph({
              spacing: { before: 0, after: 35 },
              keepNext: true,
              children: [
                new TextRun({
                  text: submeta,
                  italics: true,
                  font: FONT_FAMILY,
                  size: 18,
                  color: COLOR_MUTED,
                }),
              ],
            })
          );
        }

        for (const bullet of exp.bullets) {
          if (bullet.text.trim()) {
            paragraphs.push(makeBulletParagraph(bullet.text));
          }
        }
      });
    }

    if (section.id === 'projects' && resume.projects.length > 0) {
      paragraphs.push(makeSectionHeading('Projects', sectionCount === 0));
      sectionCount++;

      resume.projects.forEach((prj, idx) => {
        const safeUrl = prj.project_url ? sanitizeUrl(prj.project_url) : null;
        const urlLabel = prj.project_url
          ? cleanText(stripProtocolForDisplay(prj.project_url))
          : '';

        const headerChildren: Array<TextRun | ExternalHyperlink> = [
          new TextRun({
            text: cleanText(prj.project_name),
            bold: true,
            font: FONT_FAMILY,
            size: 21,
            color: COLOR_BLACK,
          }),
        ];

        if (urlLabel) {
          headerChildren.push(new TextRun({ text: '\t', font: FONT_FAMILY, size: 18 }));
          if (safeUrl) {
            headerChildren.push(
              new ExternalHyperlink({
                link: safeUrl,
                children: [
                  new TextRun({
                    text: urlLabel,
                    font: FONT_FAMILY,
                    size: 18,
                    color: COLOR_MUTED,
                  }),
                ],
              })
            );
          } else {
            headerChildren.push(
              new TextRun({
                text: urlLabel,
                font: FONT_FAMILY,
                size: 18,
                color: COLOR_MUTED,
              })
            );
          }
        }

        paragraphs.push(
          new Paragraph({
            spacing: { before: idx === 0 ? 30 : 110, after: 20 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
            keepNext: true,
            children: headerChildren,
          })
        );

        if (prj.technologies.length > 0) {
          paragraphs.push(
            new Paragraph({
              spacing: { before: 0, after: 35 },
              keepNext: true,
              children: [
                new TextRun({
                  text: `Tech Stack: ${cleanText(prj.technologies.join(', '))}`,
                  italics: true,
                  font: FONT_FAMILY,
                  size: 18,
                  color: COLOR_MUTED,
                }),
              ],
            })
          );
        }

        for (const bullet of prj.bullets) {
          if (bullet.text.trim()) {
            paragraphs.push(makeBulletParagraph(bullet.text));
          }
        }
      });
    }

    if (section.id === 'education' && resume.education.length > 0) {
      paragraphs.push(makeSectionHeading('Education', sectionCount === 0));
      sectionCount++;

      resume.education.forEach((edu, idx) => {
        const dates = cleanText(
          [edu.start_date, edu.graduation_date].filter(Boolean).join(' – ')
        );
        const instRuns: TextRun[] = [
          new TextRun({
            text: cleanText(edu.institution),
            bold: true,
            font: FONT_FAMILY,
            size: 21,
            color: COLOR_BLACK,
          }),
        ];
        if (dates) {
          instRuns.push(
            new TextRun({
              text: `\t${dates}`,
              font: FONT_FAMILY,
              size: 19,
              color: COLOR_MUTED,
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            spacing: { before: idx === 0 ? 30 : 110, after: 20 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
            keepNext: true,
            children: instRuns,
          })
        );

        const degreeLine = cleanText(
          `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''}`
        );
        const gpaText = edu.gpa?.trim() ? `GPA: ${cleanText(edu.gpa)}` : '';
        if (degreeLine || gpaText) {
          const degRuns: TextRun[] = [
            new TextRun({
              text: degreeLine,
              font: FONT_FAMILY,
              size: 19,
              color: COLOR_DARK,
            }),
          ];
          if (gpaText) {
            degRuns.push(
              new TextRun({
                text: `\t${gpaText}`,
                font: FONT_FAMILY,
                size: 19,
                color: COLOR_MUTED,
              })
            );
          }
          paragraphs.push(
            new Paragraph({
              spacing: { before: 0, after: 35 },
              tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
              keepNext: edu.highlights.length > 0,
              children: degRuns,
            })
          );
        }

        for (const hl of edu.highlights) {
          if (hl.text.trim()) {
            paragraphs.push(makeBulletParagraph(hl.text));
          }
        }
      });
    }

    if (section.id === 'credentials' && (resume.credentials ?? []).length > 0) {
      paragraphs.push(
        makeSectionHeading(section.label || 'Certifications & Awards', sectionCount === 0)
      );
      sectionCount++;

      for (const crd of resume.credentials ?? []) {
        const runs: TextRun[] = [
          new TextRun({
            text: cleanText(crd.title),
            bold: true,
            font: FONT_FAMILY,
            size: 20,
            color: COLOR_BLACK,
          }),
        ];
        if (crd.issuer?.trim()) {
          runs.push(
            new TextRun({
              text: ` — ${cleanText(crd.issuer)}`,
              font: FONT_FAMILY,
              size: 20,
              color: COLOR_DARK,
            })
          );
        }
        if (crd.detail?.trim()) {
          runs.push(
            new TextRun({
              text: ` (${cleanText(crd.detail)})`,
              font: FONT_FAMILY,
              size: 19,
              color: COLOR_MUTED,
            })
          );
        }
        if (crd.date?.trim()) {
          runs.push(
            new TextRun({
              text: `\t${cleanText(crd.date)}`,
              font: FONT_FAMILY,
              size: 19,
              color: COLOR_MUTED,
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            spacing: { before: 20, after: 40, line: 260 },
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
            children: runs,
          })
        );
      }
    }
  }

  return new Document({
    creator: 'Gen1Resume',
    title: cleanText(h.full_name || 'ATS Resume'),
    description: 'ATS-Friendly Single-Column Resume exported by Gen1Resume',
    numbering: {
      config: [
        {
          reference: 'ats-bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: convertInchesToTwip(0.22),
                    hanging: convertInchesToTwip(0.14),
                  },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            margin: {
              top: convertInchesToTwip(0.55),
              bottom: convertInchesToTwip(0.55),
              left: convertInchesToTwip(0.55),
              right: convertInchesToTwip(0.55),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
}

export interface GeneratedDocxResumeResult {
  bytes: Uint8Array;
  blob: Blob;
  filename: string;
}

export async function generateResumeDocx(
  resume: GeneratedResume
): Promise<GeneratedDocxResumeResult> {
  const doc = buildResumeDocxDocument(resume);
  const rawBlob = await Packer.toBlob(doc);
  const arrayBuffer = await rawBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return {
    bytes,
    blob,
    filename: buildExportFilename(resume, 'docx'),
  };
}
