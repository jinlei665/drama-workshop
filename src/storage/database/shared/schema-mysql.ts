import { sql } from "drizzle-orm"
import {
  mysqlTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  int,
  json,
  index,
  char,
} from "drizzle-orm/mysql-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ============================================
// 系统表 - 必须保留，不可删除或修改
// ============================================
export const healthCheck = mysqlTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// ============================================
// 短剧视频生成系统表 (MySQL 版本)
// ============================================

/**
 * 项目表 - 存储小说/脚本内容
 */
export const projects = mysqlTable(
  "projects",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sourceContent: text("source_content").notNull(),
    sourceType: varchar("source_type", { length: 20 }).default("novel").notNull(),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    finalVideoUrl: text("final_video_url"),
    finalVideoStatus: varchar("final_video_status", { length: 20 }).default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_created_at_idx").on(table.createdAt),
  ]
)

/**
 * 剧集表 - 存储分集信息
 */
export const episodes = mysqlTable(
  "episodes",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    projectId: char("project_id", { length: 36 }).notNull(),
    seasonNumber: int("season_number").default(1).notNull(),
    episodeNumber: int("episode_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    mergedVideoUrl: text("merged_video_url"),
    mergedVideoStatus: varchar("merged_video_status", { length: 20 }).default("pending"),
    mergedVideoKey: text("merged_video_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (table) => [
    index("episodes_project_id_idx").on(table.projectId),
    index("episodes_season_episode_idx").on(table.seasonNumber, table.episodeNumber),
  ]
)

/**
 * 人物表 - 存储人物信息和角色造型图
 */
export const characters = mysqlTable(
  "characters",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    projectId: char("project_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    appearance: text("appearance"),
    personality: text("personality"),
    frontViewKey: text("front_view_key"),
    sideViewKey: text("side_view_key"),
    backViewKey: text("back_view_key"),
    referenceImageKey: text("reference_image_key"),
    voiceId: varchar("voice_id", { length: 100 }),
    voiceUrl: text("voice_url"),
    voiceStyle: varchar("voice_style", { length: 50 }),
    tags: json("tags").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (table) => [
    index("characters_project_id_idx").on(table.projectId),
    index("characters_name_idx").on(table.name),
  ]
)

/**
 * 分镜表 - 存储分镜内容和生成的图片/视频
 */
export const scenes = mysqlTable(
  "scenes",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    projectId: char("project_id", { length: 36 }).notNull(),
    episodeId: char("episode_id", { length: 36 }),
    sceneNumber: int("scene_number").notNull(),
    title: varchar("title", { length: 255 }),
    description: text("description").notNull(),
    dialogue: text("dialogue"),
    action: text("action"),
    emotion: varchar("emotion", { length: 50 }),
    characterIds: json("character_ids").default([]),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    videoUrl: text("video_url"),
    videoStatus: varchar("video_status", { length: 20 }).default("pending"),
    lastFrameUrl: text("last_frame_url"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (table) => [
    index("scenes_project_id_idx").on(table.projectId),
    index("scenes_episode_id_idx").on(table.episodeId),
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
