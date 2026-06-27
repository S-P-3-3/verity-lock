// Generates placeholder UI mockups into assets/screenshots/.
// These mirror the real Verity Lock UI but are NOT real captures — replace them
// with actual screenshots from the running apps before publishing if you like.
//   node scripts/generate-screenshots.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("assets/screenshots", { recursive: true });

const C = {
  bg: "#141c2a", panel: "#1b2535", card: "#213044", row: "#2a3d58",
  green: "#44d975", greenDark: "#2db85a", white: "#ffffff",
  t70: "rgba(255,255,255,0.7)", t45: "rgba(255,255,255,0.45)", t15: "rgba(255,255,255,0.12)",
};

const font = `font-family="system-ui, -apple-system, Segoe UI, sans-serif"`;

function topbar(w) {
  return `
    <rect x="0" y="0" width="${w}" height="54" fill="${C.greenDark}"/>
    <rect x="16" y="12" width="30" height="30" rx="8" fill="rgba(0,0,0,0.18)"/>
    <text x="31" y="32" ${font} font-size="13" font-weight="800" fill="#fff" text-anchor="middle">V</text>
    <text x="56" y="33" ${font} font-size="16" font-weight="800" letter-spacing="1.5" fill="#fff">VERITY LOCK</text>`;
}

function statusbar(w, y) {
  return `
    <rect x="0" y="${y}" width="${w}" height="30" fill="${C.bg}"/>
    <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${C.t15}"/>
    <circle cx="16" cy="${y + 15}" r="3" fill="${C.green}"/>
    <text x="26" y="${y + 19}" ${font} font-size="10.5" fill="${C.t45}">Vault offen · AES-256 · Offline</text>
    <text x="${w - 14}" y="${y + 19}" ${font} font-size="10.5" font-weight="700" fill="${C.green}" text-anchor="end">Clipboard 28s</text>`;
}

