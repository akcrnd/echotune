import fs from "fs";
import path from "path";

const source = path.join(process.cwd(), "data.json");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetDir = path.join(process.cwd(), "backups");
const target = path.join(targetDir, `data-backup-${timestamp}.json`);

if (!fs.existsSync(source)) {
  throw new Error("data.json not found");
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);

console.log(target);
