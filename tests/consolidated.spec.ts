import { expect, test, type Page } from '@playwright/test'
const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([])
})
import { builtinExercise, exerciseExport } from '../src/sim/exercises'
import { createSession, sessionExport, tick, transmit } from '../src/sim/engine'

async function lessonWorkshop(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Choose exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Create a lesson', exact: true }).click()
  return page.getByRole('dialog', { name: 'Exercise workshop', exact: true })
}
async function importLesson(
  page: import('@playwright/test').Page,
  exercise: ReturnType<typeof builtinExercise>,
) {
  const dialog = await lessonWorkshop(page)
  await dialog.getByLabel('Import lesson JSON').setInputFiles({
    name: 'lesson.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exerciseExport(exercise))),
  })
  await dialog.getByRole('button', { name: 'Run this lesson', exact: true }).click()
}

test('authors, saves, reloads and runs a lesson with weather, scheduled traffic and timed events', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  const dialog = await lessonWorkshop(page)
  await dialog
    .getByRole('textbox', { name: 'Lesson title', exact: true })
    .fill('Batch integration lesson')
  await dialog.getByLabel('QNH (hPa)', { exact: true }).fill('1004')
  await dialog.getByLabel('Information identifier').selectOption('C')
  await dialog.getByLabel('MAS612 release time').fill('20')
  await dialog.getByRole('button', { name: 'Add timed event', exact: true }).click()
  await dialog.getByLabel('Event 1 time').fill('1')
  await dialog.getByLabel('Event 1 runway').selectOption('32L')
  await dialog.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Saved revision 1')
  await page.reload()
  await page.getByRole('button', { name: 'Choose exercise', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Batch integration lesson')
  await page.getByRole('button', { name: 'Load lesson', exact: true }).click()
  await expect(page.getByText('Batch integration lesson', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('SCHEDULED')
  await expect(page.locator('.map-weather')).toContainText('QNH 1004 · INFO C')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.clock.runFor(1100)
  await expect(page.getByText('RWY OCCUPIED', { exact: true })).toBeVisible()
  await page.clock.runFor(20000)
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
  await expect(page.getByRole('log')).toContainText('information Charlie')
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await expect(page.getByText('Batch integration lesson', { exact: true })).toBeVisible()
  await expect(page.getByText('RWY OCCUPIED', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume exercise' })).toBeEnabled()
})

test('checks lesson imports and creates independent revisions without changing an active session', async ({
  page,
}) => {
  await page.goto('/')
  const dialog = await lessonWorkshop(page)
  await dialog
    .getByLabel('Import lesson JSON')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') })
  await expect(dialog.getByRole('alert')).toContainText('not valid JSON')
  await expect(dialog.getByRole('textbox', { name: 'Lesson title', exact: true })).toHaveValue(
    'New WMKK lesson',
  )
  await dialog.getByRole('textbox', { name: 'Lesson title', exact: true }).fill('Versioned lesson')
  await dialog.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await dialog.getByRole('button', { name: 'Run this lesson', exact: true }).click()
  await page.getByRole('button', { name: 'Choose exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Versioned lesson', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Lesson title', exact: true })
    .fill('Revised library lesson')
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Saved revision 2')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByText('Versioned lesson', { exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export session', exact: true }).click()
  const stream = await (await download).createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(JSON.parse(Buffer.concat(chunks).toString()).session.exercise.revision).toBe(1)
})

test('coordinates with a manual adjacent station before transferring radio ownership', async ({
  page,
}) => {
  const exercise = {
    ...builtinExercise('departure'),
    id: 'custom-coordination',
    requireCoordination: true,
    automaticCoordination: false,
  }
  let session = createSession('', exercise)
  session = transmit(session, 'MAS612, pushback approved', '121.650').session
  session = tick({ ...session, running: true }, 35)
  session = transmit(session, 'MAS612, taxi runway 32R via A', '121.650').session
  session = tick(session, 140)
  const buffer = Buffer.from(JSON.stringify(sessionExport(session)))
  await page.goto('/')
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await page
    .getByLabel('Import session JSON', { exact: true })
    .setInputFiles({ name: 'coordination.json', mimeType: 'application/json', buffer })
  await page.getByRole('button', { name: 'Restore paused', exact: true }).click()
  await page.getByRole('button', { name: 'Resume exercise' }).click()
  await page.getByRole('button', { name: 'Transfer to tower', exact: true }).click()
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('alert')).toContainText('Exercise coordination required')
  await page
    .getByRole('button', { name: 'Request adjacent-station acceptance', exact: true })
    .click()
  await page.getByRole('button', { name: /^Instructor/ }).click()
  await page.getByRole('button', { name: 'Accept MAS612', exact: true }).click()
  await page.getByRole('button', { name: 'Aircraft', exact: true }).click()
  await expect(page.getByLabel('Adjacent station coordination')).toContainText('approved')
  await page.getByRole('button', { name: 'Transfer to tower', exact: true }).click()
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('118.800')
})

test('records a manual assessment and exports a printable report and spreadsheet-safe radio CSV', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await page.getByRole('button', { name: 'Manual assessment', exact: true }).click()
  await page.getByLabel('Reviewer name').fill('Instructor Demo')
  await page.getByLabel('Manual rating').selectOption('needs-review')
  await page.getByLabel('Assessment rationale').fill('Review the initial clearance picture.')
  await page.getByRole('button', { name: 'Record manual assessment', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Manual assessment recorded' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByRole('button', { name: 'Local save status' })).toContainText(
    'SAVED LOCALLY',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  const reportDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export printable report', exact: true }).click()
  const report = await reportDownload
  expect(report.suggestedFilename()).toMatch(/-report.html$/)
  const stream = await report.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const html = Buffer.concat(chunks).toString()
  expect(html).toContain('Instructor Demo')
  expect(html).toContain('needs-review')
  expect(html).toContain('href="#event-')
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export radio CSV', exact: true }).click()
  expect((await csvDownload).suggestedFilename()).toMatch(/-radio.csv$/)
})

test('plays captured snapshots and remains paused on returning to live', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await page.getByRole('button', { name: 'Review from beginning', exact: true }).click()
  await page.getByRole('combobox', { name: 'Replay events per second' }).selectOption('4')
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Replay event' })).not.toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Transmit clearance' })).toBeDisabled()
  await page.getByRole('button', { name: 'Return to live', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause exercise' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start exercise', exact: true })).toBeEnabled()
})

