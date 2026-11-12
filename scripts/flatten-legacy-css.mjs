import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import postcss from "postcss";

const cssRoot = path.resolve(".next/static");

async function collectCss(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectCss(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(entryPath);
  }
  return files;
}

const files = await collectCss(cssRoot);
for (const file of files) {
  const root = postcss.parse(await readFile(file, "utf8"), { from: file });
  const unwrap = (rule) => {
    if (!rule.nodes) {
      rule.remove();
      return;
    }

    for (const child of rule.nodes.slice()) {
      child.remove();
      rule.before(child);
    }
    rule.remove();
  };
  root.walkAtRules("layer", unwrap);
  // Tailwind v4 wraps its base variables in feature queries that Chrome 75
  // cannot parse. The declarations themselves remain valid legacy CSS.
  root.walkAtRules("supports", unwrap);
  // Chrome 75 ignores @property and can discard the complete stylesheet when
  // it appears before the utility rules. Custom properties still work without
  // registration, so remove only the unsupported registration blocks.
  root.walkAtRules("property", (rule) => rule.remove());
  await writeFile(file, root.toString(), "utf8");
}

console.log(`Removed CSS cascade-layer wrappers from ${files.length} bundles for legacy WebViews.`);
