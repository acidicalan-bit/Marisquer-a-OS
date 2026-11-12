import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transformAsync } from "@babel/core";
import presetEnv from "@babel/preset-env";

const root = path.join(process.cwd(), ".next", "static");

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(fullPath)));
    else if (entry.isFile() && fullPath.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

const files = await filesIn(root);
let transformed = 0;
for (const file of files) {
  const source = await readFile(file, "utf8");
  const result = await transformAsync(source, {
    babelrc: false,
    configFile: false,
    comments: false,
    compact: true,
    sourceType: "unambiguous",
    presets: [[presetEnv, { targets: { chrome: "75" }, modules: false }]],
  });
  if (result?.code && result.code !== source) {
    await writeFile(file, result.code, "utf8");
    transformed += 1;
  }
}

console.log(`Transformed ${transformed} JavaScript bundles for Chrome 75.`);
