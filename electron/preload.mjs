import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("marisqueriaDesktop", {
  printReceipt: () => ipcRenderer.invoke("print-receipt"),
});
