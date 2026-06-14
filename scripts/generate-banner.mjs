// Generates assets/banner.png (1280×400) and assets/icon.png (256×256).
//   node scripts/generate-banner.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("assets", { recursive: true });

const banner = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1520"/>
      <stop offset="100%" stop-color="#1b2535"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="400" fill="url(#bg)"/>
  <line x1="0" y1="200" x2="1280" y2="200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <line x1="640" y1="0" x2="640" y2="400" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

  <!-- Lock icon -->
  <g transform="translate(180, 110)">
    <path d="M30 90 V65 A60 60 0 0 1 150 65 V90"
          stroke="#44d975" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="0" y="90" width="180" height="110" rx="16" fill="#44d975"/>
    <circle cx="90" cy="140" r="18" fill="#0e1520"/>
    <rect x="81" y="138" width="18" height="28" rx="9" fill="#0e1520"/>
  </g>

  <text x="420" y="170" font-family="system-ui, sans-serif" font-weight="900" font-size="72"
        fill="#ffffff" letter-spacing="-2">SP3 Lock</text>
  <text x="422" y="222" font-family="system-ui, sans-serif" font-weight="600" font-size="24"
        fill="#44d975" letter-spacing="1">Open-source · 100% Offline · AES-256-GCM</text>

  <g font-family="system-ui" font-size="14" font-weight="700" fill="#44d975" text-anchor="middle">
    <rect x="422" y="262" width="120" height="36" rx="18" fill="rgba(68,217,117,0.12)" stroke="#44d975" stroke-width="1.5"/>
    <text x="482" y="285">Windows</text>
    <rect x="554" y="262" width="96" height="36" rx="18" fill="rgba(68,217,117,0.12)" stroke="#44d975" stroke-width="1.5"/>
    <text x="602" y="285">Linux</text>
    <rect x="662" y="262" width="110" height="36" rx="18" fill="rgba(68,217,117,0.12)" stroke="#44d975" stroke-width="1.5"/>
    <text x="717" y="285">Android</text>
  </g>

  <text x="1220" y="380" font-family="system-ui" font-size="16" font-weight="700"
        fill="rgba(255,255,255,0.2)" text-anchor="end">by sp3</text>
</svg>`;

const icon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#141c2a"/>
  <rect x="56" y="56" width="400" height="400" rx="84" fill="#1b2535"/>
  <path d="M186 250 V196 A70 70 0 0 1 326 196 V250" stroke="#44d975" stroke-width="34" fill="none" stroke-linecap="round"/>
  <rect x="148" y="246" width="216" height="170" rx="30" fill="#44d975"/>
  <circle cx="256" cy="316" r="26" fill="#141c2a"/>
  <rect x="244" y="314" width="24" height="46" rx="12" fill="#141c2a"/>
</svg>`;

await sharp(Buffer.from(banner)).png().toFile("assets/banner.png");
await sharp(Buffer.from(icon)).resize(256, 256).png().toFile("assets/icon.png");
console.log("Wrote assets/banner.png and assets/icon.png");
