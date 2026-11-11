import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any
    w.starts = 0
    w.SpeechRecognitionPhrase = class {
      constructor(
        public phrase: string,
        public boost: number,
      ) {}
    }
    w.SpeechRecognition = class {
      phrases = []
      onstart: any
      onresult: any
      onend: any
      onerror: any
      start() {
        w.capture = this
        w.starts++
        this.onstart?.()
      }
      stop() {
        this.onend?.()
      }
      abort() {}
      result(text: string, alternative = '') {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              isFinal: true,
              length: alternative ? 2 : 1,
              0: { transcript: text, confidence: 0.95 },
              1: { transcript: alternative, confidence: 0.7 },
            },
          ],
        })
      }
    }
  })
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.goto('/')
  await page.getByLabel('Start simulation', { exact: true }).click()
})

test('Voice PTT explicitly enables capture, configures language and callsign hints, and persists', async ({
  page,
}) => {
  await page.keyboard.down('ControlRight')
  await page.clock.runFor(400)
  await page.keyboard.up('ControlRight')
  expect(await page.evaluate(() => (window as any).starts)).toBe(0)
  await expect(page.locator('.speech-feedback')).toContainText('Typed PTT is selected')
  await page.getByRole('button', { name: 'Voice PTT', exact: true }).click()
  await page.getByLabel('Speech language').selectOption('en-MY')
  await page.keyboard.down('ControlRight')
  await expect(page.locator('.ptt-equipment')).toContainText('Microphone open')
  const configuration = await page.evaluate(() => ({
    language: (window as any).capture.lang,
    count: (window as any).capture.maxAlternatives,
    hints: (window as any).capture.phrases.map((p: any) => p.phrase),
  }))
  expect(configuration.language).toBe('en-MY')
  expect(configuration.count).toBe(5)
  expect(configuration.hints).toContain('Malaysian one one three four')
  expect(configuration.hints).toContain('Malaysian 1134')
  await page.clock.runFor(400)
  await page.keyboard.up('ControlRight')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Voice PTT', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Speech language')).toHaveValue('en-MY')
})

test('Unrelated speech does not change an aircraft; alternatives only fill an editable draft', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Voice PTT', exact: true }).click()
  await page.keyboard.down('ControlRight')
  await page.evaluate(() =>
    (window as any).capture.result(
      "Delete from. Don't don't speak for.",
      'Malaysian six one two pushback approved',
    ),
  )
  // A repeated final event must replace the same segment, not duplicate it.
  await page.evaluate(() =>
    (window as any).capture.result(
      "Delete from. Don't don't speak for.",
      'Malaysian six one two pushback approved',
    ),
  )
  await page.clock.runFor(400)
  await page.keyboard.up('ControlRight')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await expect(page.locator('.recognised-text')).toHaveText("Delete from. Don't don't speak for.")
  await page.getByText('Alternative transcripts — edit before sending').click()
  await page
    .getByRole('button', { name: 'Malaysian six one two pushback approved', exact: true })
    .click()
  await expect(page.getByLabel('Controller transmission')).toHaveValue(
    'Malaysian six one two pushback approved',
  )
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
})

test('A speech service ending while held retains speech until release; blur cancels it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Voice PTT', exact: true }).click()
  await page.keyboard.down('ControlRight')
  await page.evaluate(() => {
    ;(window as any).capture.result('MAS612 pushback approved')
    ;(window as any).capture.onend()
  })
  await page.clock.runFor(400)
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.keyboard.up('ControlRight')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'AT STAND',
  )
  await page.keyboard.down('ControlRight')
  await page.evaluate(() => {
    ;(window as any).capture.result('MAS612 pushback approved')
    ;(window as any).capture.onend()
  })
  await page.clock.runFor(400)
  await page.keyboard.up('ControlRight')
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
})

test('Pointer release waits for the service result and a stalled service times out safely', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Voice PTT', exact: true }).click()
  const ptt = page.getByLabel('Push to talk', { exact: true })
  await ptt.scrollIntoViewIfNeeded()
  const box = await ptt.boundingBox()
  await page.mouse.move(box!.x + 20, box!.y + 20)
  await page.mouse.down()
  await page.evaluate(() => {
    ;(window as any).capture.stop = () => {}
  })
  await page.clock.runFor(400)
  await page.mouse.up()
  await expect(ptt).toContainText('Processing')
  await page.evaluate(() => {
    ;(window as any).capture.result('MAS612 pushback approved')
    ;(window as any).capture.onend()
  })
  await expect(page.getByRole('button', { name: 'Select MAS612', exact: true })).toContainText(
    'PUSHBACK',
  )
  await page.clock.runFor(15000)
  await page.keyboard.down('ControlRight')
  await page.evaluate(() => {
    ;(window as any).capture.stop = () => {}
  })
  await page.clock.runFor(400)
  await page.keyboard.up('ControlRight')
  await page.clock.runFor(10001)
  await expect(page.locator('.speech-feedback')).toContainText('did not finish')
  await expect(ptt).not.toContainText('Processing')
})
