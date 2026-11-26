import React, { useState } from 'react';
import type { MatchScoreResult, RequirementMatchStatus } from '../../types/resume';
import { Card, FactIdBadge, SegmentedControl, StatusPill } from '../shared/ui';

export const ScoreCard: React.FC<{
  matchScoreResult: MatchScoreResult;
}> = ({ matchScoreResult }) => {
  const [filter, setFilter] = useState<'all' | RequirementMatchStatus>('all');

  const filteredReqs = matchScoreResult.deduplicatedRequirements.filter((r) =>
    filter === 'all' ? true : r.status === filter
  );

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
              Profile Match Score
            </h3>
            <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
              Deterministic weighted alignment based strictly on approved Master Profile facts. Not an ATS ranking guarantee.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-semibold font-mono tabular-nums text-[#09090B] dark:text-[#FAFAFA]">
              {matchScoreResult.overallScore}%
            </p>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] font-mono tabular-nums">
              {matchScoreResult.matchedCount} matched · {matchScoreResult.partialCount} partial ·{' '}
              {matchScoreResult.missingCount} missing
            </p>
          </div>
        </div>

        {/* Category Weight Breakdown */}
        <div className="space-y-2.5 pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]">
          {matchScoreResult.breakdown.map((cat) => {
            const pctOfCategory =
              cat.weightPercent > 0
                ? Math.min(100, Math.round((cat.earnedPercent / cat.weightPercent) * 100))
                : 0;
            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#09090B] dark:text-[#FAFAFA] font-medium truncate">
                    {cat.label}
                  </span>
                  <span className="font-mono tabular-nums text-[#52525B] dark:text-[#A1A1AA] whitespace-nowrap shrink-0">
                    {cat.totalCount === 0
                      ? 'Not in JD'
                      : `${cat.earnedPercent.toFixed(1)} / ${cat.weightPercent.toFixed(0)} pts (${cat.matchedCount}/${cat.totalCount})`}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-[#09090B] dark:bg-[#FAFAFA] transition-all duration-300"
                    style={{ width: `${cat.totalCount === 0 ? 0 : pctOfCategory}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Gap Analysis */}
      <Card padding="md" className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">
              Job Description Gap Analysis
            </h3>
            <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
              Every matched requirement links directly to approved evidence. Missing requirements remain uninvented.
            </p>
          </div>
          <SegmentedControl
            ariaLabel="Filter requirements by match status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: matchScoreResult.totalRequirements },
              { value: 'matched', label: 'Matched', count: matchScoreResult.matchedCount },
              { value: 'partially_matched', label: 'Partial', count: matchScoreResult.partialCount },
              { value: 'missing', label: 'Missing', count: matchScoreResult.missingCount },
            ]}
          />
        </div>

        <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] rounded-lg overflow-hidden">
          {filteredReqs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
              No requirements in this filter category.
            </p>
          ) : (
            filteredReqs.map((req) => (
              <div key={req.id} className="px-3.5 py-3 bg-white dark:bg-[#121214] space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA]">
                      {req.name}
                    </span>
                    <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                      · {req.importance === 'required' ? 'Required' : 'Preferred'}
                    </span>
                  </div>
                  <StatusPill status={req.status} />
                </div>

                <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  {req.rationale}
                </p>

                {req.supporting_fact_ids.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">Evidence:</span>
                    {req.supporting_fact_ids.map((fid) => (
                      <FactIdBadge key={fid} id={fid} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