function entryRow(x, y, w, letter, color, name, sub, badge) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="60" rx="12" fill="${C.row}"/>
    <rect x="${x + 12}" y="${y + 11}" width="38" height="38" rx="10" fill="${color}"/>
    <text x="${x + 31}" y="${y + 36}" ${font} font-size="16" font-weight="800" fill="#0e1520" text-anchor="middle">${letter}</text>
    <text x="${x + 62}" y="${y + 27}" ${font} font-size="14" font-weight="700" fill="#fff">${name}</text>
    <text x="${x + 62}" y="${y + 45}" ${font} font-size="12" fill="${C.t45}">${sub}</text>
    <rect x="${x + w - 118}" y="${y + 20}" width="62" height="20" rx="6" fill="${C.panel}" stroke="${C.t15}"/>
    <text x="${x + w - 87}" y="${y + 34}" ${font} font-size="10" font-weight="700" fill="${C.t70}" text-anchor="middle">${badge}</text>
    <circle cx="${x + w - 24}" cy="${y + 30}" r="4" fill="${C.green}"/>`;
}

function render(name, w, h, body, phone = false) {
  const inner = `
    <rect width="${w}" height="${h}" fill="${C.bg}" rx="${phone ? 36 : 12}"/>
    ${body}
    ${phone ? `<rect x="0" y="0" width="${w}" height="${h}" rx="36" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
       <rect x="${w / 2 - 45}" y="10" width="90" height="7" rx="3.5" fill="rgba(255,255,255,0.18)"/>` : ""}`;
  const pad = phone ? 22 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}">
     <rect width="${w + pad * 2}" height="${h + pad * 2}" fill="#0e1520"/>
     <g transform="translate(${pad},${pad})">${inner}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toFile(`assets/screenshots/${name}.png`);
}

// ---- Desktop unlock ----
const W = 460, H = 860;
await render("desktop-unlock", W, H, `
  ${topbar(W)}
  <g transform="translate(0,250)">
    <rect x="${W / 2 - 36}" y="0" width="72" height="72" rx="20" fill="${C.panel}" stroke="${C.t15}"/>
    <path d="M${W / 2 - 14} 38 V28 A14 14 0 0 1 ${W / 2 + 14} 28 V38" stroke="${C.green}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="${W / 2 - 18}" y="36" width="36" height="26" rx="6" fill="${C.green}"/>
    <text x="${W / 2}" y="130" ${font} font-size="24" font-weight="800" fill="#fff" text-anchor="middle">Kontonummer eingeben</text>
    <text x="${W / 2}" y="158" ${font} font-size="13" fill="${C.t45}" text-anchor="middle">16 Ziffern — kein Passwort</text>
    <rect x="40" y="190" width="${W - 80}" height="60" rx="10" fill="${C.card}" stroke="${C.t15}" stroke-width="1.5"/>
    <text x="${W / 2}" y="228" ${font} font-size="22" font-weight="700" letter-spacing="6" fill="${C.green}" text-anchor="middle">1234 5678 9012 3456</text>
    <rect x="40" y="266" width="${W - 130}" height="6" rx="3" fill="${C.card}"/>
    <rect x="40" y="266" width="${W - 130}" height="6" rx="3" fill="${C.green}"/>
    <text x="${W - 50}" y="272" ${font} font-size="12" fill="${C.t45}" text-anchor="end">16 / 16</text>
    <rect x="40" y="292" width="${W - 80}" height="52" rx="10" fill="${C.green}"/>
    <text x="${W / 2}" y="324" ${font} font-size="15" font-weight="700" fill="#0e1520" text-anchor="middle">EINLOGGEN</text>
  </g>
  ${statusbar(W, H - 30)}`);

// ---- Desktop main ----
await render("desktop-main", W, H, `
  ${topbar(W)}
  <rect x="16" y="68" width="${W - 32}" height="92" rx="14" fill="${C.panel}"/>
  <circle cx="30" cy="92" r="4" fill="${C.green}"/>
  <text x="42" y="96" ${font} font-size="11" font-weight="700" letter-spacing="1.5" fill="${C.green}">VAULT ENTSPERRT</text>
  <text x="30" y="128" ${font} font-size="26" font-weight="800" fill="#fff">12 Passwörter</text>
  <text x="30" y="148" ${font} font-size="12" fill="${C.t70}">gesichert · vault.sp3vault · AES-256-GCM</text>
  <rect x="16" y="174" width="200" height="46" rx="10" fill="${C.green}"/>
  <text x="116" y="202" ${font} font-size="13" font-weight="700" fill="#0e1520" text-anchor="middle">+ NEUER EINTRAG</text>
  <rect x="224" y="174" width="100" height="46" rx="10" fill="none" stroke="${C.t15}" stroke-width="1.5"/>
  <text x="274" y="202" ${font} font-size="13" font-weight="700" fill="${C.t70}" text-anchor="middle">Import</text>
  <rect x="332" y="174" width="${W - 348}" height="46" rx="10" fill="#e8404a"/>
  <text x="${(332 + W - 16) / 2}" y="202" ${font} font-size="13" font-weight="700" fill="#fff" text-anchor="middle">SPERREN</text>
  <rect x="16" y="234" width="${W - 32}" height="44" rx="10" fill="${C.card}" stroke="${C.t15}" stroke-width="1.5"/>
  <text x="40" y="261" ${font} font-size="14" fill="${C.t45}">🔍 Suchen…</text>
  ${entryRow(16, 294, W - 32, "G", "#44d975", "Google", "max@gmail.com", "Login")}
  ${entryRow(16, 362, W - 32, "S", "#38bdf8", "Sparkasse", "max.mustermann", "Bank")}
  ${entryRow(16, 430, W - 32, "F", "#a78bfa", "Fortnite", "sp3gamer", "Gaming")}
  ${entryRow(16, 498, W - 32, "N", "#fb923c", "Netflix", "max@gmail.com", "Login")}
  ${entryRow(16, 566, W - 32, "G", "#f87171", "GitHub", "sp3dev", "Login")}
  <rect x="0" y="${H - 86}" width="${W}" height="56" fill="${C.panel}"/>
  <line x1="0" y1="${H - 86}" x2="${W}" y2="${H - 86}" stroke="${C.t15}"/>
  ${["Vault", "Generator", "Import", "Settings"].map((t, i) => `<text x="${W / 8 + (i * W) / 4}" y="${H - 52}" ${font} font-size="10" font-weight="600" fill="${i === 0 ? C.green : C.t45}" text-anchor="middle">${t}</text>`).join("")}
  ${statusbar(W, H - 30)}`);

// ---- Android (phone frame) ----
const PW = 360, PH = 740;
await render("android-unlock", PW, PH, `
  ${topbar(PW)}
  <g transform="translate(0,210)">
    <rect x="${PW / 2 - 34}" y="0" width="68" height="68" rx="20" fill="${C.panel}" stroke="${C.t15}"/>
    <path d="M${PW / 2 - 13} 36 V27 A13 13 0 0 1 ${PW / 2 + 13} 27 V36" stroke="${C.green}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="${PW / 2 - 17}" y="34" width="34" height="24" rx="6" fill="${C.green}"/>
    <text x="${PW / 2}" y="122" ${font} font-size="22" font-weight="800" fill="#fff" text-anchor="middle">Kontonummer</text>
    <rect x="30" y="150" width="${PW - 60}" height="58" rx="10" fill="${C.card}" stroke="${C.t15}" stroke-width="1.5"/>
    <text x="${PW / 2}" y="186" ${font} font-size="20" font-weight="700" letter-spacing="4" fill="${C.green}" text-anchor="middle">1234 5678 9012 …</text>
    <rect x="30" y="226" width="${PW - 60}" height="52" rx="10" fill="${C.green}"/>
    <text x="${PW / 2}" y="258" ${font} font-size="15" font-weight="700" fill="#0e1520" text-anchor="middle">EINLOGGEN</text>
  </g>
  ${statusbar(PW, PH - 30)}`, true);

await render("android-main", PW, PH, `
  ${topbar(PW)}
  <rect x="14" y="66" width="${PW - 28}" height="86" rx="14" fill="${C.panel}"/>
  <circle cx="28" cy="88" r="4" fill="${C.green}"/>
  <text x="40" y="92" ${font} font-size="10" font-weight="700" letter-spacing="1.5" fill="${C.green}">VAULT ENTSPERRT</text>
  <text x="28" y="122" ${font} font-size="24" font-weight="800" fill="#fff">12 Passwörter</text>
  <text x="28" y="142" ${font} font-size="11" fill="${C.t70}">gesichert · AES-256-GCM</text>
  ${entryRow(14, 166, PW - 28, "G", "#44d975", "Google", "max@gmail.com", "Login")}
  ${entryRow(14, 234, PW - 28, "S", "#38bdf8", "Sparkasse", "max.muster", "Bank")}
  ${entryRow(14, 302, PW - 28, "F", "#a78bfa", "Fortnite", "sp3gamer", "Gaming")}
  ${entryRow(14, 370, PW - 28, "N", "#fb923c", "Netflix", "max@gmail.com", "Login")}
  <rect x="0" y="${PH - 86}" width="${PW}" height="56" fill="${C.panel}"/>
  <line x1="0" y1="${PH - 86}" x2="${PW}" y2="${PH - 86}" stroke="${C.t15}"/>
  ${["Vault", "Generator", "Import", "Settings"].map((t, i) => `<text x="${PW / 8 + (i * PW) / 4}" y="${PH - 52}" ${font} font-size="10" font-weight="600" fill="${i === 0 ? C.green : C.t45}" text-anchor="middle">${t}</text>`).join("")}
  ${statusbar(PW, PH - 30)}`, true);

console.log("Wrote 4 mockups to assets/screenshots/");
