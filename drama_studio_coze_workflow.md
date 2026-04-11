# Drama Studio 扣子工作流快速指南

## 一、项目管理

### 创建项目
**输入**: title(标题), description(描述), style(风格)
**输出**: projectId

### 查看项目列表
**输入**: 无
**输出**: projects[]

---

## 二、脚本与分镜

### 脚本分析生成分镜
**输入**: scriptId, projectId, scriptContent, existingCharacters
**输出**: charactersCount, scenesCount

**分镜分析规则**:
- 内容决定数量：氛围浓厚的内容可达25-40个以上分镜
- 时长灵活：空镜5-8秒，情感特写可延长至12秒
- 环境描写独立成镜
- 心理回忆独立呈现
- 每个叙事相遇为独立单元（2-4个分镜）

---

## 三、分镜操作

### 创建分镜
**输入**: projectId, sceneNumber, title, description, dialogue, action, emotion, characterIds, shotType, cameraMovement
**输出**: sceneId

### 查看分镜列表
**输入**: projectId
**输出**: scenes[]

### 编辑/删除分镜
**输入**: projectId, sceneId, 更新字段
**输出**: success

---

## 四、图片生成

### 场景图片生成
**输入**: projectId, sceneId, prompt, style, aspectRatio
**输出**: imageUrl

### 批量生成分镜图片
**输入**: projectId, sceneIds[], style, aspectRatio
**输出**: results[]

### 角色正面视图
**输入**: projectId, characterId, appearance, style, gender, age
**输出**: imageUrl, frontViewKey

---

## 五、视频生成

### 生成分镜视频
**输入**: projectId, sceneIds[], firstFrame(布尔), lastFrameSceneId, duration, aspectRatio
**输出**: videoUrl

**参数说明**:
- firstFrame=true: 使用分镜图片作首帧
- firstFrame=false: 使用首帧+尾帧图片
- duration: 4-12秒（默认6秒）
- aspectRatio: 16:9 或 9:16

---

## 六、角色管理

### 创建角色
**输入**: projectId, name, appearance, imageUrl
**输出**: characterId

### 查看角色列表
**输入**: projectId
**输出**: characters[]

### 形象生成
**输入**: projectId, characterId, prompt, style
**输出**: appearanceId, imageUrl

---

## 七、人物库

### 获取人物库
**输入**: search(搜索), page, pageSize
**输出**: characters[], total

### 添加到人物库
**输入**: name, description, appearance, personality, tags[], imageUrl, style
**输出**: id

### 生成三视图
**输入**: characterId, imageUrl(参考图)
**输出**: front, side, back

### 导入到项目
**输入**: libraryId, projectId
**输出**: characterId

---

## 八、AI独立生成

### 文生图
**输入**: prompt, negativePrompt, style, aspectRatio, optimizePrompt
**输出**: imageUrl

### 图生图
**输入**: imageUrl, prompt, style, strength, optimizePrompt
**输出**: imageUrl

### 文生视频
**输入**: prompt, duration, aspectRatio, generateAudio, optimizePrompt
**输出**: videoUrl, audioUrl

### 图生视频
**输入**: imageUrl, prompt, firstFrame, lastFrameImageUrl, duration, optimizePrompt
**输出**: videoUrl

---

## 九、视频处理

### 合并视频
**输入**: videoUrls[], aspectRatio
**输出**: videoUrl

---

## 十、风格选项

### 图像风格
- realistic: 写实
- anime: 动漫
- cartoon: 卡通
- oil_painting: 油画

### 项目风格
- cinematic: 电影级写实
- ink_wash: 水墨国风
- anime_vibe: 动漫质感
- oil_classic: 油画质感
- modern_flat: 现代扁平
- vintage: 复古胶片
- noir: 黑白电影
- warm_tone: 暖色调

---

## 工作流节点

| 节点类型 | 输入 | 输出 | 说明 |
|---------|------|------|------|
| text-input | - | text | 文本输入 |
| image-input | - | image | 图片输入 |
| script-input | - | script | 脚本输入 |
| text-to-image | prompt | image | 文生图 |
| image-to-video | prompt, firstFrame, lastFrame | video | 图生视频 |
| text-to-audio | text | audio | 语音生成 |
| text-to-character | description | character, image | 角色生成 |
| script-to-scenes | script | scenes | 脚本分析 |
| llm-process | input | output | LLM处理 |
| video-compose | videos[] | video | 视频合成 |

---

## 常用流程

### 流程1: 脚本 → 分镜 → 图片 → 视频
```
脚本输入 → AI分析 → 角色生成(循环) → 分镜图片生成(循环) → 视频生成(循环) → 视频合成
```

### 流程2: 快速视频生成
```
文本描述 → 优化提示词 → 文生图 → 图生视频
```

### 流程3: 参考图转视频
```
参考图片 → 描述优化 → 图生视频
```
