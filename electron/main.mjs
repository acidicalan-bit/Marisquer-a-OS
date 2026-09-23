import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

let serverProcess;
let allowedOrigin;
const electronDirectory = path.dirname(fileURLToPath(import.meta.url));

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
  const privateConfigPath = path.join(
    process.env.APPDATA || app.getPath("appData"),
    "Barlovento",
    "Admin",
    "server-config.json",
  );
  let privateRuntime = {};
  try {
    privateRuntime = JSON.parse(await readFile(privateConfigPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!privateRuntime || typeof privateRuntime !== "object") {
    throw new Error("La configuración privada de Barlovento no es válida.");
  }
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
      SUPABASE_SECRET_KEY: privateRuntime.SUPABASE_SECRET_KEY,
      OPENAI_API_KEY: privateRuntime.OPENAI_API_KEY,
      OPENAI_ASSISTANT_MODEL: privateRuntime.OPENAI_ASSISTANT_MODEL,
      OPENAI_IMAGE_MODEL: privateRuntime.OPENAI_IMAGE_MODEL,
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
    title: "Barlovento Admin",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(electronDirectory, "preload.mjs"),
    },
  });
  void window.loadURL(new URL("/admin", allowedOrigin).toString());
  window.webContents.setWindowOpenHandler(({ url }) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return { action: "deny" };
    }
    if (target.origin === allowedOrigin.origin) return { action: "allow" };
    if (target.protocol === "https:" || target.protocol === "http:") {
      void shell.openExternal(target.toString());
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== allowedOrigin.origin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
}

ipcMain.handle("list-printers", async (event) => {
  try {
    if (
      !allowedOrigin ||
      new URL(event.senderFrame.url).origin !== allowedOrigin.origin
    )
      return { success: false, printers: [], error: "Origen no autorizado." };
    const printers = await event.sender.getPrintersAsync();
    return {
      success: true,
      printers: printers.map(
        ({ name, displayName, description, isDefault }) => ({
          name,
          displayName: displayName || name,
          description: description || "",
          isDefault,
        }),
      ),
    };
  } catch (error) {
    return {
      success: false,
      printers: [],
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron consultar las impresoras.",
    };
  }
});

ipcMain.handle("print-receipt", async (event, options = {}) => {
  try {
    if (
      !allowedOrigin ||
      new URL(event.senderFrame.url).origin !== allowedOrigin.origin
    )
      return { success: false, error: "Origen de impresión no autorizado." };
    const requestedDevice =
      typeof options.deviceName === "string" ? options.deviceName.trim() : "";
    if (requestedDevice) {
      const printers = await event.sender.getPrintersAsync();
      if (!printers.some((printer) => printer.name === requestedDevice)) {
        return {
          success: false,
          error: "La impresora seleccionada ya no está disponible en Windows.",
        };
      }
    }
    return await new Promise((resolve) => {
      event.sender.print(
        {
          silent: true,
          printBackground: true,
          usePrinterDefaultPageSize: true,
          deviceName: requestedDevice || undefined,
        },
        (success, failureReason) =>
          resolve({
            success,
            error: success ? undefined : failureReason || "Falló la impresión.",
          }),
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falló la impresión.",
    };
  }
});

void app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "No se pudo iniciar Barlovento",
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
