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
    musicians: HashMap<String, Value>,
    musician_defaults: HashMap<String, Value>,
    musician_presets_by_id: HashMap<String, Vec<Value>>,
    preset_catalog: HashMap<String, Value>,
    notes_template_ref: Option<String>,
    notes_template: Option<Value>,
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

fn api_error(code: &str, message: String) -> ApiError {
    ApiError {
        code: code.into(),
        message,
        export_pdf_path: None,
        version_pdf_path: None,
    }
}

/// Recursively lists `*.json` files below `root`, sorted so callers see a
/// stable order. Mapping the I/O error to an `ApiError` is the caller's job,
/// because each command reports under its own code.
fn collect_json_files(root: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            files.extend(collect_json_files(&path)?);
        } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

fn read_json_file(path: &Path, code: &str) -> Result<Value, ApiError> {
    let content = fs::read_to_string(path)
        .map_err(|err| api_error(code, format!("Failed to read {} ({})", path.display(), err)))?;
    serde_json::from_str(&content)
        .map_err(|err| api_error(code, format!("Invalid JSON in {} ({})", path.display(), err)))
}

/// Every musician file under `catalog/musicians/<role>/`. One broken file
/// fails the whole list with its path: the band form must not offer a
/// partial catalog (spec R13).
fn list_catalog_musicians_at(musicians_dir: &Path) -> Result<Vec<Value>, ApiError> {
    if !musicians_dir.exists() {
        return Ok(Vec::new());
    }
    let files = collect_json_files(musicians_dir).map_err(|err| {
        api_error(
            "MUSICIAN_LIST_FAILED",
            format!("Failed to list musicians in {} ({})", musicians_dir.display(), err),
        )
    })?;
    files
        .iter()
        .map(|path| read_json_file(path, "MUSICIAN_LIST_FAILED"))
        .collect()
}

/// Bundled group and monitor presets. Shared by `get_band_setup_data` and
/// `list_presets` so both read the catalog the same way (spec R10); `code`
/// keeps each command's own error code.
fn load_preset_catalog_at(workspace_root: &Path, code: &str) -> Result<Vec<Value>, ApiError> {
    let mut presets = Vec::new();
    for preset_dir in [
        workspace_root.join("data/assets/presets/groups"),
        workspace_root.join("data/assets/presets/monitors"),
    ] {
        if !preset_dir.exists() {
            continue;
        }
        let files = collect_json_files(&preset_dir).map_err(|err| {
            api_error(
                code,
                format!("Failed to list presets in {} ({})", preset_dir.display(), err),
            )
        })?;
        for path in files {
            presets.push(read_json_file(&path, code)?);
        }
    }
    Ok(presets)
}

/// A catalog id must already be a safe file name: the domain derives it, Rust
/// only refuses to "fix" it, because a silently changed id would point
/// `bandRef` or `defaultContactId` at a file that does not exist.
fn ensure_safe_entity_id(id: &str, code: &str) -> Result<(), ApiError> {
    if id.is_empty() || sanitize_id_to_filename(id) != id {
        return Err(api_error(code, format!("'{}' is not a safe catalog id.", id)));
    }
    Ok(())
}

/// Parses `json` only to check that it is JSON and names `id`. The caller
/// writes the original text, so the key order chosen by the domain survives.
fn ensure_json_matches_id(id: &str, json: &str, code: &str) -> Result<(), ApiError> {
    let value: Value = serde_json::from_str(json)
        .map_err(|err| api_error(code, format!("JSON for '{}' is not valid ({})", id, err)))?;
    match value.get("id").and_then(|v| v.as_str()) {
        Some(json_id) if json_id == id => Ok(()),
        other => Err(api_error(
            code,
            format!("JSON id {:?} does not match '{}'.", other, id),
        )),
    }
}

fn read_catalog_entity_at(dir: &Path, id: &str, code: &str) -> Result<Option<Value>, ApiError> {
    ensure_safe_entity_id(id, code)?;
    let path = dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    read_json_file(&path, code).map(Some)
}

