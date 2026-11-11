import { expect, test } from '@playwright/test'

test('selected aircraft hit area, label and focus bounds stay compact through maximum zoom', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Select AXM518', exact: true }).click()
  await page.getByLabel('Focus selected aircraft', { exact: true }).click()
  const group = page.getByRole('button', { name: 'Target AXM518', exact: true })
  const dimensions = []
  for (let i = 0; i < 5; i++) {
    await group.focus()
    dimensions.push(
      await group.evaluate((e) => {
        const group = e.getBoundingClientRect(),
          hit = e.querySelector('.target-hit')!.getBoundingClientRect(),
          label = e.querySelector('.target-label-box')!.getBoundingClientRect()
        return { hit: hit.width, label: label.width, group: group.width }
      }),
    )
    await page.getByLabel('Zoom in', { exact: true }).click()
  }
  for (const d of dimensions) {
    expect(d.hit).toBeCloseTo(40, 0)
    expect(d.label).toBeCloseTo(dimensions[0].label, 0)
    expect(d.group).toBeLessThan(180)
  }
  await group.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Select AXM518', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('header and controls fit wide, laptop, tablet and phone widths', async ({ page }) => {
  await page.goto('/')
  for (const width of [1878, 1440, 1280, 1100, 1024, 900, 899, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    const controls = [
      page.getByLabel('Start simulation', { exact: true }),
      page.getByLabel('Transmit clearance', { exact: true }),
      page.getByLabel('Push to talk', { exact: true }),
      page.getByLabel('Search flight strips', { exact: true }),
    ]
    for (const control of controls) {
      await control.scrollIntoViewIfNeeded()
      const r = (await control.boundingBox())!
      expect(r.x).toBeGreaterThanOrEqual(-1)
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1)
      expect(r.width).toBeGreaterThan(30)
    }
    if (width >= 1100) {
      const chips = await page.locator('.runway-chip').evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect()
          return { y: r.y, bottom: r.bottom }
        }),
      )
      expect(Math.max(...chips.map((c) => c.y)) - Math.min(...chips.map((c) => c.y))).toBeLessThan(
        2,
      )
      const sim = (await page.getByLabel('Simulator controls').boundingBox())!
      expect(sim.y).toBeGreaterThanOrEqual(Math.max(...chips.map((c) => c.bottom)))
    }
  }
})

test('airport annotations do not overlap aircraft labels or each other after zoom and pan', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Select AXM518', exact: true }).click()
  await page.getByLabel('Focus selected aircraft').click()
  await page.getByLabel('Zoom in', { exact: true }).click()
  const boxes = await page.locator('[data-chart-label] rect,.target-label-box').evaluateAll((es) =>
    es.map((e) => {
      const r = e.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }),
  )
  expect(boxes.length).toBeGreaterThan(1)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j]
      expect(
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y,
      ).toBe(false)
    }
})
