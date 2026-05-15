import { test, expect } from '../fixtures/workspace'

test.describe('View Management', () => {
  test('creates a view from the switcher and activates it', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.openViewSwitcher()
    await workspace.page.getByRole('button', { name: 'New view' }).click()
    await expect(workspace.page.getByRole('dialog', { name: 'Create View' })).toBeVisible()

    await workspace.page.locator('#cv-type').selectOption({ label: 'System Context' })
    await workspace.page.locator('#cv-scope').selectOption({ label: 'Internet Banking System' })
    await workspace.page.locator('#cv-title').fill('Operations Context')
    await workspace.page.getByRole('button', { name: 'Create View' }).click()

    await expect(workspace.page.getByRole('button', { name: 'Switch view' })).toContainText('Operations Context')

    const createdView = await workspace.getViewByTitle('Operations Context')
    expect(createdView?.type).toBe('systemContext')
  })

  test('duplicates, renames, and deletes a view from the switcher', async ({ workspace }) => {
    await workspace.loadSample()

    await workspace.openViewSwitcher()
    await workspace.page.getByLabel('Duplicate view Containers').click({ force: true })
    await expect(workspace.page.getByRole('button', { name: 'Switch view' })).toContainText('Containers copy')

    await workspace.openViewSwitcher()
    await workspace.page.getByLabel('Rename view Containers copy').click({ force: true })
    const renameInput = workspace.page.locator('.shade-panel input').first()
    await expect(renameInput).toBeVisible()
    await renameInput.fill('Containers - Ops')
    await renameInput.press('Enter')
    await expect(workspace.page.getByRole('button', { name: 'Switch view' })).toContainText('Containers - Ops')

    await workspace.openViewSwitcher()
    await workspace.page.getByLabel('Delete view Containers - Ops').click({ force: true })
    await workspace.page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(workspace.page.getByRole('button', { name: 'Switch view' })).not.toContainText('Containers - Ops')

    const views = await workspace.getViews()
    expect(views.some((view) => view.title === 'Containers - Ops')).toBe(false)
    expect(views.filter((view) => view.title === 'Containers').length).toBe(1)
  })

  test('switching views updates the canvas and keeps the active view label in sync', async ({ workspace }) => {
    await workspace.loadSample()
    const landscapeNodes = await workspace.getNodeCount()
    const containersView = await workspace.getViewByTitle('Containers')
    expect(containersView).toBeTruthy()

    await workspace.setView(containersView!.key)
    await expect(workspace.page.getByRole('button', { name: 'Switch view' })).toContainText('Containers')

    const containerNodes = await workspace.getNodeCount()
    expect(containerNodes).toBeGreaterThan(0)
    expect(containerNodes).not.toBe(landscapeNodes)
  })

  test('fresh scoped Container views show the empty prompt inside the system boundary', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.createView('Container', 'ATM Containers', 'ATM')

    await expect(workspace.page.getByText('Start building your diagram')).not.toBeVisible()
    await expect(workspace.page.getByText('Add containers to this system')).toBeVisible()
    await expect(workspace.page.getByText('ATM', { exact: true })).toBeVisible()

    const boundary = workspace.page.locator('.react-flow__node[data-id^="__scope_boundary__"]').first()
    const boundarySurface = boundary.locator('.c4-boundary-node')
    const boundaryHandle = boundary.locator('.c4-overlay-drag-handle')
    await expect(boundary).toBeVisible()

    await expect.poll(async () => {
      const first = await boundary.boundingBox()
      await workspace.page.waitForTimeout(150)
      const second = await boundary.boundingBox()
      if (!first || !second) return Number.POSITIVE_INFINITY
      return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
    }).toBeLessThan(1)

    const beforeBox = await boundary.boundingBox()
    if (!beforeBox) {
      throw new Error('Empty scope boundary did not render with a measurable bounding box')
    }

    await workspace.page.mouse.move(6, 6)
    await expect.poll(() => boundarySurface.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none')

    const borderBefore = await boundarySurface.evaluate((element) => getComputedStyle(element).borderColor)
    const backgroundBefore = await boundarySurface.evaluate((element) => getComputedStyle(element).backgroundColor)
    const handleBox = await boundaryHandle.boundingBox()
    if (!handleBox) {
      throw new Error('Empty scope boundary did not render with a measurable drag handle')
    }
    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2

    await workspace.page.mouse.move(startX, startY)
    await expect.poll(() => boundarySurface.evaluate((element) => getComputedStyle(element).borderColor)).not.toBe(
      borderBefore,
    )
    await expect.poll(() => boundarySurface.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      backgroundBefore,
    )
    await expect.poll(() => boundarySurface.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none')

    await expect(boundary).toHaveCSS('pointer-events', 'none')
    await expect(workspace.page.getByText('Add containers to this system')).toBeVisible()
  })
})
