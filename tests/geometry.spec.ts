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
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(map).toContainText('C27')
  expect(await map.getAttribute('viewBox')).not.toBe(original)
  await page.getByRole('button', { name: 'Fit airport to display' }).click()
  await expect(map).toHaveAttribute('viewBox', original!)
  await page.getByRole('button', { name: 'Labels', exact: true }).click()
  await expect(map).not.toContainText('C27')
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
