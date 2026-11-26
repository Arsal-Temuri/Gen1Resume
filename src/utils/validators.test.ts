import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateExportSafety,
  validateAndReconcileAudit,
} from './validators';
import { buildExportFilename, buildPdfDocumentTitle } from './resumeFormatter';
import { escapeHtml, sanitizeUrl } from './textUtils';
import type { CareerFact } from '../types/profile';
import type { GeneratedResume } from '../types/resume';

function makeFact(id: string, status: CareerFact['status'], content: string): CareerFact {
  return {
    fact_id: id,
    section: 'experience',
    parent_id: 'EXP-1',
    field: 'bullet',
    label: 'Bullet',
    content,
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    source: 'user_supplied_resume',
  };
}

function makeSampleResume(): GeneratedResume {
  return {
    header: {
      full_name: 'Maya Chen',
      professional_title: 'Software Engineer',
      email: 'maya@example.com',
      phone: '555-0100',
      location: 'Seattle, WA',
      linkedin_url: '',
      github_url: '',
      portfolio_url: '',
    },
    summary_statements: [
      {
        bullet_id: 'SUM-001',
        text: 'Backend engineer experienced with Python and FastAPI.',
        source_fact_ids: ['EXP-1-B1'],
      },
    ],
    skills: [],
    experience: [
      {
        entry_id: 'REXP-1',
        source_parent_id: 'EXP-1',
        source_fact_id: 'EXP-1-META',
        company: 'Northwind',
        job_title: 'SWE Intern',
        employment_type: 'Internship',
        location: 'Seattle, WA',
        start_date: 'May 2024',
        end_date: 'Aug 2024',
        bullets: [
          {
            bullet_id: 'BUL-001',
            text: 'Built REST APIs in Python and FastAPI.',
            source_fact_ids: ['EXP-1-B1'],
            section: 'experience',
          },
          {
            bullet_id: 'BUL-002',
            text: 'Claim citing unapproved fact.',
            source_fact_ids: ['EXP-1-B2'],
            section: 'experience',
          },
        ],
      },
    ],
    projects: [],
    education: [],
    sectionOrder: [
      { id: 'summary', label: 'Professional Summary', enabled: true },
      { id: 'experience', label: 'Experience', enabled: true },
    ],
    generation_metadata: {
      target_role: 'Backend Engineer',
      company_name: 'Helios',
      focus_directive: '',
      generated_at: '2026-01-01T00:00:00.000Z',
    },
  };
}

test('application-side audit reconciliation flags unapproved citations even if AI marks VERIFIED', () => {
  const facts: Record<string, CareerFact> = {
    'EXP-1-B1': makeFact('EXP-1-B1', 'APPROVED', 'Built REST APIs in Python and FastAPI.'),
    'EXP-1-B2': makeFact('EXP-1-B2', 'PENDING', 'Unapproved draft bullet.'),
  };
  const resume = makeSampleResume();

  const report = validateAndReconcileAudit(
    resume,
    {
      audit_results: [
        {
          bullet_id: 'SUM-001',
          status: 'PARAPHRASED',
          source_fact_ids: ['EXP-1-B1'],
          auditor_note: 'Accurate paraphrase.',
        },
        {
          bullet_id: 'BUL-001',
          status: 'VERIFIED',
          source_fact_ids: ['EXP-1-B1'],
          auditor_note: 'Directly supported.',
        },
        {
          bullet_id: 'BUL-002',
          status: 'VERIFIED', // AI erroneously said VERIFIED, app MUST override to UNSUPPORTED!
          source_fact_ids: ['EXP-1-B2'],
          auditor_note: 'Looks fine',
        },
      ],
      overall_audit_summary: {
        total_claims: 3,
        verified_count: 2,
        paraphrased_count: 1,
        unsupported_count: 0,
      },
    },
    facts
  );

  assert.equal(report.resultsByBulletId['BUL-001'].status, 'VERIFIED');
  assert.equal(report.resultsByBulletId['SUM-001'].status, 'PARAPHRASED');
  assert.equal(report.resultsByBulletId['BUL-002'].status, 'UNSUPPORTED');
  assert.equal(report.summary.unsupported_count, 1);

  const safety = evaluateExportSafety(resume, report, facts);
  assert.equal(safety.allowed, false);
  assert.ok(safety.blockingBulletIds.includes('BUL-002'));
});

test('URL sanitizer blocks javascript/data schemes and HTML escaper prevents injection', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeUrl('https://github.com/mayachen'), 'https://github.com/mayachen');
  assert.equal(sanitizeUrl('linkedin.com/in/maya'), 'https://linkedin.com/in/maya');

  assert.equal(
    escapeHtml('<script>alert("x")</script> & \'test\''),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;'
  );
});

test('PDF export filename and print document title sanitize candidate name and role cleanly', () => {
  const resume = makeSampleResume();
  resume.header.full_name = 'Maya Chen / Jr.';
  resume.generation_metadata.target_role = 'Backend Software Engineer (L4)';

  assert.equal(
    buildExportFilename(resume, 'pdf'),
    'Maya_Chen_Jr_Backend_Software_Engineer_L4_Resume.pdf'
  );
  assert.equal(
    buildPdfDocumentTitle(resume),
    'Maya_Chen_Jr_Backend_Software_Engineer_L4_Resume'
  );
});
