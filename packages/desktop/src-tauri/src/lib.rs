use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::Manager;

#[derive(Debug, Serialize)]
struct ApiError {
    code: String,
    message: String,
    export_pdf_path: Option<String>,
    version_pdf_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSummary {
    id: String,
    band_ref: Option<String>,
    event_date: Option<String>,
    event_venue: Option<String>,
    purpose: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPdfResult {
    version_pdf_path: String,
    export_pdf_path: String,
    export_updated: bool,
    version_id: String,
    version_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeExportResponse {
    ok: bool,
    result: Option<ExportPdfResult>,
    code: Option<String>,
    message: Option<String>,
    export_pdf_path: Option<String>,
    version_pdf_path: Option<String>,
}

fn resolve_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn resolve_user_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, ApiError> {
    if let Ok(env_dir) = std::env::var("STAGEPILOT_USER_DATA") {
        if !env_dir.trim().is_empty() {
            return Ok(PathBuf::from(env_dir));
        }
    }

    if cfg!(debug_assertions) {
        return Ok(resolve_repo_root().join("user_data"));
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .ok_or(ApiError {
            code: "USER_DATA_DIR_FAILED".into(),
            message: "Unable to resolve app data directory.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

    Ok(app_data_dir)
}

fn map_io_error(err: std::io::Error, code: &str, message: &str) -> ApiError {
    ApiError {
        code: code.into(),
        message: format!("{} ({})", message, err),
        export_pdf_path: None,
        version_pdf_path: None,
    }
}

#[tauri::command]
fn get_user_data_dir(app: tauri::AppHandle) -> Result<String, ApiError> {
    let dir = resolve_user_data_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let projects_dir = user_data_dir.join("projects");

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    let entries = fs::read_dir(&projects_dir)
        .map_err(|err| map_io_error(err, "PROJECT_LIST_FAILED", "Failed to read projects"))?;

    for entry in entries {
        let entry = entry
            .map_err(|err| map_io_error(err, "PROJECT_LIST_FAILED", "Failed to read projects"))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let contents = fs::read_to_string(&path).map_err(|err| {
            map_io_error(err, "PROJECT_LIST_FAILED", "Failed to read project file")
        })?;

        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|err| ApiError {
            code: "PROJECT_LIST_FAILED".into(),
            message: format!("Invalid project JSON: {}", err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

        let id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "unknown".to_string());

        let summary = ProjectSummary {
            id,
            band_ref: json
                .get("bandRef")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            event_date: json
                .get("eventDate")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            event_venue: json
                .get("eventVenue")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            purpose: json
                .get("purpose")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        };

        results.push(summary);
    }

    Ok(results)
}

#[tauri::command]
fn read_project(app: tauri::AppHandle, project_id: String) -> Result<String, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let project_path = user_data_dir
        .join("projects")
        .join(format!("{}.json", project_id));
    fs::read_to_string(&project_path)
        .map_err(|err| map_io_error(err, "PROJECT_READ_FAILED", "Failed to read project"))
}

#[tauri::command]
fn save_project(app: tauri::AppHandle, project_id: String, json: String) -> Result<(), ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let projects_dir = user_data_dir.join("projects");
    fs::create_dir_all(&projects_dir)
        .map_err(|err| map_io_error(err, "PROJECT_SAVE_FAILED", "Failed to create projects dir"))?;
    let project_path = projects_dir.join(format!("{}.json", project_id));
    fs::write(&project_path, json)
        .map_err(|err| map_io_error(err, "PROJECT_SAVE_FAILED", "Failed to save project"))
}

#[tauri::command]
fn export_pdf(app: tauri::AppHandle, project_id: String) -> Result<ExportPdfResult, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let project_path = user_data_dir
        .join("projects")
        .join(format!("{}.json", project_id));

    if !project_path.exists() {
        return Err(ApiError {
            code: "PROJECT_NOT_FOUND".into(),
            message: format!("Project file not found: {}", project_path.display()),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }

    let repo_root = resolve_repo_root();
    let script_path = repo_root.join("scripts").join("desktop_export.ts");

    let output = Command::new("node")
        .arg("--import")
        .arg("tsx")
        .arg(script_path.as_os_str())
        .arg("--project-id")
        .arg(&project_id)
        .arg("--user-data-dir")
        .arg(user_data_dir.as_os_str())
        .current_dir(&repo_root)
        .output()
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to execute export"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: NodeExportResponse = serde_json::from_str(stdout.trim()).map_err(|err| ApiError {
        code: "EXPORT_FAILED".into(),
        message: format!(
            "Failed to parse export response: {} (stdout: {}, stderr: {})",
            err,
            stdout,
            String::from_utf8_lossy(&output.stderr)
        ),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    if response.ok {
        return response.result.ok_or(ApiError {
            code: "EXPORT_FAILED".into(),
            message: "Export succeeded but no result returned.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }

    let code = response.code.unwrap_or_else(|| "EXPORT_FAILED".into());
    let message = response
        .message
        .unwrap_or_else(|| "Export failed.".into());

    Err(ApiError {
        code,
        message,
        export_pdf_path: response.export_pdf_path,
        version_pdf_path: response.version_pdf_path,
    })
}

#[tauri::command]
fn open_file(path: String) -> Result<(), ApiError> {
    open_path(&path, false)
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), ApiError> {
    open_path(&path, true)
}

fn open_path(path: &str, reveal: bool) -> Result<(), ApiError> {
    let path = Path::new(path);

    #[cfg(target_os = "windows")]
    {
        if reveal {
            Command::new("explorer")
                .arg("/select,")
                .arg(path)
                .status()
                .map_err(|err| map_io_error(err, "OPEN_FAILED", "Failed to open path"))?;
        } else {
            let path_str = path.to_string_lossy().to_string();
            Command::new("cmd")
                .args(["/C", "start", "", &path_str])
                .status()
                .map_err(|err| map_io_error(err, "OPEN_FAILED", "Failed to open path"))?;
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if reveal {
            cmd.arg("-R").arg(path);
        } else {
            cmd.arg(path);
        }
        cmd.status()
            .map_err(|err| map_io_error(err, "OPEN_FAILED", "Failed to open path"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let target = if reveal {
            path.parent().unwrap_or(path).to_path_buf()
        } else {
            path.to_path_buf()
        };

        Command::new("xdg-open")
            .arg(target)
            .status()
            .map_err(|err| map_io_error(err, "OPEN_FAILED", "Failed to open path"))?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_user_data_dir,
            list_projects,
            read_project,
            save_project,
            export_pdf,
            open_file,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
