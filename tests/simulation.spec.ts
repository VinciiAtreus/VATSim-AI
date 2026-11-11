import { expect, test } from '@playwright/test'
test('starts continuous operations without lesson or scoring controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start simulation', exact: true })).toBeVisible()
  await expect(page.getByText('EXERCISE OBJECTIVE', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Simulation setup', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Continuous fictional arrivals')
  await expect(page.getByRole('button', { name: 'Create a lesson' })).toHaveCount(0)
  await page.getByLabel('Automatic traffic').uncheck()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Session debrief', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Manual assessment', exact: true })).toHaveCount(0)
})
test('drags without selecting text and zooms about the cursor with the wheel', async ({ page }) => {
  await page.goto('/')
  const svg = page.locator('.airport-svg'),
    rect = (await svg.boundingBox())!
  const before = await svg.getAttribute('viewBox')
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width * 0.65, rect.y + rect.height * 0.65, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('')
  expect(await svg.getAttribute('viewBox')).not.toBe(before)
  const width = Number((await svg.getAttribute('viewBox'))!.split(' ')[2])
  const top = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, -500)
  await expect
    .poll(async () => Number((await svg.getAttribute('viewBox'))!.split(' ')[2]))
    .toBeLessThan(width)
  await page.mouse.wheel(0, 500)
  await expect
    .poll(async () => Number((await svg.getAttribute('viewBox'))!.split(' ')[2]))
    .toBeGreaterThan(width * 0.95)
  expect(await page.evaluate(() => scrollY)).toBe(top)
})
test('offers available voices and previews the preferred natural voice with aviation pronunciation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const voices = [
      { name: 'Standard English', lang: 'en-US', voiceURI: 'standard', localService: true },
      { name: 'Natural English', lang: 'en-GB', voiceURI: 'natural', localService: false },
    ]
    ;(window as any).spoken = []
    ;(window as any).SpeechSynthesisUtterance = class {
      constructor(public text: string) {}
      voice: any
      lang = ''
      rate = 1
      pitch = 1
    }
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => voices,
        addEventListener() {},
        removeEventListener() {},
        cancel() {},
        speak(u: any) {
          ;(window as any).spoken.push({ text: u.text, voice: u.voice?.voiceURI, rate: u.rate })
        },
      },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Workstation settings', exact: true }).click()
  await expect(page.getByLabel('Pilot voice')).toContainText('Natural English')
  await page.getByRole('button', { name: 'Preview pilot voice', exact: true }).click()
  const spoken = await page.evaluate(() => (window as any).spoken.at(-1))
  expect(spoken.voice).toBe('natural')
  expect(spoken.text).toContain('Tango two')
  expect(spoken.text).toContain('three two right')
  await page.getByLabel('Pilot voice').selectOption('standard')
  await page.getByRole('button', { name: 'Preview pilot voice', exact: true }).click()
  expect(await page.evaluate(() => (window as any).spoken.at(-1).voice)).toBe('standard')
})
