// Renders the link-preview image and the app icons from og.html and icon.html.
// Needs Playwright with Chromium; install it outside the repo and point NODE_PATH at it.
//   NODE_PATH=/path/to/node_modules node tools/brand/render.js
//     writes assets/img/og-image.png, the three PNG icons, and favicon.ico
//   NODE_PATH=/path/to/node_modules node tools/brand/render.js OUT_DIR
//     writes the same files into OUT_DIR instead, for comparing
// og.html repeats the add-on module count, so change it and re-render whenever the
// catalog count changes (tools/check-site.mjs fails until og.html matches).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const out = process.argv[2] ? path.resolve(process.argv[2]) : null;
const target = (file) => (out ? path.join(out, path.basename(file)) : path.join(ROOT, file));

// An .ico file whose entries are PNG images (supported by every current browser).
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size, e);
    header.writeUInt8(size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

(async () => {
  if (out) fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.goto("file://" + path.join(__dirname, "og.html"));
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: target("assets/img/og-image.png") });

  const icon = async (size) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto("file://" + path.join(__dirname, "icon.html"));
    await page.evaluate((s) => {
      const svg = document.getElementById("i");
      svg.setAttribute("width", s);
      svg.setAttribute("height", s);
    }, size);
    const data = await page.screenshot({ omitBackground: true });
    await page.close();
    return data;
  };
  fs.writeFileSync(target("assets/img/apple-touch-icon.png"), await icon(180));
  fs.writeFileSync(target("assets/img/icon-192.png"), await icon(192));
  fs.writeFileSync(target("assets/img/icon-512.png"), await icon(512));
  fs.writeFileSync(target("favicon.ico"), ico([{ size: 16, data: await icon(16) }, { size: 32, data: await icon(32) }]));
  await browser.close();
})();
