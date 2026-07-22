import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "assets", "brand", "marisqueria-os-icon.png");
const res = path.join(root, "android", "app", "src", "main", "res");
const navy = { r: 5, g: 29, b: 43, alpha: 1 };

async function emblem(size, fill = 0.72) {
  const markSize = Math.round(size * fill);
  const mark = await sharp(source)
    .resize(markSize, markSize, { fit: "contain" })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: navy },
  }).composite([{ input: mark, gravity: "center" }]);
}

const densities = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

for (const [density, size] of Object.entries(densities)) {
  const directory = path.join(res, `mipmap-${density}`);
  await mkdir(directory, { recursive: true });
  await (
    await emblem(size, 0.76)
  )
    .png()
    .toFile(path.join(directory, "ic_launcher.png"));

  const roundMask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
  );
  const square = await (await emblem(size, 0.7)).png().toBuffer();
  await sharp(square)
    .composite([{ input: roundMask, blend: "dest-in" }])
    .png()
    .toFile(path.join(directory, "ic_launcher_round.png"));

  await (
    await emblem(Math.round(size * 2.25), 0.62)
  )
    .png()
    .toFile(path.join(directory, "ic_launcher_foreground.png"));
}

await (
  await emblem(1024, 0.76)
)
  .png()
  .toFile(path.join(root, "assets", "brand", "marisqueria-os-windows.png"));

await (
  await emblem(512, 0.76)
)
  .png()
  .toFile(path.join(root, "src", "app", "icon.png"));
