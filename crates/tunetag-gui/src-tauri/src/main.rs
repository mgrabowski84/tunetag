// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force GTK3 to use the XDG Desktop Portal for file dialogs on Linux/GNOME.
    // Without this, GTK3 apps show the old-style dialog instead of the native
    // GNOME portal picker (which supports network locations, SFTP mounts, etc.).
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("GTK_USE_PORTAL", "1");
    }

    tunetag_gui_lib::run()
}
