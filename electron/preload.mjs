import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("marisqueriaDesktop", {
  listPrinters: () => ipcRenderer.invoke("list-printers"),
  printReceipt: (deviceName) =>
    ipcRenderer.invoke("print-receipt", { deviceName }),
});
