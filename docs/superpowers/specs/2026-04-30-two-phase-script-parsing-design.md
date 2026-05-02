# 两阶段剧本解析 - 设计方案

日期: 2026-04-30
类型: Feature Enhancement
涉及: 剧本解析、分镜生成、提示词优化

---

## 问题诊断

### 当前架构

剧本解析存在两条路径：

| 路径 | 文件 | 方式 | 问题 |
|------|------|------|------|
| 直接 API | `src/app/api/scripts/analyze/route.ts` | 全量脚本一次发给LLM | 长剧本超出上下文，输出截断 |
| 工作流节点 | `src/lib/workflow/nodes.ts` | `content.slice(0, 10000)` 硬截断 | 后半内容完全丢失 |

### 五个具体问题

1. **分镜解析不完全**：全量一次发送，长剧本超过模型最大输出token，后半内容丢失
2. **人物没有特点**：角色描述只有 `description/appearance/personality/tags` 四个自由文本字段，缺乏结构化槽位（发型、五官、服装、体型等），导致生成的图像为"NPC脸"
3. **分镜时长不合理**：有时太短塞不满、有时太长装不下，没有针对 Seedance 1.5 Pro（单分镜≤12s）做约束
4. **无上下文传递**：分块之间互相独立，越往后模型越不遵循规则
5. **无预处理**：用户提交后不知道会生成什么，缺乏预期

---

## 设计方案

### 整体架构

```
用户提交剧本
     │
     ▼
┌─────────────────────────────┐
│  阶段一：全局扫描             │
│  POST /api/scripts/analyze   │
│  ?phase=1                    │
│                              │
│  输入: 完整剧本 + 风格         │
│  输出: 角色概要 + 场景大纲     │
│        预估分镜数 + 分块方案    │
└──────────┬──────────────────┘
           │
           ▼
  前端展示预览（角色×N，分镜×M）
  用户确认 / 调整 → 继续
           │
           ▼
┌─────────────────────────────┐
│  阶段二：分段详解             │
│  POST /api/scripts/analyze   │
│  ?phase=2                    │
│                              │
│  逐块处理（按场景边界分块）：   │
│  携带上下文 → LLM → 分镜JSON  │
│                              │
│  上下文:                     │
│  - 角色列表（完整信息）       │
│  - 当前场景信息               │
│  - 上一块分镜摘要             │
│  - Seedance ≤12s 约束        │
└──────────┬──────────────────┘
           │
           ▼
  合并所有分镜 → 保存数据库
```

### 新增文件结构

```
src/
├── lib/
│   └── script-parser/
│       ├── index.ts          # 导出两阶段解析器
│       ├── phase1-scanner.ts # 阶段一：全局扫描提示词构建与结果解析
│       ├── phase2-detail.ts  # 阶段二：分段详解提示词构建与结果解析
│       ├── chunker.ts        # 智能分块（按场景边界分割）
│       └── prompts.ts        # 统一的提示词模板
└── app/api/scripts/analyze/
    └── route.ts              # 重构：支持 phase=1|2 参数
```

### 模块详细设计

#### 1. chunker.ts — 智能分块

- 用正则识别场景边界标记：时间标记（"第二天"、"深夜"、"数日后"）、地点切换（"XX城"、"XX殿"）、空行/分隔符
- 按场景边界切分，每个 chunk 包含 1-N 个完整场景
- 如果单个场景 > 3000 字符，在段落边界处拆分
- 每个 chunk ≤ 6000 字符（为 prompt 上下文留余量）
- 阶段一的 chunkPlan 返回给前端，阶段二逐个处理

#### 2. prompts.ts — 优化后的提示词模板

**第一阶段 prompt**：
- 只要求输出"大纲级"信息（角色概要、场景列表、预估分镜数）
- 数据量小，不会截断
- 返回结构化 JSON

**第二阶段 prompt**：
- 携带完整角色列表（含结构化外貌）
- 携带当前场景、上一块分镜摘要、编号连续性
- 明确 Seedance ≤12s 约束
- 角色描述使用 9 槽位系统（参考 coze 角色三视图槽位）

#### 3. 阶段一 API 响应格式

