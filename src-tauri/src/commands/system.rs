// [study] [all tenants] — system info for local AI compatibility check
use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Serialize)]
pub struct SystemInfo {
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub free_disk_gb: f64,
    pub os_name: String,
    pub cpu_count: usize,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = Disks::new_with_refreshed_list();
    let free_disk = disks.iter().map(|d| d.available_space()).max().unwrap_or(0);

    SystemInfo {
        total_ram_gb: sys.total_memory() as f64 / 1_073_741_824.0,
        available_ram_gb: sys.available_memory() as f64 / 1_073_741_824.0,
        free_disk_gb: free_disk as f64 / 1_073_741_824.0,
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        cpu_count: sys.cpus().len(),
    }
}
