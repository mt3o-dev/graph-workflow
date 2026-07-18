// Prevents an additional console window from popping up on Windows in
// release builds. Standard Tauri scaffold line; do not remove.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    interview_copilot_lib::run();
}
