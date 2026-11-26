import type { ApplicationBackupPayload, ApplicationSettings, VersionSnapshot } from '../types/history';
import type { MasterProfile } from '../types/profile';
import {
  isValidMasterProfile,
  isValidSettings,
  isValidVersionSnapshot,
} from '../utils/validators';

export const STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  profile: 'gen1resume:v1:profile',
  versions: 'gen1resume:v1:versions',
  settings: 'gen1resume:v1:settings',
} as const;

export const DEFAULT_SETTINGS: ApplicationSettings = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  theme: 'light',
  aiNoticeDismissed: false,
};

export interface StorageLoadResult<T> {
  data: T;
  corrupted: boolean;
  warning?: string;
}

function safeReadKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteKey(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadStoredProfile(): StorageLoadResult<MasterProfile | null> {
  const raw = safeReadKey(STORAGE_KEYS.profile);
  if (!raw) {
    return { data: null, corrupted: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidMasterProfile(parsed)) {
      return { data: parsed, corrupted: false };
    }
    return {
      data: null,
      corrupted: true,
      warning: 'Stored Master Profile data was outdated or incomplete and could not be loaded.',
    };
  } catch {
    return {
      data: null,
      corrupted: true,
      warning: 'Stored Master Profile JSON was corrupted. You can reset storage or import a backup.',
    };
  }
}

export function saveStoredProfile(profile: MasterProfile | null): boolean {
  try {
    if (!profile) {
      window.localStorage.removeItem(STORAGE_KEYS.profile);
      return true;
    }
    return safeWriteKey(STORAGE_KEYS.profile, JSON.stringify(profile));
  } catch {
    return false;
  }
}

export function loadStoredVersions(): StorageLoadResult<VersionSnapshot[]> {
  const raw = safeReadKey(STORAGE_KEYS.versions);
  if (!raw) {
    return { data: [], corrupted: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        data: [],
        corrupted: true,
        warning: 'Stored Version History had an invalid format and was skipped safely.',
      };
    }

    const recovered: VersionSnapshot[] = [];
    let droppedCount = 0;
    for (const item of parsed) {
      if (isValidVersionSnapshot(item)) {
        recovered.push(item);
      } else {
        droppedCount += 1;
      }
    }

    if (droppedCount > 0) {
      return {
        data: recovered,
        corrupted: true,
        warning: `Recovered ${recovered.length} valid version(s); ${droppedCount} corrupted history record(s) were skipped.`,
      };
    }

    return { data: recovered, corrupted: false };
  } catch {
    return {
      data: [],
      corrupted: true,
      warning: 'Stored Version History JSON was corrupted. Existing records could not be parsed.',
    };
  }
}

export function saveStoredVersions(versions: VersionSnapshot[]): boolean {
  return safeWriteKey(STORAGE_KEYS.versions, JSON.stringify(versions));
}

export function loadStoredSettings(): StorageLoadResult<ApplicationSettings> {
  const raw = safeReadKey(STORAGE_KEYS.settings);
  if (!raw) {
    return { data: { ...DEFAULT_SETTINGS }, corrupted: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidSettings(parsed)) {
      return {
        data: {
          schemaVersion: STORAGE_SCHEMA_VERSION,
          theme: parsed.theme,
          aiNoticeDismissed: Boolean(parsed.aiNoticeDismissed),
        },
        corrupted: false,
      };
    }
    return {
      data: { ...DEFAULT_SETTINGS },
      corrupted: true,
      warning: 'Stored application settings were malformed and reset to defaults.',
    };
  } catch {
    return {
      data: { ...DEFAULT_SETTINGS },
      corrupted: true,
      warning: 'Stored application settings JSON was corrupted and reset to defaults.',
    };
  }
}

export function saveStoredSettings(settings: ApplicationSettings): boolean {
  return safeWriteKey(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function resetAllStoredData(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.profile);
    window.localStorage.removeItem(STORAGE_KEYS.versions);
    window.localStorage.removeItem(STORAGE_KEYS.settings);
  } catch {
    // ignore storage errors
  }
}

export function buildBackupPayload(
  profile: MasterProfile | null,
  versions: VersionSnapshot[],
  settings: ApplicationSettings
): ApplicationBackupPayload {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Gen1Resume',
    profile,
    versions,
    settings,
  };
}

export function parseAndValidateBackupJson(rawText: string): {
  profile: MasterProfile | null;
  versions: VersionSnapshot[];
  settings: ApplicationSettings;
  warnings: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The selected backup file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid Gen1Resume backup file structure.');
  }

  const record = parsed as Record<string, unknown>;
  if (record.app !== 'Gen1Resume') {
    throw new Error('This file is not recognized as a Gen1Resume backup.');
  }

  const warnings: string[] = [];
  let profile: MasterProfile | null = null;
  if (record.profile !== null && record.profile !== undefined) {
    if (isValidMasterProfile(record.profile)) {
      profile = record.profile;
    } else {
      warnings.push('Master Profile inside backup failed schema validation and was skipped.');
    }
  }

  const versions: VersionSnapshot[] = [];
  if (Array.isArray(record.versions)) {
    let invalidVersions = 0;
    for (const v of record.versions) {
      if (isValidVersionSnapshot(v)) {
        versions.push(v);
      } else {
        invalidVersions += 1;
      }
    }
    if (invalidVersions > 0) {
      warnings.push(`${invalidVersions} invalid version snapshot(s) were skipped during import.`);
    }
  }

  const settings: ApplicationSettings = isValidSettings(record.settings)
    ? {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        theme: record.settings.theme,
        aiNoticeDismissed: Boolean(record.settings.aiNoticeDismissed),
      }
    : { ...DEFAULT_SETTINGS };

  return { profile, versions, settings, warnings };
}
