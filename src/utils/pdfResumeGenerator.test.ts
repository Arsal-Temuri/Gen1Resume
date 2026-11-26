import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOnePageResumePdf,
  measureOnePageResumeFit,
  normalizePdfText,
} from './pdfResumeGenerator';
import type { GeneratedResume } from '../types/resume';

function makeStandardResume(): GeneratedResume {
  return {
    header: {
      full_name: 'Arsal Temuri',
      professional_title: 'Junior Backend Software Engineer · Python & Applied AI',
      email: 'arsal.temuri@example.com',
      phone: '+1 (415) 555-0192',
      location: 'San Francisco, CA',
      linkedin_url: 'https://linkedin.com/in/arsaltemuri',
      github_url: 'https://github.com/arsaltemuri',
      portfolio_url: 'https://arsaltemuri.dev',
    },
    summary_statements: [
      {
        bullet_id: 'SUM-001',
        text: 'Backend engineer specializing in Python, FastAPI, PostgreSQL, and applied AI workflows with production experience shipping low-latency APIs.',
        source_fact_ids: ['EXP-1-B1', 'EXP-1-B2'],
      },
    ],
    skills: [
      {
        category: 'Languages',
        items: [
          { name: 'Python', source_fact_id: 'SKL-1' },
          { name: 'TypeScript', source_fact_id: 'SKL-2' },
          { name: 'SQL', source_fact_id: 'SKL-3' },
        ],
      },
      {
        category: 'Backend & AI',
        items: [
          { name: 'FastAPI', source_fact_id: 'SKL-4' },
          { name: 'PostgreSQL', source_fact_id: 'SKL-5' },
          { name: 'Docker', source_fact_id: 'SKL-6' },
          { name: 'PyTorch', source_fact_id: 'SKL-7' },
        ],
      },
    ],
    experience: [
      {
        entry_id: 'REXP-1',
        source_parent_id: 'EXP-1',
        source_fact_id: 'EXP-1-META',
        company: 'Nimbus AI Labs',
        job_title: 'Junior Backend Software Engineer',
        employment_type: 'Full-time',
        location: 'San Francisco, CA',
        start_date: 'Jun 2025',
        end_date: 'Present',
        bullets: [
          {
            bullet_id: 'BUL-001',
            text: 'Built 8 FastAPI microservices in Python serving 25,000+ daily inference and retrieval requests at 99.96% uptime.',
            source_fact_ids: ['EXP-1-B1'],
            section: 'experience',
          },
          {
            bullet_id: 'BUL-002',
            text: 'Optimized PostgreSQL indexes and async connection pools, cutting p95 API latency from 380ms to 110ms.',
            source_fact_ids: ['EXP-1-B2'],
            section: 'experience',
          },
        ],
      },
    ],
    projects: [
      {
        entry_id: 'RPRJ-1',
        source_parent_id: 'PRJ-1',
        source_fact_id: 'PRJ-1-META',
        project_name: 'DocVerify — Fact-Grounded Retrieval Engine',
        technologies: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
        project_url: 'https://github.com/arsaltemuri/docverify',
        bullets: [
          {
            bullet_id: 'BUL-003',
            text: 'Designed a hybrid lexical + semantic document verification pipeline achieving 94% precision on internal benchmark sets.',
            source_fact_ids: ['PRJ-1-B1'],
            section: 'projects',
          },
        ],
      },
    ],
    education: [
      {
        entry_id: 'REDU-1',
        source_parent_id: 'EDU-1',
        source_fact_id: 'EDU-1-META',
        institution: 'University of California, Davis',
        degree: 'B.S.',
        field_of_study: 'Computer Science',
        start_date: 'Sep 2021',
        graduation_date: 'Jun 2025',
        gpa: '3.85 / 4.00',
        highlights: [
          {
            bullet_id: 'EDU-H-001',
            text: 'Relevant Coursework: Distributed Systems, Machine Learning, Database Systems, Operating Systems.',
            source_fact_ids: ['EDU-1-H1'],
            section: 'education',
          },
        ],
      },
    ],
    credentials: [
      {
        item_id: 'RCRD-001',
        category: 'Certification',
        title: 'AWS Certified Cloud Practitioner',
        issuer: 'Amazon Web Services',
        date: 'Mar 2025',
        detail: 'Cloud fundamentals',
        source_fact_id: 'CRD-01',
      },
    ],
    sectionOrder: [
      { id: 'summary', label: 'Professional Summary', enabled: true },
      { id: 'skills', label: 'Technical Skills', enabled: true },
      { id: 'experience', label: 'Experience', enabled: true },
      { id: 'projects', label: 'Projects', enabled: true },
      { id: 'education', label: 'Education', enabled: true },
      { id: 'credentials', label: 'Certifications', enabled: true },
    ],
    generation_metadata: {
      target_role: 'Junior Backend Software Engineer Python Applied AI',
      company_name: 'Acme AI',
      focus_directive: '',
      generated_at: '2026-11-25T20:00:00.000Z',
    },
  };
}

