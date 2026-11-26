import type { ExtractedResumeData } from '../types/gemini';
import { extractStructuredResume } from './geminiService';

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function readPdfFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      reject(new Error('Unsupported file format. Please upload a .pdf resume file.'));
      return;
    }

    if (file.size === 0) {
      reject(new Error('The selected PDF file is empty.'));
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      reject(new Error('PDF file exceeds the 10 MB size limit. Please upload a smaller file.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Failed to read the selected PDF file in your browser.'));
    };
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      if (!base64) {
        reject(new Error('Could not encode PDF contents to base64.'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export async function extractProfileFromPdf(
  file: File,
  signal?: AbortSignal
): Promise<ExtractedResumeData> {
  const pdfBase64 = await readPdfFileAsBase64(file);
  return extractStructuredResume(
    {
      mode: 'pdf',
      pdfBase64,
      fileName: file.name,
    },
    signal
  );
}

export async function extractProfileFromText(
  resumeText: string,
  signal?: AbortSignal
): Promise<ExtractedResumeData> {
  const trimmed = resumeText.trim();
  if (trimmed.length < 20) {
    throw new Error('Please paste at least 20 characters of resume text before extracting.');
  }
  if (trimmed.length > 80_000) {
    throw new Error('Pasted resume text exceeds the 80,000 character limit.');
  }
  return extractStructuredResume(
    {
      mode: 'text',
      resumeText: trimmed,
    },
    signal
  );
}
