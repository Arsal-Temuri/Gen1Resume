import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type {
  ExtractRequestPayload,
  Pass1TailorRequestPayload,
  Pass2AuditRequestPayload,
} from '../src/types/gemini';

const MODEL_NAME = 'gemini-2.5-flash';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'AI service credentials are not configured. Please verify GEMINI_API_KEY in Settings > Secrets.'
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('401')) {
    return {
      status: 403,
      message: 'AI service authentication failed. Please check your API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'AI service rate limit reached. Please wait a moment and try again.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 502,
      message: 'The configured AI model is temporarily unavailable. Please retry shortly.',
    };
  }
  if (typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number') {
    return {
      status: (err as { statusCode: number }).statusCode,
      message: msg,
    };
  }
  return {
    status: 502,
    message: 'AI processing failed due to an upstream error. Please try again.',
  };
}

const SERVER_GEMINI_TIMEOUT_MS = 75_000;

function createAbortError(message = 'Operation was cancelled.'): Error & { statusCode?: number } {
  const err = new Error(message) as Error & { statusCode?: number };
  err.name = 'AbortError';
  err.statusCode = 499;
  return err;
}

async function runWithTimeoutAndAbort<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = SERVER_GEMINI_TIMEOUT_MS
): Promise<T> {
  if (signal?.aborted) {
    throw createAbortError();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(createAbortError());
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      const err = new Error('AI processing timed out. Please try again.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 504;
      reject(err);
    }, timeoutMs);

    signal?.addEventListener('abort', onAbort, { once: true });

    fn().then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  maxRetries = 2
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw createAbortError();
    }
    try {
      return await runWithTimeoutAndAbort(fn, signal);
    } catch (err) {
      lastErr = err;
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw err;
      }
      if (attempt < maxRetries && isRetryableError(err)) {
        const delayMs = 700 * Math.pow(2, attempt);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, delayMs);
          const onAbort = () => {
            clearTimeout(timer);
            reject(createAbortError());
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function parseJsonResponse(text: string | undefined): unknown {
  if (!text || !text.trim()) {
    const err = new Error('The AI model returned an empty response. Please retry.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 502;
    throw err;
  }
  try {
    return JSON.parse(text.trim());
  } catch {
    const err = new Error('The AI model returned malformed structured output. Please retry.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 502;
    throw err;
  }
}

const EXTRACTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    header: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING },
        professionalTitle: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
        linkedinUrl: { type: Type.STRING },
        githubUrl: { type: Type.STRING },
        portfolioUrl: { type: Type.STRING },
      },
      required: [
        'fullName',
        'professionalTitle',
        'email',
        'phone',
        'location',
        'linkedinUrl',
        'githubUrl',
        'portfolioUrl',
      ],
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          fieldOfStudy: { type: Type.STRING },
          startDate: { type: Type.STRING },
          graduationDate: { type: Type.STRING },
          gpa: { type: Type.STRING },
          relevantCoursework: { type: Type.ARRAY, items: { type: Type.STRING } },
          academicAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'institution',
          'degree',
          'fieldOfStudy',
          'startDate',
          'graduationDate',
          'gpa',
          'relevantCoursework',
          'academicAchievements',
        ],
      },
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          employmentType: { type: Type.STRING },
          location: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'company',
          'jobTitle',
          'employmentType',
          'location',
          'startDate',
          'endDate',
          'bullets',
        ],
      },
    },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          projectName: { type: Type.STRING },
          description: { type: Type.STRING },
          technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
          projectUrl: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['projectName', 'description', 'technologies', 'projectUrl', 'bullets'],
      },
    },
    skills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
        },
        required: ['name', 'category'],
      },
    },
    credentials: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: 'Must be one of: Certification, Award, Language',
          },
          title: { type: Type.STRING },
          issuer: { type: Type.STRING },
          date: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ['category', 'title', 'issuer', 'date', 'detail'],
      },
    },
  },
  required: ['header', 'education', 'experience', 'projects', 'skills', 'credentials'],
};

const REQUIREMENT_ITEM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    category: {
      type: Type.STRING,
      description:
        'Must be one of: required_technical_skills, relevant_responsibilities, experience_alignment, preferred_skills, education_and_domain',
    },
    importance: {
      type: Type.STRING,
      description: 'Must be either required or preferred',
    },
    supporting_fact_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    rationale: { type: Type.STRING },
  },
  required: ['name', 'category', 'importance', 'supporting_fact_ids', 'rationale'],
};

