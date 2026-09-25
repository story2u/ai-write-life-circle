# 资料契约

稳定 ID：CHAR-001 人物，THREAD-001 情节线，WORLD-001 世界规则，EVENT-001 事件，CH-001 章节，P-001 提案，REF-001 外部案例。ID 不复用，改名保持 ID。

每条正式资料：ID、status、更新时间、内容、证据 source、关联 IDs。
status：unknown / proposed / confirmed / deprecated。模板占位均 unknown。
source：仓库相对路径 + 章节/段落定位 + 必要短引文；提取记录额外保存章节 Git blob hash（可用 git hash-object），避免原文变化后旧提取继续生效。
作者直接指令：保留日期及与决策相关的作者原话，标明这是作者确认而非正文事实。

提案状态：proposed → partially-accepted / accepted / rejected / superseded。
每个提案条目独立标记状态。已接受条目不重复执行。引用旧版本的提案在正文变化后标为 stale，重新核对后才能接受。

正文、已确认设定、作者新指令互相矛盾时建立冲突记录；作者明确裁决后更新。历史被替代的条目保留来源与替代关系，不悄悄删除。

索引只存摘要、路径、状态与关联 ID，不复制整份资料。章节摘要是可重建投影，不是事实来源。风格基线必须来自作者认可的自身样本，不从单章或参考作家自动推导。
