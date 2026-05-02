# Drama Studio 企业化实施完整方案

> 版本：v1.0 | 日期：2026-04-09 | 状态：草案

---

## 目录

1. [项目现状诊断](#一项目现状诊断)
2. [核心功能方案](#二核心功能方案)
   - 2.1 [Token 分配调度](#21-视频模型-token-分配调度系统)
   - 2.2 [IP 安全监控](#22-内测账号-ip-监控与安全系统)
   - 2.3 [统一 Token 定价](#23-闭源模型统一-token-定价体系)
3. [企业化完整功能矩阵](#三企业化完整功能矩阵)
4. [技术架构升级](#四技术架构升级方案)
5. [数据库设计](#五数据库设计)
6. [实施路线图](#六实施路线图)
7. [关键风险与应对](#七关键风险与应对)
8. [附录：参考代码模式](#八附录参考代码模式)

---

## 一、项目现状诊断

### 1.1 当前架构评估

| 维度 | 现状 | 企业化差距 |
|------|------|-----------|
| 用户体系 | 无认证，单用户 | 缺少多用户、权限、租户 |
| 计费系统 | 无 | 无 Token 计量、无账单 |
| 账号安全 | 无监控 | 无 IP 追踪、无异常检测 |
| 模型调度 | 硬编码优先级策略 | 无智能调度、无配额管理 |
| 审计日志 | console.log | 无结构化日志、无追溯 |
| API 网关 | Next.js API Routes 直连 | 无鉴权、无限流按用户 |
| 运维监控 | 无 | 无仪表盘、无告警 |

### 1.2 现有技术栈（需保留和增强）

| 层级 | 技术 | 版本 | 企业化改造方向 |
|------|------|------|--------------|
| 框架 | Next.js (App Router) | 16.1.1 | 增加 Middleware 网关层 |
| 核心 | React | 19.2.3 | 保持 |
| 数据库 | Supabase (PostgreSQL) | - | 新增企业化表 |
| AI SDK | coze-coding-dev-sdk | 0.7.17 | 上层封装计量层 |
| 缓存 | 无 | - | 新增 Redis |

### 1.3 核心 AI 服务现状（改造重点）

当前 AI 服务层（`src/lib/ai/index.ts`）已有的策略回退机制企业化后需保留并增强：

- **图像生成** `generateImage()`：4 种策略回退
- **视频生成** `generateVideoFromImage()`：4 种策略回退
- **文生视频** `generateVideo()`：3 种策略回退
- **LLM 调用** `invokeLLM()`：2 种 Provider + 系统回退

企业化改造的关键是在 AI 服务层之上增加 **认证 → 配额检查 → 计量扣费** 三层拦截，**而不是重写现有逻辑**。

---

## 二、核心功能方案

### 2.1 视频模型 Token 分配调度系统

#### 2.1.1 问题本质

闭源模型（Seedance 2.0、Seedream 4.0 等）按不同维度计费，需要精确计量、智能分配、防止浪费。

| 模型 | 原始计费单位 | 说明 |
|------|------------|------|
| Seedance 2.0 | 按视频秒数 | 视频生成 |
| Seedance 1.5 Pro | 按视频秒数 | 视频生成 |
| Seedream 4.0 | 按张/分辨率 | 图像生成 |
| Doubao TTS | 按字符数 | 语音合成 |
| Doubao LLM | 按 Token 数 | LLM 调用 |

#### 2.1.2 架构设计

```
┌─────────────────────────────────────────────────┐
│                  调度引擎层                       │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐│
│  │ 配额管理器  │  │ 调度策略器 │  │ 优先级队列   ││
│  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘│
│        └──────────────┼────────────────┘        │
│                       ▼                         │
│  ┌───────────────────────────────────────────┐  │
│  │              Token 计量引擎                 │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ 消耗计量  │  │ 预算控制  │  │实时余额检查│  │  │
│  │  └─────────┘  └──────────┘  └──────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                       ▼                         │
│  ┌───────────────────────────────────────────┐  │
│  │             模型路由层                      │  │
│  │  Seedance 2.0 │ Seedream 4.0 │ Doubao TTS │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### 2.1.3 调度策略定义

```typescript
enum SchedulingStrategy {
  PRIORITY_BASED = 'priority',        // 按用户等级优先
  FAIR_SHARE = 'fair_share',          // 公平共享
  COST_OPTIMIZED = 'cost_optimized',  // 成本优先（选便宜模型）
  PERFORMANCE = 'performance',        // 性能优先（选最好模型）
}
```

#### 2.1.4 用户等级与配额

```typescript
interface UserQuota {
  userId: string
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
  dailyTokenLimit: number
  monthlyTokenLimit: number
  usedTokens: number
  reservedTokens: number       // 预留 Token（进行中的任务）
  priorityWeight: number       // 调度权重 (1-100)
}

const TIER_QUOTAS = {
  free:       { daily: 500,    monthly: 10000,    priority: 10 },
  basic:      { daily: 2000,   monthly: 50000,    priority: 30 },
  pro:        { daily: 10000,  monthly: 300000,   priority: 60 },
  enterprise: { daily: 100000, monthly: 3000000,  priority: 90 },
}
```

#### 2.1.5 请求调度流程

```
用户请求 → 鉴权 → 检查余额 → 排入优先级队列 → 调度器分配模型 → 执行 → 扣减 Token → 记录日志
                                    ↓
                             余额不足 → 返回配额超限错误
                             队列满   → 返回系统繁忙，建议升级
```

### 2.2 内测账号 IP 监控与安全系统

#### 2.2.1 架构设计

```
┌──────────────────────────────────────────────────┐
│                   安全监控层                       │
│                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ IP 采集器    │  │ 异常检测引擎  │  │ 处置引擎 │ │
│  │(Middleware) │→ │ (规则+AI)    │→ │(封禁等)  │ │
│  └─────────────┘  └──────────────┘  └──────────┘ │
│         │                │                │       │
│         ▼                ▼                ▼       │
│  ┌─────────────────────────────────────────────┐  │
│  │             安全事件数据库                    │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

#### 2.2.2 IP 访问日志记录结构

```typescript
interface IPAccessLog {
  id: string
  userId: string
  apiKeyId: string           // 使用的 API Key ID
  ip: string                 // 请求 IP
  ipFingerprint: string      // IP 指纹（含地理位置、ISP）
  userAgent: string
  endpoint: string           // 请求的 API 端点
  modelUsed: string          // 使用的模型
  tokenConsumed: number      // 消耗的 Token
  requestTime: number        // 请求耗时 ms
  createdAt: Date
}
```

#### 2.2.3 异常检测规则

| 规则 | 检测逻辑 | 触发动作 | 严重级别 |
|------|---------|---------|---------|
| **多 IP 检测** | 5分钟内超过2个不同IP | 锁定账号 | high |
| **地理位置异常** | 同时从不同城市请求 | 锁定账号 | critical |
| **频率异常** | 每分钟超过30次请求 | 限流→锁定 | medium |
| **设备指纹异常** | 多个不同设备同时使用 | 锁定账号 | high |

#### 2.2.4 封禁与工单流程

```
异常检测触发 → 自动锁定账号 → 通知用户（邮件/站内信）
                                    ↓
                            用户提交工单申诉
                                    ↓
                            管理员审核工单
                           ┌────────┴────────┐
                        解封              拒绝
                    (补偿 Token)     (永久封禁或限期封禁)
```

### 2.3 闭源模型统一 Token 定价体系

#### 2.3.1 核心思路

将所有闭源模型的不同计费方式，统一换算为 **平台标准 Token**，用户只需购买平台 Token，系统内部自动换算。

```
平台 Token = 基准货币单位
1 平台 Token ≈ ¥0.01（可根据运营策略调整）

定价公式：
模型单价(平台Token) = 模型实际成本(¥) / 0.01 × 成本加成系数

成本加成系数表：
- 免费用户：3.0x（3倍加成，鼓励升级）
- 基础用户：2.0x
- 专业用户：1.5x
- 企业用户：1.2x（量大优惠）
```

#### 2.3.2 统一 Token 换算表

| 模型 | 计费单位 | 原始成本(¥) | 平台 Token (免费) | 平台 Token (专业) |
|------|---------|-----------|-----------------|-----------------|
| Seedance 2.0 | 1秒视频 | ¥0.50 | 150 Token | 75 Token |
| Seedance 1.5 Pro | 1秒视频 | ¥0.30 | 90 Token | 45 Token |
| Seedream 4.0 | 1张2K | ¥0.25 | 75 Token | 38 Token |
| Seedream 4.0 4K | 1张4K | ¥0.50 | 150 Token | 75 Token |
| Doubao TTS | 1千字 | ¥0.10 | 30 Token | 15 Token |
| Doubao LLM | 1K Token | ¥0.025 | 8 Token | 4 Token |

#### 2.3.3 动态定价引擎接口

```typescript
interface PricingEngine {
  // 计算请求成本
  calculateCost(params: {
    model: string
    serviceType: 'image' | 'video' | 'llm' | 'tts'
    quantity: number    // 秒数/张数/千Token/千字
    userTier: string
  }): {
    platformTokens: number
    estimatedCostCNY: number
    breakdown: CostBreakdown
  }

  // 检查用户余额是否足够
  checkBalance(
    userId: string,
    requiredTokens: number
  ): Promise<{ sufficient: boolean; currentBalance: number; deficit: number }>

  // 执行扣费
  deductTokens(userId: string, amount: number, taskId: string): Promise<void>

  // 退款（任务失败时）
  refundTokens(
    userId: string,
    amount: number,
    taskId: string,
    reason: string
  ): Promise<void>
}
```

---

## 三、企业化完整功能矩阵

### 3.1 优先级定义

| 优先级 | 含义 | 时间窗口 |
|--------|------|---------|
| **P0** | 核心必须，无此功能无法上线 | Phase 1 |
| **P1** | 重要功能，MVP 后立即跟进 | Phase 2 |
| **P2** | 增值功能，运营稳定后迭代 | Phase 3 |

### 3.2 A. 用户与认证体系

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 用户注册/登录 | **P0** | 邮箱+手机号，支持 OAuth（微信/Google） |
| 多租户（组织） | P1 | 企业用户可创建组织，邀请成员 |
| RBAC 权限 | P1 | 管理员/编辑者/查看者 |
| API Key 管理 | **P0** | 每个用户可创建多个 API Key，支持权限范围限制 |
| SSO 集成 | P2 | 企业 SAML/OIDC 单点登录 |

### 3.3 B. 计费与配额

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Token 钱包 | **P0** | 充值、消费、退款、过期 |
| 套餐系统 | **P0** | 免费/基础/专业/企业 |
| 用量仪表盘 | **P0** | 实时 Token 消耗、趋势图 |
| 账单系统 | P1 | 月度账单、导出 PDF |
| 充值/支付 | **P0** | 微信支付/支付宝/对公转账 |
| 配额告警 | P1 | 余额低于阈值自动通知 |

### 3.4 C. 安全与合规

| 功能 | 优先级 | 说明 |
|------|--------|------|
| IP 监控 | **P0** | 多 IP 检测、地理位置检测 |
| 账号封禁 | **P0** | 自动+手动封禁 |
| 工单系统 | **P0** | 申诉、审核流程 |
| 内容审核 | P1 | AI 生成内容合规检查 |
| 操作审计日志 | P1 | 所有敏感操作记录 |
| 数据加密 | P1 | API Key 加密存储、传输加密 |
| GDPR/隐私 | P2 | 数据导出、删除 |

### 3.5 D. 运维与监控

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 管理后台 | **P0** | 用户管理、配额管理、封禁管理 |
| 实时监控 | **P0** | Token 消耗速率、活跃用户、模型调用量 |
| 告警系统 | P1 | 异常消耗、服务异常、配额告警 |
| 健康检查 | P1 | 各模型 API 可用性监控 |
| SLA 管理 | P2 | 服务等级协议 |

### 3.6 E. 模型与调度

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 模型路由 | **P0** | 根据用户等级路由到不同模型 |
| 智能调度 | P1 | 负载均衡、成本优化 |
| 模型降级 | **P0** | 主模型不可用时自动降级 |
| 批量任务队列 | P1 | 排队、优先级、超时处理 |
| 模型 A/B 测试 | P2 | 新模型灰度发布 |

### 3.7 F. 通知与运营

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 站内通知 | P1 | 配额告警、封禁通知 |
| 邮件通知 | P1 | 注册、账单、安全事件 |
| 运营活动 | P2 | 优惠券、邀请奖励、限时折扣 |

---

## 四、技术架构升级方案

### 4.1 整体架构演进

```
当前架构（单机版）:
用户 → Next.js API Routes → AI SDK → 模型 API

企业化架构:
用户 → API 网关(Middleware) → [鉴权/限流/计量] → Next.js API Routes → 调度引擎 → AI SDK → 模型 API
                ↓                                              ↑
          [IP监控/安全]                                  [配额检查/扣费]
                ↓                                              ↑
          [审计日志]                                    [Token 计量]
```

### 4.2 中间件链设计

```typescript
// 企业化中间件链（在 next.config.mjs 或 middleware.ts 中配置）
const enterpriseMiddleware = [
  authMiddleware,            // 1. 认证：验证 JWT / API Key
  ipCollectorMiddleware,     // 2. IP 采集：记录访问 IP 和地理位置
  securityCheckMiddleware,   // 3. 安全检查：IP 异常检测
  quotaCheckMiddleware,      // 4. 配额检查：余额是否足够
  rateLimitMiddleware,       // 5. 限流：按用户等级限流
  auditLogMiddleware,        // 6. 审计日志：记录操作
  metricsMiddleware,         // 7. 指标采集：响应时间、成功率
]
```

### 4.3 关键技术选型

| 组件 | 推荐方案 | 理由 |
|------|---------|------|
| API 网关层 | Next.js Middleware | 项目已用 Next.js，零额外部署成本 |
| 消息队列 | Redis + BullMQ | 任务调度、异步处理 |
| 实时监控 | WebSocket + Redis Pub/Sub | IP 监控实时推送 |
| 计量引擎 | PostgreSQL + Redis 缓存 | 精确计量 + 快速查询 |
| 定时任务 | node-cron / BullMQ repeatable | 配额重置、过期清理 |
| IP 地理位置 | MaxMind GeoIP2 | 离线数据库，快速准确 |
| 支付集成 | 微信支付 + 支付宝 SDK | 国内主流支付 |

### 4.4 AI 服务层升级（不改现有逻辑，增加包装层）

```typescript
// 现有 generateImage() 保持不变，增加企业化包装层

class EnterpriseAIService {
  private aiService = new AIService()  // 现有的 src/lib/ai/index.ts

  async generateImageWithBilling(
    userId: string,
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<{ urls: string[]; tokenCost: number }> {
    // 1. 计算预估成本
    const cost = pricingEngine.calculateCost({
      model: 'seedream-4.0',
      serviceType: 'image',
      quantity: 1,
      userTier: await userService.getTier(userId),
    })

    // 2. 检查余额
    const balance = await tokenService.checkBalance(userId, cost.platformTokens)
    if (!balance.sufficient) {
      throw new InsufficientBalanceError(balance.deficit)
    }

    // 3. 预扣 Token
    const deduction = await tokenService.deductTokens(
      userId, cost.platformTokens, 'pre_deduct'
    )

    try {
      // 4. 调用现有生成逻辑
      const result = await this.aiService.generateImage(prompt, options)

      // 5. 确认扣费（从预扣转为正式）
      await tokenService.confirmDeduction(deduction.id)

      return { ...result, tokenCost: cost.platformTokens }
    } catch (error) {
      // 6. 失败退款
      await tokenService.refundTokens(userId, cost.platformTokens, deduction.id)
      throw error
    }
  }
}
```

---

## 五、数据库设计

### 5.1 核心新增表

```sql
-- ============================================
-- A. 用户与认证
-- ============================================

-- 用户表（扩展现有）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  tier VARCHAR(20) DEFAULT 'free' NOT NULL,   -- free | basic | pro | enterprise
  status VARCHAR(20) DEFAULT 'active',         -- active | locked | disabled
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Key 表
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  key_ prefix VARCHAR(10) NOT NULL,   -- 'drama_' 前缀
  key_hash TEXT NOT NULL,              -- 哈希存储，不可逆
  key_last_four VARCHAR(4) NOT NULL,  -- 显示用 "sk-xxxx-****-1234"
  name VARCHAR(100) DEFAULT 'Default',
  scopes JSONB DEFAULT '["all"]',     -- 权限范围
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- B. Token 计量与计费
-- ============================================

-- Token 账户表
CREATE TABLE token_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  balance BIGINT NOT NULL DEFAULT 0,          -- 当前余额（单位：平台 Token）
  total_granted BIGINT NOT NULL DEFAULT 0,    -- 累计充值/赠送
  total_consumed BIGINT NOT NULL DEFAULT 0,   -- 累计消耗
  total_expired BIGINT NOT NULL DEFAULT 0,    -- 累计过期
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token 交易记录表
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL,     -- 'grant' | 'consume' | 'expire' | 'refund' | 'pre_deduct'
  amount BIGINT NOT NULL,        -- 正数充值/退款，负数消耗
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  model VARCHAR(50),             -- 消耗的模型（消耗类交易）
  service_type VARCHAR(20),      -- 'image' | 'video' | 'llm' | 'tts'
  task_id UUID,                  -- 关联的任务 ID
  description TEXT,
  metadata JSONB,                -- 额外信息（分辨率、时长等）
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 索引：加速用户交易查询
CREATE INDEX idx_token_tx_user_id ON token_transactions(user_id, created_at DESC);

-- 模型 Token 换算表
CREATE TABLE model_token_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model VARCHAR(50) NOT NULL,
  service_type VARCHAR(20) NOT NULL,  -- 'image' | 'video' | 'llm' | 'tts'
  unit VARCHAR(50) NOT NULL,          -- 'per_second' | 'per_image' | 'per_1k_tokens'
  token_cost INTEGER NOT NULL,        -- 每单位消耗的平台 Token
  currency_cost DECIMAL(10,4),        -- 对应的人民币成本
  markup_tiers JSONB,                 -- 各等级的加成系数 {free:3.0, basic:2.0, pro:1.5, enterprise:1.2}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 套餐定义表
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,         -- 'Free' | 'Basic' | 'Pro' | 'Enterprise'
  tier VARCHAR(20) NOT NULL,         -- 'free' | 'basic' | 'pro' | 'enterprise'
  monthly_token_quota BIGINT NOT NULL,
  price_monthly DECIMAL(10,2),       -- 月付价格（元）
  price_yearly DECIMAL(10,2),        -- 年付价格（元）
  features JSONB,                    -- 功能列表
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- C. 安全与监控
-- ============================================

-- IP 访问日志表（按月分区）
CREATE TABLE ip_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  api_key_id UUID REFERENCES api_keys(id),
  ip_address INET NOT NULL,
  ip_country VARCHAR(10),
  ip_region VARCHAR(50),
  ip_city VARCHAR(50),
  ip_isp VARCHAR(100),
  user_agent TEXT,
  endpoint VARCHAR(200),
  model_used VARCHAR(50),
  token_consumed INTEGER,
  request_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 索引
CREATE INDEX idx_ip_log_user_time ON ip_access_logs(user_id, created_at DESC);
CREATE INDEX idx_ip_log_ip ON ip_access_logs(ip_address);

-- IP 异常事件表
CREATE TABLE ip_anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,   -- 'multi_ip' | 'geo_anomaly' | 'frequency' | 'device'
  severity VARCHAR(20) DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'critical'
  detail JSONB NOT NULL,             -- 事件详情（涉及IP列表、时间窗口等）
  detected_ips TEXT[],               -- 涉及的 IP 列表
  auto_action VARCHAR(20),           -- 'lock' | 'throttle' | 'warn'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 账号封禁表
CREATE TABLE account_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  lock_type VARCHAR(20) NOT NULL,    -- 'auto' | 'manual'
  reason TEXT NOT NULL,
  related_event_id UUID REFERENCES ip_anomaly_events(id),
  status VARCHAR(20) DEFAULT 'locked',   -- 'locked' | 'unlocked'
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  unlocked_at TIMESTAMPTZ,
  unlocked_by UUID REFERENCES users(id)  -- 解封的管理员
);

-- 工单表
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL,         -- 'unlock_appeal' | 'quota_increase' | 'bug_report'
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open',   -- 'open' | 'in_progress' | 'resolved' | 'closed'
  priority VARCHAR(10) DEFAULT 'normal',
  related_lock_id UUID REFERENCES account_locks(id),
  assigned_to UUID REFERENCES users(id),  -- 处理人
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工单回复表
CREATE TABLE ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- D. 任务与调度
-- ============================================

-- 调度队列表
CREATE TABLE schedule_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  task_type VARCHAR(20) NOT NULL,      -- 'text_to_image' | 'image_to_video' | 'llm' | 'tts'
  model VARCHAR(50),                   -- 请求的模型
  priority INTEGER DEFAULT 0,          -- 0=低 1=普通 2=高 3=紧急
  status VARCHAR(20) DEFAULT 'queued', -- 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  estimated_tokens INTEGER,            -- 预估消耗 Token
  actual_tokens INTEGER,               -- 实际消耗 Token
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
-- 索引
CREATE INDEX idx_schedule_status ON schedule_queue(status, priority DESC, created_at ASC);

-- ============================================
-- E. 审计日志
-- ============================================

-- 操作审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,       -- 'user.login' | 'api_key.create' | 'quota.change'
  resource_type VARCHAR(50),         -- 'user' | 'api_key' | 'token' | 'ticket'
  resource_id VARCHAR(100),
  detail JSONB,                      -- 操作详情
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

### 5.2 数据量预估

| 表名 | 日增量预估（1000用户） | 月增量 | 保留策略 |
|------|---------------------|--------|---------|
| token_transactions | 5000-10000 条 | 15-30 万 | 永久保留 |
| ip_access_logs | 50000-100000 条 | 150-300 万 | 按月分区，保留6个月 |
| ip_anomaly_events | 10-50 条 | 300-1500 | 保留1年 |
| audit_logs | 1000-5000 条 | 3-15 万 | 保留1年 |
| schedule_queue | 5000-10000 条 | 15-30 万 | 保留3个月 |

---

## 六、实施路线图

### Phase 1：基础企业化（4-6周）

```
Week 1-2: 用户认证体系
  - 用户注册/登录（邮箱+手机号）
  - JWT Token 认证
  - API Key 生成和管理
  - 创建 users、api_keys 表

Week 3-4: Token 计量与配额
  - 创建 Token 账户表和交易表
  - 模型 Token 换算表初始化
  - 请求前余额检查中间件
  - 请求后自动扣费逻辑
  - 基础套餐定义（free/basic/pro/enterprise）

Week 5-6: IP 监控与安全
  - IP 采集中间件
  - 多 IP 检测规则实现
  - 自动封禁机制
  - 基础工单系统（申诉/审核）
  - 创建 ip_access_logs、account_locks、support_tickets 表
```

### Phase 2：运营体系（3-4周）

```
Week 7-8: 管理后台
  - 用户管理面板（搜索、查看、编辑）
  - Token 消耗仪表盘（实时曲线、TOP 用户）
  - 封禁/解封管理
  - 工单审核面板

Week 9-10: 计费与支付
  - 套餐购买流程
  - 微信支付/支付宝集成
  - 账单自动生成与导出
  - 余额告警机制（邮件/站内信）
```

### Phase 3：高级功能（4-6周）

```
Week 11-13: 智能调度
  - 调度引擎实现
  - 多模型路由策略（按等级、按成本、按性能）
  - 自动降级策略
  - 批量任务队列（BullMQ）

Week 14-16: 高级安全与合规
  - 内容审核中间件（敏感词+图片审核）
  - 操作审计日志系统
  - 多租户（组织）实现
  - RBAC 权限模型
```

---

## 七、关键风险与应对

| 风险 | 影响 | 概率 | 应对策略 |
|------|------|------|---------|
| **模型 API 成本波动** | 定价不准，利润风险 | 中 | 建立20%成本缓冲池；Token 价格按月动态调整 |
| **IP 检测误判** | 用户体验差，投诉 | 高 | 误判自动解封+补偿 Token；规则参数逐步调优；设置人工审核兜底 |
| **高并发计量不准** | 收入损失或多扣费 | 中 | Redis 预扣+PostgreSQL 异步对账；双写校验机制 |
| **模型 API 限流** | 服务不可用 | 高 | 多账号轮询+请求排队+自动降级到备选模型 |
| **数据安全** | 法律风险 | 中 | API Key 哈希存储；全链路 TLS；审计日志不可篡改 |
| **支付对账** | 财务错账 | 低 | 每日自动对账脚本；支付宝/微信对账文件比对 |
| **用户增长超预期** | 数据库性能瓶颈 | 低 | ip_access_logs 按月分区；读写分离；引入 Redis 缓存 |

### 7.1 熔断与降级策略

```typescript
// 当上游模型 API 不可用时，自动降级
const FALLBACK_CHAIN = {
  'doubao-seedance-2-0': ['doubao-seedance-1-5-pro', 'sd-video'],  // 首选降级
  'doubao-seedream-4-0': ['doubao-seedream-3-0', 'sd-xl'],
  // ... 其他模型
}

// 熔断条件
const CIRCUIT_BREAKER = {
  failureThreshold: 5,           // 连续5次失败
  resetTimeout: 60000,           // 60秒后尝试恢复
  halfOpenMaxRequests: 3,        // 半开状态最多3个请求
}
```

---

## 八、附录：参考代码模式

### 8.1 企业化中间件示例

```typescript
// src/middleware.ts - Next.js 企业化中间件
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 需要企业化保护的 API 路由
const ENTERPRISE_API_PATHS = [
  '/api/generate/',
  '/api/create/',
  '/api/workflow/execute',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 只拦截企业 API
  const needsAuth = ENTERPRISE_API_PATHS.some(path => pathname.startsWith(path))
  if (!needsAuth) {
    return NextResponse.next()
  }

  // 1. 验证 API Key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: '未提供 API Key' }, { status: 401 })
  }

  // 2. 采集 IP 信息
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1'

  // 3. 注入企业化请求上下文
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-enterprise-user-id', 'resolved-user-id')
  requestHeaders.set('x-enterprise-ip', ip)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: '/api/:path*',
}
```

### 8.2 Token 计量包装器

```typescript
// src/lib/enterprise/token-meter.ts
// 现有 AI 调用上层的 Token 计量装饰器

export function withTokenMetering<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    model: string
    serviceType: 'image' | 'video' | 'llm' | 'tts'
    estimateTokens: (...args: Parameters<T>) => number
  }
): T {
  return async (...args: Parameters<T>) => {
    // 从参数中提取用户信息
    const userId = extractUserIdFromArgs(args)
    if (!userId) {
      return fn(...args)
    }

    // 计算预估 Token
    const estimatedTokens = options.estimateTokens(...args)

    // 检查并预扣
    const userTier = await getUserTier(userId)
    const rate = await getModelRate(options.model, userTier)
    const tokenCost = Math.ceil(estimatedTokens * rate.tokenCost)

    const deduction = await deductTokens(userId, tokenCost, options.model)

    try {
      // 执行原始函数
      const result = await fn(...args)

      // 确认扣费
      await confirmDeduction(deduction.id, tokenCost)

      return { ...result, tokenCost }
    } catch (error) {
      // 失败退款
      await refundTokens(userId, tokenCost, deduction.id)
      throw error
    }
  }
}
```

### 8.3 IP 自动锁定触发器

```typescript
// src/lib/enterprise/ip-security.ts
// IP 异常检测与自动锁定

interface IPCheckResult {
  isAnomaly: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: 'none' | 'warn' | 'throttle' | 'lock'
  reason?: string
  relatedIPs?: string[]
}

class IPSecurityService {
  // 检查用户最近的 IP 使用模式
  async checkUserIPPattern(userId: string, currentIP: string): Promise<IPCheckResult> {
    const recentLogs = await this.getRecentAccessLogs(userId, 300) // 最近5分钟

    // Rule 1: 多 IP 检测
    const distinctIPs = new Set(recentLogs.map(l => l.ipAddress))
    if (distinctIPs.size >= 3) {
      return {
        isAnomaly: true,
        severity: 'high',
        action: 'lock',
        reason: `检测到 ${distinctIPs.size} 个不同 IP 同时使用`,
        relatedIPs: Array.from(distinctIPs),
      }
    }

    // Rule 2: 频率异常
    if (recentLogs.length >= 30) {
      return {
        isAnomaly: true,
        severity: 'medium',
        action: 'throttle',
        reason: `5分钟内 ${recentLogs.length} 次请求，频率异常`,
      }
    }

    return { isAnomaly: false, severity: 'low', action: 'none' }
  }

  // 执行锁定
  async lockAccount(userId: string, reason: string, eventId: string): Promise<void> {
    await db.query(`
      INSERT INTO account_locks (user_id, lock_type, reason, related_event_id)
      VALUES ($1, 'auto', $2, $3)
    `, [userId, reason, eventId])

    // 通知用户
    await this.notifyUser(userId, 'account_locked', {
      reason,
      appealUrl: `${APP_URL}/tickets/new?type=unlock`,
    })
  }
}
```

---

## 修订历史

| 版本 | 日期 | 修订内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-09 | 初版，完成核心方案设计 | - |
