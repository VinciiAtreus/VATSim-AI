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
import { builtinExercise } from '../src/sim/exercises'
import { createSession, sessionExport, tick, transmit } from '../src/sim/engine'

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
  session = tick({ ...session, running: true }, 150)
  session = transmit(session, 'MAS612, taxi runway 32R via T2 T3 F1 G B9 A A11', '121.650').session
  session = tick(session, 650)
  const buffer = Buffer.from(JSON.stringify(sessionExport(session)))
  await page.goto('/')
  await page.getByRole('button', { name: 'Saved sessions', exact: true }).click()
  await page
    .getByLabel('Import session JSON', { exact: true })
    .setInputFiles({ name: 'coordination.json', mimeType: 'application/json', buffer })
  await page.getByRole('button', { name: 'Restore paused', exact: true }).click()
  await page.getByRole('button', { name: 'Resume simulation' }).click()
  await page.getByRole('button', { name: 'Transfer to tower', exact: true }).click()
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('alert')).toContainText('Exercise coordination required')
  await page
    .getByRole('button', { name: 'Request adjacent-station acceptance', exact: true })
    .click()
  await page.getByRole('button', { name: /^Operations/ }).click()
  await page.getByRole('button', { name: 'Accept MAS612', exact: true }).click()
  await page.getByRole('button', { name: 'Aircraft', exact: true }).click()
  await expect(page.getByLabel('Adjacent station coordination')).toContainText('approved')
  await page.getByRole('button', { name: 'Transfer to tower', exact: true }).click()
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('118.800')
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
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start simulation', exact: true })).toBeEnabled()
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
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click()
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
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click()
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('permission was denied')
  await page
    .getByRole('textbox', { name: 'Controller transmission' })
    .fill('MAS612, pushback approved')
  await page.getByRole('button', { name: 'Transmit clearance' }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612' })).toContainText('PUSHBACK')
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
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click()
  await page.getByRole('button', { name: 'Dictate instruction', exact: true }).click()
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
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
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click()
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
