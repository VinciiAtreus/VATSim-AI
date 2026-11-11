import { expect, test } from '@playwright/test'
import { createSession, sessionExport, transmit } from '../src/sim/engine'

test('controller selects an aircraft, transmits, and inspects a historical snapshot', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'WMKK KUALA LUMPUR' })).toBeVisible()
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Approve pushback' }).click()
  await expect(page.getByRole('log', { name: 'Radio transcript' })).toContainText(
    'Pushback approved, Malaysian six one two.',
  )
  await page.getByRole('button', { name: 'Select MAS1134' }).click()
  await page.getByRole('button', { name: 'Switch to 118.500' }).click()
  await page.getByRole('button', { name: 'Clear to land' }).click()
  await expect(page.getByRole('log', { name: 'Radio transcript' })).toContainText('cleared to land')
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Instructions applied')
  await page.getByRole('button', { name: 'Review from beginning' }).click()
  await expect(page.getByText('SESSION REPLAY', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Transmit clearance' })).toBeDisabled()
  await page.getByRole('button', { name: 'Return to live' }).click()
  await expect(page.getByRole('button', { name: 'Resume exercise' })).toBeEnabled()
  expect(errors).toEqual([])
})

test('pseudo-pilot queue survives reload paused and executes once with operator attribution', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await page.getByRole('button', { name: 'Take over MAS612', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByLabel('Pending pilot instruction')).toContainText(
    'MAS612, pushback approved',
  )
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
  await expect(page.getByRole('log')).not.toContainText('Pushback approved, Malaysian six one two.')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await expect(page.getByLabel('Pending pilot instruction')).toContainText(
    'MAS612, pushback approved',
  )
  await expect(page.getByRole('button', { name: 'Execute & read back' })).toBeDisabled()
  await page.getByRole('button', { name: 'Resume exercise' }).click()
  await page.getByRole('button', { name: 'Execute & read back' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
  await expect(page.getByRole('log')).toContainText('OPERATOR')
  await expect(page.getByRole('button', { name: 'Execute & read back' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Freeze aircraft motion' }).click()
  await expect(page.getByRole('button', { name: 'Resume aircraft motion' })).toBeVisible()
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await page.getByRole('button', { name: 'Interventions', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('motion frozen by instructor')
  await expect(page.getByRole('dialog')).not.toContainText('Exercise loaded.')
})

test('instructor declines an instruction and transmits a radio-only pilot call', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await page.getByRole('button', { name: 'Take over MAS612', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await page.getByRole('button', { name: 'Unable / discard' }).click()
  await expect(page.getByRole('log')).toContainText('Unable, Malaysian six one two.')
  await page
    .getByRole('textbox', { name: 'Pilot radio call', exact: true })
    .fill('Malaysian six one two, request a delay for cabin checks.')
  await page.getByRole('button', { name: 'Send pilot call on 121.650' }).click()
  await expect(page.getByRole('log')).toContainText('request a delay for cabin checks')
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
  await page.getByRole('button', { name: 'Return to scripted pilot', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Take over MAS612', exact: true })).toBeVisible()
})

test('instructor notes link to inspected snapshots and persist in the debrief', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await page.getByRole('button', { name: 'Review from beginning' }).click()
  await page.getByRole('button', { name: 'Annotate event', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Observation note' })
    .fill('Review the initial traffic picture.')
  await page.getByLabel('Observation priority').selectOption('attention')
  await page.getByRole('button', { name: 'Add linked observation' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Observation linked to event #1.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await page.getByRole('button', { name: 'Observations', exact: true }).click()
  const note = page
    .getByRole('dialog')
    .getByRole('button', { name: /Review the initial traffic picture/ })
  await expect(note).toContainText('Linked to event #1')
  await note.click()
  await expect(page.getByRole('slider', { name: 'Replay event' })).toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Transmit clearance' })).toBeDisabled()
})

test('rejects a transmission on the wrong radio without moving the aircraft', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByLabel('Transmit frequency').selectOption('118.800')
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('alert')).toContainText('No response: MAS612 is on 121.650')
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
})

test('scenario selection, instructor event, search, and export are functional', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Simulator menu').click()
  await page.getByRole('button', { name: 'Choose exercise', exact: true }).click()
  await page.getByRole('button', { name: /Readback discipline/ }).click()
  await page.getByLabel('Simulator menu').click()
  await expect(page.getByText('Readback discipline', { exact: true })).toBeVisible()
  await page.getByLabel('Simulator menu').click()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await expect(page.getByRole('button', { name: /Incorrect runway readback/ })).toContainText(
    'Armed',
  )
  await page.getByRole('button', { name: /Runway obstruction/ }).click()
  await expect(page.locator('.safety-line')).toContainText('RWY OCCUPIED')
  await page.getByRole('textbox', { name: 'Search flight strips' }).fill('AXM')
  await expect(page.getByRole('button', { name: 'Select AXM518' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export session', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/wmkk–03-session-\d+s.json/)
})

test('mobile layout has no horizontal page overflow and supports dialog keyboard escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Command reference', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('automatically checkpoints a clearance and restores paused after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('log')).toContainText('Pushback approved, Malaysian six one two.')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await expect(
    page.getByText('Previous exercise restored paused. Resume when you are ready.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
  await expect(page.getByRole('button', { name: 'Resume exercise' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Pause exercise' })).toHaveCount(0)
  await expect(page.getByRole('log')).toContainText('Pushback approved, Malaysian six one two.')
})

test('imports an exported record into a separate paused copy and preserves checkpoints', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export session', exact: true }).click()
  const stream = await (await downloading).createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const buffer = Buffer.concat(chunks)
  expect(JSON.parse(buffer.toString()).schema).toBe('vatsim-ai.session.v3')
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await page
    .getByLabel('Import session JSON', { exact: true })
    .setInputFiles({ name: 'departure.json', mimeType: 'application/json', buffer })
  await expect(page.getByRole('dialog', { name: 'Restore this exercise?' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore paused', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
  await expect(page.getByRole('button', { name: 'Resume exercise' })).toBeEnabled()
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await expect(page.getByText('2 saved exercises', { exact: true })).toBeVisible()
})

test('rejects malformed imports and keeps the current exercise', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await page.getByLabel('Import session JSON', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  })
  await expect(page.getByRole('alert')).toContainText('not valid JSON')
  await expect(page.getByRole('dialog', { name: 'Saved exercises' })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
})

test('offers an explicit model migration for version 0.1 exports', async ({ page }) => {
  const legacy = JSON.parse(JSON.stringify(sessionExport(createSession())))
  legacy.schema = 'vatsim-ai.session.v1'
  legacy.session.version = 1
  delete legacy.engineVersion
  delete legacy.session.id
  await page.goto('/')
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await page.getByLabel('Import session JSON', { exact: true }).setInputFiles({
    name: 'v01.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  })
  await expect(page.getByRole('dialog', { name: 'Restore this exercise?' })).toContainText(
    'current model with scripted pilots',
  )
  await page.getByRole('button', { name: 'Restore paused', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start exercise', exact: true })).toBeEnabled()
})

test('storage failure is visible and leaves text training and export available', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }))
  await page.goto('/')
  await expect(
    page.getByText('Local storage is unavailable. You can still train and export JSON copies.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVE UNAVAILABLE',
  )
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('log')).toContainText('Pushback approved, Malaysian six one two.')
  await expect(page.getByRole('button', { name: 'Export session', exact: true })).toBeEnabled()
})

test('arrival progresses to a recorded automatic go-around when uncleared', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Select MAS1134' }).click()
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: '4×', exact: true }).click()
  await page.clock.runFor(19_000)
  await expect(page.getByRole('button', { name: 'Select MAS1134' })).toContainText('GOING AROUND')
  await page.getByRole('button', { name: /^Instructor/ }).click()
  await expect(
    page
      .locator('.observation')
      .filter({ hasText: 'automatic go-around — landing clearance not received' }),
  ).toBeVisible()
})

test('compact desktop keeps the transmission box above the status bar after recovery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 735 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await expect(
    page.getByText('Previous exercise restored paused. Resume when you are ready.'),
  ).toBeVisible()
  const command = await page.locator('.command-form').boundingBox()
  const footer = await page.locator('.equipment-footer').boundingBox()
  expect(command!.y + command!.height).toBeLessThanOrEqual(footer!.y)
})

test('oversized transmission is rejected and its checkpoint still recovers', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill(`MAS612, ${'x'.repeat(5000)}`)
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('alert')).toContainText('1,000-character limit')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await expect(
    page.getByText('Previous exercise restored paused. Resume when you are ready.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
})

test('browser history beyond the file-import limit can recover and restore independently', async ({
  page,
}) => {
  let long = createSession('departure')
  for (let i = 0; i < 1250; i++) long = transmit(long, 'MAS612, standby', '121.650').session
  const envelope = sessionExport(long)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.evaluate(async (envelope) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vatsim-ai-workstation', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('sessions', 'readwrite')
      transaction.objectStore('sessions').put({
        id: envelope.session.id,
        savedAt: new Date().toISOString(),
        scenarioId: envelope.session.scenarioId,
        elapsed: envelope.session.time,
        eventCount: envelope.session.events.length,
        envelope,
      })
      transaction.oncomplete = () => {
        db.close()
        resolve()
      }
      transaction.onabort = () => {
        db.close()
        reject(transaction.error)
      }
    })
  }, envelope)
  await page.reload()
  await expect(
    page.getByText('Previous exercise restored paused. Resume when you are ready.'),
  ).toBeVisible()
  await page.getByLabel('Simulator menu').click()
  await expect(page.getByRole('button', { name: 'Choose exercise' })).toContainText(
    'Departure fundamentals',
  )
  await page.getByLabel('Simulator menu').click()
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(`${long.events.length + 1} events`)
  await page.getByRole('button', { name: 'Restore Departure fundamentals', exact: true }).click()
  await page.getByRole('button', { name: 'Restore paused', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start exercise', exact: true })).toBeEnabled()
})

test('recovers a version 0.2 checkpoint with a migration notice and scripted defaults', async ({
  page,
}) => {
  const legacy = JSON.parse(JSON.stringify(sessionExport(createSession('departure'))))
  legacy.schema = 'vatsim-ai.session.v2'
  legacy.engineVersion = '0.2.0'
  legacy.session.version = 2
  const clean = (a: Record<string, unknown>) => {
    delete a.pilotMode
    delete a.motionPaused
  }
  legacy.session.aircraft.forEach(clean)
  legacy.session.events.forEach((e: { source?: string; snapshot: Record<string, unknown>[] }) => {
    delete e.source
    e.snapshot.forEach(clean)
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.evaluate(async (envelope) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('vatsim-ai-workstation', 1)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite')
      tx.objectStore('sessions').put({
        id: envelope.session.id,
        savedAt: new Date(Date.now() + 1000).toISOString(),
        scenarioId: envelope.session.scenarioId,
        elapsed: 0,
        eventCount: envelope.session.events.length,
        envelope,
      })
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error)
      }
    })
  }, legacy)
  await page.reload()
  await expect(
    page.getByText(/Legacy checkpoint migrated to the current model with scripted pilots/),
  ).toBeVisible()
  await page.getByLabel('Simulator menu').click()
  await expect(page.getByRole('button', { name: 'Choose exercise' })).toContainText(
    'Departure fundamentals',
  )
  await page.getByLabel('Simulator menu').click()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Take over MAS612', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start exercise', exact: true })).toBeEnabled()
})
