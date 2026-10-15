# Go 后端迁移基线

日期：2026-10-15。分支：codex/writer-agent-go-backend。基线为 PR #6 的 abe53d6（main 098f88f + 目录整理）；PR #5 已合并，#6 尚未合并且 CI 通过。本任务在独立 Worktree 实施，不合并 #6、不改 main；原工作区的未提交架构说明不复制或覆盖。

## 行为与数据盘点（实现前）

已逐项读取 apps/api/src 和 test、共享 Zod、前端 HTTP Adapter/Mapper、OpenAPI、Harness Mapping、笔记 ADR、CI 与部署入口。实际为十条业务操作：Workspace GET/PATCH；Chapters GET；Chapter GET；Revisions GET/POST；Notes 列表/详情 GET、创建 POST、修改 PATCH。另有 GET /healthz，以及仅 development 暴露的只读 Harness projection。未知方法通常 404，Notes 未支持方法 405；不得统一改成 ServeMux 的默认响应。

- Workspace：按 project/actor 的 base64url 路径存 JSON，部分字段合并；Zod 移除未知字段，显式 null 不合法。首次布局缺省，保存布局时补齐 leftW=280/rightW=400、双面板关闭；其他字段保持。
- Chapter：Harness 顶部键值元数据，不是 YAML。标题、稳定 ID、文件名和正整数 order 必须符合现有行为；完整原文件 SHA-256、Git blob SHA-1 和正文 Markdown 分别保留。正文不重排空行、CRLF、尾空格。读取允许 author/agent，历史及保存仅 author。
- Draft：chapter-drafts/<project>/<chapter>.json，包含 sourceHash/sourceRevision、早期 sourceRevisionHistory、adoptedDraftRevisionId、不可变 revisions 与 noOpIdempotencyRecords。CAS 在锁内检查；内容 hash 为 UTF-8 SHA-256；幂等比较原 markdown hash 与 baseRevisionId，不包含 trigger/clientSavedAt。历史按 parent 链遍历，不按时间排序替代 lineage。完全相同应用正文被作者写入 Harness 时采纳新 source baseline，分歧为 409。
- Note：notes/<project>.json 的 items/requests/audit 一次提交。actor+key 的 JSON 数组 base64url 是 replayKey；fingerprint 为 JSON.stringify([noteId|null, 经 Zod 归一化后的 input])，字段顺序固定 content/chapterId/purpose/baseVersion/status。Go 必须保持该顺序和 JavaScript 字符串转义。当前锁定 Zod 的 max string 按 Unicode code points 检查，不能按 Go 字节或旧版 Zod 的 UTF-16 长度猜测。归档可逆，active next_writing 唯一，不清除旧计划。
- Audit：章节保存先追加 requested，再按成功/冲突/失败追加结果；已有数据格式保留。完成审计失败时返回 AUDIT_WRITE_FAILED，即使草稿已落盘。Notes 审计在 notes JSON 内，与幂等结果原子提交。
- 响应：no-store、Problem Details、ETag；x-request-id 目前仅章节保存响应和对应错误携带。401/403、请求校验与错误文案依现有实现。

## 技术与组织

Go 1.27.2（官方稳定下载清单与本机自动工具链验证通过），go.mod、CI、Docker 固定。HTTP、JSON、密码学随机 UUID、hash、文件持久化优先标准库。应用逻辑与 HTTP 解耦；storage 只负责文件锁/原子持久化，harness 独立只读；不引入数据库或消息设施。Unicode 排序若需要依赖，限于 Go 官方 x/text collate，以对齐 Node localeCompare。

apps/api-go 保留独立 cmd/server、cmd/harness；internal 分为 config、transport、application、harness、storage、compat。旧 apps/api 保留作运行回滚与差分参考，不能提前删除。

## 一致性边界与安全

沿用旧 O_EXCL .lock 文件路径，确保 Go 多进程和旧 Node 的锁协议互斥；不自动清理未知锁，避免误删活跃锁。锁等待有界并响应 Context。临时文件同目录、独占创建、Sync、原子 Rename，保留已有 JSON 格式和数据目录，不升级、不清空。Note 事务完整提交；章节审计失败语义与旧实现一致。

开发入口默认 127.0.0.1，仅显式开发身份。生产环境拒绝 local-author；内部诊断在非 development 为404。HTTP 层增加有界请求体（满足完整 2Mi Unicode code points 的 Markdown 的 JSON 转义开销），不把未认证服务绑定公网。生产身份仍是独立未解决项，部署流程必须保持关闭，而非绕过保护。

## 验证、切换与回滚

用隔离 Harness 与状态副本自动对照 Node/Go：规范化随机 UUID/时间/request-id，保留全部业务字段、状态、头和错误。旧 Node 创建数据后停写，Go 直接读取、重放旧键、修改并重启；再以 Node 读取 Go 数据验证回滚。另测独立 Go 进程争用、锁超时、存储失败、源采纳与分歧。所有 fixture 正文只是测试材料；真实创作目录只读。

验收通过后默认 dev:api/dev:local/build/test/前端 E2E 切换 Go，旧入口显式 :node 保留。停止旧进程→备份完整 STATE_DIR→启动 Go；失败则停止 Go→保留现状态→切回旧 API。不得把较旧备份直接覆盖已产生的新写入。冻结写入后可恢复备份到另一路径做校验。禁止双实现同时写真实状态。

最终测试数量、差异、旧数据验证和同机性能数据见后续验收报告。当前本机 Docker daemon 未运行，容器构建需 CI 验证，不把静态配置校验当作镜像运行成功。
