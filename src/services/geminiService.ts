import type {
  ExtractedResumeData,
  ExtractRequestPayload,
  Pass1TailorRequestPayload,
  Pass1TailorResponsePayload,
  Pass2AuditRequestPayload,
  Pass2AuditResponsePayload,
} from '../types/gemini';
import {
  validateExtractedResumeData,
  validatePass1Response,
  validatePass2Response,
} from '../utils/validators';

interface ApiErrorPayload {
  error?: string;
}

async function postJson<TRequest>(
  url: string,
  payload: TRequest,
  signal?: AbortSignal
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Operation was cancelled.');
    }
    throw new Error('Network error while contacting the AI service. Please check your connection and retry.');
  }

  let body: { data?: unknown } & ApiErrorPayload;
  try {
    body = (await response.json()) as { data?: unknown } & ApiErrorPayload;
  } catch {
    throw new Error(`AI service returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(body.error || `AI request failed with status ${response.status}.`);
  }

  return body.data;
}

export async function extractStructuredResume(
  payload: ExtractRequestPayload,
  signal?: AbortSignal
): Promise<ExtractedResumeData> {
  const raw = await postJson('/api/gemini/extract', payload, signal);
  return validateExtractedResumeData(raw);
}

export async function runPass1GroundedGeneration(
  payload: Pass1TailorRequestPayload,
  signal?: AbortSignal
): Promise<Pass1TailorResponsePayload> {
  const raw = await postJson('/api/gemini/tailor', payload, signal);
  return validatePass1Response(raw);
}

export async function runPass2IndependentAudit(
  payload: Pass2AuditRequestPayload,
  signal?: AbortSignal
): Promise<Pass2AuditResponsePayload> {
  const raw = await postJson('/api/gemini/audit', payload, signal);
  return validatePass2Response(raw);
}
