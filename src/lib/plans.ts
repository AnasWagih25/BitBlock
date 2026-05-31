// ── BitBlock Plan & Limits ─────────────────────────────────
// Open-source model: everyone gets the same default limits.
// Admins can increase individual user limits via the admin dashboard,
// stored as `customLimits` on each user's Firestore document.

export type PlanId = 'free';

export interface PlanLimits {
  compilesPerDay: number;
  compilesPerMonth: number | null;  // null = unlimited (daily cap is the constraint)
  trainingJobsPerMonth: number;
  maxJobTimeSeconds: number;
  datasetStorageBytes: number;
  modelStorageBytes: number;
  deployedModels: number;
}

export interface PlanConfig extends PlanLimits {
  id: PlanId;
  name: string;
  color: string;
  icon: string;
  features: string[];
}

/**
 * Optional per-user overrides that admins can set.
 * Any field present here takes precedence over the default plan limits.
 */
export type CustomLimits = Partial<PlanLimits>;

const MB = 1024 * 1024;

export const DEFAULT_PLAN: PlanConfig = {
  id: 'free',
  name: 'Open Source',
  color: '#9D27DE',
  icon: '🧪',
  compilesPerDay: 6,
  compilesPerMonth: 40,
  trainingJobsPerMonth: 4,
  maxJobTimeSeconds: 120,
  datasetStorageBytes: 30 * MB,
  modelStorageBytes: 30 * MB,
  deployedModels: 1,
  features: [
    '6 compiles/day',
    '40 compiles/month',
    '4 training jobs/month',
    '2 min max job time',
    '30MB dataset storage',
    '30MB model storage',
    '1 deployed model',
  ],
};

// Keep backward compatibility — getPlanConfig always returns the default plan
export function getPlanConfig(_planId?: string | null): PlanConfig {
  return DEFAULT_PLAN;
}

/**
 * Returns the effective plan config with custom limit overrides applied.
 * Admins can set per-user overrides via the admin dashboard.
 */
export function getEffectivePlan(customLimits?: CustomLimits | null): PlanConfig {
  if (!customLimits) return DEFAULT_PLAN;

  const merged = { ...DEFAULT_PLAN };
  if (customLimits.compilesPerDay != null) merged.compilesPerDay = customLimits.compilesPerDay;
  if (customLimits.compilesPerMonth !== undefined) merged.compilesPerMonth = customLimits.compilesPerMonth;
  if (customLimits.trainingJobsPerMonth != null) merged.trainingJobsPerMonth = customLimits.trainingJobsPerMonth;
  if (customLimits.maxJobTimeSeconds != null) merged.maxJobTimeSeconds = customLimits.maxJobTimeSeconds;
  if (customLimits.datasetStorageBytes != null) merged.datasetStorageBytes = customLimits.datasetStorageBytes;
  if (customLimits.modelStorageBytes != null) merged.modelStorageBytes = customLimits.modelStorageBytes;
  if (customLimits.deployedModels != null) merged.deployedModels = customLimits.deployedModels;

  // Regenerate features list from merged values
  merged.features = [
    `${merged.compilesPerDay} compiles/day`,
    merged.compilesPerMonth != null ? `${merged.compilesPerMonth} compiles/month` : 'Unlimited compiles/month',
    `${merged.trainingJobsPerMonth} training jobs/month`,
    `${formatJobTime(merged.maxJobTimeSeconds)} max job time`,
    `${formatStorageSize(merged.datasetStorageBytes)} dataset storage`,
    `${formatStorageSize(merged.modelStorageBytes)} model storage`,
    `${merged.deployedModels} deployed model${merged.deployedModels !== 1 ? 's' : ''}`,
  ];

  return merged;
}

const GB = 1024 * MB;

export function formatStorageSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)}GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

export function formatJobTime(seconds: number): string {
  if (seconds >= 60) return `${Math.floor(seconds / 60)} min`;
  return `${seconds}s`;
}
