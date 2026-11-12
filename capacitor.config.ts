import type { CapacitorConfig } from "@capacitor/cli";

const role = process.env.MOBILE_ROLE ?? "admin";
const profiles = {
  admin: {
    appId: "mx.marisqueria.os.admin",
    appName: "Marisquería OS Admin",
  },
  service: {
    appId: "mx.marisqueria.os.service",
    appName: "Marisquería OS Meseros",
  },
  cashier: {
    appId: "mx.marisqueria.os.cashier",
    appName: "Marisquería OS Caja",
  },
} as const;
const profile = profiles[role as keyof typeof profiles] ?? profiles.admin;
const config: CapacitorConfig = {
  appId: profile.appId,
  appName: profile.appName,
  webDir: "mobile-shell",
  server: {
    cleartext: true,
    allowNavigation: ["*"],
  },
  android: { backgroundColor: "#071f29" },
};

export default config;
