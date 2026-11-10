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
  const [busyEvalIds, setBusyEvalIds] = useState<ReadonlySet<string>>(new Set())
  const [suiteBusy, setSuiteBusy] = useState(false)
  const [activeSuiteRunId, setActiveSuiteRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const pollSuiteIdRef = useRef<string | null>(null)
  const reloadGeneration = useRef(0)
  const reloadRef = useRef<() => Promise<void>>(async () => {})

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    pollSuiteIdRef.current = null
  }, [])

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
      pollSuiteIdRef.current = suiteRunId
      pollRef.current = window.setInterval(() => {
        void (async () => {
          if (pollSuiteIdRef.current !== suiteRunId) {
            return
          }
          try {
            const suite = await getEvalSuiteRun(suiteRunId)
            if (pollSuiteIdRef.current !== suiteRunId) {
              return
            }
            applySuiteCases(suite.cases)
            if (suite.status !== 'running') {
              stopPolling()
              setSuiteBusy(false)
              setActiveSuiteRunId(null)
              await reloadRef.current()
            }
          } catch (err) {
            if (pollSuiteIdRef.current !== suiteRunId) {
              return
            }
            setError(err instanceof Error ? err.message : 'Could not poll suite')
          }
        })()
      }, 750)
    },
    [applySuiteCases, stopPolling],
  )

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current
    try {
      const [nextOutcomes, versions] = await Promise.all([
        getCapabilityEvalOutcomes(capabilityId),
        listSkillVersions(capabilityId),
      ])
      if (generation !== reloadGeneration.current) {
        return
      }
      setOutcomes(nextOutcomes)
      setSkillVersions(versions)
      setError(null)

      if (nextOutcomes.activeSuiteRunId != null) {
        setActiveSuiteRunId(nextOutcomes.activeSuiteRunId)
        setSuiteBusy(true)
        if (pollSuiteIdRef.current !== nextOutcomes.activeSuiteRunId) {
          pollSuite(nextOutcomes.activeSuiteRunId)
        }
      } else if (pollSuiteIdRef.current == null) {
        setActiveSuiteRunId(null)
        setSuiteBusy(false)
      }

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
      if (generation !== reloadGeneration.current) {
        return
      }
      setCaseRuns(runs)
    } catch (err) {
      if (generation !== reloadGeneration.current) {
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load eval outcomes')
    }
  }, [capabilityId, pollSuite])

  reloadRef.current = reload

  useEffect(() => {
    setOutcomes(null)
    setSkillVersions([])
    setSkillTarget('draft')
    setCaseRuns(new Map())
    setBusyEvalIds(new Set())
    setSuiteBusy(false)
    setActiveSuiteRunId(null)
    setError(null)
    stopPolling()
    void reload()
    return stopPolling
  }, [capabilityId, reload, stopPolling])

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

  const runCase = useCallback(
    async (evalId: string) => {
      setBusyEvalIds((current) => new Set(current).add(evalId))
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
        setBusyEvalIds((current) => {
          const next = new Set(current)
          next.delete(evalId)
          return next
        })
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
    busyEvalIds,
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