```typescript
{
  phase: 1,
  preview: {
    scriptType: "古风玄幻",
    tone: "温馨治愈",
    estimatedTotalDurationSec: 180,
    estimatedScenes: 28,
    characters: [{
      name: "陈念",
      role: "主角",
      summary: "二十岁药师，温和内敛",
      appearanceBrief: "黑发束髻，白色中衣，清秀"
    }],
    sceneOutline: [{
      index: 1,
      location: "青溪镇-药铺",
      summary: "清晨醒来，检查药材",
      estimatedShots: 3
    }]
  },
  chunkPlan: [
    { chunkId: 1, sceneRange: [1, 3], charCount: 5200 },
    { chunkId: 2, sceneRange: [4, 6], charCount: 4800 }
  ]
}
```

#### 4. 阶段二 API 请求格式

```typescript
{
  phase: 2,
  scriptId: "xxx",
  projectId: "xxx",
  chunkId: 1,
  totalChunks: 10,
  chunkContent: "<当前块的原始文本>",
  context: {
    style: "realistic_cinema",
    characters: [ /* 阶段一的完整角色列表 */ ],
    currentSceneLocation: "青溪镇-药铺",
    currentSceneIndex: 1,
    previousSceneSummary: null,
    maxDurationPerShotSec: 12
  }
}
```

#### 5. 角色描述 9 槽位系统

```json
{
  "name": "陈念",
  "role": "主角",
  "appearance": {
    "bodyType": "男性，二十岁左右，修长身形",
    "face": "东方人面孔，脸型清秀，皮肤白皙，眉眼温和",
    "hair": "黑色长发束于脑后，额前有碎发",
    "clothing": "白色中衣，粗布质地，腰间系带，黑色布鞋",
    "accessories": "腰间挂一个小药囊",
    "demeanor": "气质内敛文雅，略带忧郁"
  },
  "personality": "温和善良，沉默寡言，内心坚韧",
  "tags": ["主角", "药师"]
}
```

#### 6. 分镜输出格式（阶段二）

```json
{
  "sceneNumber": 5,
  "title": "街头偶遇郑老爷子",
  "location": "青溪镇石板街头",
  "timeOfDay": "上午",
  "durationSec": 8,
  "description": "晨曦洒在青石板路上，陈念提着药箱缓步而行...",
  "dialogue": "郑老爷子：\"小念啊，又去采药？\"",
  "action": "陈念停下脚步，转身微笑点头",
  "emotion": "温暖日常",
  "characters": ["陈念", "郑老爷子"],
  "shotType": "中景",
  "cameraMovement": "跟拍→固定",
  "seedanceConstraints": {
    "maxDurationSec": 12,
    "actualDurationSec": 8,
    "fitNote": "对话简短，动作缓慢，适合8秒"
  }
}
```

### 改动范围

| 文件 | 改动类型 |
|------|----------|
| `src/lib/script-parser/index.ts` | 新增 |
| `src/lib/script-parser/phase1-scanner.ts` | 新增 |
| `src/lib/script-parser/phase2-detail.ts` | 新增 |
| `src/lib/script-parser/chunker.ts` | 新增 |
| `src/lib/script-parser/prompts.ts` | 新增 |
| `src/app/api/scripts/analyze/route.ts` | 重构 |

**不需要修改的文件**：
- `src/lib/ai/index.ts` — invokeLLM 保持不变
- `src/lib/workflow/nodes.ts` — 工作流节点保持不变（独立路径）
- `src/lib/db/index.ts` — 数据库服务保持不变
- `src/storage/` — 存储层保持不变
- 所有图像/视频生成 API — 保持不变

### 兼容性

- 同一次 API route，通过 `phase` 参数区分阶段，向后兼容
- 如果请求不带 `phase` 参数，走原有的单次全量解析逻辑（兼容旧调用方）
- Coze SDK 调用方式完全不变（`invokeLLM` 不变）

### 前端交互

1. 用户提交剧本 → 前端调用 `phase=1`
2. 展示预览卡片：角色×N、预计分镜×M、剧本类型/基调
3. 用户确认（可在此调整角色、删除不需要的角色）
4. 前端逐块调用 `phase=2`（或批量并发），显示进度条
5. 全部完成后，前端调用原有保存/展示逻辑

---

## 自检

- [x] 无 TBD/TODO/占位符
- [x] 角色 9 槽位与 coze 规范文档对齐（参考而非依赖）
- [x] Seedance ≤12s 约束内置于第二阶段
- [x] 第一阶段输出数据量可控（大纲级），不会截断
- [x] 分块按场景边界，避免切断对话
- [x] 与现有 invokeLLM/Coze SDK 完全兼容
- [x] 不修改数据库 schema