const BULLET_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    bullet_id: { type: Type.STRING },
    text: { type: Type.STRING },
    source_fact_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['bullet_id', 'text', 'source_fact_ids'],
};

const PASS1_TAILOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    resume: {
      type: Type.OBJECT,
      properties: {
        summary_statements: {
          type: Type.ARRAY,
          items: BULLET_SCHEMA,
        },
        skills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    source_fact_id: { type: Type.STRING },
                  },
                  required: ['name', 'source_fact_id'],
                },
              },
            },
            required: ['category', 'items'],
          },
        },
        experience: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              entry_id: { type: Type.STRING },
              source_parent_id: { type: Type.STRING },
              source_fact_id: { type: Type.STRING },
              company: { type: Type.STRING },
              job_title: { type: Type.STRING },
              employment_type: { type: Type.STRING },
              location: { type: Type.STRING },
              start_date: { type: Type.STRING },
              end_date: { type: Type.STRING },
              bullets: {
                type: Type.ARRAY,
                items: BULLET_SCHEMA,
              },
            },
            required: [
              'entry_id',
              'source_parent_id',
              'source_fact_id',
              'company',
              'job_title',
              'employment_type',
              'location',
              'start_date',
              'end_date',
              'bullets',
            ],
          },
        },
        projects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              entry_id: { type: Type.STRING },
              source_parent_id: { type: Type.STRING },
              source_fact_id: { type: Type.STRING },
              project_name: { type: Type.STRING },
              technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
              project_url: { type: Type.STRING },
              bullets: {
                type: Type.ARRAY,
                items: BULLET_SCHEMA,
              },
            },
            required: [
              'entry_id',
              'source_parent_id',
              'source_fact_id',
              'project_name',
              'technologies',
              'project_url',
              'bullets',
            ],
          },
        },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              entry_id: { type: Type.STRING },
              source_parent_id: { type: Type.STRING },
              source_fact_id: { type: Type.STRING },
              institution: { type: Type.STRING },
              degree: { type: Type.STRING },
              field_of_study: { type: Type.STRING },
              start_date: { type: Type.STRING },
              graduation_date: { type: Type.STRING },
              gpa: { type: Type.STRING },
              highlights: {
                type: Type.ARRAY,
                items: BULLET_SCHEMA,
              },
            },
            required: [
              'entry_id',
              'source_parent_id',
              'source_fact_id',
              'institution',
              'degree',
              'field_of_study',
              'start_date',
              'graduation_date',
              'gpa',
              'highlights',
            ],
          },
        },
        credentials: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item_id: { type: Type.STRING },
              category: {
                type: Type.STRING,
                description: 'Must be one of: Certification, Award, Language',
              },
              title: { type: Type.STRING },
              issuer: { type: Type.STRING },
              date: { type: Type.STRING },
              detail: { type: Type.STRING },
              source_fact_id: { type: Type.STRING },
            },
            required: [
              'item_id',
              'category',
              'title',
              'issuer',
              'date',
              'detail',
              'source_fact_id',
            ],
          },
        },
      },
      required: [
        'summary_statements',
        'skills',
        'experience',
        'projects',
        'education',
        'credentials',
      ],
    },
    requirements_analysis: {
      type: Type.OBJECT,
      properties: {
        matched: { type: Type.ARRAY, items: REQUIREMENT_ITEM_SCHEMA },
        partially_matched: { type: Type.ARRAY, items: REQUIREMENT_ITEM_SCHEMA },
        missing: { type: Type.ARRAY, items: REQUIREMENT_ITEM_SCHEMA },
      },
      required: ['matched', 'partially_matched', 'missing'],
    },
    generation_metadata: {
      type: Type.OBJECT,
      properties: {
        target_role: { type: Type.STRING },
        company_name: { type: Type.STRING },
        focus_directive: { type: Type.STRING },
      },
      required: ['target_role', 'company_name', 'focus_directive'],
    },
  },
  required: ['resume', 'requirements_analysis', 'generation_metadata'],
};

const PASS2_AUDIT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    audit_results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          bullet_id: { type: Type.STRING },
          status: {
            type: Type.STRING,
            description: 'Must be exactly one of: VERIFIED, PARAPHRASED, UNSUPPORTED',
          },
          source_fact_ids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          auditor_note: { type: Type.STRING },
        },
        required: ['bullet_id', 'status', 'source_fact_ids', 'auditor_note'],
      },
    },
    overall_audit_summary: {
      type: Type.OBJECT,
      properties: {
        total_claims: { type: Type.INTEGER },
        verified_count: { type: Type.INTEGER },
        paraphrased_count: { type: Type.INTEGER },
        unsupported_count: { type: Type.INTEGER },
      },
      required: ['total_claims', 'verified_count', 'paraphrased_count', 'unsupported_count'],
    },
  },
  required: ['audit_results', 'overall_audit_summary'],
};

