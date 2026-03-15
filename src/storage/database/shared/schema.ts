import { sql } from "drizzle-orm"
import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ============================================
// 系统表 - 必须保留，不可删除或修改
// ============================================
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// ============================================
// 短剧视频生成系统表
// ============================================

/**
 * 项目表 - 存储小说/脚本内容
 */
export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sourceContent: text("source_content").notNull(), // 原始小说/脚本内容
    sourceType: varchar("source_type", { length: 20 }).default("novel").notNull(), // novel | script
    status: varchar("status", { length: 20 }).default("draft").notNull(), // draft | processing | completed
    // 最终合成视频
    finalVideoUrl: text("final_video_url"), // 合成后的最终视频URL
    finalVideoStatus: varchar("final_video_status", { length: 20 }).default("pending"), // pending | generating | completed | failed
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_created_at_idx").on(table.createdAt),
  ]
)

/**
 * 人物表 - 存储人物信息和角色造型图
 */
export const characters = pgTable(
  "characters",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"), // 人物描述
    appearance: text("appearance"), // 外貌特征
    personality: text("personality"), // 性格特点
    // 角色造型图
    frontViewKey: text("front_view_key"), // 正面图 key
    sideViewKey: text("side_view_key"), // 侧面图 key
    backViewKey: text("back_view_key"), // 背面图 key
    referenceImageKey: text("reference_image_key"),
    // 人物标签
    tags: jsonb("tags").default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("characters_project_id_idx").on(table.projectId),
    index("characters_name_idx").on(table.name),
  ]
)

/**
 * 分镜表 - 存储分镜内容和生成的图片/视频
 */
export const scenes = pgTable(
  "scenes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    sceneNumber: integer("scene_number").notNull(), // 分镜序号
    // 分镜内容
    title: varchar("title", { length: 255 }), // 分镜标题
    description: text("description").notNull(), // 场景描述
    dialogue: text("dialogue"), // 对白内容
    action: text("action"), // 动作描述
    emotion: varchar("emotion", { length: 50 }), // 情绪/氛围
    // 角色信息
    characterIds: jsonb("character_ids").default([]), // 出场人物ID列表
    // 生成的图片
    imageKey: text("image_key"), // 生成的分镜图片 key
    imageUrl: text("image_url"), // 分镜图片URL（直接存储）
    // 生成的视频片段
    videoUrl: text("video_url"), // 生成的视频片段URL
    videoStatus: varchar("video_status", { length: 20 }).default("pending"), // pending | generating | completed | failed
    lastFrameUrl: text("last_frame_url"), // 视频最后一帧URL（用于连续生成）
    // 图片状态
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | generating | completed | failed
    // 元数据
    metadata: jsonb("metadata"), // 额外的元数据（景别、镜头运动等）
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("scenes_project_id_idx").on(table.projectId),
    index("scenes_scene_number_idx").on(table.sceneNumber),
    index("scenes_status_idx").on(table.status),
  ]
)

// ============================================
// Zod Schemas
// ============================================
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
})

// Project schemas
export const insertProjectSchema = createCoercedInsertSchema(projects).pick({
  name: true,
  description: true,
  sourceContent: true,
  sourceType: true,
})

export const updateProjectSchema = createCoercedInsertSchema(projects)
  .pick({
    name: true,
    description: true,
    sourceContent: true,
    sourceType: true,
    status: true,
    finalVideoUrl: true,
    finalVideoStatus: true,
  })
  .partial()

// Character schemas
export const insertCharacterSchema = createCoercedInsertSchema(characters).pick({
  projectId: true,
  name: true,
  description: true,
  appearance: true,
  personality: true,
  tags: true,
})

export const updateCharacterSchema = createCoercedInsertSchema(characters)
  .pick({
    name: true,
    description: true,
    appearance: true,
    personality: true,
    frontViewKey: true,
    sideViewKey: true,
    backViewKey: true,
    referenceImageKey: true,
    tags: true,
  })
  .partial()

// Scene schemas
export const insertSceneSchema = createCoercedInsertSchema(scenes).pick({
  projectId: true,
  sceneNumber: true,
  title: true,
  description: true,
  dialogue: true,
  action: true,
  emotion: true,
  characterIds: true,
  metadata: true,
})

export const updateSceneSchema = createCoercedInsertSchema(scenes)
  .pick({
    sceneNumber: true,
    title: true,
    description: true,
    dialogue: true,
    action: true,
    emotion: true,
    characterIds: true,
    imageKey: true,
    imageUrl: true,
    videoUrl: true,
    videoStatus: true,
    lastFrameUrl: true,
    status: true,
    metadata: true,
  })
  .partial()

// ============================================
// TypeScript Types
// ============================================
export type Project = typeof projects.$inferSelect
export type InsertProject = z.infer<typeof insertProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>

export type Character = typeof characters.$inferSelect
export type InsertCharacter = z.infer<typeof insertCharacterSchema>
export type UpdateCharacter = z.infer<typeof updateCharacterSchema>

export type Scene = typeof scenes.$inferSelect
export type InsertScene = z.infer<typeof insertSceneSchema>
export type UpdateScene = z.infer<typeof updateSceneSchema>

// ============================================
// 用户配置表
// ============================================
export const userSettings = pgTable(
  "user_settings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    
    // LLM配置
    llmProvider: varchar("llm_provider", { length: 50 }).default("doubao"),
    llmModel: varchar("llm_model", { length: 100 }).default("doubao-seed-2-0-pro"),
    llmApiKey: text("llm_api_key"),
    llmBaseUrl: varchar("llm_base_url", { length: 255 }),
    
    // 图像生成配置
    imageProvider: varchar("image_provider", { length: 50 }).default("doubao"),
    imageModel: varchar("image_model", { length: 100 }).default("doubao-seed-3-0"),
    imageApiKey: text("image_api_key"),
    imageBaseUrl: varchar("image_base_url", { length: 255 }),
    imageSize: varchar("image_size", { length: 20 }).default("2K"),
    
    // 视频生成配置
    videoProvider: varchar("video_provider", { length: 50 }).default("doubao"),
    videoModel: varchar("video_model", { length: 100 }).default("doubao-seedance-1-5-pro-251215"),
    videoApiKey: text("video_api_key"),
    videoBaseUrl: varchar("video_base_url", { length: 255 }),
    videoResolution: varchar("video_resolution", { length: 20 }).default("720p"),
    videoRatio: varchar("video_ratio", { length: 20 }).default("16:9"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  }
)

// User Settings schemas
export const updateUserSettingsSchema = createCoercedInsertSchema(userSettings)
  .pick({
    llmProvider: true,
    llmModel: true,
    llmApiKey: true,
    llmBaseUrl: true,
    imageProvider: true,
    imageModel: true,
    imageApiKey: true,
    imageBaseUrl: true,
    imageSize: true,
    videoProvider: true,
    videoModel: true,
    videoApiKey: true,
    videoBaseUrl: true,
    videoResolution: true,
    videoRatio: true,
  })
  .partial()

export type UserSettings = typeof userSettings.$inferSelect
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>
