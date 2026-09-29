import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { freshnessOf, type Freshness } from './freshness'

const now = Date.parse('2026-09-29T18:00:00.000Z')

describe('freshnessOf', () => {
  test('missing heartbeat is offline', {
    given: {
      no_heartbeat,
    },
    when: {
      freshness_is_derived,
    },
    then: {
      freshness_is_offline,
    },
  })

  test('heartbeat at the five second mark is online', {
    given: {
      heartbeat_five_seconds_ago,
    },
    when: {
      freshness_is_derived,
    },
    then: {
      freshness_is_online,
    },
  })

  test('heartbeat older than five seconds is stale', {
    given: {
      heartbeat_older_than_five_seconds,
    },
    when: {
      freshness_is_derived,
    },
    then: {
      freshness_is_stale,
    },
  })

  test('unparseable heartbeat is offline', {
    given: {
      unparseable_heartbeat,
    },
    when: {
      freshness_is_derived,
    },
    then: {
      freshness_is_offline,
    },
  })
})

type Context = {
  lastHeartbeatAt: string | null
  now: number
  freshness: Freshness
}

function no_heartbeat(this: Context) {
  this.lastHeartbeatAt = null
  this.now = now
}

function heartbeat_five_seconds_ago(this: Context) {
  this.lastHeartbeatAt = new Date(now - 5_000).toISOString()
  this.now = now
}

function heartbeat_older_than_five_seconds(this: Context) {
  this.lastHeartbeatAt = new Date(now - 5_001).toISOString()
  this.now = now
}

function unparseable_heartbeat(this: Context) {
  this.lastHeartbeatAt = 'not-a-time'
  this.now = now
}

function freshness_is_derived(this: Context) {
  this.freshness = freshnessOf(this.lastHeartbeatAt, this.now)
}

function freshness_is_offline(this: Context) {
  expect(this.freshness).toBe('offline')
}

function freshness_is_online(this: Context) {
  expect(this.freshness).toBe('online')
}

function freshness_is_stale(this: Context) {
  expect(this.freshness).toBe('stale')
}
