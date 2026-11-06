export type LineDiff =
  | { readonly kind: 'same'; readonly text: string }
  | { readonly kind: 'added'; readonly text: string }
  | { readonly kind: 'removed'; readonly text: string }

/** Minimal line diff for read-only version compare. */
export const diffLines = (left: string, right: string): readonly LineDiff[] => {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')
  const max = Math.max(leftLines.length, rightLines.length)
  const rows: LineDiff[] = []

  for (let i = 0; i < max; i++) {
    const l = leftLines[i]
    const r = rightLines[i]
    if (l === undefined && r !== undefined) {
      rows.push({ kind: 'added', text: r })
    } else if (r === undefined && l !== undefined) {
      rows.push({ kind: 'removed', text: l })
    } else if (l === r) {
      rows.push({ kind: 'same', text: l ?? '' })
    } else {
      rows.push({ kind: 'removed', text: l ?? '' })
      rows.push({ kind: 'added', text: r ?? '' })
    }
  }

  return rows
}

export type CriterionDiff = {
  readonly id: string
  readonly leftStatement: string | null
  readonly rightStatement: string | null
}

export const diffCriteria = (
  left: readonly { readonly id: string; readonly statement: string }[],
  right: readonly { readonly id: string; readonly statement: string }[],
): readonly CriterionDiff[] => {
  const ids = [...new Set([...left.map((c) => c.id), ...right.map((c) => c.id)])]
  const leftById = new Map(left.map((c) => [c.id, c.statement]))
  const rightById = new Map(right.map((c) => [c.id, c.statement]))
  return ids.map((id) => ({
    id,
    leftStatement: leftById.get(id) ?? null,
    rightStatement: rightById.get(id) ?? null,
  }))
}

export const evalCountByCriterion = (
  evals: readonly { readonly criterionId: string }[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const item of evals) {
    counts.set(item.criterionId, (counts.get(item.criterionId) ?? 0) + 1)
  }
  return counts
}
