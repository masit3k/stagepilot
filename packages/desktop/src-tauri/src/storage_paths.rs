use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const STORAGE_DIR_NAME: &str = "stagepilot";
const STORAGE_SCHEMA_VERSION: u32 = 2;
const STORAGE_SEED_VERSION: u32 = 1;
const MAX_ID_LEN: usize = 120;

#[derive(Debug)]
pub enum StorageError {
    Io(std::io::Error),
    Resolve(String),
    InvalidSchema(u32),
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

fn seed_source_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("data")
}

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
        "catalog/musicians",
        "catalog/contacts",
        "catalog/presets/groups",
        "catalog/presets/monitors",
        "catalog/templates/notes",
    ] {
        fs::create_dir_all(root.join(folder))?;
    }
    Ok(())
}

fn copy_seed_dir_if_missing(seed: &Path, target: &Path) -> Result<(), StorageError> {
    if !seed.exists() {
        return Err(StorageError::Resolve(format!(
            "Seed source missing: {}",
            seed.display()
        )));
    }
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(seed)? {
        let entry = entry?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            copy_seed_dir_if_missing(&from, &to)?;
        } else if from.extension().and_then(|s| s.to_str()) == Some("json") {
            if !to.exists() {
                fs::copy(from, to)?;
            }
        }
    }
    Ok(())
}

fn migrate_legacy_library(root: &Path) -> Result<bool, StorageError> {
    let legacy = root.join("library");
    if !legacy.exists() {
        return Ok(false);
    }
    let mut migrated = false;
    let map_files = [
        ("bands.json", root.join("catalog/bands")),
        ("musicians.json", root.join("catalog/musicians/migrated")),
        ("contacts.json", root.join("catalog/contacts")),
    ];

    for (file_name, target_dir) in map_files {
        let file = legacy.join(file_name);
        if !file.exists() {
            continue;
        }
        let content = fs::read_to_string(&file)?;
        let items: Vec<serde_json::Value> = serde_json::from_str(&content)
            .map_err(|e| StorageError::Resolve(format!("Invalid legacy JSON {} ({e})", file_name)))?;
        fs::create_dir_all(&target_dir)?;
        for item in items {
            let Some(id) = item.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let target = target_dir.join(format!("{}.json", sanitize_id_to_filename(id)));
            if !target.exists() {
                let bytes = serde_json::to_vec_pretty(&item)
                    .map_err(|e| StorageError::Resolve(format!("Serialize migrated JSON failed ({e})")))?;
                atomic_write_bytes(&target, &bytes)?;
            }
            migrated = true;
        }
    }

    if migrated {
        fs::remove_dir_all(legacy)?;
    }
    Ok(migrated)
}

fn seed_catalog(root: &Path) -> Result<(), StorageError> {
    let seed = seed_source_root();
    copy_seed_dir_if_missing(&seed.join("bands"), &root.join("catalog/bands"))?;
    copy_seed_dir_if_missing(&seed.join("musicians"), &root.join("catalog/musicians"))?;
    copy_seed_dir_if_missing(&seed.join("contacts"), &root.join("catalog/contacts"))?;
    copy_seed_dir_if_missing(
        &seed.join("assets/presets/groups"),
        &root.join("catalog/presets/groups"),
    )?;
    copy_seed_dir_if_missing(
        &seed.join("assets/presets/monitors"),
        &root.join("catalog/presets/monitors"),
    )?;
    copy_seed_dir_if_missing(
        &seed.join("assets/templates/notes"),
        &root.join("catalog/templates/notes"),
    )?;
    Ok(())
}

pub fn ensure_user_storage(app: &tauri::AppHandle) -> Result<UserStorageMeta, StorageError> {
    let root = user_storage_root(app)?;
    fs::create_dir_all(&root)?;
    ensure_dirs(&root)?;

    let meta_path = storage_meta_path(&root);
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
        let parsed: UserStorageMeta = serde_json::from_str(&content)
            .map_err(|e| StorageError::Resolve(format!("Invalid storage metadata JSON: {e}")))?;
        if parsed.schema_version != STORAGE_SCHEMA_VERSION {
            return Err(StorageError::InvalidSchema(parsed.schema_version));
        }
        parsed
    };

    let migrated = migrate_legacy_library(&root)?;
    if migrated {
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
    if out.is_empty() { "project".to_string() } else { out }
}

pub fn project_json_path(projects_dir: &Path, project_id: &str) -> Result<PathBuf, StorageError> {
    let file_name = format!("{}.json", sanitize_id_to_filename(project_id));
    safe_join(projects_dir, &file_name)
}

pub fn safe_join(base: &Path, child: &str) -> Result<PathBuf, StorageError> {
    let child_path = Path::new(child);
    if child_path.is_absolute() {
        return Err(StorageError::Resolve("Absolute paths are not allowed".into()));
    }
    if child_path.components().any(|c| {
        matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_))
    }) {
        return Err(StorageError::Resolve("Path traversal is not allowed".into()));
    }
    Ok(base.join(child_path))
}

pub fn atomic_write_bytes(path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    let temp_path = path.with_extension("tmp");
    let mut file = File::create(&temp_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(temp_path, path)?;
    Ok(())
}
