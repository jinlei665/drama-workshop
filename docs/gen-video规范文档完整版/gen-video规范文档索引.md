# gen-video 规范文档索引

> 本索引包含视频生成技能的所有规范文档，按使用阶段分类组织

---

## 📚 核心规范文档（必读）

### 1. 工作流程类

| 文档名 | 核心用途 | 何时读取 |
|--------|---------|---------|
| `video-generation-workflow.md` | V1-V8 完整执行链路与状态调度 | 执行视频生成任务时 |
| `drama-script-workflow.md` | 剧本撰写 S1-S7 流程 | 执行剧本撰写任务时 |
| `tool-reference.md` | 所有 Python 脚本的参数速查 | V2-V5 阶段调用脚本时 |

### 2. 提示词撰写类

| 文档名 | 核心用途 | 何时读取 |
|--------|---------|---------|
| `prompt-writing-guide.md` | 生图提示词写作原则和公式模板 | V3 生成参考图时 |
| `shot-script-guide-core.md` | 分镜脚本编写核心引擎 | V5 写分镜时 |

### 3. 素材与资产类

| 文档名 | 核心用途 | 何时读取 |
|--------|---------|---------|
| `asset-extraction-guide.md` | 资产 ID 规划、生图、入库 | V3 阶段 |
| `bgm-guide.md` | BGM 配乐 style 描述写法 | 场景规则标注需要 BGM 时 |
| `voice-library.md` | 音色管线（描述 vs 预制） | V3 决定音色方案 / V5.5 TTS 注入 |

### 4. 特殊模式类

| 文档名 | 核心用途 | 何时读取 |
|--------|---------|---------|
| `firstframe-guide.md` | 首尾帧模式（平滑转场/一镜到底） | V5 判定为首尾帧模式时 |

---

## 🎬 场景规则文档（按题材选择）

| 文档名 | 触发关键词 | 核心策略 |
|--------|-----------|---------|
| `atmosphere_short.md` | 氛围、情绪、治愈、意境 | 沉浸式情绪叙事 (Show, Don't Tell) |
| `anime_short.md` | 动漫、动画、二次元、漫剧 | 稳定性优先，简化景别 |
| `trailer_preview.md` | 预告片、trailer、PV | 高密度分时序快切 + 多场景色系对比 |
| `digital_human_talking.md` | 数字人、口播、职场干货 | 高密度信息轰炸与信息可视化 |
| `knowledge_explanation.md` | 解说、科普、知识、教程 | 广播级标准叙事 |
| `ecommerce_marketing.md` | 电商、产品、营销、带货 | 产品质感展示与物理逻辑自洽 |
| `mv_music_video.md` | MV、音乐、卡点 | 音乐驱动的视觉节奏 |
| `video_montage.md` | 剪辑、混剪、踩点 | 多素材重组与节拍对齐 |

---

## 🎯 使用指南

### 新手入门顺序

```
1. video-generation-workflow.md → 理解完整流程
2. prompt-writing-guide.md → 掌握提示词写法
3. shot-script-guide-core.md → 学习分镜编写
4. tool-reference.md → 查阅脚本参数
```

### 按阶段查阅

| 阶段 | 必读文档 |
|------|---------|
| V1-V2 初始化 | video-generation-workflow.md |
| V3 资产提取 | asset-extraction-guide.md + prompt-writing-guide.md |
| V4 素材入库 | asset-extraction-guide.md |
| V5 写分镜 | shot-script-guide-core.md + 对应场景规则 |
| V5.5 TTS | voice-library.md |
| V6.5 BGM | bgm-guide.md |
| V7-V8 生成 | video-generation-workflow.md |

---

## 📌 重要提示

1. **场景规则选择**：根据用户需求关键词选择对应的场景规则文档，不是全部加载
2. **提示词规范强制遵循**：prompt-writing-guide.md 中的 6 条写作原则是硬性规则
3. **管线选择**：音色管线 A/B 由场景规则决定，不可自行选择
4. **工具调用**：所有 Python 脚本参数详见 tool-reference.md

---

**文档版本**：随 gen-video skill 更新
**最后同步**：2026-04-13
