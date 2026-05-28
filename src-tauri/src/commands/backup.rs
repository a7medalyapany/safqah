use std::path::PathBuf;

use tauri::State;

use crate::{
    errors::AppError,
    services::backup::{BackupInfo, BackupService},
};

#[tauri::command]
pub async fn trigger_backup(state: State<'_, BackupService>) -> Result<BackupInfo, AppError> {
    let backup_path = state.create_backup()?;
    BackupService::backup_info_from_path(&backup_path)
}

#[tauri::command]
pub async fn list_backups(state: State<'_, BackupService>) -> Result<Vec<BackupInfo>, AppError> {
    Ok(state.list_backups())
}

#[tauri::command]
pub async fn restore_backup(
    state: State<'_, BackupService>,
    backup_path: String,
) -> Result<bool, AppError> {
    state.restore_backup(PathBuf::from(backup_path))?;
    Ok(true)
}
