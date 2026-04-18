import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employees } from "./schema";

// 연구원 역량평가 6대 항목 테이블
export const rdEvaluations = pgTable("rd_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  evaluationYear: integer("evaluation_year").notNull(), // 평가 연도
  evaluationPeriod: text("evaluation_period").notNull(), // "annual", "quarterly", "monthly"
  
  // 1. 전문 기술 역량 (25%)
  technicalCompetencyScore: real("technical_competency_score").notNull().default(0),
  technicalCompetencyDetails: text("technical_competency_details"), // JSON 형태로 상세 정보 저장
  
  // 2. 프로젝트 수행 경험 (20%)
  projectExperienceScore: real("project_experience_score").notNull().default(0),
  projectExperienceDetails: text("project_experience_details"),
  
  // 3. 연구개발 성과 (25%)
  rdAchievementScore: real("rd_achievement_score").notNull().default(0),
  rdAchievementDetails: text("rd_achievement_details"),
  
  // 4. 글로벌 역량 (10%)
  globalCompetencyScore: real("global_competency_score").notNull().default(0),
  globalCompetencyDetails: text("global_competency_details"),
  
  // 5. 기술 확산 및 자기계발 (10%)
  knowledgeSharingScore: real("knowledge_sharing_score").notNull().default(0),
  knowledgeSharingDetails: text("knowledge_sharing_details"),
  
  // 6. 업무개선 및 혁신 제안 (10%)
  innovationProposalScore: real("innovation_proposal_score").notNull().default(0),
  innovationProposalDetails: text("innovation_proposal_details"),
  
  // 종합 점수
  totalScore: real("total_score").notNull().default(0),
  grade: text("grade"), // "S", "A", "B", "C", "D"
  
  // 평가 정보
  evaluatedBy: varchar("evaluated_by"), // 평가자 ID
  evaluationDate: timestamp("evaluation_date").default(sql`now()`),
  status: text("status").notNull().default("draft"), // "draft", "submitted", "approved", "rejected"
  comments: text("comments"), // 평가 의견
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});

// 평가 기준 설정 테이블
export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // "technical_competency", "project_experience", etc.
  criteriaName: text("criteria_name").notNull(),
  description: text("description"),
  weight: real("weight").notNull(), // 가중치 (0-1)
  maxScore: integer("max_score").notNull().default(100),
  scoringMethod: text("scoring_method").notNull(), // "manual", "auto", "hybrid"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});

// 평가 세부 항목 테이블
export const evaluationItems = pgTable("evaluation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: varchar("evaluation_id").notNull().references(() => rdEvaluations.id),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull(), // "degree", "certification", "patent", "paper", "project", "language", "training", "proposal"
  itemValue: text("item_value"), // 실제 값 (학위명, 자격증명, 특허명 등)
  itemScore: real("item_score").notNull().default(0),
  itemDetails: text("item_details"), // JSON 형태로 상세 정보
  createdAt: timestamp("created_at").default(sql`now()`)
});

// 평가 이력 테이블
export const evaluationHistory = pgTable("evaluation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: varchar("evaluation_id").notNull().references(() => rdEvaluations.id),
  action: text("action").notNull(), // "created", "updated", "submitted", "approved", "rejected"
  performedBy: varchar("performed_by").notNull(),
  previousValues: text("previous_values"), // JSON 형태로 이전 값들
  newValues: text("new_values"), // JSON 형태로 새로운 값들
  comments: text("comments"),
  timestamp: timestamp("timestamp").default(sql`now()`)
});

// Insert schemas
export const insertRdEvaluationSchema = createInsertSchema(rdEvaluations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertEvaluationItemSchema = createInsertSchema(evaluationItems).omit({
  id: true,
  createdAt: true
});

export const insertEvaluationHistorySchema = createInsertSchema(evaluationHistory).omit({
  id: true,
  timestamp: true
});

// Types
export type RdEvaluation = typeof rdEvaluations.$inferSelect;
export type InsertRdEvaluation = z.infer<typeof insertRdEvaluationSchema>;
export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;
export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;
export type EvaluationItem = typeof evaluationItems.$inferSelect;
export type InsertEvaluationItem = z.infer<typeof insertEvaluationItemSchema>;
export type EvaluationHistory = typeof evaluationHistory.$inferSelect;
export type InsertEvaluationHistory = z.infer<typeof insertEvaluationHistorySchema>;

// 평가 결과 타입
export interface RdEvaluationResult {
  employeeId: string;
  evaluationYear: number;
  scores: {
    technicalCompetency: number;
    projectExperience: number;
    rdAchievement: number;
    globalCompetency: number;
    knowledgeSharing: number;
    innovationProposal: number;
  };
  totalScore: number;
  grade: string;
  rank: number;
  percentile: number;
}

// 레이더 차트용 데이터 타입
export interface RdRadarData {
  employee: {
    id: string;
    name: string;
    department: string;
  };
  scores: {
    technicalCompetency: number;
    projectExperience: number;
    rdAchievement: number;
    globalCompetency: number;
    knowledgeSharing: number;
    innovationProposal: number;
  };
  totalScore: number;
}

// 평가 통계 타입
export interface RdEvaluationStats {
  totalEvaluations: number;
  averageScore: number;
  gradeDistribution: {
    S: number;
    A: number;
    B: number;
    C: number;
    D: number;
  };
  departmentStats: Array<{
    department: string;
    averageScore: number;
    employeeCount: number;
  }>;
  topPerformers: Array<{
    employeeId: string;
    name: string;
    score: number;
    rank: number;
  }>;
}




