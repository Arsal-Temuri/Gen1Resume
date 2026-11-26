import React, { useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import type { ProfileStats } from '../../hooks/useMasterProfile';
import type { ThemePreference } from '../../types/history';
import { IconButton } from '../shared/ui';

export type AppPage = 'dashboard' | 'profile' | 'studio' | 'history';

const NAV_ITEMS: ReadonlyArray<{ id: AppPage; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Master Profile' },
  { id: 'studio', label: 'Tailoring Studio' },
  { id: 'history', label: 'Version History' },
] as const;

export const TopNav: React.FC<{
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  profileStats: ProfileStats;
  theme: ThemePreference;
  onToggleTheme: () => void;
}> = ({ activePage, onNavigate, profileStats, theme, onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (page: AppPage) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E4E7] dark:border-[#27272A] bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-xs no-print">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        {/* Zone 1: Brand mark */}
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="inline-flex items-center gap-2.5 text-[#09090B] dark:text-[#FAFAFA] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 rounded-md"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="5"
              className="fill-[#09090B] dark:fill-[#FAFAFA]"
            />
            <path
              d="M7.5 12.5L10.5 15.5L16.5 8.5"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-white dark:stroke-[#09090B]"
            />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight">Gen1Resume</span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleSelect(item.id)}
                className={`relative px-3.5 h-14 inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${
                  active
                    ? 'text-[#09090B] dark:text-[#FAFAFA]'
                    : 'text-[#52525B] hover:text-[#09090B] dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#09090B] dark:bg-[#FAFAFA]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quiet profile readiness text + theme toggle + mobile trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('profile')}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#52525B] hover:text-[#09090B] dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="font-mono tabular-nums font-medium text-[#09090B] dark:text-[#FAFAFA]">
              {profileStats.approvedFacts}
            </span>
            <span>approved</span>
            {profileStats.pendingFacts > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#D97706] dark:text-amber-400">
                  {profileStats.pendingFacts} pending
                </span>
              </>
            )}
          </button>

          <IconButton
            label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={onToggleTheme}
            size="sm"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </IconButton>

          <div className="md:hidden">
            <IconButton
              label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              size="sm"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </IconButton>
          </div>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#09090B] px-4 py-2 space-y-1"
        >
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FAFAFA] text-[#09090B] border border-[#E4E4E7] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:border-[#27272A]'
                    : 'text-[#52525B] hover:text-[#09090B] dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="px-3 py-2 text-xs text-[#71717A] dark:text-[#A1A1AA] border-t border-[#E4E4E7] dark:border-[#27272A] mt-1 pt-2">
            Profile vault: <span className="font-mono tabular-nums">{profileStats.approvedFacts}</span> approved ·{' '}
            <span className="font-mono tabular-nums">{profileStats.pendingFacts}</span> pending
          </div>
        </nav>
      )}
    </header>
  );
};
