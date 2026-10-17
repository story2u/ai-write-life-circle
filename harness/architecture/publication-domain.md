# Publication Domain V1

## 边界

`internal/publication` 复用 application.Actor 与现有 Go 文件锁；不引入身份系统、数据库、微服务或 Harness 写入。`Service.Books` 是受信任的服务端书籍注册表（bookId → App + ownerID），支持多作者、多书籍，所有者不可由请求体指定。默认 server 注册当前 project 为一本作品；开发身份仅限现有 development/test 配置，production 仍要求原 Bearer 和显式作者 ID。Google 两个邮箱共享同一 Go 作者身份的既有规则不变，公开作者 slug 是随机 ID，与邮箱/私有用户 ID 无关。

目前 CLI 启动器仍只装配当前 project；多本作品/多作者注册表的部署配置与 Studio 选择器待后续 UI 集成。本领域多书籍隔离已测试，不宣称平台已经支持用户自助创建任意作品。

## 状态与事务

应用状态目录 `publications/state-v1.json`，权限0600；存放 Publications、只追加 Versions、暂存 Previews、幂等记录、公开作者 slug 映射和事务审计。该文件与 chapter-drafts、Notes、ReviewRun 分离，绝不在 Harness 中写回出版数据。

单一 JSON 文件是本 MVP 的完整出版事务边界：跨进程 O_EXCL 文件锁 → 读取/验证状态 → 创建不可变完整快照 → fsync 临时文件 → 原子 rename。公开指针、快照、审计与幂等记录在同一次写入提交；写失败时旧文件保持完整，没有多文件中间态需要恢复。暂存预览本身不可被公开 API 读取；过期30分钟，新预览时清理。保守处理未知锁，不自动抢锁；宕机锁清理沿用既有运维流程。

锁顺序固定为出版全局锁，再按 chapterId 排序获取每个章节 draft 锁。发布重新读取并验证当前 revisionId/contentHash/volumeId/chapterOrder、章节标题与全局卷顺序，保持章节锁直到出版 rename 完成。并发 Save 不能在检查后、提交前插入。Harness 文件的外部直接改写不遵守应用锁；正式导入/替换 Harness 应停止相关服务，不能宣称跨任意外部文件写入也存在事务隔离。

预览只接受章节身份与修订指纹，正文只能由服务端保存的 Revision 构建。chapterOrder=0 表示 Harness 未显式声明 order；公开顺序始终来自 `OrderedChapters()`，不按请求数组或 CH 编号重排跨卷章节。选中1–100章，单次快照正文总量不超过20MiB。

提交采用 previewId + baseVersionId，任何选中头版本/标题/排序变化均409，必须重新预览和人工确认。相同 Idempotency-Key 重放原版本；同键不同请求422。跨动作同键亦拒绝。失败事务不会消耗该键。预览不是公开发布；Agent 在领域和传输层均被拒绝。幂等键的作用域是作者+书籍。

第一次发布、完整章节集更新（包含单章撤回）、元数据变更、下架、重新上架都追加新 Version。历史不覆盖。下架与重新上架只改变新版本状态，不读取新草稿；重新上架恢复上一次公开内容，不自动采用未预览正文。slug 在所有历史版本中保留，避免被其他作品抢占；改 slug 后旧 URL 返回404，不自动重定向或暴露历史正文。稳定的随机 chapter slug 保证更新后读者 URL 不变。

## 公开读取

匿名只读 /v1/public/*，仅从 currentVersionId 指向且 state=listed 的快照构造明确的 PublicBook/PublicChapter/PublicAuthor DTO。没有读取私有 Harness/Revision/Notes/Review API。内部ID/hash/所有者/审计/预览不会序列化。不存在读取旧公开版本的匿名端点。下架后新源站请求404，首页/目录不再包含该书；章节撤回后旧章节URL404。

所有公开与管理响应均 no-store。不承诺从用户已打开页面、下载内容、搜索引擎副本撤回文字。前端 SSR/CDN 必须沿用此策略，否则源站正确不能等同于 CDN 撤回。当前尚无 SSR/Sitemap 实现，不能将 API no-store 当作完整 SEO/页面撤回验收。

单文件保存全部历史的代价是文件随版本数增长，所有出版请求串行化。适合少量作品 MVP，需监控体积并在规模增长时另行评估存储；本任务不重构原有草稿存储。

## 已执行验证

Go 测试覆盖草稿与快照隔离、只选一章、多卷/下一章、不可变历史、变更后预览409、磁盘失败与同键重试、锁保持到提交、并发发布CAS、过期预览、空正文、跨作者和Agent拒绝、独立出版历史及slug唯一。真实 HTTP 测试 `pnpm test:publication` 对响应同时做 OpenAPI/Zod 校验，固定合成章节，无生产数据/真实模型调用。
