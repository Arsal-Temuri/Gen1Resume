import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeterministicMatchScore } from './scoringService';
import type { CareerFact } from '../types/profile';

function makeFact(id: string, status: CareerFact['status'], content: string): CareerFact {
  return {
    fact_id: id,
    section: 'skills',
    parent_id: 'SKL',
    field: 'skill',
    label: 'Skill',
    content,
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    source: 'user_supplied_resume',
  };
}

test('weighted match score calculates 40/25/20/10/5 coverage and demotes unapproved citations', () => {
  const facts: Record<string, CareerFact> = {
    'SKL-01': makeFact('SKL-01', 'APPROVED', 'Python'),
    'SKL-02': makeFact('SKL-02', 'PENDING', 'Kubernetes'),
    'EXP-1-B1': makeFact('EXP-1-B1', 'APPROVED', 'Built FastAPI REST APIs'),
    'EDU-1-F1': makeFact('EDU-1-F1', 'APPROVED', 'B.S. Computer Science'),
  };

  const result = calculateDeterministicMatchScore(
    {
      matched: [
        {
          name: 'Python',
          category: 'required_technical_skills',
          importance: 'required',
          status: 'matched',
          supporting_fact_ids: ['SKL-01'],
          rationale: 'Direct match',
        },
        {
          // Duplicate requirement should NOT be double-counted
          name: 'python ',
          category: 'required_technical_skills',
          importance: 'required',
          status: 'matched',
          supporting_fact_ids: ['SKL-01'],
          rationale: 'Duplicate',
        },
        {
          // Cites PENDING fact SKL-02 -> must be demoted to missing!
          name: 'Kubernetes',
          category: 'preferred_skills',
          importance: 'preferred',
          status: 'matched',
          supporting_fact_ids: ['SKL-02'],
          rationale: 'Unapproved skill should be demoted',
        },
        {
          name: 'Computer Science Degree',
          category: 'education_and_domain',
          importance: 'required',
          status: 'matched',
          supporting_fact_ids: ['EDU-1-F1'],
          rationale: 'B.S. CS',
        },
      ],
      partially_matched: [
        {
          name: 'API Design & Maintenance',
          category: 'relevant_responsibilities',
          importance: 'required',
          status: 'partially_matched',
          supporting_fact_ids: ['EXP-1-B1'],
          rationale: 'Internship scope',
        },
      ],
      missing: [
        {
          name: '3+ Years Production Backend',
          category: 'experience_alignment',
          importance: 'required',
          status: 'missing',
          supporting_fact_ids: [],
          rationale: 'Only internships',
        },
      ],
    },
    facts
  );

  // Deduplicated count: Python, Kubernetes, Computer Science Degree, API Design, 3+ Years = 5
  assert.equal(result.totalRequirements, 5);
  assert.equal(result.matchedCount, 2); // Python + CS Degree
  assert.equal(result.partialCount, 1); // API Design
  assert.equal(result.missingCount, 2); // Kubernetes (demoted!) + 3+ Years

  // Expected score:
  // required_technical_skills (40% * 1.0 = 40.0)
  // relevant_responsibilities (25% * 0.45 = 11.25 -> 11.3)
  // experience_alignment (20% * 0 = 0)
  // preferred_skills (10% * 0 = 0)
  // education_and_domain (5% * 1.0 = 5.0)
  // Total = round(56.3) = 56
  assert.equal(result.overallScore, 56);

  const kube = result.deduplicatedRequirements.find((r) => r.name === 'Kubernetes');
  assert.equal(kube?.status, 'missing');
  assert.deepEqual(kube?.supporting_fact_ids, []);
});
