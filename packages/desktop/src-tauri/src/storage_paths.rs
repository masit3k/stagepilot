use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const USER_DATA_DIR_NAME: &str = "StagePilot";
const STORAGE_SCHEMA_VERSION: u32 = 3;
const STORAGE_SEED_VERSION: u32 = 3;
const MAX_ID_LEN: usize = 120;
const LINEUP_ROLE_KEYS: [&str; 5] = ["drums", "bass", "guitar", "keys", "vocs"];
#[derive(Debug)]
pub enum StorageError {
    Io(std::io::Error),
    Resolve(String),
    MalformedMetadata(String),
    UnsupportedMetadataSchema(u32),
    InvalidMetadata(String),
}

impl From<std::io::Error> for StorageError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserStorageMeta {
    pub schema_version: u32,
    pub seed_version: u32,
    pub seed_completed: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_migrated_at: Option<String>,
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    format!("{}Z", secs)
}

fn storage_meta_path(root: &Path) -> PathBuf {
    root.join("storage.json")
}

const DEFAULT_NOTES_TEMPLATE_ID: &str = "notes_default_cs";
const DEFAULT_NOTES_TEMPLATE_JSON: &str =
    include_str!("../../../../src/infra/storage/defaultNotesTemplate.notes_default_cs.json");

fn stagepilot_user_data_dir_from_app_data_dir(
    app_data_dir: &Path,
) -> Result<PathBuf, StorageError> {
    let roaming_dir = app_data_dir
        .parent()
        .ok_or_else(|| StorageError::Resolve("Cannot resolve AppData roaming directory".into()))?;
    Ok(roaming_dir.join(USER_DATA_DIR_NAME))
}

pub fn stagepilot_user_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| StorageError::Resolve(format!("Failed to resolve app data dir: {e}")))?;
    stagepilot_user_data_dir_from_app_data_dir(&app_data_dir)
}

pub fn maybe_wipe_storage_for_dev(app: &tauri::AppHandle) -> Result<(), StorageError> {
    if !cfg!(debug_assertions) {
        return Ok(());
    }

    let should_wipe = std::env::var("STAGEPILOT_DEV_WIPE_STORAGE")
        .map(|value| value == "1")
        .unwrap_or(false);
    if !should_wipe {
        return Ok(());
    }

    let root = stagepilot_user_data_dir(app)?;
    if root.exists() {
        fs::remove_dir_all(&root)?;
    }
    println!("Wiped StagePilot storage at {}", root.display());
    Ok(())
}

fn ensure_dirs(root: &Path) -> Result<(), StorageError> {
    for folder in [
        "projects",
        "exports",
        "temp",
        "versions",
        "catalog/bands",
        "catalog/musicians/drums",
        "catalog/musicians/bass",
        "catalog/musicians/guitar",
        "catalog/musicians/keys",
        "catalog/musicians/vocs",
        "catalog/musicians/talkback",
        "catalog/contacts",
        "catalog/templates/notes",
    ] {
        fs::create_dir_all(root.join(folder))?;
    }
    // Runtime preset directories are intentionally not seeded here; group and
    // monitor presets are currently built-in assets loaded from data/assets.
    Ok(())
}

fn resolve_musician_role(item: &serde_json::Value) -> Result<String, StorageError> {
    if let Some(group) = item.get("group").and_then(|v| v.as_str()) {
        let normalized = group.trim().to_lowercase();
        if matches!(
            normalized.as_str(),
            "drums" | "bass" | "guitar" | "keys" | "vocs" | "talkback"
        ) {
            return Ok(normalized);
        }
        return Err(StorageError::Resolve(format!(
            "Invalid legacy musician role '{}': expected one of drums,bass,guitar,keys,vocs,talkback",
            group
        )));
    }
    if let Some(default_roles) = item
        .get("defaultRoles")
        .and_then(|v| v.as_array())
        .or_else(|| item.get("default_roles").and_then(|v| v.as_array()))
    {
        if let Some(role) = default_roles.iter().find_map(|v| v.as_str()) {
            let normalized = role.trim().to_lowercase();
            if matches!(
                normalized.as_str(),
                "drums" | "bass" | "guitar" | "keys" | "vocs" | "talkback"
            ) {
                return Ok(normalized);
            }
            return Err(StorageError::Resolve(format!(
                "Invalid legacy musician default role '{}': expected one of drums,bass,guitar,keys,vocs,talkback",
                role
            )));
        }
    }
    Err(StorageError::Resolve(
        "Legacy musician is missing required role/group information".into(),
    ))
}