fn write_catalog_json(dir: &Path, path: &Path, json: &str, code: &str) -> Result<(), ApiError> {
    fs::create_dir_all(dir)
        .map_err(|err| map_io_error(err, code, "Failed to create catalog directory"))?;
    atomic_write_bytes(path, json.as_bytes())
        .map_err(|err| map_storage_error(err, code, "Failed to write catalog file"))
}

fn write_band_at(bands_dir: &Path, band_id: &str, json: &str, expect_new: bool) -> Result<(), ApiError> {
    ensure_safe_entity_id(band_id, "BAND_WRITE_FAILED")?;
    ensure_json_matches_id(band_id, json, "BAND_WRITE_FAILED")?;
    let path = bands_dir.join(format!("{}.json", band_id));
    if expect_new && path.exists() {
        return Err(api_error(
            "BAND_EXISTS",
            format!("A band already exists at {}.", path.display()),
        ));
    }
    write_catalog_json(bands_dir, &path, json, "BAND_WRITE_FAILED")
}

fn write_contact_at(contacts_dir: &Path, contact_id: &str, json: &str) -> Result<(), ApiError> {
    ensure_safe_entity_id(contact_id, "CONTACT_WRITE_FAILED")?;
    ensure_json_matches_id(contact_id, json, "CONTACT_WRITE_FAILED")?;
    let path = contacts_dir.join(format!("{}.json", contact_id));
    write_catalog_json(contacts_dir, &path, json, "CONTACT_WRITE_FAILED")
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

/// Mirrors `buildDocument.ts`'s `band.notesTemplateRef ?? "notes_default_cs"` —
/// the id the pipeline actually resolves to when a band has no override.
const DEFAULT_NOTES_TEMPLATE_ID: &str = "notes_default_cs";

/// Looks up a notes template by id in the `templates/notes` catalog folder.
/// Mirrors how bands/musicians are matched (scan + compare `id`), so a
/// template's filename need not match its id. Any I/O or parse problem is
/// reported as `Ok(None)` — a missing/broken notes template must never fail
/// the whole command; the caller turns that into a `load_warnings` entry.
fn load_notes_template(app: &tauri::AppHandle, reference: &str) -> Result<Option<Value>, ApiError> {
    let templates_dir = catalog_entity_dir(app, "templates")?.join("notes");
    if !templates_dir.exists() {
        return Ok(None);
    }
    let Ok(entries) = fs::read_dir(&templates_dir) else {
        return Ok(None);
    };
    for entry in entries {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(template) = serde_json::from_str::<Value>(&contents) else {
            continue;
        };
        if template.get("id").and_then(|v| v.as_str()) == Some(reference) {
            return Ok(Some(template));
        }
    }
    Ok(None)
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
    let mut musicians: HashMap<String, Value> = HashMap::new();
    let mut musicians_by_id: HashMap<String, (String, String)> = HashMap::new();
    let mut musician_defaults: HashMap<String, Value> = HashMap::new();
    let mut musician_presets_by_id: HashMap<String, Vec<Value>> = HashMap::new();
    let mut load_warnings: Vec<String> = Vec::new();
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
                let contents = match fs::read_to_string(&role_path) {
                    Ok(contents) => contents,
                    Err(err) => {
                        load_warnings.push(format!(
                            "Failed to read musician file {} ({})",
                            role_path.display(),
                            err
                        ));
                        continue;
                    }
                };
                let musician: Value = match serde_json::from_str(&contents) {
                    Ok(value) => value,
                    Err(err) => {
                        load_warnings.push(format!(
                            "Invalid musician JSON in {} ({})",
                            role_path.display(),
                            err
                        ));
                        continue;
                    }
                };
                let id = musician.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if id.is_empty() {
                    continue;
                }
                musicians.insert(id.to_string(), musician.clone());
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

    // Presets exposed to setup UI are built-in application assets. Runtime
    // AppData catalog storage remains limited to user entities and notes.
    let mut preset_catalog: HashMap<String, Value> = HashMap::new();
    for preset in load_preset_catalog_at(&resolve_workspace_root(), "BAND_SETUP_LOAD_FAILED")? {
        let Some(id) = preset.get("id").and_then(|v| v.as_str()).map(str::to_string) else {
            continue;
        };
        preset_catalog.insert(id, preset);
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

    // Same fallback the pipeline itself applies (buildDocument.ts:625): a band
    // without an explicit override still resolves to the default template, so
    // the payload must serve that effective id, not the band's raw null.
    let notes_template_reference = json
        .get("notesTemplateRef")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_NOTES_TEMPLATE_ID.to_string());
    let (notes_template_ref, notes_template) =
        match load_notes_template(&app, &notes_template_reference)? {
            Some(template) => (Some(notes_template_reference.clone()), Some(template)),
            None => {
                load_warnings.push(format!(
                    "Band '{}' notesTemplateRef '{}' not found in templates/notes catalog",
                    requested, notes_template_reference
                ));
                (None, None)
            }
        };

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
        musicians,
        musician_defaults,
        musician_presets_by_id,
        preset_catalog,
        notes_template_ref,
        notes_template,
        load_warnings,
    })
}

