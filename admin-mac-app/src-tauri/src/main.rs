// Prevents console window on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    frontstores_admin_lib::run()
}
