// Draws the Panna notepad mark in the pastel-blue palette.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Usage: npm run icons  (writes into assets/images)
const OUT = process.argv[2] ?? "assets/images";
const NAVY = "#15264A";        // --primary-foreground (light)
const PASTEL = "#8CC2F2";      // --primary
const PASTEL_HI = "#B9DBFA";
const PASTEL_LO = "#78AEEA";
const DARK_BG = "#09090B";     // --background (dark)
const LIGHT_BG = "#EEF5FD";

// A sheet of paper with three text lines and a folded corner.
const sheet = "M332 232 L612 232 L712 332 L712 792 L332 792 Z";
const fold = "M612 232 L612 332 L712 332 Z";
const lines = [400, 492, 584].map((y, i) => `M392 ${y} L${i === 2 ? 560 : 652} ${y}`).join(" ");

type MarkOptions = {
  sheetFill: string;
  lineStroke: string;
  foldFill: string;
  scale?: number;
};

function mark({ sheetFill, lineStroke, foldFill, scale = 1 }: MarkOptions): string {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `<g transform="${t}">
    <path d="${sheet}" fill="${sheetFill}"/>
    <path d="${fold}" fill="${foldFill}"/>
    <path d="${lines}" stroke="${lineStroke}" stroke-width="40" stroke-linecap="round"/>
  </g>`;
}

const gradient = `<defs><radialGradient id="g" cx="0.25" cy="0.12" r="1.1">
  <stop offset="0" stop-color="${PASTEL_HI}"/><stop offset="0.55" stop-color="${PASTEL}"/><stop offset="1" stop-color="${PASTEL_LO}"/>
</radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;

// Monochrome (Android themed icons) only uses alpha: lines are cut out of the sheet.
const mono = `<defs><mask id="m"><rect width="1024" height="1024" fill="white"/>
  <g transform="translate(512 512) scale(0.62) translate(-512 -512)"><path d="${lines}" stroke="black" stroke-width="40" stroke-linecap="round"/></g></mask></defs>
  <g mask="url(#m)">${mark({ sheetFill: "#fff", lineStroke: "#fff", foldFill: "#fff", scale: 0.62 })}</g>`;

const svgs: Record<string, [size: number, body: string]> = {
  "icon.png": [1024, gradient + mark({ sheetFill: "#fff", lineStroke: NAVY, foldFill: PASTEL_HI })],
  "android-icon-background.png": [1024, gradient],
  // Adaptive icons are cropped to the centre ~66%, so the mark is scaled down.
  "android-icon-foreground.png": [1024, mark({ sheetFill: "#fff", lineStroke: NAVY, foldFill: PASTEL_HI, scale: 0.62 })],
  "android-icon-monochrome.png": [1024, mono],
  "splash-icon.png": [1024, mark({ sheetFill: NAVY, lineStroke: "#fff", foldFill: PASTEL_LO })],
  "splash-icon-dark.png": [1024, mark({ sheetFill: PASTEL, lineStroke: NAVY, foldFill: PASTEL_HI })],
  "favicon.png": [48, gradient + mark({ sheetFill: "#fff", lineStroke: NAVY, foldFill: PASTEL_HI })],
};

for (const [name, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${OUT}/${name}`, png);
  console.log(name, size);
}
console.log("splash bg", LIGHT_BG, DARK_BG);
