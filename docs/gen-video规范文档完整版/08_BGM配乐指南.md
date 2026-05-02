# BGM 配乐指南

> **所属 Skill**: gen-video
> **核心用途**: 规范背景音乐（BGM）的选择与生成流程
> **何时读取**: V2.5（BGM 前置场景）或 V6.5（常规场景）阶段
> **前置确认**: 明确当前场景是否需要 BGM，以及 BGM 是否需要前置

---

## 🎵 一、BGM 使用决策树

### 何时需要 BGM？

| 总时长 | BGM 需求 | 原因 |
|-------|---------|------|
| **< 15s** | ❌ 跳过 | 太短，音乐未展开即结束 |
| **≥ 15s** | ✅ 必须 | 有足够的时长让音乐营造氛围 |

**⚠️ 注意**：scene-rule 标注"BGM 前置"时（如预告片、MV、卡点视频），无论时长都必须在 V2.5 阶段完成选曲/生曲。

### 何时前置 BGM？

| 场景类型 | scene-rule | BGM 处理时机 |
|---------|-----------|------------|
| 预告片/Trailer | trailer_preview | **V2.5 前置**（必须） |
| MV/音乐视频 | music_video | **V2.5 前置**（必须） |
| 卡点视频/混剪 | beat_sync | **V2.5 前置**（必须） |
| 氛围短片 | atmosphere_short | V6.5 常规 |
| 漫剧/短剧 | anime_short | V6.5 常规（或不加） |
| 数字人口播 | digital_human_talking | ❌ 不加 |
| 知识解说 | knowledge_explanation | ❌ 不加 |
| 电商营销 | ecommerce_marketing | V6.5 常规（推荐加） |

---

## 🎼 二、BGM 工具选择

| 工具 | 适用场景 | 优势 | 劣势 |
|------|---------|------|------|
| **select_music** | 通用场景，快速匹配 | 快速、现成曲目、质量稳定 | 风格选择受限于库 |
| **gen_music** | 精确情绪控制/特殊风格 | 高度定制、情绪精准 | 生成耗时、需调优 |

**推荐策略**：
- 优先尝试 `select_music`（快速高效）
- 如果音乐库无匹配结果，或需要特殊风格，再使用 `gen_music`

---

## 📝 三、gen_music 风格描述公式

### 公式模板

```
[BPM（可选）] + [情绪基调] + [风格类型] + [核心乐器] + [空间感/质感]
```

### 各要素说明

| 要素 | 说明 | 示例 |
|-----|------|------|
| **BPM** | 节奏速度（可选） | 60BPM（缓慢）、120BPM（中等）、160BPM（快节奏） |
| **情绪基调** | 核心情绪关键词 | 悲伤、欢快、紧张、治愈、史诗、浪漫 |
| **风格类型** | 音乐流派 | 流行、电子、古典、民谣、摇滚、爵士 |
| **核心乐器** | 主要音色 | 钢琴、吉他、弦乐、合成器、古筝、鼓 |
| **空间感/质感** | 听觉氛围 | 空旷宏大、温暖朦胧、干净清新、厚重有力 |

### 示例库

**电商广告**：
```
轻快明亮的流行纯音乐，节奏活泼，吉他+手拍鼓，干净清新
```

**仙侠预告片**：
```
120BPM，史诗恢弘的东方管弦纯音乐，古筝琶音+弦乐群渐强+战鼓，空间宏大深远
```

**氛围治愈**：
```
缓慢的环境氛围纯音乐，合成器pad+钢琴碎音+雨声采样，温暖朦胧
```

**悬疑紧张**：
```
90BPM，紧张悬疑的电子配乐，低频脉冲+金属音效+弦乐颤音，空间压抑幽闭
```

**浪漫爱情**：
```
70BPM，浪漫温柔的钢琴独奏，旋律舒缓优美，带有细腻的延音踏板效果
```

---

## 🎹 四、结构标签（高级用法）

gen_music 支持 `lyrics` 参数中嵌入结构标签，控制音乐段落：

| 标签 | 用途 | 示例 |
|-----|------|------|
| `[Intro]` | 开场引入 | `[Intro] 钢琴单音引入` |
| `[Build Up]` | 情绪递进 | `[Build Up] 弦乐加入，节奏加快` |
| `[Chorus]` | 高潮段落 | `[Chorus] 全乐队爆发，旋律激昂` |
| `[Bridge]` | 过渡衔接 | `[Bridge] 节奏放缓，木吉他独奏` |
| `[Outro]` | 收束结尾 | `[Outro] 乐器渐弱，回归宁静` |

**示例（完整结构）**：
```
[Intro] 钢琴单音引入，带有回声效果
[Build Up] 弦乐群加入，节奏逐渐加快
[Chorus] 全乐队爆发，古筝+弦乐+战鼓，旋律激昂
[Bridge] 节奏放缓，木吉他独奏过渡
[Outro] 乐器渐弱，回归钢琴单音，余音袅袅
```

**注意**：纯音乐（`is_instrumental=true`）也可以使用结构标签，写在 `lyrics` 参数中。

---

## 💾 五、写入 bgm_list

### 5.1 select_music 用法

**标准调用**：
```python
select_music(
    music_requirements="轻快明亮的纯音乐",
    video_script_file="梦核_视频脚本.cvs",
    count=3  # 可选，返回 3 首供选择
)
```

