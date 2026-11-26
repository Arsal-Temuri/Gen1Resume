import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runServerExtraction,
  runServerPass1Tailor,
  runServerPass2Audit,
} from './server/gemini.ts';
import {
  applySecurityHeaders,
  createApiRateLimitMiddleware,
  isValidPdfBase64MagicBytes,
} from './server/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_PDF_BASE64_CHARS = 14_000_000; // ~10 MB binary PDF
const MAX_TEXT_CHARS = 80_000;

function attachRequestAbortController(req: Request, res: Response): AbortController {
  const controller = new AbortController();
  const handleClose = () => {
    // Only abort if the client closed the connection before the response finished
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  req.on('close', handleClose);
  res.on('finish', () => {
    req.off('close', handleClose);
  });
  return controller;
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(applySecurityHeaders);
  app.use(express.json({ limit: '16mb' }));

  const geminiRateLimiter = createApiRateLimitMiddleware({
    windowMs: 5 * 60 * 1000, // 5-minute sliding window
    maxRequests: 30,
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use('/api/gemini', geminiRateLimiter);

  app.post('/api/gemini/extract', async (req: Request, res: Response) => {
    const controller = attachRequestAbortController(req, res);
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || (body.mode !== 'text' && body.mode !== 'pdf')) {
        res.status(400).json({ error: 'Invalid extraction mode. Expected "text" or "pdf".' });
        return;
      }

      if (body.mode === 'text') {
        const resumeText = typeof body.resumeText === 'string' ? body.resumeText.trim() : '';
        if (resumeText.length < 20) {
          res.status(400).json({ error: 'Please provide at least 20 characters of resume text.' });
          return;
        }
        if (resumeText.length > MAX_TEXT_CHARS) {
          res.status(400).json({ error: 'Resume text exceeds the 80,000 character limit.' });
          return;
        }
        const data = await runServerExtraction({ mode: 'text', resumeText }, controller.signal);
        if (!res.writableEnded) res.json({ data });
        return;
      }

      const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
      if (!pdfBase64) {
        res.status(400).json({ error: 'PDF payload is empty.' });
        return;
      }
      if (pdfBase64.length > MAX_PDF_BASE64_CHARS) {
        res.status(413).json({ error: 'PDF file exceeds the 10 MB upload limit.' });
        return;
      }
      if (!isValidPdfBase64MagicBytes(pdfBase64)) {
        res.status(400).json({
          error: 'The uploaded file is not a valid PDF document (missing %PDF- signature).',
        });
        return;
      }

      const data = await runServerExtraction(
        {
          mode: 'pdf',
          pdfBase64,
          fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'resume.pdf',
        },
        controller.signal
      );
      if (!res.writableEnded) res.json({ data });
    } catch (err) {
      if (res.writableEnded || controller.signal.aborted) return;
      const status =
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error ? err.message : 'Unexpected server error during resume extraction.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/tailor', async (req: Request, res: Response) => {
    const controller = attachRequestAbortController(req, res);
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body.approvedProfile !== 'object' || body.approvedProfile === null) {
        res.status(400).json({ error: 'Approved Master Profile evidence is required.' });
        return;
      }

      const jobDescription =
        typeof body.jobDescription === 'string' ? body.jobDescription.trim() : '';
      if (jobDescription.length < 30) {
        res
          .status(400)
          .json({ error: 'Please supply a fuller job description (at least 30 characters).' });
        return;
      }
      if (jobDescription.length > MAX_TEXT_CHARS) {
        res.status(400).json({ error: 'Job description exceeds maximum supported length.' });
        return;
      }

      const approvedIndex = (body.approvedProfile as { approvedFactIndex?: Record<string, unknown> })
        .approvedFactIndex;
      if (!approvedIndex || Object.keys(approvedIndex).length === 0) {
        res
          .status(400)
          .json({ error: 'At least one approved career fact is required before tailoring.' });
        return;
      }

      const data = await runServerPass1Tailor(
        {
          approvedProfile: body.approvedProfile as Parameters<
            typeof runServerPass1Tailor
          >[0]['approvedProfile'],
          jobDescription,
          targetRole:
            typeof body.targetRole === 'string' ? body.targetRole.trim().slice(0, 160) : '',
          companyName:
            typeof body.companyName === 'string' ? body.companyName.trim().slice(0, 160) : '',
          focusDirective:
            typeof body.focusDirective === 'string'
              ? body.focusDirective.trim().slice(0, 1200)
              : '',
        },
        controller.signal
      );
      if (!res.writableEnded) res.json({ data });
    } catch (err) {
      if (res.writableEnded || controller.signal.aborted) return;
      const status =
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected server error during Pass 1 resume tailoring.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/audit', async (req: Request, res: Response) => {
    const controller = attachRequestAbortController(req, res);
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (
        !body ||
        !Array.isArray(body.claims) ||
        typeof body.approvedProfile !== 'object' ||
        body.approvedProfile === null
      ) {
        res
          .status(400)
          .json({ error: 'Generated claims and approved profile evidence are required for auditing.' });
        return;
      }

      if (body.claims.length === 0) {
        res.json({
          data: {
            audit_results: [],
            overall_audit_summary: {
              total_claims: 0,
              verified_count: 0,
              paraphrased_count: 0,
              unsupported_count: 0,
            },
          },
        });
        return;
      }

      const data = await runServerPass2Audit(
        {
          claims: body.claims as Parameters<typeof runServerPass2Audit>[0]['claims'],
          approvedProfile: body.approvedProfile as Parameters<
            typeof runServerPass2Audit
          >[0]['approvedProfile'],
          resumeContext: (body.resumeContext ?? {
            experience: [],
            projects: [],
            education: [],
            skills: [],
          }) as Parameters<typeof runServerPass2Audit>[0]['resumeContext'],
        },
        controller.signal
      );
      if (!res.writableEnded) res.json({ data });
    } catch (err) {
      if (res.writableEnded || controller.signal.aborted) return;
      const status =
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected server error during Pass 2 factual auditing.';
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Gen1Resume server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Gen1Resume server:', err);
  process.exit(1);
});
