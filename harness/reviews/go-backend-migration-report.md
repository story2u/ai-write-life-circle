# Go 后端迁移验收报告

日期：2026-10-15。分支：codex/writer-agent-go-backend；交付 [PR #7](https://github.com/story2u/ai-write-life-circle/pull/7)。基线为 PR #6 的 abe53d6；#5 已合并，#6 仍为目录迁移前置 PR。本任务未合并 PR、未部署、未操作真实作者状态目录；原工作区未提交架构说明保持原样。

## 交付结果

Go 已接管默认本地 API、全栈启动、构建和前端 API E2E。React 业务组件、Adapter、Mapper、共享 Zod 和 API 契约未改写。旧 apps/api 继续作为差分参考和回滚目标；运行 Go 二进制和 Go 容器不需要 Node.js，前端与验证工具仍使用 Node/pnpm。

| 范围 | 已迁移操作 |
| --- | --- |
| Workspace (2) | GET/PATCH /v1/projects/:projectId/workspace |
| Chapter (4) | GET chapters、GET chapters/:id、GET/POST chapters/:id/revisions |
| Note (4) | GET/POST notes、GET/PATCH notes/:id |
| 系统 (2) | GET /healthz；仅 development 的 Harness projection |

合计 **10 条业务操作 + 2 个系统入口**。未知方法、Notes 的 405、分页、ETag、no-store、Problem Details 和章节保存的请求关联 ID 保持原语义。没有新增正式知识写入或 Agent Runtime；capabilities 延续原真实能力声明。

## 数据与并发

- 旧 Workspace、chapter-drafts、notes、audit.jsonl 与幂等记录使用原路径、base64url 编码和 JSON 结构；不需要格式升级或清空状态。
- 正文保留原始 Markdown、CRLF、空行和尾空格。Git blob hash 依据源文件原字节，内容 hash 依据 Node 的 UTF-8 编码规则。孤立 UTF-16 代理项、Unicode 空白、JSON null/缺失与指纹顺序有独立兼容层和 Node Golden Tests。
- 沿用 O_EXCL .lock 文件协议，跨请求、跨进程协调；不用进程内 Mutex 冒充文件锁。锁等待有界、可取消，不自动删除未知持有者的锁。Node 和 Go 不同时写真实状态。
- Draft 的不可变历史、父链、CAS、无变化保存、幂等重放、Harness 精确采纳与分歧 409 均保留。成功落盘后完成审计失败仍返回 AUDIT_WRITE_FAILED，同一键重试可恢复原结果。
- Note 内容、重放结果和成功审计在同一个 JSON 事务中提交；归档可恢复，active next_writing 唯一。错误不会返回假的成功。
- 原子写入新增文件 Sync，Rename 为提交点；目录同步在文件系统支持时尽力完成。没有宣称跨主机或所有文件系统的崩溃恢复保证。

旧数据测试不是 Go 空库自测：先由保留的 Node 实现创建 Workspace、Draft、无变化重试记录与 Note，停止写入后复制完整目录；Go 直接读取、重放旧键、更新并重启；再停止 Go，由 Node 读取并重放 Go 生成的数据。测试通过。真实作者目录没有执行自动切换，生产数据切换仍按下文的一致性边界进行。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| Go 单元/集成 + race | 17 个顶层测试，51 个叶子用例；不把父测试与子测试重复相加，子进程 helper 不计入 |
| 原 Node API / Web 单元测试 | 29 + 47 = 76 项通过 |
| Node/Go 差分 | 95 项对照断言通过，比较全部业务字段、状态与业务头；只规范化随机 ID/时间 |
| 浏览器 E2E | 9 项 Demo/视觉/布局 + 2 项 Go API 流程，共 11 项通过 |
| 原生二进制 smoke | 在不含 Node 的 PATH 中启动、healthz、SIGTERM；生产身份/公网绑定保护通过 |
| 默认全栈 smoke | dev:local 启动 Go + Vite，代理读取 Workspace，两个进程组均正确退出 |
| 工程 | frozen lockfile、typecheck、lint、build、go vet、OpenAPI 复现与校验、Harness 重建/ID 检查通过 |
| Linux 交叉编译 | CGO_ENABLED=0 构建静态 ELF；不依赖后端 Node Runtime |
| 容器 | 本机 daemon 未运行；[远端 CI](https://github.com/story2u/ai-write-life-circle/actions/runs/38693551252) 已实际构建 Go scratch 与 Web 镜像，验证生产拒绝启动、隔离健康检查，全部通过。该运行验证实现提交 9c4714a；后续报告提交状态以 [PR #7](https://github.com/story2u/ai-write-life-circle/pull/7) 的当前检查为准 |

对照覆盖 Workspace 恢复/合并、章节列表/原文/hash/排序/历史、无变化保存及重放、409、源采纳/分歧、笔记创建/编辑/归档/恢复/重试/唯一计划，以及角色、项目、JSON、路径、字段与大请求校验。另有独立 Go 进程争用正文与 Note 的 CAS、审计失败注入、损坏状态、锁取消与临时文件清理测试。Node 生成的 Golden 覆盖 Unicode、代理项、字节解码、元数据、引用、重复 ID、模板和软链接；CI 验证生成结果可复现。

测试使用临时资料和状态目录。所有 manuscript/book/proposals/decisions/inbox/state 的 Git 差异为零。保留 32 条既有 OpenAPI 警告和前端大包提醒。

## 同机性能

环境：Apple M5 / darwin arm64，Node v22.22.3，go version go1.27.2 darwin/arm64。测量时间：2026-10-15T06:27:09.625Z。每类 30 次顺序请求，3 次新进程启动，使用相同 Harness、文件系统及独立状态目录。启动不是冷 OS 文件缓存；RSS 是工作负载后采样，非峰值。完整数据与方法见 [原始 JSON](go-backend-performance.json)。

| 指标 | Node | Go |
| --- | --- | --- |
| 进程启动中位数 (ms) | 49.565 | 3.705 |
| 工作负载后 RSS (MiB) | 82.11 | 20.11 |
| 章节列表 中位数 / P95 (ms) | 0.647 / 1.888 | 0.28 / 0.451 |
| 章节详情 中位数 / P95 (ms) | 0.651 / 0.827 | 0.364 / 0.501 |
| Notes 查询 中位数 / P95 (ms) | 0.24 / 0.408 | 0.178 / 0.216 |
| 保存 中位数 / P95 (ms) | 1.387 / 1.692 | 16.03 / 17.855 |

两者各自 8 个并发保存均为 1 次创建、7 次 409。Go 在启动、查询和内存采样上更低，但保存更慢；Go 增加了数据与审计的 fsync，旧 Node 不做该同步，因此不能把差异仅归因于语言，未为缩短耗时而取消同步。样本不是长期生产性能结论。

复现：`pnpm bench:api`。生成该报告数据时使用 `node scripts/benchmark-api.mjs --write-report`，会明确写入本文件旁的 JSON。

## 切换与回滚

- 默认：pnpm dev:api / dev:api:go；pnpm dev:local / dev:local:go；pnpm build；pnpm test；pnpm harness:rebuild。
- 对照：pnpm test:api:parity；pnpm go:goldens。
- 旧入口：pnpm dev:api:node / dev:local:node / build:api:node；旧源码、契约和测试保留。

实际数据切换必须先停止旧写入进程，备份完整 WRITER_AGENT_STATE_DIR，再让 Go 使用同一路径。出现问题时先停止 Go，再用旧入口读取当前状态；回滚兼容已验证。勿把较旧备份覆盖到已有新写入的目录；调查或恢复时先复制到另一路径。未知遗留 .lock 必须确认无持有进程后再处理。

Docker API 使用固定 Go 1.27.2 多阶段构建和 scratch 运行镜像；Web 镜像只运行前端构建，不因根 build 命令切换而新增 Go 工具链依赖。api_state Volume 保留；只读挂载的是包含 manuscript/book 的项目根目录，可用 WRITER_AGENT_HARNESS_SOURCE 指定外部作者项目。镜像保留旧容器 UID，避免未经批准地改写现有 Volume 权限。生产端口仅映射宿主机 loopback。

## 差异与未解决项

1. 已覆盖的业务/合法数据对照没有差异；新增 32MiB 请求体上限、非法配置拒绝启动、跨进程审计锁与文件同步属于明确的安全/持久化加固。32MiB 覆盖当前 2Mi Unicode 字符 Markdown 的 JSON 转义开销；旧 Node 无限读取的超大 Workspace 或额外字段可能被拒绝。没有声称穷尽所有畸形 HTTP 报文的解析器行为。
2. 生产认证仍未选择或实现。WRITER_AGENT_ENV=production 或 NODE_ENV=production 拒绝 local-author；EC2 deploy job 显式暂停，不能通过开放开发身份来通过部署。CI 镜像与本地开发验证不代表生产可用。
3. 仍为单机文件存储；没有引入数据库、分页、数据增长回收或共享网络文件系统协调。真实作者工作负载、真实生产状态目录切换未执行。
4. 旧 Node Runtime 保留是本轮回滚要求，不是生产依赖；待作者确认迁移稳定后可单独移除。Go PR 依赖 #6 的目录整理，保持 Open，不自动合并。

设计依据与详细规则见 [迁移基线](../architecture/go-backend-migration.md)。工具链来源：[Go 官方稳定下载](https://go.dev/dl/)，本机自动工具链与 CI/go.mod/Docker 固定一致；仅额外使用 Go 官方 x/text，以解决 Node 的 Unicode 排序和解码兼容。

## PR 审查反馈处理（2026-10-15）

- P2 历史部署入口：采用明确废弃方案。`BUILD_AND_DEPLOY.sh` 已移除旧构建/上传/SSH 流程，执行即提示废弃并返回 1；不再尝试错误的 Dockerfile 路径或远端 Compose。其他历史 EC2 Web/PostgreSQL 工具在部署说明中标记为不支持、未验证；旧流程文档加上历史标记，CLAUDE 入口移除推荐执行旧脚本的说明。
- 本地检查：脚本 Bash 语法通过；从仓库根目录、脚本目录和仓库外目录调用均返回 1，显示废弃提示；使用命令探针验证未调用 Docker、SSH、SCP、curl 或 sudo。文档相对链接检查通过。未实际部署或操作作者数据。
- 合并依赖未变：#6 先合并，#7 再切换 base 为 main 并重新核对 diff/CI。按原任务要求，两项 PR 保持 Open，未执行合并。
- 保留 production 身份拒绝启动和 fsync。技术迁移完成不等于生产可用；生产认证与部署安全仍需独立实现。
