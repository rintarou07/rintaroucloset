// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use hextech_skin_client_lib::portable::PortablePaths;

fn main() {
    let is_test = PortablePaths::is_test_mode();
    let folder_name = if is_test { "data-test" } else { "data" };

    // RULE 1: Explicitly set WEBVIEW2_USER_DATA_FOLDER relative to the executable
    // so WebView2 runtime cache stays strictly inside ./data/webview (or ./data-test/webview) next to the executable.
    if let Ok(root) = PortablePaths::resolve_root() {
        let webview_dir = root.join(folder_name).join("webview");
        let _ = std::fs::create_dir_all(&webview_dir);
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &webview_dir);
    }

    hextech_skin_client_lib::run();
}

