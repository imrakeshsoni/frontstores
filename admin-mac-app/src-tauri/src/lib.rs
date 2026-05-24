use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

const SERVER_PORT: u16 = 3002;

fn is_server_running() -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", SERVER_PORT).parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn find_node() -> String {
    let candidates = [
        "/opt/homebrew/opt/node@22/bin/node",
        "/opt/homebrew/opt/node@20/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for p in &candidates {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }
    "node".to_string()
}

fn server_script() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    std::path::PathBuf::from(home)
        .join("Documents")
        .join("Cloud Software")
        .join("frontstores")
        .join("tools")
        .join("update-server.cjs")
}

// Read ADMIN_PASSWORD from the launchd plist (already set up on this Mac)
fn read_password() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let plist = std::fs::read_to_string(format!(
        "{}/Library/LaunchAgents/com.frontstores.server.plist",
        home
    ))
    .unwrap_or_default();

    if let Some(key_pos) = plist.find("<key>ADMIN_PASSWORD</key>") {
        let after = &plist[key_pos..];
        if let Some(s) = after.find("<string>") {
            let start = s + 8;
            if let Some(e) = after[start..].find("</string>") {
                let pwd = after[start..start + e].trim().to_string();
                if !pwd.is_empty() {
                    return pwd;
                }
            }
        }
    }
    String::new()
}

fn wait_for_server() -> bool {
    for _ in 0..30 {
        if is_server_running() {
            return true;
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            std::thread::spawn(move || {
                if !is_server_running() {
                    let script = server_script();
                    if script.exists() {
                        let node = find_node();
                        let password = read_password();
                        let script_dir = script.parent().unwrap().to_path_buf();

                        let _ = Command::new(&node)
                            .arg(&script)
                            .env("ADMIN_PASSWORD", &password)
                            .current_dir(&script_dir)
                            .spawn();
                    }
                }

                let ready = wait_for_server();

                if let Some(window) = handle.get_webview_window("main") {
                    if ready {
                        let _ = window.eval(&format!(
                            "window.location.href='http://localhost:{}/admin'",
                            SERVER_PORT
                        ));
                    } else {
                        let _ = window.eval(
                            r#"document.getElementById('status').textContent = '⚠ Could not start server. Is Node.js installed?'"#
                        );
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
