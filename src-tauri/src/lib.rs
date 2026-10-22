use tauri::ipc::{InvokeBody, Request};

/// Writes an exported file to a path the user picked in a save/folder dialog.
/// The bytes arrive as a raw IPC body (no JSON round-trip for big videos);
/// the destination comes URI-encoded in the `path` header so accents survive.
#[tauri::command]
fn save_file(request: Request<'_>) -> Result<(), String> {
  let InvokeBody::Raw(data) = request.body() else {
    return Err("corpo da requisição deveria ser binário".into());
  };
  let encoded = request
    .headers()
    .get("path")
    .ok_or("caminho ausente")?
    .to_str()
    .map_err(|e| e.to_string())?;
  let path = urlencoding::decode(encoded).map_err(|e| e.to_string())?;
  std::fs::write(path.as_ref(), data).map_err(|e| format!("não foi possível salvar {path}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![save_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
