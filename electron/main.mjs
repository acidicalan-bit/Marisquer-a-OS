import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { app, BrowserWindow, dialog, shell } from "electron";

let serverProcess;
let allowedOrigin;

async function startServer() {
  if (!app.isPackaged) {
    allowedOrigin = new URL(
      process.env.MARISQUERIA_APP_URL || "http://localhost:3000",
    );
    return;
  }
  const appRoot = app.getAppPath();
  const runtime = JSON.parse(
    await readFile(
      path.join(appRoot, "electron", "runtime-config.json"),
      "utf8",
    ),
  );
  const port = "3210";
  allowedOrigin = new URL(`http://127.0.0.1:${port}`);
  const serverPath = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    ".next",
    "standalone",
    "server.js",
  );
  serverProcess = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    execPath: process.execPath,
    env: {
      ...process.env,
      ...runtime,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "0.0.0.0",
      PORT: port,
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(allowedOrigin);
      if (response.ok || response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("El servidor local no respondió en 30 segundos.");
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f7f8f6",
    title: "Marisquería OS Admin",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void window.loadURL(new URL("/admin", allowedOrigin).toString());
  window.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    if (target.origin === allowedOrigin.origin) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== allowedOrigin.origin) event.preventDefault();
  });
}

void app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "No se pudo iniciar Marisquería OS",
      error instanceof Error ? error.message : "Error desconocido",
    );
    app.quit();
    return;
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  serverProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});
