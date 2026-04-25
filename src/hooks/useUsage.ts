import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPlanConfig } from '../lib/plans';
import type { PlanId } from '../lib/plans';

interface UsageData {
  compilesToday: number;
  compilesThisMonth: number;
  lastCompileDate: string;      // 'YYYY-MM-DD'
  lastCompileMonth: string;     // 'YYYY-MM'
  trainingJobsThisMonth: number;
  lastTrainingMonth: string;    // 'YYYY-MM'
}

const emptyUsage: UsageData = {
  compilesToday: 0,
  compilesThisMonth: 0,
  lastCompileDate: '',
  lastCompileMonth: '',
  trainingJobsThisMonth: 0,
  lastTrainingMonth: '',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in local
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Normalizes stale counters: if the date or month rolled over,
 * the relevant counters are reset to 0.
 */
function normalizeUsage(raw: UsageData): UsageData {
  const today = todayStr();
  const month = monthStr();
  return {
    compilesToday: raw.lastCompileDate === today ? raw.compilesToday : 0,
    compilesThisMonth: raw.lastCompileMonth === month ? raw.compilesThisMonth : 0,
    lastCompileDate: raw.lastCompileDate || today,
    lastCompileMonth: raw.lastCompileMonth || month,
    trainingJobsThisMonth: raw.lastTrainingMonth === month ? raw.trainingJobsThisMonth : 0,
    lastTrainingMonth: raw.lastTrainingMonth || month,
  };
}

export function useUsage(uid: string | undefined, planId: PlanId | string | undefined) {
  const [usage, setUsage] = useState<UsageData>(emptyUsage);
  const [loading, setLoading] = useState(true);
  const plan = getPlanConfig(planId);

  // Real-time listener on usage doc
  useEffect(() => {
    if (!uid) {
      setUsage(emptyUsage);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid, 'usage', 'current');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setUsage(normalizeUsage(snap.data() as UsageData));
        } else {
          setUsage(emptyUsage);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Usage listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // ── Compile Checks ──
  const remainingCompilesToday = Math.max(0, plan.compilesPerDay - usage.compilesToday);
  const remainingCompilesMonth = plan.compilesPerMonth != null
    ? Math.max(0, plan.compilesPerMonth - usage.compilesThisMonth)
    : Infinity;
  const canCompile = remainingCompilesToday > 0 && remainingCompilesMonth > 0;

  const compileBlockReason = !canCompile
    ? remainingCompilesToday <= 0
      ? `Daily compile limit reached (${plan.compilesPerDay}/day on ${plan.name}). Resets tomorrow.`
      : `Monthly compile limit reached (${plan.compilesPerMonth}/month on ${plan.name}). Resets next month.`
    : null;

  // ── Training Checks ──
  const remainingTrainingJobs = Math.max(0, plan.trainingJobsPerMonth - usage.trainingJobsThisMonth);
  const canStartTraining = remainingTrainingJobs > 0;

  const trainingBlockReason = !canStartTraining
    ? `Monthly training limit reached (${plan.trainingJobsPerMonth}/month on ${plan.name}). Resets next month.`
    : null;

  // ── Increment Functions ──
  const incrementCompileCount = useCallback(async () => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'usage', 'current');
    const today = todayStr();
    const month = monthStr();

    const snap = await getDoc(ref);
    const current = snap.exists() ? normalizeUsage(snap.data() as UsageData) : emptyUsage;

    await setDoc(ref, {
      compilesToday: (current.lastCompileDate === today ? current.compilesToday : 0) + 1,
      compilesThisMonth: (current.lastCompileMonth === month ? current.compilesThisMonth : 0) + 1,
      lastCompileDate: today,
      lastCompileMonth: month,
      trainingJobsThisMonth: current.lastTrainingMonth === month ? current.trainingJobsThisMonth : 0,
      lastTrainingMonth: current.lastTrainingMonth || month,
    });
  }, [uid]);

  const incrementTrainingCount = useCallback(async () => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'usage', 'current');
    const today = todayStr();
    const month = monthStr();

    const snap = await getDoc(ref);
    const current = snap.exists() ? normalizeUsage(snap.data() as UsageData) : emptyUsage;

    await setDoc(ref, {
      compilesToday: current.lastCompileDate === today ? current.compilesToday : 0,
      compilesThisMonth: current.lastCompileMonth === month ? current.compilesThisMonth : 0,
      lastCompileDate: current.lastCompileDate || today,
      lastCompileMonth: current.lastCompileMonth || month,
      trainingJobsThisMonth: (current.lastTrainingMonth === month ? current.trainingJobsThisMonth : 0) + 1,
      lastTrainingMonth: month,
    });
  }, [uid]);

  return {
    usage,
    loading,
    plan,
    canCompile,
    compileBlockReason,
    remainingCompilesToday,
    remainingCompilesMonth,
    canStartTraining,
    trainingBlockReason,
    remainingTrainingJobs,
    maxJobTimeSeconds: plan.maxJobTimeSeconds,
    incrementCompileCount,
    incrementTrainingCount,
  };
}
