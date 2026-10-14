# Harness 数据映射（Markdown → 领域实体）

文档日期：2026-10-13
依据：`AGENTS.md`、`harness/data-contract.md`、`harness/index.md`、`harness/workflows/*`、`templates/*`、`book/*`、`proposals/*`、`decisions/log.md`、`state/current.md`

> 本文档是 **Harness（Markdown + Git）事实层** 到领域实体的映射说明，供后端 `apps/api` 做只读解析与投影时对齐。它**不**替代 Harness 本身；Harness 的 Markdown 仍是正式知识的事实来源（INV-09）。

## 1. 结论摘要

| 维度 | 现状 |
| --- | --- |
| 事实来源 | Markdown 文件 + Git 历史；正文在 `manuscript/` 默认只读 |
| 元数据格式 | **非 YAML front-matter**，是正文顶部的键值行（`ID:` / `status:` / `updated:` / `source:` / `related:`） |
| 稳定 ID | CHAR/THREAD/WORLD/EVENT/CH/P/REF + `INTENT-001`；ID 不复用 |
| 状态机 | 正式条目 `unknown/proposed/confirmed/deprecated`；提案 `proposed → partially-accepted/accepted/rejected/superseded` |
| 来源定位 | `仓库相对路径 + 章节/段落定位 + 短引文`；关键提取附 `git hash-object` blob hash |
| 条款级状态 | 提案逐项（per-item）标记，非整份一态 |

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
| `manuscript/*.md` | 正文 | **默认只读，Agent 不写**（INV-01） |
| `notes/*.md` | 提取摘要（可重建投影） | 章节摘要、影响清单、来源记录 |
| `references/*.md` | REF-* 外部案例 | 可核验案例卡 |
| `inbox/*.md` | 作者原始材料 | 作者原话的事实载体 |
| `harness/*` | 工作流规范（元层） | 非领域数据，是 Agent 行为契约 |

## 3. 稳定 ID 规则

- 前缀：`CHAR`（人物）、`THREAD`（情节线）、`WORLD`（世界规则）、`EVENT`（事件）、`CH`（章节）、`P`（提案）、`REF`（案例），另有 `INTENT-001`。
- **ID 不复用，改名保持 ID**（`harness/data-contract.md`）。
- 分配：新建实体从各前缀的末号 +1 递增；不因删除/改名而回收旧号。
- 当前冲突：`WORLD-001/002/003`、`P-001` 存在同号异义（见 `docs/reviews/knowledge-id-mapping.md`），**待作者裁决前不重编号**。

## 4. 元数据格式（重要：非 YAML front-matter）

实体文件**没有** `---` 包裹的 YAML front-matter，而是正文开头的**普通键值行**：

```
ID: CHAR-001
status: confirmed（仅下列已确认项；其余 unknown）
updated: 2026-09-29
source: inbox/2026-09-28-core-idea.md 末段；...
related: WORLD-002, WORLD-003
```

解析器**不得**假设 front-matter 存在；应兼容两种：
1. 正文顶部连续 `Key: value` 行（冒号后带空格）；
2. 无任何元数据行（模板占位 / 纯索引）。

`status` 值允许带括号注释（如 `confirmed（部分）`、`partially-accepted`），解析时需容错并保留原始字符串。

## 5. 条款级状态

提案（`proposals/*.md`）内部**逐项**标记状态，不是整份一态。以 `P-001.md` 为例：

| 条目 | 状态 |
| --- | --- |
| 第 1–3 项 | accepted（2026-09-29） |
| 第 4、5 项 | proposed |
| 第 6、7 项 | accepted（2026-09-28） |
| 待决 A/B/C/E/I | 已决；G 暂缓；K/N/O 待决 |

→ 后端若需投影提案，最小投影单元是**条目（item）**而非提案文件；一个提案文件可拆成多个不同状态的条款。

## 6. 来源定位与 hash

