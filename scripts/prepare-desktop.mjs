import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const stage = path.join(root, ".desktop-build");
const electronPackage = JSON.parse(
  await readFile(
    path.join(root, "node_modules", "electron", "package.json"),
    "utf8",
  ),
);
await cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
await cp(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
});

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(standalone, path.join(stage, ".next", "standalone"), {
  recursive: true,
});
await cp(path.join(root, "electron"), path.join(stage, "electron"), {
  recursive: true,
});
await mkdir(path.join(stage, "build"), { recursive: true });
await cp(
  path.join(root, "assets", "brand", "marisqueria-os.ico"),
  path.join(stage, "build", "icon.ico"),
);

const envText = await readFile(path.join(root, ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const runtimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
};
if (
  !runtimeConfig.NEXT_PUBLIC_SUPABASE_URL ||
  !runtimeConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
) {
  throw new Error("Faltan las variables públicas de Supabase en .env.local.");
}
await writeFile(
  path.join(stage, "electron", "runtime-config.json"),
  JSON.stringify(runtimeConfig),
  "utf8",
);
await writeFile(
  path.join(stage, "package.json"),
  JSON.stringify(
    {
      name: "marisqueria-os-admin",
      version: "0.1.0",
      private: true,
      main: "electron/main.mjs",
      description:
        "Sistema operativo premium para administración de restaurantes y marisquerías.",
      author: "Barlovento",
      build: {
        electronVersion: electronPackage.version,
        appId: "mx.marisqueria.os.admin.desktop",
        productName: "Barlovento Admin",
        directories: { output: "../dist-installers" },
        files: ["electron/**/*", ".next/standalone/**/*", "package.json"],
        asar: true,
        asarUnpack: [".next/standalone/**/*"],
        win: {
          target: "nsis",
          icon: "build/icon.ico",
          artifactName: "Barlovento-Admin-Setup-${version}.${ext}",
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
        },
      },
    },
    null,
    2,
  ),
  "utf8",
);
await writeFile(
  path.join(stage, "package-lock.json"),
  JSON.stringify(
    {
      name: "marisqueria-os-admin",
      version: "0.1.0",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { name: "marisqueria-os-admin", version: "0.1.0" },
      },
    },
    null,
    2,
  ),
  "utf8",
);
