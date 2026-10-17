# Figma 设计来源与当前同步状态

- 最新读取：2026-10-14；实现与验收：2026-10-15（Asia/Shanghai）。
- 来源：[Writer Agent UI/UX Design](https://www.figma.com/make/kWBOdcae5utBZ6VtBHHXui/Writer-Agent-UI-UX-Design)。fileKey `kWBOdcae5utBZ6VtBHHXui`，node `0:1`，React / TypeScript。
- 浏览器版本标识：Version 6 / Upgrade Writer Agent UI/UX。交接文档：DES-VNEXT，UI/UX 设计权威；V0.4 未被修改的 API/领域候选仍有效。
- 官方连接器 get_design_context 和身份查询成功，返回最新资源清单；本会话没有资源读取工具，截图端点不支持 Make。作者随后提供本地导出 `/Users/bruce/git/story/Writer Agent UI_UX Design`，据此读取最新完整源码。
- [资源及 SHA-256 快照](vnext-resource-manifest.json)、[来源交接文档副本](vnext-source-handoff.md)、[差异分析](vnext-sync-gap-analysis.md)。原始导出目录未修改；没有使用旧 V0.3 缓存替代 VNext。

## 已同步

稿纸、写作/书/思考导航、按需章节与注记/思考抽屉、续写卡、随手记、作品记忆、思考四阶段、故事冲突对照与定稿候选演示。CSS tokens、图标、暖色 Light/Dark、18px / 1.9 中文正文来自当前源码。原型控件未复制到生产作者导航。

保留现有 Markdown + TipTap 管线、无法无损往返时的只读保护、不可变草稿版本、幂等、409、排队保存取消、恢复和内存导出。新增真实笔记列表/创建/编辑/归档；原型字段没有直接变成正式知识对象。

Demo 展示模拟知识、注记、思考和候选变更，研究引用均标为未核验。API 模式有真实章节与笔记；其余能力明确不可用，不加载 Demo Agent 数据。

## 视觉证据与限制

Playwright 检查 1440/1024/768/390px，Light/Dark、写作、抽屉、Focus，保存本地截图。另用导出源码的临时副本建立本地参考（仅替换 Make 专用 Vite 启动配置，UI 源码未改），定性比较 1440px Light/Dark 与 390px Dark。

正常稿纸的计算值相同：18px、34.2px 行高、36px 缩进、16.2px 段距、608px 内容宽度，1440px 下起点 x=416/y=272，纸色 #fbfaf7。未执行 Figma 服务端截图的像素差分；不能称全应用逐像素还原。笔记的真实加载、并发与错误行为采用工程状态；无实际数据的入口保留真实空态。

当前源码没有使用 MCP 清单中的十张历史图片；可见图标直接来自 ui.tsx 的 SVG 基础组件，没有临时 Figma 资源 URL。

## 契约来源

旧完整来源 `harness/contracts/source/api-spec-v0.4.0-figma-copy.yaml` 保留。新导出副本 `harness/contracts/source/api-spec-vnext-export-2026-10-14.yaml` 与旧来源解析后完全相同；新 Note/Capabilities 是独立工程扩展，不冒称 Figma 新 API。详见[实施报告](../reviews/vnext-figma-fullstack-sync.md)。

## story2u Public Website V1

2026-10-17 读取同一 Make 的最新公开站点导出；新增 Home/Discover/Book/Reader/Publish 与 site handoff，区别于本文件上方的10月14日 Studio 快照。来源指纹、候选契约差异与组件映射见 [公开站差异分析](story2u-public-site-v1-gap-analysis.md)，四种宽度视觉验证及限制见 [公开站交付报告](../reviews/story2u-public-site-v1-report.md)。
