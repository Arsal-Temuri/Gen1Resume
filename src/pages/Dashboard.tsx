import React from 'react';
import { ArrowRight, Database, FileCheck2, FolderArchive, ShieldCheck } from 'lucide-react';
import type { ProfileStats } from '../hooks/useMasterProfile';
import type { VersionSnapshot } from '../types/history';
import type { MasterProfile } from '../types/profile';
import type { AppPage } from '../components/navigation/TopNav';
import { formatShortDate } from '../utils/textUtils';
import { Button, Card, EmptyState, ProgressBar, StatusPill } from '../components/shared/ui';

export const Dashboard: React.FC<{
  profile: MasterProfile | null;
  profileStats: ProfileStats;
  versions: VersionSnapshot[];
  averageVerificationScore: number | null;
  latestActivityDate: string | null;
  onNavigate: (page: AppPage) => void;
  onLoadSampleProfile: () => void;
  onOpenVersion: (version: VersionSnapshot) => void;
}> = ({
  profile,
  profileStats,
  versions,
  averageVerificationScore,
  latestActivityDate,
  onNavigate,
  onLoadSampleProfile,
  onOpenVersion,
}) => {
  const recentVersions = versions.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Header Hero */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#09090B] dark:text-[#FAFAFA] [text-wrap:balance]">
            Your experience. Precisely positioned.
          </h1>
          <p className="text-base text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Build targeted resumes from verified career facts. Every claim has a source.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {!profile && (
            <Button variant="secondary" onClick={() => onNavigate('profile')}>
              Set Up Master Profile
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => onNavigate(profileStats.isReadyForTailoring ? 'studio' : 'profile')}
          >
            <span>Create Tailored Resume</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* Four Compact Overview Cards */}
      <section aria-label="Workspace overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="space-y-2.5">
          <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA]">Master Profile</p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
              {profileStats.approvedFacts}{' '}
              <span className="text-xs font-sans font-normal text-[#71717A] dark:text-[#A1A1AA]">
                approved
              </span>
            </p>
            <span className="text-xs font-mono tabular-nums text-[#52525B] dark:text-[#A1A1AA]">
              {profileStats.completionPercent}%
            </span>
          </div>
          <ProgressBar
            percent={profileStats.completionPercent}
            label="Master Profile completion"
          />
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] font-mono tabular-nums">
            {profile
              ? `${profileStats.pendingFacts} pending · ${profileStats.totalFacts} total facts`
              : 'No profile created yet'}
          </p>
        </Card>

        <Card padding="md" className="space-y-2">
          <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA]">Resumes Created</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
            {versions.length}
          </p>
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
            {versions.length === 0
              ? 'No saved tailoring snapshots yet'
              : 'Immutable snapshots in Version History'}
          </p>
        </Card>

        <Card padding="md" className="space-y-2">
          <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA]">
            Average Verification
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
            {averageVerificationScore !== null ? `${averageVerificationScore}%` : '—'}
          </p>
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
            {averageVerificationScore !== null
              ? 'Across all saved audited versions'
              : 'Available after your first audited resume'}
          </p>
        </Card>

        <Card padding="md" className="space-y-2">
          <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA]">Latest Activity</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
            {latestActivityDate ? formatShortDate(latestActivityDate) : '—'}
          </p>
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] truncate">
            {versions[0]
              ? `${versions[0].targetRole} · ${versions[0].companyName}`
              : 'No tailoring runs recorded'}
          </p>
        </Card>
      </section>

      {/* First-Time Onboarding State */}
      {!profile ? (
        <section aria-label="Getting started">
          <Card padding="lg" surface="secondary" className="space-y-6">
            <div className="space-y-1.5 max-w-2xl">
              <h2 className="text-lg font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                Get started with a verified career vault
              </h2>
              <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                Gen1Resume never invents skills, metrics, or responsibilities. First, establish your approved Master Profile so every tailored resume bullet can be traced back to verified evidence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E4E7] dark:divide-[#27272A] border-t border-[#E4E4E7] dark:border-[#27272A] pt-5">
              <div className="py-3 md:py-0 md:pr-6 space-y-1.5">
                <p className="text-xs font-mono text-[#71717A]">01. Extract &amp; Index</p>
                <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Import your career history
                </h3>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Upload a PDF resume, paste existing text, or load the fictional CS Graduate sample profile.
                </p>
              </div>
              <div className="py-3 md:py-0 md:px-6 space-y-1.5">
                <p className="text-xs font-mono text-[#71717A]">02. Human Approval</p>
                <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Approve verified facts
                </h3>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Review each deterministic fact ID. Only explicitly approved facts can enter the AI tailoring pipeline.
                </p>
              </div>
              <div className="py-3 md:py-0 md:pl-6 space-y-1.5">
                <p className="text-xs font-mono text-[#71717A]">03. Two-Pass Verification</p>
                <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                  Tailor, audit, and export
                </h3>
                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Generate a targeted resume, verify every claim with an independent AI auditor, and export clean ATS files.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => onNavigate('profile')}>
                <FolderArchive className="w-4 h-4" aria-hidden="true" />
                Open Master Profile Vault
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onLoadSampleProfile();
                  onNavigate('profile');
                }}
              >
                <Database className="w-4 h-4" aria-hidden="true" />
                Load Sample CS Graduate Profile
              </Button>
            </div>
          </Card>
        </section>
      ) : (
        profileStats.pendingFacts > 0 &&
        profileStats.approvedFacts === 0 && (
          <Card
            padding="md"
            surface="secondary"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                Review and approve your extracted profile facts
              </h2>
              <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                You have <span className="font-mono tabular-nums font-medium">{profileStats.pendingFacts}</span>{' '}
                facts waiting for review. Approve at least one fact before generating a tailored resume.
              </p>
            </div>
            <Button variant="primary" onClick={() => onNavigate('profile')}>
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Review Pending Facts
            </Button>
          </Card>
        )
      )}

      {/* Recent Tailoring Activity */}
      <section aria-label="Recent tailoring activity" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]">
              Recent Tailoring Activity
            </h2>
            <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
              Reopen any saved snapshot to inspect lineage, refine wording, or export.
            </p>
          </div>
          {versions.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onNavigate('history')}>
              View All ({versions.length})
            </Button>
          )}
        </div>

        {recentVersions.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="w-6 h-6" />}
            title="No tailored resumes yet"
            description="Once you run the two-pass tailoring engine against a job description, each audited snapshot will appear here with its match and verification scores."
            action={
              <Button
                variant="primary"
                onClick={() => onNavigate(profileStats.isReadyForTailoring ? 'studio' : 'profile')}
              >
                {profileStats.isReadyForTailoring
                  ? 'Open Tailoring Studio'
                  : 'Approve Profile Facts First'}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121214]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#18181B] text-xs font-medium text-[#71717A] dark:text-[#A1A1AA]">
                  <th className="py-2.5 px-4">Target Role</th>
                  <th className="py-2.5 px-4">Company</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Match</th>
                  <th className="py-2.5 px-4 text-right">Verification</th>
                  <th className="py-2.5 px-4">Audit</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] text-sm">
                {recentVersions.map((ver) => (
                  <tr
                    key={ver.versionId}
                    className="hover:bg-[#FAFAFA] dark:hover:bg-[#18181B]/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-[#09090B] dark:text-[#FAFAFA]">
                      {ver.targetRole}
                    </td>
                    <td className="py-3 px-4 text-[#52525B] dark:text-[#A1A1AA]">
                      {ver.companyName}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-[#71717A] dark:text-[#A1A1AA] whitespace-nowrap">
                      {formatShortDate(ver.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                      {ver.matchScore}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
                      {ver.verificationScore}%
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill
                        status={
                          ver.auditStatus === 'CLEAN'
                            ? 'VERIFIED'
                            : ver.auditStatus === 'HAS_PARAPHRASED'
                              ? 'PARAPHRASED'
                              : 'UNSUPPORTED'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="secondary" onClick={() => onOpenVersion(ver)}>
                        Reopen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
