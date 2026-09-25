# ai-write-life-circle

作者负责创意与正文；AI 负责创作资料管理、连续性检查、表达研究与启发。

## 开始使用
1. 在任意有文件读写能力的 AI 编辑器中打开本目录。
2. 输入：`先读 AGENTS.md，按 harness/workflows/bootstrap.md 帮我建立本书档案。不要替我写正文。`
3. 作者把正文放进 manuscript/，把未经整理的想法放进 inbox/。
4. 写前用 prepare；写后用 ingest；查矛盾用 review；寻找表达方式用 inspire；认可建议后用 accept。

不需要安装依赖或配置模型 API。使用编辑器中实际可用的模型，不绑定特定品牌或版本；“Gemini 3.8”仅视为用户举例，未在此确认型号可用性。

## 目录
- [AGENTS.md](AGENTS.md)：简短入口与边界
- [架构评估](docs/architecture.md)：Markdown 与 pi 的比较及演进条件
- [任务路由](harness/index.md)：按需读取工作流
- [书籍索引](book/index.md)：作者意图、角色、情节、世界与风格
- [会话状态](state/current.md)：当前任务与恢复点
- [工具接入](docs/adapters.md)：跨编辑器启动方法
- [验收场景](evals/cases.md)：检查 AI 是否尊重创作权与证据

## 日常指令
- “写前准备第 3 章，只梳理已确定目标、约束和未解问题。”
- “我写完了 manuscript/ch003.md，提取设定变化，生成待确认清单。”
- “我想表达亲近的人也可能彼此不理解。先复述你的理解，再找有出处的表达案例。”
- “检查第三章人物知识边界、时间线和风格；不要润色正文。”
- “接受 P-001 的第 1、3 项，第 2 项保留。”

当前所有故事档案为空，未替作者预设世界观、人物或剧情。Markdown 是事实载体；Git 是历史；编辑器 Agent 是执行器。
