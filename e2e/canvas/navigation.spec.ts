import { test, expect } from '../fixtures/workspace'

test.describe('Canvas Navigation', () => {
  test('double-click drills into a system', async ({ workspace }) => {
    await workspace.loadSample()
    // Double-click Internet Banking System to drill into container view
    await workspace.doubleClickNode('Internet Banking System')
    // Should see container-level nodes like API Application
    const apiNode = await workspace.getNodeByName('API Application')
    await expect(apiNode).toBeVisible()
  })

  test('backspace navigates back', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.doubleClickNode('Internet Banking System')
    // Wait for drill-down to complete
    await expect(await workspace.getNodeByName('API Application')).toBeVisible()
    // Navigate back
    await workspace.page.keyboard.press('Backspace')
    // Should be back at landscape - ATM visible again
    const atm = await workspace.getNodeByName('ATM')
    await expect(atm).toBeVisible()
  })

  test('dragging inside a scoped view keeps the scope boundary visible and wrapping the content', async ({ workspace }) => {
    await workspace.loadSample()
    const containersView = await workspace.getViewByTitle('Containers')
    expect(containersView).toBeTruthy()
    await workspace.setView(containersView!.key)

    // Boundary IDs are now prefix-based (`__scope_boundary__<parentId>`) to
    // support per-system boundaries on multi-system Container views — match
    // the focal-system boundary (the only one in this single-system test) by
    // prefix instead of exact ID.
    const beforeBoundary = await workspace.page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id^="__scope_boundary__"]') as HTMLElement | null
      return node ? node.getBoundingClientRect() : null
    })
    expect(beforeBoundary).toBeTruthy()

    await workspace.dragNodeBy('Web Application', { x: 80, y: 40 })

    const boundaryState = await workspace.page.evaluate(() => {
      const boundary = document.querySelector('.react-flow__node[data-id^="__scope_boundary__"]') as HTMLElement | null
      const webApp = Array.from(document.querySelectorAll('.react-flow__node')).find((node) =>
        node.textContent?.includes('Web Application'),
      ) as HTMLElement | null
      if (!boundary || !webApp) {
        return { hasBoundary: !!boundary, hasWebApp: !!webApp }
      }
      const boundaryRect = boundary.getBoundingClientRect()
      const webAppRect = webApp.getBoundingClientRect()
      return {
        hasBoundary: true,
        hasWebApp: true,
        containsWebApp:
          webAppRect.left >= boundaryRect.left - 1 &&
          webAppRect.top >= boundaryRect.top - 1 &&
          webAppRect.right <= boundaryRect.right + 1 &&
          webAppRect.bottom <= boundaryRect.bottom + 1,
      }
    })

    expect(boundaryState).toMatchObject({ hasBoundary: true, hasWebApp: true, containsWebApp: true })
  })

  test('scope boundary adjusts while a contained node is being dragged', async ({ workspace }) => {
    await workspace.loadSample()
    const containersView = await workspace.getViewByTitle('Containers')
    expect(containersView).toBeTruthy()
    await workspace.setView(containersView!.key)
    await workspace.fitView()

    const containedNode = workspace.page.locator('.react-flow__node[data-id="database"]')
    const boundaryId = await workspace.page.evaluate(() => {
      const contained = document.querySelector('.react-flow__node[data-id="database"]')
      const containedRect = contained?.getBoundingClientRect()
      if (!containedRect) return null
      const boundaries = Array.from(document.querySelectorAll('.react-flow__node[data-id^="__scope_boundary__"]'))
      const match = boundaries.find((boundary) => {
        const rect = boundary.getBoundingClientRect()
        return (
          containedRect.left >= rect.left - 1 &&
          containedRect.top >= rect.top - 1 &&
          containedRect.right <= rect.right + 1 &&
          containedRect.bottom <= rect.bottom + 1
        )
      })
      return match?.getAttribute('data-id') ?? null
    })
    if (!boundaryId) throw new Error('database boundary not found')
    const boundary = workspace.page.locator(`.react-flow__node[data-id="${boundaryId}"]`)
    await expect(boundary).toBeVisible()
    await expect(containedNode).toBeVisible()

    const beforeBoundaryBox = await boundary.boundingBox()
    const containedNodeBox = await containedNode.boundingBox()
    if (!beforeBoundaryBox || !containedNodeBox) throw new Error('boundary/contained node missing bounding box')

    const startX = containedNodeBox.x + containedNodeBox.width / 2
    const startY = containedNodeBox.y + Math.min(containedNodeBox.height / 2, 28)
    await workspace.page.mouse.move(startX, startY)
    await workspace.page.mouse.down()
    await workspace.page.mouse.move(startX + 220, startY + 80, { steps: 10 })
    await workspace.page.waitForTimeout(100)

    const duringBoundaryBox = await boundary.boundingBox()
    const duringContainedNodeBox = await containedNode.boundingBox()
    if (!duringBoundaryBox || !duringContainedNodeBox) throw new Error('boundary/contained node missing during drag')

    expect(duringBoundaryBox.x + duringBoundaryBox.width).toBeGreaterThanOrEqual(
      duringContainedNodeBox.x + duringContainedNodeBox.width - 1,
    )
    expect(duringBoundaryBox.x + duringBoundaryBox.width).toBeGreaterThan(
      beforeBoundaryBox.x + beforeBoundaryBox.width + 30,
    )

    await workspace.page.mouse.up()
  })

  test('dragging inside one scope does not churn unrelated scope boundaries', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.page.evaluate(() => {
      type Store = {
        workspace: {
          model: {
            softwareSystems: Array<{
              id: string
              containers: Array<{ id: string; type: 'container'; name: string; tags: string[]; properties: Record<string, string>; components: [] }>
            }>
          }
          views: {
            containerViews: Array<{ key: string; elements: Array<{ id: string; x?: number; y?: number }> }>
          }
        } | null
        loadWorkspace: (workspace: NonNullable<Store['workspace']>) => void
      }
      const store = (window as unknown as { __testStore?: () => Store }).__testStore?.()
      if (!store?.workspace) throw new Error('test store unavailable')

      const next = structuredClone(store.workspace)
      const atm = next.model.softwareSystems.find((system) => system.id === 'atm')
      const containersView = next.views.containerViews.find((view) => view.key === 'Containers')
      if (!atm || !containersView) throw new Error('ATM system or Containers view not found')
      atm.containers.push({
        id: 'atmWebsite',
        type: 'container',
        name: 'ATM Website',
        tags: ['Element', 'Container', 'Web Application'],
        properties: {},
        components: [],
      })
      containersView.elements.push({ id: 'atmWebsite', x: -420, y: -260 })
      store.loadWorkspace(next)
    })
    const containersView = await workspace.getViewByTitle('Containers')
    expect(containersView).toBeTruthy()
    await workspace.setView(containersView!.key)

    const atmBoundary = workspace.page.locator('.react-flow__node[data-id="__scope_boundary__atm"]')
    const webApp = workspace.page.locator('.react-flow__node[data-id="webApp"]')
    await expect(atmBoundary).toBeVisible()
    await expect(webApp).toBeVisible()

    await workspace.page.evaluate(() => {
      const node = Array.from(document.querySelectorAll('.react-flow__node[data-id^="__scope_boundary__"]'))
        .find((candidate) => candidate.getAttribute('data-id') === '__scope_boundary__atm') as HTMLElement | undefined
      if (!node) throw new Error('ATM boundary not found')

      const records: Array<{ attributeName: string | null; oldValue: string | null; newValue: string | null }> = []
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName !== 'style' && mutation.attributeName !== 'class') continue
          records.push({
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue,
            newValue: node.getAttribute(mutation.attributeName),
          })
        }
      })
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'class'], attributeOldValue: true })
      const api = window as unknown as {
        __atmBoundaryMutationRecords?: () => Array<{ attributeName: string | null; oldValue: string | null; newValue: string | null }>
        __atmBoundaryDisconnect?: () => void
      }
      api.__atmBoundaryMutationRecords = () => records
      api.__atmBoundaryDisconnect = () => observer.disconnect()
    })

    const webAppBox = await webApp.boundingBox()
    if (!webAppBox) throw new Error('web app missing bounding box')
    const startX = webAppBox.x + webAppBox.width / 2
    const startY = webAppBox.y + Math.min(webAppBox.height / 2, 28)
    await workspace.page.mouse.move(startX, startY)
    await workspace.page.mouse.down()
    await workspace.page.mouse.move(startX + 180, startY + 80, { steps: 10 })
    await workspace.page.waitForTimeout(100)

    const mutationRecords = await workspace.page.evaluate(() => {
      const api = window as unknown as {
        __atmBoundaryMutationRecords?: () => Array<{ attributeName: string | null; oldValue: string | null; newValue: string | null }>
        __atmBoundaryDisconnect?: () => void
      }
      const records = api.__atmBoundaryMutationRecords?.() ?? []
      api.__atmBoundaryDisconnect?.()
      return records
    })
    await workspace.page.mouse.up()

    expect(mutationRecords).toEqual([])
  })

  test('scope boundary body stays pass-through over nested groups', async ({ workspace }) => {
    await workspace.loadSample()
    const containersView = await workspace.getViewByTitle('Containers')
    expect(containersView).toBeTruthy()
    await workspace.setView(containersView!.key)

    const groupId = await workspace.page.evaluate(() => {
      type S = { addGroup: (name: string, ids: string[]) => string }
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      if (!store) throw new Error('test store unavailable')
      return store.addGroup('Boundary Nested Group', ['webApp', 'apiApp'])
    })

    const groupNode = workspace.page.locator(`[data-id="group-${groupId}"]`)
    await expect(groupNode).toBeVisible()

    const titleGap = await workspace.page.evaluate((id) => {
      const boundary = document.querySelector('.react-flow__node[data-id^="__scope_boundary__"]') as HTMLElement | null
      const group = document.querySelector(`[data-id="group-${id}"]`) as HTMLElement | null
      if (!boundary || !group) throw new Error('boundary or group node not found')
      const positionOf = (element: HTMLElement) => {
        const transform = getComputedStyle(element).transform
        if (transform === 'none') return { x: 0, y: 0 }
        const matrix = new DOMMatrixReadOnly(transform)
        return { x: matrix.m41, y: matrix.m42 }
      }
      return positionOf(group).y - positionOf(boundary).y
    }, groupId)
    expect(titleGap).toBeGreaterThanOrEqual(60)

    const boundary = workspace.page.locator('.react-flow__node[data-id^="__scope_boundary__"]').first()
    await expect(boundary).toBeVisible()

    const passThrough = await boundary.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return {
        boundaryPointerEvents: getComputedStyle(element).pointerEvents,
        targetClass: target?.getAttribute('class') ?? '',
        targetNodeId: target?.closest('.react-flow__node')?.getAttribute('data-id') ?? null,
      }
    })
    expect(passThrough.boundaryPointerEvents).toBe('none')
    expect(passThrough.targetNodeId).not.toMatch(/^__scope_boundary__/)
  })

  test('undo/redo works', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.page.keyboard.press('Shift+P')
    const after = await workspace.getNodeCount()
    expect(after).toBe(1)
    // Undo
    await workspace.page.keyboard.press('Control+z')
    const afterUndo = await workspace.getNodeCount()
    expect(afterUndo).toBe(0)
    // Redo
    await workspace.page.keyboard.press('Control+Shift+z')
    const afterRedo = await workspace.getNodeCount()
    expect(afterRedo).toBe(1)
  })
})
