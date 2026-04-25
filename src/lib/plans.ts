// ── BitBlock Subscription Plans & Limits ──────────────────────
// Defines the four plan tiers and their resource ceilings.
// All storage values are in bytes for precision; use formatStorageSize() for display.

export type PlanId = 'free' | 'maker' | 'pro' | 'team';

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number;               // USD per month (0 for free)
  priceLabel: string;          // Display string, e.g. "$7/mo"
  color: string;               // Badge / accent color
  icon: string;                // Emoji for quick visual identification

  // ── Compilation Limits ──
  compilesPerDay: number;
  compilesPerMonth: number | null;  // null = unlimited (daily cap is the constraint)

  // ── ML Training Limits ──
  trainingJobsPerMonth: number;
  maxJobTimeSeconds: number;

  // ── Storage Limits ──
  datasetStorageBytes: number;
  modelStorageBytes: number;

  // ── Deployment Limits ──
  deployedModels: number;

  // ── Features ──
  features: string[];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free',
    color: '#6B7280',
    icon: '🔧',
    compilesPerDay: 3,
    compilesPerMonth: 20,
    trainingJobsPerMonth: 2,
    maxJobTimeSeconds: 60,
    datasetStorageBytes: 15 * MB,
    modelStorageBytes: 15 * MB,
    deployedModels: 0,
    features: [
      '3 compiles/day',
      '20 compiles/month',
      '2 training jobs/month',
      '60s max job time',
      '15MB dataset storage',
      '15MB model storage',
    ],
  },
  maker: {
    id: 'maker',
    name: 'Maker',
    price: 7,
    priceLabel: '$7/mo',
    color: '#3B82F6',
    icon: '⚡',
    compilesPerDay: 60,
    compilesPerMonth: null,
    trainingJobsPerMonth: 12,
    maxJobTimeSeconds: 10 * 60,
    datasetStorageBytes: 1 * GB,
    modelStorageBytes: 150 * MB,
    deployedModels: 2,
    features: [
      '60 compiles/day',
      '12 training jobs/month',
      '10 min max job time',
      '1GB dataset storage',
      '150MB model storage',
      '2 deployed models',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    priceLabel: '$15/mo',
    color: '#9D27DE',
    icon: '🚀',
    compilesPerDay: 120,
    compilesPerMonth: null,
    trainingJobsPerMonth: 30,
    maxJobTimeSeconds: 30 * 60,
    datasetStorageBytes: 8 * GB,
    modelStorageBytes: 800 * MB,
    deployedModels: 8,
    features: [
      '120 compiles/day',
      '30 training jobs/month',
      '30 min max job time',
      '8GB dataset storage',
      '800MB model storage',
      '8 deployed models',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 28,
    priceLabel: '$28/seat',
    color: '#F59E0B',
    icon: '👥',
    compilesPerDay: 200,
    compilesPerMonth: null,
    trainingJobsPerMonth: 40,
    maxJobTimeSeconds: 45 * 60,
    datasetStorageBytes: 15 * GB,
    modelStorageBytes: 3 * GB,
    deployedModels: 20,
    features: [
      '200 compiles/day',
      '40 training jobs/month',
      '45 min max job time',
      '15GB dataset storage (shared)',
      '3GB model storage (shared)',
      '20 deployed models (shared)',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'maker', 'pro', 'team'];

export function getPlanConfig(planId: string | undefined | null): PlanConfig {
  const id = (planId || 'free') as PlanId;
  return PLANS[id] || PLANS.free;
}

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

export function getSuggestedUpgradePlan(current: PlanId): PlanId | null {
  if (current === "free") return "maker";
  if (current === "maker") return "pro";
  return null; // never suggest team via upsell banner
}
