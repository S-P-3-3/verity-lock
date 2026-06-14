//! Importers for external password managers. All parsing happens locally on
//! bytes already read from disk — no network access.
//!
//! Supported:
//!   - Bitwarden (JSON export)
//!   - KeePass 2.x (unencrypted XML export)
//!   - CSV family via smart header mapping: Chrome/Edge, Firefox, LastPass,
//!     1Password (CSV), and generic CSV.
//!
//! KDBX (binary KeePass) is intentionally not parsed; users should export to
//! XML or CSV. We surface a clear message instead of failing opaquely.

use quick_xml::events::Event;
use quick_xml::Reader;
use serde::Deserialize;
use serde_json::Value;

use crate::vault::NewEntry;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub entries: Vec<NewEntry>,
}

/// Parse bytes according to `format`. Returns the proposed entries (the caller
/// decides whether to commit them to the vault).
pub fn parse(format: &str, bytes: &[u8]) -> Result<Vec<NewEntry>, String> {
    match format.to_lowercase().as_str() {
        "bitwarden" => parse_bitwarden(bytes),
        "keepass" | "keepass-xml" => parse_keepass_xml(bytes),
        "lastpass" | "chrome" | "edge" | "firefox" | "1password" | "csv" | "generic" => {
            parse_csv(bytes)
        }
        other => Err(format!("unsupported import format: {other}")),
    }
}

// ---------------------------------------------------------------------------
// Bitwarden JSON
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct BwExport {
    items: Vec<Value>,
}

