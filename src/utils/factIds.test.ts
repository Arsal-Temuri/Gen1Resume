import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApprovedProfilePayload,
  buildMasterProfileFromExtracted,
  createEmptyCounters,
  mergeExtractedIntoMasterProfile,
  nextCredentialFactId,
  nextExperienceBulletId,
  nextSkillFactId,
  retireFactId,
} from './factIds';
import { SAMPLE_CS_GRADUATE_EXTRACTED } from '../data/sampleProfile';

test('deterministic fact IDs are generated and never reused after deletion/retirement', () => {
  let counters = createEmptyCounters();
  const b1 = nextExperienceBulletId(counters, 'EXP-1');
  counters = b1.counters;
  assert.equal(b1.id, 'EXP-1-B1');

  const b2 = nextExperienceBulletId(counters, 'EXP-1');
  counters = b2.counters;
  assert.equal(b2.id, 'EXP-1-B2');

  // Retire EXP-1-B2 and verify next generated ID is EXP-1-B3, never EXP-1-B2
  counters = retireFactId(counters, 'EXP-1-B2');
  const b3 = nextExperienceBulletId(counters, 'EXP-1');
  counters = b3.counters;
  assert.equal(b3.id, 'EXP-1-B3');

  // Verify pre-retired future ID is skipped automatically
  counters = retireFactId(counters, 'SKL-01');
  const s1 = nextSkillFactId(counters);
  assert.equal(s1.id, 'SKL-02');

  counters = retireFactId(s1.counters, 'CRD-01');
  const c1 = nextCredentialFactId(counters);
  assert.equal(c1.id, 'CRD-02');
});

test('extracted profile facts default to PENDING and never auto-approve', () => {
  const profile = buildMasterProfileFromExtracted(
    SAMPLE_CS_GRADUATE_EXTRACTED,
    'sample_profile',
    { isSampleData: true }
  );

  assert.equal(profile.isSampleData, true);
  assert.ok(profile.facts['EXP-1-B1']);
  assert.ok(profile.facts['PRJ-1-B1']);
  assert.ok(profile.facts['EDU-1-F1']);
  assert.ok(profile.facts['SKL-01']);
  assert.ok(profile.facts['CRD-01']);
  assert.ok(profile.facts['HDR-01']);

  const statuses = Object.values(profile.facts).map((f) => f.status);
  assert.ok(statuses.every((s) => s === 'PENDING'));

  // Approved payload must be completely empty when no facts are approved
  const payload = buildApprovedProfilePayload(profile);
  assert.equal(Object.keys(payload.approvedFactIndex).length, 0);
  assert.equal(payload.experience.length, 0);
  assert.equal(payload.skills.length, 0);
  assert.equal(payload.credentials?.length ?? 0, 0);
});

test('approved payload includes only APPROVED facts and excludes private email and phone', () => {
  const profile = buildMasterProfileFromExtracted(
    SAMPLE_CS_GRADUATE_EXTRACTED,
    'user_supplied_resume',
    { defaultStatus: 'APPROVED' }
  );

  // Reject one experience bullet and mark one skill pending
  profile.facts['EXP-1-B1'].status = 'REJECTED';
  profile.facts['SKL-01'].status = 'PENDING';

  const payload = buildApprovedProfilePayload(profile);
  assert.equal(payload.approvedFactIndex['EXP-1-B1'], undefined);
  assert.equal(payload.approvedFactIndex['SKL-01'], undefined);
  assert.ok(payload.approvedFactIndex['EXP-1-B2']);

  // Verify private email and phone fact IDs are excluded from external AI payload
  const emailFactId = profile.header.factIds.email;
  const phoneFactId = profile.header.factIds.phone;
  assert.ok(emailFactId);
  assert.ok(phoneFactId);
  assert.equal(payload.approvedFactIndex[emailFactId!], undefined);
  assert.equal(payload.approvedFactIndex[phoneFactId!], undefined);
});

