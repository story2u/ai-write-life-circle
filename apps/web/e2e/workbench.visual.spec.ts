import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.removeItem('writer-agent.v2'))
  await page.goto('/')
  await expect(page.getByText('WRITER AGENT')).toBeVisible()
})

test('1440px light workbench opens in writing-first mode and reveals Agent tools on request', async ({ page }, testInfo) => {
  const navigation = page.getByRole('tree', { name: '章节目录' })
  const editor = page.getByRole('textbox', { name: '正文编辑器' })
  const agentPanel = page.locator('aside[aria-label="Agent 面板"]')

  await expect(navigation).toBeVisible()
  await expect(editor).toBeVisible()
  await expect(agentPanel).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Agent 面板/ })).toBeVisible()

  const [navBox, mainBox] = await Promise.all([navigation.boundingBox(), page.locator('main').boundingBox()])
  expect(navBox?.width).toBeGreaterThan(180)
  expect(mainBox?.width).toBeGreaterThan(1100)
  await page.screenshot({ path: testInfo.outputPath('workbench-light-1440.png'), fullPage: true })

  await page.getByRole('button', { name: /Agent 面板/ }).click()
  await expect(agentPanel).toBeVisible()
  await expect(page.getByRole('button', { name: '待处理', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /待处理 \d/ })).toHaveCount(0)
  expect((await page.locator('main').boundingBox())?.width).toBeLessThan(950)
})

test('1440px dark theme keeps the workbench structure', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '深色主题' }).click()
  await expect(page.locator('.dark')).toBeVisible()
  await expect(page.getByRole('tree', { name: '章节目录' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '正文编辑器' })).toBeVisible()
  await expect(page.locator('aside[aria-label="Agent 面板"]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workbench-dark-1440.png'), fullPage: true })
})

test('1440px focus mode hides side panels and keeps the editor available', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '专注' }).click()
  await expect(page.getByRole('textbox', { name: '正文编辑器' })).toBeVisible()
  await expect(page.getByRole('tree', { name: '章节目录' })).toHaveCount(0)
  await expect(page.locator('aside[aria-label="Agent 面板"]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workbench-focus-1440.png'), fullPage: true })
})
