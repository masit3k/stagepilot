use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const STORAGE_DIR_NAME: &str = "stagepilot";
const STORAGE_SCHEMA_VERSION: u32 = 2;
const STORAGE_SEED_VERSION: u32 = 3;
const MAX_ID_LEN: usize = 120;
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
const DEFAULT_NOTES_TEMPLATE_JSON: &str = include_str!("../../../../src/infra/storage/defaultNotesTemplate.notes_default_cs.json");

pub fn user_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| StorageError::Resolve(format!("Failed to resolve app data dir: {e}")))?;
    Ok(app_data_dir.join(STORAGE_DIR_NAME))
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

    let root = user_storage_root(app)?;
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

fn ensure_default_notes_template(root: &Path) -> Result<(), StorageError> {
    let templates_dir = root.join("catalog/templates/notes");
    fs::create_dir_all(&templates_dir)?;

    let target = templates_dir.join(format!("{}.json", DEFAULT_NOTES_TEMPLATE_ID));
    if target.exists() {
        return Ok(());
    }

    let parsed: serde_json::Value = serde_json::from_str(DEFAULT_NOTES_TEMPLATE_JSON).map_err(|e| {
        StorageError::Resolve(format!("Invalid embedded default notes template JSON: {e}"))
    })?;
    let bytes = serde_json::to_vec_pretty(&parsed).map_err(|e| {
        StorageError::Resolve(format!("Failed to serialize embedded default notes template: {e}"))
    })?;
    atomic_write_bytes(&target, &bytes)?;
    Ok(())
}

fn seed_catalog(root: &Path) -> Result<(), StorageError> {
    ensure_default_notes_template(root)?;
    Ok(())
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
    fn seed_catalog_ensures_default_notes_template_idempotently() {
        let root = temp_test_dir("seed-idempotent-root");
        fs::create_dir_all(root.join("catalog/templates/notes")).unwrap();

        ensure_default_notes_template(&root).unwrap();
        let first = fs::read_to_string(
            root.join("catalog/templates/notes/notes_default_cs.json"),
        )
        .unwrap();
        assert!(first.contains("\"id\": \"notes_default_cs\""));

        fs::write(
            root.join("catalog/templates/notes/notes_default_cs.json"),
            b"{\"id\":\"notes_default_cs\",\"lang\":\"cs\",\"inputs\":[]}",
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();
        let second = fs::read_to_string(
            root.join("catalog/templates/notes/notes_default_cs.json"),
        )
        .unwrap();
        assert_eq!(second, "{\"id\":\"notes_default_cs\",\"lang\":\"cs\",\"inputs\":[]}");

        let _ = fs::remove_dir_all(&root);
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
}

pub fn ensure_user_storage(app: &tauri::AppHandle) -> Result<UserStorageMeta, StorageError> {
    let root = user_storage_root(app)?;
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
    if migrated || metadata_migrated {
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
    Ok(user_storage_root(app)?.join("projects"))
}

pub fn exports_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(user_storage_root(app)?.join("exports"))
}

pub fn versions_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(user_storage_root(app)?.join("versions"))
}

pub fn temp_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(user_storage_root(app)?.join("temp"))
}

pub fn catalog_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(user_storage_root(app)?.join("catalog"))
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
