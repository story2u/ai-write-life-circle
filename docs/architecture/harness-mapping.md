# Harness 数据映射（Markdown → 领域实体）

文档日期：2026-10-14
依据：`AGENTS.md`、`harness/data-contract.md`、`harness/index.md`、`harness/workflows/*`、`templates/*`、`book/*`、`proposals/*`、`decisions/log.md`、`state/current.md`
基线：`origin/main` `9f5397f318b61d21248b079462150bed57eabd1c`；作者确认的 ID 映射只更新稳定 ID、文件名和交叉引用，未修改 `manuscript/` 正文或设定文字。

> 本文档是 **Harness（Markdown + Git）事实层** 到领域实体的映射说明，供后端 `apps/api` 做只读解析与投影时对齐。它**不**替代 Harness 本身；Harness 的 Markdown 仍是正式知识的事实来源（INV-09）。

## 1. 结论摘要

| 维度 | 现状 |
| --- | --- |
| 事实来源 | Markdown 文件 + Git 历史；正文在 `manuscript/` 默认只读 |
| 元数据格式 | **非 YAML front-matter**，是正文顶部的键值行（`ID:` / `status:` / `updated:` / `source:` / `related:`） |
| 稳定 ID | 实际档案可见 CHAR/THREAD/WORLD/EVENT/P/REF 与 `INTENT-001`；作者已批准并应用 WORLD/P 冲突映射；章节 `CH-*` 规则尚未确认（OQ-016），不得分配 |
| 状态机 | 文件保留原始 `status` 字符串；不能据此推断每个条款的状态机 |
| 来源定位 | 保存 `source` 原文，并尽力解析仓库相对 `.md` 路径、locator 与 Git blob hash；自由文本定位仍需核对 |
| 条款级状态 | P-001 等文件中存在条款级状态，但尚无通用结构化解析和明确 OQ-004 状态映射 |

## 2. 目录与实体映射

| 目录 | 实体 | 映射说明 |
| --- | --- | --- |
| `book/intent.md` | INTENT-001 作者意图 | 核心表达、主题张力、揭示方向、读者感受；主题非正文事实 |
| `book/characters/*.md` | CHAR-* 角色 | 姓名/定位/身份/欲望/关系/知识边界/变化轨迹 |
| `book/world/*.md` | WORLD-* 世界规则 | 规则陈述/适用范围/限制代价/例外/相关规则/首次出现 |
| `book/threads/*.md` | THREAD-* 情节线 | 主线/支线/伏笔（当前未建档） |
| `book/outline.md` / `timeline.md` / `style.md` | 大纲/时间线/风格基线 | 当前均 unknown |
| `book/index.md` + 各 `index.md` | 索引（投影） | 只存摘要、路径、状态、关联 ID，不复制正文 |
| `proposals/*.md` | P-* 提案 | 逐项变更 + 冲突待决 + 接受依据 |
| `decisions/log.md` | 决策记录 | 作者确认依据、改动文件、被取代内容、提交号 |
| `state/current.md` | 会话状态 | 目标/已完成/待决/未覆盖/下一步 |
| `manuscript/*.md` | 正文 | **默认只读，Agent 不写**（INV-01）；当前只有说明文件，没有正式章节 |
| `notes/*.md` | 提取摘要（可重建投影） | 章节摘要、影响清单、来源记录 |
| `references/*.md` | REF-* 外部案例 | 可核验案例卡 |
| `inbox/*.md` | 作者原始材料 | 作者原话的事实载体 |
| `harness/*` | 工作流规范（元层） | 非领域数据，是 Agent 行为契约 |

## 3. 稳定 ID 规则

