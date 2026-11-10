import { expect, test } from '@playwright/test'

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