fn migrate_legacy_library(root: &Path) -> Result<bool, StorageError> {
    let legacy = root.join("library");
    if !legacy.exists() {
        return Ok(false);
    }
    let mut migrated = false;
    for file_name in ["bands.json", "musicians.json", "contacts.json"] {
        let file = legacy.join(file_name);
        if !file.exists() {
            continue;
        }
        let content = fs::read_to_string(&file)?;
        let items: Vec<serde_json::Value> = serde_json::from_str(&content).map_err(|e| {
            StorageError::Resolve(format!("Invalid legacy JSON {} ({e})", file_name))
        })?;
        for item in items {
            let Some(id) = item.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let target = if file_name == "musicians.json" {
                let role = resolve_musician_role(&item)?;
                let role_dir = root.join("catalog/musicians").join(role);
                fs::create_dir_all(&role_dir)?;
                role_dir.join(format!("{}.json", sanitize_id_to_filename(id)))
            } else {
                let target_dir = if file_name == "bands.json" {
                    root.join("catalog/bands")
                } else {
                    root.join("catalog/contacts")
                };
                fs::create_dir_all(&target_dir)?;
                target_dir.join(format!("{}.json", sanitize_id_to_filename(id)))
            };

            if !target.exists() {
                let bytes = serde_json::to_vec_pretty(&item).map_err(|e| {
                    StorageError::Resolve(format!("Serialize migrated JSON failed ({e})"))
                })?;
                atomic_write_bytes(&target, &bytes)?;
            } else if file_name == "musicians.json" {
                println!(
                    "Skipped migrated musician '{}' because canonical target already exists: {}",
                    id,
                    target.display()
                );
            }
            migrated = true;
        }
    }

    if migrated {
        fs::remove_dir_all(legacy)?;
    }
    Ok(migrated)
}

fn template_version(value: &serde_json::Value) -> i64 {
    value.get("version").and_then(|v| v.as_i64()).unwrap_or(0)
}

fn entry_since(entry: &serde_json::Value) -> i64 {
    entry.get("since").and_then(|v| v.as_i64()).unwrap_or(0)
}

