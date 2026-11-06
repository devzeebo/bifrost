import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelEvalSuiteRun,
  getCapabilityEvalOutcomes,
  getEvalCaseRun,
  getEvalSuiteRun,
  listSkillVersions,
  runCapabilityEval,
  runCapabilitySuite,
} from './api'
import { neverRunOutcome } from './evalOutcome'
import type {
  CapabilityEvalOutcomes,
  EvalCaseRun,
  EvalLatestOutcome,
  SkillVersionSummary,
  SuiteEvalSummary,
} from './types'

export type SkillTarget = 'draft' | string

const emptySummary = (): SuiteEvalSummary => ({
  passed: 0,
  failed: 0,
  unsettled: 0,
  neverCompleted: 0,
  neverRun: 0,
})

export const useEvalRuns = (capabilityId: string) => {
  const [outcomes, setOutcomes] = useState<CapabilityEvalOutcomes | null>(null)
  const [skillVersions, setSkillVersions] = useState<readonly SkillVersionSummary[]>([])
  const [skillTarget, setSkillTarget] = useState<SkillTarget>('draft')
  const [caseRuns, setCaseRuns] = useState<ReadonlyMap<string, EvalCaseRun>>(new Map())
  const [busyEvalId, setBusyEvalId] = useState<string | null>(null)
  const [suiteBusy, setSuiteBusy] = useState(false)
  const [activeSuiteRunId, setActiveSuiteRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const [nextOutcomes, versions] = await Promise.all([
        getCapabilityEvalOutcomes(capabilityId),
        listSkillVersions(capabilityId),
      ])
      setOutcomes(nextOutcomes)
      setSkillVersions(versions)
      setError(null)

      const runs = new Map<string, EvalCaseRun>()
      await Promise.all(
        nextOutcomes.evals.map(async (item) => {
          if (item.caseRunId == null) {
            return
          }
          try {
            runs.set(item.evalId, await getEvalCaseRun(item.caseRunId))
          } catch {
            // Latest badge still works without the transcript payload.
          }
        }),
      )
      setCaseRuns(runs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load eval outcomes')
    }
  }, [capabilityId])

  useEffect(() => {
    void reload()
    return stopPolling
  }, [reload, stopPolling])

  const outcomeMap = useMemo(() => {
    const map = new Map<string, EvalLatestOutcome>()
    for (const item of outcomes?.evals ?? []) {
      map.set(item.evalId, item)
    }
    return map
  }, [outcomes])

  const criterionRollups = useMemo(() => {
    const map = new Map<string, CapabilityEvalOutcomes['criteria'][number]>()
    for (const item of outcomes?.criteria ?? []) {
      map.set(item.criterionId, item)
    }
    return map
  }, [outcomes])

  const skillVersionId = skillTarget === 'draft' ? null : skillTarget

  const applySuiteCases = useCallback((cases: readonly EvalCaseRun[]) => {
    setCaseRuns((current) => {
      const next = new Map(current)
      for (const run of cases) {
        next.set(run.evalId, run)
      }
      return next
    })
  }, [])

  const pollSuite = useCallback(
    (suiteRunId: string) => {
      stopPolling()
      pollRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const suite = await getEvalSuiteRun(suiteRunId)
            applySuiteCases(suite.cases)
            if (suite.status !== 'running') {
              stopPolling()
              setSuiteBusy(false)
              setActiveSuiteRunId(null)
              await reload()
            }
          } catch (err) {
            stopPolling()
            setSuiteBusy(false)
            setActiveSuiteRunId(null)
            setError(err instanceof Error ? err.message : 'Could not poll suite')
          }
        })()
      }, 750)
    },
    [applySuiteCases, reload, stopPolling],
  )

  const runCase = useCallback(
    async (evalId: string) => {
      setBusyEvalId(evalId)
      setError(null)
      try {
        const run = await runCapabilityEval({
          id: capabilityId,
          evalId,
          skillVersionId,
        })
        setCaseRuns((current) => {
          const next = new Map(current)
          next.set(evalId, run)
          return next
        })
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not run eval')
      } finally {
        setBusyEvalId(null)
      }
    },
    [capabilityId, reload, skillVersionId],
  )

  const runSuite = useCallback(async () => {
    setSuiteBusy(true)
    setError(null)
    try {
      const result = await runCapabilitySuite({
        id: capabilityId,
        skillVersionId,
      })
      setActiveSuiteRunId(result.suiteRunId)
      applySuiteCases(result.cases)
      pollSuite(result.suiteRunId)
    } catch (err) {
      setSuiteBusy(false)
      setActiveSuiteRunId(null)
      setError(err instanceof Error ? err.message : 'Could not run suite')
    }
  }, [applySuiteCases, capabilityId, pollSuite, skillVersionId])

  const cancelSuite = useCallback(async () => {
    if (activeSuiteRunId == null) {
      return
    }
    try {
      await cancelEvalSuiteRun(activeSuiteRunId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel suite')
    }
  }, [activeSuiteRunId])

  return {
    outcomes: outcomeMap,
    suiteSummary: outcomes?.suite ?? emptySummary(),
    criterionRollups,
    caseRuns,
    skillVersions,
    skillTarget,
    setSkillTarget,
    busyEvalId,
    suiteBusy,
    activeSuiteRunId,
    error,
    runCase,
    runSuite,
    cancelSuite,
    reload,
    outcomeFor: (evalId: string) => outcomeMap.get(evalId) ?? neverRunOutcome(),
  }
}