**自动写入**：
- 工具会自动将选中的音乐写入 `.cvs` 文件的 `bgm_list` 字段
- 同时生成 `project_tracks` 中的 BGM 轨道元素
- 无需手动操作 JSON

**输出示例**（写入 .cvs 后）：
```json
{
  "bgm_list": [
    {
      "name": "春日暖阳",
      "url": "https://s.coze.cn/audio/xxx/",
      "duration_ms": 180000,
      "extra": {
        "beat_info": {
          "bpm": 128,
          "time_signature": "4/4"
        }
      }
    }
  ]
}
```

### 5.2 gen_music 用法

**标准调用**：
```python
gen_music(
    style="史诗恢弘的东方管弦纯音乐，古筝琶音+弦乐群渐强+战鼓，空间宏大深远",
    music_name="BGM_预告片",
    is_instrumental=True,  # 纯音乐
    lyrics="[Intro] 古筝单音引入\n[Build Up] 弦乐加入\n[Chorus] 全乐队爆发",
    video_script_file="梦核_视频脚本.cvs"
)
```

**自动写入**：与 `select_music` 相同，自动写入 `bgm_list` 和 `project_tracks`。

---

## 🎚️ 六、BGM 前置场景特殊处理（V2.5）

**触发条件**：scene-rule 标注"BGM 前置"（如预告片、MV、卡点视频）。

**执行时机**：V2 风格确认后，直接进入 V2.5，跳过 V3-V6。

**标准流程**：

### Step 1：选曲或生曲

```python
# 方式1：从音乐库选择
select_music(
    music_requirements="120BPM，史诗恢弘的东方管弦",
    video_script_file="预告片_视频脚本.cvs"
)

# 方式2：生成定制音乐
gen_music(
    style="120BPM，史诗恢弘的东方管弦纯音乐，古筝+弦乐+战鼓",
    music_name="BGM_预告片",
    is_instrumental=True,
    video_script_file="预告片_视频脚本.cvs"
)
```

### Step 2：节拍分析

**目的**：生成 `beat_map.json`，供 V5 写分镜时参考节拍。

**两种模式**：

**模式1：快速版（select_music 已知 BPM）**
```bash
python gen-video/scripts/analyze_bgm.py --bpm 128 --duration-ms 180000
```

**模式2：完整版（gen_music 生成的音频）**
```bash
python gen-video/scripts/analyze_bgm.py --audio-url "https://s.coze.cn/audio/xxx/"
```

**输出示例**（beat_map.json）：
```json
{
  "bpm": 128,
  "duration_ms": 180000,
  "beats": [
    { "time_ms": 0, "beat_index": 1 },
    { "time_ms": 469, "beat_index": 2 },
    ...
  ],
  "sections": [
    {
      "start_ms": 0,
      "end_ms": 15000,
      "energy": "low",
      "label": "Intro"
    },
    {
      "start_ms": 15000,
      "end_ms": 60000,
      "energy": "medium",
      "label": "Build Up"
    },
    ...
  ],
  "recommended_shot_cuts": [0, 4000, 8000, 15000, 23000, ...]
}
```

### Step 3：写入 bgm_list

`select_music` 和 `gen_music` 已自动完成，无需手动操作。

### Step 4：继续 V3

BGM 前置完成后，继续执行 V3 资产入库流程。

---

## 📋 七、BGM 使用检查清单

| # | 检查项 |
|---|--------|
| 1 | 总时长 ≥ 15s 或 scene-rule 标注"BGM 前置" |
| 2 | BGM 风格与视频情绪基调匹配 |
| 3 | BGM 前置场景已完成 V2.5 节拍分析 |
| 4 | bgm_list 已写入（自动或手动确认） |
| 5 | project_tracks 中有 BGM 轨道元素 |

---

## ⛔ 常见错误与规避

### 错误1：短于 15s 的视频强加 BGM

❌ **错误做法**：
- 10s 的氛围短片，强制添加 BGM
- 原因：音乐未展开即结束，听感突兀

✅ **正确做法**：
- 总时长 < 15s，跳过 BGM
- 依赖环境音和画面节奏营造氛围

---

### 错误2：BGM 前置场景未做节拍分析

❌ **错误做法**：
- 预告片场景，V2.5 选曲后直接进 V3
- 原因：V5 写分镜时没有节拍参考，画面与音乐脱节

✅ **正确做法**：
- V2.5 完整执行：选曲 → 节拍分析 → 写入 bgm_list
- V5 写分镜时读取 `beat_map.json`，按节拍切分 shot

---

### 错误3：gen_music 未指定 is_instrumental

❌ **错误做法**：
```python
gen_music(style="史诗管弦", music_name="BGM")
# 未指定 is_instrumental，默认带人声
```

✅ **正确做法**：
```python
gen_music(
    style="史诗管弦",
    music_name="BGM",
    is_instrumental=True  # 明确指定纯音乐
)
```

---

### 错误4：手动构造 bgm_list JSON

❌ **错误做法**：
- 用 Python 代码手动构造 `bgm_list` 字段
- 原因：容易写错字段名、缺少必要字段

✅ **正确做法**：
- 使用 `select_music` 或 `gen_music` 自动写入
- 工具内部已处理字段映射和轨道生成
