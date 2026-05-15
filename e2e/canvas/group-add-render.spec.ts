import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/workspace'

async function getGroupDragPoint(page: Page, groupId: string) {
  return page.evaluate((id) => {
    const node = document.querySelector('[data-id="group-' + id + '"]') as HTMLElement | null
    if (!node) throw new Error('group node not found')
    const rect = node.getBoundingClientRect()
    const candidates = [
      { x: rect.right - 12, y: rect.bottom - 12 },
      { x: rect.left + 12, y: rect.top + 12 },
      { x: rect.left + rect.width / 2, y: rect.top + 12 },
      { x: rect.right - 12, y: rect.top + rect.height / 2 },
    ]
    for (const point of candidates) {
      const target = document.elementFromPoint(point.x, point.y) as HTMLElement | null
      if (target?.closest('[data-id="group-' + id + '"]')) return point
    }
    return candidates[0]
  }, groupId)
}

async function getNodeFlowPosition(page: Page, selector: string) {
  return page.evaluate((nodeSelector) => {
    const node = document.querySelector(nodeSelector) as HTMLElement | null
    if (!node) throw new Error(`node not found: ${nodeSelector}`)
    const transform = getComputedStyle(node).transform
    if (transform === 'none') return { x: 0, y: 0 }
    const matrix = new DOMMatrixReadOnly(transform)
    return { x: matrix.m41, y: matrix.m42 }
  }, selector)
}

/**
 * Regression: clicking Group on the multi-select bar in multi-select mode
 * created an empty group (or none at all) — the bar's button click never
 * fired its onClick.
 *
 * Root cause: FloatingInspector attaches a document `mousedown` listener
 * that calls `clearSelection()` whenever the click target is outside the
 * inspector AND not inside `.react-flow` or `[data-canvas-chrome]`. The
 * MultiSelectBar wasn't tagged as canvas chrome, so mousedown on its
 * Group button cleared `selectedElementIds`, the bar re-rendered with
 * count<2 and unmounted, and the click event never reached the button.
 *
 * Fix: tag the MultiSelectBar wrapper with data-canvas-chrome so the
 * outside-click handler treats it as canvas chrome.
 */