const EXTRACTION_SYSTEM_INSTRUCTION = `You are a precision resume parser for a fact-grounded career profile vault.
Extract ONLY the factual information explicitly present in the supplied resume document or text.

Rules:
- Never invent, infer, embellish, or fabricate missing fields, metrics, dates, contact details, URLs, skills, or responsibilities.
- If a field (such as GPA, phone, LinkedIn, GitHub, portfolio URL, or employment type) is absent, return an empty string "".
- Preserve original numbers, dates, technologies, and phrasing faithfully in each bullet point.
- Split compound skill lists into individual atomic skills and assign each skill to one of these exact categories:
  "Programming Languages", "Frameworks and Libraries", "Databases", "Cloud and DevOps", "AI and Machine Learning", "Developer Tools", "Other Technical Skills".
- Extract any certifications, honors/awards, or spoken languages explicitly listed into "credentials", setting category to "Certification", "Award", or "Language" (leave missing issuer/date/detail as "").
- Do not generate fact IDs; application code assigns deterministic IDs.`;

const PASS1_SYSTEM_INSTRUCTION = `You are a professional resume strategist.

Your task is to produce a highly relevant, concise, ATS-friendly resume using ONLY the supplied approved career facts.

You are not permitted to create, assume, infer, exaggerate, or fabricate professional experience.

You may:
- Reorder experience.
- Select relevant projects.
- Improve sentence structure.
- Replace weak wording with stronger accurate wording.
- Align terminology with the job description when semantically equivalent.
- Improve clarity and readability.
- Prioritize relevant achievements.
- Remove irrelevant information.

You may NOT:
- Invent tools, programming languages, or frameworks.
- Add unverified responsibilities.
- Create numerical metrics.
- Inflate existing numerical achievements.
- Invent leadership responsibilities.
- Invent employment dates.
- Invent project outcomes.
- Upgrade skill proficiency.
- Convert exposure into professional expertise.
- Claim experience with technologies absent from approved evidence.

Every generated factual bullet MUST contain source_fact_ids.
Every cited fact ID must exist in the supplied approved profile.
Every professional summary sentence in summary_statements MUST contain valid source_fact_ids from the approved profile.
Every skill included in resume.skills MUST cite an approved skill fact ID in source_fact_id.
Every certification, award, or language included in resume.credentials MUST cite an approved credential fact ID (CRD-XX) in source_fact_id; return [] if no approved credentials are present or relevant.
Each experience, project, and education entry MUST preserve exact dates, titles, institutions, and original source_parent_id and source_fact_id.
Use unique sequential bullet IDs: SUM-001, SUM-002 for summary; BUL-001, BUL-002 for experience; PBUL-001, PBUL-002 for projects; EBUL-001, EBUL-002 for education highlights; and RCRD-001, RCRD-002 for credential item_ids.

For requirements_analysis:
- Extract distinct requirements from the Job Description across these exact categories:
  "required_technical_skills", "relevant_responsibilities", "experience_alignment", "preferred_skills", "education_and_domain".
- Classify each requirement as matched, partially_matched, or missing strictly against the approved profile facts.
- Cite exact approved source_fact_ids for every matched and partially_matched requirement.
- Leave supporting_fact_ids empty [] for missing requirements. Never invent qualifications.

One-page US Letter layout budget (CRITICAL):
- Target a crisp, high-signal 1-page resume that fits comfortably at 9.25pt–10pt typography without crowding or overflow.
- Keep summary_statements to 1–2 concise sentences (<= 45 words total).
- Select the most job-relevant experience entries (typically 2–4 roles) with 2–4 crisp, single- or two-line impact bullets per role.
- Select the 2–3 highest-relevance projects with 1–2 concise bullets each.
- Keep technical skills tightly grouped by category and omit redundant or completely irrelevant noise when space is tight.

If a statement cannot be supported by approved evidence, do not generate it.
When evidence is insufficient, omit the claim rather than guessing.
Accuracy always takes priority over keyword optimization.`;