test('mergeExtractedIntoMasterProfile preserves approved facts, deduplicates items, and appends new PENDING facts', () => {
  const existing = buildMasterProfileFromExtracted(
    SAMPLE_CS_GRADUATE_EXTRACTED,
    'user_supplied_resume',
    { defaultStatus: 'APPROVED' }
  );
  // Clear portfolioUrl so merge can populate it without touching existing fullName
  const portfolioFactId = existing.header.factIds.portfolioUrl;
  if (portfolioFactId) {
    delete existing.facts[portfolioFactId];
    delete existing.header.factIds.portfolioUrl;
    existing.header.portfolioUrl = '';
    existing.idCounters = retireFactId(existing.idCounters, portfolioFactId);
  }
  const initialFactCount = Object.keys(existing.facts).length;
  const firstExp = SAMPLE_CS_GRADUATE_EXTRACTED.experience[0];

  const incoming = {
    header: {
      fullName: 'Different Name Should Not Overwrite',
      professionalTitle: '',
      email: '',
      phone: '',
      location: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: 'https://jordanrivera.dev',
    },
    education: [],
    experience: [
      {
        ...firstExp,
        bullets: [
          firstExp.bullets[0], // exact duplicate
          'Implemented Redis caching layer reducing p95 latency by 35%.', // brand new bullet
        ],
      },
      {
        company: 'Nova Systems',
        jobTitle: 'Backend Engineer',
        employmentType: 'Full-time',
        location: 'Austin, TX',
        startDate: 'Jan 2026',
        endDate: 'Present',
        bullets: ['Built event-driven billing pipeline using Go and Kafka.'],
      },
    ],
    projects: [],
    skills: [
      { name: 'python', category: 'Programming Languages' as const }, // case-insensitive duplicate
      { name: 'Go', category: 'Programming Languages' as const }, // new skill
    ],
    credentials: [
      {
        category: 'Certification' as const,
        title: 'aws certified cloud practitioner',
        issuer: 'Amazon Web Services',
        date: 'Mar 2025',
        detail: '',
      }, // case-insensitive duplicate
      {
        category: 'Award' as const,
        title: 'ACM Regional Hackathon Winner',
        issuer: 'ACM Northwest',
        date: 'Nov 2024',
        detail: '1st place out of 48 teams',
      }, // new credential
    ],
  };

  const result = mergeExtractedIntoMasterProfile(existing, incoming, 'pdf_upload');

  // Existing approved facts stay APPROVED and header fullName is untouched
  assert.equal(result.profile.header.fullName, existing.header.fullName);
  assert.equal(result.profile.header.portfolioUrl, 'https://jordanrivera.dev');
  assert.equal(result.profile.facts['EXP-1-B1'].status, 'APPROVED');

  // Retired portfolio fact ID is never reused
  if (portfolioFactId) {
    assert.notEqual(result.profile.header.factIds.portfolioUrl, portfolioFactId);
  }

  // Added: 1 header (portfolioUrl) + 1 bullet on EXP-1 + 1 meta & 1 bullet on EXP-3 + 1 skill (Go) + 1 credential (ACM) = 6
  assert.equal(result.addedFactsCount, 6);
  assert.ok(result.skippedDuplicatesCount >= 4);
  assert.equal(Object.keys(result.profile.facts).length, initialFactCount + 6);

  // All newly added facts must start as PENDING
  const newRole = result.profile.experience.find((e) => e.company === 'Nova Systems');
  assert.ok(newRole);
  assert.equal(result.profile.facts[newRole!.metaFactId].status, 'PENDING');
  assert.equal(result.profile.facts[newRole!.bulletFactIds[0]].status, 'PENDING');

  const goSkill = result.profile.skills.find((s) => s.name === 'Go');
  assert.ok(goSkill);
  assert.equal(result.profile.facts[goSkill!.factId].status, 'PENDING');

  const award = (result.profile.credentials ?? []).find((c) => c.title.includes('ACM Regional'));
  assert.ok(award);
  assert.equal(result.profile.facts[award!.factId].status, 'PENDING');
});
