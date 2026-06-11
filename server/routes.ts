import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import {
  insertEmployeeSchema,
  insertTrainingHistorySchema,
  insertCertificationSchema,
  insertLanguageSchema,
  insertSkillSchema,
  insertSkillCalculationSchema
} from "@shared/schema";
import { setupRdEvaluationRoutes } from "./rd-evaluation-routes";
import { setupAchievementsRoutes } from "./achievements-routes";
import { calculateCertificationScore } from "./rd-evaluation-auto";

async function loadDetailedCriteria(): Promise<any> {
  const stored = await storage.getAppSetting("detailedCriteria");
  if (stored) {
    return stored;
  }
  return {};
}

function normalizeEmployeeRequestBody(body: Record<string, any>): Record<string, any> {
  const normalized = { ...body };

  for (const field of ["isDepartmentHead", "isActive"]) {
    if (normalized[field] !== undefined && normalized[field] !== null) {
      normalized[field] = normalized[field] === true || normalized[field] === "true";
    }
  }

  for (const field of ["birthDate", "hireDate"]) {
    if (normalized[field] === "") {
      normalized[field] = null;
    } else if (typeof normalized[field] === "string") {
      normalized[field] = new Date(normalized[field]);
    }
  }

  for (const field of ["graduationYear", "previousExperienceYears", "previousExperienceMonths"]) {
    if (normalized[field] === "") {
      normalized[field] = null;
    } else if (typeof normalized[field] === "string") {
      normalized[field] = Number(normalized[field]);
    }
  }

  return normalized;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntegerOrDefault(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

const DEFAULT_TEAM_WORK_CATEGORIES = [
  {
    categoryNo: "1",
    categoryName: "ALV General & 품질",
    majorFunctions: "1. ALV General tool 사용\n2. ALV System의 이해 및 습득\n3. 품질 시스템의 이행 및 습득",
    controlItems: "1. PLM/DVM/Matrix\n2. ALV Regulation, ISO/TS Training\n3. APS\n4. Project 일정 관리\n5. Project 예산 관리\n6. OA 기기 활용",
  },
  {
    categoryNo: "2",
    categoryName: "Product Design",
    majorFunctions: "1. ALV Product(Airbag & Seatbelt)의 지식 습득\n2. ALV Product의 기술 동향 이해\n3. APDS application",
    controlItems: "1. Design training\n2. Product line training\n3. APDS capability\n4. PLM using capability",
  },
  {
    categoryNo: "3",
    categoryName: "Crash Performance",
    majorFunctions: "1. Frontal crash\n2. Lateral crash\n3. Occupant protection\n4. Injury performance approaching",
    controlItems: "1. 각 지역별 충돌 법규 숙지\n2. 차량 충돌 시스템의 이해\n3. Crash analysis tool 사용 능력(Diadem/TEMA 등)",
  },
  {
    categoryNo: "4",
    categoryName: "Test",
    majorFunctions: "1. 개발 시험(CV & DV) 시험 능력 확보\n2. 시험 방법의 이해 및 지식 습득\n3. 시험 장비의 사용 및 운영\n4. 각 시험 스펙의 숙지 및 이해",
    controlItems: "1. 시험 스펙의 지식 습득\n2. 시험 설비 사용 능력\n3. 시험 방법 개발 능력\n4. Crash analysis tool 사용 능력(Diadem/TEMA 등)",
  },
  {
    categoryNo: "5",
    categoryName: "CAE",
    majorFunctions: "1. CAE tool 사용 능력 확보\n- Hyperview/LS-DYNA/MADYMO\n2. CAE matrix 구성",
    controlItems: "1. CAE tool 사용 능력\n- Hyperview/LS-DYNA/MADYMO\n2. 실험계획법",
  },
];

const DEFAULT_TEAM_COMPETENCY_REQUIREMENTS = [
  ["1", "ALV General & 품질", "1", "ALV General tool", "이공계", "무관", "12개월", "24개월", "사내교육\n(PLM/DVM/Matrix)", "영어(B)", "5", "4", "3", "3"],
  ["1", "ALV General & 품질", "2", "ALV System", "이공계", "무관", "6개월", "12개월", "사내교육\n(ALV Regulation, ISO/TS Training)", "영어(B)", "5", "4", "N/A", "4"],
  ["1", "ALV General & 품질", "3", "품질 시스템", "이공계", "무관", "6개월", "12개월", "사내/사외교육\n(품질관리기초, AS4)", "영어(B)", "5", "4", "3", "3"],
  ["2", "Product Design", "1", "ALV Product(Airbag & Seatbelt)", "이공계", "무관", "12개월", "24개월", "사내교육\n(Design Standard)", "영어(B)", "N/A", "5", "3", "3"],
  ["2", "Product Design", "2", "APDS", "이공계", "무관", "12개월", "24개월", "사내교육\n(Design Standard)", "영어(B)", "4", "4", "3", "3"],
  ["2", "Product Design", "3", "Product application", "이공계", "무관", "12개월", "24개월", "사내교육\n(Design Standard)", "영어(B)", "4", "4", "3", "3"],
  ["2", "Product Design", "4", "Roadmap", "이공계", "무관", "6개월", "12개월", "사내교육\n(Design Standard)", "영어(B)", "4", "4", "3", "3"],
  ["3", "Crash Performance", "1", "Frontal Crash", "이공계", "무관", "12개월", "24개월", "사내교육\n(차량 충돌 시스템의 이해)", "영어(B)", "4", "4", "3", "3"],
  ["3", "Crash Performance", "2", "Lateral Crash", "이공계", "무관", "12개월", "24개월", "사내교육\n(차량 충돌 시스템의 이해)", "영어(B)", "4", "4", "3", "3"],
  ["3", "Crash Performance", "3", "Occupant protection", "이공계", "무관", "12개월", "24개월", "사내교육\n(차량 충돌 시스템의 이해)", "영어(B)", "4", "4", "3", "3"],
  ["3", "Crash Performance", "4", "Injury performance approaching", "이공계", "무관", "6개월", "12개월", "사내교육\n(차량 충돌 시스템의 이해)", "영어(B)", "4", "4", "3", "3"],
  ["4", "Test", "1", "개발 시험(CV & DV) 시험 능력 확보", "이공계", "무관", "6개월", "12개월", "사내/사외교육\n(기초 기술교육)", "영어(B)", "4", "3", "2", "2"],
  ["4", "Test", "2", "시험 방법의 이해 및 지식 습득", "이공계", "무관", "6개월", "12개월", "사내/사외교육\n(기초 기술교육)", "영어(B)", "4", "3", "2", "2"],
  ["4", "Test", "3", "시험 장비의 사용 및 운영", "이공계", "무관", "6개월", "12개월", "사내/사외교육\n(시험설비 운영교육)", "영어(B)", "4", "3", "2", "2"],
  ["4", "Test", "4", "각 시험 스펙의 숙지 및 이해", "이공계", "무관", "6개월", "12개월", "사내교육\n(고객규격 & 고객 요구교육)", "영어(B)", "4", "3", "2", "2"],
  ["5", "CAE", "1", "CAE tool", "이공계", "무관", "6개월", "12개월", "사내/외교육\n(CAE Tool)", "무관", "4", "3", "2", "2"],
  ["5", "CAE", "2", "CAE matrix 구성", "이공계", "무관", "6개월", "6개월", "사내교육\n(Design Standard & Test)", "무관", "3", "3", "2", "2"],
].map(([
  majorNo,
  majorName,
  subNo,
  subName,
  requiredMajor,
  requiredCertification,
  minKnowledge,
  proficiencyPeriod,
  requiredTraining,
  languageRequirement,
  deptHeadLevel,
  managerLevel,
  staffLevel,
  minimumLevel,
]) => ({
  majorNo,
  majorName,
  subNo,
  subName,
  requiredMajor,
  requiredCertification,
  minKnowledge,
  proficiencyPeriod,
  requiredTraining,
  languageRequirement,
  deptHeadLevel,
  managerLevel,
  staffLevel,
  minimumLevel,
}));

const DEFAULT_TEAM_REQUIRED_QUALIFICATIONS = [
  {
    itemNo: "1",
    requirementItem: "시험요원 자격부여",
    requirementName: "OJT 수료 및 적격성 평가 항목(전공, 교육, 경력, 숙련도) 만족",
    requiredGrade: "70점 이상",
    plan: "직원별 자격/교육/평가 증빙 등록 필요",
  },
  {
    itemNo: "2",
    requirementItem: "6 Sigma",
    requirementName: "6 Sigma",
    requiredGrade: "Green belt",
    plan: "보유자 자격 이력 등록 필요",
  },
];

function rowTeamCompetencyReport(row: any) {
  return {
    id: row.id,
    teamCode: row.team_code,
    teamName: row.team_name,
    evaluationYear: row.evaluation_year,
    revision: row.revision,
    roleSummary: row.role_summary,
    preparedBy: row.prepared_by,
    checkedBy: row.checked_by,
    approvedBy: row.approved_by,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowTeamRoleAssignment(row: any) {
  return {
    id: row.id,
    reportId: row.report_id,
    roleGroup: row.role_group,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    positionTitle: row.position_title,
    responsibilities: row.responsibilities,
    deputyEmployeeId: row.deputy_employee_id,
    deputyName: row.deputy_name,
    displayOrder: row.display_order,
  };
}

function rowTeamWorkCategory(row: any) {
  return {
    id: row.id,
    reportId: row.report_id,
    categoryNo: row.category_no,
    categoryName: row.category_name,
    majorFunctions: row.major_functions,
    controlItems: row.control_items,
    specialNotes: row.special_notes,
    relatedDocs: row.related_docs,
    cooperatingTeam: row.cooperating_team,
    cooperatingWork: row.cooperating_work,
    displayOrder: row.display_order,
  };
}

function rowTeamCompetencyRequirement(row: any) {
  return {
    id: row.id,
    reportId: row.report_id,
    categoryId: row.category_id,
    majorNo: row.major_no,
    majorName: row.major_name,
    subNo: row.sub_no,
    subName: row.sub_name,
    requiredMajor: row.required_major,
    requiredCertification: row.required_certification,
    minKnowledge: row.min_knowledge,
    proficiencyPeriod: row.proficiency_period,
    requiredTraining: row.required_training,
    languageRequirement: row.language_requirement,
    deptHeadLevel: row.dept_head_level,
    managerLevel: row.manager_level,
    staffLevel: row.staff_level,
    minimumLevel: row.minimum_level,
    displayOrder: row.display_order,
    scores: [] as any[],
  };
}

function rowTeamCompetencyScore(row: any) {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    score: row.score,
    notes: row.notes,
  };
}

function rowTeamRequiredQualification(row: any) {
  return {
    id: row.id,
    reportId: row.report_id,
    itemNo: row.item_no,
    requirementItem: row.requirement_item,
    requirementName: row.requirement_name,
    requiredGrade: row.required_grade,
    holderSummary: row.holder_summary,
    heldQualification: row.held_qualification,
    plan: row.plan,
    remarks: row.remarks,
    displayOrder: row.display_order,
  };
}

async function getOrderedTeamMembers(teamCode: string, teamName: string, queryRunner: any = pool) {
  const result = await queryRunner.query(
    `
      SELECT e.id, e.employee_number, e.name, e.position, e.department, e.team,
             e.department_code, e.team_code, e.manager_id, e.is_active,
             manager.name AS manager_name
      FROM employees e
      LEFT JOIN employees manager ON manager.id = e.manager_id
      WHERE e.is_active IS DISTINCT FROM FALSE
        AND (e.team_code = $1 OR e.team = $2)
      ORDER BY e.name
    `,
    [teamCode, teamName],
  );

  const positionRank = (position: string | null) => {
    const text = position ?? "";
    if (text.includes("그룹장") || text.includes("부문장")) return 100;
    if (text.includes("팀장")) return 90;
    if (text.includes("책임")) return 70;
    if (text.includes("수석")) return 60;
    if (text.includes("매니저")) return 50;
    return 10;
  };

  const rows = result.rows;
  const byId = new Map(rows.map((row: any) => [row.id, row]));
  const childrenByManager = new Map<string, any[]>();

  for (const row of rows) {
    if (row.manager_id && byId.has(row.manager_id)) {
      const children = childrenByManager.get(row.manager_id) ?? [];
      children.push(row);
      childrenByManager.set(row.manager_id, children);
    }
  }

  const sortRows = (items: any[]) =>
    [...items].sort((a, b) => {
      const rankDiff = positionRank(b.position) - positionRank(a.position);
      if (rankDiff !== 0) return rankDiff;
      return String(a.name).localeCompare(String(b.name), "ko");
    });

  const roots = sortRows(rows.filter((row: any) => !row.manager_id || !byId.has(row.manager_id)));
  const ordered: any[] = [];
  const seen = new Set<string>();

  const visit = (row: any, depth: number) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    ordered.push({ ...row, org_order: ordered.length, org_depth: depth });
    for (const child of sortRows(childrenByManager.get(row.id) ?? [])) {
      visit(child, depth + 1);
    }
  };

  for (const root of roots) visit(root, 0);
  for (const row of sortRows(rows.filter((item: any) => !seen.has(item.id)))) {
    visit(row, 0);
  }

  return ordered;
}

async function ensureTeamCompetencyDefaults(reportRow: any) {
  const reportId = reportRow.id;
  const members = await getOrderedTeamMembers(reportRow.team_code, reportRow.team_name);
  const memberIds = members.map((member: any) => member.id);

  if (memberIds.length > 0) {
    await pool.query(
      `
        DELETE FROM team_role_assignments
        WHERE report_id = $1
          AND employee_id IS NOT NULL
          AND NOT (employee_id = ANY($2::varchar[]))
      `,
      [reportId, memberIds],
    );
  }

  for (const member of members) {
    const updateResult = await pool.query(
      `
        UPDATE team_role_assignments
        SET role_group = $3,
            employee_name = $4,
            position_title = $5,
            display_order = $6,
            updated_at = NOW()
        WHERE report_id = $1 AND employee_id = $2
      `,
      [reportId, member.id, reportRow.team_name, member.name, member.position, member.org_order],
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `
          INSERT INTO team_role_assignments
            (report_id, role_group, employee_id, employee_name, position_title, responsibilities, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [reportId, reportRow.team_name, member.id, member.name, member.position, "", member.org_order],
      );
    }
  }

  const categoryCount = await pool.query("SELECT COUNT(*)::int AS count FROM team_work_categories WHERE report_id = $1", [reportId]);
  if (categoryCount.rows[0]?.count === 0) {
    for (let index = 0; index < DEFAULT_TEAM_WORK_CATEGORIES.length; index += 1) {
      const row = DEFAULT_TEAM_WORK_CATEGORIES[index];
      await pool.query(
        `
          INSERT INTO team_work_categories
            (report_id, category_no, category_name, major_functions, control_items, display_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [reportId, row.categoryNo, row.categoryName, row.majorFunctions, row.controlItems, index],
      );
    }
  }

  const requirementCount = await pool.query("SELECT COUNT(*)::int AS count FROM team_competency_requirements WHERE report_id = $1", [reportId]);
  if (requirementCount.rows[0]?.count === 0) {
    for (let index = 0; index < DEFAULT_TEAM_COMPETENCY_REQUIREMENTS.length; index += 1) {
      const row = DEFAULT_TEAM_COMPETENCY_REQUIREMENTS[index];
      await pool.query(
        `
          INSERT INTO team_competency_requirements
            (report_id, major_no, major_name, sub_no, sub_name, required_major, required_certification,
             min_knowledge, proficiency_period, required_training, language_requirement,
             dept_head_level, manager_level, staff_level, minimum_level, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
        [
          reportId,
          row.majorNo,
          row.majorName,
          row.subNo,
          row.subName,
          row.requiredMajor,
          row.requiredCertification,
          row.minKnowledge,
          row.proficiencyPeriod,
          row.requiredTraining,
          row.languageRequirement,
          row.deptHeadLevel,
          row.managerLevel,
          row.staffLevel,
          row.minimumLevel,
          index,
        ],
      );
    }
  }

  const requirements = await pool.query("SELECT id FROM team_competency_requirements WHERE report_id = $1", [reportId]);
  for (const requirement of requirements.rows) {
    for (const member of members) {
      await pool.query(
        `
          INSERT INTO team_competency_scores (requirement_id, employee_id, employee_name, score)
          VALUES ($1, $2, $3, NULL)
          ON CONFLICT (requirement_id, employee_id)
          DO UPDATE SET employee_name = EXCLUDED.employee_name, updated_at = NOW()
        `,
        [requirement.id, member.id, member.name],
      );
    }
  }

  const qualificationCount = await pool.query("SELECT COUNT(*)::int AS count FROM team_required_qualifications WHERE report_id = $1", [reportId]);
  if (qualificationCount.rows[0]?.count === 0) {
    for (let index = 0; index < DEFAULT_TEAM_REQUIRED_QUALIFICATIONS.length; index += 1) {
      const row = DEFAULT_TEAM_REQUIRED_QUALIFICATIONS[index];
      await pool.query(
        `
          INSERT INTO team_required_qualifications
            (report_id, item_no, requirement_item, requirement_name, required_grade, plan, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [reportId, row.itemNo, row.requirementItem, row.requirementName, row.requiredGrade, row.plan, index],
      );
    }
  }
}

async function loadTeamCompetencyDetail(reportId: string) {
  const reportResult = await pool.query("SELECT * FROM team_competency_reports WHERE id = $1", [reportId]);
  const reportRow = reportResult.rows[0];
  if (!reportRow) return null;
  await ensureTeamCompetencyDefaults(reportRow);

  const [assignmentsResult, categoriesResult, requirementsResult, scoresResult, qualificationsResult, membersResult] =
    await Promise.all([
      pool.query("SELECT * FROM team_role_assignments WHERE report_id = $1 ORDER BY display_order, created_at", [reportId]),
      pool.query("SELECT * FROM team_work_categories WHERE report_id = $1 ORDER BY display_order, created_at", [reportId]),
      pool.query("SELECT * FROM team_competency_requirements WHERE report_id = $1 ORDER BY display_order, created_at", [reportId]),
      pool.query(
        `SELECT s.*
         FROM team_competency_scores s
         JOIN team_competency_requirements r ON r.id = s.requirement_id
         WHERE r.report_id = $1
         ORDER BY s.created_at`,
        [reportId],
      ),
      pool.query("SELECT * FROM team_required_qualifications WHERE report_id = $1 ORDER BY display_order, created_at", [reportId]),
      getOrderedTeamMembers(reportRow.team_code, reportRow.team_name),
    ]);

  const requirements = requirementsResult.rows.map(rowTeamCompetencyRequirement);
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  for (const row of scoresResult.rows) {
    const score = rowTeamCompetencyScore(row);
    const requirement = requirementsById.get(score.requirementId);
    if (requirement) requirement.scores.push(score);
  }

  const memberIds = membersResult.map((row: any) => row.id);
  const evidenceResult = memberIds.length
    ? await pool.query(
        `
          SELECT e.id AS employee_id,
                 COUNT(DISTINCT c.id)::int AS certifications,
                 COUNT(DISTINCT s.id)::int AS skills,
                 COUNT(DISTINCT l.id)::int AS languages,
                 COUNT(DISTINCT t.id)::int AS trainings
          FROM employees e
          LEFT JOIN certifications c ON c.employee_id = e.id AND c.is_active IS DISTINCT FROM FALSE
          LEFT JOIN skills s ON s.employee_id = e.id AND s.is_active IS DISTINCT FROM FALSE
          LEFT JOIN languages l ON l.employee_id = e.id AND l.is_active IS DISTINCT FROM FALSE
          LEFT JOIN training_history t ON t.employee_id = e.id
          WHERE e.id = ANY($1::varchar[])
          GROUP BY e.id
        `,
        [memberIds],
      )
    : { rows: [] };

  return {
    report: rowTeamCompetencyReport(reportRow),
    teamMembers: membersResult.map((row: any) => ({
      id: row.id,
      employeeNumber: row.employee_number,
      name: row.name,
      position: row.position,
      department: row.department,
      team: row.team,
      departmentCode: row.department_code,
      teamCode: row.team_code,
      managerId: row.manager_id,
      managerName: row.manager_name,
      orgOrder: row.org_order,
      orgDepth: row.org_depth,
      isActive: row.is_active,
    })),
    memberEvidence: evidenceResult.rows.map((row: any) => ({
      employeeId: row.employee_id,
      certifications: row.certifications,
      skills: row.skills,
      languages: row.languages,
      trainings: row.trainings,
    })),
    assignments: assignmentsResult.rows.map(rowTeamRoleAssignment),
    workCategories: categoriesResult.rows.map(rowTeamWorkCategory),
    requirements,
    qualifications: qualificationsResult.rows.map(rowTeamRequiredQualification),
  };
}

// Helper function to parse Excel dates
function parseExcelDate(cellValue: any): string | null {
  if (!cellValue) return null;

  try {
    // If it's already a Date object (from cellDates: true)
    if (cellValue instanceof Date) {
      return cellValue.toISOString();
    }

    // If it's a string that can be parsed as a date
    if (typeof cellValue === 'string') {
      const parsedDate = new Date(cellValue);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }

    // If it's a number (Excel serial date)
    if (typeof cellValue === 'number') {
      // Excel serial date: days since January 1, 1900 (with leap year bug)
      const excelEpoch = new Date(1900, 0, 1);
      const daysSinceEpoch = cellValue - 1; // Subtract 1 due to Excel's leap year bug
      const jsDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
      return jsDate.toISOString();
    }

    return null;
  } catch (error) {
    console.error('Date parsing error:', error, 'for value:', cellValue);
    return null;
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const department = req.query.department as string;
      const includeInactive = req.query.includeInactive === 'true';

      let employees;
      if (includeInactive) {
        // 직원 관리 페이지에서 모든 직원(비활성 포함) 조회
        employees = department
          ? await storage.getEmployeesByDepartment(department)
          : await storage.getAllEmployeesIncludingInactive();
      } else {
        // 다른 페이지에서는 활성 직원만 조회
        employees = department
          ? await storage.getEmployeesByDepartment(department)
          : await storage.getAllEmployees();
      }


      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // 직원 검색 API (이름으로 검색)
  app.get("/api/employees/search", async (req, res) => {
    try {
      const { q, query } = req.query;
      const searchTerm = q || query;
      if (!searchTerm || typeof searchTerm !== 'string') {
        return res.status(400).json({ error: "검색어가 필요합니다." });
      }

      const employees = await storage.getAllEmployees();
      const filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeNumber.includes(searchTerm)
      );

      res.json(filteredEmployees);
    } catch (error) {
      console.error('직원 검색 오류:', error);
      res.status(500).json({ error: "직원 검색에 실패했습니다." });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.get("/api/employees/:id/profile", async (req, res) => {
    try {
      const profile = await storage.getEmployeeFullProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Employee profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee profile" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(normalizeEmployeeRequestBody(req.body));
      const employee = await storage.createEmployee(employeeData);
      res.status(201).json(employee);
    } catch (error) {
      console.error("직원 등록 실패:", error);
      res.status(400).json({ error: "Invalid employee data" });
    }
  });

  // 보기 상태 저장 (POST)
  app.post("/api/save-view-state", async (req, res) => {
    try {
      const viewState = req.body;

      // 보기 상태를 storage에 저장
      storage.saveViewState(viewState);

      res.json({
        success: true,
        message: "보기 상태가 저장되었습니다.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 보기 상태 저장 중 오류:', error);
      res.status(500).json({
        success: false,
        message: "보기 상태 저장에 실패했습니다.",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 보기 상태 불러오기 (GET)
  app.get("/api/load-view-state", async (req, res) => {
    try {
      const viewState = storage.getViewState();

      res.json({
        success: true,
        viewState: viewState || null
      });
    } catch (error) {
      console.error('❌ 보기 상태 불러오기 중 오류:', error);
      res.status(500).json({
        success: false,
        message: "보기 상태 불러오기에 실패했습니다.",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      // 기존 직원 데이터 확인
      const existingEmployee = await storage.getEmployee(req.params.id);

      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Keep explicit nulls so nullable fields can be cleared intentionally.
      const cleanedBody = normalizeEmployeeRequestBody(req.body);

      const employeeData = insertEmployeeSchema.partial().parse(cleanedBody);


      // 변경사항이 있는지 확인
      const hasChanges = Object.keys(employeeData).some(key => {
        const existingValue = existingEmployee?.[key as keyof typeof existingEmployee];
        const newValue = employeeData[key as keyof typeof employeeData];
        return existingValue !== newValue;
      });

      if (!hasChanges) {
        return res.json(existingEmployee);
      }

      // 중복 업데이트 방지: 동일한 요청이 연속으로 들어오는 경우 방지
      const isDuplicateRequest = Object.keys(employeeData).every(key => {
        const existingValue = existingEmployee?.[key as keyof typeof existingEmployee];
        const newValue = employeeData[key as keyof typeof employeeData];
        return existingValue === newValue;
      });

      if (isDuplicateRequest) {
        return res.json(existingEmployee);
      }

      const employee = await storage.updateEmployee(req.params.id, employeeData);

      res.json(employee);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error('❌ 직원 업데이트 실패:', error);
      console.error('❌ 오류 스택:', stack);
      console.error('❌ 오류 타입:', typeof error);
      console.error('❌ 오류 메시지:', message);
      res.status(400).json({ error: "Failed to update employee", details: message });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const success = await storage.deleteEmployee(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // Training History routes
  app.get("/api/training", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const training = employeeId
        ? await storage.getTrainingHistory(employeeId)
        : await storage.getAllTrainingHistory();
      res.json(training);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training history" });
    }
  });

  app.post("/api/training", async (req, res) => {
    try {
      const trainingData = insertTrainingHistorySchema.parse(req.body);
      const training = await storage.createTrainingHistory(trainingData);
      res.status(201).json(training);
    } catch (error) {
      console.error("Training validation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: `Invalid training data: ${error.message}` });
      } else {
        res.status(400).json({ error: "Invalid training data" });
      }
    }
  });

  // Training file upload route
  app.post("/api/training/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다." });
      }


      let workbook: XLSX.WorkBook;

      // Parse the uploaded file based on its type
      if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        const csvData = req.file.buffer.toString('utf8');
        workbook = XLSX.read(csvData, { type: 'string', cellDates: true, cellNF: true });
      } else {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, cellNF: true });
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      if (rawData.length < 2) {
        return res.status(400).json({ error: "파일에 데이터가 없습니다." });
      }

      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1);

      // Expected headers mapping (Korean to English)
      const headerMap: Record<string, string> = {
        '직원ID': 'employeeId',
        '교육과정명': 'courseName',
        '교육기관': 'provider',
        '유형': 'type',
        '카테고리': 'category',
        '시작일': 'startDate',
        '완료일': 'completionDate',
        '교육시간': 'duration',
        '점수': 'score',
        '상태': 'status',
        '수료증URL': 'certificateUrl',
        '비고': 'notes'
      };

      // Map header indices
      const headerIndices: Record<string, number> = {};
      headers.forEach((header, index) => {
        const mappedHeader = headerMap[header.trim()];
        if (mappedHeader) {
          headerIndices[mappedHeader] = index;
        }
      });

      // Check required columns
      const requiredHeaders = ['employeeId', 'courseName', 'provider', 'type', 'category'];
      const missingHeaders = requiredHeaders.filter(header => !(header in headerIndices));

      if (missingHeaders.length > 0) {
        const missingKorean = missingHeaders.map(header =>
          Object.keys(headerMap).find(k => headerMap[k] === header)
        );
        return res.status(400).json({
          error: `필수 컬럼이 누락되었습니다: ${missingKorean.join(', ')}`
        });
      }

      const results: Array<{ success: boolean; data?: any; error?: string; row: number }> = [];

      // Process each data row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as any[];
        const rowNumber = i + 2; // +2 because we start from row 1 (0-indexed) and skip header

        try {
          const trainingData: any = {
            employeeId: row[headerIndices.employeeId]?.toString().trim(),
            courseName: row[headerIndices.courseName]?.toString().trim(),
            provider: row[headerIndices.provider]?.toString().trim(),
            type: row[headerIndices.type]?.toString().trim() || 'optional',
            category: row[headerIndices.category]?.toString().trim() || 'other',
            startDate: headerIndices.startDate !== undefined ?
              (row[headerIndices.startDate] ? parseExcelDate(row[headerIndices.startDate]) : null) : null,
            completionDate: headerIndices.completionDate !== undefined ?
              (row[headerIndices.completionDate] ? parseExcelDate(row[headerIndices.completionDate]) : null) : null,
            duration: headerIndices.duration !== undefined ?
              (row[headerIndices.duration] ? Number(row[headerIndices.duration]) : null) : null,
            score: headerIndices.score !== undefined ?
              (row[headerIndices.score] ? Number(row[headerIndices.score]) : null) : null,
            status: (row[headerIndices.status]?.toString().trim() || 'planned'),
            certificateUrl: headerIndices.certificateUrl !== undefined ?
              row[headerIndices.certificateUrl]?.toString().trim() || null : null,
            notes: headerIndices.notes !== undefined ?
              row[headerIndices.notes]?.toString().trim() || null : null
          };

          // Skip empty rows
          if (!trainingData.employeeId || !trainingData.courseName) {
            continue;
          }

          // Validate with schema
          const validatedData = insertTrainingHistorySchema.parse(trainingData);
          const training = await storage.createTrainingHistory(validatedData);

          results.push({ success: true, data: training, row: rowNumber });
        } catch (error) {
          console.error(`Row ${rowNumber} validation error:`, error);
          const errorMessage = error instanceof Error ? error.message : "데이터 형식 오류";
          results.push({ success: false, error: errorMessage, row: rowNumber });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      const errors = results.filter(r => !r.success).map(r => ({ row: r.row, message: r.error || "알 수 없는 오류" }));


      res.status(200).json({
        success: errorCount === 0,
        totalRows: results.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Limit to first 10 errors
      });

    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "파일 처리 중 오류가 발생했습니다." });
    }
  });

  app.put("/api/training/:id", async (req, res) => {
    try {
      const trainingData = insertTrainingHistorySchema.partial().parse(req.body);
      const training = await storage.updateTrainingHistory(req.params.id, trainingData);
      res.json(training);
    } catch (error) {
      res.status(400).json({ error: "Failed to update training" });
    }
  });

  app.delete("/api/training/:id", async (req, res) => {
    try {
      const success = await storage.deleteTrainingHistory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training record" });
    }
  });

  // Certification routes
  app.get("/api/certifications", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let certifications = employeeId
        ? await storage.getCertificationsByEmployee(employeeId)
        : await storage.getAllCertifications();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        certifications = certifications.filter(certification => {
          const certDate = certification.issueDate;
          if (!certDate) return false; // 날짜가 없는 자격증은 제외

          const date = new Date(certDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(certifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certifications" });
    }
  });

  app.post("/api/certifications", async (req, res) => {
    try {
      const certificationData = insertCertificationSchema.parse(req.body);

      // 자격증 점수 자동 계산 및 저장
      const detailedCriteria = await loadDetailedCriteria();
      const calculatedScore = calculateCertificationScore(certificationData, detailedCriteria);

      // scoreAtAcquisition, scoringCriteriaVersion, useFixedScore 설정
      const enhancedCertificationData = {
        ...certificationData,
        scoreAtAcquisition: calculatedScore,
        scoringCriteriaVersion: new Date().toISOString().split('T')[0], // YYYY-MM-DD 형식
        useFixedScore: true,
        updatedAt: new Date()
      };

      const certification = await storage.createCertification(enhancedCertificationData);
      res.status(201).json(certification);
    } catch (error) {
      res.status(400).json({ error: "Invalid certification data" });
    }
  });

  app.put("/api/certifications/:id", async (req, res) => {
    try {
      console.log('🔍 PUT /api/certifications/:id 호출:', {
        id: req.params.id,
        body: req.body
      });

      const certificationData = insertCertificationSchema.partial().parse(req.body);
      console.log('🔍 파싱된 데이터:', certificationData);

      // 자격증 정보가 변경된 경우 점수 재계산
      if (certificationData.name || certificationData.level || certificationData.category) {
        // ✅ 기존 데이터 가져오기
        const existing = await storage.getCertification(req.params.id);

        // ✅ 기존 데이터와 새 데이터 merge
        const mergedData = {
          ...existing,
          ...certificationData
        };

      const detailedCriteria = await loadDetailedCriteria();
        const calculatedScore = calculateCertificationScore(mergedData, detailedCriteria);

        console.log('🔍 계산된 점수:', calculatedScore);

        const enhancedCertificationData = {
          ...certificationData,
          score: calculatedScore,                    // ✅ score 업데이트
          scoreAtAcquisition: calculatedScore,       // ✅ scoreAtAcquisition 업데이트
          scoringCriteriaVersion: new Date().toISOString().split('T')[0],
          updatedAt: new Date()
        };

        console.log('🔍 점수 재계산 포함 데이터:', enhancedCertificationData);

        const certification = await storage.updateCertification(req.params.id, enhancedCertificationData);
        console.log('✅ 저장 완료:', certification);
        res.json(certification);
      } else {
        // 자격증 정보 변경 없으면 기존 점수 유지
        const enhancedCertificationData = {
          ...certificationData,
          updatedAt: new Date()
        };

        console.log('🔍 점수 재계산 없이 데이터:', enhancedCertificationData);

        const certification = await storage.updateCertification(req.params.id, enhancedCertificationData);
        console.log('✅ 저장 완료:', certification);
        res.json(certification);
      }
    } catch (error) {
      console.error('❌ PUT /api/certifications/:id 오류:', error);
      res.status(400).json({ error: "Failed to update certification", details: error });
    }
  });

  app.delete("/api/certifications/:id", async (req, res) => {
    try {
      const success = await storage.deleteCertification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Certification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete certification" });
    }
  });

  // 특정 직원의 모든 자격증 삭제 (편집 저장 시 전체 재등록 용도)
  app.delete("/api/certifications", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const existing = await storage.getCertificationsByEmployee(employeeId);
      for (const cert of existing) {
        await storage.deleteCertification(cert.id);
      }

      res.json({ success: true, deletedCount: existing.length });
    } catch (error) {
      console.error('자격증 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete certifications" });
    }
  });

  // Language routes
  app.get("/api/languages", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const languages = employeeId
        ? await storage.getLanguages(employeeId)
        : await storage.getAllLanguages();
      res.json(languages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch languages" });
    }
  });

  app.post("/api/languages", async (req, res) => {
    try {
      const languageData = insertLanguageSchema.parse(req.body);
      const language = await storage.createLanguage(languageData);
      res.status(201).json(language);
    } catch (error) {
      res.status(400).json({ error: "Invalid language data" });
    }
  });

  app.put("/api/languages/:id", async (req, res) => {
    try {
      const languageData = insertLanguageSchema.partial().parse(req.body);
      const language = await storage.updateLanguage(req.params.id, languageData);
      res.json(language);
    } catch (error) {
      res.status(400).json({ error: "Failed to update language" });
    }
  });

  app.delete("/api/languages/:id", async (req, res) => {
    try {
      const success = await storage.deleteLanguage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Language record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete language record" });
    }
  });

  // Skill routes
  app.get("/api/skills", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const skills = employeeId
        ? await storage.getSkillsByEmployee(employeeId)
        : await storage.getAllSkills();
      res.json(skills);
    } catch (error) {
      console.error('스킬 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  app.post("/api/skills", async (req, res) => {
    try {
      const skillData = insertSkillSchema.parse(req.body);
      const skill = await storage.createSkill(skillData);
      res.status(201).json(skill);
    } catch (error) {
      res.status(400).json({ error: "Invalid skill data" });
    }
  });

  app.put("/api/skills/:id", async (req, res) => {
    try {
      const skillData = insertSkillSchema.partial().parse(req.body);
      const skill = await storage.updateSkill(req.params.id, skillData);
      res.json(skill);
    } catch (error) {
      res.status(400).json({ error: "Failed to update skill" });
    }
  });

  app.delete("/api/skills/:id", async (req, res) => {
    try {
      const success = await storage.deleteSkill(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Skill record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete skill record" });
    }
  });

  // 특정 직원의 모든 스킬 삭제
  app.delete("/api/skills", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const skills = await storage.getSkillsByEmployee(employeeId);

      for (const skill of skills) {
        await storage.deleteSkill(skill.id);
      }

      res.json({ success: true, deletedCount: skills.length });
    } catch (error) {
      console.error('🔍 직원 스킬 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete skills" });
    }
  });

  // Training History routes
  app.get("/api/training-history", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let trainings = employeeId
        ? await storage.getTrainingHistoryByEmployee(employeeId)
        : await storage.getAllTrainingHistory();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        trainings = trainings.filter(training => {
          const trainingDate = training.completionDate || training.startDate;
          if (!trainingDate) return false; // 날짜가 없는 교육은 제외

          const date = new Date(trainingDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(trainings);
    } catch (error) {
      console.error('교육 이력 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch training history" });
    }
  });

  app.post("/api/training-history", async (req, res) => {
    try {
      const trainingData = insertTrainingHistorySchema.parse(req.body);
      const training = await storage.createTrainingHistory(trainingData);

      // 교육 이력 저장 후 자동으로 교육시간 데이터로 변환
      try {
        const trainingYear = new Date(training.completionDate).getFullYear();
        const employee = await storage.getEmployee(training.employeeId);

        if (employee) {
          // 팀이 없는 직원은 부서명을 팀으로 사용
          const teamName = employee.team || employee.department || '기타';

          // 해당 팀의 해당 연도, 해당 교육유형의 기존 데이터 조회
          const existingHours = await storage.getTrainingHoursByYearRange(trainingYear, trainingYear);
          const existingData = existingHours.find(th =>
            th.team === teamName &&
            th.trainingType === (training.type || '기타')
          );

          if (existingData) {
            // 기존 데이터 업데이트
            await storage.updateTrainingHours(existingData.id, {
              hours: existingData.hours + (training.duration || 0)
            });
          } else {
            // 새 데이터 생성
            await storage.createTrainingHours({
              year: trainingYear,
              team: teamName,
              trainingType: training.type || '기타',
              hours: training.duration || 0,
              description: `${teamName} ${training.type || '기타'} 교육시간 (자동생성)`
            });
          }
        }
      } catch (autoConvertError) {
        console.error('교육시간 자동 변환 오류:', autoConvertError);
        // 자동 변환 실패해도 교육 이력 저장은 성공으로 처리
      }

      res.status(201).json(training);
    } catch (error) {
      res.status(400).json({ error: "Failed to create training history" });
    }
  });

  app.put("/api/training-history/:id", async (req, res) => {
    try {
      const trainingData = insertTrainingHistorySchema.partial().parse(req.body);
      const training = await storage.updateTrainingHistory(req.params.id, trainingData);
      res.json(training);
    } catch (error) {
      res.status(400).json({ error: "Failed to update training history" });
    }
  });

  app.delete("/api/training-history/:id", async (req, res) => {
    try {
      const success = await storage.deleteTrainingHistory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training history record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training history record" });
    }
  });

  // 특정 직원의 모든 교육 이력 삭제
  app.delete("/api/training-history", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const trainings = await storage.getTrainingHistoryByEmployee(employeeId);

      for (const training of trainings) {
        await storage.deleteTrainingHistory(training.id);
      }
      res.json({ success: true, deletedCount: trainings.length });
    } catch (error) {
      console.error('🔍 직원 교육 이력 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete training history" });
    }
  });

  // Projects routes
  app.get("/api/projects", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let projects = employeeId
        ? await storage.getProjectsByEmployee(employeeId)
        : await storage.getAllProjects();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        projects = projects.filter(project => {
          const projectDate = project.startDate;
          if (!projectDate) return false; // 날짜가 없는 프로젝트는 제외

          const date = new Date(projectDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(projects);
    } catch (error) {
      console.error('프로젝트 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = req.body;
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const projectData = req.body;
      const project = await storage.updateProject(req.params.id, projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // 특정 직원의 모든 프로젝트 삭제
  app.delete("/api/projects", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const projects = await storage.getProjectsByEmployee(employeeId);

      for (const project of projects) {
        await storage.deleteProject(project.id);
      }

      res.json({ success: true, deletedCount: projects.length });
    } catch (error) {
      console.error('🔍 직원 프로젝트 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete projects" });
    }
  });

  // Patents routes
  app.get("/api/patents", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let patents = employeeId
        ? await storage.getPatentsByEmployee(employeeId)
        : await storage.getAllPatents();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        patents = patents.filter(patent => {
          const patentDate = patent.applicationDate;
          if (!patentDate) return false; // 날짜가 없는 특허는 제외

          const date = new Date(patentDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(patents);
    } catch (error) {
      console.error('특허 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch patents" });
    }
  });

  app.post("/api/patents", async (req, res) => {
    try {
      const patentData = req.body;
      const patent = await storage.createPatent(patentData);
      res.status(201).json(patent);
    } catch (error) {
      res.status(400).json({ error: "Failed to create patent" });
    }
  });

  app.put("/api/patents/:id", async (req, res) => {
    try {
      const patentData = req.body;
      const patent = await storage.updatePatent(req.params.id, patentData);
      res.json(patent);
    } catch (error) {
      res.status(400).json({ error: "Failed to update patent" });
    }
  });

  app.delete("/api/patents/:id", async (req, res) => {
    try {
      const success = await storage.deletePatent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Patent not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete patent" });
    }
  });

  // 특정 직원의 모든 특허 삭제
  app.delete("/api/patents", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const patents = await storage.getPatentsByEmployee(employeeId);

      for (const patent of patents) {
        await storage.deletePatent(patent.id);
      }

      res.json({ success: true, deletedCount: patents.length });
    } catch (error) {
      console.error('🔍 직원 특허 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete patents" });
    }
  });

  // Publications routes
  app.get("/api/publications", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let publications = employeeId
        ? await storage.getPublicationsByEmployee(employeeId)
        : await storage.getAllPublications();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        publications = publications.filter(publication => {
          const publicationDate = publication.publicationDate;
          if (!publicationDate) return false; // 날짜가 없는 논문은 제외

          const date = new Date(publicationDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(publications);
    } catch (error) {
      console.error('논문 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch publications" });
    }
  });

  app.post("/api/publications", async (req, res) => {
    try {
      const publicationData = req.body;
      const publication = await storage.createPublication(publicationData);
      res.status(201).json(publication);
    } catch (error) {
      res.status(400).json({ error: "Failed to create publication" });
    }
  });

  app.put("/api/publications/:id", async (req, res) => {
    try {
      const publicationData = req.body;
      const publication = await storage.updatePublication(req.params.id, publicationData);
      res.json(publication);
    } catch (error) {
      res.status(400).json({ error: "Failed to update publication" });
    }
  });

  app.delete("/api/publications/:id", async (req, res) => {
    try {
      const success = await storage.deletePublication(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Publication not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete publication" });
    }
  });

  // 특정 직원의 모든 논문 삭제
  app.delete("/api/publications", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const publications = await storage.getPublicationsByEmployee(employeeId);

      for (const publication of publications) {
        await storage.deletePublication(publication.id);
      }

      res.json({ success: true, deletedCount: publications.length });
    } catch (error) {
      console.error('🔍 직원 논문 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete publications" });
    }
  });

  // Awards routes
  app.get("/api/awards", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let awards = employeeId
        ? await storage.getAwardsByEmployee(employeeId)
        : await storage.getAllAwards();

      // 날짜 필터링 적용
      if (startDate || endDate) {
        awards = awards.filter(award => {
          const awardDate = award.awardDate;
          if (!awardDate) return false; // 날짜가 없는 수상은 제외

          const date = new Date(awardDate);
          if (isNaN(date.getTime())) return false; // 유효하지 않은 날짜는 제외

          if (startDate && date < new Date(startDate)) return false;
          if (endDate && date > new Date(endDate)) return false;

          return true;
        });
      }

      res.json(awards);
    } catch (error) {
      console.error('수상 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch awards" });
    }
  });

  app.post("/api/awards", async (req, res) => {
    try {
      const awardData = req.body;
      const award = await storage.createAward(awardData);
      res.status(201).json(award);
    } catch (error) {
      res.status(400).json({ error: "Failed to create award" });
    }
  });

  app.put("/api/awards/:id", async (req, res) => {
    try {
      const awardData = req.body;
      const award = await storage.updateAward(req.params.id, awardData);
      res.json(award);
    } catch (error) {
      res.status(400).json({ error: "Failed to update award" });
    }
  });

  app.delete("/api/awards/:id", async (req, res) => {
    try {
      const success = await storage.deleteAward(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Award not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete award" });
    }
  });

  // 특정 직원의 모든 수상 삭제
  app.delete("/api/awards", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const awards = await storage.getAwardsByEmployee(employeeId);

      for (const award of awards) {
        await storage.deleteAward(award.id);
      }

      res.json({ success: true, deletedCount: awards.length });
    } catch (error) {
      console.error('🔍 직원 수상 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete awards" });
    }
  });

  // R&D Evaluation Criteria Management routes
  app.get('/api/rd-evaluation-criteria', async (req, res) => {
    try {
      const storedCriteria = (await storage.getAppSetting("rdEvaluationCriteria")) || {};
      const storedDetailedCriteria = (await storage.getAppSetting("detailedCriteria")) || {};
      if (Object.keys(storedCriteria).length > 0 || Object.keys(storedDetailedCriteria).length > 0) {
        const criteria = Object.keys(storedDetailedCriteria).length > 0
          ? storedDetailedCriteria
          : {
              global_competency: {
                english: {
                  toeic: { "950-990": 10, "900-949": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
                  toefl: { "113-120": 10, "105-112": 8, "90-104": 6, "70-89": 4, "70미만": 2 },
                  ielts: { "8.5-9.0": 10, "7.5-8.4": 8, "6.5-7.4": 6, "5.5-6.4": 4, "5.5미만": 2 },
                  teps: { "526-600": 10, "453-525": 8, "387-452": 6, "327-386": 4, "327미만": 2 }
                },
                japanese: {
                  jlpt: { "N1": 10, "N2": 7, "N3": 4, "N4": 2, "N5": 1 },
                  jpt: { "900-990": 8, "800-899": 6, "700-799": 4, "700미만": 2 }
                },
                chinese: {
                  hsk: { "6급": 10, "5급": 8, "4급": 6, "3급": 4, "2급": 2, "1급": 1 },
                  tocfl: { "Band C Level 6": 10, "Band C Level 5": 8, "Band B Level 4": 6, "Band B Level 3": 4, "Band A Level 2": 2, "Band A Level 1": 1 }
                }
              }
            };
        const globalCompetency = criteria.global_competency || {};
        const languageTests: any = {};
        if (globalCompetency.english?.toeic) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({ value: 'TOEIC', label: 'TOEIC', hasScore: true, scoreRange: '10-990점', criteria: globalCompetency.english.toeic });
        }
        if (globalCompetency.english?.toefl) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({ value: 'TOEFL', label: 'TOEFL iBT', hasScore: true, scoreRange: '0-120점', criteria: globalCompetency.english.toefl });
        }
        if (globalCompetency.english?.ielts) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({ value: 'IELTS', label: 'IELTS', hasScore: true, scoreRange: '1.0-9.0점', criteria: globalCompetency.english.ielts });
        }
        if (globalCompetency.english?.teps) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({ value: 'TEPS', label: 'TEPS', hasScore: true, scoreRange: '0-600점', criteria: globalCompetency.english.teps });
        }
        if (globalCompetency.japanese?.jlpt) {
          languageTests.Japanese = languageTests.Japanese || { tests: [] };
          languageTests.Japanese.tests.push({ value: 'JLPT', label: 'JLPT', hasLevel: true, levels: ['N1', 'N2', 'N3', 'N4', 'N5'], criteria: globalCompetency.japanese.jlpt });
        }
        if (globalCompetency.japanese?.jpt) {
          languageTests.Japanese = languageTests.Japanese || { tests: [] };
          languageTests.Japanese.tests.push({ value: 'JPT', label: 'JPT', hasScore: true, scoreRange: '10-990점', criteria: globalCompetency.japanese.jpt });
        }
        if (globalCompetency.chinese?.hsk) {
          languageTests.Chinese = languageTests.Chinese || { tests: [] };
          languageTests.Chinese.tests.push({ value: 'HSK', label: 'HSK', hasLevel: true, levels: ['1급', '2급', '3급', '4급', '5급', '6급'], criteria: globalCompetency.chinese.hsk });
        }
        if (globalCompetency.chinese?.tocfl) {
          languageTests.Chinese = languageTests.Chinese || { tests: [] };
          languageTests.Chinese.tests.push({ value: 'TOCFL', label: 'TOCFL', hasLevel: true, levels: ['Band A (Level 1)', 'Band A (Level 2)', 'Band B (Level 3)', 'Band B (Level 4)', 'Band C (Level 5)', 'Band C (Level 6)'], criteria: globalCompetency.chinese.tocfl });
        }
        return res.json({
          success: true,
          rdEvaluationCriteria: storedCriteria,
          detailedCriteria: storedDetailedCriteria,
          criteria,
          languageTests,
        });
      }

      // DB에 저장된 값이 없으면 기본 기준을 사용
      let criteria: any = {};

      if (Object.keys(criteria).length === 0) {
        // 기본 설정 반환
        criteria = {
          global_competency: {
            english: {
              toeic: { "950-990": 10, "900-949": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
              toefl: { "113-120": 10, "105-112": 8, "90-104": 6, "70-89": 4, "70미만": 2 },
              ielts: { "8.5-9.0": 10, "7.5-8.4": 8, "6.5-7.4": 6, "5.5-6.4": 4, "5.5미만": 2 },
              teps: { "526-600": 10, "453-525": 8, "387-452": 6, "327-386": 4, "327미만": 2 }
            },
            japanese: {
              jlpt: { "N1": 10, "N2": 7, "N3": 4, "N4": 2, "N5": 1 },
              jpt: { "900-990": 8, "800-899": 6, "700-799": 4, "700미만": 2 }
            },
            chinese: {
              hsk: { "6급": 10, "5급": 8, "4급": 6, "3급": 4, "2급": 2, "1급": 1 },
              tocfl: { "Band C Level 6": 10, "Band C Level 5": 8, "Band B Level 4": 6, "Band B Level 3": 4, "Band A Level 2": 2, "Band A Level 1": 1 }
            }
          }
        };
      }

      // 글로벌 역량 설정에서 언어 시험 정보 추출
      const globalCompetency = criteria.global_competency || {};
      const languageTests = {};

      // 영어 시험들
      if (globalCompetency.english?.toeic) {
        languageTests.English = languageTests.English || { tests: [] };
        languageTests.English.tests.push({
          value: 'TOEIC',
          label: 'TOEIC',
          hasScore: true,
          scoreRange: '10-990점',
          criteria: globalCompetency.english.toeic
        });
      }

      if (globalCompetency.english?.toefl) {
        languageTests.English = languageTests.English || { tests: [] };
        languageTests.English.tests.push({
          value: 'TOEFL',
          label: 'TOEFL iBT',
          hasScore: true,
          scoreRange: '0-120점',
          criteria: globalCompetency.english.toefl
        });
      }

      if (globalCompetency.english?.ielts) {
        languageTests.English = languageTests.English || { tests: [] };
        languageTests.English.tests.push({
          value: 'IELTS',
          label: 'IELTS',
          hasScore: true,
          scoreRange: '1.0-9.0점',
          criteria: globalCompetency.english.ielts
        });
      }

      if (globalCompetency.english?.teps) {
        languageTests.English = languageTests.English || { tests: [] };
        languageTests.English.tests.push({
          value: 'TEPS',
          label: 'TEPS',
          hasScore: true,
          scoreRange: '0-600점',
          criteria: globalCompetency.english.teps
        });
      }

      // 일본어 시험들
      if (globalCompetency.japanese?.jlpt) {
        languageTests.Japanese = languageTests.Japanese || { tests: [] };
        languageTests.Japanese.tests.push({
          value: 'JLPT',
          label: 'JLPT',
          hasLevel: true,
          levels: ['N1', 'N2', 'N3', 'N4', 'N5'],
          criteria: globalCompetency.japanese.jlpt
        });
      }

      if (globalCompetency.japanese?.jpt) {
        languageTests.Japanese = languageTests.Japanese || { tests: [] };
        languageTests.Japanese.tests.push({
          value: 'JPT',
          label: 'JPT',
          hasScore: true,
          scoreRange: '10-990점',
          criteria: globalCompetency.japanese.jpt
        });
      }

      // 중국어 시험들
      if (globalCompetency.chinese?.hsk) {
        languageTests.Chinese = languageTests.Chinese || { tests: [] };
        languageTests.Chinese.tests.push({
          value: 'HSK',
          label: 'HSK',
          hasLevel: true,
          levels: ['1급', '2급', '3급', '4급', '5급', '6급'],
          criteria: globalCompetency.chinese.hsk
        });
      }

      if (globalCompetency.chinese?.tocfl) {
        languageTests.Chinese = languageTests.Chinese || { tests: [] };
        languageTests.Chinese.tests.push({
          value: 'TOCFL',
          label: 'TOCFL',
          hasLevel: true,
          levels: ['Band A (Level 1)', 'Band A (Level 2)', 'Band B (Level 3)', 'Band B (Level 4)', 'Band C (Level 5)', 'Band C (Level 6)'],
          criteria: globalCompetency.chinese.tocfl
        });
      }


      res.json({
        success: true,
        rdEvaluationCriteria: {},
        detailedCriteria: {},
        criteria: criteria,
        languageTests: languageTests
      });

    } catch (error) {
      console.error('R&D 역량평가 기준 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '기준 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  });

  app.post('/api/rd-evaluation-criteria', async (req, res) => {
    try {
      const { criteria, updateEmployeeForms } = req.body;


      await storage.setAppSetting("rdEvaluationCriteria", criteria);

      // 2. 직원 정보 입력 폼 업데이트가 요청된 경우
      if (updateEmployeeForms) {

        // 글로벌 역량 설정에서 언어 시험 정보 추출
        const globalCompetency = criteria.global_competency || {};
        const languageTests = {};

        // 영어 시험들
        if (globalCompetency.english_toeic) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({
            value: 'TOEIC',
            label: 'TOEIC',
            hasScore: true,
            scoreRange: '10-990점',
            criteria: globalCompetency.english_toeic
          });
        }

        if (globalCompetency.english_toefl) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({
            value: 'TOEFL',
            label: 'TOEFL iBT',
            hasScore: true,
            scoreRange: '0-120점',
            criteria: globalCompetency.english_toefl
          });
        }

        if (globalCompetency.english_ielts) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({
            value: 'IELTS',
            label: 'IELTS',
            hasScore: true,
            scoreRange: '1.0-9.0점',
            criteria: globalCompetency.english_ielts
          });
        }

        if (globalCompetency.english_teps) {
          languageTests.English = languageTests.English || { tests: [] };
          languageTests.English.tests.push({
            value: 'TEPS',
            label: 'TEPS',
            hasScore: true,
            scoreRange: '0-600점',
            criteria: globalCompetency.english_teps
          });
        }

        // 일본어 시험들
        if (globalCompetency.japanese_jlpt) {
          languageTests.Japanese = languageTests.Japanese || { tests: [] };
          languageTests.Japanese.tests.push({
            value: 'JLPT',
            label: 'JLPT',
            hasLevel: true,
            levels: ['N1', 'N2', 'N3', 'N4', 'N5'],
            criteria: globalCompetency.japanese_jlpt
          });
        }

        if (globalCompetency.japanese_jpt) {
          languageTests.Japanese = languageTests.Japanese || { tests: [] };
          languageTests.Japanese.tests.push({
            value: 'JPT',
            label: 'JPT',
            hasScore: true,
            scoreRange: '10-990점',
            criteria: globalCompetency.japanese_jpt
          });
        }

        // 중국어 시험들
        if (globalCompetency.chinese_hsk) {
          languageTests.Chinese = languageTests.Chinese || { tests: [] };
          languageTests.Chinese.tests.push({
            value: 'HSK',
            label: 'HSK',
            hasLevel: true,
            levels: ['1급', '2급', '3급', '4급', '5급', '6급'],
            criteria: globalCompetency.chinese_hsk
          });
        }

        if (globalCompetency.chinese_tocfl) {
          languageTests.Chinese = languageTests.Chinese || { tests: [] };
          languageTests.Chinese.tests.push({
            value: 'TOCFL',
            label: 'TOCFL',
            hasLevel: true,
            levels: ['Band A (Level 1)', 'Band A (Level 2)', 'Band B (Level 3)', 'Band B (Level 4)', 'Band C (Level 5)', 'Band C (Level 6)'],
            criteria: globalCompetency.chinese_tocfl
          });
        }


        // TODO: 이 설정을 클라이언트의 언어 입력 폼에 반영
        // 방법 1: 클라이언트에서 이 API를 호출하여 설정을 가져오도록 함
        // 방법 2: WebSocket을 통해 실시간으로 클라이언트에 전달
        // 방법 3: 설정을 파일로 저장하고 클라이언트가 주기적으로 확인

        res.json({
          success: true,
          message: 'R&D 역량평가 기준이 저장되고 직원 정보 입력 폼이 업데이트되었습니다.',
          languageTests: languageTests
        });
      } else {
        res.json({
          success: true,
          message: 'R&D 역량평가 기준이 저장되었습니다.'
        });
      }

    } catch (error) {
      console.error('R&D 역량평가 기준 저장 오류:', error);
      res.status(500).json({
        success: false,
        message: '저장 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  });

  // Departments and Teams routes
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      return res.json(departments);
    } catch (error) {
      console.error("부서 조회 오류:", error);
      res.status(500).json({ error: "부서를 불러올 수 없습니다." });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const { code, name } = req.body;
      const departments = await storage.getDepartments();
      if (departments.find((department) => department.code === code)) {
        return res.status(400).json({ error: "이미 존재하는 부서코드입니다." });
      }
      const department = await storage.createDepartment({ code, name });
      return res.json({ success: true, data: department });
    } catch (error) {
      console.error("부서 추가 오류:", error);
      res.status(500).json({ error: "부서를 추가할 수 없습니다." });
    }
  });

  app.put("/api/departments/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const { name } = req.body;
      const department = await storage.updateDepartment(code, { name });
      return res.json({ success: true, data: department });
    } catch (error) {
      console.error("부서 수정 오류:", error);
      res.status(500).json({ error: "부서를 수정할 수 없습니다." });
    }
  });

  app.delete("/api/departments/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const success = await storage.deleteDepartment(code);
      if (!success) {
        return res.status(404).json({ error: "부서를 찾을 수 없습니다." });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("부서 삭제 오류:", error);
      res.status(500).json({ error: "부서를 삭제할 수 없습니다." });
    }
  });

  app.get("/api/teams", async (req, res) => {
    try {
      const { departmentCode } = req.query;
      const teams = await storage.getTeams(typeof departmentCode === "string" ? departmentCode : undefined);
      return res.json(teams);
    } catch (error) {
      console.error("팀 조회 오류:", error);
      res.status(500).json({ error: "팀을 불러올 수 없습니다." });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const { code, name, departmentCode } = req.body;
      const teams = await storage.getTeams();
      if (teams.find((team) => team.code === code)) {
        return res.status(400).json({ error: "이미 존재하는 팀코드입니다." });
      }
      const team = await storage.createTeam({ code, name, departmentCode });
      return res.json({ success: true, data: team });
    } catch (error) {
      console.error("팀 추가 오류:", error);
      res.status(500).json({ error: "팀을 추가할 수 없습니다." });
    }
  });

  app.put("/api/teams/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const { name, departmentCode } = req.body;
      const team = await storage.updateTeam(code, { name, departmentCode });
      return res.json({ success: true, data: team });
    } catch (error) {
      console.error("팀 수정 오류:", error);
      res.status(500).json({ error: "팀을 수정할 수 없습니다." });
    }
  });

  app.delete("/api/teams/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const success = await storage.deleteTeam(code);
      if (!success) {
        return res.status(404).json({ error: "팀을 찾을 수 없습니다." });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("팀 삭제 오류:", error);
      res.status(500).json({ error: "팀을 삭제할 수 없습니다." });
    }
  });

  app.get("/api/team-competency/reports", async (req, res) => {
    try {
      const { teamCode, year } = req.query;
      const values: any[] = [];
      const where: string[] = [];

      if (typeof teamCode === "string" && teamCode.trim()) {
        values.push(teamCode.trim());
        where.push(`team_code = $${values.length}`);
      }

      if (typeof year === "string" && year.trim()) {
        values.push(Number(year));
        where.push(`evaluation_year = $${values.length}`);
      }

      const result = await pool.query(
        `
          SELECT r.*,
            (SELECT COUNT(*)::int FROM team_role_assignments a WHERE a.report_id = r.id) AS assignment_count,
            (SELECT COUNT(*)::int FROM team_work_categories c WHERE c.report_id = r.id) AS work_category_count,
            (SELECT COUNT(*)::int FROM team_competency_requirements q WHERE q.report_id = r.id) AS requirement_count,
            (SELECT COUNT(*)::int FROM team_required_qualifications qf WHERE qf.report_id = r.id) AS qualification_count
          FROM team_competency_reports r
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY evaluation_year DESC, team_name ASC
        `,
        values,
      );

      return res.json(
        result.rows.map((row) => ({
          ...rowTeamCompetencyReport(row),
          assignmentCount: row.assignment_count,
          workCategoryCount: row.work_category_count,
          requirementCount: row.requirement_count,
          qualificationCount: row.qualification_count,
        })),
      );
    } catch (error) {
      console.error("팀 적격성 보고서 목록 오류:", error);
      res.status(500).json({ error: "팀 적격성 보고서를 불러올 수 없습니다." });
    }
  });

  app.post("/api/team-competency/reports/ensure", async (req, res) => {
    try {
      const teamCode = toNullableString(req.body.teamCode);
      const teamName = toNullableString(req.body.teamName);
      const evaluationYear = toIntegerOrDefault(req.body.evaluationYear, new Date().getFullYear());

      if (!teamCode || !teamName) {
        return res.status(400).json({ error: "팀 코드와 팀명이 필요합니다." });
      }

      const result = await pool.query(
        `
          INSERT INTO team_competency_reports (team_code, team_name, evaluation_year, revision, status)
          VALUES ($1, $2, $3, $4, 'draft')
          ON CONFLICT (team_code, evaluation_year)
          DO UPDATE SET team_name = EXCLUDED.team_name, updated_at = NOW()
          RETURNING *
        `,
        [teamCode, teamName, evaluationYear, toNullableString(req.body.revision) ?? "Rev.00"],
      );

      const report = rowTeamCompetencyReport(result.rows[0]);
      const assignmentCount = await pool.query(
        "SELECT COUNT(*)::int AS count FROM team_role_assignments WHERE report_id = $1",
        [report.id],
      );

      if (assignmentCount.rows[0]?.count === 0) {
        const members = await pool.query(
          `SELECT id, name, position
           FROM employees
           WHERE is_active IS DISTINCT FROM FALSE
             AND (team_code = $1 OR team = $2)
           ORDER BY name`,
          [teamCode, teamName],
        );

        for (let index = 0; index < members.rows.length; index += 1) {
          const member = members.rows[index];
          await pool.query(
            `
              INSERT INTO team_role_assignments
                (report_id, role_group, employee_id, employee_name, position_title, responsibilities, display_order)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [report.id, teamName, member.id, member.name, member.position, "", index],
          );
        }
      }

      return res.status(201).json(await loadTeamCompetencyDetail(report.id));
    } catch (error) {
      console.error("팀 적격성 보고서 생성 오류:", error);
      res.status(500).json({ error: "팀 적격성 보고서를 만들 수 없습니다." });
    }
  });

  app.get("/api/team-competency/reports/:id", async (req, res) => {
    try {
      const detail = await loadTeamCompetencyDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: "팀 적격성 보고서를 찾을 수 없습니다." });
      }
      return res.json(detail);
    } catch (error) {
      console.error("팀 적격성 보고서 상세 오류:", error);
      res.status(500).json({ error: "팀 적격성 보고서를 불러올 수 없습니다." });
    }
  });

  app.put("/api/team-competency/reports/:id", async (req, res) => {
    const client = await pool.connect();
    try {
      const reportId = req.params.id;
      const report = req.body.report ?? {};
      const assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];
      const workCategories = Array.isArray(req.body.workCategories) ? req.body.workCategories : [];
      const requirements = Array.isArray(req.body.requirements) ? req.body.requirements : [];
      const qualifications = Array.isArray(req.body.qualifications) ? req.body.qualifications : [];

      await client.query("BEGIN");

      const reportResult = await client.query(
        `
          UPDATE team_competency_reports
          SET revision = COALESCE($2, revision),
              role_summary = $3,
              prepared_by = $4,
              checked_by = $5,
              approved_by = $6,
              status = COALESCE($7, status),
              notes = $8,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          reportId,
          toNullableString(report.revision),
          toNullableString(report.roleSummary),
          toNullableString(report.preparedBy),
          toNullableString(report.checkedBy),
          toNullableString(report.approvedBy),
          toNullableString(report.status),
          toNullableString(report.notes),
        ],
      );

      if (!reportResult.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "팀 적격성 보고서를 찾을 수 없습니다." });
      }

      await client.query(
        `
          DELETE FROM team_competency_scores
          WHERE requirement_id IN (
            SELECT id FROM team_competency_requirements WHERE report_id = $1
          )
        `,
        [reportId],
      );
      await client.query("DELETE FROM team_competency_requirements WHERE report_id = $1", [reportId]);
      await client.query("DELETE FROM team_work_categories WHERE report_id = $1", [reportId]);
      await client.query("DELETE FROM team_role_assignments WHERE report_id = $1", [reportId]);
      await client.query("DELETE FROM team_required_qualifications WHERE report_id = $1", [reportId]);

      for (let index = 0; index < assignments.length; index += 1) {
        const row = assignments[index] ?? {};
        await client.query(
          `
            INSERT INTO team_role_assignments
              (report_id, role_group, employee_id, employee_name, position_title, responsibilities, deputy_employee_id, deputy_name, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            reportId,
            toNullableString(row.roleGroup),
            toNullableString(row.employeeId),
            toNullableString(row.employeeName),
            toNullableString(row.positionTitle),
            toNullableString(row.responsibilities),
            toNullableString(row.deputyEmployeeId),
            toNullableString(row.deputyName),
            toIntegerOrDefault(row.displayOrder, index),
          ],
        );
      }

      for (let index = 0; index < workCategories.length; index += 1) {
        const row = workCategories[index] ?? {};
        await client.query(
          `
            INSERT INTO team_work_categories
              (report_id, category_no, category_name, major_functions, control_items, special_notes, related_docs, cooperating_team, cooperating_work, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            reportId,
            toNullableString(row.categoryNo),
            toNullableString(row.categoryName) ?? "업무분류",
            toNullableString(row.majorFunctions),
            toNullableString(row.controlItems),
            toNullableString(row.specialNotes),
            toNullableString(row.relatedDocs),
            toNullableString(row.cooperatingTeam),
            toNullableString(row.cooperatingWork),
            toIntegerOrDefault(row.displayOrder, index),
          ],
        );
      }

      for (let index = 0; index < requirements.length; index += 1) {
        const row = requirements[index] ?? {};
        const requirementResult = await client.query(
          `
            INSERT INTO team_competency_requirements
              (report_id, major_no, major_name, sub_no, sub_name, required_major, required_certification,
               min_knowledge, proficiency_period, required_training, language_requirement,
               dept_head_level, manager_level, staff_level, minimum_level, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
          `,
          [
            reportId,
            toNullableString(row.majorNo),
            toNullableString(row.majorName),
            toNullableString(row.subNo),
            toNullableString(row.subName) ?? "미지정 업무",
            toNullableString(row.requiredMajor),
            toNullableString(row.requiredCertification),
            toNullableString(row.minKnowledge),
            toNullableString(row.proficiencyPeriod),
            toNullableString(row.requiredTraining),
            toNullableString(row.languageRequirement),
            toNullableString(row.deptHeadLevel),
            toNullableString(row.managerLevel),
            toNullableString(row.staffLevel),
            toNullableString(row.minimumLevel),
            toIntegerOrDefault(row.displayOrder, index),
          ],
        );

        const requirementId = requirementResult.rows[0].id;
        const scores = Array.isArray(row.scores) ? row.scores : [];
        for (const scoreRow of scores) {
          await client.query(
            `
              INSERT INTO team_competency_scores
                (requirement_id, employee_id, employee_name, score, notes)
              VALUES ($1, $2, $3, $4, $5)
            `,
            [
              requirementId,
              toNullableString(scoreRow.employeeId),
              toNullableString(scoreRow.employeeName),
              toNullableNumber(scoreRow.score),
              toNullableString(scoreRow.notes),
            ],
          );
        }
      }

      for (let index = 0; index < qualifications.length; index += 1) {
        const row = qualifications[index] ?? {};
        await client.query(
          `
            INSERT INTO team_required_qualifications
              (report_id, item_no, requirement_item, requirement_name, required_grade,
               holder_summary, held_qualification, plan, remarks, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            reportId,
            toNullableString(row.itemNo),
            toNullableString(row.requirementItem) ?? "요구자격",
            toNullableString(row.requirementName),
            toNullableString(row.requiredGrade),
            toNullableString(row.holderSummary),
            toNullableString(row.heldQualification),
            toNullableString(row.plan),
            toNullableString(row.remarks),
            toIntegerOrDefault(row.displayOrder, index),
          ],
        );
      }

      await client.query("COMMIT");
      return res.json(await loadTeamCompetencyDetail(reportId));
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("팀 적격성 보고서 저장 오류:", error);
      res.status(500).json({ error: "팀 적격성 보고서를 저장할 수 없습니다." });
    } finally {
      client.release();
    }
  });

  // Proposals routes
  app.get("/api/proposals", async (req, res) => {
    try {
      const { employeeId, startDate, endDate } = req.query;
      const proposals = await storage.getProposals({
        employeeId: typeof employeeId === "string" ? employeeId : undefined,
        startDate: typeof startDate === "string" ? startDate : undefined,
        endDate: typeof endDate === "string" ? endDate : undefined,
      });
      console.log('✅ 제안제도 데이터 로드 완료:', proposals.length, '개');
      return res.json(proposals);
    } catch (error) {
      console.error("제안제도 조회 오류:", error);
      res.status(500).json({ error: "제안제도를 불러올 수 없습니다." });
    }
  });

  app.post("/api/proposals", async (req, res) => {
    try {
      const proposalData = req.body;
      console.log('🔧 제안제도 저장 요청:', JSON.stringify(proposalData, null, 2));
      console.log('🔧 요청 헤더:', req.headers);
      console.log('🔧 Content-Type:', req.headers['content-type']);
      const newId = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newProposal = {
        id: newId,
        ...proposalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await storage.createProposal(newProposal as any);
      console.log('✅ 제안제도 저장 완료:', newId);
      console.log('✅ 저장된 제안제도 데이터:', JSON.stringify(newProposal, null, 2));
      return res.json({ success: true, id: newId, data: newProposal });
    } catch (error) {
      console.error("❌ 제안제도 저장 오류:", error);
      console.error("❌ 오류 스택:", error.stack);
      console.error("❌ 오류 메시지:", error.message);
      res.status(500).json({
        error: "제안제도를 저장할 수 없습니다.",
        details: error.message
      });
    }
  });

  // 제안제도 삭제 API (특정 직원의 모든 제안 삭제)
  app.delete("/api/proposals", async (req, res) => {
    try {
      const { employeeId } = req.query;

      if (!employeeId || typeof employeeId !== "string") {
        return res.status(400).json({ error: "employeeId is required" });
      }
      const deletedCount = await storage.deleteProposalsByEmployee(employeeId);
      console.log(`✅ ${employeeId} 직원의 제안제도 ${deletedCount}개 삭제 완료`);
      return res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("❌ 제안제도 삭제 오류:", error);
      res.status(500).json({ error: "제안제도를 삭제할 수 없습니다." });
    }
  });

  // Skill Calculation routes
  app.get("/api/skill-calculations", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      if (employeeId) {
        const calculation = await storage.getSkillCalculation(employeeId);
        res.json(calculation);
      } else {
        const calculations = await storage.getAllSkillCalculations();
        res.json(calculations);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skill calculations" });
    }
  });

  app.post("/api/skill-calculations", async (req, res) => {
    try {
      const calculationData = insertSkillCalculationSchema.parse(req.body);
      const calculation = await storage.createOrUpdateSkillCalculation(calculationData);
      res.json(calculation);
    } catch (error) {
      res.status(400).json({ error: "Invalid skill calculation data" });
    }
  });

  // Dashboard and analytics routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      const trainings = await storage.getAllTrainingHistory();
      const certifications = await storage.getAllCertifications();
      const skillCalculations = await storage.getAllSkillCalculations();

      // 비활성 직원 제외
      const activeEmployees = employees.filter(emp => emp.isActive !== false);
      const totalEmployees = activeEmployees.length;
      const completedTrainings = trainings.filter(t => t.status === 'completed').length;
      const totalTrainings = trainings.length;
      const completionRate = totalTrainings > 0 ? (completedTrainings / totalTrainings) * 100 : 0;

      const thisMonthTrainingHours = trainings
        .filter(t => t.completionDate && t.completionDate.getMonth() === new Date().getMonth())
        .reduce((sum, t) => sum + (t.duration || 0), 0);

      const certifiedEmployees = new Set(certifications.map(c => c.employeeId)).size;

      res.json({
        totalEmployees,
        completionRate: Math.round(completionRate * 10) / 10,
        trainingHours: thisMonthTrainingHours,
        certifiedEmployees
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/top-performers", async (req, res) => {
    try {
      const skillCalculations = await storage.getAllSkillCalculations();
      const employees = await storage.getAllEmployees();

      // 비활성 직원 제외
      const activeEmployees = employees.filter(emp => emp.isActive !== false);

      const topPerformers = skillCalculations
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 10)
        .map(calc => {
          const employee = activeEmployees.find(emp => emp.id === calc.employeeId);
          return {
            id: calc.employeeId,
            name: employee?.name || 'Unknown',
            department: employee?.department || 'Unknown',
            score: Math.round(calc.overallScore * 10) / 10
          };
        });

      res.json(topPerformers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top performers" });
    }
  });

  app.get("/api/dashboard/department-skills", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      const skillCalculations = await storage.getAllSkillCalculations();

      // 비활성 직원 제외
      const activeEmployees = employees.filter(emp => emp.isActive !== false);

      const departmentStats = activeEmployees.reduce((acc, emp) => {
        if (!acc[emp.department]) {
          acc[emp.department] = { employees: [], calculations: [] };
        }
        acc[emp.department].employees.push(emp);

        const calc = skillCalculations.find(sc => sc.employeeId === emp.id);
        if (calc) {
          acc[emp.department].calculations.push(calc);
        }

        return acc;
      }, {} as Record<string, { employees: any[], calculations: any[] }>);

      const result = Object.entries(departmentStats).map(([department, data]) => {
        const avgOverallScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.overallScore, 0) / data.calculations.length
          : 0;

        const avgExperienceScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.experienceScore, 0) / data.calculations.length
          : 0;

        const avgCertificationScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.certificationScore, 0) / data.calculations.length
          : 0;

        const avgLanguageScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.languageScore, 0) / data.calculations.length
          : 0;

        const avgTrainingScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.trainingScore, 0) / data.calculations.length
          : 0;

        const avgTechnicalScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.technicalScore, 0) / data.calculations.length
          : 0;

        const avgSoftSkillScore = data.calculations.length > 0
          ? data.calculations.reduce((sum, calc) => sum + calc.softSkillScore, 0) / data.calculations.length
          : 0;

        return {
          department,
          employeeCount: data.employees.length,
          averageSkills: {
            overall: Math.round(avgOverallScore * 10) / 10,
            experience: Math.round(avgExperienceScore * 10) / 10,
            certification: Math.round(avgCertificationScore * 10) / 10,
            language: Math.round(avgLanguageScore * 10) / 10,
            training: Math.round(avgTrainingScore * 10) / 10,
            technical: Math.round(avgTechnicalScore * 10) / 10,
            softSkill: Math.round(avgSoftSkillScore * 10) / 10
          }
        };
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department skills" });
    }
  });

  app.get("/api/dashboard/department-ratios", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();

      // 비활성 직원 제외
      const activeEmployees = employees.filter(emp => emp.isActive !== false);
      const totalEmployees = activeEmployees.length;

      const departmentCounts = activeEmployees.reduce((acc, emp) => {
        acc[emp.department] = (acc[emp.department] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const departmentRatios = Object.entries(departmentCounts).map(([department, count]) => ({
        department,
        count,
        percentage: Math.round((count / totalEmployees) * 100 * 10) / 10
      }));

      res.json({
        totalEmployees,
        departments: departmentRatios
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department ratios" });
    }
  });

  // 부서/팀 관리는 클라이언트 사이드에서 로컬 스토리지로 처리

  // Mock 데이터 초기화 API
  app.post("/api/init-mock-data", async (req, res) => {
    try {
      const { employeeId } = req.body;

      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      // Mock 스킬 데이터
      const mockSkills = [
        { skillType: "technical", skillName: "JavaScript", proficiencyLevel: 85, yearsOfExperience: 3, category: "프론트엔드" },
        { skillType: "technical", skillName: "React", proficiencyLevel: 90, yearsOfExperience: 2, category: "프론트엔드" },
        { skillType: "technical", skillName: "Node.js", proficiencyLevel: 75, yearsOfExperience: 2, category: "백엔드" },
        { skillType: "technical", skillName: "TypeScript", proficiencyLevel: 80, yearsOfExperience: 1, category: "프론트엔드" },
        { skillType: "technical", skillName: "Python", proficiencyLevel: 65, yearsOfExperience: 1, category: "백엔드" },
        { skillType: "technical", skillName: "SQL", proficiencyLevel: 70, yearsOfExperience: 2, category: "데이터베이스" }
      ];

      // Mock 교육 데이터
      const mockTrainings = [
        { courseName: "React 고급 패턴", provider: "온라인", type: "optional", status: "completed", score: 95, completionDate: "2024-01-15" },
        { courseName: "TypeScript 마스터", provider: "온라인", type: "optional", status: "completed", score: 88, completionDate: "2024-02-20" },
        { courseName: "Node.js 심화", provider: "온라인", type: "optional", status: "ongoing", startDate: "2024-03-10" },
        { courseName: "AWS 클라우드", provider: "온라인", type: "optional", status: "planned", startDate: "2024-04-05" }
      ];

      // Mock 프로젝트 데이터
      const mockProjects = [
        { projectName: "EchoTune 시스템 개발", role: "프론트엔드 리드", status: "completed", startDate: "2024-01-01", endDate: "2024-03-31" },
        { projectName: "사용자 대시보드 개선", role: "개발자", status: "active", startDate: "2024-03-01" }
      ];

      // Mock 특허 데이터
      const mockPatents = [
        { title: "AI 기반 음성 인식 시스템", status: "pending", applicationDate: "2024-01-15", applicationNumber: "10-2024-0001234" },
        { title: "실시간 데이터 처리 방법", status: "granted", applicationDate: "2023-06-20", grantDate: "2024-02-10", patentNumber: "10-2024-0012345" }
      ];

      // Mock 논문 데이터
      const mockPublications = [
        { title: "Deep Learning을 활용한 음성 인식 정확도 향상", authors: "김철수, 박영희", journal: "한국정보과학회논문지", type: "journal", publicationDate: "2024-03-15" },
        { title: "Real-time Data Processing in IoT Environments", authors: "Kim, C.S., Park, Y.H.", conference: "IEEE International Conference", type: "conference", publicationDate: "2024-01-20" }
      ];

      // Mock 수상 데이터
      const mockAwards = [
        { name: "우수 개발자상", issuer: "회사", awardDate: "2024-01-15", category: "performance", level: "company" },
        { name: "혁신 아이디어상", issuer: "부서", awardDate: "2024-02-20", category: "innovation", level: "department" }
      ];

      // 데이터베이스에 저장
      const results = {
        skills: [],
        trainings: [],
        projects: [],
        patents: [],
        publications: [],
        awards: []
      };

      // 스킬 데이터 저장
      for (const skill of mockSkills) {
        const skillData = { ...skill, employeeId };
        const savedSkill = await storage.createSkill(skillData);
        results.skills.push(savedSkill);
      }

      // 교육 데이터 저장
      for (const training of mockTrainings) {
        const trainingData = { ...training, employeeId };
        const savedTraining = await storage.createTrainingHistory(trainingData);
        results.trainings.push(savedTraining);
      }

      // 프로젝트 데이터 저장
      for (const project of mockProjects) {
        const projectData = { ...project, employeeId };
        const savedProject = await storage.createProject(projectData);
        results.projects.push(savedProject);
      }

      // 특허 데이터 저장
      for (const patent of mockPatents) {
        const patentData = { ...patent, employeeId };
        const savedPatent = await storage.createPatent(patentData);
        results.patents.push(savedPatent);
      }

      // 논문 데이터 저장
      for (const publication of mockPublications) {
        const publicationData = { ...publication, employeeId };
        const savedPublication = await storage.createPublication(publicationData);
        results.publications.push(savedPublication);
      }

      // 수상 데이터 저장
      for (const award of mockAwards) {
        const awardData = { ...award, employeeId };
        const savedAward = await storage.createAward(awardData);
        results.awards.push(savedAward);
      }

      res.json({
        success: true,
        message: "Mock data initialized successfully",
        data: results
      });

    } catch (error) {
      console.error("Error initializing mock data:", error);
      res.status(500).json({ error: "Failed to initialize mock data" });
    }
  });


  // 어학능력 API
  app.get("/api/language-skills", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      console.log('🔍 어학능력 조회 API 호출:', { employeeId });
      const languages = employeeId
        ? await storage.getLanguagesByEmployee(employeeId)
        : await storage.getAllLanguages();
      console.log('🔍 어학능력 조회 결과:', languages);
      res.json(languages);
    } catch (error) {
      console.error('🔍 어학능력 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch language skills" });
    }
  });

  app.post("/api/language-skills", async (req, res) => {
    try {
      console.log('🔍 어학능력 생성 API 호출:', req.body);
      const language = await storage.createLanguage(req.body);
      console.log('🔍 어학능력 생성 성공:', language);
      res.status(201).json(language);
    } catch (error) {
      console.error('🔍 어학능력 생성 오류:', error);
      res.status(500).json({ error: "Failed to create language skill" });
    }
  });

  app.put("/api/language-skills/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🔍 어학능력 수정 API 호출:', { id, body: req.body });
      const language = await storage.updateLanguage(id, req.body);
      console.log('🔍 어학능력 수정 성공:', language);
      res.json(language);
    } catch (error) {
      console.error('🔍 어학능력 수정 오류:', error);
      res.status(500).json({ error: "Failed to update language skill" });
    }
  });

  app.delete("/api/language-skills/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🔍 어학능력 삭제 API 호출:', { id });
      await storage.deleteLanguage(id);
      console.log('🔍 어학능력 삭제 성공');
      res.status(204).send();
    } catch (error) {
      console.error('🔍 어학능력 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete language skill" });
    }
  });

  app.delete("/api/language-skills", async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      console.log('🔍 어학능력 전체 삭제 API 호출:', { employeeId });
      await storage.deleteLanguagesByEmployee(employeeId);
      console.log('🔍 어학능력 전체 삭제 성공');
      res.status(204).send();
    } catch (error) {
      console.error('🔍 어학능력 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete language skills" });
    }
  });

  // 자격증 현황 분석 API
  app.get("/api/reports/certifications", async (req, res) => {
    try {
      console.log('🔍 자격증 현황 분석 API 호출');
      const allCertifications = await storage.getAllCertifications();
      console.log('🔍 전체 자격증 데이터:', allCertifications.length);

      // 자격증별 보유 현황 계산
      const certificationStats = new Map<string, { name: string; count: number; percentage: number }>();
      const allEmployees = await storage.getAllEmployees();
      const activeEmployees = allEmployees.filter(emp => emp.isActive !== false);
      const totalEmployees = activeEmployees.length;

      allCertifications.forEach(cert => {
        const key = cert.name;
        if (certificationStats.has(key)) {
          certificationStats.get(key)!.count++;
        } else {
          certificationStats.set(key, { name: key, count: 1, percentage: 0 });
        }
      });

      // 백분율 계산
      certificationStats.forEach((stat, key) => {
        stat.percentage = totalEmployees > 0 ? (stat.count / totalEmployees) * 100 : 0;
      });

      const result = Array.from(certificationStats.values()).sort((a, b) => b.count - a.count);
      console.log('🔍 자격증 현황 분석 결과:', result);
      res.json(result);
    } catch (error) {
      console.error('🔍 자격증 현황 분석 오류:', error);
      res.status(500).json({ error: "Failed to analyze certifications" });
    }
  });

  // 어학능력 현황 분석 API
  app.get("/api/reports/language-skills", async (req, res) => {
    try {
      console.log('🔍 어학능력 현황 분석 API 호출');
      const allLanguages = await storage.getAllLanguages();
      console.log('🔍 전체 어학능력 데이터:', allLanguages.length);

      // 언어별 수준 분포 계산
      const languageStats = new Map<string, { language: string; levels: { [key: string]: number } }>();

      allLanguages.forEach(lang => {
        const key = lang.language;
        if (!languageStats.has(key)) {
          languageStats.set(key, { language: key, levels: {} });
        }
        const level = lang.proficiencyLevel || 'unknown';
        languageStats.get(key)!.levels[level] = (languageStats.get(key)!.levels[level] || 0) + 1;
      });

      const result = Array.from(languageStats.values()).map(stat => ({
        language: stat.language,
        total: Object.values(stat.levels).reduce((sum, count) => sum + count, 0),
        levels: stat.levels
      }));

      console.log('🔍 어학능력 현황 분석 결과:', result);
      res.json(result);
    } catch (error) {
      console.error('🔍 어학능력 현황 분석 오류:', error);
      res.status(500).json({ error: "Failed to analyze language skills" });
    }
  });

  // ===== 교육 시간 분석 API =====

  // 교육 시간 데이터 CRUD
  app.get("/api/training-hours", async (req, res) => {
    try {
      const { startYear, endYear } = req.query;
      let trainingHours;

      console.log(`🔍 교육시간 데이터 조회: ${startYear}-${endYear}`);

      if (startYear && endYear) {
        trainingHours = await storage.getTrainingHoursByYearRange(
          parseInt(startYear as string),
          parseInt(endYear as string)
        );
        console.log(`🔍 ${startYear}-${endYear}년 교육시간 데이터:`, trainingHours);
      } else {
        trainingHours = await storage.getAllTrainingHours();
        console.log(`🔍 전체 교육시간 데이터:`, trainingHours);
      }

      res.json(trainingHours);
    } catch (error) {
      console.error('교육 시간 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch training hours" });
    }
  });

  app.post("/api/training-hours", async (req, res) => {
    try {
      const trainingHours = await storage.createTrainingHours(req.body);
      res.status(201).json(trainingHours);
    } catch (error) {
      console.error('교육 시간 생성 오류:', error);
      res.status(500).json({ error: "Failed to create training hours" });
    }
  });

  app.put("/api/training-hours/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const trainingHours = await storage.updateTrainingHours(id, req.body);
      res.json(trainingHours);
    } catch (error) {
      console.error('교육 시간 수정 오류:', error);
      res.status(500).json({ error: "Failed to update training hours" });
    }
  });

  app.delete("/api/training-hours/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTrainingHours(id);
      res.status(204).send();
    } catch (error) {
      console.error('교육 시간 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete training hours" });
    }
  });

  // 팀 인원 데이터 CRUD
  app.get("/api/team-employees", async (req, res) => {
    try {
      const { startYear, endYear } = req.query;
      let teamEmployees;

      if (startYear && endYear) {
        teamEmployees = await storage.getTeamEmployeesByYearRange(
          parseInt(startYear as string),
          parseInt(endYear as string)
        );
      } else {
        teamEmployees = await storage.getAllTeamEmployees();
      }

      res.json(teamEmployees);
    } catch (error) {
      console.error('팀 인원 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch team employees" });
    }
  });

  app.post("/api/team-employees", async (req, res) => {
    try {
      const teamEmployees = await storage.createTeamEmployees(req.body);
      res.status(201).json(teamEmployees);
    } catch (error) {
      console.error('팀 인원 생성 오류:', error);
      res.status(500).json({ error: "Failed to create team employees" });
    }
  });

  app.put("/api/team-employees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const teamEmployees = await storage.updateTeamEmployees(id, req.body);
      res.json(teamEmployees);
    } catch (error) {
      console.error('팀 인원 수정 오류:', error);
      res.status(500).json({ error: "Failed to update team employees" });
    }
  });

  app.delete("/api/team-employees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTeamEmployees(id);
      res.status(204).send();
    } catch (error) {
      console.error('팀 인원 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete team employees" });
    }
  });

  // 팀 인원 전체 삭제
  app.delete("/api/team-employees", async (req, res) => {
    try {
      const { deleteAll } = req.query;
      console.log(`🗑️ 팀 인원 전체 삭제 요청: ${deleteAll}`);

      if (deleteAll === 'true') {
        const allTeamEmployees = await storage.getAllTeamEmployees();
        for (const teamEmployee of allTeamEmployees) {
          await storage.deleteTeamEmployees(teamEmployee.id);
        }
        console.log(`✅ 팀 인원 전체 삭제 성공: ${allTeamEmployees.length}개`);
        res.json({ success: true, deletedCount: allTeamEmployees.length });
      } else {
        res.status(400).json({ error: "deleteAll parameter is required" });
      }
    } catch (error) {
      console.error('팀 인원 전체 삭제 오류:', error);
      res.status(500).json({ error: "Failed to delete all team employees" });
    }
  });

  // R&D 인원 목록 조회 API
  app.get("/api/rd-employees", async (req, res) => {
    try {
      console.log('📊 R&D 인원 목록 조회 API 호출');
      const allEmployees = await storage.getAllEmployees();
      console.log(`📊 전체 직원 데이터 로드: ${allEmployees.length}명`);

      // 비활성 직원 제외 후 R&D 인원 필터링
      const activeEmployees = allEmployees.filter(emp => emp.isActive !== false);
      const rdEmployees = activeEmployees.filter(employee => {
        // 부서명이 "기술연구소" 또는 "연구개발" 또는 "R&D"를 포함하는 경우
        const isRdDepartment = employee.department && (
          employee.department.includes('기술연구소') ||
          employee.department.includes('연구개발') ||
          employee.department.includes('R&D') ||
          employee.department.includes('연구') ||
          employee.departmentCode === 'RD' // 부서 코드가 RD인 경우
        );

        // 팀명이 연구 관련인 경우도 포함
        const isRdTeam = employee.team && (
          employee.team.includes('연구') ||
          employee.team.includes('개발') ||
          employee.team.includes('R&D')
        );

        return isRdDepartment || isRdTeam;
      });

      console.log(`📊 R&D 인원 목록: ${rdEmployees.length}명`);
      console.log(`📊 R&D 직원 상세:`, rdEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        team: emp.team,
        departmentCode: emp.departmentCode,
        position: emp.position,
        isActive: emp.isActive
      })));

      res.json({
        total: rdEmployees.length,
        employees: rdEmployees.map(emp => ({
          id: emp.id,
          name: emp.name,
          employeeNumber: emp.employeeNumber,
          department: emp.department,
          team: emp.team,
          departmentCode: emp.departmentCode,
          position: emp.position,
          email: emp.email,
          phone: emp.phone,
          hireDate: emp.hireDate,
          isActive: emp.isActive
        }))
      });
    } catch (error) {
      console.error('R&D 인원 목록 조회 오류:', error);
      res.status(500).json({ error: "Failed to fetch RD employees" });
    }
  });

  // 교육 이력을 교육시간 데이터로 변환하는 API (전사 직원)
  app.post("/api/convert-training-to-hours", async (req, res) => {
    try {
      const { year } = req.body;

      if (!year) {
        return res.status(400).json({ error: "year is required" });
      }

      console.log(`🔄 전사 직원 교육 이력을 교육시간으로 변환: ${year}년`);

      // 기존 교육시간 데이터 삭제 (중복 방지)
      const existingTrainingHours = await storage.getTrainingHoursByYearRange(year, year);
      console.log(`🗑️ 기존 ${year}년 교육시간 데이터 ${existingTrainingHours.length}개 삭제 중...`);

      for (const existingData of existingTrainingHours) {
        await storage.deleteTrainingHours(existingData.id);
      }
      console.log(`✅ 기존 ${year}년 교육시간 데이터 삭제 완료`);

      // 모든 직원 조회
      const allEmployees = await storage.getAllEmployees();
      console.log(`🔄 전체 직원 수: ${allEmployees.length}명`);

      // 박연구 직원 찾기
      const parkEmployee = allEmployees.find(emp => emp.name === '박연구');
      if (parkEmployee) {
        console.log(`🔍 박연구 직원 정보:`, {
          id: parkEmployee.id,
          name: parkEmployee.name,
          team: parkEmployee.team,
          department: parkEmployee.department
        });

        // 박연구의 교육 이력 조회
        const parkTrainings = await storage.getTrainingHistoryByEmployee(parkEmployee.id);
        console.log(`🔍 박연구의 교육 이력:`, parkTrainings);

        parkTrainings.forEach(training => {
          const trainingYear = new Date(training.completionDate).getFullYear();
          console.log(`🔍 교육 이력 상세:`, {
            id: training.id,
            name: training.courseName, // trainingName → courseName
            completionDate: training.completionDate,
            year: trainingYear,
            hours: training.duration, // hours → duration
            trainingType: training.type // trainingType → type
          });
        });
      }

      let convertedCount = 0;
      const teamTrainingHours = new Map<string, Map<string, number>>(); // team -> trainingType -> hours

      // 각 직원의 교육 이력을 조회하여 팀별, 교육유형별로 집계
      for (const employee of allEmployees) {
        // 팀이 없는 직원은 부서명을 팀으로 사용
        const teamName = employee.team || employee.department || '기타';

        if (!employee.team) {
          console.log(`⚠️ ${employee.name}은 팀이 없어서 부서명(${teamName})을 팀으로 사용`);
        }

        const trainings = await storage.getTrainingHistoryByEmployee(employee.id);
        console.log(`🔄 ${employee.name}(${teamName})의 교육 이력: ${trainings.length}개`);

        trainings.forEach(training => {
          const trainingYear = new Date(training.completionDate).getFullYear();
          console.log(`🔍 ${employee.name} 교육 상세: ${training.courseName}, ${trainingYear}년, ${training.duration}시간`);

          if (trainingYear === year) {
            const type = training.type || '기타';
            const hours = training.duration || 0;

            console.log(`✅ ${employee.name} - ${year}년 교육 매칭: ${type}, ${hours}시간`);

            if (!teamTrainingHours.has(teamName)) {
              teamTrainingHours.set(teamName, new Map());
            }

            const teamHours = teamTrainingHours.get(teamName)!;
            if (!teamHours.has(type)) {
              teamHours.set(type, 0);
            }
            teamHours.set(type, teamHours.get(type)! + hours);
          }
        });
      }

      console.log(`🔍 팀별 집계 결과:`, teamTrainingHours);

      // 집계된 데이터를 교육시간 데이터로 생성
      for (const [team, trainingTypes] of teamTrainingHours) {
        for (const [trainingType, totalHours] of trainingTypes) {
          if (totalHours > 0) {
            const trainingHoursData = {
              year: year,
              team: team,
              trainingType: trainingType,
              hours: totalHours,
              description: `${team} ${trainingType} 교육시간 (${year}년)`
            };

            await storage.createTrainingHours(trainingHoursData);
            convertedCount++;
            console.log(`✅ ${team} - ${trainingType}: ${totalHours}시간 변환 완료`);
          }
        }
      }

      console.log(`🔄 총 ${convertedCount}개의 교육시간 데이터 변환 완료`);
      res.json({
        success: true,
        convertedCount,
        message: `전사 직원 ${year}년 교육시간 데이터 ${convertedCount}개 변환 완료`
      });
    } catch (error) {
      console.error('교육시간 변환 오류:', error);
      res.status(500).json({ error: "Failed to convert training to hours" });
    }
  });

  // 팀별 교육시간 분석 API
  app.get("/api/team-training-analysis", async (req, res) => {
    try {
      const { startYear, endYear } = req.query;

      if (!startYear || !endYear) {
        return res.status(400).json({ error: "startYear and endYear are required" });
      }

      const start = parseInt(startYear as string);
      const end = parseInt(endYear as string);

      console.log(`📊 팀별 교육시간 분석: ${start}-${end}`);

      // 교육 시간 데이터 조회
      const trainingHoursData = await storage.getTrainingHoursByYearRange(start, end);
      console.log(`📊 교육 시간 데이터: ${trainingHoursData.length}개`);
      console.log(`📊 교육 시간 데이터 상세:`, trainingHoursData);

      // 팀별 분석
      const teamAnalysis = new Map<string, {
        totalHours: number;
        trainingTypes: Map<string, number>;
        years: Map<number, number>;
        employeeCount: number;
        averageHoursPerEmployee: number;
      }>();

      trainingHoursData.forEach(th => {
        console.log(`🔍 교육시간 데이터 처리: 팀=${th.team}, 유형=${th.trainingType}, 시간=${th.hours}, 연도=${th.year}`);

        if (!teamAnalysis.has(th.team)) {
          teamAnalysis.set(th.team, {
            totalHours: 0,
            trainingTypes: new Map(),
            years: new Map(),
            employeeCount: 0,
            averageHoursPerEmployee: 0
          });
        }

        const teamData = teamAnalysis.get(th.team)!;
        const beforeHours = teamData.totalHours;
        teamData.totalHours += th.hours;
        console.log(`🔍 ${th.team} 팀 시간 누적: ${beforeHours} + ${th.hours} = ${teamData.totalHours}`);

        // 교육 유형별 집계
        if (!teamData.trainingTypes.has(th.trainingType)) {
          teamData.trainingTypes.set(th.trainingType, 0);
        }
        const beforeTypeHours = teamData.trainingTypes.get(th.trainingType)!;
        teamData.trainingTypes.set(th.trainingType, beforeTypeHours + th.hours);
        console.log(`🔍 ${th.team} 팀 ${th.trainingType} 유형 시간 누적: ${beforeTypeHours} + ${th.hours} = ${teamData.trainingTypes.get(th.trainingType)}`);

        // 연도별 집계
        if (!teamData.years.has(th.year)) {
          teamData.years.set(th.year, 0);
        }
        const beforeYearHours = teamData.years.get(th.year)!;
        teamData.years.set(th.year, beforeYearHours + th.hours);
        console.log(`🔍 ${th.team} 팀 ${th.year}년 시간 누적: ${beforeYearHours} + ${th.hours} = ${teamData.years.get(th.year)}`);
      });

      // R&D 인원 자동 계산을 위한 전체 직원 데이터 조회
      const allEmployees = await storage.getAllEmployees();
      const activeEmployees = allEmployees.filter(emp => emp.isActive !== false);
      const rdEmployees = activeEmployees.filter(employee => {
        const isRdDepartment = employee.department && (
          employee.department.includes('기술연구소') ||
          employee.department.includes('연구개발') ||
          employee.department.includes('R&D') ||
          employee.department.includes('연구') ||
          employee.departmentCode === 'RD'
        );

        const isRdTeam = employee.team && (
          employee.team.includes('연구') ||
          employee.team.includes('개발') ||
          employee.team.includes('R&D')
        );

        const isRd = isRdDepartment || isRdTeam;

        if (isRd) {
          console.log(`🔍 R&D 직원 발견: ${employee.name} (부서: ${employee.department}, 팀: ${employee.team}, 부서코드: ${employee.departmentCode})`);
        }

        return isRd;
      });

      // 팀별 인원 수 계산 (R&D 팀만)
      console.log(`🔍 R&D 직원 목록 (${rdEmployees.length}명):`, rdEmployees.map(emp => ({
        name: emp.name,
        department: emp.department,
        team: emp.team
      })));

      rdEmployees.forEach(emp => {
        // 팀이 없는 직원은 팀별 분석에서 제외 (실제 팀에 속한 직원만 계산)
        if (!emp.team || emp.team === '') {
          console.log(`⚠️ ${emp.name}은 팀이 없어서 팀별 분석에서 제외됨`);
          return;
        }

        const teamName = emp.team;

        console.log(`🔍 ${emp.name} 매칭 시도: 팀=${emp.team}, 부서=${emp.department}`);

        if (teamAnalysis.has(teamName)) {
          teamAnalysis.get(teamName)!.employeeCount += 1;
          console.log(`✅ ${emp.name} → ${teamName} 팀 인원 추가 (총 ${teamAnalysis.get(teamName)!.employeeCount}명)`);
        } else {
          console.log(`⚠️ ${emp.name}의 팀(${teamName})이 분석 결과에 없음`);
          console.log(`🔍 현재 분석 결과에 있는 팀들:`, Array.from(teamAnalysis.keys()));
        }
      });

      // 1인당 평균 교육시간 계산
      teamAnalysis.forEach((teamData, team) => {
        if (teamData.employeeCount > 0) {
          teamData.averageHoursPerEmployee = Math.round((teamData.totalHours / teamData.employeeCount) * 100) / 100;
        }
      });

      // 결과 포맷팅
      const result = Array.from(teamAnalysis.entries()).map(([team, data]) => ({
        team,
        totalHours: Math.round(data.totalHours * 100) / 100,
        employeeCount: data.employeeCount,
        averageHoursPerEmployee: data.averageHoursPerEmployee,
        trainingTypes: Object.fromEntries(data.trainingTypes),
        yearlyBreakdown: Object.fromEntries(data.years)
      })).sort((a, b) => b.totalHours - a.totalHours);

      console.log(`📊 팀별 분석 결과: ${result.length}개 팀`);
      console.log(`📊 팀별 분석 상세:`, result.map(r => ({
        team: r.team,
        totalHours: r.totalHours,
        employeeCount: r.employeeCount,
        averageHoursPerEmployee: r.averageHoursPerEmployee
      })));
      res.json(result);
    } catch (error) {
      console.error('팀별 교육시간 분석 오류:', error);
      res.status(500).json({ error: "Failed to analyze team training hours" });
    }
  });

  // 교육 시간 분석 API
  app.get("/api/training-analysis", async (req, res) => {
    try {
      const { startYear, endYear, includeTrainingTypeBreakdown, includeYearlyBreakdown, useAutoRdEmployees } = req.query;

      if (!startYear || !endYear) {
        return res.status(400).json({ error: "startYear and endYear are required" });
      }

      const start = parseInt(startYear as string);
      const end = parseInt(endYear as string);

      // 데이터 조회
      const trainingHoursData = await storage.getTrainingHoursByYearRange(start, end);
      const teamEmployeesData = await storage.getTeamEmployeesByYearRange(start, end);

      // R&D 인원 자동 계산을 위한 전체 직원 데이터 조회
      let allEmployees = undefined;
      if (useAutoRdEmployees === 'true') {
        const allEmployeesData = await storage.getAllEmployees();
        allEmployees = allEmployeesData.filter(emp => emp.isActive !== false);
        console.log(`📊 활성 직원 데이터 로드: ${allEmployees.length}명`);
      }

      // 분석 모듈 import 및 실행
      const { TrainingAnalysisModule } = await import('./training-analysis');

      const result = await TrainingAnalysisModule.analyzeTrainingHours(
        trainingHoursData,
        teamEmployeesData,
        {
          startYear: start,
          endYear: end,
          includeTrainingTypeBreakdown: includeTrainingTypeBreakdown === 'true',
          includeYearlyBreakdown: includeYearlyBreakdown === 'true',
          useAutoRdEmployees: useAutoRdEmployees === 'true'
        },
        allEmployees
      );

      res.json(result);
    } catch (error) {
      console.error('교육 시간 분석 오류:', error);
      res.status(500).json({ error: "Failed to analyze training hours" });
    }
  });

  // R&D 역량평가 기준 조회
  app.get("/api/rd-evaluations/criteria", async (req, res) => {
    try {
      console.log('🔍 R&D 역량평가 기준 조회 요청 (routes.ts)');

      // 서버 측 기본 역량 항목 정의 (프론트엔드와 동일한 구조)
      const defaultCompetencyItems = {
        technical_competency: {
          name: "전문기술",
          weight: 25,
          description: "전문 기술 역량",
          maxScore: 25,
          scoringRanges: [
            { min: 80, max: 100, converted: 100, label: "80점↑ → 100점" },
            { min: 60, max: 79, converted: 80, label: "60-79점 → 80점" },
            { min: 40, max: 59, converted: 60, label: "40-59점 → 60점" },
            { min: 0, max: 39, converted: 40, label: "40점↓ → 40점" }
          ]
        },
        project_experience: {
          name: "프로젝트",
          weight: 20,
          description: "프로젝트 수행 경험",
          maxScore: 20,
          scoringRanges: [
            { min: 30, max: 100, converted: 100, label: "30점↑ → 100점" },
            { min: 20, max: 29, converted: 80, label: "20-29점 → 80점" },
            { min: 10, max: 19, converted: 60, label: "10-19점 → 60점" },
            { min: 0, max: 9, converted: 40, label: "10점↓ → 40점" }
          ]
        },
        rd_achievement: {
          name: "연구성과",
          weight: 25,
          description: "연구개발 성과",
          maxScore: 25,
          scoringRanges: [
            { min: 40, max: 100, converted: 100, label: "40점↑ → 100점" },
            { min: 25, max: 39, converted: 80, label: "25-39점 → 80점" },
            { min: 10, max: 24, converted: 60, label: "10-24점 → 60점" },
            { min: 0, max: 9, converted: 40, label: "10점↓ → 40점" }
          ]
        },
        global_competency: {
          name: "글로벌",
          weight: 10,
          description: "글로벌 역량",
          maxScore: 10,
          scoringRanges: [
            { min: 10, max: 10, converted: 100, label: "10점 → 100점" },
            { min: 7, max: 8, converted: 80, label: "7-8점 → 80점" },
            { min: 4, max: 6, converted: 60, label: "4-6점 → 60점" },
            { min: 0, max: 2, converted: 40, label: "2점 → 40점" }
          ]
        },
        knowledge_sharing: {
          name: "기술확산",
          weight: 10,
          description: "기술 확산 및 자기계발",
          maxScore: 10,
          scoringRanges: [
            { min: 15, max: 100, converted: 100, label: "15점↑ → 100점" },
            { min: 10, max: 14, converted: 80, label: "10-14점 → 80점" },
            { min: 5, max: 9, converted: 60, label: "5-9점 → 60점" },
            { min: 1, max: 4, converted: 40, label: "1-4점 → 40점" }
          ]
        },
        innovation_proposal: {
          name: "혁신제안",
          weight: 10,
          description: "업무개선 및 혁신 제안",
          maxScore: 10,
          scoringRanges: [
            { min: 60, max: 100, converted: 100, label: "60점↑ → 100점" },
            { min: 30, max: 59, converted: 80, label: "30-59점 → 80점" },
            { min: 5, max: 29, converted: 60, label: "5-29점 → 60점" },
            { min: 0, max: 4, converted: 40, label: "5점↓ → 40점" }
          ]
        }
      };

      // ⚠️ 폴백용 기본 상세 기준 (data.json에 저장된 값이 없을 경우에만 사용)
      // 사용자가 UI에서 설정한 값이 항상 우선됩니다.
      const defaultDetailedCriteria = {
        technical_competency: {
          education: { 박사: 30, 석사: 20, 학사: 10, 전문대: 5 },
          experience: { "15년 이상": 50, "10년 이상": 40, "5년 이상": 30, "5년 미만": 20 },
          certifications: { 기술사: 20, 기사: 10, 산업기사: 5, 기타: 3 }
        },
        project_experience: {
          leadership: { "Project Leader": 15, "핵심 멤버": 10, "일반 멤버": 5 },
          count: { "3개 이상": 30, "2개": 20, "1개": 10 }
        },
        rd_achievement: {
          patents: { 등록: 20, 출원: 5 },
          publications: { "SCI(E)급": 25, "국내 학술지": 10 },
          awards: { 국제: 15, 국가: 10, 산업: 5 }
        },
        global_competency: {
          "영어 TOEIC": { "950-990": 10, "900-949": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
          "영어 TOEFL": { "113-120": 10, "105-112": 8, "90-104": 6, "70-89": 4, "70미만": 2 },
          "영어 IELTS": { "8.5-9.0": 10, "7.5-8.4": 8, "6.5-7.4": 6, "5.5-6.4": 4, "5.5미만": 2 },
          "영어 TEPS": { "526-600": 10, "453-525": 8, "387-452": 6, "327-386": 4, "327미만": 2 },
          "일본어 JLPT": { "N1": 10, "N2": 7, "N3": 4, "N4": 2, "N5": 1 },
          "일본어 JPT": { "900-990": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
          "중국어 HSK": { "6급": 10, "5급": 8, "4급": 6, "3급": 4, "2급": 2, "1급": 1 },
          "중국어 TOCFL": { "Band C Level 6": 10, "Band C Level 5": 8, "Band B Level 4": 6, "Band B Level 3": 4, "Band A Level 2": 2, "Band A Level 1": 1 }
        },
        knowledge_sharing: {
          training: { "40시간 이상": 5, "20시간 이상": 3, "10시간 이상": 2 },
          certifications: { "신규 취득": 5 },
          mentoring: { "멘토링 1명": 3 },
          instructor: { "강의 1회": 5, "강의 2회": 10, "강의 3회 이상": 15 }
        },
        innovation_proposal: {
          awards: { 최우수상: 80, 우수상: 60, 장려상: 40 },
          adoption: { 채택: 5 }
        }
      };

      let criteria: any;
      const storedCriteria = (await storage.getAppSetting("rdEvaluationCriteria")) || {};
      const storedDetailedCriteria = (await storage.getAppSetting("detailedCriteria")) || {};
      if (Object.keys(storedCriteria).length > 0) {
        criteria = storedCriteria;
        console.log('✅ DB에서 R&D 역량평가 기준 로드:', criteria);
      } else {
        // 기본 기준 설정
        criteria = {
          global_competency: {
            english: {
              toeic: { "950-990": 10, "900-949": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
              toefl: { "113-120": 10, "105-112": 8, "90-104": 6, "70-89": 4, "70미만": 2 },
              ielts: { "8.5-9.0": 10, "7.5-8.4": 8, "6.5-7.4": 6, "5.5-6.4": 4, "5.5미만": 2 },
              teps: { "526-600": 10, "453-525": 8, "387-452": 6, "327-386": 4, "327미만": 2 }
            },
            japanese: {
              jlpt: { "N1": 10, "N2": 7, "N3": 4, "N4": 2, "N5": 1 },
              jpt: { "900-990": 8, "800-899": 6, "700-799": 4, "700미만": 2 }
            },
            chinese: {
              hsk: { "6급": 10, "5급": 8, "4급": 6, "3급": 4, "2급": 2, "1급": 1 },
              tocfl: { "Band C Level 6": 10, "Band C Level 5": 8, "Band B Level 4": 6, "Band B Level 3": 4, "Band A Level 2": 2, "Band A Level 1": 1 }
            }
          }
        };
      }

      // 깊은 병합: 저장된 기준을 기본값과 병합
      const mergedCriteria: any = { ...defaultCompetencyItems };
      for (const [key, value] of Object.entries(criteria)) {
        if (mergedCriteria[key]) {
          mergedCriteria[key] = { ...mergedCriteria[key], ...value };
        }
      }

      // 상세 기준도 병합
      const mergedDetailedCriteria: any = { ...defaultDetailedCriteria };
      if (Object.keys(storedDetailedCriteria).length > 0) {
        for (const [key, value] of Object.entries(storedDetailedCriteria)) {
          if (mergedDetailedCriteria[key]) {
            mergedDetailedCriteria[key] = { ...mergedDetailedCriteria[key], ...value };
          }
        }
      }

      // 언어 테스트 정보 추출
      const globalCompetency = criteria.global_competency || {};
      const languageTests: any = {};

      // 영어 테스트
      if (globalCompetency.english?.toeic) {
        languageTests.English = languageTests.English || {};
        languageTests.English.TOEIC = Object.keys(globalCompetency.english.toeic);
      }
      if (globalCompetency.english?.toefl) {
        languageTests.English = languageTests.English || {};
        languageTests.English.TOEFL = Object.keys(globalCompetency.english.toefl);
      }
      if (globalCompetency.english?.ielts) {
        languageTests.English = languageTests.English || {};
        languageTests.English.IELTS = Object.keys(globalCompetency.english.ielts);
      }
      if (globalCompetency.english?.teps) {
        languageTests.English = languageTests.English || {};
        languageTests.English.TEPS = Object.keys(globalCompetency.english.teps);
      }

      // 일본어 테스트
      if (globalCompetency.japanese?.jlpt) {
        languageTests.Japanese = languageTests.Japanese || {};
        languageTests.Japanese.JLPT = Object.keys(globalCompetency.japanese.jlpt);
      }
      if (globalCompetency.japanese?.jpt) {
        languageTests.Japanese = languageTests.Japanese || {};
        languageTests.Japanese.JPT = Object.keys(globalCompetency.japanese.jpt);
      }

      // 중국어 테스트
      if (globalCompetency.chinese?.hsk) {
        languageTests.Chinese = languageTests.Chinese || {};
        languageTests.Chinese.HSK = Object.keys(globalCompetency.chinese.hsk);
      }
      if (globalCompetency.chinese?.tocfl) {
        languageTests.Chinese = languageTests.Chinese || {};
        languageTests.Chinese.TOCFL = Object.keys(globalCompetency.chinese.tocfl);
      }

      res.json({
        success: true,
        rdEvaluationCriteria: mergedCriteria,
        detailedCriteria: mergedDetailedCriteria,
        languageTests: languageTests
      });
    } catch (error) {
      console.error("평가 기준 조회 오류:", error);
      res.status(500).json({ error: "평가 기준을 불러올 수 없습니다." });
    }
  });


  // R&D 역량평가 기준 저장
  app.put("/api/rd-evaluations/criteria", async (req, res) => {
    try {
      const { criteria, detailedCriteria, updateEmployeeForms } = req.body;

      console.log('🔧 R&D 역량평가 기준 저장 요청 (routes.ts):', { criteria, detailedCriteria, updateEmployeeForms });

      await storage.setAppSetting("rdEvaluationCriteria", criteria);
      if (detailedCriteria) {
        await storage.setAppSetting("detailedCriteria", detailedCriteria);
      }

      res.json({
        success: true,
        message: 'R&D 역량평가 기준이 저장되었습니다.'
      });
    } catch (error) {
      console.error("평가 기준 저장 오류:", error);
      res.status(500).json({ error: "평가 기준을 저장할 수 없습니다." });
    }
  });

  // 성과관리 등록용 분야/카테고리 조회 API
  app.get("/api/achievements/categories", async (req, res) => {
    try {
      console.log('🔍 성과관리 분야/카테고리 조회 요청');
      const storedDetailedCriteria = (await storage.getAppSetting("detailedCriteria")) || {};
      if (Object.keys(storedDetailedCriteria).length > 0) {
        const categories = {
          patentStatus: Array.isArray(Object.keys(storedDetailedCriteria.rd_achievement?.patents || {}))
            ? Object.keys(storedDetailedCriteria.rd_achievement?.patents || {})
            : [],
          publicationLevels: Array.isArray(Object.keys(storedDetailedCriteria.rd_achievement?.publications || {}))
            ? Object.keys(storedDetailedCriteria.rd_achievement?.publications || {})
            : [],
          awardLevels: ["국제", "국가", "산업", "사내"]
        };

        return res.json({
          success: true,
          categories,
        });
      }

      // ⚠️ 폴백용 기본 상세 기준 (data.json에 저장된 값이 없을 경우에만 사용)
      // 사용자가 UI에서 설정한 값이 항상 우선됩니다.
      const defaultDetailedCriteria = {
        technical_competency: {
          education: { 박사: 30, 석사: 20, 학사: 10, 전문대: 5 },
          experience: { "15년 이상": 50, "10년 이상": 40, "5년 이상": 30, "5년 미만": 20 },
          certifications: { 기술사: 20, 기사: 10, 산업기사: 5, 기타: 3 }
        },
        project_experience: {
          leadership: { "Project Leader": 15, "핵심 멤버": 10, "일반 멤버": 5 },
          count: { "3개 이상": 30, "2개": 20, "1개": 10 }
        },
        rd_achievement: {
          patents: { 등록: 20, 출원: 5 },
          publications: { "SCI(E)급": 25, "국내 학술지": 10 },
          awards: { 국제: 15, 국가: 10, 산업: 5 }
        },
        global_competency: {
          "영어 TOEIC": { "950-990": 10, "900-949": 8, "800-899": 6, "700-799": 4, "700미만": 2 },
          "영어 TOEFL": { "110-120": 10, "100-109": 8, "90-99": 6, "80-89": 4, "80미만": 2 },
          "영어 IELTS": { "8.0-9.0": 10, "7.0-7.5": 8, "6.0-6.5": 6, "5.0-5.5": 4, "5.0미만": 2 }
        },
        knowledge_sharing: {
          training: { "20시간 이상": 15, "15-19시간": 12, "10-14시간": 8, "5-9시간": 5, "5시간 미만": 2 },
          mentoring: { "5명 이상": 10, "3-4명": 7, "1-2명": 4, "0명": 0 }
        },
        innovation_proposal: {
          proposals: { "5건 이상": 20, "3-4건": 15, "1-2건": 10, "0건": 0 },
          implementation: { "3건 이상": 15, "2건": 10, "1건": 5, "0건": 0 }
        }
      };

      const detailedCriteria = defaultDetailedCriteria;

      // 성과관리 등록용 카테고리 추출 (각 메뉴에 맞는 항목만)
      const categories = {
        // 특허 등록용: 특허 상태만 (등록/출원)
        patentStatus: Array.isArray(Object.keys(detailedCriteria.rd_achievement?.patents || {}))
          ? Object.keys(detailedCriteria.rd_achievement?.patents || {})
          : [],

        // 논문 등록용: 논문 등급만 (SCI(E)급, 국내 학술지)
        publicationLevels: Array.isArray(Object.keys(detailedCriteria.rd_achievement?.publications || {}))
          ? Object.keys(detailedCriteria.rd_achievement?.publications || {})
          : [],

        // 수상 등록용: 실제 사용하는 수상 등급 (국제, 국가, 산업, 사내)
        awardLevels: ["국제", "국가", "산업", "사내"]
      };

      res.json({
        success: true,
        categories: categories
      });
    } catch (error) {
      console.error("성과관리 카테고리 조회 오류:", error);
      res.status(500).json({ error: "카테고리를 불러올 수 없습니다." });
    }
  });

  // R&D 역량평가 라우트 설정
  setupRdEvaluationRoutes(app);

  // R&D 역량평가 데이터 조회
  app.get("/api/rd-evaluations", async (req, res) => {
    try {
      const { employeeId } = req.query;
      console.log(`🔍 R&D 역량평가 데이터 조회: ${employeeId}`);

      if (!employeeId) {
        return res.status(400).json({ error: "직원 ID가 필요합니다." });
      }

      // 자동 평가 계산
      const { calculateAutoRdEvaluation } = await import("./rd-evaluation-auto");
      const result = await calculateAutoRdEvaluation(employeeId);

      console.log(`✅ R&D 역량평가 결과:`, result);
      res.json(result);
    } catch (error) {
      console.error("R&D 역량평가 데이터 조회 오류:", error);
      res.status(500).json({ error: "R&D 역량평가 데이터를 불러올 수 없습니다." });
    }
  });

  // R&D 역량평가 테스트 API
  app.get("/api/rd-evaluations/test/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      console.log(`🔍 R&D 역량평가 테스트 시작: ${employeeId}`, { startDate, endDate });

      // 자동 평가 계산 (날짜 필터 적용)
      const { calculateAutoRdEvaluation } = await import("./rd-evaluation-auto");
      const result = await calculateAutoRdEvaluation(
        employeeId,
        new Date().getFullYear(),
        startDate as string,
        endDate as string
      );

      console.log(`✅ R&D 역량평가 결과:`, result);
      console.log(`📊 scores 상세:`, result.scores);
      console.log(`🎯 totalScore: ${result.totalScore}`);
      console.log(`📈 grade: ${result.grade}`);
      res.json(result);
    } catch (error) {
      console.error("❌ R&D 역량평가 테스트 오류:", error);
      res.status(500).json({ error: "R&D 역량평가 테스트 실패", details: error.message });
    }
  });

  // 성과관리 라우트 설정
  setupAchievementsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