- 前缀：`CHAR`（人物）、`THREAD`（情节线）、`WORLD`（世界规则）、`EVENT`（事件）、`CH`（章节）、`P`（提案）、`REF`（案例），另有 `INTENT-001`。
- **ID 不复用，改名保持 ID**（`harness/data-contract.md`）。
- 分配：新建实体从各前缀的末号 +1 递增；不因删除/改名而回收旧号。
- 历史冲突：`WORLD-001/002/003`、`P-001` 曾存在同号异义；作者已批准映射并更新文件和引用（见 `docs/reviews/knowledge-id-mapping.md`）。`P-001` 第 4 项仍是无 ID 的提案条目。

## 4. 元数据格式（重要：非 YAML front-matter）

实体文件**没有** `---` 包裹的 YAML front-matter，而是正文开头的**普通键值行**：

```
ID: CHAR-001
status: confirmed（仅下列已确认项；其余 unknown）
updated: 2026-09-29
source: inbox/2026-09-28-core-idea.md 末段；...
related: WORLD-002, WORLD-003
```

解析器**不得**假设 front-matter 存在。本仓库读取器只识别标题后连续的 `Key: value` 行；无元数据的模板、纯索引和 YAML 样式内容均保留为原始 Markdown，不把 YAML 解释成契约字段。

`status` 值可能带括号注释（如 `confirmed（部分）`）或提案复合状态。当前读取器只保留 `rawStatus`，不将其归一化成新的状态枚举，也不推断条款状态。

## 5. 条款级状态

提案（`proposals/*.md`）内部**逐项**标记状态，不是整份一态。以 `P-001.md` 为例：

| 条目 | 状态 |
| --- | --- |
| 第 1–3 项 | accepted（2026-09-29） |
| 第 4、5 项 | proposed |
| 第 6、7 项 | accepted（2026-09-28） |
| 待决 A/B/C/E/I | 已决；G 暂缓；K/N/O 待决 |

→ 若后端要实现逐项提案工作流，最小投影单元应是**条目（item）**而非提案文件。但当前读取器仅保留原文和章节，不声称已经解析或实现逐项审批；OQ-008 的审批 UI 也未设计。

## 6. 来源定位与 hash

- `source` 字段常含仓库相对路径（可加 `#锚点` / `#SRC-00N`）、自然语言位置和多个来源；分隔符包括 `；`。
- 段落定位示例：`inbox/2026-09-28-core-idea.md 末段`、`...answers-1.md 第 1 点`。
- 提取记录保存源文件 **Git blob hash**（`git hash-object`），避免原文变化后旧提取继续生效：
  - `proposals/P-001.md` 记录 `inbox/2026-09-28-core-idea.md @ 706cef24...`；
  - `inbox/2026-09-29-answers-2.md @ d7c6b1fd...`；
  - `notes/bootstrap-sources-2026-10-07.md` blob `83a69341...`。
- 当前投影同时保留完整 `source` 原文及 SHA-256 / Git blob hash。解析出的路径和 locator 是 best-effort；未识别的自由文本不会丢弃。
- 文件 hash 用于验证文档版本。来源文件 hash 可判断引用是否过期；现阶段没有为章节/提案接受流程提供写入或自动 stale 迁移。

## 7. 引用关系

- `related:` 字段列出关联稳定 ID（如 `WORLD-001, WORLD-002, INTENT-001`）。
- 跨文件引用出现在：正文内的 `WORLD-*`/`CHAR-*` 字样、索引表、`decisions/log.md`、`state/current.md`。
- 引用是**单向**字符串引用，无双向边表；投影时需扫描全库重建反向引用（"被谁引用"）。反向引用清单由 `scripts/check-knowledge-ids.mjs` 已部分产出。

## 8. 版本处理

- 单一事实源：Git 提交历史 + 文件内容。索引/摘要是**可重建投影**，非事实源。
- 历史被替代条目：保留来源与替代关系，不悄悄删除（`decisions/log.md`「被取代内容」列）。
- 引用旧版本提案的正文变化后标 `stale`，重新核对后才能接受。
- 冲突：正文 / 已确认设定 / 作者新指令矛盾时建冲突记录，作者裁决后更新。只读投影保留重复 ID 的所有路径并报告冲突，不自行选择胜者。

