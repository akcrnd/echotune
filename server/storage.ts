import { randomUUID } from "crypto";
import type {
  Award,
  Certification,
  Employee,
  InsertAward,
  InsertCertification,
  InsertEmployee,
  InsertLanguage,
  InsertPatent,
  InsertProject,
  InsertPublication,
  InsertSkill,
  InsertSkillCalculation,
  InsertTeamEmployees,
  InsertTrainingHistory,
  InsertTrainingHours,
  Language,
  Patent,
  Project,
  Publication,
  Skill,
  SkillCalculation,
  TeamEmployees,
  TrainingHistory,
  TrainingHours,
} from "@shared/schema";
import { ensureDatabaseSchema, pool } from "./db";

type JsonValue = Record<string, any> | any[] | string | number | boolean | null;

type DepartmentRecord = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  managerId?: string | null;
  budget?: number | null;
  location?: string | null;
  isActive?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type TeamRecord = {
  id?: string;
  code: string;
  name: string;
  departmentCode: string;
  description?: string | null;
  teamLeadId?: string | null;
  budget?: number | null;
  location?: string | null;
  isActive?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type ProposalFilters = {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
};

type ProposalRecord = {
  id: string;
  employeeId: string;
  submissionDate?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  [key: string]: any;
};

const databaseReady = ensureDatabaseSchema();

function uniqueId(prefix?: string): string {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID();
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function ensureArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  if (value === undefined || value === null) return [];
  return [value];
}

function stripUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function serializeJson(value: unknown): JsonValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value as JsonValue;
}

function rowTimestamp(row: Record<string, any>, key: string): Date | undefined {
  const parsed = toDate(row[key]);
  return parsed ?? undefined;
}

async function upsertSetting(key: string, value: JsonValue): Promise<void> {
  await databaseReady;
  await pool.query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(serializeJson(value))],
  );
}

async function getSetting<T = any>(key: string): Promise<T | null> {
  await databaseReady;
  const result = await pool.query("SELECT value FROM app_settings WHERE key = $1", [key]);
  if (!result.rows[0]) return null;
  return result.rows[0].value as T;
}

function rowEmployee(row: Record<string, any>): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    departmentCode: row.department_code,
    teamCode: row.team_code,
    name: row.name,
    position: row.position,
    department: row.department,
    team: row.team,
    email: row.email,
    phone: row.phone,
    hireDate: rowTimestamp(row, "hire_date"),
    birthDate: rowTimestamp(row, "birth_date"),
    managerId: row.manager_id,
    photoUrl: row.photo_url,
    education: row.education,
    major: row.major,
    school: row.school,
    graduationYear: row.graduation_year,
    previousExperienceYears: row.previous_experience_years ?? 0,
    previousExperienceMonths: row.previous_experience_months ?? 0,
    isDepartmentHead: row.is_department_head ?? false,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Employee;
}

