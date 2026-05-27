mod storage_paths;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::mpsc,
};
use storage_paths::{
    atomic_write_bytes, catalog_dir as storage_catalog_dir, ensure_user_storage, exports_dir,
    maybe_wipe_storage_for_dev, projects_dir as storage_projects_dir, sanitize_id_to_filename,
    stagepilot_user_data_dir, temp_dir as storage_temp_dir, versions_dir as storage_versions_dir,
    StorageError,
};
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
    slug: Option<String>,
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
struct LibraryBand {
    id: String,
    name: String,
    code: String,
    description: Option<String>,
    default_lineup: Option<Value>,
    members: Vec<LibraryBandMember>,
    contacts: Vec<LibraryContact>,
    messages: Vec<LibraryMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LibraryBandMember {
    musician_id: String,
    roles: Vec<String>,
    is_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LibraryMusician {
    id: String,
    name: String,
    gender: Option<String>,
    default_roles: Vec<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LibraryInstrument {
    id: String,
    name: String,
    key: String,
    channels: usize,
    stereo_mode: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LibraryContact {
    id: String,
    name: String,
    title: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    note: Option<String>,
    primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LibraryMessage {
    id: String,
    name: String,
    body: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BandSetupData {
    id: String,
    name: String,
    band_leader: Option<String>,
    band_leader_id: Option<String>,
    default_talkback_owner_id: Option<String>,
    default_contact_id: Option<String>,
    default_lineup: Option<Value>,
    default_overlays: Option<Value>,
    members: HashMap<String, Vec<MemberOption>>,
    musician_defaults: HashMap<String, Value>,
    musician_presets_by_id: HashMap<String, Vec<Value>>,
    preset_catalog: HashMap<String, Value>,
    load_warnings: Vec<String>,
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

fn normalize_default_lineup_keys(default_lineup: Option<Value>) -> Option<Value> {
    let Some(Value::Object(lineup)) = default_lineup else {
        return default_lineup;
    };

    for forbidden_key in ["lead_vocs", "lead_voc", "back_vocs"] {
        if lineup.contains_key(forbidden_key) {
            return None;
        }
    }

    for (_role, value) in &lineup {
        if !value.is_array() {
            return None;
        }
    }

    Some(Value::Object(lineup))
}

fn normalize_default_overlays(
    default_overlays: Option<Value>,
    band_id: &str,
    load_warnings: &mut Vec<String>,
) -> Option<Value> {
    let Some(Value::Object(mut overlays)) = default_overlays else {
        return None;
    };

    let lead_source = overlays.remove("leadVocals");
    let back_source = overlays.remove("backVocals");

    fn to_string_array(
        value: Option<Value>,
        band_id: &str,
        role: &str,
        load_warnings: &mut Vec<String>,
    ) -> Vec<Value> {
        let Some(Value::Array(items)) = value else {
            return Vec::new();
        };
        let mut indexed: Vec<(usize, String)> = Vec::new();
        for (i, item) in items.iter().enumerate() {
            match item {
                Value::String(id) => {
                    let trimmed = id.trim();
                    if !trimmed.is_empty() {
                        indexed.push((i + 1, trimmed.to_string()));
                    }
                }
                Value::Object(obj) => {
                    if let Some(musician_id) = obj
                        .get("musicianId")
                        .and_then(|v| v.as_str())
                        .map(str::trim)
                        .filter(|id| !id.is_empty())
                    {
                        let slot = obj
                            .get("slot")
                            .and_then(|v| v.as_u64())
                            .filter(|s| *s > 0)
                            .map(|s| s as usize)
                            .unwrap_or(i + 1);
                        load_warnings.push(format!(
                            "Band '{}' defaultOverlays.{} contains legacy {{slot, musicianId}} object at position {} — run storage cleanup",
                            band_id, role, i
                        ));
                        indexed.push((slot, musician_id.to_string()));
                    } else {
                        load_warnings.push(format!(
                            "Band '{}' defaultOverlays.{} has unrecognized entry at position {} — dropped",
                            band_id, role, i
                        ));
                    }
                }
                _ => {
                    load_warnings.push(format!(
                        "Band '{}' defaultOverlays.{} has invalid entry at position {} — dropped",
                        band_id, role, i
                    ));
                }
            }
        }
        indexed.sort_by_key(|(order, _)| *order);
        let mut seen = std::collections::BTreeSet::new();
        indexed
            .into_iter()
            .filter_map(|(_, id)| {
                if seen.insert(id.clone()) {
                    Some(Value::String(id))
                } else {
                    None
                }
            })
            .collect()
    }

    Some(serde_json::json!({
        "leadVocals": to_string_array(lead_source, band_id, "leadVocals", load_warnings),
        "backVocals": to_string_array(back_source, band_id, "backVocals", load_warnings)
    }))
}

fn infer_monitoring_default_from_ref(monitor_ref: &str) -> Value {
    let normalized = monitor_ref.trim().to_lowercase();
    let monitor_type = if normalized.contains("wireless") {
        "iem_wireless"
    } else if normalized.contains("iem") {
        "iem_wired"
    } else {
        "wedge"
    };
    let mode = if normalized.contains("stereo") {
        "stereo"
    } else {
        "mono"
    };

    serde_json::json!({
        "monitoring": {
            "type": monitor_type,
            "mode": mode,
            "mixCount": if monitor_type == "wedge" { 1 } else { 2 }
        }
    })
}

fn resolve_workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
}

fn list_json_files_recursive(root: &Path) -> Result<Vec<PathBuf>, ApiError> {
    let mut files = Vec::new();
    for entry in fs::read_dir(root)
        .map_err(|err| map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read directory"))?
    {
        let entry = entry
            .map_err(|err| map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read entry"))?;
        let p = entry.path();
        if p.is_dir() {
            files.extend(list_json_files_recursive(&p)?);
        } else if p.extension().and_then(|s| s.to_str()) == Some("json") {
            files.push(p);
        }
    }
    Ok(files)
}

fn map_storage_error(err: StorageError, code: &str, context: &str) -> ApiError {
    let message = match err {
        StorageError::Io(e) => format!("{} ({})", context, e),
        StorageError::Resolve(msg) => format!("{} ({})", context, msg),
        StorageError::MalformedMetadata(msg) => {
            format!("{} (Malformed storage metadata JSON: {})", context, msg)
        }
        StorageError::UnsupportedMetadataSchema(schema) => format!(
            "{} (Unsupported storage metadata schemaVersion {}. Please update StagePilot.)",
            context, schema
        ),
        StorageError::InvalidMetadata(msg) => {
            format!("{} (Invalid storage metadata: {})", context, msg)
        }
    };
    ApiError {
        code: code.into(),
        message,
        export_pdf_path: None,
        version_pdf_path: None,
    }
}

fn map_io_error(err: std::io::Error, code: &str, message: &str) -> ApiError {
    ApiError {
        code: code.into(),
        message: format!("{} ({})", message, err),
        export_pdf_path: None,
        version_pdf_path: None,
    }
}

fn parse_node_export_response(stdout: &str, stderr: &str) -> Result<NodeExportResponse, ApiError> {
    serde_json::from_str(stdout.trim()).map_err(|err| ApiError {
        code: "EXPORT_RESPONSE_INVALID".into(),
        message: format!(
            "Invalid JSON response from export command: {} (stdout: {}, stderr: {})",
            err, stdout, stderr
        ),
        export_pdf_path: None,
        version_pdf_path: None,
    })
}

fn parse_project_json(path: &Path) -> Result<Value, ApiError> {
    let contents = fs::read_to_string(path)
        .map_err(|err| map_io_error(err, "PROJECT_READ_FAILED", "Failed to read project file"))?;
    serde_json::from_str(&contents).map_err(|err| ApiError {
        code: "PROJECT_READ_FAILED".into(),
        message: format!("Invalid project JSON in {} ({})", path.display(), err),
        export_pdf_path: None,
        version_pdf_path: None,
    })
}

fn list_project_json_paths(projects_dir: &Path) -> Result<Vec<PathBuf>, ApiError> {
    let entries = fs::read_dir(projects_dir)
        .map_err(|err| map_io_error(err, "PROJECT_READ_FAILED", "Failed to read projects"))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry
            .map_err(|err| map_io_error(err, "PROJECT_READ_FAILED", "Failed to read projects"))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            files.push(path);
        }
    }
    Ok(files)
}

fn project_slug_filename_candidates(
    slug: &str,
    band_leader_id: Option<&str>,
    project_id: &str,
) -> Vec<String> {
    let slug_name = sanitize_id_to_filename(slug);
    let mut out = vec![format!("{}.json", slug_name)];

    if let Some(band_leader_id) = band_leader_id {
        let trimmed = band_leader_id.trim();
        if !trimmed.is_empty() {
            out.push(format!(
                "{}_{}.json",
                slug_name,
                sanitize_id_to_filename(trimmed)
            ));
        }
    }

    out.push(format!(
        "{}_{}.json",
        slug_name,
        sanitize_id_to_filename(project_id)
    ));
    out
}

fn resolve_project_filename(
    projects_dir: &Path,
    project: &Value,
    current_file: Option<&Path>,
) -> Result<String, ApiError> {
    let project_id = project.get("id").and_then(|v| v.as_str()).ok_or(ApiError {
        code: "PROJECT_SAVE_FAILED".into(),
        message: "Project id is required.".into(),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;
    let slug = project
        .get("slug")
        .and_then(|v| v.as_str())
        .ok_or(ApiError {
            code: "PROJECT_SAVE_FAILED".into(),
            message: "Project slug is required.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;

    let candidates = project_slug_filename_candidates(
        slug,
        project.get("bandLeaderId").and_then(|v| v.as_str()),
        project_id,
    );

    for candidate in &candidates {
        let candidate_path = projects_dir.join(&candidate);
        if let Some(current) = current_file {
            if current.file_name().and_then(|name| name.to_str()) == Some(candidate.as_str()) {
                return Ok(candidate.clone());
            }
        }
        if !candidate_path.exists() {
            return Ok(candidate.clone());
        }
        let parsed = parse_project_json(&candidate_path)?;
        if parsed.get("id").and_then(|v| v.as_str()) == Some(project_id) {
            return Ok(candidate.clone());
        }
    }

    Ok(candidates
        .last()
        .cloned()
        .unwrap_or_else(|| format!("{}.json", sanitize_id_to_filename(project_id))))
}

fn resolve_project_path_by_id(
    app: &tauri::AppHandle,
    project_id: &str,
) -> Result<Option<PathBuf>, ApiError> {
    let projects_dir = storage_projects_dir(app).map_err(|err| {
        map_storage_error(err, "PROJECT_READ_FAILED", "Failed to resolve projects dir")
    })?;

    for path in list_project_json_paths(&projects_dir)? {
        let parsed = match parse_project_json(&path) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if parsed.get("id").and_then(|v| v.as_str()) == Some(project_id) {
            return Ok(Some(path));
        }
    }

    Ok(None)
}

fn catalog_dir(app: &tauri::AppHandle) -> Result<PathBuf, ApiError> {
    storage_catalog_dir(app).map_err(|err| {
        map_storage_error(
            err,
            "LIBRARY_READ_FAILED",
            "Failed to resolve catalog directory",
        )
    })
}

fn catalog_entity_dir(app: &tauri::AppHandle, entity: &str) -> Result<PathBuf, ApiError> {
    Ok(catalog_dir(app)?.join(entity))
}

fn entity_name(file_name: &str) -> &str {
    file_name.strip_suffix(".json").unwrap_or(file_name)
}

fn resolve_musician_display_name(musician: &Value, fallback_id: &str) -> String {
    let first_name = musician
        .get("firstName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let last_name = musician
        .get("lastName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let full_name = format!("{} {}", last_name, first_name).trim().to_string();
    if !full_name.is_empty() {
        return full_name;
    }

    let display_name = musician
        .get("displayName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if !display_name.is_empty() {
        return display_name;
    }

    fallback_id
        .split(['_', '-'])
        .filter(|part| !part.trim().is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

fn load_library_list<T: for<'de> Deserialize<'de>>(
    app: &tauri::AppHandle,
    file_name: &str,
) -> Result<Vec<T>, ApiError> {
    let dir = catalog_entity_dir(app, entity_name(file_name))?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut items: Vec<T> = Vec::new();
    let files = if file_name == "musicians.json" {
        list_json_files_recursive(&dir)?
    } else {
        fs::read_dir(&dir)
            .map_err(|err| map_io_error(err, "LIBRARY_READ_FAILED", "Failed to read catalog"))?
            .filter_map(|entry| entry.ok().map(|e| e.path()))
            .collect()
    };
    for path in files {
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let content = fs::read_to_string(&path)
            .map_err(|err| map_io_error(err, "LIBRARY_READ_FAILED", "Failed to read entity"))?;
        let item = serde_json::from_str::<T>(&content).map_err(|err| ApiError {
            code: "LIBRARY_READ_FAILED".into(),
            message: format!("Invalid JSON in {} ({})", path.display(), err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        items.push(item);
    }
    Ok(items)
}

fn load_library_map<T: for<'de> Deserialize<'de>>(
    app: &tauri::AppHandle,
    file_name: &str,
) -> Result<HashMap<String, T>, ApiError> {
    let dir = catalog_entity_dir(app, entity_name(file_name))?;
    if !dir.exists() {
        return Ok(HashMap::new());
    }
    let mut items: HashMap<String, T> = HashMap::new();
    for entry in fs::read_dir(&dir)
        .map_err(|err| map_io_error(err, "LIBRARY_READ_FAILED", "Failed to read catalog"))?
    {
        let entry = entry
            .map_err(|err| map_io_error(err, "LIBRARY_READ_FAILED", "Failed to read entry"))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let key = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();
        let content = fs::read_to_string(&path)
            .map_err(|err| map_io_error(err, "LIBRARY_READ_FAILED", "Failed to read entity"))?;
        let item = serde_json::from_str::<T>(&content).map_err(|err| ApiError {
            code: "LIBRARY_READ_FAILED".into(),
            message: format!("Invalid JSON in {} ({})", path.display(), err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        items.insert(key, item);
    }
    Ok(items)
}

fn save_library_map<T: Serialize>(
    app: &tauri::AppHandle,
    file_name: &str,
    items: &HashMap<String, T>,
) -> Result<(), ApiError> {
    let dir = catalog_entity_dir(app, entity_name(file_name))?;
    fs::create_dir_all(&dir)
        .map_err(|err| map_io_error(err, "LIBRARY_WRITE_FAILED", "Failed to create catalog"))?;
    for (id, item) in items {
        let path = dir.join(format!("{}.json", sanitize_id_to_filename(id)));
        let json = serde_json::to_vec_pretty(item).map_err(|err| ApiError {
            code: "LIBRARY_WRITE_FAILED".into(),
            message: format!("Failed to serialize {} ({})", id, err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        atomic_write_bytes(&path, &json).map_err(|err| {
            map_storage_error(err, "LIBRARY_WRITE_FAILED", "Failed to save entity")
        })?;
    }
    Ok(())
}

fn save_library_list<T: Serialize>(
    app: &tauri::AppHandle,
    file_name: &str,
    items: &Vec<T>,
) -> Result<(), ApiError> {
    let dir = catalog_entity_dir(app, entity_name(file_name))?;
    fs::create_dir_all(&dir)
        .map_err(|err| map_io_error(err, "LIBRARY_WRITE_FAILED", "Failed to create catalog"))?;
    for item in items {
        let value = serde_json::to_value(item).map_err(|err| ApiError {
            code: "LIBRARY_WRITE_FAILED".into(),
            message: format!("Failed to serialize entity ({})", err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        let Some(id) = value.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let path = if file_name == "musicians.json" {
            let role = value
                .get("defaultRoles")
                .or_else(|| value.get("default_roles"))
                .and_then(|v| v.as_array())
                .and_then(|roles| roles.iter().find_map(|role| role.as_str()))
                .map(|role| role.trim().to_lowercase())
                .ok_or(ApiError {
                    code: "LIBRARY_VALIDATION_FAILED".into(),
                    message: format!("Musician '{}' is missing default role.", id),
                    export_pdf_path: None,
                    version_pdf_path: None,
                })?;
            if !matches!(
                role.as_str(),
                "drums" | "bass" | "guitar" | "keys" | "vocs" | "talkback"
            ) {
                return Err(ApiError {
                    code: "LIBRARY_VALIDATION_FAILED".into(),
                    message: format!("Musician '{}' has invalid role '{}'.", id, role),
                    export_pdf_path: None,
                    version_pdf_path: None,
                });
            }
            let role_dir = dir.join(role);
            fs::create_dir_all(&role_dir).map_err(|err| {
                map_io_error(
                    err,
                    "LIBRARY_WRITE_FAILED",
                    "Failed to create musician role directory",
                )
            })?;
            role_dir.join(format!("{}.json", sanitize_id_to_filename(id)))
        } else {
            dir.join(format!("{}.json", sanitize_id_to_filename(id)))
        };
        let json = serde_json::to_vec_pretty(item).map_err(|err| ApiError {
            code: "LIBRARY_WRITE_FAILED".into(),
            message: format!("Failed to serialize {} ({})", id, err),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
        atomic_write_bytes(&path, &json).map_err(|err| {
            map_storage_error(err, "LIBRARY_WRITE_FAILED", "Failed to save entity")
        })?;
    }
    Ok(())
}

#[tauri::command]
fn get_user_data_dir(app: tauri::AppHandle) -> Result<String, ApiError> {
    let dir = stagepilot_user_data_dir(&app).map_err(|err| {
        map_storage_error(
            err,
            "APP_DATA_DIR_FAILED",
            "Failed to resolve user storage root",
        )
    })?;
    ensure_user_storage(&app).map_err(|err| {
        map_storage_error(
            err,
            "APP_DATA_DIR_FAILED",
            "Failed to initialize user storage",
        )
    })?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, ApiError> {
    let projects_dir = storage_projects_dir(&app).map_err(|err| {
        map_storage_error(err, "PROJECT_LIST_FAILED", "Failed to resolve projects dir")
    })?;

    let mut by_id: HashMap<String, (ProjectSummary, String)> = HashMap::new();
    for path in list_project_json_paths(&projects_dir)? {
        let json = parse_project_json(&path)?;
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
            .or_else(|| {
                json.get("eventDate")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("{}T00:00:00Z", s))
            });

        let summary = ProjectSummary {
            id: id.clone(),
            slug: json
                .get("slug")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
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

        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();

        if let Some((existing, existing_filename)) = by_id.get(&id) {
            let prefer_new = summary.updated_at > existing.updated_at
                || (summary.updated_at == existing.updated_at
                    && summary.slug.is_some()
                    && existing_filename
                        .starts_with(&format!("{}.json", sanitize_id_to_filename(&id))));
            if prefer_new {
                by_id.insert(id, (summary, filename));
            }
        } else {
            by_id.insert(id, (summary, filename));
        }
    }

    let mut results: Vec<ProjectSummary> =
        by_id.into_values().map(|(summary, _)| summary).collect();
    results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(results)
}

#[tauri::command]
fn list_bands(app: tauri::AppHandle) -> Result<Vec<BandOption>, ApiError> {
    let bands_dir = catalog_entity_dir(&app, "bands")?;
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
fn get_band_setup_data(app: tauri::AppHandle, band_id: String) -> Result<BandSetupData, ApiError> {
    let bands_dir = catalog_entity_dir(&app, "bands")?;
    let entries = fs::read_dir(&bands_dir).map_err(|err| ApiError {
        code: "BAND_SETUP_LOAD_FAILED".into(),
        message: format!("Failed to read bands at {} ({})", bands_dir.display(), err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let mut selected: Option<Value> = None;
    let requested = band_id.trim().to_string();
    let requested_lower = requested.to_lowercase();
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

        let candidate_id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let candidate_code = json
            .get("code")
            .and_then(|v| v.as_str())
            .map(|v| v.trim().to_string())
            .unwrap_or_default();

        if candidate_id == requested
            || candidate_code.eq_ignore_ascii_case(&requested)
            || candidate_id.to_lowercase() == requested_lower
        {
            selected = Some(json);
            break;
        }
    }

    let json = selected.ok_or(ApiError {
        code: "BAND_NOT_FOUND".into(),
        message: format!(
            "Band not found for reference '{}' in {} (checked id and code)",
            requested,
            bands_dir.display()
        ),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let members_root = catalog_entity_dir(&app, "musicians")?;
    let mut members: HashMap<String, Vec<MemberOption>> = HashMap::new();
    let mut musicians_by_id: HashMap<String, (String, String)> = HashMap::new();
    let mut musician_defaults: HashMap<String, Value> = HashMap::new();
    let mut musician_presets_by_id: HashMap<String, Vec<Value>> = HashMap::new();
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
                let monitor_ref =
                    musician
                        .get("presets")
                        .and_then(|v| v.as_array())
                        .and_then(|presets| {
                            presets.iter().find_map(|preset| {
                                if preset.get("kind").and_then(|v| v.as_str()) == Some("monitor") {
                                    return preset
                                        .get("ref")
                                        .and_then(|v| v.as_str())
                                        .map(|v| v.to_string());
                                }
                                None
                            })
                        });
                if let Some(reference) = monitor_ref {
                    musician_defaults.insert(
                        id.to_string(),
                        infer_monitoring_default_from_ref(&reference),
                    );
                }
                musician_presets_by_id.insert(
                    id.to_string(),
                    musician
                        .get("presets")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default(),
                );
                let name = resolve_musician_display_name(&musician, id);
                musicians_by_id.insert(id.to_string(), (name.clone(), role.to_string()));
                role_members.push(MemberOption {
                    id: id.to_string(),
                    name,
                });
            }
        }
        role_members.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        members.insert(role.to_string(), role_members);
    }

    if let Some(band_members) = json.get("members").and_then(|v| v.as_array()) {
        let mut restricted: HashMap<String, Vec<MemberOption>> = HashMap::new();
        for role in ["drums", "bass", "guitar", "keys", "vocs", "talkback"] {
            restricted.insert(role.to_string(), Vec::new());
        }
        for member in band_members {
            let musician_id = member
                .get("musicianId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if musician_id.is_empty() {
                continue;
            }
            let Some((name, default_group)) = musicians_by_id.get(musician_id) else {
                continue;
            };
            if let Some(roles) = member.get("roles").and_then(|v| v.as_array()) {
                for role in roles.iter().filter_map(|v| v.as_str()) {
                    if let Some(list) = restricted.get_mut(role) {
                        list.push(MemberOption {
                            id: musician_id.to_string(),
                            name: name.clone(),
                        });
                    }
                }
            } else if let Some(list) = restricted.get_mut(default_group) {
                list.push(MemberOption {
                    id: musician_id.to_string(),
                    name: name.clone(),
                });
            }
        }
        let has_any = restricted.values().any(|v| !v.is_empty());
        if has_any {
            for value in restricted.values_mut() {
                value.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
                value.dedup_by(|a, b| a.id == b.id);
            }
            members = restricted;
        }
    }

    let mut load_warnings: Vec<String> = Vec::new();
    if let Some(default_lineup) = normalize_default_lineup_keys(json.get("defaultLineup").cloned())
    {
        if let Some(obj) = default_lineup.as_object() {
            for (role, value) in obj {
                let ids: Vec<String> = match value {
                    Value::Array(arr) => arr
                        .iter()
                        .filter_map(|item| item.as_str().map(|s| s.to_string()))
                        .collect(),
                    _ => Vec::new(),
                };
                for musician_id in ids {
                    if !musicians_by_id.contains_key(&musician_id) {
                        load_warnings.push(format!(
                            "Band '{}' defaultLineup role '{}' references missing musician '{}'",
                            requested, role, musician_id
                        ));
                    }
                }
            }
        }
    } else if json.get("defaultLineup").is_some() {
        load_warnings.push(format!(
            "Band '{}' has non-canonical defaultLineup (arrays only, no legacy lead_voc/lead_vocs/back_vocs).",
            requested
        ));
    }

    let mut preset_catalog: HashMap<String, Value> = HashMap::new();
    let workspace_root = resolve_workspace_root();
    for preset_dir in [
        workspace_root.join("data/assets/presets/groups"),
        workspace_root.join("data/assets/presets/monitors"),
    ] {
        if !preset_dir.exists() {
            continue;
        }
        for entry in list_json_files_recursive(&preset_dir)? {
            let content = fs::read_to_string(&entry).map_err(|err| {
                map_io_error(err, "BAND_SETUP_LOAD_FAILED", "Failed to read preset file")
            })?;
            let preset: Value = serde_json::from_str(&content).map_err(|err| ApiError {
                code: "BAND_SETUP_LOAD_FAILED".into(),
                message: format!("Invalid preset JSON in {} ({})", entry.display(), err),
                export_pdf_path: None,
                version_pdf_path: None,
            })?;
            if let Some(id) = preset.get("id").and_then(|v| v.as_str()) {
                preset_catalog.insert(id.to_string(), preset);
            }
        }
    }

    let musician_default_overrides =
        load_library_map::<Value>(&app, "musician_defaults.json").unwrap_or_default();
    for (key, value) in musician_default_overrides {
        musician_defaults.insert(key, value);
    }

    let default_overlays = normalize_default_overlays(
        json.get("defaultOverlays").cloned(),
        &requested,
        &mut load_warnings,
    );

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
            .or_else(|| json.get("bandLeaderId").and_then(|v| v.as_str()))
            .map(|v| v.to_string()),
        band_leader_id: json
            .get("bandLeaderId")
            .and_then(|v| v.as_str())
            .or_else(|| json.get("bandLeader").and_then(|v| v.as_str()))
            .map(|v| v.to_string()),
        default_talkback_owner_id: json
            .get("defaultTalkbackOwnerId")
            .and_then(|v| v.as_str())
            .or_else(|| {
                json.get("bandLeaderId")
                    .and_then(|v| v.as_str())
                    .or_else(|| json.get("bandLeader").and_then(|v| v.as_str()))
            })
            .map(|v| v.to_string()),
        default_contact_id: json
            .get("defaultContactId")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        default_lineup: normalize_default_lineup_keys(json.get("defaultLineup").cloned()),
        default_overlays,
        members,
        musician_defaults,
        musician_presets_by_id,
        preset_catalog,
        load_warnings,
    })
}

#[tauri::command]
fn read_project(app: tauri::AppHandle, project_id: String) -> Result<String, ApiError> {
    let project_path = resolve_project_path_by_id(&app, &project_id)?.ok_or(ApiError {
        code: "PROJECT_READ_FAILED".into(),
        message: format!("Project not found: {}", project_id),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;
    eprintln!(
        "[project] read path={} exists={}",
        project_path.display(),
        project_path.exists()
    );
    fs::read_to_string(&project_path)
        .map_err(|err| map_io_error(err, "PROJECT_READ_FAILED", "Failed to read project"))
}

#[tauri::command]
fn save_project(
    app: tauri::AppHandle,
    project_id: String,
    json: String,
    legacy_project_id: Option<String>,
) -> Result<(), ApiError> {
    let projects_dir = storage_projects_dir(&app).map_err(|err| {
        map_storage_error(err, "PROJECT_SAVE_FAILED", "Failed to resolve projects dir")
    })?;
    let parsed: Value = serde_json::from_str(&json).map_err(|err| ApiError {
        code: "PROJECT_SAVE_FAILED".into(),
        message: format!("Invalid project JSON payload ({})", err),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    let current_path = resolve_project_path_by_id(&app, &project_id)?;
    let target_filename =
        resolve_project_filename(&projects_dir, &parsed, current_path.as_deref())?;
    let target_path = projects_dir.join(target_filename);

    atomic_write_bytes(&target_path, json.as_bytes())
        .map_err(|err| map_storage_error(err, "PROJECT_SAVE_FAILED", "Failed to save project"))?;

    if let Some(existing_path) = current_path {
        if existing_path != target_path && existing_path.exists() {
            let _ = fs::remove_file(existing_path);
        }
    }

    if let Some(legacy_id) = legacy_project_id {
        if legacy_id != project_id {
            if let Some(legacy_path) = resolve_project_path_by_id(&app, &legacy_id)? {
                if legacy_path != target_path && legacy_path.exists() {
                    let _ = fs::remove_file(legacy_path);
                }
            }
        }
    }

    Ok(())
}

fn remove_export_artifacts(app: &tauri::AppHandle, project_path: &Path, project_id: &str) {
    let versions_root = match storage_versions_dir(app) {
        Ok(path) => path,
        Err(_) => return,
    };
    let versions_dir = versions_root.join(sanitize_id_to_filename(project_id));
    if versions_dir.exists() {
        let _ = fs::remove_dir_all(versions_dir);
    }

    if let Ok(contents) = fs::read_to_string(project_path) {
        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
            if let Some(slug) = json.get("slug").and_then(|v| v.as_str()) {
                let exports_dir = match exports_dir(app) {
                    Ok(path) => path,
                    Err(_) => return,
                };
                if exports_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&exports_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.extension().and_then(|v| v.to_str()) != Some("pdf") {
                                continue;
                            }
                            if let Some(file_name) = path.file_name().and_then(|v| v.to_str()) {
                                if file_name == format!("{}.pdf", slug)
                                    || (file_name.starts_with(&format!("{}__", slug))
                                        && file_name.ends_with(".pdf"))
                                {
                                    let _ = fs::remove_file(path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn delete_project_permanently(app: tauri::AppHandle, project_id: String) -> Result<(), ApiError> {
    let project_path = resolve_project_path_by_id(&app, &project_id)?.ok_or(ApiError {
        code: "PROJECT_DELETE_FAILED".into(),
        message: format!("Project not found: {}", project_id),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    remove_export_artifacts(&app, &project_path, &project_id);

    fs::remove_file(&project_path)
        .map_err(|err| map_io_error(err, "PROJECT_DELETE_FAILED", "Failed to delete project"))?;

    Ok(())
}

#[tauri::command]
fn delete_project(app: tauri::AppHandle, project_id: String) -> Result<(), ApiError> {
    delete_project_permanently(app, project_id)
}

#[tauri::command]
fn export_pdf(
    app: tauri::AppHandle,
    project_id: String,
    hide_musician_names: Option<bool>,
) -> Result<ExportPdfResult, ApiError> {
    let user_data_dir = stagepilot_user_data_dir(&app).map_err(|err| {
        map_storage_error(err, "EXPORT_FAILED", "Failed to resolve user storage root")
    })?;
    ensure_user_storage(&app).map_err(|err| {
        map_storage_error(err, "EXPORT_FAILED", "Failed to initialize user storage")
    })?;
    let project_path = resolve_project_path_by_id(&app, &project_id)?.ok_or(ApiError {
        code: "PROJECT_NOT_FOUND".into(),
        message: format!("Project file not found for id: {}", project_id),
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    if !project_path.exists() {
        return Err(ApiError {
            code: "PROJECT_NOT_FOUND".into(),
            message: format!("Project file not found: {}", project_path.display()),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }

    let workspace_root = resolve_workspace_root();
    let script_path = workspace_root.join("scripts").join("desktop_export.ts");

    let mut command = Command::new("node");
    command
        .arg("--import")
        .arg("tsx")
        .arg(script_path.as_os_str())
        .arg("--project-id")
        .arg(&project_id)
        .arg("--user-data-dir")
        .arg(user_data_dir.as_os_str());
    if hide_musician_names.unwrap_or(false) {
        command.arg("--hide-musician-names");
    }

    let output = command
        .current_dir(&workspace_root)
        .output()
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to execute export"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(ApiError {
            code: "EXPORT_COMMAND_FAILED".into(),
            message: format!(
                "Export command failed with status {} (stderr: {})",
                output.status, stderr
            ),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }

    let response = parse_node_export_response(&stdout, &stderr)?;

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
    hide_musician_names: Option<bool>,
) -> Result<PreviewPdfPathResult, ApiError> {
    let user_data_dir = stagepilot_user_data_dir(&app).map_err(|err| {
        map_storage_error(err, "PREVIEW_FAILED", "Failed to resolve user storage root")
    })?;
    ensure_user_storage(&app).map_err(|err| {
        map_storage_error(err, "PREVIEW_FAILED", "Failed to initialize user storage")
    })?;
    let workspace_root = resolve_workspace_root();
    let script_path = workspace_root.join("scripts").join("desktop_preview.ts");
    eprintln!(
        "[preview] command start project_id={} cwd={} script={}",
        project_id,
        workspace_root.display(),
        script_path.display()
    );

    let mut command = Command::new("node");
    command
        .arg("--import")
        .arg("tsx")
        .arg(script_path.as_os_str())
        .arg("--project-id")
        .arg(&project_id)
        .arg("--user-data-dir")
        .arg(user_data_dir.as_os_str());
    if hide_musician_names.unwrap_or(false) {
        command.arg("--hide-musician-names");
    }

    let output = command
        .current_dir(&workspace_root)
        .output()
        .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to execute preview"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    eprintln!(
        "[preview] node exit status={} stdout={} stderr={}",
        output.status, stdout, stderr
    );

    let response = parse_node_export_response(&stdout, &stderr).map_err(|err| ApiError {
        code: "PREVIEW_FAILED".into(),
        message: err.message,
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
            eprintln!("[preview] write success path={}", preview_pdf_path);
            return Ok(PreviewPdfPathResult { preview_pdf_path });
        }
    }

    eprintln!(
        "[preview] command failed project_id={} code={} message={}",
        project_id,
        response
            .code
            .clone()
            .unwrap_or_else(|| "PREVIEW_FAILED".into()),
        response
            .message
            .clone()
            .unwrap_or_else(|| "Preview failed.".into())
    );

    Err(ApiError {
        code: response.code.unwrap_or_else(|| "PREVIEW_FAILED".into()),
        message: "Preview could not be generated. Please retry. Check desktop logs for Chromium diagnostics.".into(),
        export_pdf_path: response.export_pdf_path,
        version_pdf_path: response.version_pdf_path,
    })
}

#[tauri::command]
fn read_preview_pdf_bytes(preview_pdf_path: String) -> Result<Vec<u8>, ApiError> {
    eprintln!("[preview] read attempt path={}", preview_pdf_path);
    eprintln!(
        "[preview] exists={} path={}",
        Path::new(&preview_pdf_path).exists(),
        preview_pdf_path
    );
    fs::read(&preview_pdf_path)
        .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to read preview PDF bytes"))
}

#[tauri::command]
fn cleanup_preview_pdf(app: tauri::AppHandle, preview_key: String) -> Result<(), ApiError> {
    let temp_dir = storage_temp_dir(&app)
        .map_err(|err| map_storage_error(err, "PREVIEW_FAILED", "Failed to resolve temp dir"))?;
    let preview_path = temp_dir.join(format!(
        "preview_{}.pdf",
        sanitize_id_to_filename(&preview_key)
    ));
    if preview_path.exists() {
        fs::remove_file(&preview_path)
            .map_err(|err| map_io_error(err, "PREVIEW_FAILED", "Failed to remove preview PDF"))?;
    }
    Ok(())
}

#[tauri::command]
fn get_exports_dir(app: tauri::AppHandle) -> Result<String, ApiError> {
    let out_dir = exports_dir(&app)
        .map_err(|err| map_storage_error(err, "EXPORT_FAILED", "Failed to resolve exports dir"))?;
    Ok(out_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn default_export_pdf_path(
    app: tauri::AppHandle,
    project_slug: String,
) -> Result<String, ApiError> {
    let out_dir = exports_dir(&app)
        .map_err(|err| map_storage_error(err, "EXPORT_FAILED", "Failed to resolve exports dir"))?;
    Ok(out_dir
        .join(format!("{}.pdf", sanitize_id_to_filename(&project_slug)))
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
fn export_pdf_to_path(
    app: tauri::AppHandle,
    project_id: String,
    output_path: String,
    hide_musician_names: Option<bool>,
) -> Result<(), ApiError> {
    let result = export_pdf(app, project_id, hide_musician_names)?;
    let bytes = fs::read(&result.export_pdf_path)
        .map_err(|err| map_io_error(err, "EXPORT_FAILED", "Failed to read generated PDF"))?;

    let output = PathBuf::from(&output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            map_io_error(err, "EXPORT_FAILED", "Failed to prepare export directory")
        })?;
    }

    let temp_name = format!(
        "{}.tmp",
        output
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("export.pdf")
    );
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
fn pick_export_pdf_path(
    app: tauri::AppHandle,
    default_file_name: String,
) -> Result<Option<String>, ApiError> {
    let default_dir = exports_dir(&app).map_err(|err| {
        map_storage_error(err, "EXPORT_DIALOG_FAILED", "Failed to resolve exports dir")
    })?;

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
fn list_library_bands(app: tauri::AppHandle) -> Result<Vec<LibraryBand>, ApiError> {
    let mut items = load_library_list::<LibraryBand>(&app, "bands.json")?;
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
fn read_library_band(app: tauri::AppHandle, band_id: String) -> Result<LibraryBand, ApiError> {
    let items = load_library_list::<LibraryBand>(&app, "bands.json")?;
    items
        .into_iter()
        .find(|item| item.id == band_id)
        .ok_or(ApiError {
            code: "LIBRARY_NOT_FOUND".into(),
            message: format!("Band not found: {}", band_id),
            export_pdf_path: None,
            version_pdf_path: None,
        })
}

#[tauri::command]
fn upsert_library_band(app: tauri::AppHandle, band: LibraryBand) -> Result<(), ApiError> {
    if band.name.trim().is_empty() || band.code.trim().is_empty() || band.id.trim().is_empty() {
        return Err(ApiError {
            code: "LIBRARY_VALIDATION_FAILED".into(),
            message: "Band id, name, and code are required.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    let mut items = load_library_list::<LibraryBand>(&app, "bands.json")?;
    if items
        .iter()
        .any(|existing| existing.id != band.id && existing.code.eq_ignore_ascii_case(&band.code))
    {
        return Err(ApiError {
            code: "LIBRARY_VALIDATION_FAILED".into(),
            message: format!("Band code '{}' is already used.", band.code),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    if let Some(existing) = items.iter_mut().find(|existing| existing.id == band.id) {
        *existing = band;
    } else {
        items.push(band);
    }
    save_library_list(&app, "bands.json", &items)
}

#[tauri::command]
fn delete_library_band(app: tauri::AppHandle, band_id: String) -> Result<(), ApiError> {
    let projects = list_projects(app.clone())?;
    if projects
        .iter()
        .any(|project| project.band_ref.as_deref() == Some(band_id.as_str()))
    {
        return Err(ApiError {
            code: "LIBRARY_DELETE_BLOCKED".into(),
            message: "Band is referenced by existing projects and cannot be deleted.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    let mut items = load_library_list::<LibraryBand>(&app, "bands.json")?;
    items.retain(|item| item.id != band_id);
    save_library_list(&app, "bands.json", &items)
}

#[tauri::command]
fn duplicate_library_band(app: tauri::AppHandle, band_id: String) -> Result<LibraryBand, ApiError> {
    let mut items = load_library_list::<LibraryBand>(&app, "bands.json")?;
    let existing = items
        .iter()
        .find(|item| item.id == band_id)
        .cloned()
        .ok_or(ApiError {
            code: "LIBRARY_NOT_FOUND".into(),
            message: format!("Band not found: {}", band_id),
            export_pdf_path: None,
            version_pdf_path: None,
        })?;
    let mut candidate_id = format!("{}_copy", existing.id);
    let mut index: usize = 2;
    while items.iter().any(|item| item.id == candidate_id) {
        candidate_id = format!("{}_copy_{}", existing.id, index);
        index += 1;
    }
    let mut duplicate = existing.clone();
    duplicate.id = candidate_id;
    duplicate.name = format!("{} Copy", existing.name);
    duplicate.code = format!("{}-COPY{}", existing.code, index.saturating_sub(1));
    items.push(duplicate.clone());
    save_library_list(&app, "bands.json", &items)?;
    Ok(duplicate)
}

#[tauri::command]
fn list_library_musicians(app: tauri::AppHandle) -> Result<Vec<LibraryMusician>, ApiError> {
    let mut items = load_library_list::<LibraryMusician>(&app, "musicians.json")?;
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
fn upsert_library_musician(
    app: tauri::AppHandle,
    musician: LibraryMusician,
) -> Result<(), ApiError> {
    if musician.id.trim().is_empty() || musician.name.trim().is_empty() {
        return Err(ApiError {
            code: "LIBRARY_VALIDATION_FAILED".into(),
            message: "Musician id and name are required.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    if musician.default_roles.is_empty() {
        return Err(ApiError {
            code: "LIBRARY_VALIDATION_FAILED".into(),
            message: "Musician must define at least one default role.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    let mut items = load_library_list::<LibraryMusician>(&app, "musicians.json")?;
    if let Some(existing) = items.iter_mut().find(|item| item.id == musician.id) {
        *existing = musician;
    } else {
        items.push(musician);
    }
    save_library_list(&app, "musicians.json", &items)
}

#[tauri::command]
fn update_musician_defaults(
    app: tauri::AppHandle,
    musician_id: String,
    role: String,
    setup: Value,
) -> Result<(), ApiError> {
    if musician_id.trim().is_empty() {
        return Err(ApiError {
            code: "LIBRARY_VALIDATION_FAILED".into(),
            message: "Musician id is required.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    let normalized_role = role.trim().to_lowercase();
    let key = format!("{}:{}", musician_id.trim(), normalized_role);
    let mut defaults = load_library_map::<Value>(&app, "musician_defaults.json")?;
    defaults.insert(key, setup);
    save_library_map(&app, "musician_defaults.json", &defaults)
}

#[tauri::command]
fn delete_library_musician(app: tauri::AppHandle, musician_id: String) -> Result<(), ApiError> {
    let bands = load_library_list::<LibraryBand>(&app, "bands.json")?;
    if bands.iter().any(|band| {
        band.members
            .iter()
            .any(|member| member.musician_id == musician_id)
    }) {
        return Err(ApiError {
            code: "LIBRARY_DELETE_BLOCKED".into(),
            message: "Musician is referenced by a band and cannot be deleted.".into(),
            export_pdf_path: None,
            version_pdf_path: None,
        });
    }
    let mut items = load_library_list::<LibraryMusician>(&app, "musicians.json")?;
    items.retain(|item| item.id != musician_id);
    save_library_list(&app, "musicians.json", &items)
}

#[tauri::command]
fn list_library_instruments(app: tauri::AppHandle) -> Result<Vec<LibraryInstrument>, ApiError> {
    load_library_list::<LibraryInstrument>(&app, "instruments.json")
}
#[tauri::command]
fn upsert_library_instrument(
    app: tauri::AppHandle,
    instrument: LibraryInstrument,
) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryInstrument>(&app, "instruments.json")?;
    if let Some(existing) = items.iter_mut().find(|item| item.id == instrument.id) {
        *existing = instrument;
    } else {
        items.push(instrument);
    }
    save_library_list(&app, "instruments.json", &items)
}
#[tauri::command]
fn delete_library_instrument(app: tauri::AppHandle, instrument_id: String) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryInstrument>(&app, "instruments.json")?;
    items.retain(|item| item.id != instrument_id);
    save_library_list(&app, "instruments.json", &items)
}

#[tauri::command]
fn list_library_contacts(app: tauri::AppHandle) -> Result<Vec<LibraryContact>, ApiError> {
    load_library_list::<LibraryContact>(&app, "contacts.json")
}
#[tauri::command]
fn upsert_library_contact(app: tauri::AppHandle, contact: LibraryContact) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryContact>(&app, "contacts.json")?;
    if let Some(existing) = items.iter_mut().find(|item| item.id == contact.id) {
        *existing = contact;
    } else {
        items.push(contact);
    }
    save_library_list(&app, "contacts.json", &items)
}
#[tauri::command]
fn delete_library_contact(app: tauri::AppHandle, contact_id: String) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryContact>(&app, "contacts.json")?;
    items.retain(|item| item.id != contact_id);
    save_library_list(&app, "contacts.json", &items)
}

#[tauri::command]
fn list_library_messages(app: tauri::AppHandle) -> Result<Vec<LibraryMessage>, ApiError> {
    load_library_list::<LibraryMessage>(&app, "messages.json")
}
#[tauri::command]
fn upsert_library_message(
    app: tauri::AppHandle,
    message_item: LibraryMessage,
) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryMessage>(&app, "messages.json")?;
    if let Some(existing) = items.iter_mut().find(|item| item.id == message_item.id) {
        *existing = message_item;
    } else {
        items.push(message_item);
    }
    save_library_list(&app, "messages.json", &items)
}
#[tauri::command]
fn delete_library_message(app: tauri::AppHandle, message_id: String) -> Result<(), ApiError> {
    let mut items = load_library_list::<LibraryMessage>(&app, "messages.json")?;
    items.retain(|item| item.id != message_id);
    save_library_list(&app, "messages.json", &items)
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
        .setup(|app| {
            maybe_wipe_storage_for_dev(&app.handle()).map_err(|err| {
                tauri::Error::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to apply dev storage wipe: {:?}", err),
                ))
            })?;
            ensure_user_storage(&app.handle()).map_err(|err| {
                tauri::Error::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize user storage: {:?}", err),
                ))
            })?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_user_data_dir,
            list_projects,
            list_bands,
            get_band_setup_data,
            read_project,
            save_project,
            delete_project,
            delete_project_permanently,
            export_pdf,
            build_project_pdf_preview,
            read_preview_pdf_bytes,
            cleanup_preview_pdf,
            get_exports_dir,
            default_export_pdf_path,
            export_pdf_to_path,
            pick_export_pdf_path,
            open_file,
            reveal_in_explorer,
            list_library_bands,
            read_library_band,
            upsert_library_band,
            delete_library_band,
            duplicate_library_band,
            list_library_musicians,
            upsert_library_musician,
            update_musician_defaults,
            delete_library_musician,
            list_library_instruments,
            upsert_library_instrument,
            delete_library_instrument,
            list_library_contacts,
            upsert_library_contact,
            delete_library_contact,
            list_library_messages,
            upsert_library_message,
            delete_library_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::parse_node_export_response;

    #[test]
    fn parses_clean_success_response() {
        let stdout = r#"{"ok":true,"result":{"versionPdfPath":"a","exportPdfPath":"b","exportUpdated":true,"versionId":"1","versionPath":"c"}}"#;
        let parsed = parse_node_export_response(stdout, "").expect("should parse");
        assert!(parsed.ok);
        assert!(parsed.result.is_some());
    }

    #[test]
    fn rejects_prefixed_stdout_as_contract_error() {
        let stdout = r#"project=abc slug=my-doc
{"ok":true,"result":{}}"#;
        let err = parse_node_export_response(stdout, "").expect_err("should fail");
        assert_eq!(err.code, "EXPORT_RESPONSE_INVALID");
    }
}
