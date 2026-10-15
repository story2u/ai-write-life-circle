# ADR-0002：VNext 作者笔记的最小应用状态

日期：2026-10-15；状态：已实施的工程选择；授权：本次作者任务明确要求最小真实笔记持久化。

VNext UI 文档把 Note、Margin、CanonChange、Entry、Session 列为候选后端模型。API YAML 与此前 V0.4 来源在解析后完全相同，尚未定义 Note 端点。不能把原型本地对象当成已批准的正式知识模型。

本轮只把作者非正式笔记纳入共享契约：content、可选 chapterId、purpose（普通笔记/下次要写）、status（进行中/归档）、服务端 ID、版本、作者与时间。原型的 text/nextUp/archived 通过清晰的类型映射对应这些字段；不新增“已确认事实”状态，不写 Markdown Harness。

- 单机文件状态按项目编码存储，笔记、成功重试结果与成功审计在同一个锁和原子 rename 事务内提交。
- 创建与修改都必须带 Idempotency-Key；修改还必须带 baseVersion。重复请求返回原结果，过期修改返回 NOTE_VERSION_CONFLICT，不能覆盖较新版本。
- 一个项目仅一条 active next_writing。已有计划时返回 NEXT_WRITING_EXISTS，作者需明确编辑或归档旧计划；不沿用原型的静默清除旧 nextUp。
- 笔记读取、创建和修改均只允许服务端认证的 author。项目限定由服务端配置决定；测试覆盖匿名、Agent、system、错误项目、输入与并发。local-author 仅用于本地开发；开发入口保留生产环境拒绝启动的保护，生产身份适配另行设计。
- Workspace 返回真实能力声明。没有声明的旧服务端禁用笔记入口；knowledge、annotations、canonChanges、agentRuntime 均为 false。
- 保存失败保留当前输入，不清空正文或笔记；归档为可恢复状态，没有永久删除端点。

暂缓：正式知识关系词汇、正式知识应用事务、结构化注记与审查任务、持久化思考会话、研究引文校验、生产身份。它们分别需要产品/作者决定或 Agent Runtime，不阻塞笔记闭环。Demo 的候选与判断只作用于演示数据；真实模式没有伪造的成功流程。

限制：文件状态和审计随笔记量增长，未加入分页、跨主机协调或数据库。部署前必须选择身份与存储方案；本轮不部署、不触发 LLM、不自动合并 PR。
