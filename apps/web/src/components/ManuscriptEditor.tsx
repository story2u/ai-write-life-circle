import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Proposal } from '../types'

export type Annotation = { id: string; kind: Proposal['kind']; paraIndex: number; quote: string; active: boolean }
export type Flash = { paraIndex: number; quote?: string; nonce: number } | null

const key = new PluginKey('annotations')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const toHTML = (paras: string[]) => paras.map((p) => `<p>${esc(p)}</p>`).join('')
export const fromDoc = (doc: PMNode) => {
  const out: string[] = []
  doc.forEach((n) => out.push(n.textContent))
  return out
}

/** Locate a paragraph (by index, falling back to quote search). Returns its doc position. */
function locate(doc: PMNode, paraIndex: number, quote?: string): { pos: number; node: PMNode } | null {
  let hit: { pos: number; node: PMNode } | null = null
  let fallback: { pos: number; node: PMNode } | null = null
  let i = 0
  doc.forEach((node, pos) => {
    if (i === paraIndex) fallback = { pos, node }
    if (i === paraIndex && (!quote || node.textContent.includes(quote))) hit = { pos, node }
    i++
  })
  if (hit) return hit
  if (quote) {
    doc.forEach((node, pos) => {
      if (!hit && node.textContent.includes(quote)) hit = { pos, node }
    })
    if (hit) return hit
    return null
  }
  return fallback
}

function build(doc: PMNode, anns: Annotation[], flash: Flash): DecorationSet {
  const decos: Decoration[] = []
  for (const a of anns) {
    const loc = locate(doc, a.paraIndex, a.quote)
    if (!loc) continue
    decos.push(Decoration.node(loc.pos, loc.pos + loc.node.nodeSize, { class: `ann-para ann-${a.kind}${a.active ? ' ann-active' : ''}` }))
    const off = loc.node.textContent.indexOf(a.quote)
    if (off >= 0) {
      const from = loc.pos + 1 + off
      decos.push(Decoration.inline(from, from + a.quote.length, { class: `ann-mark ann-mark-${a.kind}`, 'data-issue': a.id, title: '点击查看 Agent 分析' }))
    }
  }
  if (flash) {
    const loc = locate(doc, flash.paraIndex, flash.quote)
    if (loc) {
      decos.push(Decoration.node(loc.pos, loc.pos + loc.node.nodeSize, { class: 'ann-flash' }))
    }
  }
  return DecorationSet.create(doc, decos)
}

type Props = {
  chapterId: string
  initial: string[]
  annotations: Annotation[]
  flash: Flash
  onChange: (paras: string[]) => void
  onSelectIssue: (id: string) => void
  onSelection: (text: string, paraIndex: number) => void
  onReady: (e: Editor) => void
}

export default function ManuscriptEditor({ chapterId, initial, annotations, flash, onChange, onSelectIssue, onSelection, onReady }: Props) {
  const annRef = useRef(annotations)
  const flashRef = useRef(flash)
  const cb = useRef({ onChange, onSelectIssue, onSelection })
  cb.current = { onChange, onSelectIssue, onSelection }

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: false, codeBlock: false, code: false, blockquote: false, bulletList: false, orderedList: false, listItem: false, horizontalRule: false }),
        Extension.create({
          name: 'annotations',
          addProseMirrorPlugins() {
            return [
              new Plugin({
                key,
                props: {
                  decorations: (state) => build(state.doc, annRef.current, flashRef.current),
                  handleClick: (_view, _pos, ev) => {
                    const el = (ev.target as HTMLElement).closest('[data-issue]')
                    if (el) cb.current.onSelectIssue(el.getAttribute('data-issue')!)
                    return false
                  },
                },
              }),
            ]
          },
        }),
      ],
      content: toHTML(initial),
      editorProps: { attributes: { class: 'manuscript font-prose outline-none', 'aria-label': '正文编辑器', spellcheck: 'false' } },
      onUpdate: ({ editor }) => cb.current.onChange(fromDoc(editor.state.doc)),
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, '\n')
        cb.current.onSelection(text, editor.state.doc.resolve(from).index(0))
      },
    },
    [chapterId],
  )

  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])

  // Annotation layer refresh — a meta-only transaction, document unchanged.
  useEffect(() => {
    annRef.current = annotations
    flashRef.current = flash
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(key, true))
  }, [annotations, flash, editor])

  // Scroll to flashed / active paragraph.
  useEffect(() => {
    if (!editor || !flash) return
    const t = setTimeout(() => {
      const loc = locate(editor.state.doc, flash.paraIndex, flash.quote)
      if (!loc) return
      const dom = editor.view.nodeDOM(loc.pos) as HTMLElement | null
      dom?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    return () => clearTimeout(t)
  }, [flash, editor])

  return <EditorContent editor={editor} />
}