function rowTraining(row: Record<string, any>): TrainingHistory {
  return {
    id: row.id,
    employeeId: row.employee_id,
    courseName: row.course_name,
    provider: row.provider,
    type: row.type,
    category: row.category,
    startDate: rowTimestamp(row, "start_date"),
    completionDate: rowTimestamp(row, "completion_date"),
    duration: row.duration,
    score: row.score,
    status: row.status,
    instructorRole: row.instructor_role,
    certificateUrl: row.certificate_url,
    notes: row.notes,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as TrainingHistory;
}

function rowCertification(row: Record<string, any>): Certification {
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    issuer: row.issuer,
    issueDate: rowTimestamp(row, "issue_date"),
    expiryDate: rowTimestamp(row, "expiry_date"),
    credentialId: row.credential_id,
    verificationUrl: row.verification_url,
    category: row.category,
    level: row.level,
    score: row.score,
    scoreAtAcquisition: row.score_at_acquisition,
    scoringCriteriaVersion: row.scoring_criteria_version,
    useFixedScore: row.use_fixed_score ?? true,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Certification;
}

function rowLanguage(row: Record<string, any>): Language {
  return {
    id: row.id,
    employeeId: row.employee_id,
    language: row.language,
    proficiencyLevel: row.proficiency_level,
    testType: row.test_type,
    testLevel: row.test_level,
    score: row.score,
    maxScore: row.max_score,
    testDate: rowTimestamp(row, "test_date"),
    certificateUrl: row.certificate_url,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Language;
}

function rowSkill(row: Record<string, any>): Skill {
  return {
    id: row.id,
    employeeId: row.employee_id,
    skillType: row.skill_type,
    skillName: row.skill_name,
    proficiencyLevel: row.proficiency_level,
    yearsOfExperience: row.years_of_experience,
    lastAssessedDate: rowTimestamp(row, "last_assessed_date"),
    assessedBy: row.assessed_by,
    notes: row.notes,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Skill;
}

function rowSkillCalculation(row: Record<string, any>): SkillCalculation {
  return {
    id: row.id,
    employeeId: row.employee_id,
    experienceScore: row.experience_score ?? 0,
    certificationScore: row.certification_score ?? 0,
    languageScore: row.language_score ?? 0,
    trainingScore: row.training_score ?? 0,
    technicalScore: row.technical_score ?? 0,
    softSkillScore: row.soft_skill_score ?? 0,
    overallScore: row.overall_score ?? 0,
    lastCalculatedAt: rowTimestamp(row, "last_calculated_at"),
    calculatedBy: row.calculated_by,
  } as SkillCalculation;
}

function rowPatent(row: Record<string, any>): Patent & Record<string, any> {
  const registrationDate = rowTimestamp(row, "registration_date");
  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    applicationNumber: row.application_number,
    patentNumber: row.patent_number,
    status: row.status,
    applicationDate: rowTimestamp(row, "application_date"),
    grantDate: registrationDate,
    registrationDate,
    inventors: ensureArray(row.inventors),
    description: row.description,
    category: row.category,
    priority: row.priority,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Patent & Record<string, any>;
}

function rowPublication(row: Record<string, any>): Publication & Record<string, any> {
  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    authors: ensureArray(row.authors),
    journal: row.journal,
    publicationDate: rowTimestamp(row, "publication_date"),
    doi: row.doi,
    impactFactor: row.impact_factor,
    publicationType: row.category ?? "journal",
    category: row.category ?? "journal",
    level: row.level,
    abstract: row.description,
    description: row.description,
    conference: row.conference,
    url: row.url,
    status: row.level ?? row.category ?? "journal",
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Publication & Record<string, any>;
}

function rowAward(row: Record<string, any>): Award & Record<string, any> {
  return {
    id: row.id,
    employeeId: row.employee_id,
    awardName: row.title,
    title: row.title,
    awardingOrganization: row.awarding_organization,
    category: row.category,
    level: row.level,
    awardDate: rowTimestamp(row, "award_date"),
    description: row.description,
    certificateUrl: row.certificate_url,
    monetaryValue: row.monetary_value,
    isTeamAward: row.is_team_award ?? false,
    teamMembers: ensureArray(row.team_members),
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Award & Record<string, any>;
}

function rowProject(row: Record<string, any>): Project & Record<string, any> {
  return {
    id: row.id,
    employeeId: row.employee_id,
    projectName: row.project_name,
    role: row.role,
    startDate: rowTimestamp(row, "start_date"),
    endDate: rowTimestamp(row, "end_date"),
    status: row.status,
    description: row.description,
    technologies: row.technologies,
    teamSize: row.team_size,
    budget: row.budget,
    client: row.client,
    isInternal: row.is_internal ?? false,
    notes: row.notes,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as Project & Record<string, any>;
}

function rowTrainingHours(row: Record<string, any>): TrainingHours {
  return {
    id: row.id,
    year: row.year,
    team: row.team,
    trainingType: row.training_type,
    hours: row.hours,
    description: row.description,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as TrainingHours;
}

function rowTeamEmployees(row: Record<string, any>): TeamEmployees {
  return {
    id: row.id,
    year: row.year,
    team: row.team,
    employeeCount: row.employee_count,
    description: row.description,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  } as TeamEmployees;
}

function rowDepartment(row: Record<string, any>): DepartmentRecord {
  return {
    id: row.id,
    code: row.department_code,
    name: row.department_name,
    description: row.description,
    managerId: row.manager_id,
    budget: row.budget,
    location: row.location,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  };
}

function rowTeam(row: Record<string, any>): TeamRecord {
  return {
    id: row.id,
    code: row.team_code,
    name: row.team_name,
    departmentCode: row.department_code,
    description: row.description,
    teamLeadId: row.team_lead_id,
    budget: row.budget,
    location: row.location,
    isActive: row.is_active ?? true,
    createdAt: rowTimestamp(row, "created_at"),
    updatedAt: rowTimestamp(row, "updated_at"),
  };
}

function rowProposal(row: Record<string, any>): ProposalRecord {
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return {
    ...(payload ?? {}),
    id: row.id,
    employeeId: row.employee_id,
    submissionDate: rowTimestamp(row, "submission_date") ?? payload?.submissionDate ?? null,
    createdAt: rowTimestamp(row, "created_at") ?? payload?.createdAt ?? null,
    updatedAt: rowTimestamp(row, "updated_at") ?? payload?.updatedAt ?? null,
  };
}

async function queryOne<T>(
  text: string,
  values: any[],
  mapper: (row: Record<string, any>) => T,
): Promise<T | undefined> {
  await databaseReady;
  const result = await pool.query(text, values);
  return result.rows[0] ? mapper(result.rows[0]) : undefined;
}

async function queryMany<T>(
  text: string,
  values: any[],
  mapper: (row: Record<string, any>) => T,
): Promise<T[]> {
  await databaseReady;
  const result = await pool.query(text, values);
  return result.rows.map(mapper);
}

export interface IStorage {
  query(text: string, params?: any[]): Promise<any>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getAllEmployees(): Promise<Employee[]>;
  getAllEmployeesIncludingInactive(): Promise<Employee[]>;
  getEmployeesByDepartment(department: string): Promise<Employee[]>;
  saveViewState(viewState: any): Promise<void>;
  getViewState(): Promise<any>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<boolean>;
  getTrainingHistory(id: string): Promise<TrainingHistory | TrainingHistory[] | undefined>;
  getAllTrainingHistory(): Promise<TrainingHistory[]>;
  getTrainingHistoryByEmployee(employeeId: string): Promise<TrainingHistory[]>;
  createTrainingHistory(training: InsertTrainingHistory): Promise<TrainingHistory>;
  updateTrainingHistory(id: string, training: Partial<InsertTrainingHistory>): Promise<TrainingHistory>;
  deleteTrainingHistory(id: string): Promise<boolean>;
  getCertification(id: string): Promise<Certification | undefined>;
  getAllCertifications(): Promise<Certification[]>;
  getCertificationsByEmployee(employeeId: string): Promise<Certification[]>;
  createCertification(certification: InsertCertification): Promise<Certification>;
  updateCertification(id: string, certification: Partial<InsertCertification>): Promise<Certification>;
  deleteCertification(id: string): Promise<boolean>;
  deleteCertificationsByEmployee(employeeId: string): Promise<boolean>;
  getLanguage(id: string): Promise<Language | undefined>;
  getAllLanguages(): Promise<Language[]>;
  getLanguages(employeeId: string): Promise<Language[]>;
  getLanguagesByEmployee(employeeId: string): Promise<Language[]>;
  createLanguage(language: InsertLanguage): Promise<Language>;
  updateLanguage(id: string, language: Partial<InsertLanguage>): Promise<Language>;
  deleteLanguage(id: string): Promise<boolean>;
  deleteLanguagesByEmployee(employeeId: string): Promise<boolean>;
  getSkill(id: string): Promise<Skill | undefined>;
  getAllSkills(): Promise<Skill[]>;
  getSkillsByEmployee(employeeId: string): Promise<Skill[]>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill>;
  deleteSkill(id: string): Promise<boolean>;
  getSkillCalculation(id: string): Promise<SkillCalculation | undefined>;
  getAllSkillCalculations(): Promise<SkillCalculation[]>;
  getSkillCalculationsByEmployee(employeeId: string): Promise<SkillCalculation[]>;
  createSkillCalculation(calculation: InsertSkillCalculation): Promise<SkillCalculation>;
  updateSkillCalculation(id: string, calculation: Partial<InsertSkillCalculation>): Promise<SkillCalculation>;
  deleteSkillCalculation(id: string): Promise<boolean>;
  createOrUpdateSkillCalculation(calculation: InsertSkillCalculation): Promise<SkillCalculation>;
  getPatent(id: string): Promise<any>;
  getAllPatents(): Promise<any[]>;
  getPatentsByEmployee(employeeId: string): Promise<any[]>;
  createPatent(patent: InsertPatent | Record<string, any>): Promise<any>;
  updatePatent(id: string, patent: Partial<InsertPatent> | Record<string, any>): Promise<any>;
  deletePatent(id: string): Promise<boolean>;
  getPublication(id: string): Promise<any>;
  getAllPublications(): Promise<any[]>;
  getPublicationsByEmployee(employeeId: string): Promise<any[]>;
  createPublication(publication: InsertPublication | Record<string, any>): Promise<any>;
  updatePublication(id: string, publication: Partial<InsertPublication> | Record<string, any>): Promise<any>;
  deletePublication(id: string): Promise<boolean>;
  getAward(id: string): Promise<any>;
  getAllAwards(): Promise<any[]>;
  getAwardsByEmployee(employeeId: string): Promise<any[]>;
  createAward(award: InsertAward | Record<string, any>): Promise<any>;
  updateAward(id: string, award: Partial<InsertAward> | Record<string, any>): Promise<any>;
  deleteAward(id: string): Promise<boolean>;
  getProject(id: string): Promise<any>;
  getAllProjects(): Promise<any[]>;
  getProjectsByEmployee(employeeId: string): Promise<any[]>;
  createProject(project: InsertProject | Record<string, any>): Promise<any>;
  updateProject(id: string, project: Partial<InsertProject> | Record<string, any>): Promise<any>;
  deleteProject(id: string): Promise<boolean>;
  getTrainingHours(id: string): Promise<TrainingHours | undefined>;
  getAllTrainingHours(): Promise<TrainingHours[]>;
  getTrainingHoursByYearRange(startYear: number, endYear: number): Promise<TrainingHours[]>;
  createTrainingHours(trainingHours: InsertTrainingHours): Promise<TrainingHours>;
  updateTrainingHours(id: string, trainingHours: Partial<InsertTrainingHours>): Promise<TrainingHours>;
  deleteTrainingHours(id: string): Promise<boolean>;
  getTeamEmployees(id: string): Promise<TeamEmployees | undefined>;
  getAllTeamEmployees(): Promise<TeamEmployees[]>;
  getTeamEmployeesByYearRange(startYear: number, endYear: number): Promise<TeamEmployees[]>;
  createTeamEmployees(teamEmployees: InsertTeamEmployees): Promise<TeamEmployees>;
  updateTeamEmployees(id: string, teamEmployees: Partial<InsertTeamEmployees>): Promise<TeamEmployees>;
  deleteTeamEmployees(id: string): Promise<boolean>;
  getEmployeeFullProfile(employeeId: string): Promise<any>;
  getDepartments(): Promise<DepartmentRecord[]>;
  createDepartment(department: DepartmentRecord): Promise<DepartmentRecord>;
  updateDepartment(code: string, department: Partial<DepartmentRecord>): Promise<DepartmentRecord>;
  deleteDepartment(code: string): Promise<boolean>;
  getTeams(departmentCode?: string): Promise<TeamRecord[]>;
  createTeam(team: TeamRecord): Promise<TeamRecord>;
  updateTeam(code: string, team: Partial<TeamRecord>): Promise<TeamRecord>;
  deleteTeam(code: string): Promise<boolean>;
  getProposals(filters?: ProposalFilters): Promise<ProposalRecord[]>;
  createProposal(proposal: ProposalRecord): Promise<ProposalRecord>;
  deleteProposalsByEmployee(employeeId: string): Promise<number>;
  getAppSetting<T = any>(key: string): Promise<T | null>;
  setAppSetting(key: string, value: JsonValue): Promise<void>;
}

export class PostgresStorage implements IStorage {
  async query(text: string, params: any[] = []): Promise<any> {
    await databaseReady;
    return pool.query(text, params);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return queryOne("SELECT * FROM employees WHERE id = $1", [id], rowEmployee);
  }

  async getAllEmployees(): Promise<Employee[]> {
    return queryMany(
      "SELECT * FROM employees WHERE is_active = true ORDER BY employee_number",
      [],
      rowEmployee,
    );
  }

  async getAllEmployeesIncludingInactive(): Promise<Employee[]> {
    return queryMany("SELECT * FROM employees ORDER BY employee_number", [], rowEmployee);
  }

  async getEmployeesByDepartment(department: string): Promise<Employee[]> {
    return queryMany(
      `SELECT * FROM employees
       WHERE department = $1 OR department_code = $1
       ORDER BY employee_number`,
      [department],
      rowEmployee,
    );
  }

  async saveViewState(viewState: any): Promise<void> {
    await this.setAppSetting("viewState", viewState);
  }

  async getViewState(): Promise<any> {
    return this.getAppSetting("viewState");
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    await databaseReady;
    const id = (employee as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO employees (
        id, employee_number, department_code, team_code, name, position, department, team,
        email, phone, hire_date, birth_date, manager_id, photo_url, education, major, school,
        graduation_year, previous_experience_years, previous_experience_months,
        is_department_head, is_active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22
      ) RETURNING *`,
      [
        id,
        employee.employeeNumber,
        employee.departmentCode,
        employee.teamCode ?? null,
        employee.name,
        employee.position,
        employee.department,
        employee.team ?? null,
        employee.email ?? null,
        employee.phone ?? null,
        toDate((employee as any).hireDate),
        toDate((employee as any).birthDate),
        employee.managerId ?? null,
        employee.photoUrl ?? null,
        (employee as any).education ?? null,
        (employee as any).major ?? null,
        (employee as any).school ?? null,
        toInteger((employee as any).graduationYear),
        toInteger((employee as any).previousExperienceYears) ?? 0,
        toInteger((employee as any).previousExperienceMonths) ?? 0,
        (employee as any).isDepartmentHead ?? false,
        employee.isActive ?? true,
      ],
    );

    return rowEmployee(result.rows[0]);
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee> {
    await databaseReady;
    const payload = stripUndefined({
      employee_number: employee.employeeNumber,
      department_code: employee.departmentCode,
      team_code: employee.teamCode,
      name: employee.name,
      position: employee.position,
      department: employee.department,
      team: employee.team,
      email: employee.email,
      phone: employee.phone,
      hire_date: toDate((employee as any).hireDate),
      birth_date: toDate((employee as any).birthDate),
      manager_id: employee.managerId,
      photo_url: employee.photoUrl,
      education: (employee as any).education,
      major: (employee as any).major,
      school: (employee as any).school,
      graduation_year: toInteger((employee as any).graduationYear),
      previous_experience_years: toInteger((employee as any).previousExperienceYears),
      previous_experience_months: toInteger((employee as any).previousExperienceMonths),
      is_department_head: (employee as any).isDepartmentHead,
      is_active: employee.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getEmployee(id);
      if (!existing) throw new Error("Employee not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE employees SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Employee not found");
    return rowEmployee(result.rows[0]);
  }

  async deleteEmployee(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM employees WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getTrainingHistory(id: string): Promise<TrainingHistory | TrainingHistory[] | undefined> {
    const direct = await queryOne("SELECT * FROM training_history WHERE id = $1", [id], rowTraining);
    if (direct) return direct;
    return this.getTrainingHistoryByEmployee(id);
  }

  async getAllTrainingHistory(): Promise<TrainingHistory[]> {
    return queryMany("SELECT * FROM training_history ORDER BY completion_date DESC NULLS LAST, created_at DESC", [], rowTraining);
  }

  async getTrainingHistoryByEmployee(employeeId: string): Promise<TrainingHistory[]> {
    return queryMany(
      "SELECT * FROM training_history WHERE employee_id = $1 ORDER BY completion_date DESC NULLS LAST, created_at DESC",
      [employeeId],
      rowTraining,
    );
  }

  async createTrainingHistory(training: InsertTrainingHistory): Promise<TrainingHistory> {
    await databaseReady;
    const id = (training as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO training_history (
        id, employee_id, course_name, provider, type, category,
        start_date, completion_date, duration, score, status, instructor_role,
        certificate_url, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14
      ) RETURNING *`,
      [
        id,
        training.employeeId,
        training.courseName,
        training.provider,
        training.type,
        training.category,
        toDate((training as any).startDate),
        toDate((training as any).completionDate),
        toInteger(training.duration),
        toNumber(training.score),
        training.status ?? "planned",
        (training as any).instructorRole ?? null,
        training.certificateUrl ?? null,
        training.notes ?? null,
      ],
    );
    return rowTraining(result.rows[0]);
  }

  async updateTrainingHistory(id: string, training: Partial<InsertTrainingHistory>): Promise<TrainingHistory> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: training.employeeId,
      course_name: training.courseName,
      provider: training.provider,
      type: training.type,
      category: training.category,
      start_date: toDate((training as any).startDate),
      completion_date: toDate((training as any).completionDate),
      duration: toInteger(training.duration),
      score: toNumber(training.score),
      status: training.status,
      instructor_role: (training as any).instructorRole,
      certificate_url: training.certificateUrl,
      notes: training.notes,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getTrainingHistory(id);
      if (!existing || Array.isArray(existing)) throw new Error("Training history not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE training_history SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Training history not found");
    return rowTraining(result.rows[0]);
  }

  async deleteTrainingHistory(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM training_history WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getCertification(id: string): Promise<Certification | undefined> {
    return queryOne("SELECT * FROM certifications WHERE id = $1", [id], rowCertification);
  }

  async getAllCertifications(): Promise<Certification[]> {
    return queryMany("SELECT * FROM certifications ORDER BY created_at DESC", [], rowCertification);
  }

  async getCertificationsByEmployee(employeeId: string): Promise<Certification[]> {
    return queryMany("SELECT * FROM certifications WHERE employee_id = $1 ORDER BY created_at DESC", [employeeId], rowCertification);
  }

  async createCertification(certification: InsertCertification): Promise<Certification> {
    await databaseReady;
    const id = (certification as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO certifications (
        id, employee_id, name, issuer, issue_date, expiry_date, credential_id, verification_url,
        category, level, score, score_at_acquisition, scoring_criteria_version, use_fixed_score, is_active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15
      ) RETURNING *`,
      [
        id,
        certification.employeeId,
        certification.name,
        certification.issuer,
        toDate((certification as any).issueDate),
        toDate((certification as any).expiryDate),
        certification.credentialId ?? null,
        certification.verificationUrl ?? null,
        certification.category,
        certification.level ?? null,
        toNumber(certification.score),
        toNumber((certification as any).scoreAtAcquisition),
        (certification as any).scoringCriteriaVersion ?? null,
        (certification as any).useFixedScore ?? true,
        certification.isActive ?? true,
      ],
    );
    return rowCertification(result.rows[0]);
  }

  async updateCertification(id: string, certification: Partial<InsertCertification>): Promise<Certification> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: certification.employeeId,
      name: certification.name,
      issuer: certification.issuer,
      issue_date: toDate((certification as any).issueDate),
      expiry_date: toDate((certification as any).expiryDate),
      credential_id: certification.credentialId,
      verification_url: certification.verificationUrl,
      category: certification.category,
      level: certification.level,
      score: toNumber(certification.score),
      score_at_acquisition: toNumber((certification as any).scoreAtAcquisition),
      scoring_criteria_version: (certification as any).scoringCriteriaVersion,
      use_fixed_score: (certification as any).useFixedScore,
      is_active: certification.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getCertification(id);
      if (!existing) throw new Error("Certification not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE certifications SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Certification not found");
    return rowCertification(result.rows[0]);
  }

  async deleteCertification(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM certifications WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteCertificationsByEmployee(employeeId: string): Promise<boolean> {
    await databaseReady;
    await pool.query("DELETE FROM certifications WHERE employee_id = $1", [employeeId]);
    return true;
  }

  async getLanguage(id: string): Promise<Language | undefined> {
    return queryOne("SELECT * FROM languages WHERE id = $1", [id], rowLanguage);
  }

  async getAllLanguages(): Promise<Language[]> {
    return queryMany("SELECT * FROM languages ORDER BY created_at DESC", [], rowLanguage);
  }

  async getLanguages(employeeId: string): Promise<Language[]> {
    return this.getLanguagesByEmployee(employeeId);
  }

  async getLanguagesByEmployee(employeeId: string): Promise<Language[]> {
    return queryMany("SELECT * FROM languages WHERE employee_id = $1 ORDER BY created_at DESC", [employeeId], rowLanguage);
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    await databaseReady;
    const id = (language as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO languages (
        id, employee_id, language, proficiency_level, test_type, test_level,
        score, max_score, test_date, certificate_url, is_active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11
      ) RETURNING *`,
      [
        id,
        language.employeeId,
        language.language,
        language.proficiencyLevel,
        language.testType ?? null,
        language.testLevel ?? null,
        toInteger(language.score),
        toInteger(language.maxScore),
        toDate((language as any).testDate),
        language.certificateUrl ?? null,
        language.isActive ?? true,
      ],
    );
    return rowLanguage(result.rows[0]);
  }

  async updateLanguage(id: string, language: Partial<InsertLanguage>): Promise<Language> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: language.employeeId,
      language: language.language,
      proficiency_level: language.proficiencyLevel,
      test_type: language.testType,
      test_level: language.testLevel,
      score: toInteger(language.score),
      max_score: toInteger(language.maxScore),
      test_date: toDate((language as any).testDate),
      certificate_url: language.certificateUrl,
      is_active: language.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getLanguage(id);
      if (!existing) throw new Error("Language not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE languages SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Language not found");
    return rowLanguage(result.rows[0]);
  }

  async deleteLanguage(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM languages WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteLanguagesByEmployee(employeeId: string): Promise<boolean> {
    await databaseReady;
    await pool.query("DELETE FROM languages WHERE employee_id = $1", [employeeId]);
    return true;
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    return queryOne("SELECT * FROM skills WHERE id = $1", [id], rowSkill);
  }

  async getAllSkills(): Promise<Skill[]> {
    return queryMany("SELECT * FROM skills ORDER BY created_at DESC", [], rowSkill);
  }

  async getSkillsByEmployee(employeeId: string): Promise<Skill[]> {
    return queryMany("SELECT * FROM skills WHERE employee_id = $1 ORDER BY created_at DESC", [employeeId], rowSkill);
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    await databaseReady;
    const id = (skill as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO skills (
        id, employee_id, skill_type, skill_name, proficiency_level,
        years_of_experience, last_assessed_date, assessed_by, notes, is_active
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10
      ) RETURNING *`,
      [
        id,
        skill.employeeId,
        skill.skillType,
        skill.skillName,
        skill.proficiencyLevel,
        toNumber(skill.yearsOfExperience),
        toDate((skill as any).lastAssessedDate),
        skill.assessedBy ?? null,
        skill.notes ?? null,
        skill.isActive ?? true,
      ],
    );
    return rowSkill(result.rows[0]);
  }

  async updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: skill.employeeId,
      skill_type: skill.skillType,
      skill_name: skill.skillName,
      proficiency_level: toInteger(skill.proficiencyLevel),
      years_of_experience: toNumber(skill.yearsOfExperience),
      last_assessed_date: toDate((skill as any).lastAssessedDate),
      assessed_by: skill.assessedBy,
      notes: skill.notes,
      is_active: skill.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getSkill(id);
      if (!existing) throw new Error("Skill not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE skills SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Skill not found");
    return rowSkill(result.rows[0]);
  }

  async deleteSkill(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM skills WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getSkillCalculation(id: string): Promise<SkillCalculation | undefined> {
    const byEmployee = await queryOne("SELECT * FROM skill_calculations WHERE employee_id = $1", [id], rowSkillCalculation);
    if (byEmployee) return byEmployee;
    return queryOne("SELECT * FROM skill_calculations WHERE id = $1", [id], rowSkillCalculation);
  }

  async getAllSkillCalculations(): Promise<SkillCalculation[]> {
    return queryMany("SELECT * FROM skill_calculations ORDER BY last_calculated_at DESC", [], rowSkillCalculation);
  }

  async getSkillCalculationsByEmployee(employeeId: string): Promise<SkillCalculation[]> {
    return queryMany("SELECT * FROM skill_calculations WHERE employee_id = $1 ORDER BY last_calculated_at DESC", [employeeId], rowSkillCalculation);
  }

  async createSkillCalculation(calculation: InsertSkillCalculation): Promise<SkillCalculation> {
    await databaseReady;
    const id = (calculation as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO skill_calculations (
        id, employee_id, experience_score, certification_score, language_score,
        training_score, technical_score, soft_skill_score, overall_score, calculated_by
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10
      )
      ON CONFLICT (employee_id) DO UPDATE SET
        experience_score = EXCLUDED.experience_score,
        certification_score = EXCLUDED.certification_score,
        language_score = EXCLUDED.language_score,
        training_score = EXCLUDED.training_score,
        technical_score = EXCLUDED.technical_score,
        soft_skill_score = EXCLUDED.soft_skill_score,
        overall_score = EXCLUDED.overall_score,
        calculated_by = EXCLUDED.calculated_by,
        last_calculated_at = NOW()
      RETURNING *`,
      [
        id,
        calculation.employeeId,
        calculation.experienceScore ?? 0,
        calculation.certificationScore ?? 0,
        calculation.languageScore ?? 0,
        calculation.trainingScore ?? 0,
        calculation.technicalScore ?? 0,
        calculation.softSkillScore ?? 0,
        calculation.overallScore ?? 0,
        calculation.calculatedBy ?? null,
      ],
    );
    return rowSkillCalculation(result.rows[0]);
  }

  async updateSkillCalculation(id: string, calculation: Partial<InsertSkillCalculation>): Promise<SkillCalculation> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: calculation.employeeId,
      experience_score: toNumber(calculation.experienceScore),
      certification_score: toNumber(calculation.certificationScore),
      language_score: toNumber(calculation.languageScore),
      training_score: toNumber(calculation.trainingScore),
      technical_score: toNumber(calculation.technicalScore),
      soft_skill_score: toNumber(calculation.softSkillScore),
      overall_score: toNumber(calculation.overallScore),
      calculated_by: calculation.calculatedBy,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getSkillCalculation(id);
      if (!existing) throw new Error("Skill calculation not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("last_calculated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE skill_calculations SET ${setClause} WHERE id = $1 OR employee_id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Skill calculation not found");
    return rowSkillCalculation(result.rows[0]);
  }

  async deleteSkillCalculation(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM skill_calculations WHERE id = $1 OR employee_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createOrUpdateSkillCalculation(calculation: InsertSkillCalculation): Promise<SkillCalculation> {
    return this.createSkillCalculation(calculation);
  }

  async getPatent(id: string): Promise<any> {
    return queryOne("SELECT * FROM patents WHERE id = $1", [id], rowPatent);
  }

  async getAllPatents(): Promise<any[]> {
    return queryMany("SELECT * FROM patents ORDER BY application_date DESC NULLS LAST, created_at DESC", [], rowPatent);
  }

  async getPatentsByEmployee(employeeId: string): Promise<any[]> {
    return queryMany("SELECT * FROM patents WHERE employee_id = $1 ORDER BY application_date DESC NULLS LAST, created_at DESC", [employeeId], rowPatent);
  }

  async createPatent(patent: InsertPatent | Record<string, any>): Promise<any> {
    await databaseReady;
    const id = patent.id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO patents (
        id, employee_id, title, application_number, patent_number, status,
        application_date, registration_date, inventors, description, category, priority, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9::jsonb,$10,$11,$12,NOW()
      ) RETURNING *`,
      [
        id,
        patent.employeeId,
        patent.title,
        patent.applicationNumber ?? null,
        patent.patentNumber ?? null,
        patent.status ?? "pending",
        toDate(patent.applicationDate),
        toDate((patent as any).registrationDate ?? (patent as any).grantDate),
        JSON.stringify(ensureArray((patent as any).inventors)),
        patent.description ?? null,
        patent.category ?? null,
        (patent as any).priority ?? null,
      ],
    );
    return rowPatent(result.rows[0]);
  }

  async updatePatent(id: string, patent: Partial<InsertPatent> | Record<string, any>): Promise<any> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: patent.employeeId,
      title: patent.title,
      application_number: patent.applicationNumber,
      patent_number: patent.patentNumber,
      status: patent.status,
      application_date: toDate(patent.applicationDate),
      registration_date: toDate((patent as any).registrationDate ?? (patent as any).grantDate),
      inventors: (patent as any).inventors ? JSON.stringify(ensureArray((patent as any).inventors)) : undefined,
      description: patent.description,
      category: patent.category,
      priority: (patent as any).priority,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getPatent(id);
      if (!existing) throw new Error("Patent not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}${column === "inventors" ? "::jsonb" : ""}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE patents SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Patent not found");
    return rowPatent(result.rows[0]);
  }

  async deletePatent(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM patents WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getPublication(id: string): Promise<any> {
    return queryOne("SELECT * FROM publications WHERE id = $1", [id], rowPublication);
  }

  async getAllPublications(): Promise<any[]> {
    return queryMany("SELECT * FROM publications ORDER BY publication_date DESC NULLS LAST, created_at DESC", [], rowPublication);
  }

  async getPublicationsByEmployee(employeeId: string): Promise<any[]> {
    return queryMany("SELECT * FROM publications WHERE employee_id = $1 ORDER BY publication_date DESC NULLS LAST, created_at DESC", [employeeId], rowPublication);
  }

  async createPublication(publication: InsertPublication | Record<string, any>): Promise<any> {
    await databaseReady;
    const id = publication.id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO publications (
        id, employee_id, title, authors, journal, publication_date, doi,
        impact_factor, category, level, description, conference, url, updated_at
      ) VALUES (
        $1,$2,$3,$4::jsonb,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,NOW()
      ) RETURNING *`,
      [
        id,
        publication.employeeId,
        publication.title,
        JSON.stringify(ensureArray((publication as any).authors)),
        (publication as any).journal ?? null,
        toDate((publication as any).publicationDate),
        (publication as any).doi ?? null,
        toNumber((publication as any).impactFactor),
        (publication as any).category ?? (publication as any).publicationType ?? "journal",
        (publication as any).level ?? (publication as any).status ?? null,
        (publication as any).description ?? (publication as any).abstract ?? null,
        (publication as any).conference ?? null,
        (publication as any).url ?? null,
      ],
    );
    return rowPublication(result.rows[0]);
  }

  async updatePublication(id: string, publication: Partial<InsertPublication> | Record<string, any>): Promise<any> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: publication.employeeId,
      title: publication.title,
      authors: (publication as any).authors ? JSON.stringify(ensureArray((publication as any).authors)) : undefined,
      journal: (publication as any).journal,
      publication_date: toDate((publication as any).publicationDate),
      doi: (publication as any).doi,
      impact_factor: toNumber((publication as any).impactFactor),
      category: (publication as any).category ?? (publication as any).publicationType,
      level: (publication as any).level ?? (publication as any).status,
      description: (publication as any).description ?? (publication as any).abstract,
      conference: (publication as any).conference,
      url: (publication as any).url,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getPublication(id);
      if (!existing) throw new Error("Publication not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}${column === "authors" ? "::jsonb" : ""}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE publications SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Publication not found");
    return rowPublication(result.rows[0]);
  }

  async deletePublication(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM publications WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getAward(id: string): Promise<any> {
    return queryOne("SELECT * FROM awards WHERE id = $1", [id], rowAward);
  }

  async getAllAwards(): Promise<any[]> {
    return queryMany("SELECT * FROM awards ORDER BY award_date DESC NULLS LAST, created_at DESC", [], rowAward);
  }

  async getAwardsByEmployee(employeeId: string): Promise<any[]> {
    return queryMany("SELECT * FROM awards WHERE employee_id = $1 ORDER BY award_date DESC NULLS LAST, created_at DESC", [employeeId], rowAward);
  }

  async createAward(award: InsertAward | Record<string, any>): Promise<any> {
    await databaseReady;
    const id = award.id ?? uniqueId();
    const teamMembers = ensureArray((award as any).teamMembers);
    const result = await pool.query(
      `INSERT INTO awards (
        id, employee_id, title, awarding_organization, category, level, award_date,
        description, certificate_url, monetary_value, is_team_award, team_members, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12::jsonb,NOW()
      ) RETURNING *`,
      [
        id,
        award.employeeId,
        (award as any).title ?? (award as any).awardName,
        (award as any).awardingOrganization ?? null,
        award.category ?? null,
        award.level ?? "company",
        toDate((award as any).awardDate),
        award.description ?? null,
        award.certificateUrl ?? null,
        toNumber((award as any).monetaryValue),
        teamMembers.length > 0 || (award as any).isTeamAward === true,
        JSON.stringify(teamMembers),
      ],
    );
    return rowAward(result.rows[0]);
  }

  async updateAward(id: string, award: Partial<InsertAward> | Record<string, any>): Promise<any> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: award.employeeId,
      title: (award as any).title ?? (award as any).awardName,
      awarding_organization: (award as any).awardingOrganization,
      category: award.category,
      level: award.level,
      award_date: toDate((award as any).awardDate),
      description: award.description,
      certificate_url: award.certificateUrl,
      monetary_value: toNumber((award as any).monetaryValue),
      is_team_award: (award as any).isTeamAward,
      team_members: (award as any).teamMembers ? JSON.stringify(ensureArray((award as any).teamMembers)) : undefined,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getAward(id);
      if (!existing) throw new Error("Award not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}${column === "team_members" ? "::jsonb" : ""}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE awards SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Award not found");
    return rowAward(result.rows[0]);
  }

  async deleteAward(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM awards WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getProject(id: string): Promise<any> {
    return queryOne("SELECT * FROM projects WHERE id = $1", [id], rowProject);
  }

  async getAllProjects(): Promise<any[]> {
    return queryMany("SELECT * FROM projects ORDER BY start_date DESC NULLS LAST, created_at DESC", [], rowProject);
  }

  async getProjectsByEmployee(employeeId: string): Promise<any[]> {
    return queryMany("SELECT * FROM projects WHERE employee_id = $1 ORDER BY start_date DESC NULLS LAST, created_at DESC", [employeeId], rowProject);
  }

  async createProject(project: InsertProject | Record<string, any>): Promise<any> {
    await databaseReady;
    const id = project.id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO projects (
        id, employee_id, project_name, role, start_date, end_date, status,
        description, technologies, team_size, budget, client, is_internal, notes, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,NOW()
      ) RETURNING *`,
      [
        id,
        project.employeeId,
        project.projectName,
        project.role,
        toDate(project.startDate),
        toDate(project.endDate),
        project.status ?? "planned",
        project.description ?? null,
        project.technologies ?? null,
        toInteger(project.teamSize),
        toNumber(project.budget),
        project.client ?? null,
        project.isInternal ?? false,
        (project as any).notes ?? null,
      ],
    );
    return rowProject(result.rows[0]);
  }

  async updateProject(id: string, project: Partial<InsertProject> | Record<string, any>): Promise<any> {
    await databaseReady;
    const payload = stripUndefined({
      employee_id: project.employeeId,
      project_name: project.projectName,
      role: project.role,
      start_date: toDate(project.startDate),
      end_date: toDate(project.endDate),
      status: project.status,
      description: project.description,
      technologies: project.technologies,
      team_size: toInteger(project.teamSize),
      budget: toNumber(project.budget),
      client: project.client,
      is_internal: project.isInternal,
      notes: (project as any).notes,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getProject(id);
      if (!existing) throw new Error("Project not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE projects SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Project not found");
    return rowProject(result.rows[0]);
  }

  async deleteProject(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getTrainingHours(id: string): Promise<TrainingHours | undefined> {
    return queryOne("SELECT * FROM training_hours WHERE id = $1", [id], rowTrainingHours);
  }

  async getAllTrainingHours(): Promise<TrainingHours[]> {
    return queryMany("SELECT * FROM training_hours ORDER BY year DESC, team ASC", [], rowTrainingHours);
  }

  async getTrainingHoursByYearRange(startYear: number, endYear: number): Promise<TrainingHours[]> {
    return queryMany("SELECT * FROM training_hours WHERE year BETWEEN $1 AND $2 ORDER BY year DESC, team ASC", [startYear, endYear], rowTrainingHours);
  }

  async createTrainingHours(trainingHours: InsertTrainingHours): Promise<TrainingHours> {
    await databaseReady;
    const id = (trainingHours as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO training_hours (id, year, team, training_type, hours, description, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [id, trainingHours.year, trainingHours.team, trainingHours.trainingType, trainingHours.hours, trainingHours.description ?? null],
    );
    return rowTrainingHours(result.rows[0]);
  }

  async updateTrainingHours(id: string, trainingHours: Partial<InsertTrainingHours>): Promise<TrainingHours> {
    await databaseReady;
    const payload = stripUndefined({
      year: toInteger(trainingHours.year),
      team: trainingHours.team,
      training_type: trainingHours.trainingType,
      hours: toNumber(trainingHours.hours),
      description: trainingHours.description,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getTrainingHours(id);
      if (!existing) throw new Error("Training hours not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE training_hours SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Training hours not found");
    return rowTrainingHours(result.rows[0]);
  }

  async deleteTrainingHours(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM training_hours WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getTeamEmployees(id: string): Promise<TeamEmployees | undefined> {
    return queryOne("SELECT * FROM team_employees WHERE id = $1", [id], rowTeamEmployees);
  }

  async getAllTeamEmployees(): Promise<TeamEmployees[]> {
    return queryMany("SELECT * FROM team_employees ORDER BY year DESC, team ASC", [], rowTeamEmployees);
  }

  async getTeamEmployeesByYearRange(startYear: number, endYear: number): Promise<TeamEmployees[]> {
    return queryMany("SELECT * FROM team_employees WHERE year BETWEEN $1 AND $2 ORDER BY year DESC, team ASC", [startYear, endYear], rowTeamEmployees);
  }

  async createTeamEmployees(teamEmployees: InsertTeamEmployees): Promise<TeamEmployees> {
    await databaseReady;
    const id = (teamEmployees as any).id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO team_employees (id, year, team, employee_count, description, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
      [id, teamEmployees.year, teamEmployees.team, teamEmployees.employeeCount, teamEmployees.description ?? null],
    );
    return rowTeamEmployees(result.rows[0]);
  }

  async updateTeamEmployees(id: string, teamEmployees: Partial<InsertTeamEmployees>): Promise<TeamEmployees> {
    await databaseReady;
    const payload = stripUndefined({
      year: toInteger(teamEmployees.year),
      team: teamEmployees.team,
      employee_count: toInteger(teamEmployees.employeeCount),
      description: teamEmployees.description,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = await this.getTeamEmployees(id);
      if (!existing) throw new Error("Team employees not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE team_employees SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Team employees not found");
    return rowTeamEmployees(result.rows[0]);
  }

  async deleteTeamEmployees(id: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM team_employees WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getEmployeeFullProfile(employeeId: string): Promise<any> {
    const employee = await this.getEmployee(employeeId);
    if (!employee) throw new Error("Employee not found");
    const [trainingHistory, certifications, languages, skills, skillCalculations, patents, publications, awards, projects] = await Promise.all([
      this.getTrainingHistoryByEmployee(employeeId),
      this.getCertificationsByEmployee(employeeId),
      this.getLanguagesByEmployee(employeeId),
      this.getSkillsByEmployee(employeeId),
      this.getSkillCalculationsByEmployee(employeeId),
      this.getPatentsByEmployee(employeeId),
      this.getPublicationsByEmployee(employeeId),
      this.getAwardsByEmployee(employeeId),
      this.getProjectsByEmployee(employeeId),
    ]);
    return { employee, trainingHistory, certifications, languages, skills, skillCalculations, patents, publications, awards, projects };
  }

  async getDepartments(): Promise<DepartmentRecord[]> {
    return queryMany("SELECT * FROM departments ORDER BY department_code", [], rowDepartment);
  }

  async createDepartment(department: DepartmentRecord): Promise<DepartmentRecord> {
    await databaseReady;
    const id = department.id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO departments (
        id, department_code, department_name, description, manager_id, budget, location, is_active, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,NOW()
      ) RETURNING *`,
      [id, department.code, department.name, department.description ?? null, department.managerId ?? null, toNumber(department.budget), department.location ?? null, department.isActive ?? true],
    );
    return rowDepartment(result.rows[0]);
  }

  async updateDepartment(code: string, department: Partial<DepartmentRecord>): Promise<DepartmentRecord> {
    await databaseReady;
    const payload = stripUndefined({
      department_name: department.name,
      description: department.description,
      manager_id: department.managerId,
      budget: toNumber(department.budget),
      location: department.location,
      is_active: department.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = (await this.getDepartments()).find((item) => item.code === code);
      if (!existing) throw new Error("Department not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(`UPDATE departments SET ${setClause} WHERE department_code = $1 RETURNING *`, [code, ...entries.map(([, value]) => value)]);
    if (!result.rows[0]) throw new Error("Department not found");
    return rowDepartment(result.rows[0]);
  }

  async deleteDepartment(code: string): Promise<boolean> {
    await databaseReady;
    await pool.query(`DELETE FROM teams WHERE department_id IN (SELECT id FROM departments WHERE department_code = $1)`, [code]);
    const result = await pool.query("DELETE FROM departments WHERE department_code = $1", [code]);
    return (result.rowCount ?? 0) > 0;
  }

  async getTeams(departmentCode?: string): Promise<TeamRecord[]> {
    const values: any[] = [];
    const where = departmentCode ? "WHERE d.department_code = $1" : "";
    if (departmentCode) values.push(departmentCode);
    return queryMany(
      `SELECT t.*, d.department_code
       FROM teams t
       JOIN departments d ON d.id = t.department_id
       ${where}
       ORDER BY t.team_code`,
      values,
      rowTeam,
    );
  }

  async createTeam(team: TeamRecord): Promise<TeamRecord> {
    await databaseReady;
    const department = await queryOne("SELECT * FROM departments WHERE department_code = $1", [team.departmentCode], rowDepartment);
    if (!department?.id) throw new Error("Department not found");
    const id = team.id ?? uniqueId();
    const result = await pool.query(
      `INSERT INTO teams (
        id, team_code, team_name, department_id, description, team_lead_id, budget, location, is_active, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()
      )
      RETURNING *, (SELECT department_code FROM departments WHERE id = $4) AS department_code`,
      [id, team.code, team.name, department.id, team.description ?? null, team.teamLeadId ?? null, toNumber(team.budget), team.location ?? null, team.isActive ?? true],
    );
    return rowTeam(result.rows[0]);
  }

  async updateTeam(code: string, team: Partial<TeamRecord>): Promise<TeamRecord> {
    await databaseReady;
    let departmentId: string | undefined;
    if (team.departmentCode) {
      const department = await queryOne("SELECT * FROM departments WHERE department_code = $1", [team.departmentCode], rowDepartment);
      if (!department?.id) throw new Error("Department not found");
      departmentId = department.id;
    }
    const payload = stripUndefined({
      team_name: team.name,
      department_id: departmentId,
      description: team.description,
      team_lead_id: team.teamLeadId,
      budget: toNumber(team.budget),
      location: team.location,
      is_active: team.isActive,
    });
    const entries = Object.entries(payload);
    if (entries.length === 0) {
      const existing = (await this.getTeams()).find((item) => item.code === code);
      if (!existing) throw new Error("Team not found");
      return existing;
    }
    const setClause = entries.map(([column], index) => `${column} = $${index + 2}`).concat("updated_at = NOW()").join(", ");
    const result = await pool.query(
      `UPDATE teams t
       SET ${setClause}
       FROM departments d
       WHERE t.team_code = $1 AND d.id = t.department_id
       RETURNING t.*, d.department_code`,
      [code, ...entries.map(([, value]) => value)],
    );
    if (!result.rows[0]) throw new Error("Team not found");
    return rowTeam(result.rows[0]);
  }

  async deleteTeam(code: string): Promise<boolean> {
    await databaseReady;
    const result = await pool.query("DELETE FROM teams WHERE team_code = $1", [code]);
    return (result.rowCount ?? 0) > 0;
  }

  async getProposals(filters: ProposalFilters = {}): Promise<ProposalRecord[]> {
    const clauses: string[] = [];
    const values: any[] = [];
    if (filters.employeeId) {
      values.push(filters.employeeId);
      clauses.push(`employee_id = $${values.length}`);
    }
    if (filters.startDate) {
      values.push(toDate(filters.startDate));
      clauses.push(`submission_date >= $${values.length}`);
    }
    if (filters.endDate) {
      values.push(toDate(filters.endDate));
      clauses.push(`submission_date <= $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return queryMany(`SELECT * FROM proposals ${where} ORDER BY submission_date DESC NULLS LAST, created_at DESC`, values, rowProposal);
  }

  async createProposal(proposal: ProposalRecord): Promise<ProposalRecord> {
    await databaseReady;
    const id = proposal.id || `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date();
    const payload = { ...proposal, id, createdAt: proposal.createdAt ?? now.toISOString(), updatedAt: proposal.updatedAt ?? now.toISOString() };
    const result = await pool.query(
      `INSERT INTO proposals (id, employee_id, submission_date, payload, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         employee_id = EXCLUDED.employee_id,
         submission_date = EXCLUDED.submission_date,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [id, proposal.employeeId, toDate(proposal.submissionDate), JSON.stringify(payload), toDate(payload.createdAt), toDate(payload.updatedAt)],
    );
    return rowProposal(result.rows[0]);
  }

  async deleteProposalsByEmployee(employeeId: string): Promise<number> {
    await databaseReady;
    const result = await pool.query("DELETE FROM proposals WHERE employee_id = $1", [employeeId]);
    return result.rowCount ?? 0;
  }

  async getAppSetting<T = any>(key: string): Promise<T | null> {
    return getSetting<T>(key);
  }

  async setAppSetting(key: string, value: JsonValue): Promise<void> {
    await upsertSetting(key, value);
  }
}

export const storage = new PostgresStorage();