test('normalizePdfText cleans smart punctuation and unsupported Unicode symbols cleanly', () => {
  assert.equal(
    normalizePdfText('Built “fast” APIs → 99.9% uptime — p95 ≤ 120ms · Python'),
    'Built "fast" APIs -> 99.9% uptime - p95 <= 120ms | Python'
  );
});

test('generateOnePageResumePdf produces a valid 1-page PDF with clean filename and no audit leakage', () => {
  const resume = makeStandardResume();
  const result = generateOnePageResumePdf(resume);

  assert.equal(result.pageCount, 1);
  assert.equal(result.fittedWithinOnePage, true);
  assert.equal(result.truncatedToFit, false);
  assert.equal(
    result.filename,
    'Arsal_Temuri_Junior_Backend_Software_Engineer_Python_Applied_AI_Resume.pdf'
  );
  assert.ok(result.arrayBuffer.byteLength > 1000);

  const rawPrefix = new TextDecoder('latin1').decode(
    new Uint8Array(result.arrayBuffer).slice(0, 16)
  );
  assert.ok(rawPrefix.startsWith('%PDF-'), `Expected PDF header, got ${rawPrefix}`);

  // Confirm raw PDF metadata contains candidate title and zero internal fact IDs
  const fullLatin1 = new TextDecoder('latin1').decode(new Uint8Array(result.arrayBuffer));
  assert.ok(fullLatin1.includes('Arsal Temuri'));
  assert.ok(!fullLatin1.includes('EXP-1-B1'));
  assert.ok(!fullLatin1.includes('BUL-001'));
});

test('generateOnePageResumePdf strictly stays on 1 page even for an extremely dense multi-role resume', () => {
  const heavy = makeStandardResume();
  heavy.experience = Array.from({ length: 6 }, (_, roleIdx) => ({
    entry_id: `REXP-${roleIdx + 1}`,
    source_parent_id: `EXP-${roleIdx + 1}`,
    source_fact_id: `EXP-${roleIdx + 1}-META`,
    company: `Cloud Systems Corp ${roleIdx + 1}`,
    job_title: `Backend Software Engineer ${roleIdx + 1}`,
    employment_type: 'Full-time',
    location: 'San Francisco, CA',
    start_date: 'Jan 2022',
    end_date: 'Dec 2025',
    bullets: Array.from({ length: 5 }, (_, bIdx) => ({
      bullet_id: `BUL-${roleIdx}-${bIdx}`,
      text: `Architected distributed Python and FastAPI microservice cluster #${roleIdx + 1}.${bIdx + 1} processing 50,000 events per second with automated schema validation, PostgreSQL read replicas, and zero-downtime blue-green rollouts.`,
      source_fact_ids: ['EXP-1-B1'],
      section: 'experience' as const,
    })),
  }));

  const result = generateOnePageResumePdf(heavy);
  assert.equal(result.pageCount, 1, 'PDF must NEVER exceed 1 page');
  assert.ok(result.arrayBuffer.byteLength > 1500);

  const standardFit = measureOnePageResumeFit(makeStandardResume());
  assert.equal(standardFit.status, 'optimal');
  assert.equal(standardFit.fittedWithinOnePage, true);
  assert.ok(standardFit.pageFillPercent > 30 && standardFit.pageFillPercent <= 100);

  const heavyFit = measureOnePageResumeFit(heavy);
  assert.ok(heavyFit.status === 'tight' || heavyFit.status === 'overflow');

  // Extreme 10-role resume must trigger overflow status yet STILL strictly emit 1 PDF page
  const extreme = makeStandardResume();
  extreme.experience = Array.from({ length: 10 }, (_, roleIdx) => ({
    ...heavy.experience[0],
    entry_id: `REXP-EXT-${roleIdx + 1}`,
    company: `Global Scale Corp ${roleIdx + 1}`,
  }));
  const extremeFit = measureOnePageResumeFit(extreme);
  assert.equal(extremeFit.status, 'overflow');
  assert.equal(extremeFit.truncatedToFit, true);
  assert.equal(generateOnePageResumePdf(extreme).pageCount, 1);
});
