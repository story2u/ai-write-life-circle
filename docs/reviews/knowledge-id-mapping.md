# 知识档案 ID 冲突与映射审查

审查日期：2026-10-13
审查对象：`book/`、`proposals/`、`decisions/`、`harness/`、`notes/`、`state/` 中的稳定 ID 使用情况
依据：`harness/data-contract.md`「ID 不复用，改名保持 ID」；`AGENTS.md`「区分作者原话 / 正文证据 / 已确认设定 / AI 推断 / 候选建议」

> **本文档只报告冲突并给出映射建议，不自动重编号、覆盖、删除或改写任何已确认档案。**
> 所有「推荐映射」均待作者逐项裁决后才会执行。裁决前 `scripts/check-knowledge-ids.mjs` 仅作报告工具（默认退出码 0）。

## 1. 结论摘要

Harness 中存在 **4 组同号异义**（同一稳定 ID 指向不同知识实体），违反「ID 不复用」约定：

| 原 ID | 实体 A（较早，作者 inbox 原话确认） | 实体 B（较晚，2026-10-07 首版建档） | 冲突类型 |
| --- | --- | --- | --- |
| WORLD-001 | 两界结构与分类阶层（`WORLD-001-realms.md`，confirmed） | 三类生命的维持与失控（P-001 第 4 项，proposed） | 索引内多重定义 |
| WORLD-002 | 开篇社会（`WORLD-002.md`，confirmed 部分） | 三类生命与关系（`WORLD-002-life-relations.md`，confirmed） | 文件级 + 索引内多重定义 |
| WORLD-003 | 最终真相（`WORLD-003.md`，confirmed） | 欲望与行动（`WORLD-003-desire-action.md`，confirmed） | 文件级 + 索引内多重定义 |
| P-001 | 核心创意建档（`P-001.md`，partially-accepted） | 首版冲突候选与待确认问题（`P-001-bootstrap.md`，proposed） | 文件级 |

**成因**：`main` 先后合入两套独立产生的档案——一套由作者 inbox 原话直接确认（2026-09-28/29），另一套由 2026-10-07「首版建档」从历史检索摘要登记（`notes/bootstrap-sources-2026-10-07.md`）。两套档案对 `WORLD-001`—`WORLD-003`、`P-001` 赋予了不同含义，合并时均予保留，产生同号异义。合并提交为 `b71a09e`（见 `decisions/log.md` 2026-10-13 条目）。

## 2. 冲突明细

### 2.1 WORLD-002

| 字段 | 实体 A：开篇社会 | 实体 B：三类生命与关系 |
| --- | --- | --- |
| 文件路径 | `book/world/WORLD-002.md` | `book/world/WORLD-002-life-relations.md` |
| 实体语义 | 开篇社会是「一种极端、失衡的社会结构」，是背景、非主题 | 三类生命（能量体/碳基/硅基）的感知、欲望倾向与相互关系的群体画像 |
| 来源 | `inbox/2026-09-28-core-idea.md` 末段；`inbox/2026-09-28-answers-1.md` 第 1 点 | `notes/bootstrap-sources-2026-10-07.md#SRC-001/002/004` |
| 作者确认状态 | confirmed（性质已确认；具体制度 unknown） | confirmed（证据为历史摘要，完整原始消息未覆盖） |
| updated | 2026-09-28 | 2026-10-07 |

关联引用（实体 A，`WORLD-002` 被引用位置）：`book/characters/CHAR-001.md:31`、`book/index.md`、`book/intent.md:6`、`book/world/WORLD-001-realms.md`、`book/world/WORLD-003-desire-action.md`、`book/world/index.md`、`proposals/P-001-bootstrap.md`、`proposals/P-001.md`、`decisions/log.md:6`、`notes/bootstrap-sources-2026-10-07.md:7`、`state/current.md:5`。

### 2.2 WORLD-003

| 字段 | 实体 A：最终真相 | 实体 B：欲望与行动 |
| --- | --- | --- |
| 文件路径 | `book/world/WORLD-003.md` | `book/world/WORLD-003-desire-action.md` |
| 实体语义 | 全书最终揭示「意识试图通过不同形式认识自己」及「能量体不是神」 | 「欲望为第一推动力，无欲望则无行动」及非碳基动力、自主性边界未定 |
| 来源 | `inbox/2026-09-28-core-idea.md`；`inbox/2026-09-28-answers-1.md` 第 2 点；`inbox/2026-09-29-answers-2.md` | `notes/bootstrap-sources-2026-10-07.md#SRC-001/002/004` |
| 作者确认状态 | confirmed | confirmed（证据为历史摘要） |
| updated | 2026-09-29 | 2026-10-07 |

关联引用（实体 A）：`book/characters/CHAR-001.md:31`、`book/index.md`、`book/intent.md`、`book/world/WORLD-001-realms.md`、`book/world/WORLD-002-life-relations.md:7`、`book/world/index.md`、`proposals/P-001-bootstrap.md`、`proposals/P-001.md`、`decisions/log.md`、`notes/bootstrap-sources-2026-10-07.md`、`state/current.md:5`。

### 2.3 WORLD-001（索引内多重定义）

- 文件实体：`book/world/WORLD-001-realms.md` 声明 `ID: WORLD-001`，「两界结构与分类阶层」，confirmed，2026-10-07。
- 索引条目：`book/world/index.md`「当前档案」表将 `WORLD-001` 标为「三类生命的维持与失控」，指向 `proposals/P-001.md` 第 4 项，status proposed。

