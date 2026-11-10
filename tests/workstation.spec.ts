import { expect, test } from '@playwright/test'
import { createSession, sessionExport } from '../src/sim/engine'

test('controller selects an aircraft, transmits, and inspects a historical snapshot', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kuala Lumpur International' })).toBeVisible()
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Approve pushback' }).click()
  await expect(page.getByRole('textbox', { name: 'Controller transmission' })).toHaveValue(
    'MAS612, pushback approved',
  )
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('log', { name: 'Radio transcript' })).toContainText(
    'Pushback approved, Malaysian six one two.',
  )
  await page.getByRole('button', { name: 'Select MAS1134' }).click()
  await page.getByRole('button', { name: 'Switch to 118.500' }).click()
  await page.getByRole('button', { name: 'Clear to land' }).click()
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
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
  await page.getByRole('button', { name: 'Choose exercise', exact: true }).click()
  await page.getByRole('button', { name: /Readback discipline/ }).click()
  await expect(page.getByText('Readback discipline', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Instructor', exact: true }).click()
  await expect(page.getByRole('button', { name: /Incorrect runway readback/ })).toContainText(
    'Armed',
  )
  await page.getByRole('button', { name: /Runway obstruction/ }).click()
  await expect(page.getByText('RWY OCCUPIED', { exact: true })).toBeVisible()
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
  expect(JSON.parse(buffer.toString()).schema).toBe('vatsim-ai.session.v2')
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
    'version 0.2 moving-arrival model',
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
  await expect(page.getByText(/automatic go-around — landing clearance not received/)).toBeVisible()
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
  const footer = await page.locator('.status-bar').boundingBox()
  expect(command!.y + command!.height).toBeLessThanOrEqual(footer!.y)
})