- `source` 字段格式：`仓库相对路径`（可加 `#锚点` / `#SRC-00N`），多来源用 `；` 分隔。
- 段落定位示例：`inbox/2026-09-28-core-idea.md 末段`、`...answers-1.md 第 1 点`。
- 提取记录保存源文件 **Git blob hash**（`git hash-object`），避免原文变化后旧提取继续生效：
  - `proposals/P-001.md` 记录 `inbox/2026-09-28-core-idea.md @ 706cef24...`；
  - `inbox/2026-09-29-answers-2.md @ d7c6b1fd...`；
  - `notes/bootstrap-sources-2026-10-07.md` blob `83a69341...`。
- 投影层需要「来源定位 + 内容 hash」双字段，才能做外部修改检测。

## 7. 引用关系

- `related:` 字段列出关联稳定 ID（如 `WORLD-001, WORLD-002, INTENT-001`）。
- 跨文件引用出现在：正文内的 `WORLD-*`/`CHAR-*` 字样、索引表、`decisions/log.md`、`state/current.md`。
- 引用是**单向**字符串引用，无双向边表；投影时需扫描全库重建反向引用（"被谁引用"）。反向引用清单由 `scripts/check-knowledge-ids.mjs` 已部分产出。

## 8. 版本处理

- 单一事实源：Git 提交历史 + 文件内容。索引/摘要是**可重建投影**，非事实源。
- 历史被替代条目：保留来源与替代关系，不悄悄删除（`decisions/log.md`「被取代内容」列）。
- 引用旧版本提案的正文变化后标 `stale`，重新核对后才能接受。
- 冲突：正文 / 已确认设定 / 作者新指令矛盾时建冲突记录，作者裁决后更新。

## 9. 外部修改检测

- 判据：`source` 指向的文件 + 记录的 blob hash 与当前 `git hash-object` 比对。
- 不一致 → 该条目标 `stale`，停止自动接受，触发重新核对（`accept.md` 第 1 步）。
- 章节提取复用：目标正文 hash 相同则复用既有提取，避免重复（`ingest.md` 第 1 步）。
- 后端投影必须支持「按 hash 判断陈旧」，不能只比较 `updated` 日期（日期可被手改，不可作为唯一真值）。

## 10. Git 提交策略

- 一个逻辑变更一个 commit（`accept.md` 第 5 步）。
- 未授权提交时展示 diff，不自动 `git add/commit` 到正式知识目录。
- 回退通过**新提交**撤销指定变更，避免 `reset` 覆盖作者工作（`handoff.md`）。
- 正式知识变更需要处理 Git 与数据库之间的失败恢复——两者**不在同一 ACID 事务**，需两阶段提交 / 补偿（见 ADR 待立项）。

## 11. 与领域模型 / API 的映射边界

| 领域概念 | Harness 载体 | 后端投影 |
| --- | --- | --- |
| Knowledge 实体 | `book/*.md` | 只读投影 + 稳定 ID + 状态 + source hash |
| Proposal | `proposals/*.md` | 只读投影（逐项状态） |
| Decision | `decisions/log.md` | 只读投影 |
| Chapter | `manuscript/*.md` | **不可写**（INV-01）；章节 revision/sourceHash 属 `apps/api` 运行时数据 |
| 正文修订 | 无（正文只读） | `apps/api` 负责 revision + sourceHash + 409 乐观锁 |

**关键区分**：Harness 的 Markdown 是「作者已确认知识」的事实源；`apps/api` 的数据库（未来）是「运行时推演/会话/任务」的工作状态。二者通过稳定 ID + source hash 关联，不可互相覆盖。

## 12. 尚未建档 / unknown 的语义

- `unknown` 与 `intentional unknown`（作者刻意留白）**不是错误**（INV-10），投影层不得将其当作「缺数据」报错。
- 模板占位（`待填写`）均视为 unknown。
- 「部分确认」= 实体存在但仅部分属性有值，**不等于实体不存在**（对应 V0.2 的索引一致性修复）。
