import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // Permite enviar imágenes de hasta 5 MB más el envoltorio multipart.
      // La acción mantiene la validación estricta del límite del bucket.
      bodySizeLimit: "8mb",
    },
  },
  output: "standalone",
};

export default nextConfig;
