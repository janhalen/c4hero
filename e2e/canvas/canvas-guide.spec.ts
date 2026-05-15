import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

async function selectTheme(page: Page, name: string) {
  await page.getByRole('button', { name: /canvas settings/i }).first().click()
  const settingsDialog = page.getByRole('dialog', { name: 'Canvas Settings' })
  await expect(settingsDialog).toBeVisible()
  await settingsDialog.locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name, exact: true }).click()
}

async function guideChrome(page: Page) {
  return page.locator('.canvas-guide').evaluate((guide) => {
    const icon = guide.querySelector<HTMLElement>('.canvas-guide-step-icon')
    const progress = guide.querySelector<HTMLElement>('.canvas-guide-progress span[data-active="true"]')
    const primary = guide.querySelector<HTMLElement>('.canvas-guide-primary')
    if (!icon || !progress || !primary) throw new Error('Expected canvas guide chrome')
    const iconStyle = getComputedStyle(icon)
    const progressStyle = getComputedStyle(progress)
    const primaryStyle = getComputedStyle(primary)
    return {
      iconBorder: iconStyle.borderTopColor,
      iconBackground: iconStyle.backgroundColor,
      iconColor: iconStyle.color,
      progressBackground: progressStyle.backgroundColor,
      primaryBackground: primaryStyle.backgroundColor,
    }
  })
}

test('canvas guide appears on first canvas load, dismisses persistently, and reopens later', async ({ workspace, page }) => {
  await workspace.loadSample({ showCanvasGuide: true })

  const guide = page.getByRole('dialog', { name: 'Canvas guide' })
  await expect(guide).toBeVisible()
  await expect(guide).toContainText('Add elements')

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(guide).toContainText('Connect nodes')

  await page.getByRole('button', { name: 'Dismiss canvas guide' }).click()
  await expect(guide).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem('c4hero.json')
    return raw ? (JSON.parse(raw) as { canvasGuideDismissed?: boolean }).canvasGuideDismissed : undefined
  })).toBe(true)

  await page.getByRole('button', { name: /canvas settings/i }).click()
  await page.getByRole('button', { name: 'Open canvas guide' }).click()
  await expect(guide).toBeVisible()
})

test('canvas guide keeps chrome styling when the canvas theme changes', async ({ workspace, page }) => {
  await workspace.loadSample({ showCanvasGuide: true })
  const guide = page.getByRole('dialog', { name: 'Canvas guide' })
  await expect(guide).toBeVisible()

  const before = await guideChrome(page)
  await selectTheme(page, 'Light')
  await expect.poll(() => guideChrome(page)).toEqual(before)
})
