import { Pool, types } from "pg";

const TIMESTAMP_OIDS = [1114, 1184];
const DATE_OIDS = [1082];

for (const oid of TIMESTAMP_OIDS) {
  types.setTypeParser(oid, (value) => new Date(value));
}

for (const oid of DATE_OIDS) {
  types.setTypeParser(oid, (value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));
}

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required for runtime storage");
  }
  return value;
}

export const pool = new Pool({
  connectionString: requireDatabaseUrl(),
});

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_number VARCHAR NOT NULL UNIQUE,
  department_code VARCHAR NOT NULL,
  team_code VARCHAR,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  team TEXT,
  email TEXT,
  phone TEXT,
  hire_date TIMESTAMPTZ,
  birth_date TIMESTAMPTZ,
  manager_id VARCHAR,
  photo_url TEXT,
  education TEXT,
  major TEXT,
  school TEXT,
  graduation_year INTEGER,
  previous_experience_years INTEGER DEFAULT 0,
  previous_experience_months INTEGER DEFAULT 0,
  is_department_head BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  duration INTEGER,
  score REAL,
  status TEXT NOT NULL DEFAULT 'planned',
  instructor_role TEXT,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  credential_id TEXT,
  verification_url TEXT,
  category TEXT NOT NULL,
  level TEXT,
  score REAL,
  score_at_acquisition REAL,
  scoring_criteria_version TEXT,
  use_fixed_score BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS languages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  proficiency_level TEXT NOT NULL,
  test_type TEXT,
  test_level TEXT,
  score INTEGER,
  max_score INTEGER,
  test_date TIMESTAMPTZ,
  certificate_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_type TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  proficiency_level INTEGER NOT NULL,
  years_of_experience REAL,
  last_assessed_date TIMESTAMPTZ,
  assessed_by TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_calculations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  experience_score REAL NOT NULL DEFAULT 0,
  certification_score REAL NOT NULL DEFAULT 0,
  language_score REAL NOT NULL DEFAULT 0,
  training_score REAL NOT NULL DEFAULT 0,
  technical_score REAL NOT NULL DEFAULT 0,
  soft_skill_score REAL NOT NULL DEFAULT 0,
  overall_score REAL NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by TEXT
);

CREATE TABLE IF NOT EXISTS patents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  application_number TEXT,
  patent_number TEXT,
  status TEXT NOT NULL,
  application_date TIMESTAMPTZ,
  registration_date TIMESTAMPTZ,
  inventors JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  category TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  journal TEXT,
  publication_date TIMESTAMPTZ,
  doi TEXT,
  impact_factor REAL,
  category TEXT DEFAULT 'journal',
  level TEXT,
  description TEXT,
  conference TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS awards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  awarding_organization TEXT,
  category TEXT,
  level TEXT NOT NULL DEFAULT 'company',
  award_date TIMESTAMPTZ,
  description TEXT,
  certificate_url TEXT,
  monetary_value REAL,
  is_team_award BOOLEAN DEFAULT FALSE,
  team_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL,
  description TEXT,
  technologies TEXT,
  team_size INTEGER,
  budget REAL,
  client TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_hours (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  year INTEGER NOT NULL,
  team TEXT NOT NULL,
  training_type TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_employees (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  year INTEGER NOT NULL,
  team TEXT NOT NULL,
  employee_count INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  department_code VARCHAR NOT NULL UNIQUE,
  department_name TEXT NOT NULL,
  description TEXT,
  manager_id VARCHAR REFERENCES employees(id) ON DELETE SET NULL,
  budget REAL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_code VARCHAR NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  department_id VARCHAR NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  description TEXT,
  team_lead_id VARCHAR REFERENCES employees(id) ON DELETE SET NULL,
  budget REAL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id VARCHAR PRIMARY KEY,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  submission_date TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rd_evaluations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evaluation_year INTEGER NOT NULL,
  evaluation_period TEXT NOT NULL DEFAULT 'annual',
  technical_competency_score REAL NOT NULL DEFAULT 0,
  technical_competency_details JSONB,
  project_experience_score REAL NOT NULL DEFAULT 0,
  project_experience_details JSONB,
  rd_achievement_score REAL NOT NULL DEFAULT 0,
  rd_achievement_details JSONB,
  global_competency_score REAL NOT NULL DEFAULT 0,
  global_competency_details JSONB,
  knowledge_sharing_score REAL NOT NULL DEFAULT 0,
  knowledge_sharing_details JSONB,
  innovation_proposal_score REAL NOT NULL DEFAULT 0,
  innovation_proposal_details JSONB,
  total_score REAL NOT NULL DEFAULT 0,
  grade TEXT,
  evaluated_by VARCHAR,
  evaluation_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft',
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  criteria_name TEXT NOT NULL,
  description TEXT,
  weight REAL NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  scoring_method TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  evaluation_id VARCHAR NOT NULL REFERENCES rd_evaluations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_value JSONB,
  item_score REAL NOT NULL DEFAULT 0,
  item_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  evaluation_id VARCHAR NOT NULL REFERENCES rd_evaluations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by VARCHAR NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  comments TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_history_employee_id ON training_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_certifications_employee_id ON certifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_languages_employee_id ON languages(employee_id);
CREATE INDEX IF NOT EXISTS idx_skills_employee_id ON skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_patents_employee_id ON patents(employee_id);
CREATE INDEX IF NOT EXISTS idx_publications_employee_id ON publications(employee_id);
CREATE INDEX IF NOT EXISTS idx_awards_employee_id ON awards(employee_id);
CREATE INDEX IF NOT EXISTS idx_projects_employee_id ON projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_proposals_employee_id ON proposals(employee_id);
CREATE INDEX IF NOT EXISTS idx_rd_evaluations_employee_year ON rd_evaluations(employee_id, evaluation_year);
`;

let schemaReadyPromise: Promise<void> | null = null;

export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(schemaSql);
    })();
  }

  return schemaReadyPromise;
}

export async function assertDatabaseReady(): Promise<void> {
  await ensureDatabaseSchema();
  await pool.query("SELECT 1");
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await assertDatabaseReady();
    return true;
  } catch {
    return false;
  }
}