test('voice prepares a reviewable draft and requires a separate transmit action', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { SpeechRecognition: unknown }
    w.SpeechRecognition = class {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {}
      abort() {
        this.onend?.()
      }
      stop() {
        this.onresult?.({
          results: [{ isFinal: true, 0: { transcript: 'MAS612, pushback approved' } }],
        })
        this.onend?.()
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Transmit clearance' })).toBeDisabled()
  await page.getByRole('button', { name: 'Stop voice capture', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Controller transmission' })).toHaveValue(
    'MAS612, pushback approved',
  )
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
})

test('voice permission failure leaves text control available', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { SpeechRecognition: unknown; voiceAborted: boolean }
    w.voiceAborted = false
    w.SpeechRecognition = class {
      lang = ''
      continuous = false
      interimResults = false
      onresult: null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        this.onerror?.({ error: 'not-allowed' })
        this.onend?.()
      }
      stop() {
        this.onend?.()
      }
      abort() {
        w.voiceAborted = true
        this.onend?.()
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('permission was denied')
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
})

test('lesson editor remains usable at narrow viewport widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const dialog = await lessonWorkshop(page)
  await dialog.getByRole('button', { name: 'Add timed event', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const bounds = await dialog.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
  await expect(dialog.getByRole('button', { name: 'Run this lesson', exact: true })).toBeVisible()
})

test('imports a reviewed lesson file before starting it', async ({ page }) => {
  await page.goto('/')
  const exercise = {
    ...builtinExercise('departure'),
    id: 'custom-imported',
    title: 'Imported departure lesson',
  }
  await importLesson(page, exercise)
  await expect(page.getByText('Imported departure lesson', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select MAS1134' })).toHaveCount(0)
})

test('pausing cancels microphone capture and ignores a late speech result', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { SpeechRecognition: unknown; voiceAborted: boolean }
    w.voiceAborted = false
    w.SpeechRecognition = class {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {}
      stop() {
        this.onend?.()
      }
      abort() {
        w.voiceAborted = true
        this.onresult?.({
          results: [{ isFinal: true, 0: { transcript: 'MAS612, pushback approved' } }],
        })
        this.onend?.()
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await page.getByRole('button', { name: 'Pause exercise', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop voice capture', exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { voiceAborted: boolean }).voiceAborted),
  ).toBe(true)
  await expect(page.getByRole('textbox', { name: 'Controller transmission' })).toHaveValue('')
})

test('network speech failure without onend releases capture and permits an explicit retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let attempt = 0
    const w = window as unknown as { SpeechRecognition: unknown }
    w.SpeechRecognition = class {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      start() {
        if (++attempt === 1) this.onerror?.({ error: 'network' })
      }
      stop() {
        this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'MAS612, standby' } }] })
        this.onend?.()
      }
      abort() {}
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Vivaldi')
  await expect(page.getByRole('textbox', { name: 'Controller transmission' })).toHaveValue(
    'MAS612, pushback approved',
  )
  await expect(page.getByRole('button', { name: 'Transmit clearance' })).toBeEnabled()
  await page.getByRole('button', { name: 'Retry voice capture', exact: true }).click()
  await page.getByRole('button', { name: 'Stop voice capture', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Controller transmission' })).toHaveValue(
    'MAS612, standby',
  )
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('AT STAND')
})
