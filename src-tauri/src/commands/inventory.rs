use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AdjustStockInput {
    pub tenant_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub adjustment_type: String,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
    pub cost_price: Option<f64>,
    pub supplier_id: Option<String>,
    pub invoice_number: Option<String>,
    pub notes: Option<String>,
    pub reference_id: Option<String>,
}

#[tauri::command]
pub async fn adjust_stock(_input: AdjustStockInput) -> Result<String, String> {
    // Stock adjustment is handled via TypeScript + tauri-plugin-sql transactions.
    // This command is reserved for future native-level operations.
    Ok("ok".to_string())
}
