import type { CapacitorConfig } from "@capacitor/cli";

const role = process.env.MOBILE_ROLE ?? "admin";
const profiles = {
  admin: {
    appId: "mx.marisqueria.os.admin",
    appName: "Barlovento Admin",
  },
  service: {
    appId: "mx.marisqueria.os.service",
    appName: "Barlovento Meseros",
  },
  kitchen: {
    appId: "mx.marisqueria.os.kitchen",
    appName: "Barlovento Cocina",
  },
  host: {
    appId: "mx.marisqueria.os.host",
    appName: "Barlovento Recepción",
  },
} as const;
const profile = profiles[role as keyof typeof profiles] ?? profiles.admin;
const privateNetworkHosts = [
  "localhost",
  "127.0.0.1",
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${index + 16}.*.*`),
];
const config: CapacitorConfig = {
  appId: profile.appId,
  appName: profile.appName,
  webDir: "mobile-shell",
  server: {
    cleartext: true,
    allowNavigation: privateNetworkHosts,
  },
  android: { backgroundColor: "#071f29" },
};

export default config;