#[tauri::command]
fn list_catalog_musicians(app: tauri::AppHandle) -> Result<Vec<Value>, ApiError> {
    list_catalog_musicians_at(&catalog_entity_dir(&app, "musicians")?)
}

#[tauri::command]
fn list_presets() -> Result<Vec<Value>, ApiError> {
    load_preset_catalog_at(&resolve_workspace_root(), "PRESET_LIST_FAILED")
}

#[tauri::command]
fn read_band(app: tauri::AppHandle, band_id: String) -> Result<Option<Value>, ApiError> {
    read_catalog_entity_at(&catalog_entity_dir(&app, "bands")?, &band_id, "BAND_READ_FAILED")
}

#[tauri::command]
fn read_contact(app: tauri::AppHandle, contact_id: String) -> Result<Option<Value>, ApiError> {
    read_catalog_entity_at(
        &catalog_entity_dir(&app, "contacts")?,
        &contact_id,
        "CONTACT_READ_FAILED",
    )
}

#[tauri::command]
fn write_band(
    app: tauri::AppHandle,
    band_id: String,
    json: String,
    expect_new: bool,
) -> Result<(), ApiError> {
    write_band_at(&catalog_entity_dir(&app, "bands")?, &band_id, &json, expect_new)
}

#[tauri::command]
fn write_contact(app: tauri::AppHandle, contact_id: String, json: String) -> Result<(), ApiError> {
    write_contact_at(&catalog_entity_dir(&app, "contacts")?, &contact_id, &json)
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
fn build_stageplan_print_metrics(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Value, ApiError> {
    let user_data_dir = stagepilot_user_data_dir(&app).map_err(|err| {
        map_storage_error(
            err,
            "STAGEPLAN_METRICS_FAILED",
            "Failed to resolve user storage root",
        )
    })?;
    let workspace_root = resolve_workspace_root();
    let script_path = workspace_root
        .join("scripts")
        .join("stageplan_print_metrics.ts");
    eprintln!(
        "[stageplan-metrics] command start project_id={} cwd={} script={}",
        project_id,
        workspace_root.display(),
        script_path.display()
    );

    let output = Command::new("node")
        .arg("--import")
        .arg("tsx")
        .arg(script_path.as_os_str())
        .arg("--project-id")
        .arg(&project_id)
        .arg("--user-data-dir")
        .arg(user_data_dir.as_os_str())
        .current_dir(&workspace_root)
        .output()
        .map_err(|err| {
            map_io_error(
                err,
                "STAGEPLAN_METRICS_FAILED",
                "Failed to execute stageplan metrics",
            )
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    eprintln!(
        "[stageplan-metrics] node exit status={} stdout={} stderr={}",
        output.status, stdout, stderr
    );

    let response = parse_node_export_response(&stdout, &stderr).map_err(|err| ApiError {
        code: "STAGEPLAN_METRICS_FAILED".into(),
        message: err.message,
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    if response.ok {
        if let Some(result) = response.result {
            eprintln!(
                "[stageplan-metrics] write success project_id={}",
                project_id
            );
            return Ok(result);
        }
    }

    eprintln!(
        "[stageplan-metrics] command failed project_id={} code={} message={}",
        project_id,
        response
            .code
            .clone()
            .unwrap_or_else(|| "STAGEPLAN_METRICS_FAILED".into()),
        response
            .message
            .clone()
            .unwrap_or_else(|| "Stageplan metrics command failed.".into())
    );

    Err(ApiError {
        code: response
            .code
            .unwrap_or_else(|| "STAGEPLAN_METRICS_FAILED".into()),
        message: "Stageplan metrics could not be generated. Please retry. Check desktop logs for details.".into(),
        export_pdf_path: None,
        version_pdf_path: None,
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
            list_catalog_musicians,
            list_presets,
            read_band,
            read_contact,
            write_band,
            write_contact,
            read_project,
            save_project,
            delete_project,
            delete_project_permanently,
            export_pdf,
            build_project_pdf_preview,
            build_stageplan_print_metrics,
            read_preview_pdf_bytes,
            cleanup_preview_pdf,
            get_exports_dir,
            default_export_pdf_path,
            export_pdf_to_path,
            pick_export_pdf_path,
            open_file,
            reveal_in_explorer,
            update_musician_defaults
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        list_catalog_musicians_at, load_preset_catalog_at, parse_node_export_response,
        read_catalog_entity_at, resolve_workspace_root, write_band_at, write_contact_at,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_test_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("stagepilot-lib-tests-{name}-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    const BNB_JSON: &str = "{\n  \"type\": \"band\",\n  \"id\": \"big_night_band\",\n  \"name\": \"Big Night Band\",\n  \"code\": \"BNB\"\n}\n";

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

    #[test]
    fn write_band_writes_the_given_text_to_a_file_named_after_the_id() {
        let dir = temp_test_dir("write-band");
        write_band_at(&dir, "big_night_band", BNB_JSON, true).expect("write");
        let path = dir.join("big_night_band.json");
        assert_eq!(fs::read_to_string(&path).expect("read back"), BNB_JSON);
        assert!(!dir.join("big_night_band.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_rejects_ids_that_are_not_safe_file_names() {
        let dir = temp_test_dir("unsafe-id");
        for id in ["Big Night", "../evil", "", ".hidden"] {
            let json = format!("{{\"id\":\"{}\"}}", id);
            let err = write_band_at(&dir, id, &json, true).expect_err(id);
            assert_eq!(err.code, "BAND_WRITE_FAILED", "{}", id);
        }
        assert_eq!(fs::read_dir(&dir).expect("list").count(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_rejects_json_whose_id_differs_or_is_not_json() {
        let dir = temp_test_dir("id-mismatch");
        let err = write_band_at(&dir, "other_band", BNB_JSON, true).expect_err("mismatch");
        assert_eq!(err.code, "BAND_WRITE_FAILED");
        let err = write_band_at(&dir, "big_night_band", "{not json", true).expect_err("broken");
        assert_eq!(err.code, "BAND_WRITE_FAILED");
        assert!(!dir.join("other_band.json").exists());
        assert!(!dir.join("big_night_band.json").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_with_expect_new_refuses_to_overwrite_an_existing_file() {
        let dir = temp_test_dir("expect-new");
        let path = dir.join("big_night_band.json");
        fs::write(&path, "{\"id\":\"big_night_band\",\"name\":\"Original\"}").expect("seed");
        let err = write_band_at(&dir, "big_night_band", BNB_JSON, true).expect_err("exists");
        assert_eq!(err.code, "BAND_EXISTS");
        assert!(fs::read_to_string(&path).expect("read").contains("Original"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_without_expect_new_overwrites_an_existing_file() {
        let dir = temp_test_dir("overwrite");
        let path = dir.join("big_night_band.json");
        fs::write(&path, "{\"id\":\"big_night_band\",\"name\":\"Original\"}").expect("seed");
        write_band_at(&dir, "big_night_band", BNB_JSON, false).expect("overwrite");
        assert_eq!(fs::read_to_string(&path).expect("read"), BNB_JSON);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_contact_checks_the_id_and_writes_the_file() {
        let dir = temp_test_dir("contact");
        let json = "{\"id\":\"krecmer_matej\",\"firstName\":\"Matěj\",\"lastName\":\"Krečmer\"}";
        let err = write_contact_at(&dir, "zidek_jakub", json).expect_err("mismatch");
        assert_eq!(err.code, "CONTACT_WRITE_FAILED");
        write_contact_at(&dir, "krecmer_matej", json).expect("write");
        assert_eq!(
            fs::read_to_string(dir.join("krecmer_matej.json")).expect("read"),
            json
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_catalog_entity_returns_none_for_a_missing_file() {
        let dir = temp_test_dir("read-missing");
        let value = read_catalog_entity_at(&dir, "nobody", "BAND_READ_FAILED").expect("read");
        assert!(value.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_catalog_entity_reports_the_path_of_broken_json() {
        let dir = temp_test_dir("read-broken");
        fs::write(dir.join("broken.json"), "{oops").expect("seed");
        let err = read_catalog_entity_at(&dir, "broken", "BAND_READ_FAILED").expect_err("broken");
        assert_eq!(err.code, "BAND_READ_FAILED");
        assert!(err.message.contains("broken.json"), "{}", err.message);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_reads_every_role_folder() {
        let dir = temp_test_dir("musicians");
        fs::create_dir_all(dir.join("bass")).expect("bass dir");
        fs::create_dir_all(dir.join("vocs")).expect("vocs dir");
        fs::write(dir.join("bass/krecmer_matej.json"), "{\"id\":\"krecmer_matej\",\"group\":\"bass\"}").expect("seed bass");
        fs::write(dir.join("vocs/krecmerova_eliska.json"), "{\"id\":\"krecmerova_eliska\",\"group\":\"vocs\"}").expect("seed vocs");
        fs::write(dir.join("vocs/readme.txt"), "not json").expect("seed txt");
        let musicians = list_catalog_musicians_at(&dir).expect("list");
        let mut ids: Vec<&str> = musicians
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
            .collect();
        ids.sort();
        assert_eq!(ids, vec!["krecmer_matej", "krecmerova_eliska"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_fails_with_the_path_of_a_broken_file() {
        let dir = temp_test_dir("musicians-broken");
        fs::create_dir_all(dir.join("keys")).expect("keys dir");
        fs::write(dir.join("keys/zidek_jakub.json"), "{\"id\":").expect("seed");
        let err = list_catalog_musicians_at(&dir).expect_err("broken");
        assert_eq!(err.code, "MUSICIAN_LIST_FAILED");
        assert!(err.message.contains("zidek_jakub.json"), "{}", err.message);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_returns_nothing_for_a_missing_folder() {
        let dir = temp_test_dir("musicians-missing").join("does-not-exist");
        assert!(list_catalog_musicians_at(&dir).expect("list").is_empty());
    }

    #[test]
    fn load_preset_catalog_reads_the_bundled_assets() {
        let presets = load_preset_catalog_at(&resolve_workspace_root(), "PRESET_LIST_FAILED")
            .expect("bundled presets");
        let vocal = presets
            .iter()
            .find(|p| p.get("id").and_then(|v| v.as_str()) == Some("vocal_wired"))
            .expect("vocal_wired is bundled");
        assert_eq!(vocal["capabilities"][0], "vocal");
    }
}
