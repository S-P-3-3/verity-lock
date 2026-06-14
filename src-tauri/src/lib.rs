//! sp3 Lock — portable, offline, AES-256-GCM encrypted vault (account-number login).

mod commands;
mod crypto;
mod generator;
mod importer;
mod state;
mod vault;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::create_vault,
            commands::open_vault,
            commands::lock_vault,
            commands::is_unlocked,
            commands::get_entries,
            commands::create_entry,
            commands::update_entry,
            commands::delete_entry,
            commands::generate_password,
            commands::generate_account_number,
            commands::estimate_password_strength,
            commands::preview_import,
            commands::import_from_file,
            commands::export_vault,
            commands::backup_vault,
            commands::change_master_password,
            commands::default_vault_path,
            commands::vault_exists,
            commands::load_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
