import { expect, test } from '@playwright/test'
import { createSession, sessionExport } from '../src/sim/engine'

test('shows the chart trace, reveals parking detail, and resets map fit', async ({ page }) => {
  await page.goto('/')
  const map = page.getByRole('img', { name: /Chart-transcribed airport layout/ })
  await expect(map).toBeVisible()
  await expect(map).toContainText('A11 HOLD')
  await expect(map).toContainText('Y9 HOLD')
  await expect(map).toContainText('T1 SATELLITE')
  await expect(map).toContainText('T2 SATELLITE')
  const original = await map.getAttribute('viewBox')
  await page.getByRole('button', { name: 'Focus selected aircraft' }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('.chart-screen-label.stand').first()).toBeVisible()
  expect(await map.getAttribute('viewBox')).not.toBe(original)
  await page.getByRole('button', { name: 'Fit airport to display' }).click()
  await expect(map).toHaveAttribute('viewBox', original!)
  await page.getByRole('button', { name: 'Labels', exact: true }).click()
  await expect(page.locator('.chart-screen-label.stand')).toHaveCount(0)
})

test('keeps incompatible schematic records and exports their original envelope', async ({
  page,
}) => {
  const session = createSession('departure')
  const envelope = {
    ...sessionExport(session),
    dataset: 'wmkk-schematic-0.1',
    engineVersion: '0.4.0',
  }
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.evaluate(
    async (saved) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('vatsim-ai-workstation', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction('sessions', 'readwrite')
          transaction.objectStore('sessions').put(saved)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      })
    },
    {
      id: session.id,
      savedAt: new Date().toISOString(),
      scenarioId: 'departure',
      elapsed: 0,
      eventCount: session.events.length,
      envelope,
    },
  )
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Older dataset · original retained')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export original Departure fundamentals' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(envelope)
  await page.getByRole('button', { name: 'Restore Departure fundamentals' }).click()
  await expect(page.getByRole('alert')).toContainText('incompatible with the chart-transcribed map')
  await expect(page.getByRole('dialog')).toContainText('Older dataset · original retained')
})

test('keeps aircraft cards and scale compact while gate labels remain upright at maximum zoom', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Select AXM518' }).click()
  await page.getByRole('button', { name: 'Focus selected aircraft' }).click()
  const card = page.locator('[data-aircraft="AXM518"] .target-label-box')
  const before = (await card.boundingBox())!
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const after = (await card.boundingBox())!
  expect(after.width).toBeCloseTo(before.width, 0)
  expect(after.width).toBeLessThanOrEqual(105)
  expect(after.height).toBeLessThanOrEqual(35)
  const gate = page.locator('text[data-gate="Q4"]')
  await expect(gate).toBeVisible()
  const gateBounds = (await gate.boundingBox())!
  expect(gateBounds.height).toBeGreaterThan(9)
  expect(gateBounds.height).toBeLessThan(22)
  const scale = page.locator('.map-scale')
  expect((await scale.boundingBox())!.width).toBeLessThan(120)
  await expect(scale).toContainText('m')
  await expect(page.getByText('Redcap five one eight', { exact: true })).toBeVisible()
})

test('retains a 0.5.0 checkpoint when recovering it into the updated motion model', async ({
  page,
}) => {
  const old = createSession('departure')
  const envelope = { ...sessionExport(old), engineVersion: '0.5.0' }
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.evaluate(
    async (saved) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('vatsim-ai-workstation', 1)
        request.onsuccess = () => {
          const db = request.result,
            t = db.transaction('sessions', 'readwrite')
          t.objectStore('sessions').put(saved)
          t.oncomplete = () => {
            db.close()
            resolve()
          }
          t.onerror = () => reject(t.error)
        }
        request.onerror = () => reject(request.error)
      })
    },
    {
      id: old.id,
      savedAt: new Date(Date.now() + 1000).toISOString(),
      scenarioId: 'departure',
      elapsed: 0,
      eventCount: old.events.length,
      envelope,
    },
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  const records = await page.evaluate(
    async () =>
      new Promise<any[]>((resolve, reject) => {
        const request = indexedDB.open('vatsim-ai-workstation', 1)
        request.onsuccess = () => {
          const db = request.result,
            t = db.transaction('sessions', 'readonly'),
            read = t.objectStore('sessions').getAll()
          t.oncomplete = () => {
            db.close()
            resolve(read.result)
          }
          t.onerror = () => reject(t.error)
        }
      }),
  )
  expect(records.find((r) => r.id === old.id).envelope).toEqual(envelope)
  expect(
    records.some(
      (r) =>
        r.id !== old.id && r.scenarioId === 'departure' && r.envelope.engineVersion === '0.6.0',
    ),
  ).toBe(true)
})
