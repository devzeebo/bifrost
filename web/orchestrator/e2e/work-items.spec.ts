import { expect, test, type Route } from '@playwright/test'

const workItemId = '11111111-1111-1111-1111-111111111111'
const runId = '22222222-2222-2222-2222-222222222222'

test('work item detail shows runs and posts cancel', async ({ page }) => {
  const state = {
    status: 'claimed',
    holderId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' as string | null,
    posts: [] as string[],
  }

  await page.route(`**/get-tracked-work-item/${workItemId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: workItemId,
        status: state.status,
        holderId: state.holderId,
      }),
    })
  })
  await page.route('**/list-runs-for-work-item', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: runId,
            workItemId,
            position: 1,
            createdAt: '2026-11-09T12:00:00Z',
            outcome: null,
          },
        ],
      }),
    })
  })
  await page.route('**/cancel-tracked-work-item', async (route: Route) => {
    state.posts.push('cancel')
    state.status = 'canceled'
    state.holderId = null
    await route.fulfill({ status: 204 })
  })

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.goto(`/work-items/${workItemId}`)
  await expect(page.getByText('11111111')).toBeVisible()
  await expect(page.getByText('22222222')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect.poll(() => state.posts).toContain('cancel')
  await expect(page.getByText('canceled').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
})

test('work item detail posts release', async ({ page }) => {
  const state = {
    status: 'claimed',
    holderId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' as string | null,
    released: false,
  }

  await page.route(`**/get-tracked-work-item/${workItemId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: workItemId,
        status: state.status,
        holderId: state.holderId,
      }),
    })
  })
  await page.route('**/list-runs-for-work-item', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  })
  await page.route('**/release-tracked-work-item', async (route: Route) => {
    state.released = true
    state.status = 'pending'
    state.holderId = null
    await route.fulfill({ status: 204 })
  })

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.goto(`/work-items/${workItemId}`)
  await page.getByRole('button', { name: 'Release' }).click()
  await expect.poll(() => state.released).toBe(true)
  await expect(page.getByText('pending').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Release' })).toHaveCount(0)
})
