# Gen1Resume

**Gen1Resume** is a full-stack, fact-grounded resume engineering platform powered by Gemini 2.5 Flash. Instead of letting an LLM freely rewrite or embellish your career history, Gen1Resume enforces a **human-in-the-loop Master Profile Vault**, **deterministic Fact IDs**, and a **two-pass anti-hallucination verification pipeline**—producing tailored, audit-verified, strictly 1-page ATS-compatible resumes.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Running in Development & Production](#running-in-development--production)
- [Available Scripts & Tests](#available-scripts--tests)
- [Server API Reference](#server-api-reference)
- [Data Privacy & Persistence](#data-privacy--persistence)
- [Troubleshooting](#troubleshooting)

---

## Key Features

### 1. Master Profile Vault (Single Source of Truth)
- **PDF & Text Resume Extraction**: Upload an existing PDF resume (up to 10 MB, verified via `%PDF-` magic bytes) or paste raw resume text to extract structured entries into your vault.
- **Safe Merge vs. Replace Import**: Import new resumes by either **merging** new deduplicated facts into your existing vault (preserving already-approved facts) or **replacing** the vault cleanly.
- **Deterministic Fact IDs**: Every atomic career fact is assigned a stable, human-readable ID:
  - `EXP-1-B1` (Experience bullets)
  - `PRJ-1-B1` (Project bullets)
  - `EDU-1` (Education records)
  - `SKL-01` (Skills)
  - `CRD-01` (Certifications, Awards & Languages)
- **Human-in-the-Loop Approval**: Newly extracted or manually added facts start as `Pending`. Only `Approved` facts are allowed to enter the AI tailoring pipeline.
- **Built-in Sample Profile**: Load a fictional CS Graduate sample profile with one click to explore the full workflow before importing your own data.

### 2. Two-Pass Anti-Hallucination Tailoring Pipeline
- **Pass 1 — Grounded Tailoring (`/api/gemini/tailor`)**: Generates a role-tailored resume strictly from your approved Fact IDs, adhering to a 1-page content budget and citing exact source Fact IDs for every claim, skill, and credential.
- **Pass 2 — Independent Factual Audit (`/api/gemini/audit`)**: Independently audits every generated claim against your approved Master Profile evidence and classifies each claim as:
  - **Verified** — directly supported by cited approved facts
  - **Paraphrased** — reworded faithfully from approved facts
  - **Unsupported** — introduces ungrounded metrics, tools, or claims (flagged for editing or removal)
- **Deterministic Reconciliation**: Client-side validators double-check that every cited Fact ID actually exists in the approved snapshot and recompute audit counts deterministically.

### 3. Tailoring Studio
- **Audit Mode & Clean ATS Preview**: Toggle seamlessly between interactive claim-level audit inspection (with source Fact ID lineage drawers) and a clean single-column ATS document preview.
- **Inline Editing with 30-Step Undo/Redo**: Edit bullets, summaries, skills, and section order directly in Audit Mode with full `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` history, plus an unsaved-changes guard (`beforeunload`).
- **Weighted Profile Match Score**: Transparent role-fit scoring against the pasted job description with matched vs. missing keyword breakdown.
- **Live 1-Page Fit Indicator**: Real-time layout measurement (`measureOnePageResumeFit`) showing whether your tailored resume fits comfortably within 1 US Letter page before exporting.

### 4. Multi-Format ATS-Friendly Exports
- **1-Page Vector PDF (`jspdf`)**: Direct, selectable-text, single-column ATS vector PDF guaranteed to fit cleanly on 1 page without relying on browser print dialogs.
- **Genuine Word Document (`.docx`)**: Native OpenXML `.docx` generated via the `docx` library with clean headings, bullets, and standard ATS-safe typography.
- **Plain Text & Clean HTML**: Copy or download plain text / semantic HTML for online application portals.

### 5. Version History, Application Tracking & Diff Comparison
- **Immutable Snapshots**: Save any tailored resume together with its job description, audit report, match score, and profile snapshot.
- **Application Status Tracking & Notes**: Track each saved version through `Draft`, `Applied`, `Interviewing`, `Offer`, `Rejected`, and `Archived` with filter chips and per-application notes (stored without mutating the snapshot's resume or audit record).
- **Side-by-Side Version Diff Comparison**: Compare any two saved snapshots to inspect Match Score / Verification Score / Source Fact deltas, added/removed skills and credentials, Fact Lineage changes, and claim-level Added/Removed/Modified diffs (with one-click **Swap A ↔ B**).

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Browser (React 19 + Vite + Tailwind v4)              │
│                                                                         │
│  Dashboard │ Master Profile Vault │ Tailoring Studio │ Version History  │
│                                                                         │
│  • Local persistence via localStorage (Profile Vault + Version History) │
│  • Client-side ATS exports (jsPDF 1-page vector PDF, OpenXML .docx)     │
│  • Deterministic validators, match scoring, undo/redo, version diffing  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ JSON over /api/gemini/*
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Express Server (server.ts, Port 3000)               │
│                                                                         │
│  • Security headers + 5-min sliding-window rate limiter (30 req / IP)   │
│  • Input validation & PDF %PDF- magic-byte check (10 MB PDF limit)      │
│  • AbortController request cancellation & exponential backoff retries   │
│  • Serves Vite middleware in dev / static dist/ bundle in production    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ @google/genai (server-side API key)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Gemini 2.5 Flash API                              │
│   Structured JSON Schema responses for Extraction, Pass 1, and Pass 2   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, `lucide-react`, `motion` |
| **Backend** | Node.js, Express 4, `tsx`, `dotenv` |
| **AI Integration** | `@google/genai` SDK (`gemini-2.5-flash` with strict JSON `responseSchema`) |
| **Document Generation** | `jspdf` (1-page vector ATS PDF), `docx` (OpenXML `.docx`) |
| **Testing** | Node.js built-in test runner (`node:test` + `tsx --test`) |

---

## Project Structure

```text
.
├── server.ts                       # Express entrypoint (API proxy + Vite dev / prod static server)
├── server/
│   ├── gemini.ts                   # Gemini 2.5 Flash extraction, Pass 1 tailoring & Pass 2 audit schemas/calls
│   ├── security.ts                 # Security headers, sliding-window rate limiter, PDF magic-byte validation
│   └── security.test.ts            # Server security unit tests
├── src/
│   ├── App.tsx                     # Root application state, navigation & error boundary
│   ├── main.tsx                    # React DOM entry point
│   ├── pages/
│   │   ├── Dashboard.tsx           # Overview metrics, readiness & quick actions
│   │   ├── MasterProfile.tsx       # Vault editor, PDF/text importer, approval controls & credentials
│   │   ├── TailoringStudio.tsx     # JD input, 2-pass generator, Audit Mode, Clean ATS Preview & exports
│   │   └── VersionHistory.tsx      # Saved snapshots, status tracking, filtering & diff launcher
│   ├── components/
│   │   ├── auditor/                # Claim-level audit badges, summary cards & lineage drawers
│   │   ├── history/                # VersionDiffModal (side-by-side snapshot comparison)
│   │   ├── navigation/             # Top navigation & theme toggle
│   │   ├── profile/                # FactCard, approval controls & import modals
│   │   ├── resume/                 # AuditResumeView & CleanAtsPreview
│   │   ├── shared/                 # ErrorBoundary, toasts & reusable primitives
│   │   └── tailoring/              # Match score panel & studio controls
│   ├── hooks/
│   │   ├── useMasterProfile.ts     # Vault CRUD, approval state & safe merge/replace
│   │   ├── useVersionHistory.ts    # Immutable snapshots & application status/notes tracking
│   │   ├── useTheme.ts             # Light/dark mode persistence
│   │   └── useToast.ts             # Notification queue
│   ├── services/
│   │   ├── extractionService.ts    # Client wrapper for /api/gemini/extract
│   │   ├── tailoringService.ts     # Orchestrates Pass 1 + Pass 2 + deterministic validation
│   │   ├── auditService.ts         # Claim verification & re-audit helpers
│   │   ├── scoringService.ts       # Weighted Profile Match Score engine (+ unit tests)
│   │   ├── exportService.ts        # PDF, DOCX, plain text & HTML export handlers
│   │   ├── geminiService.ts        # Shared fetch/abort client for server proxy routes
│   │   └── storageService.ts       # Versioned localStorage persistence layer
│   ├── utils/
│   │   ├── factIds.ts              # Deterministic Fact ID generation, normalization & merge logic (+ tests)
│   │   ├── validators.ts           # Schema validation & Pass 2 audit reconciliation (+ tests)
│   │   ├── pdfResumeGenerator.ts   # Guaranteed 1-page vector ATS PDF engine & fit measurer (+ tests)
│   │   ├── docxResumeGenerator.ts  # OpenXML .docx generator (+ tests)
│   │   ├── resumeFormatter.ts      # Plain text & clean HTML formatters
│   │   ├── undoHistory.ts          # 30-step immutable Undo/Redo stack (+ tests)
│   │   ├── versionDiff.ts          # Snapshot diff engine (+ tests)
│   │   └── textUtils.ts            # Keyword & text normalization helpers
│   ├── types/                      # TypeScript interfaces for profile, resume, audit, history & Gemini payloads
│   ├── data/                       # Fictional sample CS Graduate Master Profile
│   └── styles/                     # Global styles & print stylesheet
├── .env.example                    # Environment variable template
├── index.html                      # SPA HTML shell
├── metadata.json                   # App metadata & capabilities
├── package.json                    # Scripts and dependencies
├── tsconfig.json                   # TypeScript configuration
└── vite.config.ts                  # Vite & Tailwind v4 configuration
```

---

## Local Setup

### Prerequisites
- **Node.js**: v20+ recommended (Node v22.18+ if running `npm start` directly with native TypeScript execution; otherwise `npx tsx server.ts` works on all Node 20+ versions)
- **npm** (bundled with Node.js)
- **Google Gemini API Key**: Get a key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd <your-repo-folder>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a local `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
# Required for server-side Gemini 2.5 Flash API calls
GEMINI_API_KEY="your_actual_gemini_api_key_here"

# Optional: defaults to 3000 if omitted
PORT=3000

# Optional: public URL when hosted
APP_URL="http://localhost:3000"
```

> **Security Note**: `.env` is already listed in `.gitignore`. Never commit your real `GEMINI_API_KEY` to GitHub. The API key is read exclusively on the Express backend (`server/gemini.ts`) and is never exposed to the browser bundle.

---

## Running in Development & Production

### Development Mode
Starts the Express API server with Vite middleware on **http://localhost:3000**:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Start
1. Build the optimized frontend bundle into `dist/`:
   ```bash
   npm run build
   ```
2. Start the server in production mode (serves the static `dist/` bundle alongside `/api/*`):
   ```bash
   # Works on any Node 20+ version:
   NODE_ENV=production npx tsx server.ts

   # Or on Node 22.18+ with native TypeScript stripping:
   NODE_ENV=production npm start
   ```

---

## Available Scripts & Tests

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Express + Vite dev server at `http://localhost:3000` |
| `npm run build` | Compiles the frontend production bundle into `dist/` |
| `npm start` | Runs `node server.ts` (requires `dist/` when `NODE_ENV=production`) |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`) |
| `npm run clean` | Removes build artifacts (`dist/`) |

### Running the Unit Test Suite
Run all 8 test suites (security, deterministic Fact IDs, match scoring, validators, 1-page PDF layout, `.docx` export, undo/redo history, and version diffing):

```bash
npx tsx --test \
  server/security.test.ts \
  src/utils/factIds.test.ts \
  src/services/scoringService.test.ts \
  src/utils/validators.test.ts \
  src/utils/pdfResumeGenerator.test.ts \
  src/utils/docxResumeGenerator.test.ts \
  src/utils/undoHistory.test.ts \
  src/utils/versionDiff.test.ts
```

---

## Server API Reference

All AI endpoints are rate-limited to **30 requests per 5-minute sliding window per IP** and support client abort cancellation.

| Method & Route | Purpose | Limits & Validation |
| --- | --- | --- |
| `GET /api/health` | Server health check | Returns `{ "ok": true }` |
| `POST /api/gemini/extract` | Extracts structured Master Profile facts from raw text or base64 PDF | Text: 20–80,000 chars. PDF: max 10 MB, requires `%PDF-` signature |
| `POST /api/gemini/tailor` | **Pass 1** — Tailors a 1-page resume strictly from approved Fact IDs | Requires ≥1 approved fact & job description (30–80,000 chars) |
| `POST /api/gemini/audit` | **Pass 2** — Audits generated claims against approved Master Profile evidence | Requires claims array & approved profile snapshot |

---

## Data Privacy & Persistence

- **Local-First Browser Storage**: Your Master Profile Vault (`gen1resume:v1:profile`) and Version History snapshots (`gen1resume:v1:versions`) are stored locally in your browser's `localStorage`—there is no third-party database storing your resume data.
- **Scoped AI Requests**: Only the resume text/PDF being extracted or the **Approved** facts + target job description you submit are forwarded by your local Express server to the Gemini API. Pending or Rejected facts never leave the Master Profile Vault.

---

## Troubleshooting

- **`503 AI service credentials are not configured`**: Ensure `.env` exists in the project root with a valid `GEMINI_API_KEY` (not the placeholder `MY_GEMINI_API_KEY`) and restart `npm run dev`.
- **Port 3000 already in use**: Either stop the process using port 3000 or set `PORT=3001` in `.env`.
- **`npm start` fails on Node 20**: Use `NODE_ENV=production npx tsx server.ts` instead of `node server.ts`, or upgrade to Node.js 22.18+.
- **PDF upload rejected (`missing %PDF- signature`)**: Confirm the file is a genuine PDF document and under 10 MB.
