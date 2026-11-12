import "server-only";

import { networkInterfaces } from "node:os";

function isPrivateIPv4(address: string) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

export function getLocalServerAddresses() {
  const defaultPort = process.env.NODE_ENV === "development" ? 3000 : 3210;
  const port = Number(process.env.PORT || defaultPort);
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter(
      (entry) =>
        entry.family === "IPv4" &&
        !entry.internal &&
        isPrivateIPv4(entry.address),
    )
    .map((entry) => `http://${entry.address}:${port}`);

  return [...new Set(addresses)];
}
