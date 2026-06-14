/**
 * TypeScript importer for the Android/web backend (the desktop build parses in
 * Rust). Supports Bitwarden JSON, KeePass 2.x XML, and the CSV family
 * (Chrome/Edge, Firefox, LastPass, 1Password, generic) via smart header mapping.
 */
import type { NewEntry } from "../types";

export function parseImport(format: string, content: string): NewEntry[] {
  switch (format.toLowerCase()) {
    case "bitwarden":
      return parseBitwarden(content);
    case "keepass":
    case "keepass-xml":
      return parseKeePassXml(content);
    default:
      return parseCsv(content);
  }
}

function parseBitwarden(text: string): NewEntry[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Ungültige Bitwarden-JSON");
  }
  const items = (json as { items?: unknown[] }).items;
  if (!Array.isArray(items)) throw new Error("Keine Bitwarden-Einträge gefunden");
  return items.map((raw) => {
    const it = raw as Record<string, any>;
    return {
      title: it.name ?? "(ohne Titel)",
      username: it.login?.username ?? "",
      password: it.login?.password ?? "",
      url: it.login?.uris?.[0]?.uri ?? "",
      notes: it.notes ?? "",
      category: "Login",
    };
  });
}

function parseKeePassXml(text: string): NewEntry[] {
  if (text.charCodeAt(0) === 0x03) {
    throw new Error("Binäre .kdbx werden nicht unterstützt — als XML exportieren");
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Ungültige KeePass-XML");
  const out: NewEntry[] = [];
  doc.querySelectorAll("Entry").forEach((entry) => {
    const fields: Record<string, string> = {};
    entry.querySelectorAll(":scope > String").forEach((s) => {
      const key = s.querySelector("Key")?.textContent ?? "";
      const val = s.querySelector("Value")?.textContent ?? "";
      if (key) fields[key] = val;
    });
    if (!fields.Title && !fields.UserName && !fields.Password) return;
    out.push({
      title: fields.Title || "(ohne Titel)",
      username: fields.UserName || "",
      password: fields.Password || "",
      url: fields.URL || "",
      notes: fields.Notes || "",
      category: "Login",
    });
  });
  return out;
}

/** Minimal RFC-4180 CSV parser (handles quotes, escaped quotes, CRLF). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function idx(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

function parseCsv(text: string): NewEntry[] {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error("Leere CSV");
  const headers = rows[0].map((h) => h.trim());
  const tI = idx(headers, ["name", "title", "account"]);
  const uI = idx(headers, ["username", "user", "login_username", "email", "login"]);
  const pI = idx(headers, ["password", "login_password", "pass"]);
  const lI = idx(headers, ["url", "uri", "website", "login_uri"]);
  const nI = idx(headers, ["notes", "note", "extra", "comments"]);
  if (pI < 0 && uI < 0) throw new Error("Keine Benutzername/Passwort-Spalten erkannt");

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  return rows.slice(1).map((r) => {
    const title = get(r, tI) || get(r, lI) || "(ohne Titel)";
    return {
      title,
      username: get(r, uI),
      password: get(r, pI),
      url: get(r, lI),
      notes: get(r, nI),
      category: "Login",
    };
  });
}
