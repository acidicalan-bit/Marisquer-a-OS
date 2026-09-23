import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const environment = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const executable = path.resolve(
  "dist-installers",
  "win-unpacked",
  "Barlovento Admin.exe",
);
const application = spawn(executable, [], {
  windowsHide: true,
  detached: true,
  stdio: "ignore",
});

try {
  let healthy = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await delay(700);
    try {
      const response = await fetch("http://127.0.0.1:3210/api/health", {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {}
  }
  if (!healthy) throw new Error("El servidor empaquetado no inició.");

  const audit = spawnSync(
    process.execPath,
    ["scripts/audit-authenticated-apps.mjs"],
    {
      encoding: "utf8",
      timeout: 180_000,
      env: {
        ...process.env,
        ...environment,
        AUDIT_BASE_URL: "http://127.0.0.1:3210",
      },
    },
  );
  if (audit.stdout) process.stdout.write(audit.stdout);
  if (audit.stderr) process.stderr.write(audit.stderr);
  if (audit.status !== 0) {
    throw new Error(`La auditoría del instalable terminó con código ${audit.status}.`);
  }
  console.log("Aplicación Windows empaquetada verificada en localhost:3210.");
} finally {
  if (application.pid) {
    try {
      spawnSync(
        "taskkill.exe",
        ["/PID", String(application.pid), "/T", "/F"],
        { stdio: "ignore" },
      );
    } catch {}
  }
}
