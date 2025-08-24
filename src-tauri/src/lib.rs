// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod window;
mod pii_scrubber;



#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn set_window_height(window: tauri::WebviewWindow, height: u32) -> Result<(), String> {
  use tauri::{LogicalSize, Size};
  
  let new_size = LogicalSize::new(700.0, height as f64);
  
  match window.set_size(Size::Logical(new_size)) {
    Ok(_) => {
      if let Err(e) = window::position_window_top_center(&window, 54) {
        eprintln!("Failed to reposition window: {}", e);
      }
      Ok(())
    }
    Err(e) => Err(format!("Failed to resize window: {}", e))
  }
}

#[tauri::command]
fn write_conversation_to_file(conversation_data: String, filename: String) -> Result<(), String> {
  use std::fs;
  use std::path::Path;
  
  // First, scrub PII from the conversation data
  let clean_conversation_data = pii_scrubber::scrub_conversation_json(conversation_data)
    .map_err(|e| format!("Failed to scrub PII: {}", e))?;
  
  // Use the specific project directory path
  let project_dir = Path::new("C:\\Users\\parad\\Downloads\\pluely-master2");
  
  // Create memory folder path
  let memory_path = project_dir.join("memory");
  
  // Create memory folder if it doesn't exist
  if !memory_path.exists() {
    fs::create_dir(&memory_path)
      .map_err(|e| format!("Failed to create memory directory: {}", e))?;
  }
  
  // Create full file path
  let file_path = memory_path.join(filename);
  
  // Write the clean conversation data to file
  fs::write(&file_path, clean_conversation_data)
    .map_err(|e| format!("Failed to write file: {}", e))?;
  
  println!("Clean conversation written to: {:?}", file_path);
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_app_version,
            set_window_height,
            write_conversation_to_file
        ])
        .setup(|app| {
            // Setup main window positioning
            window::setup_main_window(app).expect("Failed to setup main window");
            Ok(())
        });

    // Add macOS-specific permissions plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