/// Doplní do uživatelské šablony položky přidané ve vyšší verzi.
/// Existující položky se nikdy nepřepisují — ruční úpravy textů zůstávají.
fn merge_notes_section(
    current: &mut serde_json::Value,
    default: &serde_json::Value,
    section: &str,
    installed_version: i64,
) {
    let Some(default_entries) = default.get(section).and_then(|v| v.as_array()) else {
        return;
    };
    let existing_ids: Vec<String> = current
        .get(section)
        .and_then(|v| v.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|e| e.get("id").and_then(|v| v.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let additions: Vec<serde_json::Value> = default_entries
        .iter()
        .filter(|entry| entry_since(entry) > installed_version)
        .filter(|entry| {
            entry
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| !existing_ids.iter().any(|existing| existing == id))
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    if additions.is_empty() {
        return;
    }
    let target = current
        .get_mut(section)
        .and_then(|v| v.as_array_mut())
        .expect("notes section must be an array");
    target.extend(additions);
}

fn ensure_default_notes_template(root: &Path) -> Result<(), StorageError> {
    let templates_dir = root.join("catalog/templates/notes");
    fs::create_dir_all(&templates_dir)?;

    let target = templates_dir.join(format!("{}.json", DEFAULT_NOTES_TEMPLATE_ID));
    let parsed: serde_json::Value =
        serde_json::from_str(DEFAULT_NOTES_TEMPLATE_JSON).map_err(|e| {
            StorageError::Resolve(format!("Invalid embedded default notes template JSON: {e}"))
        })?;

    let merged = if target.exists() {
        let existing_raw = fs::read_to_string(&target)?;
        let mut existing: serde_json::Value = serde_json::from_str(&existing_raw).map_err(|e| {
            StorageError::Resolve(format!("Invalid user notes template JSON: {e}"))
        })?;
        let installed = template_version(&existing);
        let latest = template_version(&parsed);
        if installed >= latest {
            return Ok(());
        }
        for section in ["inputs", "monitors"] {
            if existing.get(section).and_then(|v| v.as_array()).is_none() {
                existing[section] = serde_json::Value::Array(Vec::new());
            }
            merge_notes_section(&mut existing, &parsed, section, installed);
        }
        existing["version"] = serde_json::Value::from(latest);
        existing
    } else {
        parsed
    };

    let bytes = serde_json::to_vec_pretty(&merged).map_err(|e| {
        StorageError::Resolve(format!(
            "Failed to serialize default notes template: {e}"
        ))
    })?;
    atomic_write_bytes(&target, &bytes)?;
    Ok(())
}

fn seed_catalog(root: &Path) -> Result<(), StorageError> {
    ensure_default_notes_template(root)?;
    Ok(())
}

fn normalize_musician_id(value: &serde_json::Value) -> Option<String> {
    value
        .as_str()
        .or_else(|| value.get("musicianId").and_then(|v| v.as_str()))
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string)
}

fn normalize_band_lineup_role(value: Option<&serde_json::Value>) -> serde_json::Value {
    let entries: Vec<&serde_json::Value> = match value {
        Some(serde_json::Value::Array(items)) => items.iter().collect(),
        Some(serde_json::Value::Null) | None => Vec::new(),
        Some(item) => vec![item],
    };
    let mut seen = std::collections::BTreeSet::new();
    let mut normalized = Vec::new();
    for entry in entries {
        let Some(musician_id) = normalize_musician_id(entry) else {
            continue;
        };
        if seen.insert(musician_id.clone()) {
            normalized.push(serde_json::Value::String(musician_id));
        }
    }
    serde_json::Value::Array(normalized)
}

fn normalize_project_lineup_role(value: Option<&serde_json::Value>) -> serde_json::Value {
    let entries: Vec<&serde_json::Value> = match value {
        Some(serde_json::Value::Array(items)) => items.iter().collect(),
        Some(serde_json::Value::Null) | None => Vec::new(),
        Some(item) => vec![item],
    };
    let mut seen = std::collections::BTreeSet::new();
    let mut normalized = Vec::new();
    for entry in entries {
        let Some(musician_id) = normalize_musician_id(entry) else {
            continue;
        };
        if !seen.insert(musician_id.clone()) {
            continue;
        }
        if entry.is_object() {
            let mut cloned = entry.clone();
            if let Some(object) = cloned.as_object_mut() {
                object.insert(
                    "musicianId".to_string(),
                    serde_json::Value::String(musician_id),
                );
            }
            normalized.push(cloned);
        } else {
            normalized.push(serde_json::Value::String(musician_id));
        }
    }
    serde_json::Value::Array(normalized)
}

fn normalize_lineup_object(
    target: &mut serde_json::Value,
    field_name: &str,
    preserve_project_slots: bool,
    create_when_missing: bool,
) -> bool {
    let before = target.get(field_name).cloned();
    if before.is_none() && !create_when_missing {
        return false;
    }

    let raw_lineup = before
        .as_ref()
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_default();
    let mut normalized = raw_lineup.clone();
    for role in LINEUP_ROLE_KEYS {
        let role_value = raw_lineup.get(role);
        let normalized_role = if preserve_project_slots {
            normalize_project_lineup_role(role_value)
        } else {
            normalize_band_lineup_role(role_value)
        };
        normalized.insert(role.to_string(), normalized_role);
    }
    let next = serde_json::Value::Object(normalized);
    if before.as_ref() == Some(&next) {
        return false;
    }
    if let Some(object) = target.as_object_mut() {
        object.insert(field_name.to_string(), next);
        true
    } else {
        false
    }
}

fn migrate_lineup_json_file(
    path: &Path,
    field_name: &str,
    preserve_project_slots: bool,
    create_when_missing: bool,
) -> Result<bool, StorageError> {
    let content = fs::read_to_string(path)?;
    let mut value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| StorageError::Resolve(format!("Invalid JSON {} ({e})", path.display())))?;
    let changed = normalize_lineup_object(
        &mut value,
        field_name,
        preserve_project_slots,
        create_when_missing,
    );
    if changed {
        let bytes = serde_json::to_vec_pretty(&value).map_err(|e| {
            StorageError::Resolve(format!(
                "Failed to serialize migrated lineup JSON {} ({e})",
                path.display()
            ))
        })?;
        atomic_write_bytes(path, &bytes)?;
    }
    Ok(changed)
}

fn migrate_lineup_json_dir(
    dir: &Path,
    field_name: &str,
    preserve_project_slots: bool,
    create_when_missing: bool,
) -> Result<bool, StorageError> {
    if !dir.exists() {
        return Ok(false);
    }
    let mut migrated = false;
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        migrated |= migrate_lineup_json_file(
            &path,
            field_name,
            preserve_project_slots,
            create_when_missing,
        )?;
    }
    Ok(migrated)
}

