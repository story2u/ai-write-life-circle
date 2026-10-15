# Writer Agent Go API

默认后端。Go 1.27.2、标准库 HTTP/JSON/文件存储，唯一模块依赖为 Go 官方 `golang.org/x/text`（兼容 Node 的 Unicode 排序与解码）。没有数据库、LLM 或写入正式 Harness 的通路。

```sh
cd apps/api-go
go test ./...
go test -race ./...
go vet ./...
go build -o dist/writer-agent-api ./cmd/server
./dist/writer-agent-api
```

二进制运行无需 Node.js。开发服务器默认 127.0.0.1:8787。支持 WRITER_AGENT_HARNESS_ROOT、WRITER_AGENT_STATE_DIR、WRITER_AGENT_PROJECT_ID、WRITER_AGENT_API_PORT；STATE_DIR 默认为 ~/.local/share/ai-write-life-circle。WRITER_AGENT_ENV=development/test；NODE_ENV 仅兼容旧环境。production 或非 loopback 绑定会拒绝启动，因为生产身份适配器尚未实现。不要改为公开 local-author 来完成部署。

实现十条业务操作和两个系统入口：Workspace GET/PATCH，Chapters GET，Chapter GET，Revisions GET/POST，Notes 列表/详情 GET、POST/PATCH；GET /healthz；development-only /internal/projects/:projectId/harness-projection。完整请求/响应规范见 [契约](../../harness/contracts/README.md)。身份解析通过 transport.Resolver 注入，运行入口只提供本地开发 author，不信任请求中的角色声明。测试角色服务只在 parity build tag 下编译，不进入正式镜像。

HTTP 对正文实施 32MiB 上限，覆盖 2Mi Unicode 字符的合法 JSON 转义体。Workspace/Revision 的未知字段按旧 Zod 行为移除，Notes 保持严格字段检查。响应、请求 ID、ETag、错误和事务语义与旧实现自动对照；JavaScript Unicode、字符串指纹和原始 Markdown 字节通过 Golden Tests 验证。

旧 Workspace、Draft、Note、Audit、幂等记录使用原路径和格式直接读取，不运行数据重写迁移。跨进程 O_EXCL .lock 协议沿用 Node；临时文件 Sync + Rename，章节审计追加前后保持旧错误语义，Notes 三类记录一次提交。未知遗留锁不自动删除。支持本机 macOS/Linux；多机共享网络文件系统不在本次验收范围。

停止旧 API 写入→备份完整状态目录→启动 Go。不要让两种后端同时写真实目录。回滚时停止 Go，使用 `pnpm dev:api:node` 指向同一目录；已由对照测试验证 Node 可读取并重放 Go 生成的状态。需要调查时，将备份恢复到另一路径，勿覆盖更新的数据。

[迁移基线](../../harness/architecture/go-backend-migration.md) · [验收报告](../../harness/reviews/go-backend-migration-report.md)
