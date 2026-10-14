# 知识档案 ID 冲突与映射审查

审查日期：2026-10-14
审查基线：`origin/main` `9f5397f318b61d21248b079462150bed57eabd1c`

> 作者于 2026-10-14 明确批准下列映射。本功能分支已同步更新 ID、文件名、索引及引用。只变更稳定标识和引用，不改变设定正文、来源、确认状态或历史时间。

## 冲突与批准结果

| 冲突 ID | 原实体 | 处理结果 | 来源 / 状态 |
| --- | --- | --- | --- |
| WORLD-001 | `book/world/WORLD-001-realms.md`：两界结构与分类阶层；P-001 第 4 项：三类生命的维持与失控 | `WORLD-001` 保留给两界结构。P-001 第 4 项仍为 proposed，不分配 WORLD ID | 前者来自 2026-10-07 历史摘要、confirmed；后者来自作者 2026-09-28 原话提案、proposed |
| WORLD-002 | `book/world/WORLD-002.md`：开篇社会；旧 `WORLD-002-life-relations.md`：三类生命与关系 | 前者保留 `WORLD-002`；后者改为 `WORLD-004`，文件名更新为 `WORLD-004-life-relations.md` | 开篇社会来自 inbox 作者确认；首版关系档案来自 2026-10-07 历史摘要，confirmed |
| WORLD-003 | `book/world/WORLD-003.md`：最终真相；旧 `WORLD-003-desire-action.md`：欲望与行动 | 前者保留 `WORLD-003`；后者改为 `WORLD-005`，文件名更新为 `WORLD-005-desire-action.md` | 最终真相来自 inbox 作者确认；首版欲望档案来自 2026-10-07 历史摘要，confirmed |
| P-001 | `proposals/P-001.md`：核心创意建档；旧 `P-001-bootstrap.md`：首版冲突候选 | 前者保留 `P-001`；后者改为 `P-002`，文件名更新为 `P-002-bootstrap.md`，其五个条款引用同步为 `P-002.1`—`P-002.5` | 前者 partially-accepted；后者 proposed |

## 同步更新范围

- 更新 `book/world/index.md`：三类生命的维持与失控继续作为 P-001 第 4 项的无编号候选；首版档案列为 WORLD-001、WORLD-004、WORLD-005。
- 更新 `book/index.md`、`state/current.md`、`notes/bootstrap-sources-2026-10-07.md`、`book/intent.md`、`README.md` 中的状态或路径。
- 更新 WORLD-001/002/004/005 档案与 P-001/P-002 中的 `related`、正文引用及条款 ID。
- 在 `decisions/log.md` 记录作者批准。提交哈希将在 ID 映射变更提交完成后补记。
- 旧审查 `docs/knowledge-id-collision-review.md` 保留为 V0.2 历史记录，并标记映射已完成。

## 保留的创作边界

- `WORLD-004`、`WORLD-005` 的历史来源和 `confirmed` 状态保持不变；重新编号不提升证据等级，也不表示采纳提案。
- P-002 的五项内容仍为 proposed；P-001 第 4 项仍为 proposed 且无 WORLD ID。
- 不更改 `manuscript/` 正文。AI 归纳、历史摘要与作者 inbox 原话继续区分。

## 验证

运行 `node scripts/check-knowledge-ids.mjs --fail` 应确认文件级和索引级冲突均已消除。该检查现在可以加入 CI，阻止新的稳定 ID 冲突。
