export const heartbeatFreshMs = 5_000

export const pollIntervalMs = 2_000

export type Freshness = 'online' | 'stale' | 'offline'

export type StatusTone = 'live' | 'stale' | 'quiet'

export const freshnessOf = (lastHeartbeatAt: string | null, now: number): Freshness => {
  const at = parseTime(lastHeartbeatAt)
  if (at === null) {
    return 'offline'
  }
  if (now - at <= heartbeatFreshMs) {
    return 'online'
  }
  return 'stale'
}

export const toneForFreshness = (freshness: Freshness): StatusTone => {
  switch (freshness) {
    case 'online':
      return 'live'
    case 'stale':
      return 'stale'
    case 'offline':
      return 'quiet'
  }
}

export const labelForFreshness = (freshness: Freshness): string => {
  switch (freshness) {
    case 'online':
      return 'Online'
    case 'stale':
      return 'Stale'
    case 'offline':
      return 'Offline'
  }
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

export const formatTime = (at: string | null): string => {
  const parsed = parseTime(at)
  if (parsed === null) {
    return '—'
  }
  return timeFormat.format(parsed)
}

const parseTime = (at: string | null): number | null => {
  if (at === null) {
    return null
  }
  const parsed = Date.parse(at)
  if (Number.isNaN(parsed)) {
    return null
  }
  return parsed
}
