use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItem {
    pub product_id: Option<String>,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub mrp: Option<f64>,
    pub discount: f64,
    pub gst_rate: f64,
    pub total: f64,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderInput {
    pub tenant_id: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub items: Vec<OrderItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub tax_total: f64,
    pub total: f64,
    pub payment_method: String,
    pub payment_status: String,
    pub amount_paid: f64,
    pub notes: Option<String>,
    pub order_date: Option<String>,
}

#[tauri::command]
pub async fn create_order(_input: CreateOrderInput) -> Result<String, String> {
    // Order creation (atomic: insert order + items + deduct stock) is handled
    // via TypeScript + tauri-plugin-sql with explicit transaction management.
    Ok("ok".to_string())
}
