use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::mpsc,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

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
    display_name: Option<String>,
    band_ref: Option<String>,
    event_date: Option<String>,
    event_venue: Option<String>,
    purpose: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BandOption {
    id: String,
    name: String,
    code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RoleCountConstraint {
    min: usize,
    max: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BandSetupData {
    id: String,
    name: String,
    band_leader: Option<String>,
    default_contact_id: Option<String>,
    constraints: HashMap<String, RoleCountConstraint>,
    role_constraints: Option<Value>,
    default_lineup: Option<Value>,
    members: HashMap<String, Vec<MemberOption>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MemberOption {
    id: String,
    name: String,
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
    result: Option<Value>,
    code: Option<String>,
    message: Option<String>,
    export_pdf_path: Option<String>,
    version_pdf_path: Option<String>,
}

fn resolve_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
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

    let app_data_dir = app.path().app_data_dir().map_err(|e| ApiError {
        code: "APP_DATA_DIR_FAILED".into(),
        message: format!("Failed to resolve app_data_dir: {e}"),
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

        let created_at = json
            .get("createdAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let updated_at = json
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
                        .or_else(|| json.get("eventDate").and_then(|v| v.as_str()).map(|s| format!("{}T00:00:00Z", s)));

        let summary = ProjectSummary {
            id,
            display_name: json
                .get("displayName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
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
            created_at,
            updated_at,
        };

        results.push(summary);
    }

    results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(results)
}

#[tauri::command]
fn list_bands() -> Result<Vec<BandOption>, ApiError> {
    let bands_dir = resolve_repo_root().join("data").join("bands");
    let entries = fs::read_dir(&bands_dir).map_err(|err| ApiError {
        code: "BAND_LIST_FAILED".into(),
        message: format!("Failed to read bands at {} ({})", bands_dir.display(), err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let mut results = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|err| map_io_error(err, "BAND_LIST_FAILED", "Failed to read bands"))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let contents = fs::read_to_string(&path)
            .map_err(|err| map_io_error(err, "BAND_LIST_FAILED", "Failed to read band file"))?;

        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|err| ApiError {
            code: "BAND_LIST_FAILED".into(),
            message: format!("Invalid band JSON: {}", err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

        let id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();
        let name = json
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        if id.is_empty() || name.is_empty() {
            continue;
        }

        let code = json
            .get("code")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        results.push(BandOption { id, name, code });
    }

    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(results)
}

#[tauri::command]
fn get_band_setup_data(band_id: String) -> Result<BandSetupData, ApiError> {
    let repo_root = resolve_repo_root();
    let bands_dir = repo_root.join("data").join("bands");
    let entries = fs::read_dir(&bands_dir).map_err(|err| ApiError {
        code: "BAND_SETUP_LOAD_FAILED".into(),
        message: format!("Failed to read bands at {} ({})", bands_dir.display(), err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let mut selected: Option<Value> = None;
    for entry in entries {
        let path = entry
            .map_err(|err| map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read bands"))?
            .path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let contents = fs::read_to_string(&path).map_err(|err| {
            map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read band file")
        })?;
        let json: Value = serde_json::from_str(&contents).map_err(|err| ApiError {
            code: "BAND_SETUP_LOAD_FAILED".into(),
            message: format!("Invalid band JSON in {} ({})", path.display(), err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

        if json.get("id").and_then(|v| v.as_str()) == Some(band_id.as_str()) {
            selected = Some(json);
            break;
        }
    }

    let json = selected.ok_or(ApiError {
        code: "BAND_NOT_FOUND".into(),
        message: format!("Band not found: {}", band_id),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let members_root = repo_root.join("data").join("musicians");
    let mut members: HashMap<String, Vec<MemberOption>> = HashMap::new();
    for role in ["drums", "bass", "guitar", "keys", "vocs", "talkback"] {
        let role_dir = members_root.join(role);
        let mut role_members: Vec<MemberOption> = Vec::new();
        if role_dir.exists() {
            let role_entries = fs::read_dir(&role_dir).map_err(|err| {
                map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read musicians")
            })?;
            for role_entry in role_entries {
                let role_path = role_entry
                    .map_err(|err| {
                        map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read musicians")
                    })?
                    .path();
                if role_path.extension().and_then(|s| s.to_str()) != Some("json") {
                    continue;
                }
                let contents = fs::read_to_string(&role_path).map_err(|err| {
                    map_io_error(
                        err,
                        "BAND_SETUP_LOAD_FAILED",
                        "Failed to read musician file",
                    )
                })?;
                let musician: Value = serde_json::from_str(&contents).map_err(|err| ApiError {
                    code: "BAND_SETUP_LOAD_FAILED".into(),
                    message: format!("Invalid musician JSON in {} ({})", role_path.display(), err),
                    export_pdf_path: None,
                    version_pdf_path: None,
                })?;
                let id = musician.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if id.is_empty() {
                    continue;
                }
                let first_name = musician
                    .get("firstName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let last_name = musician
                    .get("lastName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let name = format!("{} {}", last_name, first_name).trim().to_string();
                role_members.push(MemberOption {
                    id: id.to_string(),
                    name,
                });
            }
        }
        role_members.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        members.insert(role.to_string(), role_members);
    }

    let constraints: HashMap<String, RoleCountConstraint> = serde_json::from_value(
        json.get("constraints")
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new())),
    )
    .map_err(|err| ApiError {
        code: "BAND_SETUP_LOAD_FAILED".into(),
        message: format!("Invalid constraints for band {} ({})", band_id, err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    Ok(BandSetupData {
        id: json
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        name: json
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        band_leader: json
            .get("bandLeader")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        default_contact_id: json
            .get("defaultContactId")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        constraints,
        role_constraints: json.get("roleConstraints").cloned(),
        default_lineup: json.get("defaultLineup").cloned(),
        members,
    })
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
    let response: NodeExportResponse =
        serde_json::from_str(stdout.trim()).map_err(|err| ApiError {
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
        let result = response.result.ok_or(ApiError {
            code: "EXPORT_FAILED".into(),
            message: "Export succeeded but no result returned.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        let parsed: ExportPdfResult = serde_json::from_value(result).map_err(|err| ApiError {
            code: "EXPORT_FAILED".into(),
            message: format!("Export payload is invalid: {}", err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        return Ok(parsed);
    }

    let code = response.code.unwrap_or_else(|| "EXPORT_FAILED".into());
    let message = response.message.unwrap_or_else(|| "Export failed.".into());

    Err(ApiError {
        code,
        message,
        export_pdf_path: response.export_pdf_path,
        version_pdf_path: response.version_pdf_path,
    })
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewPdfPathResult {
    preview_pdf_path: String,
}

#[tauri::command]
fn build_project_pdf_preview(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<PreviewPdfPathResult, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let repo_root = resolve_repo_root();
    let script_path = repo_root.join("scripts").join("desktop_preview.ts");

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
        .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to execute preview"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: NodeExportResponse =
        serde_json::from_str(stdout.trim()).map_err(|err| ApiError {
            code: "PREVIEW_FAILED".into(),
            message: format!(
                "Failed to parse preview response: {} (stdout: {}, stderr: {})",
                err,
                stdout,
                String::from_utf8_lossy(&output.stderr)
            ),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

    if response.ok {
        if let Some(result) = response.result {
            let preview_pdf_path = result
                .get("previewPdfPath")
                .and_then(|v| v.as_str())
                .ok_or(ApiError {
                    code: "PREVIEW_FAILED".into(),
                    message: "Preview succeeded but no preview path was returned.".into(),
                    export_pdf_path: None,
                    version_pdf_path: None,
                })?
                .to_string();
            return Ok(PreviewPdfPathResult {
                preview_pdf_path,
            });
        }
    }

    Err(ApiError {
        code: response.code.unwrap_or_else(|| "PREVIEW_FAILED".into()),
        message: response.message.unwrap_or_else(|| "Preview failed.".into()),
        export_pdf_path: response.export_pdf_path,
        version_pdf_path: response.version_pdf_path,
    })
}


#[tauri::command]
fn read_preview_pdf_bytes(preview_pdf_path: String) -> Result<Vec<u8>, ApiError> {
    fs::read(&preview_pdf_path)
        .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to read preview PDF bytes"))
}

#[tauri::command]
fn cleanup_preview_pdf(app: tauri::AppHandle, project_id: String) -> Result<(), ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let preview_path = user_data_dir.join("temp").join(format!("preview_{}.pdf", project_id));
    if preview_path.exists() {
        fs::remove_file(&preview_path)
            .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to remove preview PDF"))?;
    }
    Ok(())
}

#[tauri::command]
fn get_exports_dir(app: tauri::AppHandle) -> Result<String, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let exports_dir = user_data_dir.join("exports");
    fs::create_dir_all(&exports_dir)
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to create exports dir"))?;
    Ok(exports_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn default_export_pdf_path(app: tauri::AppHandle, project_id: String) -> Result<String, ApiError> {
    let user_data_dir = resolve_user_data_dir(&app)?;
    let exports_dir = user_data_dir.join("exports");
    fs::create_dir_all(&exports_dir)
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to create exports dir"))?;
    Ok(exports_dir
        .join(format!("{}.pdf", project_id))
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
fn export_pdf_to_path(
    app: tauri::AppHandle,
    project_id: String,
    output_path: String,
) -> Result<(), ApiError> {
    let result = export_pdf(app, project_id)?;
    let bytes = fs::read(&result.export_pdf_path)
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to read generated PDF"))?;

    let output = PathBuf::from(&output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to prepare export directory"))?;
    }

    let temp_name = format!("{}.tmp", output.file_name().and_then(|v| v.to_str()).unwrap_or("export.pdf"));
    let temp_path = output.with_file_name(temp_name);

    fs::write(&temp_path, bytes)
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to write export temp file"))?;

    if output.exists() {
        fs::remove_file(&output).map_err(|err| {
            let mut mapped = map_io_error(err, "EXPORT_FAILED", "Failed to overwrite existing PDF");
            if mapped.message.contains("os error 32") {
                mapped.message = format!(
                    "{} — File is open in another program (e.g. preview). Close it and retry.",
                    mapped.message
                );
            }
            mapped
        })?;
    }

    fs::rename(&temp_path, &output).map_err(|err| {
        let mut mapped = map_io_error(err, "EXPORT_FAILED", "Failed to finalize exported PDF");
        if mapped.message.contains("os error 32") {
            mapped.message = format!(
                "{} — File is open in another program (e.g. preview). Close it and retry.",
                mapped.message
            );
        }
        mapped
    })?;

    Ok(())
}

#[tauri::command]
fn pick_export_pdf_path(app: tauri::AppHandle, default_file_name: String) -> Result<Option<String>, ApiError> {
    let default_dir = PathBuf::from(r"C:\Users\mkrecmer\dev\stagepilot\user_data\exports");
    fs::create_dir_all(&default_dir)
        .map_err(|err| map_io_error(err, "EXPORT_DIALOG_FAILED", "Failed to create default export dir"))?;

    let (tx, rx) = mpsc::channel::<Option<PathBuf>>();
    app.dialog()
        .file()
        .set_directory(default_dir)
        .set_file_name(default_file_name)
        .add_filter("PDF", &["pdf"])
        .save_file(move |file_path| {
            let _ = tx.send(file_path.and_then(|path| path.as_path().map(|p| p.to_path_buf())));
        });

    let selected = rx.recv().map_err(|err| ApiError {
        code: "EXPORT_DIALOG_FAILED".into(),
        message: format!("Failed to receive selected file path: {}", err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    Ok(selected.map(|path| path.to_string_lossy().to_string()))
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_user_data_dir,
            list_projects,
            list_bands,
            get_band_setup_data,
            read_project,
            save_project,
            export_pdf,
            build_project_pdf_preview,
            read_preview_pdf_bytes,
            cleanup_preview_pdf,
            get_exports_dir,
            default_export_pdf_path,
            export_pdf_to_path,
            pick_export_pdf_path,
            open_file,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
