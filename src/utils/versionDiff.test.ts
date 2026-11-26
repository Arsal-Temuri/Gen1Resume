import test from 'node:test';
import assert from 'node:assert/strict';
import type { VersionSnapshot } from '../types/history';
import { compareVersionSnapshots } from './versionDiff';

function makeSnapshot(overrides: Partial<VersionSnapshot> = {}): VersionSnapshot {
  const now = '2026-11-25T10:00:00.000Z';
  return {
    versionId: 'ver_left',
    targetRole: 'Backend Engineer',
    companyName: 'Acme Corp',
    createdAt: now,
    updatedAt: now,
    matchScore: 80,
    verificationScore: 95,
    auditStatus: 'CLEAN',
    jobDescription: {
      targetRole: 'Backend Engineer',
      companyName: 'Acme Corp',
      rawText: 'Python and PostgreSQL engineer.',
      focusDirective: '',
    },
    sourceFactIds: ['EXP-1-B1', 'EXP-1-B2', 'SKL-01'],
    profileSnapshot: {},
    userEdits: [],
    auditReport: {
      auditedAt: now,
      validationIssues: [],
      resultsByBulletId: {},
      summary: {
        total_claims: 2,
        verified_count: 2,
        paraphrased_count: 0,
        unsupported_count: 0,
        needs_review_count: 0,
        user_override_count: 0,
        verification_score: 95,
      },
    },
    matchScoreResult: {
      overallScore: 80,
      breakdown: [],
      deduplicatedRequirements: [],
      totalRequirements: 0,
      matchedCount: 0,
      partialCount: 0,
      missingCount: 0,
    },
    resume: {
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
          text: 'Backend engineer specializing in Python APIs.',
          source_fact_ids: ['EXP-1-B1'],
        },
      ],
      experience: [
        {
          entry_id: 'REXP-1',
          source_parent_id: 'EXP-1',
          source_fact_id: 'EXP-1-META',
          company: 'Northwind',
          job_title: 'Backend Intern',
          employment_type: 'Internship',
          location: 'Seattle, WA',
          start_date: 'May 2024',
          end_date: 'Aug 2024',
          bullets: [
            {
              bullet_id: 'BUL-001',
              section: 'experience',
              text: 'Built 6 FastAPI endpoints processing 120k daily transactions.',
              source_fact_ids: ['EXP-1-B1'],
            },
            {
              bullet_id: 'BUL-002',
              section: 'experience',
              text: 'Reduced PostgreSQL p95 latency from 480ms to 115ms.',
              source_fact_ids: ['EXP-1-B2'],
            },
          ],
        },
      ],
      projects: [],
      education: [],
      skills: [
        {
          category: 'Programming Languages',
          items: [
            { name: 'Python', source_fact_id: 'SKL-01' },
            { name: 'Java', source_fact_id: 'SKL-02' },
          ],
        },
      ],
      credentials: [
        {
          item_id: 'RCRD-1',
          category: 'Certification',
          title: 'AWS Certified Cloud Practitioner',
          issuer: 'AWS',
          date: '2025',
          detail: '',
          source_fact_id: 'CRD-01',
        },
      ],
      sectionOrder: [
        { id: 'summary', label: 'Summary', enabled: true },
        { id: 'skills', label: 'Technical Skills', enabled: true },
        { id: 'experience', label: 'Experience', enabled: true },
        { id: 'projects', label: 'Projects', enabled: false },
        { id: 'education', label: 'Education', enabled: false },
        { id: 'credentials', label: 'Certifications & Awards', enabled: true },
      ],
      generation_metadata: {
        target_role: 'Backend Engineer',
        company_name: 'Acme Corp',
        focus_directive: '',
        generated_at: now,
      },
    },
    ...overrides,
  };
}

test('compareVersionSnapshots computes score deltas, fact lineage, skill/credential diffs, and modified/added/removed claims', () => {
  const left = makeSnapshot();
  const right = makeSnapshot({
    versionId: 'ver_right',
    matchScore: 91,
    verificationScore: 100,
    sourceFactIds: ['EXP-1-B1', 'EXP-1-B3', 'SKL-01', 'SKL-03'],
    resume: {
      ...left.resume,
      summary_statements: [
        {
          bullet_id: 'SUM-001',
          text: 'Backend engineer specializing in Python and FastAPI microservices.',
          source_fact_ids: ['EXP-1-B1'],
        },
      ],
      experience: [
        {
          ...left.resume.experience[0],
          bullets: [
            left.resume.experience[0].bullets[0], // unchanged
            {
              bullet_id: 'BUL-003',
              section: 'experience',
              text: 'Containerized reconciliation worker with Docker and CI tests.',
              source_fact_ids: ['EXP-1-B3'],
            },
          ],
        },
      ],
      skills: [
        {
          category: 'Programming Languages',
          items: [
            { name: 'Python', source_fact_id: 'SKL-01' },
            { name: 'Go', source_fact_id: 'SKL-03' },
          ],
        },
      ],
      credentials: [
        ...left.resume.credentials!,
        {
          item_id: 'RCRD-2',
          category: 'Language',
          title: 'Spanish (Conversational)',
          issuer: '',
          date: '',
          detail: '',
          source_fact_id: 'CRD-02',
        },
      ],
    },
  });

  const diff = compareVersionSnapshots(left, right);

  assert.equal(diff.matchScoreDelta, 11);
  assert.equal(diff.verificationScoreDelta, 5);
  assert.equal(diff.sourceFactCountDelta, 1);

  assert.deepEqual(diff.addedFactIds, ['EXP-1-B3', 'SKL-03']);
  assert.deepEqual(diff.removedFactIds, ['EXP-1-B2']);
  assert.deepEqual(diff.sharedFactIds, ['EXP-1-B1', 'SKL-01']);

  assert.deepEqual(diff.addedSkills, ['Go']);
  assert.deepEqual(diff.removedSkills, ['Java']);
  assert.equal(diff.addedCredentials.length, 1);
  assert.equal(diff.removedCredentials.length, 0);

  assert.equal(diff.unchangedClaimCount, 1);
  const modified = diff.claimDiffs.filter((c) => c.status === 'modified');
  const added = diff.claimDiffs.filter((c) => c.status === 'added');
  const removed = diff.claimDiffs.filter((c) => c.status === 'removed');

  assert.equal(modified.length, 1);
  assert.equal(modified[0].bulletId, 'SUM-001');
  assert.equal(added.length, 1);
  assert.equal(added[0].bulletId, 'BUL-003');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].bulletId, 'BUL-002');
});
