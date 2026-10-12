import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../app/App'

describe('Writer Agent studio', () => {
  it('renders the source workbench and an editable TipTap chapter', () => {
    render(<App />)

    expect(screen.getByText('WRITER AGENT')).toBeInTheDocument()
    expect(screen.getByRole('tree', { name: '章节目录' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '正文编辑器' })).toHaveAttribute('contenteditable', 'true')
    expect(screen.getByRole('tab', { name: '审查' })).toBeInTheDocument()
  })

  it('runs the demo challenge workflow and keeps the author in control', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: '推演' }))
    await user.click(screen.getByRole('button', { name: /开始推演/ }))

    await waitFor(() => expect(screen.getByText('作者意图 · 第 1 轮')).toBeInTheDocument())
    expect(screen.getByText('推演只做质疑与启发，不生成正文。')).toBeInTheDocument()
    expect(screen.getByText('演示数据')).toBeInTheDocument()
  })

  it('sends chat through the demo adapter and labels the reply', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: '对话' }))
    await user.type(screen.getByRole('textbox', { name: '发送给 Agent' }), '沈砚在想什么？')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(screen.getByText(/我目前只能基于已建档的资料回答/)).toBeInTheDocument())
    expect(screen.getByText('演示数据')).toBeInTheDocument()
  })

  it('saves TipTap edits in demo mode', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = screen.getByRole('textbox', { name: '正文编辑器' })

    await user.click(editor)
    await user.type(editor, 'author-save-check')

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('writer-agent.v2') || '{}') as { doc?: Record<string, string[]> }
      expect(saved.doc?.c12?.join('')).toContain('author-save-check')
    }, { timeout: 3000 })
  })

  it('records an accepted proposal without changing chapter prose', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = screen.getByRole('textbox', { name: '正文编辑器' })
    const originalText = editor.textContent

    await user.click(screen.getAllByRole('button', { name: /开始审查/ }).at(-1)!)
    await waitFor(() => expect(screen.getByText('时间线冲突：沈砚离京的季节')).toBeInTheDocument(), { timeout: 5000 })
    await user.click(screen.getByText('时间线冲突：沈砚离京的季节'))
    await user.click(screen.getByRole('button', { name: '采纳建议' }))
    await user.click(screen.getByRole('button', { name: '采纳所选方案' }))

    expect(editor.textContent).toBe(originalText)
    expect(screen.getAllByText('已采纳，待作者处理')).toHaveLength(2)
  })

  it('switches the Figma light/dark theme token scope', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '深色主题' }))
    expect(document.querySelector('.dark')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '浅色主题' }))
    expect(document.querySelector('.dark')).not.toBeInTheDocument()
  })
})
