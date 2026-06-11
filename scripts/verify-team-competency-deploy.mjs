const baseUrl = (process.argv[2] ?? process.env.ECHOTUNE_BASE_URL ?? "http://localhost:5000").replace(/\/$/, "");
const teamCode = process.env.ECHOTUNE_VERIFY_TEAM_CODE ?? "RND05";
const year = process.env.ECHOTUNE_VERIFY_YEAR ?? String(new Date().getFullYear());

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { response, text };
}

function assertJsonResponse(label, text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(`${label} returned non-JSON content. This usually means the running app is an old frontend bundle or the API route is missing.`);
  }

  return JSON.parse(text);
}

const health = await getText("/api/health");
if (!health.response.ok) {
  throw new Error(`Health check failed: ${health.response.status} ${health.text}`);
}
const healthBody = assertJsonResponse("Health check", health.text);
if (healthBody.status !== "ok" || healthBody.database !== true) {
  throw new Error(`Health check is not ready: ${health.text}`);
}

const reportsPath = `/api/team-competency/reports?teamCode=${encodeURIComponent(teamCode)}&year=${encodeURIComponent(year)}`;
const reports = await getText(reportsPath);
if (!reports.response.ok) {
  throw new Error(`Team competency report list failed: ${reports.response.status} ${reports.text}`);
}
const reportRows = assertJsonResponse("Team competency report list", reports.text);
if (!Array.isArray(reportRows)) {
  throw new Error(`Team competency report list did not return an array: ${reports.text}`);
}

const page = await getText("/team-competency");
if (!page.response.ok) {
  throw new Error(`Team competency page failed: ${page.response.status}`);
}
if (!page.text.includes("/assets/index-")) {
  throw new Error("Team competency page did not return the built frontend shell.");
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  teamCode,
  year,
  reportCount: reportRows.length,
  health: healthBody,
}, null, 2));
