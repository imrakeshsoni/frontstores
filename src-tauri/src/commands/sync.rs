use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncRow {
    pub table: String,
    pub id: String,
    pub data: serde_json::Value,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullQuery {
    pub tenant_id: String,
    pub since: Option<String>,
    pub tables: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushPayload {
    pub tenant_id: String,
    pub rows: Vec<SyncRow>,
}

#[derive(Debug, Serialize)]
pub struct SyncResponse<T> {
    pub ok: bool,
    pub data: T,
}

// ── Sync tables covered ───────────────────────────────────────────────────────

pub const SYNC_TABLES: &[&str] = &[
    "products",
    "customers",
    "orders",
    "order_items",
    "inventory_adjustments",
    "expenses",
    "khata_entries",
    "suppliers",
];

// ── In-memory pending rows (desktop side receives pushed rows from mobile) ────

static PENDING_PUSH: OnceCell<Arc<Mutex<Vec<SyncRow>>>> = OnceCell::new();

fn pending_push() -> Arc<Mutex<Vec<SyncRow>>> {
    PENDING_PUSH
        .get_or_init(|| Arc::new(Mutex::new(Vec::new())))
        .clone()
}

// ── Server state ──────────────────────────────────────────────────────────────

static SYNC_SERVER_HANDLE: OnceCell<tokio::sync::watch::Sender<bool>> = OnceCell::new();

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Start the WiFi sync server on port 7788.
/// Returns the local IP address and port so the mobile app can connect.
#[tauri::command]
pub async fn start_wifi_sync_server() -> Result<String, String> {
    let addr: SocketAddr = "0.0.0.0:7788".parse().unwrap();

    // If already running just return ok
    if SYNC_SERVER_HANDLE.get().is_some() {
        return Ok("running".to_string());
    }

    let pending = pending_push();
    let app = Router::new()
        .route("/sync/ping", get(handle_ping))
        .route("/sync/push", post(handle_push))
        .with_state(pending);

    let (tx, mut rx) = tokio::sync::watch::channel(false);
    SYNC_SERVER_HANDLE.set(tx).ok();

    tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        axum::serve(listener, app)
            .with_graceful_shutdown(async move { rx.changed().await.ok(); })
            .await
            .ok();
    });

    // Return local IP for display
    let ip = local_ip();
    Ok(format!("{}:7788", ip))
}

/// Stop the WiFi sync server.
#[tauri::command]
pub async fn stop_wifi_sync_server() -> Result<(), String> {
    if let Some(tx) = SYNC_SERVER_HANDLE.get() {
        tx.send(true).ok();
    }
    Ok(())
}

/// Drain any rows that were pushed from the mobile device.
/// The JS side calls this to process and write pushed rows into SQLite.
#[tauri::command]
pub async fn drain_pushed_rows() -> Result<Vec<SyncRow>, String> {
    let pending = pending_push();
    let mut lock = pending.lock().await;
    let rows = lock.drain(..).collect();
    Ok(rows)
}

/// Called from the mobile app: test if a desktop server is reachable.
/// `host` = "192.168.1.5:7788"
#[tauri::command]
pub async fn ping_sync_server(host: String) -> Result<bool, String> {
    let url = format!("http://{}/sync/ping", host);
    let res = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    Ok(res.status().is_success())
}

/// Mobile pushes its local changes to the desktop.
/// `host` = "192.168.1.5:7788", rows = changed rows from mobile's SQLite.
#[tauri::command]
pub async fn push_to_desktop(host: String, rows: Vec<SyncRow>) -> Result<usize, String> {
    let url = format!("http://{}/sync/push", host);
    let client = reqwest::Client::new();
    let payload = PushPayload {
        tenant_id: String::new(), // filled by JS
        rows: rows.clone(),
    };
    client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.len())
}

// ── Axum handlers ─────────────────────────────────────────────────────────────

async fn handle_ping() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true, "app": "FrontStores" }))
}

async fn handle_push(
    State(pending): State<Arc<Mutex<Vec<SyncRow>>>>,
    Json(payload): Json<PushPayload>,
) -> Json<serde_json::Value> {
    let count = payload.rows.len();
    let mut lock = pending.lock().await;
    lock.extend(payload.rows);
    Json(serde_json::json!({ "ok": true, "received": count }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn local_ip() -> String {
    // Try to find the LAN IP by connecting to a known address
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").ok();
    if let Some(s) = socket {
        s.connect("8.8.8.8:80").ok();
        if let Ok(addr) = s.local_addr() {
            return addr.ip().to_string();
        }
    }
    "127.0.0.1".to_string()
}
