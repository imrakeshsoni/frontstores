// [crm] [all tenants] — WhatsApp Business API calls run from Rust to avoid webview CSP/network issues
use serde::{Deserialize, Serialize};
use serde_json::json;

const WA_API_VERSION: &str = "v20.0";

#[derive(Serialize)]
pub struct WaResult {
    pub ok: bool,
    pub error: Option<String>,
}

async fn extract_error(res: reqwest::Response) -> String {
    let status = res.status();
    match res.json::<serde_json::Value>().await {
        Ok(body) => body
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("Error {}", status)),
        Err(_) => format!("Error {}", status),
    }
}

#[tauri::command]
pub async fn test_whatsapp_credentials(phone_id: String, token: String) -> WaResult {
    let url = format!("https://graph.facebook.com/{}/{}", WA_API_VERSION, phone_id);
    match reqwest::Client::new()
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => WaResult { ok: true, error: None },
        Ok(res) => WaResult { ok: false, error: Some(extract_error(res).await) },
        Err(e) => WaResult { ok: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub async fn send_whatsapp_message(phone_id: String, token: String, to: String, text: String) -> WaResult {
    let url = format!("https://graph.facebook.com/{}/{}/messages", WA_API_VERSION, phone_id);
    let body = json!({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": { "body": text, "preview_url": false },
    });
    match reqwest::Client::new()
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => WaResult { ok: true, error: None },
        Ok(res) => WaResult { ok: false, error: Some(extract_error(res).await) },
        Err(e) => WaResult { ok: false, error: Some(e.to_string()) },
    }
}

#[derive(Deserialize)]
pub struct WaRecipient {
    pub phone: String,
    pub text: String,
}

#[derive(Serialize)]
pub struct WaBulkResult {
    pub sent: u32,
    pub failed: u32,
}

#[tauri::command]
pub async fn send_whatsapp_bulk(phone_id: String, token: String, recipients: Vec<WaRecipient>) -> WaBulkResult {
    let url = format!("https://graph.facebook.com/{}/{}/messages", WA_API_VERSION, phone_id);
    let client = reqwest::Client::new();
    let mut sent = 0;
    let mut failed = 0;
    for r in recipients {
        let body = json!({
            "messaging_product": "whatsapp",
            "to": r.phone,
            "type": "text",
            "text": { "body": r.text },
        });
        match client.post(&url).bearer_auth(&token).json(&body).send().await {
            Ok(res) if res.status().is_success() => sent += 1,
            _ => failed += 1,
        }
    }
    WaBulkResult { sent, failed }
}