## 9. 外部修改检测

- 判据：`source` 指向的文件 + 记录的 blob hash 与当前 `git hash-object` 比对。
- 不一致 → 该条目标 `stale`，停止自动接受，触发重新核对（`accept.md` 第 1 步）。
- 章节提取复用：目标正文 hash 相同则复用既有提取，避免重复（`ingest.md` 第 1 步）。
- 后端投影必须支持「按 hash 判断陈旧」，不能只比较 `updated` 日期（日期可被手改，不可作为唯一真值）。

## 10. Git 提交策略

- 一个逻辑变更一个 commit（`accept.md` 第 5 步）。作者已确认章节保存先写入不可变应用草稿，之后由作者单独提交到 Git（OQ-015）。
- 未授权提交时展示 diff，不自动 `git add/commit` 到正式知识目录。
- 回退通过**新提交**撤销指定变更，避免 `reset` 覆盖作者工作（`handoff.md`）。
- 正式知识变更需要处理 Git 与数据库之间的失败恢复——两者**不在同一 ACID 事务**，需两阶段提交 / 补偿（见 ADR 待立项）。

## 11. 与领域模型 / API 的映射边界

| 领域概念 | Harness 载体 | 后端投影 |
| --- | --- | --- |
| Knowledge 实体 | `book/*.md` | 只读投影 + 稳定 ID + 状态 + source hash |
| Proposal | `proposals/*.md` | 只读投影（逐项状态） |
| Decision | `decisions/log.md` | 只读投影 |
| Chapter | `manuscript/*.md` | **不可写**（INV-01）；现有章节文件、章节 ID、排序及富文本格式均未确定（OQ-016） |
| 正文修订 | 尚无确认的持久化 adapter | OQ-015 已确认应用草稿 + 作者独立 Git 提交；OQ-016 仍需确定章节 ID、排序与文件格式，之后才能绑定具体 Harness 文件 |

**关键区分**：Harness 的 Markdown 是「作者已确认知识」的事实源；`apps/api` 的数据库（未来）是「运行时推演/会话/任务」的工作状态。二者通过稳定 ID + source hash 关联，不可互相覆盖。

## 12. 当前实现边界

- `apps/api/src/harness/reader.ts` 只读取已知目录下的 Markdown，不跟随符号链接，不写回仓库。
- `apps/api/src/harness/parser.ts` 保存原始 Markdown、原始元数据与 hash；只对约定的键值头做解析。
- `apps/api/src/harness/projection.ts` 按路径投影档案、提案和章节候选；重复 ID 均保留，章节无 ID 时列为 unmapped。
- `/internal/projects/:id/harness-projection` 是本地诊断路由。Sprint 1 另实现了 V0.4 候选契约中 Workspace 与 Chapter 的读接口，以及应用草稿保存接口；对应 Zod schemas 是 `packages/contracts/src/v04.ts` 的运行时来源，尚未从 OpenAPI 自动生成。完整候选 YAML 由作者在任务中提供，但没有保存为仓库 OpenAPI 文件，也未声称完成全规格验证。
- ID 预留、审计、workspace 状态、章节草稿和 revision compare-and-swap 都写入应用状态目录，不会修改 Harness。WORLD/P 冲突经作者确认后可继续分配后续编号；`CH` 仍因 OQ-016 禁用。

## 13. 尚未建档 / unknown 的语义

- `unknown` 与 `intentional unknown`（作者刻意留白）**不是错误**（INV-10），投影层不得将其当作「缺数据」报错。
- 模板占位（如 `templates/chapter.md` 的 `ID: 待分配`）不作为已分配的稳定 ID。当前仓库 `manuscript/` 仅有说明文件，没有可供 API 映射的正式章节。
- 「部分确认」= 实体存在但仅部分属性有值，**不等于实体不存在**（对应 V0.2 的索引一致性修复）。
