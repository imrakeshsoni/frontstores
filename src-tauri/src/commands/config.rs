use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TenantConfig {
    pub tenant_id: String,
    pub shop_type: String,
    pub shop_name: String,
    pub owner_name: String,
    pub is_setup_complete: bool,
}

#[tauri::command]
pub async fn get_or_create_tenant() -> Result<TenantConfig, String> {
    Err("Use TypeScript db layer".to_string())
}

#[tauri::command]
pub async fn get_next_bill_number(_tenant_id: String) -> Result<String, String> {
    Err("Use TypeScript db layer".to_string())
}
