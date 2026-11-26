import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResumeDocx } from './docxResumeGenerator';
import type { GeneratedResume } from '../types/resume';

function makeSampleResume(): GeneratedResume {
  return {
    header: {
      full_name: 'Arsal Temuri',
      professional_title: 'Junior Backend Software Engineer',
      email: 'arsal@example.com',
      phone: '(415) 555-0192',
      location: 'San Francisco, CA',
      linkedin_url: 'https://linkedin.com/in/arsaltemuri',
      github_url: 'https://github.com/arsaltemuri',
      portfolio_url: 'https://arsaltemuri.dev',
    },
    summary_statements: [
      {
        bullet_id: 'SUM-001',
        text: 'Backend engineer specializing in Python, FastAPI, and PostgreSQL microservices.',
        source_fact_ids: ['EXP-1-B1'],
      },
    ],
    skills: [
      {
        category: 'Languages',
        items: [
          { name: 'Python', source_fact_id: 'SKL-01' },
          { name: 'SQL', source_fact_id: 'SKL-02' },
        ],
      },
    ],
    experience: [
      {
        entry_id: 'REXP-1',
        source_parent_id: 'EXP-1',
        source_fact_id: 'EXP-1-META',
        company: 'Cascade AI',
        job_title: 'Junior Backend Engineer',
        employment_type: 'Full-time',
        location: 'San Francisco, CA',
        start_date: 'Jul 2025',
        end_date: 'Present',
        bullets: [
          {
            bullet_id: 'BUL-001',
            text: 'Built 8 FastAPI microservices serving 30,000+ daily requests at 99.96% uptime.',
            source_fact_ids: ['EXP-1-B1'],
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
        project_name: 'PulseQueue',
        technologies: ['Python', 'PostgreSQL'],
        project_url: 'https://github.com/arsaltemuri/pulsequeue',
        bullets: [
          {
            bullet_id: 'PBUL-001',
            text: 'Processed 1,500 jobs/minute with exponential backoff retries.',
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
        institution: 'University of Washington',
        degree: 'B.S.',
        field_of_study: 'Computer Science',
        start_date: 'Sep 2021',
        graduation_date: 'Jun 2025',
        gpa: '3.86 / 4.00',
        highlights: [
          {
            bullet_id: 'EBUL-001',
            text: 'Relevant Coursework: Distributed Systems, Databases.',
            source_fact_ids: ['EDU-1-F1'],
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
      target_role: 'Backend Software Engineer',
      company_name: 'Helios AI',
      focus_directive: '',
      generated_at: '2026-11-25T20:00:00.000Z',
    },
  };
}

test('generateResumeDocx produces a genuine OpenXML .docx ZIP archive with proper filename', async () => {
  const result = await generateResumeDocx(makeSampleResume());

  assert.equal(result.filename, 'Arsal_Temuri_Backend_Software_Engineer_Resume.docx');
  assert.ok(result.bytes.byteLength > 3000, 'Expected non-trivial OpenXML archive size');

  // Verify genuine PK\x03\x04 ZIP header (true .docx OpenXML archive, not fake HTML)
  assert.equal(result.bytes[0], 0x50); // P
  assert.equal(result.bytes[1], 0x4b); // K
  assert.equal(result.bytes[2], 0x03);
  assert.equal(result.bytes[3], 0x04);

  const latin1 = new TextDecoder('latin1').decode(result.bytes);
  assert.ok(latin1.includes('word/document.xml'), 'Archive must contain word/document.xml');
});
