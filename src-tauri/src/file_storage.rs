use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use pdf_extract::extract_text;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub created_at: DateTime<Utc>,
    pub in_context: bool,
}

#[derive(Debug)]
pub struct FileStorage {
    base_dir: PathBuf,
    uploads_dir: PathBuf,
    index_path: PathBuf,
}

impl FileStorage {
    pub fn new() -> Result<Self> {
        // Anchor storage to project memory directory relative to src-tauri
        let base_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("memory");
        let uploads_dir = base_dir.join("uploads");
        let index_path = uploads_dir.join("index.json");

        fs::create_dir_all(&uploads_dir)
            .with_context(|| format!("creating uploads dir {}", uploads_dir.display()))?;

        if !index_path.exists() {
            fs::write(&index_path, b"[]").with_context(|| "creating empty index.json")?;
        }

        Ok(Self {
            base_dir,
            uploads_dir,
            index_path,
        })
    }

    pub fn upload_file(&self, file_data: Vec<u8>, filename: String) -> Result<FileInfo> {
        let id = Uuid::new_v4().to_string();
        let safe_name = sanitize_filename(&filename);
        let stored_name = format!("{}__{}", id, safe_name);
        let file_path = self.uploads_dir.join(&stored_name);

        fs::write(&file_path, &file_data)
            .with_context(|| format!("writing {}", file_path.display()))?;

        let size = file_data.len() as u64;
        let created_at = Utc::now();

        let mut index = self.load_index()?;
        let info = FileInfo {
            id: id.clone(),
            filename: safe_name,
            path: file_path.to_string_lossy().to_string(),
            size,
            created_at,
            in_context: false,
        };
        index.push(info.clone());
        self.save_index(&index)?;

        Ok(info)
    }

    pub fn list_files(&self) -> Result<Vec<FileInfo>> {
        self.load_index()
    }

    pub fn delete_file(&self, file_id: &str) -> Result<()> {
        let mut index = self.load_index()?;
        if let Some(pos) = index.iter().position(|f| f.id == file_id) {
            let entry = index.remove(pos);
            if let Some(path) = self.find_physical_path(&entry)? {
                let _ = fs::remove_file(path);
            }
            self.save_index(&index)?;
            Ok(())
        } else {
            Err(anyhow!("file not found: {}", file_id))
        }
    }

    pub fn toggle_context(&self, file_id: &str) -> Result<FileInfo> {
        let mut index = self.load_index()?;
        if let Some(entry) = index.iter_mut().find(|f| f.id == file_id) {
            entry.in_context = !entry.in_context;
            let updated = entry.clone();
            self.save_index(&index)?;
            Ok(updated)
        } else {
            Err(anyhow!("file not found: {}", file_id))
        }
    }

    pub fn get_context_content(&self) -> Result<Vec<String>> {
        let index = self.load_index()?;
        let mut collected: Vec<String> = Vec::new();
        for entry in index.into_iter().filter(|e| e.in_context) {
            if let Some(path) = self.find_physical_path(&entry)? {
                if let Some(text) = read_text_content(&path)? {
                    collected.push(limit_len(text, 100_000));
                }
            }
        }
        Ok(collected)
    }

    // ---------- helpers ----------

    fn load_index(&self) -> Result<Vec<FileInfo>> {
        let bytes = fs::read(&self.index_path)
            .with_context(|| format!("reading {}", self.index_path.display()))?;
        let list: Vec<FileInfo> = serde_json::from_slice(&bytes).with_context(|| "parsing index.json")?;
        Ok(list)
    }

    fn save_index(&self, list: &Vec<FileInfo>) -> Result<()> {
        let json = serde_json::to_vec_pretty(list).with_context(|| "serializing index")?;
        let tmp = self.index_path.with_extension("json.tmp");
        {
            let mut f = fs::File::create(&tmp)
                .with_context(|| format!("creating {}", tmp.display()))?;
            f.write_all(&json)?;
            f.flush()?;
        }
        fs::rename(&tmp, &self.index_path)
            .with_context(|| format!("replacing {}", self.index_path.display()))?;
        Ok(())
    }

    fn find_physical_path(&self, info: &FileInfo) -> Result<Option<PathBuf>> {
        let candidate = PathBuf::from(&info.path);
        if candidate.exists() {
            return Ok(Some(candidate));
        }
        let prefix = format!("{}__", info.id);
        for entry in fs::read_dir(&self.uploads_dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&prefix) {
                return Ok(Some(entry.path()));
            }
        }
        Ok(None)
    }
}

fn sanitize_filename(name: &str) -> String {
    let mut out = name
        .chars()
        .map(|c| if is_safe_char(c) { c } else { '_' })
        .collect::<String>();
    if out.trim().is_empty() {
        out = "file".to_string();
    }
    out = out.trim_matches(&['/', '\\'][..]).to_string();
    out
}

fn is_safe_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ' ' | '(' | ')')
}

fn read_text_content(path: &Path) -> Result<Option<String>> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "pdf" => match extract_text(path) {
            Ok(text) => Ok(Some(text)),
            Err(e) => {
                eprintln!("pdf extract failed for {}: {}", path.display(), e);
                Ok(None)
            }
        },
        "txt" | "md" | "csv" | "log" | "json" => {
            let s = fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
            Ok(Some(s))
        }
        _ => {
            // Best-effort: small files as UTF-8
            if let Ok(meta) = fs::metadata(path) {
                if meta.len() <= 2_000_000 {
                    let mut bytes = Vec::new();
                    fs::File::open(path)?.read_to_end(&mut bytes)?;
                    if let Ok(text) = String::from_utf8(bytes) {
                        return Ok(Some(text));
                    }
                }
            }
            Ok(None)
        }
    }
}

fn limit_len(mut s: String, max: usize) -> String {
    if s.len() > max {
        s.truncate(max);
    }
    s
} 