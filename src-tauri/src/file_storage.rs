use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub id: String,                    // UUID for unique identification
    pub name: String,                  // Original filename
    pub file_type: String,             // File extension (txt, py, etc.)
    pub size: u64,                     // File size in bytes
    pub upload_date: String,           // ISO 8601 timestamp
    pub content: String,               // Extracted text content
    pub is_context_enabled: bool,      // Toggle for LLM context
}

pub struct FileStorage {
    uploads_dir: PathBuf,              // ./uploads/ directory path
    index_path: PathBuf,               // ./uploads/index.json path
}

impl FileStorage {
    pub fn new() -> Result<Self> {
        let uploads_dir = PathBuf::from("./uploads");
        let index_path = uploads_dir.join("index.json");
        
        // Create uploads directory if it doesn't exist
        if !uploads_dir.exists() {
            fs::create_dir_all(&uploads_dir)?;
        }
        
        // Create index file if it doesn't exist
        if !index_path.exists() {
            fs::write(&index_path, "[]")?;
        }
        
        Ok(FileStorage {
            uploads_dir,
            index_path,
        })
    }
    
    pub fn upload_file(&self, file_data: Vec<u8>, filename: String) -> Result<FileInfo> {
        // 1. Generate unique UUID
        let file_id = Uuid::new_v4().to_string();
        
        // 2. Determine file type from extension
        let file_type = self.get_file_type(&filename);
        
        // 3. Create file path with UUID
        let file_path = self.uploads_dir.join(&file_id);
        
        // 4. Write raw file data
        let file_size = file_data.len() as u64;
        fs::write(&file_path, &file_data)?;
        
        // 5. Extract text content based on file type
        let content = self.extract_text_content(&file_path, &file_type)?;
        
        // 6. Create metadata record
        let file_info = FileInfo {
            id: file_id,
            name: filename,
            file_type,
            size: file_size,
            upload_date: Utc::now().to_rfc3339(),
            content,
            is_context_enabled: true, // Default to enabled
        };
        
        // 7. Save to JSON index
        self.save_file_to_index(&file_info)?;
        
        Ok(file_info)
    }
    
    fn get_file_type(&self, filename: &str) -> String {
        filename
            .split('.')
            .last()
            .unwrap_or("unknown")
            .to_lowercase()
    }
    
    fn extract_text_content(&self, file_path: &Path, file_type: &str) -> Result<String> {
        match file_type {
            // Text files - direct read
            "txt" | "md" | "json" | "csv" | "xml" | "yaml" | "log" => {
                let content = fs::read_to_string(file_path)?;
                Ok(content)
            }
            // Code files - direct read with syntax preservation
            "py" | "js" | "ts" | "java" | "cpp" | "c" | "go" | "rs" | "php" | "html" | "css" | "sql" => {
                let content = fs::read_to_string(file_path)?;
                Ok(content)
            }
            // PDF files - extract text content
            "pdf" => {
                self.extract_pdf_text(file_path)
            }
            // Unsupported types - return empty (future: DOCX, OCR)
            _ => {
                Ok("".to_string())
            }
        }
    }
    
    fn extract_pdf_text(&self, file_path: &Path) -> Result<String> {
        // Read the PDF file as bytes
        let pdf_bytes = fs::read(file_path)?;
        
        // Extract text using pdf-extract
        match pdf_extract::extract_text_from_mem(&pdf_bytes) {
            Ok(text) => {
                // Clean up the extracted text
                let cleaned_text = text
                    .lines()
                    .map(|line| line.trim())
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                
                Ok(cleaned_text)
            }
            Err(e) => {
                // If PDF extraction fails, return a helpful error message
                Err(anyhow!("Failed to extract text from PDF: {}", e))
            }
        }
    }
    
    fn save_file_to_index(&self, file_info: &FileInfo) -> Result<()> {
        let mut files = self.list_files()?;
        files.push(file_info.clone());
        
        let json_content = serde_json::to_string_pretty(&files)?;
        fs::write(&self.index_path, json_content)?;
        
        Ok(())
    }
    
    pub fn list_files(&self) -> Result<Vec<FileInfo>> {
        let content = fs::read_to_string(&self.index_path)?;
        let files: Vec<FileInfo> = serde_json::from_str(&content)?;
        Ok(files)
    }
    
    pub fn delete_file(&self, file_id: &str) -> Result<()> {
        let mut files = self.list_files()?;
        
        // Find and remove the file
        if let Some(index) = files.iter().position(|f| f.id == file_id) {
            // Remove the actual file
            let file_path = self.uploads_dir.join(&file_id);
            if file_path.exists() {
                fs::remove_file(file_path)?;
            }
            
            // Remove from index
            files.remove(index);
            
            // Save updated index
            let json_content = serde_json::to_string_pretty(&files)?;
            fs::write(&self.index_path, json_content)?;
        }
        
        Ok(())
    }
    
    pub fn toggle_file_context(&self, file_id: &str) -> Result<FileInfo> {
        let mut files = self.list_files()?;
        
        // Find the file and clone it for return
        let file_index = files.iter().position(|f| f.id == file_id)
            .ok_or_else(|| anyhow!("File not found: {}", file_id))?;
        
        // Toggle the context
        files[file_index].is_context_enabled = !files[file_index].is_context_enabled;
        
        // Clone the file info for return
        let file_info = files[file_index].clone();
        
        // Save updated index
        let json_content = serde_json::to_string_pretty(&files)?;
        fs::write(&self.index_path, json_content)?;
        
        Ok(file_info)
    }
    
    pub fn get_context_content(&self) -> Result<Vec<String>> {
        let files = self.list_files()?;
        
        // Filter enabled files and extract content
        let context_content: Vec<String> = files
            .iter()
            .filter(|f| f.is_context_enabled)
            .map(|f| format!("File: {}\nContent:\n{}", f.name, f.content))
            .collect();
        
        Ok(context_content)
    }
    
    pub fn get_file_by_id(&self, file_id: &str) -> Result<Option<FileInfo>> {
        let files = self.list_files()?;
        Ok(files.into_iter().find(|f| f.id == file_id))
    }
}

// Global file storage instance
lazy_static::lazy_static! {
    static ref FILE_STORAGE: std::sync::Mutex<FileStorage> = {
        std::sync::Mutex::new(FileStorage::new().expect("Failed to initialize file storage"))
    };
}

// Public functions for Tauri commands
pub fn upload_file(file_data: Vec<u8>, filename: String) -> Result<FileInfo> {
    let storage = FILE_STORAGE.lock().unwrap();
    storage.upload_file(file_data, filename)
}

pub fn list_uploaded_files() -> Result<Vec<FileInfo>> {
    let storage = FILE_STORAGE.lock().unwrap();
    storage.list_files()
}

pub fn delete_uploaded_file(file_id: String) -> Result<()> {
    let storage = FILE_STORAGE.lock().unwrap();
    storage.delete_file(&file_id)
}

pub fn toggle_file_context(file_id: String) -> Result<FileInfo> {
    let storage = FILE_STORAGE.lock().unwrap();
    storage.toggle_file_context(&file_id)
}

pub fn get_file_context() -> Result<Vec<String>> {
    let storage = FILE_STORAGE.lock().unwrap();
    storage.get_context_content()
}
