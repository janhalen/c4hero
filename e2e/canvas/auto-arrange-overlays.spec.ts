import { test, expect } from '../fixtures/workspace'

type Rect = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type Overlap = {
  a: Rect
  b: Rect
}

function crowdedWorkspace() {
  const container = (id: string, name: string) => ({
    id,
    name,
    type: 'container',
    tags: ['Element', 'Container'],
    properties: {},
    components: [],
  })

  const system = (id: string, name: string, prefix: string) => ({
    id,
    name,
    type: 'softwareSystem',
    tags: ['Element', 'Software System'],
    properties: {},
    containers: [
      container(`${prefix}1`, `${name} API`),
      container(`${prefix}2`, `${name} Worker`),
      container(`${prefix}3`, `${name} Store`),
      container(`${prefix}4`, `${name} Admin`),
    ],
  })

  const systems = [
    system('sysA', 'Claims', 'a'),
    system('sysB', 'Billing', 'b'),
    system('sysC', 'Identity', 'c'),
    system('sysD', 'Partner', 'd'),
  ]
  const ids = systems.flatMap((item) => item.containers.map((container) => container.id))
  const relationships = [
    ['a1', 'b1'], ['b1', 'c1'], ['c1', 'd1'],
    ['a2', 'c2'], ['b2', 'd2'], ['a3', 'd3'],
    ['b3', 'c3'], ['d4', 'a4'], ['c4', 'b4'],
  ].map(([sourceId, destinationId], index) => ({
    id: `r${index + 1}`,
    sourceId,
    destinationId,
    description: 'Uses',
    tags: ['Relationship'],
    properties: {},
  }))

  return {
    name: 'Crowded overlays',
    model: {
      people: [],
      softwareSystems: systems,
      relationships,
      groups: [
        { id: 'groupA', name: 'Claims group', elementIds: ['a1', 'a2', 'a3'] },
        { id: 'groupB', name: 'Billing group', elementIds: ['b1', 'b2', 'b3'] },
        { id: 'groupC', name: 'Identity group', elementIds: ['c1', 'c2', 'c3'] },
        { id: 'groupD', name: 'Partner group', elementIds: ['d1', 'd2', 'd3'] },
        { id: 'workflow', name: 'Cross-system workflow', elementIds: ['a1', 'b1', 'c1', 'd1'] },
      ],
    },
    views: {
      systemLandscapeViews: [],
      systemContextViews: [],
      containerViews: [{
        type: 'container',
        key: 'Containers',
        title: 'Containers',
        softwareSystemId: 'sysA',
        elements: ids.map((id) => ({ id })),
        relationships: relationships.map((relationship) => ({ id: relationship.id })),
        autoLayout: { direction: 'TB' },
      }],
      componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  }
}

async function visibleOverlayOverlaps(page: import('@playwright/test').Page): Promise<Overlap[]> {
  return page.evaluate(() => {
    const rects = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
      .filter((element) => {
        const id = element.dataset.id ?? ''
        return id.startsWith('__scope_boundary__') || id.startsWith('group-')
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          id: element.dataset.id ?? '',
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)

    const overlaps: Overlap[] = []
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]
        const b = rects[j]
        const overlapsX = a.left < b.right - 1 && a.right > b.left + 1
        const overlapsY = a.top < b.bottom - 1 && a.bottom > b.top + 1
        const nested = (
          a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1
        ) || (
          b.left <= a.left + 1 && b.top <= a.top + 1 && b.right >= a.right - 1 && b.bottom >= a.bottom - 1
        )
        if (overlapsX && overlapsY && !nested) overlaps.push({ a, b })
      }
    }
    return overlaps
  })
}

test.describe('auto-arrange overlays', () => {
  test('keeps rendered groups and scope boundaries from overlapping', async ({ workspace, page }) => {
    await workspace.goto()
    await page.evaluate((input) => {
      const store = (window as unknown as {
        __testStore?: () => { loadWorkspace: (workspace: unknown) => void }
      }).__testStore?.()
      store?.loadWorkspace(input)
    }, crowdedWorkspace())
    await page.waitForURL(/\/collection\//)
    await page.locator('.react-flow').waitFor({ state: 'visible' })

    await workspace.relayout('TB')
    await expect.poll(() => page.locator('.react-flow__node[data-id^="__scope_boundary__"]').count()).toBe(4)
    await expect.poll(() => page.locator('.react-flow__node[data-id^="group-"]').count()).toBe(5)

    const overlaps = await visibleOverlayOverlaps(page)
    expect(overlaps.map((overlap) => [overlap.a.id, overlap.b.id])).toEqual([])
  })
})
