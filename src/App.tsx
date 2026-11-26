import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { TopNav, type AppPage } from './components/navigation/TopNav';
import { ToastContainer } from './components/shared/ToastContainer';
import { Button } from './components/shared/ui';
import { useMasterProfile } from './hooks/useMasterProfile';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useVersionHistory } from './hooks/useVersionHistory';
import { Dashboard } from './pages/Dashboard';
import { MasterProfilePage } from './pages/MasterProfile';
import { TailoringStudio, type ActiveWorkspaceState } from './pages/TailoringStudio';
import { VersionHistoryPage } from './pages/VersionHistory';
import { resetAllStoredData } from './services/storageService';
import type { VersionSnapshot } from './types/history';

const EMPTY_WORKSPACE: ActiveWorkspaceState = {
  jobDescription: {
    targetRole: '',
    companyName: '',
    rawText: '',
    focusDirective: '',
  },
  resume: null,
  auditReport: null,
  matchScoreResult: null,
  sourceFactIds: [],
  factsSnapshot: null,
  loadedVersionId: null,
  userEdits: [],
  hasUnsavedEdits: false,
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const { theme, settings, toggleTheme, replaceSettings } = useTheme();
  const { toasts, pushToast, dismissToast } = useToast();

  const masterProfile = useMasterProfile();
  const versionHistory = useVersionHistory();

  const [workspace, setWorkspace] = useState<ActiveWorkspaceState>(EMPTY_WORKSPACE);

  useEffect(() => {
    if (!workspace.hasUnsavedEdits) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workspace.hasUnsavedEdits]);

  const storageWarnings = [
    masterProfile.storageWarning,
    versionHistory.storageWarning,
  ].filter((w): w is string => Boolean(w));

  const handleOpenVersion = useCallback(
    (version: VersionSnapshot) => {
      // Restore exact immutable snapshot without regenerating or replacing historical facts
      setWorkspace({
        jobDescription: deepClone(version.jobDescription),
        resume: deepClone(version.resume),
        auditReport: deepClone(version.auditReport),
        matchScoreResult: deepClone(version.matchScoreResult),
        sourceFactIds: [...version.sourceFactIds],
        factsSnapshot: deepClone(version.profileSnapshot),
        loadedVersionId: version.versionId,
        userEdits: deepClone(version.userEdits),
        hasUnsavedEdits: false,
      });
      setActivePage('studio');
      pushToast(`Reopened "${version.targetRole}"`, {
        description: 'Restored exact saved snapshot and historical source facts.',
        tone: 'neutral',
      });
    },
    [pushToast]
  );

  const handleResetAllData = useCallback(() => {
    resetAllStoredData();
    masterProfile.commitProfile(null);
    masterProfile.clearStorageWarning();
    versionHistory.commitVersions([]);
    versionHistory.clearStorageWarning();
    setWorkspace(EMPTY_WORKSPACE);
  }, [masterProfile, versionHistory]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#09090B] dark:bg-[#09090B] dark:text-[#FAFAFA]">
      <TopNav
        activePage={activePage}
        onNavigate={setActivePage}
        profileStats={masterProfile.stats}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Corrupted localStorage Recovery Banner */}
      {storageWarnings.length > 0 && (
        <div
          role="alert"
          className="border-b border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-900/70 no-print"
        >
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#DC2626] dark:text-red-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Storage recovery notice</p>
                <p>{storageWarnings.join(' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  masterProfile.clearStorageWarning();
                  versionHistory.clearStorageWarning();
                }}
              >
                Dismiss
              </Button>
              <Button size="sm" variant="danger" onClick={handleResetAllData}>
                Reset Corrupted Data
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activePage === 'dashboard' && (
          <Dashboard
            profile={masterProfile.profile}
            profileStats={masterProfile.stats}
            versions={versionHistory.versions}
            averageVerificationScore={versionHistory.averageVerificationScore}
            latestActivityDate={versionHistory.latestActivityDate}
            onNavigate={setActivePage}
            onLoadSampleProfile={() => {
              masterProfile.loadSampleProfile();
              pushToast('Sample CS Graduate Profile loaded', {
                description: 'Review and approve facts in your Master Profile Vault.',
                tone: 'success',
              });
            }}
            onOpenVersion={handleOpenVersion}
          />
        )}

        {activePage === 'profile' && (
          <MasterProfilePage
            profile={masterProfile.profile}
            stats={masterProfile.stats}
            onReplaceFromExtracted={(data, source) => {
              masterProfile.replaceFromExtracted(data, source, false);
            }}
            onMergeFromExtracted={(data, source) =>
              masterProfile.mergeFromExtracted(data, source)
            }
            onLoadSample={masterProfile.loadSampleProfile}
            onSetFactStatus={masterProfile.setFactStatus}
            onApproveAllPending={masterProfile.approveAllPending}
            onEditFact={masterProfile.editFactContent}
            onDeleteFact={masterProfile.deleteFact}
            onUpsertHeaderField={masterProfile.upsertHeaderField}
            onAddManualFact={masterProfile.addManualFact}
            onAddExperienceEntry={masterProfile.addExperienceEntry}
            onAddProjectEntry={masterProfile.addProjectEntry}
            onAddEducationEntry={masterProfile.addEducationEntry}
            onAddCredentialEntry={masterProfile.addCredentialEntry}
            onGoToStudio={() => setActivePage('studio')}
            onNotify={pushToast}
          />
        )}

        {activePage === 'studio' && (
          <TailoringStudio
            profile={masterProfile.profile}
            profileStats={masterProfile.stats}
            workspace={workspace}
            onWorkspaceChange={setWorkspace}
            onSaveVersion={versionHistory.saveNewVersion}
            onGoToProfile={() => setActivePage('profile')}
            onNotify={pushToast}
          />
        )}

        {activePage === 'history' && (
          <VersionHistoryPage
            profile={masterProfile.profile}
            versions={versionHistory.versions}
            settings={settings}
            onOpenVersion={handleOpenVersion}
            onDuplicateVersion={versionHistory.duplicateVersion}
            onUpdateVersionTracking={versionHistory.updateVersionTracking}
            onDeleteVersion={versionHistory.deleteVersion}
            onRestoreBackup={(restored) => {
              masterProfile.commitProfile(restored.profile);
              versionHistory.commitVersions(restored.versions);
              replaceSettings(restored.settings);
            }}
            onResetAllData={handleResetAllData}
            onGoToStudio={() => setActivePage('studio')}
            onNotify={pushToast}
          />
        )}
      </main>

      <footer className="border-t border-[#E4E4E7] dark:border-[#27272A] py-4 no-print">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#71717A] dark:text-[#A1A1AA]">
          <span>Gen1Resume — Every tailored claim has evidence. Every piece of evidence has a source.</span>
          <span>Data stored locally in your browser · AI tailoring processed via Gemini</span>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