const PASS2_SYSTEM_INSTRUCTION = `You are an independent factual verification engine.

Your only responsibility is to determine whether every generated resume claim is factually supported by the approved source material.

Do not optimize the resume.
Do not rewrite claims to make them appear valid.
Do not trust the previous model's reasoning.

Independently compare every factual statement against its exact cited approved source facts.

Check:
- Skills.
- Technologies.
- Frameworks.
- Metrics.
- Dates.
- Responsibilities.
- Job titles.
- Project outcomes.
- Leadership claims.
- Scope of work.
- Experience duration.
- Qualifications.

A statement must not be marked VERIFIED merely because its general meaning sounds plausible.
Every material factual element must be supported.

VERIFIED:
The wording and every factual detail are directly supported by the cited facts.

PARAPHRASED:
The statement changes wording or framing but preserves the exact factual meaning and does not introduce additional claims.

UNSUPPORTED:
The statement contains any unsupported tool, responsibility, achievement, metric, qualification, inflated outcome, misleading implication, or unsupported factual detail.

Also mark a claim UNSUPPORTED when:
- A cited fact ID does not exist.
- A cited fact is not approved.
- A claim has no supporting fact IDs.
- The cited evidence does not actually support the statement.

Be conservative.
When uncertain, choose UNSUPPORTED.
Return exactly one audit_results entry for EVERY bullet_id in the input claims list.
Provide a concise, specific explanation of every assessment and discrepancy.`;

export async function runServerExtraction(
  payload: ExtractRequestPayload,
  signal?: AbortSignal
): Promise<unknown> {
  try {
    const ai = getAiClient();

    const contents =
      payload.mode === 'pdf'
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: payload.pdfBase64 ?? '',
                },
              },
              {
                text: 'Extract all factual resume details from this PDF into the required structured JSON schema. Do not invent any missing data.',
              },
            ],
          }
        : `Extract all factual resume details from the following resume text into the required structured JSON schema. Do not invent any missing data.\n\n---\n${payload.resumeText ?? ''}`;

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        }),
      signal
    );

    return parseJsonResponse(response.text);
  } catch (err) {
    const mapped = mapGeminiError(err);
    const wrapped = new Error(mapped.message) as Error & { statusCode?: number };
    wrapped.statusCode = mapped.status;
    throw wrapped;
  }
}

export async function runServerPass1Tailor(
  payload: Pass1TailorRequestPayload,
  signal?: AbortSignal
): Promise<unknown> {
  try {
    const ai = getAiClient();
    const prompt = JSON.stringify(
      {
        target_role: payload.targetRole,
        company_name: payload.companyName,
        focus_directive: payload.focusDirective,
        job_description: payload.jobDescription,
        approved_master_profile: payload.approvedProfile,
      },
      null,
      2
    );

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Generate a strictly grounded, ATS-friendly 1-page tailored resume and job requirements gap analysis using ONLY the approved_master_profile facts below.\n\n${prompt}`,
          config: {
            systemInstruction: PASS1_SYSTEM_INSTRUCTION,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: PASS1_TAILOR_SCHEMA,
          },
        }),
      signal
    );

    return parseJsonResponse(response.text);
  } catch (err) {
    const mapped = mapGeminiError(err);
    const wrapped = new Error(mapped.message) as Error & { statusCode?: number };
    wrapped.statusCode = mapped.status;
    throw wrapped;
  }
}

export async function runServerPass2Audit(
  payload: Pass2AuditRequestPayload,
  signal?: AbortSignal
): Promise<unknown> {
  try {
    const ai = getAiClient();
    const prompt = JSON.stringify(
      {
        claims_to_audit: payload.claims,
        approved_fact_index: payload.approvedProfile.approvedFactIndex,
        approved_profile_context: {
          experience: payload.approvedProfile.experience,
          projects: payload.approvedProfile.projects,
          education: payload.approvedProfile.education,
          skills: payload.approvedProfile.skills,
          credentials: payload.approvedProfile.credentials ?? [],
        },
      },
      null,
      2
    );

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Independently audit EVERY claim in claims_to_audit against its exact cited source facts in approved_fact_index. Return exactly one audit result per bullet_id.\n\n${prompt}`,
          config: {
            systemInstruction: PASS2_SYSTEM_INSTRUCTION,
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: PASS2_AUDIT_SCHEMA,
          },
        }),
      signal
    );

    return parseJsonResponse(response.text);
  } catch (err) {
    const mapped = mapGeminiError(err);
    const wrapped = new Error(mapped.message) as Error & { statusCode?: number };
    wrapped.statusCode = mapped.status;
    throw wrapped;
  }
}
