import type { ExtractedResumeData } from '../types/gemini';
import type { MasterProfile } from '../types/profile';
import { buildMasterProfileFromExtracted } from '../utils/factIds';

export const SAMPLE_CS_GRADUATE_EXTRACTED: ExtractedResumeData = {
  header: {
    fullName: 'Maya Chen (Sample Profile)',
    professionalTitle: 'Software Engineer — Backend & Applied AI',
    email: 'maya.chen.sample@example.com',
    phone: '(415) 555-0194',
    location: 'Seattle, WA',
    linkedinUrl: 'https://linkedin.com/in/maya-chen-sample',
    githubUrl: 'https://github.com/mayachen-sample',
    portfolioUrl: 'https://mayachen-sample.dev',
  },
  education: [
    {
      institution: 'Pacific State University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startDate: 'Sep 2021',
      graduationDate: 'May 2025',
      gpa: '3.84 / 4.00',
      relevantCoursework: [
        'Distributed Systems',
        'Database Management Systems',
        'Natural Language Processing',
        'Machine Learning',
        'Algorithms & Data Structures',
      ],
      academicAchievements: [
        "Dean's List Honors (7 of 8 semesters)",
        'Undergraduate Teaching Assistant for CS 320 Data Structures & Algorithms (Fall 2023 – Spring 2025)',
      ],
    },
  ],
  experience: [
    {
      company: 'Northwind Cloud Systems',
      jobTitle: 'Software Engineering Intern (Backend)',
      employmentType: 'Internship',
      location: 'Seattle, WA',
      startDate: 'May 2024',
      endDate: 'Aug 2024',
      bullets: [
        'Designed and shipped 6 RESTful API endpoints in Python and FastAPI for an internal billing reconciliation service processing 120,000 daily transactions.',
        'Optimized PostgreSQL queries with composite indexes and cursor-based pagination, reducing p95 invoice lookup latency from 480ms to 115ms.',
        'Containerized the reconciliation worker with Docker and added GitHub Actions integration tests, raising automated test coverage from 54% to 86%.',
        'Collaborated with 2 backend engineers during weekly sprint reviews to document OpenAPI schemas and troubleshoot production log anomalies.',
      ],
    },
    {
      company: 'Veridian Civic Tech',
      jobTitle: 'Software Developer Intern (Full-Stack)',
      employmentType: 'Internship',
      location: 'Portland, OR',
      startDate: 'May 2023',
      endDate: 'Aug 2023',
      bullets: [
        'Built responsive resident service request forms and status dashboards using React, TypeScript, and Tailwind CSS for a municipal portal serving 18,000 monthly visitors.',
        'Implemented Node.js and Express backend routes backed by PostgreSQL to support filtered search, CSV exports, and role-based staff views.',
        'Added Redis caching for frequently queried public permit schedules, cutting redundant database reads by 42% during peak morning traffic.',
      ],
    },
  ],
  projects: [
    {
      projectName: 'TriageNLP — Support Ticket Intent & Priority Classifier',
      description: 'End-to-end NLP classification pipeline that categorizes incoming software support tickets and flags urgent escalations.',
      technologies: ['Python', 'PyTorch', 'Hugging Face Transformers', 'FastAPI', 'PostgreSQL', 'Docker'],
      projectUrl: 'https://github.com/mayachen-sample/triage-nlp',
      bullets: [
        'Fine-tuned a DistilBERT multi-label classifier in PyTorch on 45,000 labeled open-source bug reports, achieving 0.89 macro-F1 on a held-out evaluation split.',
        'Exposed real-time inference through a FastAPI microservice packaged in Docker with batch request handling and 62ms median CPU inference latency.',
        'Built an evaluation harness logging precision, recall, and confusion matrices per category to detect label drift across model iterations.',
      ],
    },
    {
      projectName: 'DocGround — Citation-Backed Technical Q&A Engine',
      description: 'Retrieval-augmented generation prototype indexing developer documentation with sentence-level source verification.',
      technologies: ['TypeScript', 'React', 'Node.js', 'Python', 'pgvector', 'AWS S3'],
      projectUrl: 'https://github.com/mayachen-sample/docground',
      bullets: [
        'Implemented semantic chunking and dense vector retrieval over 3,200 Markdown documentation files using PostgreSQL with pgvector.',
        'Built a React and TypeScript inspection interface displaying exact source passages alongside generated answers to verify citation coverage.',
        'Evaluated retrieval recall@5 across a benchmark of 250 developer questions, improving top-5 recall from 71% to 88% via hybrid BM25 and vector reranking.',
      ],
    },
  ],
  skills: [
    { name: 'Python', category: 'Programming Languages' },
    { name: 'TypeScript', category: 'Programming Languages' },
    { name: 'JavaScript', category: 'Programming Languages' },
    { name: 'SQL', category: 'Programming Languages' },
    { name: 'Java', category: 'Programming Languages' },
    { name: 'FastAPI', category: 'Frameworks and Libraries' },
    { name: 'React', category: 'Frameworks and Libraries' },
    { name: 'Node.js', category: 'Frameworks and Libraries' },
    { name: 'Express', category: 'Frameworks and Libraries' },
    { name: 'PostgreSQL', category: 'Databases' },
    { name: 'Redis', category: 'Databases' },
    { name: 'pgvector', category: 'Databases' },
    { name: 'Docker', category: 'Cloud and DevOps' },
    { name: 'AWS (EC2, S3, RDS)', category: 'Cloud and DevOps' },
    { name: 'GitHub Actions', category: 'Cloud and DevOps' },
    { name: 'PyTorch', category: 'AI and Machine Learning' },
    { name: 'Hugging Face Transformers', category: 'AI and Machine Learning' },
    { name: 'scikit-learn', category: 'AI and Machine Learning' },
    { name: 'Git', category: 'Developer Tools' },
    { name: 'Linux', category: 'Developer Tools' },
    { name: 'REST APIs', category: 'Other Technical Skills' },
  ],
  credentials: [
    {
      category: 'Certification',
      title: 'AWS Certified Cloud Practitioner',
      issuer: 'Amazon Web Services',
      date: 'Mar 2025',
      detail: 'Cloud architecture, IAM, EC2, S3, and RDS fundamentals',
    },
    {
      category: 'Language',
      title: 'Mandarin Chinese',
      issuer: '',
      date: '',
      detail: 'Professional working proficiency',
    },
  ],
};