test.describe('group renders when added via multi-select bar', () => {
  test('addGroup followed by selectGroup (programmatic) renders the group', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    const groupId = await workspace.page.evaluate((ids) => {
      type S = {
        addGroup: (n: string, ids: string[]) => string
        selectGroup: (id: string) => void
      }
      const w = window as unknown as { __testStore?: () => S }
      const store = w.__testStore?.()
      if (!store) return null
      const id = store.addGroup('Smoke Group', ids)
      store.selectGroup(id)
      return id
    }, ['customer', 'internetBanking'])
    expect(groupId).toBeTruthy()

    const groupNode = workspace.page.locator(`[data-id="group-${groupId}"]`)
    await expect(groupNode).toHaveCount(1, { timeout: 3000 })
    await expect(groupNode).toBeVisible()
  })

  test('dragging a group moves all its members by the same delta and persists', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    const groupId = await workspace.page.evaluate((ids) => {
      type S = {
        addGroup: (n: string, ids: string[]) => string
        selectGroup: (id: string) => void
      }
      const w = window as unknown as { __testStore?: () => S }
      const s = w.__testStore?.()
      const id = s!.addGroup('Drag Test', ids)
      s!.selectGroup(id)
      return id
    }, ['customer', 'internetBanking'])
    expect(groupId).toBeTruthy()
    await workspace.page.waitForTimeout(400)
    await workspace.clearSelection()

    const before = await workspace.page.evaluate(() => {
      type WS = { views: { systemContextViews: Array<{ elements: Array<{ id: string; x?: number; y?: number }> }> } }
      const ws = (window as unknown as { __testGetWorkspace?: () => WS }).__testGetWorkspace?.()
      return ws!.views.systemContextViews[0].elements
        .filter((e) => e.id === 'customer' || e.id === 'internetBanking')
        .map((e) => ({ id: e.id, x: e.x ?? 0, y: e.y ?? 0 }))
    })

    // Drag from the group overlay on desktop; coarse-pointer/mobile overlay bodies are pass-through.
    const groupNode = workspace.page.locator(`[data-id="group-${groupId}"]`)
    const groupSurface = groupNode.locator('.c4-group-node')
    const borderBefore = await groupSurface.evaluate((el) => getComputedStyle(el).borderColor)
    const backgroundBefore = await groupSurface.evaluate((el) => getComputedStyle(el).backgroundColor)
    const dragPoint = await getGroupDragPoint(workspace.page, groupId)
    await workspace.page.mouse.move(dragPoint.x, dragPoint.y)
    await expect.poll(() => groupSurface.evaluate((el) => getComputedStyle(el).borderColor)).not.toBe(borderBefore)
    await expect.poll(() => groupSurface.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(backgroundBefore)

    const startX = dragPoint.x
    const startY = dragPoint.y
    await workspace.page.mouse.down()
    await workspace.page.mouse.move(startX + 200, startY + 100, { steps: 10 })
    await workspace.page.mouse.up()
    await workspace.page.waitForTimeout(400)

    const after = await workspace.page.evaluate(() => {
      type WS = { views: { systemContextViews: Array<{ elements: Array<{ id: string; x?: number; y?: number }> }> } }
      const ws = (window as unknown as { __testGetWorkspace?: () => WS }).__testGetWorkspace?.()
      return ws!.views.systemContextViews[0].elements
        .filter((e) => e.id === 'customer' || e.id === 'internetBanking')
        .map((e) => ({ id: e.id, x: e.x ?? 0, y: e.y ?? 0 }))
    })

    const a = before.find((p) => p.id === 'customer')!
    const a2 = after.find((p) => p.id === 'customer')!
    const b = before.find((p) => p.id === 'internetBanking')!
    const b2 = after.find((p) => p.id === 'internetBanking')!

    const dxA = a2.x - a.x
    const dyA = a2.y - a.y
    const dxB = b2.x - b.x
    const dyB = b2.y - b.y

    // Both members translated by IDENTICAL deltas (the whole cluster moved as a unit).
    expect(Math.abs(dxA - dxB)).toBeLessThan(1)
    expect(Math.abs(dyA - dyB)).toBeLessThan(1)
    // And they actually moved.
    expect(Math.abs(dxA)).toBeGreaterThan(50)
    expect(Math.abs(dyA)).toBeGreaterThan(25)
  })

  test('dragging a containing group moves nested group overlays while dragging', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    const { innerId, outerId } = await workspace.page.evaluate(() => {
      type S = {
        addGroup: (n: string, ids: string[]) => string
      }
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      if (!store) throw new Error('test store unavailable')
      return {
        innerId: store.addGroup('Nested Inner', ['customer', 'internetBanking']),
        outerId: store.addGroup('Nested Outer', ['customer', 'internetBanking', 'atm']),
      }
    })

    const innerGroup = workspace.page.locator(`[data-id="group-${innerId}"]`)
    const outerGroup = workspace.page.locator(`[data-id="group-${outerId}"]`)
    await expect(innerGroup).toBeVisible()
    await expect(outerGroup).toBeVisible()

    const innerPosition = await getNodeFlowPosition(workspace.page, `[data-id="group-${innerId}"]`)
    const outerPosition = await getNodeFlowPosition(workspace.page, `[data-id="group-${outerId}"]`)
    expect(innerPosition.y - outerPosition.y).toBeGreaterThanOrEqual(52)

    const beforeInnerBox = await innerGroup.boundingBox()
    if (!beforeInnerBox) throw new Error('inner group has no bounding box')

    const dragPoint = await getGroupDragPoint(workspace.page, outerId)
    await workspace.page.mouse.move(dragPoint.x, dragPoint.y)
    await workspace.page.mouse.down()
    await workspace.page.mouse.move(dragPoint.x + 180, dragPoint.y + 90, { steps: 10 })
    await workspace.page.waitForTimeout(100)

    const duringInnerBox = await innerGroup.boundingBox()
    if (!duringInnerBox) throw new Error('inner group disappeared during containing group drag')
    expect(duringInnerBox.x - beforeInnerBox.x).toBeGreaterThan(50)
    expect(duringInnerBox.y - beforeInnerBox.y).toBeGreaterThan(25)

    await workspace.page.mouse.up()
  })

  test('group bounds update while a member node is being dragged', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    const groupId = await workspace.page.evaluate((ids) => {
      type S = { addGroup: (n: string, ids: string[]) => string }
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      if (!store) throw new Error('test store unavailable')
      return store.addGroup('Live Member Drag', ids)
    }, ['customer', 'internetBanking'])

    const groupNode = workspace.page.locator(`[data-id="group-${groupId}"]`)
    const memberNode = await workspace.getNodeByName('Internet Banking System')
    await expect(groupNode).toBeVisible()
    await expect(memberNode).toBeVisible()

    const beforeGroupBox = await groupNode.boundingBox()
    const memberBox = await memberNode.boundingBox()
    if (!beforeGroupBox || !memberBox) throw new Error('group/member missing bounding box')

    const startX = memberBox.x + memberBox.width / 2
    const startY = memberBox.y + Math.min(memberBox.height / 2, 28)
    await workspace.page.mouse.move(startX, startY)
    await workspace.page.mouse.down()
    await workspace.page.mouse.move(startX + 220, startY + 90, { steps: 10 })
    await workspace.page.waitForTimeout(100)

    const duringGroupBox = await groupNode.boundingBox()
    const duringMemberBox = await memberNode.boundingBox()
    if (!duringGroupBox || !duringMemberBox) throw new Error('group/member missing during drag')

    expect(duringGroupBox.x + duringGroupBox.width).toBeGreaterThanOrEqual(duringMemberBox.x + duringMemberBox.width - 1)
    expect(duringGroupBox.x + duringGroupBox.width).toBeGreaterThan(beforeGroupBox.x + beforeGroupBox.width + 50)

    await workspace.page.mouse.up()
  })

  test('clicking Group on the multi-select bar in multi-select mode renders the group', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    // Toggle multi-select mode and click two nodes so the bar appears.
    await workspace.page.getByRole('button', { name: /Multi-select/ }).click()
    await workspace.clickNode('Personal Banking Customer')
    await workspace.clickNode('Internet Banking System')
    await expect(workspace.page.getByText('2 selected')).toBeVisible()

    // Click the Group button on the bar.
    await workspace.page.locator('button[title="Group 2 elements"]').click()

    // The new group should render.
    const groupNodes = workspace.page.locator('.react-flow__node[data-id^="group-"]')
    await expect(groupNodes).toHaveCount(1, { timeout: 3000 })
    await expect(groupNodes.first()).toBeVisible()

    // And the store should have the group with both selected elementIds.
    const storeGroups = await workspace.page.evaluate(() => {
      const w = window as unknown as { __testGetWorkspace?: () => { model?: { groups?: Array<{ elementIds: string[] }> } } }
      return w.__testGetWorkspace?.()?.model?.groups ?? []
    })
    expect(storeGroups).toHaveLength(1)
    expect(storeGroups[0].elementIds).toEqual(['customer', 'internetBanking'])
  })

  test('shift-clicking a group preserves the existing multi-node selection', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => (window as unknown as { __testSetView?: (k: string) => void }).__testSetView?.('SystemContext'))
    await workspace.page.waitForTimeout(300)

    const groupId = await workspace.page.evaluate((ids) => {
      type S = {
        addGroup: (name: string, ids: string[]) => string
        selectElements: (ids: string[]) => void
      }
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      if (!store) return null
      const id = store.addGroup('Selection Guard', ids)
      store.selectElements(ids)
      return id
    }, ['customer', 'internetBanking'])
    expect(groupId).toBeTruthy()

    const groupNode = workspace.page.locator(`[data-id="group-${groupId}"]`)
    const groupSurface = groupNode.locator('.c4-group-node')
    const customerSurface = workspace.page.locator('[data-id="customer"] .c4-node')
    const bankingSurface = workspace.page.locator('[data-id="internetBanking"] .c4-node')
    await expect(groupNode).toBeVisible()
    await expect(customerSurface).toHaveClass(/selected/)
    await expect(bankingSurface).toHaveClass(/selected/)

    const groupPoint = await getGroupDragPoint(workspace.page, groupId!)
    await workspace.page.keyboard.down('Shift')
    await workspace.page.mouse.click(groupPoint.x, groupPoint.y)
    await workspace.page.keyboard.up('Shift')

    await expect.poll(() => workspace.page.evaluate(() => {
      type S = { selectedElementIds: string[]; selectedGroupId: string | null }
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      return {
        selectedElementIds: store?.selectedElementIds ?? [],
        selectedGroupId: store?.selectedGroupId ?? null,
      }
    })).toEqual({
      selectedElementIds: ['customer', 'internetBanking'],
      selectedGroupId: null,
    })
    await expect(customerSurface).toHaveClass(/selected/)
    await expect(bankingSurface).toHaveClass(/selected/)
    await expect(groupSurface).not.toHaveClass(/selected/)
  })
})
