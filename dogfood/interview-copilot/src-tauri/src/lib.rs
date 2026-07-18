//! Interview Copilot — Tauri shell.
//!
//! This crate is intentionally thin. Per tech-stack.md decision 1, ALL domain
//! logic (transcription pipeline, retrieval, answering, config layering, KB
//! parsing, session logging) lives in TypeScript under /src/lib, tested with
//! vitest. Rust's job here is limited to:
//!   1. window/app lifecycle (via the Tauri builder + generated context),
//!   2. two narrow commands the frontend can invoke through
//!      `src/lib/tauri/bridge.ts`.
//!
//! Do not add business logic, HTTP clients, embedding/transcription code, or
//! SQLite access here — those belong behind the TS ports in src/lib/ports and
//! src/lib/adapters. This file could not be compiled in the authoring
//! environment (no cargo/rustc available); see /docs/deferred-verification.md
//! for the exact commands to run this through `cargo check` and
//! `tauri build` on a machine that has the Rust toolchain.

use tauri::Manager;

/// Returns the app's per-user data directory as a string, so the TS side can
/// place its SQLite DB (index + session log, per tech-stack.md decisions 4
/// and 12) and any config overlay files under a platform-correct path
/// instead of hardcoding one.
#[tauri::command]
fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|err| format!("could not resolve app data dir: {err}"))
        .and_then(|path| {
            path.to_str()
                .map(str::to_owned)
                .ok_or_else(|| "app data dir path is not valid UTF-8".to_string())
        })
}

/// Stub / seam for a future feature that is explicitly a v1 non-goal (see
/// plan.md "Non-goals": "App does not manage the Whisper Docker container
/// lifecycle"). A later phase may wire this to actually start/stop the
/// WhisperLive sidecar container (or a local `faster-whisper` process) so the
/// local STT adapter (tech-stack.md decision 5) has something to dial into
/// without the user starting Docker by hand.
///
/// For now it does nothing but report that it is unimplemented, so the
/// frontend bridge and any future e2e spec can call it without erroring in a
/// way that is confusing to trace back to this comment.
#[tauri::command]
fn spawn_sidecar_hint() -> Result<String, String> {
    Err(
        "spawn_sidecar_hint is a stub: sidecar/container lifecycle management is a v1 non-goal \
         (plan.md). Start the WhisperLive-compatible server manually and point \
         stt.adapter/whisper config at it."
            .to_string(),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_app_data_dir, spawn_sidecar_hint])
        .run(tauri::generate_context!())
        .expect("error while running interview-copilot tauri application");
}