export function createSampleCsGraduateProfile(): MasterProfile {
  return buildMasterProfileFromExtracted(SAMPLE_CS_GRADUATE_EXTRACTED, 'sample_profile', {
    isSampleData: true,
    defaultStatus: 'PENDING',
  });
}

export const SAMPLE_JOB_DESCRIPTION = {
  targetRole: 'Backend Software Engineer (Python & Applied AI)',
  companyName: 'Helios Developer Platform',
  focusDirective:
    'Emphasize Python backend API engineering, PostgreSQL optimization, Docker CI/CD, and applied NLP/RAG projects with concrete benchmarks.',
  rawText: `About the Role:
We are hiring a Backend Software Engineer to build high-throughput APIs and applied NLP services powering developer triage and knowledge retrieval workflows.

Required Qualifications:
- Strong proficiency in Python and TypeScript for backend and web service development
- Experience designing and maintaining RESTful APIs with FastAPI or Node.js
- Solid understanding of SQL and PostgreSQL schema design, indexing, and query optimization
- Experience containerizing services with Docker and writing automated integration tests in CI/CD pipelines (GitHub Actions)
- Hands-on experience building or deploying NLP or machine learning systems (PyTorch, Transformers, or retrieval pipelines)
- Bachelor's degree in Computer Science or equivalent technical field

Preferred Qualifications:
- Experience with Redis caching and low-latency API optimization
- Familiarity with React for building internal developer tooling
- Exposure to AWS cloud infrastructure (EC2, S3, RDS)
- Experience with Kubernetes cluster administration and Go microservices
- Familiarity with Apache Kafka event streaming`,
};
