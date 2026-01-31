//! Vault operations - file scanning, searching, indexing

use serde::{Deserialize, Serialize};
use std::time::Instant;
use tracing::{info, instrument, warn};
use walkdir::WalkDir;

/// A file entry in the vault.
#[derive(Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
}

/// Recursively scans a vault directory for markdown files.
/// Skips hidden directories and returns sorted results.
#[tauri::command]
#[instrument(skip_all, fields(vault = %vault_relative_path))]
pub fn scan_vault(vault_relative_path: String) -> Result<Vec<FileEntry>, String> {
    let start = Instant::now();
    info!("Starting vault scan");

    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let vault_root = home.join(&vault_relative_path);

    if !vault_root.exists() {
        warn!(path = ?vault_root, "Vault path does not exist");
        return Err(format!("Vault path does not exist: {:?}", vault_root));
    }

    let mut results: Vec<FileEntry> = Vec::new();

    for entry in WalkDir::new(&vault_root)
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
        .filter_map(Result::ok)
        .filter(|e| is_markdown_file(e.path()))
    {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let full_path = path.to_string_lossy().to_string();

        let relative_path = path
            .strip_prefix(&vault_root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        results.push(FileEntry {
            name,
            path: full_path,
            relative_path,
        });
    }

    // Sort by relative path for consistent ordering
    results.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let elapsed = start.elapsed();
    info!(
        file_count = results.len(),
        elapsed_ms = format!("{:.2}", elapsed.as_secs_f64() * 1000.0),
        "Scan complete"
    );

    Ok(results)
}

/// Returns true if the entry is a hidden file/directory (starts with '.')
fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

/// Returns true if the path is a markdown file
fn is_markdown_file(path: &std::path::Path) -> bool {
    path.is_file() && path.extension().map(|e| e == "md").unwrap_or(false)
}
