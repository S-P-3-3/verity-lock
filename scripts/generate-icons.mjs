// Renders the sp3 Lock SVG to a 1024×1024 PNG source, then run:
//   npx tauri icon icons/source-1024.png
// which generates the full icon set (png sizes + .ico + .icns) into src-tauri/icons.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("icons", { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#141c2a"/>
  <rect x="56" y="56" width="400" height="400" rx="84" fill="#1b2535"/>
  <!-- shackle -->
  <path d="M186 250 V196 A70 70 0 0 1 326 196 V250"
        stroke="#44d975" stroke-width="34" fill="none" stroke-linecap="round"/>
  <!-- body -->
  <rect x="148" y="246" width="216" height="170" rx="30" fill="#44d975"/>
  <!-- keyhole -->
  <circle cx="256" cy="316" r="26" fill="#141c2a"/>
  <rect x="244" y="314" width="24" height="46" rx="12" fill="#141c2a"/>
</svg>`;

writeFileSync("icons/source.svg", svg);
await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile("icons/source-1024.png");
console.log("Wrote icons/source-1024.png — now run: npx tauri icon icons/source-1024.png");
