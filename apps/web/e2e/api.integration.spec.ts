import { expect, test } from '@playwright/test'

test('real Harness chapter read, save, recovery, conflict safety, and Workspace preferences', async ({ browser }) => {
  const requestsA: string[] = []
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const pageA = await contextA.newPage()
  pageA.on('request', (request) => requestsA.push(request.url()))

  await pageA.goto('/')
  const chapterOne = pageA.getByRole('treeitem', { name: /第一章 · 雨前/ })
  const chapterTwo = pageA.getByRole('treeitem', { name: /第二章 · 风起/ })
  await expect(chapterOne).toBeVisible()
  await expect(chapterTwo).toBeVisible()
  await expect(pageA.getByRole('heading', { name: '第一章 · 雨前' })).toBeVisible()
  const editorA = pageA.getByLabel('正文编辑器')
  await expect(editorA).toContainText('这是隔离测试夹具中的中文正文。')
  await expect(editorA).toContainText('这段引用用于检查 Markdown 原文读取。')
  expect(await pageA.evaluate(() => localStorage.getItem('writer-agent.v2'))).toBeNull()

  await chapterTwo.click()
  await expect(pageA.getByRole('heading', { name: '第二章 · 风起' })).toBeVisible()
  await expect(pageA.getByLabel('正文编辑器')).toContainText('第二个测试章节用于验证真实 API 目录顺序和切换加载。')
  await chapterOne.click()
  await expect(pageA.getByLabel('正文编辑器')).toContainText('这是隔离测试夹具中的中文正文。')

  const firstEdit = '作者新写的第一段中文。'
  await pageA.getByLabel('正文编辑器').fill(firstEdit)
  await pageA.keyboard.press('Control+S')
  await expect(pageA.getByText(/^已保存 /)).toBeVisible()
  await pageA.reload()
  await expect(pageA.getByLabel('正文编辑器')).toContainText(firstEdit)

  const themePatch = pageA.waitForRequest((request) => request.method() === 'PATCH' && request.url().includes('/workspace'))
  await pageA.getByRole('button', { name: '深色主题' }).click()
  await expect(pageA.locator('.dark')).toHaveCount(1)
  await themePatch
  const layoutPatch = pageA.waitForRequest((request) => request.method() === 'PATCH' && request.url().includes('/workspace'))
  await pageA.getByRole('button', { name: '专注' }).click()
  await expect(pageA.getByRole('button', { name: '退出专注' })).toBeVisible()
  await layoutPatch
  await pageA.reload()
  await expect(pageA.locator('.dark')).toHaveCount(1)
  await expect(pageA.getByRole('button', { name: '退出专注' })).toBeVisible()

  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const pageB = await contextB.newPage()
  await pageB.goto('/')
  await expect(pageB.getByLabel('正文编辑器')).toContainText(firstEdit)

  const localText = '浏览器 A 的未保存中文草稿。'
  const serverText = '浏览器 B 已确认保存的中文版本。'
  await pageA.getByLabel('正文编辑器').fill(localText)
  await pageB.getByLabel('正文编辑器').fill(serverText)
  await pageB.keyboard.press('Control+S')
  await expect(pageB.getByText(/^已保存 /)).toBeVisible()
  await pageA.keyboard.press('Control+S')
  await expect(pageA.getByRole('alert').filter({ hasText: '检测到版本冲突' })).toBeVisible()
  await expect(pageA.getByLabel('正文编辑器')).toContainText(localText)

  const contextC = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const pageC = await contextC.newPage()
  await pageC.goto('/')
  await expect(pageC.getByLabel('正文编辑器')).toContainText(serverText)
  expect(requestsA.some((url) => /\/api\/(agent|chapters|projects)/.test(url))).toBe(false)

  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.getByRole('button', { name: '导出本地草稿' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('CH-901-local-draft.md')

  await pageA.getByRole('button', { name: '重新读取服务器版本…' }).click()
  const confirm = pageA.getByRole('dialog')
  await expect(confirm).toContainText('清除该章节浏览器中尚未确认保存的本地草稿')
  await confirm.getByRole('button', { name: '使用服务器版本' }).click()
  await expect(pageA.getByLabel('正文编辑器')).toContainText(serverText)
  expect(await pageA.evaluate(() => localStorage.getItem('writer-agent.api-draft.v1:e2e-fixture:CH-901'))).toBeNull()

  await contextA.close()
  await contextB.close()
  await contextC.close()
})
