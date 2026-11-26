import type { ApplicationBackupPayload } from '../types/history';
import type { GeneratedResume } from '../types/resume';
import { generateResumeDocx } from '../utils/docxResumeGenerator';
import {
  generateOnePageResumePdf,
  type GeneratedPdfResumeResult,
} from '../utils/pdfResumeGenerator';
import { formatResumePlainText } from '../utils/resumeFormatter';

export interface PdfDownloadSummary {
  filename: string;
  pageCount: number;
  presetName: string;
  fittedWithinOnePage: boolean;
  truncatedToFit: boolean;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportResumeAsPdf(resume: GeneratedResume): PdfDownloadSummary {
  const result: GeneratedPdfResumeResult = generateOnePageResumePdf(resume);
  triggerBlobDownload(result.blob, result.filename);
  return {
    filename: result.filename,
    pageCount: result.pageCount,
    presetName: result.presetName,
    fittedWithinOnePage: result.fittedWithinOnePage,
    truncatedToFit: result.truncatedToFit,
  };
}

export async function exportResumeAsWord(resume: GeneratedResume): Promise<string> {
  const result = await generateResumeDocx(resume);
  triggerBlobDownload(result.blob, result.filename);
  return result.filename;
}

export async function copyResumeAsPlainText(resume: GeneratedResume): Promise<void> {
  const plainText = formatResumePlainText(resume);

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(plainText);
      return;
    } catch {
      // Fall through to execCommand fallback if clipboard permission is blocked in iframe
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = plainText;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error('Unable to access the clipboard in this browser context.');
  }
}

export function exportApplicationBackup(payload: ApplicationBackupPayload): string {
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Gen1Resume_Backup_${dateSlug}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerBlobDownload(blob, filename);
  return filename;
}
