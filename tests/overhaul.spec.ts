import { expect, test } from '@playwright/test'

test('LAY-01/02, TOP-02, DP-8: desktop and stacked layouts, live UTC and persisted day mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const clock = page.locator('.utc-clock time')
  expect(
    Math.abs(
      Date.now() -
        Date.parse(`${new Date().toISOString().slice(0, 10)}T${await clock.textContent()}Z`),
    ),
  ).toBeLessThan(2000)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const strips = await page.getByLabel('Flight strips', { exact: true }).boundingBox()
  const map = await page.getByLabel('WMKK schematic airport display').boundingBox()
  expect(strips!.x).toBeLessThan(map!.x)
  await page.getByLabel('Toggle day/night mode').click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'day')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'day')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const mobileMap = await page.getByLabel('WMKK schematic airport display').boundingBox()
  const mobileStrips = await page.getByLabel('Flight strips', { exact: true }).boundingBox()
  expect(mobileMap!.y).toBeLessThan(mobileStrips!.y)
})

test('PTT-06/07/08, SIM-02: short press, TX lamps, blur cancel, and typed PTT', async ({
  page,
}) => {
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.goto('/')
  await expect(page.getByLabel('Push to talk', { exact: true })).toBeDisabled()
  await page.getByLabel('Start exercise', { exact: true }).click()
  await page.getByLabel('Controller transmission').fill('MAS612, pushback approved')
  await page.keyboard.down('ControlRight')
  await expect(page.getByLabel('Push to talk', { exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.tx-lamp.lit')).toHaveCount(1)
  await expect(page.locator('.communications-heading')).toContainText('TRANSMITTING')
  await page.clock.runFor(200)
  await page.keyboard.up('ControlRight')
  await expect(page.locator('.safety-line')).toContainText('Too short')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(500)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.keyboard.up('ControlRight')
  await expect(page.locator('.tx-lamp.lit')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(500)
  await page.keyboard.up('ControlRight')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
  await page.keyboard.down('ControlRight')
  await expect(page.locator('.safety-line')).toContainText('FREQUENCY BUSY')
  await page.keyboard.up('ControlRight')
})

test('PTT-09 and key map: Space leaves running, P pauses, and stuck mic cancels', async ({
  page,
}) => {
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.goto('/')
  await page.getByLabel('Start exercise', { exact: true }).click()
  await page.locator('h1').click()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Pause exercise', { exact: true })).toBeVisible()
  await page.keyboard.press('p')
  await expect(page.getByLabel('Push to talk', { exact: true })).toBeDisabled()
  await page.keyboard.press('p')
  await page.getByLabel('Controller transmission').fill('MAS612, pushback approved')
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(30_100)
  await expect(page.locator('.safety-line')).toContainText('STUCK MIC')
  await expect(page.locator('.tx-lamp.lit')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.keyboard.up('ControlRight')
})

test('browser speech uses the shared parser and rejects low confidence without a state change', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.SpeechRecognition = w.webkitSpeechRecognition = class {
      onresult?: (e: unknown) => void
      onend?: () => void
      onerror?: (e: unknown) => void
      start() {
        w.recognition = this
      }
      stop() {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              isFinal: true,
              0: {
                transcript: w.speechText || 'Malaysian six one two pushback and start-up approved',
                confidence: w.confidence ?? 0.95,
              },
            },
          ],
        })
        this.onend?.()
      }
      abort() {
        this.onend?.()
      }
    }
  })
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.goto('/')
  await page.getByLabel('Workstation settings').click()
  const speech = page.locator('.settings-row').filter({ hasText: 'Browser speech recognition' })
  await speech.getByRole('button').click()
  await page.getByRole('button', { name: 'Back to workstation' }).click()
  await page.getByLabel('Start exercise', { exact: true }).click()
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).confidence = 0.4
  })
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(500)
  await page.keyboard.up('ControlRight')
  await expect(page.locator('.safety-line')).toContainText('Say again')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).confidence = 0.95
  })
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(500)
  await page.keyboard.up('ControlRight')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
  await expect(page.getByRole('log')).toContainText(
    'Malaysian six one two pushback and start-up approved',
  )
})

test('latching PTT and a captured keyboard binding send only on the second press', async ({
  page,
}) => {
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.goto('/')
  await page.getByLabel('Workstation settings').click()
  await page.locator('.settings-row').filter({ hasText: 'PTT binding' }).getByRole('button').click()
  await page.keyboard.press('F9')
  await expect(page.locator('.settings-row').filter({ hasText: 'PTT binding' })).toContainText('F9')
  await page
    .locator('.settings-row')
    .filter({ hasText: 'Latching PTT' })
    .getByRole('button')
    .click()
  await page.getByRole('button', { name: 'Back to workstation' }).click()
  await page.getByLabel('Start exercise', { exact: true }).click()
  await page.getByLabel('Controller transmission').fill('MAS612 pushback approved')
  await page.keyboard.press('F9')
  await page.clock.runFor(500)
  await expect(page.getByLabel('Push to talk', { exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.keyboard.press('F9')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
  await expect(page.getByLabel('Push to talk', { exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('blocked preference storage does not prevent startup or typed control', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError')
    }
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'WMKK KUALA LUMPUR' })).toBeVisible()
  await page.getByLabel('Start exercise', { exact: true }).click()
  await page.getByLabel('Controller transmission').fill('MAS612 pushback approved')
  await page.getByLabel('Transmit clearance', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
})