fn migrate_lineup_assignments(root: &Path) -> Result<bool, StorageError> {
    let bands_migrated =
        migrate_lineup_json_dir(&root.join("catalog/bands"), "defaultLineup", false, true)?;
    let projects_migrated = migrate_lineup_json_dir(&root.join("projects"), "lineup", true, false)?;
    Ok(bands_migrated || projects_migrated)
}

fn normalize_vocal_overlay_ids(value: Option<&serde_json::Value>) -> serde_json::Value {
    let Some(serde_json::Value::Array(items)) = value else {
        return serde_json::Value::Array(Vec::new());
    };

    let mut indexed: Vec<(usize, String)> = Vec::new();
    for (index, item) in items.iter().enumerate() {
        match item {
            serde_json::Value::String(id) => {
                let trimmed = id.trim();
                if !trimmed.is_empty() {
                    indexed.push((index + 1, trimmed.to_string()));
                }
            }
            serde_json::Value::Object(object) => {
                let Some(musician_id) = object
                    .get("musicianId")
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|id| !id.is_empty())
                else {
                    continue;
                };
                let order = object
                    .get("slot")
                    .and_then(|v| v.as_u64())
                    .map(|slot| slot as usize)
                    .filter(|slot| *slot > 0)
                    .unwrap_or(index + 1);
                indexed.push((order, musician_id.to_string()));
            }
            _ => {}
        }
    }

    indexed.sort_by_key(|(order, _)| *order);
    let mut seen = std::collections::BTreeSet::new();
    serde_json::Value::Array(
        indexed
            .into_iter()
            .filter_map(|(_, id)| {
                if seen.insert(id.clone()) {
                    Some(serde_json::Value::String(id))
                } else {
                    None
                }
            })
            .collect(),
    )
}

fn cleanup_vocal_overlays_in_file(path: &Path, is_band: bool) -> Result<bool, StorageError> {
    let content = fs::read_to_string(path)?;
    let mut value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| StorageError::Resolve(format!("Invalid JSON {} ({e})", path.display())))?;
    let before = value.clone();

    let Some(object) = value.as_object_mut() else {
        return Ok(false);
    };

    if is_band {
        object.remove("defaultVocals");
        let default_overlays = object
            .entry("defaultOverlays".to_string())
            .or_insert_with(|| serde_json::json!({}));
        if let Some(overlays) = default_overlays.as_object_mut() {
            let lead = normalize_vocal_overlay_ids(
                overlays.get("leadVocals").or_else(|| overlays.get("lead")),
            );
            let back = normalize_vocal_overlay_ids(
                overlays.get("backVocals").or_else(|| overlays.get("back")),
            );
            overlays.remove("lead");
            overlays.remove("back");
            overlays.insert("leadVocals".to_string(), lead);
            overlays.insert("backVocals".to_string(), back);
        }
    } else {
        object.remove("leadVocalistIds");
        object.remove("backVocalIds");
        if let Some(lineup) = object.get_mut("lineup").and_then(|v| v.as_object_mut()) {
            lineup.remove("lead_vocs");
            lineup.remove("back_vocs");
        }
        let overlays = object
            .entry("overlays".to_string())
            .or_insert_with(|| serde_json::json!({}));
        if let Some(overlays) = overlays.as_object_mut() {
            let lead = normalize_vocal_overlay_ids(overlays.get("leadVocals"));
            let back = normalize_vocal_overlay_ids(overlays.get("backVocals"));
            overlays.insert("leadVocals".to_string(), lead);
            overlays.insert("backVocals".to_string(), back);
        }
    }

    if value == before {
        return Ok(false);
    }
    let bytes = serde_json::to_vec_pretty(&value).map_err(|e| {
        StorageError::Resolve(format!(
            "Failed to serialize vocal overlay cleanup JSON {} ({e})",
            path.display()
        ))
    })?;
    atomic_write_bytes(path, &bytes)?;
    Ok(true)
}

