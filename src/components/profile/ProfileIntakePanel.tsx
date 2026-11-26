import React, { useRef, useState } from 'react';
import { Database, FileText, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import type { ExtractedResumeData } from '../../types/gemini';
import type { FactSource } from '../../types/profile';
import {
  extractProfileFromPdf,
  extractProfileFromText,
  MAX_PDF_SIZE_BYTES,
} from '../../services/extractionService';
import { formatFileSize } from '../../utils/textUtils';
import { Button, Card, SegmentedControl, Textarea } from '../shared/ui';

type IntakeMode = 'pdf' | 'text' | 'sample';
export type ProfileImportMode = 'merge' | 'replace';

export const ProfileIntakePanel: React.FC<{
  hasExistingProfile: boolean;
  onExtracted: (
    data: ExtractedResumeData,
    source: FactSource,
    importMode: ProfileImportMode
  ) => void;
  onLoadSample: () => void;
  onNotify: (title: string, opts?: { description?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }) => void;
}> = ({ hasExistingProfile, onExtracted, onLoadSample, onNotify }) => {
  const [mode, setMode] = useState<IntakeMode>('pdf');
  const [importMode, setImportMode] = useState<ProfileImportMode>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveImportMode: ProfileImportMode = hasExistingProfile ? importMode : 'replace';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid .pdf resume document.');
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError(`File exceeds the ${formatFileSize(MAX_PDF_SIZE_BYTES)} maximum upload size.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExtracting(false);
    onNotify('Extraction cancelled', { tone: 'neutral' });
  };

  const handleExtractPdf = async () => {
    if (!selectedFile || isExtracting) return;
    setError(null);
    setIsExtracting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const extracted = await extractProfileFromPdf(selectedFile, controller.signal);
      onExtracted(extracted, 'pdf_upload', effectiveImportMode);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not extract resume PDF.';
      setError(msg);
      if (msg !== 'Operation was cancelled.') {
        onNotify('Extraction failed', { description: msg, tone: 'error' });
      }
    } finally {
      setIsExtracting(false);
      abortRef.current = null;
    }
  };

  const handleExtractText = async () => {
    if (isExtracting) return;
    if (pastedText.trim().length < 20) {
      setError('Please paste at least 20 characters of resume text.');
      return;
    }
    setError(null);
    setIsExtracting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const extracted = await extractProfileFromText(pastedText, controller.signal);
      onExtracted(extracted, 'user_supplied_resume', effectiveImportMode);
      setPastedText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not extract resume text.';
      setError(msg);
      if (msg !== 'Operation was cancelled.') {
        onNotify('Extraction failed', { description: msg, tone: 'error' });
      }
    } finally {
      setIsExtracting(false);
      abortRef.current = null;
    }
  };

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
            {hasExistingProfile ? 'Import or Replace Master Profile' : 'Build Your Master Profile Vault'}
          </h2>
          <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
            Extracted statements are assigned deterministic fact IDs and remain Pending Review until you approve them.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Profile intake method"
          className="inline-flex items-center p-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] dark:bg-[#18181B] dark:border-[#27272A] self-start"
        >
          {(
            [
              { id: 'pdf', label: 'Upload PDF' },
              { id: 'text', label: 'Paste Text' },
              { id: 'sample', label: 'Sample Profile' },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-[#09090B] border border-[#E4E4E7] dark:bg-[#09090B] dark:text-[#FAFAFA] dark:border-[#27272A]'
                    : 'text-[#52525B] hover:text-[#09090B] border border-transparent dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Safe Merge vs Replace choice when a Master Profile already exists */}
      {hasExistingProfile && mode !== 'sample' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214]">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]">
              Import behavior
            </p>
            <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
              {importMode === 'merge'
                ? 'Preserves all existing approved facts, skips duplicates, and appends new items as Pending Review.'
                : 'Replaces your entire current Master Profile with the newly extracted facts (all reset to Pending Review).'}
            </p>
          </div>
          <SegmentedControl<ProfileImportMode>
            ariaLabel="Import behavior"
            value={importMode}
            onChange={setImportMode}
            options={[
              { value: 'merge', label: 'Merge New Facts' },
              { value: 'replace', label: 'Replace Profile' },
            ]}
          />
        </div>
      )}

      {/* External AI processing notice */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[#FAFAFA] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] text-xs text-[#52525B] dark:text-[#A1A1AA]">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#71717A]" aria-hidden="true" />
        <p>
          Resume documents and pasted text are processed by an external Gemini AI service via our secure backend for structured extraction. Personal profile data is stored locally in your browser.
        </p>
      </div>

      {mode === 'pdf' && (
        <div className="space-y-3">
          <label
            htmlFor="pdf-resume-upload"
            className="flex flex-col items-center justify-center px-6 py-8 rounded-lg border border-dashed border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA]/60 dark:bg-[#18181B]/40 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer text-center"
          >
            <Upload className="w-5 h-5 text-[#71717A] mb-2" aria-hidden="true" />
            <span className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA]">
              Select a PDF resume to extract
            </span>
            <span className="mt-1 text-xs text-[#71717A] dark:text-[#A1A1AA]">
              .pdf up to 10 MB · Encoded natively in your browser and sent directly to Gemini
            </span>
            <input
              ref={fileInputRef}
              id="pdf-resume-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isExtracting}
              className="sr-only"
            />
          </label>

          {selectedFile && (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-[#52525B] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA] truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-[#71717A] dark:text-[#A1A1AA]">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              {!isExtracting && (
                <button
                  type="button"
                  aria-label="Remove selected PDF"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[#71717A] hover:text-[#09090B] dark:hover:text-[#FAFAFA] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              onClick={handleExtractPdf}
              disabled={!selectedFile || isExtracting}
            >
              {isExtracting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isExtracting
                ? 'Extracting structured facts...'
                : effectiveImportMode === 'merge'
                  ? 'Merge Facts from PDF'
                  : 'Extract Facts from PDF'}
            </Button>
            {isExtracting && (
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'text' && (
        <div className="space-y-3">
          <Textarea
            label="Paste Existing Resume Text"
            placeholder="Paste your full resume text here (header, education, work experience, projects, technical skills)..."
            rows={8}
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              if (error) setError(null);
            }}
            disabled={isExtracting}
            helperText={`${pastedText.length.toLocaleString()} characters · Only stated facts are extracted; missing details remain blank.`}
          />

          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              onClick={handleExtractText}
              disabled={pastedText.trim().length < 20 || isExtracting}
            >
              {isExtracting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isExtracting
                ? 'Extracting structured facts...'
                : effectiveImportMode === 'merge'
                  ? 'Merge Facts from Text'
                  : 'Extract Facts from Text'}
            </Button>
            {isExtracting && (
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'sample' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B]">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA]">
              Sample CS Graduate Profile (Fictional Sample Data)
            </p>
            <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] max-w-xl leading-relaxed">
              Populates a realistic, explicitly labeled fictional Computer Science graduate profile featuring two software engineering internships (Python/FastAPI, TypeScript/React/Node.js, PostgreSQL, Redis, Docker), an NLP ticket classifier project, a RAG Q&amp;A project, and categorized technical skills.
            </p>
          </div>
          <Button variant="primary" onClick={onLoadSample} disabled={isExtracting}>
            <Database className="w-4 h-4" aria-hidden="true" />
            Load Sample CS Graduate Profile
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="px-3.5 py-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#DC2626] dark:bg-red-950/60 dark:border-red-800/70 dark:text-red-400"
        >
          {error}
        </div>
      )}
    </Card>
  );
};
