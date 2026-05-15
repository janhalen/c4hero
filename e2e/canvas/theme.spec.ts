import { test, expect } from '../fixtures/workspace'

type Page = import('@playwright/test').Page

async function openThemePicker(page: Page) {
  const settingsBtn = page.getByRole('button', { name: /canvas settings/i })
  await settingsBtn.first().click()
  // Theme picker trigger is a button with aria-haspopup="listbox". Click it
  // to open the popover with the option list.
  await page.locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Structurizr' }).waitFor({ state: 'visible' })
}

async function selectTheme(page: Page, name: string) {
  await openThemePicker(page)
  await page.getByRole('option', { name, exact: true }).click()
  await expect(page.locator('button[aria-haspopup="listbox"]')).toContainText(name)
  await page.keyboard.press('Escape')
}

async function switchToStructurizr(page: Page) {
  await selectTheme(page, 'Structurizr')
}

async function nodeBg(page: Page, name: string) {
  const node = page.locator('.react-flow__node').filter({
    has: page.getByText(name, { exact: true }),
  }).locator('.c4-node')
  await node.waitFor({ state: 'visible' })
  return node.evaluate((el) => getComputedStyle(el).backgroundColor)
}

async function canvasBg(page: Page) {
  const canvas = page.locator('.react-flow__background')
  await canvas.waitFor({ state: 'visible' })
  return canvas.evaluate((el) => getComputedStyle(el).backgroundColor)
}

async function boundaryChrome(page: Page) {
  const boundary = page.locator('.react-flow__node[data-id="__scope_boundary__internetBanking"] .c4-boundary-node')
  await boundary.waitFor({ state: 'visible' })
  return boundary.evaluate((el) => {
    const title = el.querySelector('span')
    const rootStyle = getComputedStyle(document.documentElement)
    return {
      borderColor: getComputedStyle(el).borderTopColor,
      titleColor: title ? getComputedStyle(title).color : '',
      boundaryBorderVar: rootStyle.getPropertyValue('--canvas-boundary-border').trim(),
      boundaryTitleVar: rootStyle.getPropertyValue('--canvas-boundary-title').trim(),
    }
  })
}

async function persistedTheme(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('c4hero.json')
    return raw ? (JSON.parse(raw) as { colorTheme?: string }).colorTheme : undefined
  })
}

test('theme switch changes internal node background', async ({ workspace, page }) => {
  await workspace.loadSample()
  const before = await nodeBg(page, 'Internet Banking System')
  await switchToStructurizr(page)
  const after = await nodeBg(page, 'Internet Banking System')
  expect(after).not.toBe(before)
})

test('theme switch also changes external node background', async ({ workspace, page }) => {
  await workspace.loadSample()
  const before = await nodeBg(page, 'Personal Banking Customer')
  await switchToStructurizr(page)
  const after = await nodeBg(page, 'Personal Banking Customer')
  expect(after).not.toBe(before)
})

test('theme picker applies the selected palette to canvas, built-in nodes, and settings', async ({ workspace, page }) => {
  await workspace.loadSample()
  await selectTheme(page, 'Light')

  await expect.poll(() => canvasBg(page)).toBe('rgb(248, 250, 252)')
  await expect.poll(() => nodeBg(page, 'Personal Banking Customer')).toBe('rgb(254, 243, 199)')
  await expect.poll(() => nodeBg(page, 'Customer Service Staff')).toBe('rgb(254, 243, 199)')
  await expect.poll(() => nodeBg(page, 'Internet Banking System')).toBe('rgb(219, 234, 254)')
  await expect.poll(() => nodeBg(page, 'Mainframe Banking System')).toBe('rgb(219, 234, 254)')
  await expect.poll(() => persistedTheme(page)).toBe('light')
})

test('light-backed themes keep scope boundaries visible before hover', async ({ workspace, page }) => {
  await workspace.loadSample()
  const containerView = await workspace.getViewByTitle('Containers')
  expect(containerView).toBeTruthy()
  await workspace.setView(containerView!.key)

  for (const theme of ['Light', 'Pastel', 'Sepia', 'Whiteboard', 'High contrast']) {
    await selectTheme(page, theme)
    await page.mouse.move(12, 12)

    const chrome = await boundaryChrome(page)
    expect(chrome.boundaryBorderVar, `${theme} should set a light-canvas boundary border`).not.toBe('')
    expect(chrome.boundaryTitleVar, `${theme} should set a light-canvas boundary title color`).not.toBe('')
    expect(chrome.borderColor, `${theme} should not use the old white glass border`).not.toBe('rgba(255, 255, 255, 0.08)')
    expect(chrome.titleColor, `${theme} should not use the old white ghost title`).not.toBe('rgba(255, 255, 255, 0.35)')
  }
})

test('theme switch refreshes nodes when a workspace carries legacy built-in palette styles', async ({ workspace, page }) => {
  await workspace.loadSample()
  await page.evaluate(() => {
    const store = (window as unknown as { __testStore?: () => { workspace: unknown; loadWorkspace: (workspace: unknown) => void } }).__testStore?.()
    if (!store?.workspace) throw new Error('Expected test workspace store')
    const cloned = structuredClone(store.workspace) as {
      views: { configuration: { styles: { elements: unknown[] } } }
    }
    cloned.views.configuration.styles.elements.push(
      { tag: 'Person', background: '#3a2a0a', color: '#fcd34d', stroke: '#f59e0b', shape: 'Person' },
    )
    store.loadWorkspace(cloned)
  })
  await page.waitForTimeout(200)

  const before = await nodeBg(page, 'Personal Banking Customer')
  await switchToStructurizr(page)
  const after = await nodeBg(page, 'Personal Banking Customer')
  expect(after).not.toBe(before)
})
