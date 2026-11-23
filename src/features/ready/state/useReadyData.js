import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import { cleanScores, emptyData, loadData, MAX_ATTEMPTS, normalizeData, saveData, STORAGE_KEY } from "./readyStore";

const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });

export function useReadyData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

  // Keep two open tabs in step.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        setData(normalizeData(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const change = useCallback(fn => setData(d => normalizeData(stamp(fn(d)))), []);

  const setJob = useCallback(jobId => change(d => ({ ...d, jobId })), [change]);
  const setProfile = useCallback(p => change(d => ({ ...d, profile: { ...d.profile, ...p } })), [change]);
  const savePlan = useCallback(plan => change(d => ({ ...d, plan })), [change]);
  const clearPlan = useCallback(() => change(d => ({ ...d, plan: null })), [change]);
  const toggleDone = useCallback(
    sessionId =>
      change(d => {
        if (!d.plan) return d;
        const completed = { ...d.plan.completed };
        if (completed[sessionId]) delete completed[sessionId];
        else completed[sessionId] = true;
        return { ...d, plan: { ...d.plan, completed } };
      }),
    [change],
  );

  const addAttempt = useCallback(
    attempt => {
      const clean = { id: `a${Date.now().toString(36)}`, note: "", ...attempt, scores: cleanScores(attempt.scores) };
      change(d => {
        const attempts = [clean, ...d.attempts.filter(a => a.id !== clean.id)].slice(0, MAX_ATTEMPTS);
        // A practice test on a plan day marks that day done.
        let plan = d.plan;
        if (plan && plan.jobId === clean.jobId && attempt.sessionId) plan = { ...plan, completed: { ...plan.completed, [attempt.sessionId]: true } };
        return { ...d, attempts, plan };
      });
      return clean;
    },
    [change],
  );
  const deleteAttempt = useCallback(id => change(d => ({ ...d, attempts: d.attempts.filter(a => a.id !== id) })), [change]);

  const syncStatus = useAccountSync("ready_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setJob, setProfile, savePlan, clearPlan, toggleDone, addAttempt, deleteAttempt };
}