二者含义不同：前者是上下两界与分类阶层的世界框架（已确认），后者是 P-001 中尚待作者接受的「维持→极端→灾难」三类生命表。

### 2.4 P-001

| 字段 | 实体 A：核心创意建档 | 实体 B：首版冲突候选与待确认问题 |
| --- | --- | --- |
| 文件路径 | `proposals/P-001.md` | `proposals/P-001-bootstrap.md` |
| 实体语义 | 作者 2026-09-28 核心创意的逐项变更提案（第 1–3、6、7 项已接受；第 4、5 项未决） | 2026-10-07 建档时对「主要冲突」的 AI 结构归纳候选（5 项，均 proposed） |
| 来源 | `inbox/2026-09-28-core-idea.md` | `notes/bootstrap-sources-2026-10-07.md#SRC-002—005` |
| 作者确认状态 | partially-accepted | proposed |
| updated | 2026-09-29 | 2026-10-07 |

关联引用（实体 A，`P-001`）：`book/characters/CHAR-001.md:25`、`book/index.md`、`book/intent.md`、`book/world/WORLD-001-realms.md:29`、`book/world/WORLD-002-life-relations.md`、`book/world/WORLD-002.md:21`、`book/world/WORLD-003-desire-action.md`、`book/world/WORLD-003.md:18`、`book/world/index.md`、`decisions/log.md`、`harness/data-contract.md:3`、`notes/bootstrap-sources-2026-10-07.md`、`state/current.md`。

## 3. 推荐映射方案（待作者确认）

以下仅为**建议**，用于把四组同号异义拆成唯一编号。作者可选择接受、调整或另给编号；裁决前不做任何文件改动。

| 现 ID | 建议保留原 ID 的实体 | 建议改号的实体 | 建议新 ID |
| --- | --- | --- | --- |
| WORLD-001 | 两界结构与分类阶层（`WORLD-001-realms.md`，confirmed） | 三类生命的维持与失控（P-001 第 4 项，proposed） | 在作者接受前**不占 WORLD 编号**，从索引「当前档案」表移除或标「待分配」 |
| WORLD-002 | 开篇社会（`WORLD-002.md`） | 三类生命与关系（`WORLD-002-life-relations.md`） | `WORLD-004` |
| WORLD-003 | 最终真相（`WORLD-003.md`） | 欲望与行动（`WORLD-003-desire-action.md`） | `WORLD-005` |
| P-001 | 核心创意建档（`P-001.md`） | 首版冲突候选与待确认问题（`P-001-bootstrap.md`） | `P-002` |

### 映射取舍原则（供参考，非硬性规定）

1. 优先保留**作者 inbox 原话直接确认**的实体为原 ID（`WORLD-002.md`、`WORLD-003.md`、`P-001.md` 的来源均为 `inbox/`，属作者直接确认而非历史摘要转述）。
2. 2026-10-07 首版建档的三个世界规则（`*-life-relations.md`、`*-desire-action.md`）虽同为 confirmed，但其证据是「历史检索摘要」，完整原始消息未覆盖，故建议顺延改号，避免覆盖作者原话对应的编号。
3. `WORLD-001` 的特殊性：P-001 第 4 项目前是 proposed，尚非正式世界规则，建议它在被接受前不占编号，由 `WORLD-001-realms.md` 独占 `WORLD-001`。

若作者接受，后续需同步更新的引用点（仅列出，不自动执行）：`book/world/index.md` 两处表格、`book/index.md`、`state/current.md`、`decisions/log.md`（增补「ID 映射」决策）、各 `WORLD-*.md` 内 `related`/正文中的跨文件引用、`proposals/P-001-bootstrap.md` 声明 ID。

## 4. 硬约束（不可违反）

1. 不得自动决定哪一个设定正确。
2. 不得覆盖、删除或重编号任何**已确认**的创作档案。
3. 不得丢失任何作者原话或已确认设定。
4. 不得自行篡改作者确认日期或历史记录的时间顺序。
5. 在作者确认并消除历史冲突前，`scripts/check-knowledge-ids.mjs` 仅作报告，不得以 `--fail` 升级为 CI 阻断。

## 5. 检查工具

- 脚本：`scripts/check-knowledge-ids.mjs`（stdout 报告，默认退出码 0；`--json` 机器可读；`--fail` 用于未来 CI 阻断）。
- 运行：`node scripts/check-knowledge-ids.mjs`

## 6. 待作者裁决

| # | 冲突 | 待裁决内容 |
| --- | --- | --- |
| 1 | WORLD-001 | `两界结构与分类阶层` 是否独占 `WORLD-001`；P-001 第 4 项在 accepted 前是否不占编号 |
| 2 | WORLD-002 | `开篇社会` 保留 `WORLD-002`，`三类生命与关系` 改 `WORLD-004`？ |
| 3 | WORLD-003 | `最终真相` 保留 `WORLD-003`，`欲望与行动` 改 `WORLD-005`？ |
| 4 | P-001 | `核心创意建档` 保留 `P-001`，`首版冲突候选` 改 `P-002`？ |

> 关联文档：`docs/knowledge-id-collision-review.md`（V0.2 冲突审查）与本文件结论一致；本文件为 V0.4 阶段的映射审查入口。