fn parse_bitwarden(bytes: &[u8]) -> Result<Vec<NewEntry>, String> {
    let export: BwExport =
        serde_json::from_slice(bytes).map_err(|e| format!("invalid Bitwarden JSON: {e}"))?;
    let mut out = Vec::new();
    for item in export.items {
        // type 1 = login; we still import others as notes.
        let title = item
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("(ohne Titel)")
            .to_string();
        let notes = item
            .get("notes")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let login = item.get("login");
        let username = login
            .and_then(|l| l.get("username"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let password = login
            .and_then(|l| l.get("password"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let url = login
            .and_then(|l| l.get("uris"))
            .and_then(Value::as_array)
            .and_then(|a| a.first())
            .and_then(|u| u.get("uri"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        out.push(NewEntry {
            title,
            username,
            password,
            url,
            notes,
            category: "Login".into(),
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// CSV family (smart header mapping)
// ---------------------------------------------------------------------------

fn first_match(headers: &[String], aliases: &[&str]) -> Option<usize> {
    for (i, h) in headers.iter().enumerate() {
        let hl = h.trim().to_lowercase();
        if aliases.iter().any(|a| hl == *a) {
            return Some(i);
        }
    }
    None
}

fn parse_csv(bytes: &[u8]) -> Result<Vec<NewEntry>, String> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(bytes);
    let headers: Vec<String> = rdr
        .headers()
        .map_err(|e| format!("invalid CSV header: {e}"))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let title_idx = first_match(&headers, &["name", "title", "account"]);
    let user_idx = first_match(&headers, &["username", "user", "login_username", "email", "login"]);
    let pass_idx = first_match(&headers, &["password", "login_password", "pass"]);
    let url_idx = first_match(&headers, &["url", "uri", "website", "login_uri"]);
    let notes_idx = first_match(&headers, &["notes", "note", "extra", "comments"]);

    if pass_idx.is_none() && user_idx.is_none() {
        return Err("CSV has no recognizable username/password columns".into());
    }

    let get = |rec: &csv::StringRecord, idx: Option<usize>| -> String {
        idx.and_then(|i| rec.get(i)).unwrap_or("").trim().to_string()
    };

    let mut out = Vec::new();
    for result in rdr.records() {
        let rec = result.map_err(|e| format!("CSV row error: {e}"))?;
        let title = {
            let t = get(&rec, title_idx);
            if t.is_empty() {
                get(&rec, url_idx)
            } else {
                t
            }
        };
        out.push(NewEntry {
            title: if title.is_empty() {
                "(ohne Titel)".into()
            } else {
                title
            },
            username: get(&rec, user_idx),
            password: get(&rec, pass_idx),
            url: get(&rec, url_idx),
            notes: get(&rec, notes_idx),
            category: "Login".into(),
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// KeePass 2.x XML
// ---------------------------------------------------------------------------

fn parse_keepass_xml(bytes: &[u8]) -> Result<Vec<NewEntry>, String> {
    // Reject binary KDBX early with a helpful message.
    if bytes.len() >= 4 && bytes[0] == 0x03 && bytes[1] == 0xD9 && bytes[2] == 0xA2 {
        return Err(
            "binary .kdbx files are not supported — export from KeePass as XML or CSV".into(),
        );
    }
    let text = std::str::from_utf8(bytes).map_err(|_| "KeePass XML is not valid UTF-8")?;
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(true);

    let mut out = Vec::new();
    let mut in_entry = false;
    let mut in_string = false;
    let mut cur_key: Option<String> = None;
    let mut last_tag = String::new();
    let mut pending_value = false;
    let mut entry = NewEntry {
        title: String::new(),
        username: String::new(),
        password: String::new(),
        url: String::new(),
        notes: String::new(),
        category: "Login".into(),
    };

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                last_tag = name.clone();
                match name.as_str() {
                    "Entry" => {
                        in_entry = true;
                        entry = NewEntry {
                            title: String::new(),
                            username: String::new(),
                            password: String::new(),
                            url: String::new(),
                            notes: String::new(),
                            category: "Login".into(),
                        };
                    }
                    "String" if in_entry => {
                        in_string = true;
                        cur_key = None;
                    }
                    "Value" if in_string => pending_value = true,
                    _ => {}
                }
            }
            Ok(Event::Text(t)) => {
                let txt = t.unescape().unwrap_or_default().to_string();
                if in_string && last_tag == "Key" {
                    cur_key = Some(txt);
                } else if pending_value {
                    if let Some(key) = &cur_key {
                        match key.as_str() {
                            "Title" => entry.title = txt,
                            "UserName" => entry.username = txt,
                            "Password" => entry.password = txt,
                            "URL" => entry.url = txt,
                            "Notes" => entry.notes = txt,
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match name.as_str() {
                    "Value" => pending_value = false,
                    "String" => in_string = false,
                    "Entry" => {
                        in_entry = false;
                        // Skip empty/recycle-bin artifacts.
                        if !(entry.title.is_empty()
                            && entry.username.is_empty()
                            && entry.password.is_empty())
                        {
                            if entry.title.is_empty() {
                                entry.title = "(ohne Titel)".into();
                            }
                            out.push(std::mem::replace(
                                &mut entry,
                                NewEntry {
                                    title: String::new(),
                                    username: String::new(),
                                    password: String::new(),
                                    url: String::new(),
                                    notes: String::new(),
                                    category: "Login".into(),
                                },
                            ));
                        }
                    }
                    _ => {}
                }
                last_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("KeePass XML parse error: {e}")),
            _ => {}
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_bitwarden_json() {
        let json = br#"{
            "items": [
                {"name":"GitHub","notes":"n","login":{"username":"u","password":"p","uris":[{"uri":"https://github.com"}]}}
            ]
        }"#;
        let e = parse_bitwarden(json).unwrap();
        assert_eq!(e.len(), 1);
        assert_eq!(e[0].title, "GitHub");
        assert_eq!(e[0].username, "u");
        assert_eq!(e[0].password, "p");
        assert_eq!(e[0].url, "https://github.com");
    }

    #[test]
    fn imports_chrome_csv() {
        let csv = b"name,url,username,password\nGitHub,https://github.com,user,pass\n";
        let e = parse_csv(csv).unwrap();
        assert_eq!(e.len(), 1);
        assert_eq!(e[0].title, "GitHub");
        assert_eq!(e[0].username, "user");
        assert_eq!(e[0].password, "pass");
    }

    #[test]
    fn imports_lastpass_csv() {
        let csv = b"url,username,password,totp,extra,name,grouping,fav\nhttps://x.com,u@x.com,secret,,note,MyAccount,,0\n";
        let e = parse_csv(csv).unwrap();
        assert_eq!(e.len(), 1);
        assert_eq!(e[0].title, "MyAccount");
        assert_eq!(e[0].username, "u@x.com");
        assert_eq!(e[0].password, "secret");
        assert_eq!(e[0].notes, "note");
    }

    #[test]
    fn imports_keepass_xml() {
        let xml = br#"<?xml version="1.0"?>
        <KeePassFile><Root><Group><Entry>
            <String><Key>Title</Key><Value>Mail</Value></String>
            <String><Key>UserName</Key><Value>me@mail.com</Value></String>
            <String><Key>Password</Key><Value>pw123</Value></String>
            <String><Key>URL</Key><Value>https://mail.com</Value></String>
            <String><Key>Notes</Key><Value>hello</Value></String>
        </Entry></Group></Root></KeePassFile>"#;
        let e = parse_keepass_xml(xml).unwrap();
        assert_eq!(e.len(), 1);
        assert_eq!(e[0].title, "Mail");
        assert_eq!(e[0].username, "me@mail.com");
        assert_eq!(e[0].password, "pw123");
        assert_eq!(e[0].url, "https://mail.com");
        assert_eq!(e[0].notes, "hello");
    }

    #[test]
    fn rejects_binary_kdbx() {
        let kdbx = [0x03u8, 0xD9, 0xA2, 0x67, 0x00, 0x00];
        assert!(parse_keepass_xml(&kdbx).is_err());
    }
}
