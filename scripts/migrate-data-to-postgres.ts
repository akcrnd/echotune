import fs from "fs";
import path from "path";

type SourceData = Record<string, any>;

function readSource(): SourceData {
  const dataPath = path.join(process.cwd(), "data.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

async function upsertById<T extends { id?: string }>(
  items: T[],
  getter: (id: string) => Promise<any>,
  creator: (item: T) => Promise<any>,
  updater: (id: string, item: T) => Promise<any>,
) {
  for (const item of items) {
    if (!item.id) continue;
    const existing = await getter(item.id);
    if (existing && !Array.isArray(existing)) {
      await updater(item.id, item);
    } else {
      await creator(item);
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const data = readSource();

  const employees = Object.values(data.employees ?? {});
  const trainingHistory = Object.values(data.trainingHistory ?? {});
  const certifications = Object.values(data.certifications ?? {});
  const languages = Object.values(data.languages ?? {});
  const skills = Object.values(data.skills ?? {});
  const skillCalculations = Object.values(data.skillCalculations ?? {});
  const patents = Object.values(data.patents ?? {});
  const publications = Object.values(data.publications ?? {});
  const awards = Object.values(data.awards ?? {});
  const projects = Object.values(data.projects ?? {});
  const trainingHours = Object.values(data.trainingHours ?? {});
  const teamEmployees = Object.values(data.teamEmployees ?? {});
  const departments = data.departments ?? [];
  const teams = data.teams ?? [];
  const proposals = Array.isArray(data.proposals)
    ? data.proposals
    : Object.values(data.proposals ?? {});

  const summary = {
    employees: employees.length,
    trainingHistory: trainingHistory.length,
    certifications: certifications.length,
    languages: languages.length,
    skills: skills.length,
    skillCalculations: skillCalculations.length,
    patents: patents.length,
    publications: publications.length,
    awards: awards.length,
    projects: projects.length,
    trainingHours: trainingHours.length,
    teamEmployees: teamEmployees.length,
    departments: departments.length,
    teams: teams.length,
    proposals: proposals.length,
    settings: ["viewState", "rdEvaluationCriteria", "detailedCriteria"].filter((key) => data[key] !== undefined).length,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const { storage } = await import("../server/storage");

  await upsertById(
    employees as any[],
    (id) => storage.getEmployee(id),
    (item) => storage.createEmployee(item as any),
    (id, item) => storage.updateEmployee(id, item as any),
  );

  await upsertById(
    trainingHistory as any[],
    async (id) => {
      const existing = await storage.getTrainingHistory(id);
      return Array.isArray(existing) ? undefined : existing;
    },
    (item) => storage.createTrainingHistory(item as any),
    (id, item) => storage.updateTrainingHistory(id, item as any),
  );

  await upsertById(
    certifications as any[],
    (id) => storage.getCertification(id),
    (item) => storage.createCertification(item as any),
    (id, item) => storage.updateCertification(id, item as any),
  );

  await upsertById(
    languages as any[],
    (id) => storage.getLanguage(id),
    (item) => storage.createLanguage(item as any),
    (id, item) => storage.updateLanguage(id, item as any),
  );

  await upsertById(
    skills as any[],
    (id) => storage.getSkill(id),
    (item) => storage.createSkill(item as any),
    (id, item) => storage.updateSkill(id, item as any),
  );

  for (const calculation of skillCalculations as any[]) {
    await storage.createOrUpdateSkillCalculation(calculation as any);
  }

  await upsertById(
    patents as any[],
    (id) => storage.getPatent(id),
    (item) => storage.createPatent(item as any),
    (id, item) => storage.updatePatent(id, item as any),
  );

  await upsertById(
    publications as any[],
    (id) => storage.getPublication(id),
    (item) => storage.createPublication(item as any),
    (id, item) => storage.updatePublication(id, item as any),
  );

  await upsertById(
    awards as any[],
    (id) => storage.getAward(id),
    (item) => storage.createAward(item as any),
    (id, item) => storage.updateAward(id, item as any),
  );

  await upsertById(
    projects as any[],
    (id) => storage.getProject(id),
    (item) => storage.createProject(item as any),
    (id, item) => storage.updateProject(id, item as any),
  );

  await upsertById(
    trainingHours as any[],
    (id) => storage.getTrainingHours(id),
    (item) => storage.createTrainingHours(item as any),
    (id, item) => storage.updateTrainingHours(id, item as any),
  );

  await upsertById(
    teamEmployees as any[],
    (id) => storage.getTeamEmployees(id),
    (item) => storage.createTeamEmployees(item as any),
    (id, item) => storage.updateTeamEmployees(id, item as any),
  );

  for (const department of departments as any[]) {
    const existing = (await storage.getDepartments()).find((item) => item.code === department.code);
    if (existing) {
      await storage.updateDepartment(department.code, department);
    } else {
      await storage.createDepartment(department);
    }
  }

  for (const team of teams as any[]) {
    const existing = (await storage.getTeams()).find((item) => item.code === team.code);
    if (existing) {
      await storage.updateTeam(team.code, team);
    } else {
      await storage.createTeam(team);
    }
  }

  for (const proposal of proposals as any[]) {
    await storage.createProposal(proposal as any);
  }

  if (data.viewState !== undefined) {
    await storage.setAppSetting("viewState", data.viewState);
  }
  if (data.rdEvaluationCriteria !== undefined) {
    await storage.setAppSetting("rdEvaluationCriteria", data.rdEvaluationCriteria);
  }
  if (data.detailedCriteria !== undefined) {
    await storage.setAppSetting("detailedCriteria", data.detailedCriteria);
  }

  console.log("Migration completed");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