fn cleanup_vocal_overlays_dir(dir: &Path, is_band: bool) -> Result<bool, StorageError> {
    if !dir.exists() {
        return Ok(false);
    }
    let mut changed = false;
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        changed |= cleanup_vocal_overlays_in_file(&path, is_band)?;
    }
    Ok(changed)
}

fn cleanup_vocal_overlays(root: &Path) -> Result<bool, StorageError> {
    let bands_changed = cleanup_vocal_overlays_dir(&root.join("catalog/bands"), true)?;
    let projects_changed = cleanup_vocal_overlays_dir(&root.join("projects"), false)?;
    Ok(bands_changed || projects_changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_test_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("stagepilot-storage-tests-{name}-{nanos}"))
    }

    #[test]
    fn stagepilot_user_data_dir_uses_clean_appdata_root() {
        let app_data_dir = PathBuf::from("AppData")
            .join("Roaming")
            .join("com.mkrecmer.stagepilot-desktop");
        let root = stagepilot_user_data_dir_from_app_data_dir(&app_data_dir).unwrap();

        assert_eq!(
            root,
            PathBuf::from("AppData").join("Roaming").join("StagePilot")
        );
        assert_eq!(storage_meta_path(&root), root.join("storage.json"));
        assert_eq!(
            root.join("projects"),
            PathBuf::from("AppData")
                .join("Roaming")
                .join("StagePilot")
                .join("projects")
        );
        assert!(!root.ends_with(Path::new("com.mkrecmer.stagepilot-desktop").join("stagepilot")));
    }

    #[test]
    fn stagepilot_user_data_dir_errors_when_parent_is_missing() {
        let empty_path = PathBuf::new();
        let err = stagepilot_user_data_dir_from_app_data_dir(&empty_path).unwrap_err();

        assert!(matches!(err, StorageError::Resolve(_)));
    }

    #[test]
    fn seed_catalog_ensures_default_notes_template_idempotently() {
        let root = temp_test_dir("seed-idempotent-root");
        fs::create_dir_all(root.join("catalog/templates/notes")).unwrap();

        ensure_default_notes_template(&root).unwrap();
        let first =
            fs::read_to_string(root.join("catalog/templates/notes/notes_default_cs.json")).unwrap();
        assert!(first.contains("\"id\": \"notes_default_cs\""));

        // Simuluje instalaci z doby před zavedením verzování (bez pole "version").
        fs::write(
            root.join("catalog/templates/notes/notes_default_cs.json"),
            b"{\"id\":\"notes_default_cs\",\"lang\":\"cs\",\"inputs\":[]}",
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();
        let target_path = root.join("catalog/templates/notes/notes_default_cs.json");
        let second: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target_path).unwrap()).unwrap();

        // Soubor bez "version" má implicitně verzi 0: položky se since <= 0 se
        // nedoplňují (uživatel je má, i když je třeba smazal), pouze ty se
        // since: 1, a "version" se zvedne na aktuální.
        assert_eq!(second.get("version").unwrap().as_i64().unwrap(), 1);
        assert!(second.get("inputs").unwrap().as_array().unwrap().is_empty());
        let monitor_ids: Vec<&str> = second
            .get("monitors")
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
            .collect();
        assert!(monitor_ids.contains(&"band_supplied_iem"));
        assert!(monitor_ids.contains(&"foh_supplied_iem"));

        // Druhé spuštění na už-aktuální verzi nesmí nic měnit.
        let before_rerun = fs::read_to_string(&target_path).unwrap();
        ensure_default_notes_template(&root).unwrap();
        let after_rerun = fs::read_to_string(&target_path).unwrap();
        assert_eq!(before_rerun, after_rerun);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn merges_new_template_entries_without_touching_existing_text() {
        let root = temp_test_dir("notes-merge");
        let notes_dir = root.join("catalog/templates/notes");
        fs::create_dir_all(&notes_dir).unwrap();
        let target = notes_dir.join("notes_default_cs.json");

        // Instalace z doby před verzí 1, s ručně upraveným textem.
        fs::write(
            &target,
            br#"{"id":"notes_default_cs","lang":"cs","inputs":[{"id":"no_foh_engineer","text":"UPRAVENO"}],"monitors":[]}"#,
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();

        let merged: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        let monitors = merged.get("monitors").unwrap().as_array().unwrap();
        let monitor_ids: Vec<&str> = monitors
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
            .collect();

        assert!(monitor_ids.contains(&"band_supplied_iem"));
        assert!(monitor_ids.contains(&"foh_supplied_iem"));
        assert_eq!(merged.get("version").unwrap().as_i64().unwrap(), 1);

        let inputs = merged.get("inputs").unwrap().as_array().unwrap();
        let kept = inputs
            .iter()
            .find(|i| i.get("id").and_then(|v| v.as_str()) == Some("no_foh_engineer"))
            .unwrap();
        assert_eq!(kept.get("text").unwrap().as_str().unwrap(), "UPRAVENO");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn does_not_restore_entries_the_user_deleted() {
        let root = temp_test_dir("notes-deleted");
        let notes_dir = root.join("catalog/templates/notes");
        fs::create_dir_all(&notes_dir).unwrap();
        let target = notes_dir.join("notes_default_cs.json");

        // Soubor už je na verzi 1, uživatel jednu novinku smazal.
        fs::write(
            &target,
            br#"{"id":"notes_default_cs","lang":"cs","version":1,"inputs":[],"monitors":[]}"#,
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();

        let merged: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        assert!(merged.get("monitors").unwrap().as_array().unwrap().is_empty());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn seed_catalog_does_not_require_repo_seed_source() {
        let root = temp_test_dir("seed-without-repo-assets");
        fs::create_dir_all(&root).unwrap();

        seed_catalog(&root).unwrap();

        let notes_path = root.join("catalog/templates/notes/notes_default_cs.json");
        assert!(notes_path.exists());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn migrate_lineup_assignments_normalizes_bands_and_projects_idempotently() {
        let root = temp_test_dir("lineup-migration");
        fs::create_dir_all(root.join("catalog/bands")).unwrap();
        fs::create_dir_all(root.join("projects")).unwrap();

        let band_path = root.join("catalog/bands/b1.json");
        fs::write(
            &band_path,
            r#"{
  "id": "b1",
  "name": "Band",
  "defaultLineup": {
    "drums": ["dr-1", "dr-2", "dr-1"],
    "bass": "b-1",
    "guitar": null
  },
  "unrelated": { "keep": true }
}"#,
        )
        .unwrap();

        let project_path = root.join("projects/p1.json");
        fs::write(
            &project_path,
            r#"{
  "id": "p1",
  "lineup": {
    "drums": [
      "dr-1",
      { "musicianId": "dr-2", "presetOverride": { "monitoring": { "monitorRef": "wedge" } } },
      "dr-1"
    ],
    "bass": "b-1",
    "guitar": null,
    "back_vocs": ["bv-1"]
  },
  "unrelated": "preserved"
}"#,
        )
        .unwrap();

        assert!(migrate_lineup_assignments(&root).unwrap());
        assert!(!migrate_lineup_assignments(&root).unwrap());

        let band: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&band_path).unwrap()).unwrap();
        assert_eq!(
            band.get("defaultLineup").unwrap(),
            &serde_json::json!({
                "drums": ["dr-1", "dr-2"],
                "bass": ["b-1"],
                "guitar": [],
                "keys": [],
                "vocs": []
            })
        );
        assert_eq!(
            band.pointer("/unrelated/keep").unwrap(),
            &serde_json::json!(true)
        );

        let project: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&project_path).unwrap()).unwrap();
        assert_eq!(
            project.get("lineup").unwrap(),
            &serde_json::json!({
                "drums": [
                    "dr-1",
                    { "musicianId": "dr-2", "presetOverride": { "monitoring": { "monitorRef": "wedge" } } }
                ],
                "bass": ["b-1"],
                "guitar": [],
                "keys": [],
                "vocs": [],
                "back_vocs": ["bv-1"]
            })
        );
        assert_eq!(
            project.get("unrelated").unwrap(),
            &serde_json::json!("preserved")
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn migrate_lineup_assignments_preserves_project_inheritance_when_lineup_missing() {
        let root = temp_test_dir("lineup-migration-inheritance");
        fs::create_dir_all(root.join("catalog/bands")).unwrap();
        fs::create_dir_all(root.join("projects")).unwrap();

        let project_path = root.join("projects/p1.json");
        fs::write(&project_path, r#"{ "id": "p1", "bandRef": "b1" }"#).unwrap();

        assert!(!migrate_lineup_assignments(&root).unwrap());
        let project: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&project_path).unwrap()).unwrap();
        assert!(project.get("lineup").is_none());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn cleanup_vocal_overlays_converts_slots_removes_legacy_fields_and_is_idempotent() {
        let root = temp_test_dir("vocal-overlay-cleanup");
        fs::create_dir_all(root.join("catalog/bands")).unwrap();
        fs::create_dir_all(root.join("projects")).unwrap();

        let band_path = root.join("catalog/bands/b1.json");
        fs::write(
            &band_path,
            r#"{
  "id": "b1",
  "name": "Band",
  "defaultOverlays": {
    "leadVocals": [
      { "slot": 2, "musicianId": "lead-2" },
      { "slot": 1, "musicianId": "lead-1" },
      { "slot": 3, "musicianId": "lead-1" }
    ],
    "back": ["back-1"]
  },
  "defaultVocals": { "lead": ["legacy-lead"], "back": ["legacy-back"] },
  "keep": true
}"#,
        )
        .unwrap();

        let project_path = root.join("projects/p1.json");
        fs::write(
            &project_path,
            r#"{
  "id": "p1",
  "lineup": {
    "vocs": ["lead-1"],
    "lead_vocs": ["legacy-lead"],
    "back_vocs": ["legacy-back"]
  },
  "overlays": {
    "leadVocals": [
      { "slot": 2, "musicianId": "lead-2" },
      { "slot": 1, "musicianId": "lead-1" }
    ],
    "backVocals": ["back-1", "back-1", { "musicianId": "back-2" }]
  },
  "leadVocalistIds": ["legacy-lead"],
  "backVocalIds": ["legacy-back"],
  "keep": "yes"
}"#,
        )
        .unwrap();

        assert!(cleanup_vocal_overlays(&root).unwrap());
        assert!(!cleanup_vocal_overlays(&root).unwrap());

        let band: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&band_path).unwrap()).unwrap();
        assert_eq!(
            band.get("defaultOverlays").unwrap(),
            &serde_json::json!({
                "leadVocals": ["lead-1", "lead-2"],
                "backVocals": ["back-1"]
            })
        );
        assert!(band.get("defaultVocals").is_none());
        assert_eq!(band.get("keep").unwrap(), &serde_json::json!(true));

        let project: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&project_path).unwrap()).unwrap();
        assert_eq!(
            project.get("overlays").unwrap(),
            &serde_json::json!({
                "leadVocals": ["lead-1", "lead-2"],
                "backVocals": ["back-1", "back-2"]
            })
        );
        assert!(project.get("leadVocalistIds").is_none());
        assert!(project.get("backVocalIds").is_none());
        assert!(project.pointer("/lineup/lead_vocs").is_none());
        assert!(project.pointer("/lineup/back_vocs").is_none());
        assert_eq!(project.get("keep").unwrap(), &serde_json::json!("yes"));

        let _ = fs::remove_dir_all(&root);
    }
}

