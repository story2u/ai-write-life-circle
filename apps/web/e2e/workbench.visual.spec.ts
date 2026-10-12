import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByText('WRITER AGENT')).toBeVisible()
})

test('1440px light workbench keeps navigation, editor and Agent panel visible', async ({ page }, testInfo) => {
  const navigation = page.getByRole('tree', { name: '章节目录' })
  const editor = page.getByRole('textbox', { name: '正文编辑器' })
  const agentPanel = page.locator('aside[aria-label="Agent 面板"]')

  await expect(navigation).toBeVisible()
  await expect(editor).toBeVisible()
  await expect(agentPanel).toBeVisible()

  const [navBox, editorBox, panelBox] = await Promise.all([navigation.boundingBox(), editor.boundingBox(), agentPanel.boundingBox()])
  expect(navBox?.width).toBeGreaterThan(180)
  expect(editorBox?.width).toBeGreaterThan(500)
  expect(panelBox?.width).toBeGreaterThan(300)
  await page.screenshot({ path: testInfo.outputPath('workbench-light-1440.png'), fullPage: true })
})

test('1440px dark theme keeps the workbench structure', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '深色主题' }).click()
  await expect(page.locator('.dark')).toBeVisible()
  await expect(page.getByRole('tree', { name: '章节目录' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '正文编辑器' })).toBeVisible()
  await expect(page.locator('aside[aria-label="Agent 面板"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('workbench-dark-1440.png'), fullPage: true })
})

test('1440px focus mode hides side panels and keeps the editor available', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '专注' }).click()
  await expect(page.getByRole('textbox', { name: '正文编辑器' })).toBeVisible()
  await expect(page.getByRole('tree', { name: '章节目录' })).toHaveCount(0)
  await expect(page.locator('aside[aria-label="Agent 面板"]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workbench-focus-1440.png'), fullPage: true })
})
