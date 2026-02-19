use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const STORAGE_DIR_NAME: &str = "stagepilot";
const STORAGE_SCHEMA_VERSION: u32 = 1;
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

pub fn user_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    // StagePilot desktop currently targets Tauri v2 (`tauri = "2"`), where
    // app-data paths are resolved via `app.path().app_data_dir()`.
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

pub fn ensure_user_storage(app: &tauri::AppHandle) -> Result<UserStorageMeta, StorageError> {
    let root = user_storage_root(app)?;
    fs::create_dir_all(&root)?;
    for folder in [
        "projects", "exports", "temp", "versions", "assets", "library",
    ] {
        fs::create_dir_all(root.join(folder))?;
    }

    let meta_path = storage_meta_path(&root);
    if !meta_path.exists() {
        let meta = UserStorageMeta {
            schema_version: STORAGE_SCHEMA_VERSION,
            created_at: now_iso(),
            last_migrated_at: None,
        };
        let json = serde_json::to_vec_pretty(&meta).map_err(|e| {
            StorageError::Resolve(format!("Failed to serialize storage metadata: {e}"))
        })?;
        atomic_write_bytes(&meta_path, &json)?;
        return Ok(meta);
    }

    let content = fs::read_to_string(&meta_path)?;
    let meta: UserStorageMeta = serde_json::from_str(&content)
        .map_err(|e| StorageError::Resolve(format!("Invalid storage metadata JSON: {e}")))?;
    if meta.schema_version != STORAGE_SCHEMA_VERSION {
        return Err(StorageError::InvalidSchema(meta.schema_version));
    }
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

pub fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    ensure_user_storage(app)?;
    Ok(user_storage_root(app)?.join("library"))
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

pub fn project_json_path(projects_dir: &Path, project_id: &str) -> Result<PathBuf, StorageError> {
    let file_name = format!("{}.json", sanitize_id_to_filename(project_id));
    safe_join(projects_dir, &file_name)
}

pub fn safe_join(base: &Path, child: &str) -> Result<PathBuf, StorageError> {
    let child_path = Path::new(child);
    if child_path.is_absolute() {
        return Err(StorageError::Resolve(
            "Absolute paths are not allowed".into(),
        ));
    }
    if child_path.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(StorageError::Resolve(
            "Path traversal is not allowed".into(),
        ));
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

#[cfg(test)]
mod tests {
    use super::{safe_join, sanitize_id_to_filename};
    use std::path::Path;

    #[test]
    fn sanitize_project_id() {
        assert_eq!(sanitize_id_to_filename("project-1"), "project-1");
        assert_eq!(sanitize_id_to_filename("../../evil"), "__.._evil");
        assert_eq!(sanitize_id_to_filename(""), "project");
    }

    #[test]
    fn safe_join_disallows_traversal() {
        let root = Path::new("/tmp/root");
        assert!(safe_join(root, "ok.json").is_ok());
        assert!(safe_join(root, "../bad.json").is_err());
    }
}