pub fn ensure_user_storage(app: &tauri::AppHandle) -> Result<UserStorageMeta, StorageError> {
    let root = stagepilot_user_data_dir(app)?;
    fs::create_dir_all(&root)?;
    ensure_dirs(&root)?;

    let meta_path = storage_meta_path(&root);
    let mut metadata_migrated = false;
    let mut meta = if !meta_path.exists() {
        UserStorageMeta {
            schema_version: STORAGE_SCHEMA_VERSION,
            seed_version: STORAGE_SEED_VERSION,
            seed_completed: false,
            created_at: now_iso(),
            last_migrated_at: None,
        }
    } else {
        let content = fs::read_to_string(&meta_path)?;
        let value: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| StorageError::MalformedMetadata(e.to_string()))?;

        let schema_version = value
            .get("schemaVersion")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| StorageError::InvalidMetadata("Missing schemaVersion".into()))?
            as u32;
        if schema_version > STORAGE_SCHEMA_VERSION {
            return Err(StorageError::UnsupportedMetadataSchema(schema_version));
        }

        let mut migrated = schema_version != STORAGE_SCHEMA_VERSION;
        let seed_version = value
            .get("seedVersion")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or_else(|| {
                migrated = true;
                STORAGE_SEED_VERSION
            });
        let seed_completed = value
            .get("seedCompleted")
            .and_then(|v| v.as_bool())
            .unwrap_or_else(|| {
                migrated = true;
                false
            });
        let created_at = value
            .get("createdAt")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .unwrap_or_else(|| {
                migrated = true;
                now_iso()
            });
        let last_migrated_at = value
            .get("lastMigratedAt")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string());

        metadata_migrated = migrated;
        UserStorageMeta {
            schema_version: STORAGE_SCHEMA_VERSION,
            seed_version,
            seed_completed,
            created_at,
            last_migrated_at,
        }
    };

    let migrated = migrate_legacy_library(&root)?;
    let lineup_migrated = migrate_lineup_assignments(&root)?;
    let vocal_cleanup_migrated = cleanup_vocal_overlays(&root)?;
    if migrated || lineup_migrated || vocal_cleanup_migrated || metadata_migrated {
        meta.last_migrated_at = Some(now_iso());
    }

    if !meta.seed_completed || meta.seed_version != STORAGE_SEED_VERSION {
        seed_catalog(&root)?;
        meta.seed_completed = true;
        meta.seed_version = STORAGE_SEED_VERSION;
    }

    let json = serde_json::to_vec_pretty(&meta)
        .map_err(|e| StorageError::Resolve(format!("Failed to serialize storage metadata: {e}")))?;
    atomic_write_bytes(&meta_path, &json)?;
    Ok(meta)
}

pub fn projects_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(stagepilot_user_data_dir(app)?.join("projects"))
}

pub fn exports_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(stagepilot_user_data_dir(app)?.join("exports"))
}

pub fn versions_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(stagepilot_user_data_dir(app)?.join("versions"))
}

pub fn temp_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(stagepilot_user_data_dir(app)?.join("temp"))
}

pub fn catalog_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(stagepilot_user_data_dir(app)?.join("catalog"))
}

pub fn sanitize_id_to_filename(project_id: &str) -> String {
    let mut out = String::with_capacity(project_id.len().min(MAX_ID_LEN));
    for ch in project_id.chars() {
        if out.len() >= MAX_ID_LEN {
            break;
        }
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    while out.starts_with('.') {
        out.remove(0);
    }
    if out.is_empty() {
        "project".to_string()
    } else {
        out
    }
}

pub fn atomic_write_bytes(path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    let temp_path = path.with_extension("tmp");
    let mut file = File::create(&temp_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(temp_path, path)?;
    Ok(())
}
