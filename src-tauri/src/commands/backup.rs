use std::path::PathBuf;

use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    services::backup::{BackupInfo, BackupService},
};
use crate::commands::{auth::SessionStore, guard};

#[tauri::command]
pub async fn trigger_backup(
    pool: State<'_, DbPool>,
    sessions: State<'_, SessionStore>,
    token: Option<String>,
    state: State<'_, BackupService>,
) -> Result<BackupInfo, AppError> {
    guard::require_role(&sessions, &pool, token, guard::ADMIN_ONLY).await?;

    let backup_path = state.create_backup_with_checkpoint(&pool).await?;
    BackupService::backup_info_from_path(&backup_path)
}

#[tauri::command]
pub async fn list_backups(
    pool: State<'_, DbPool>,
    sessions: State<'_, SessionStore>,
    token: Option<String>,
    state: State<'_, BackupService>,
) -> Result<Vec<BackupInfo>, AppError> {
    guard::require_role(&sessions, &pool, token, guard::ADMIN_ONLY).await?;

    Ok(state.list_backups())
}

#[tauri::command]
pub async fn restore_backup(
    pool: State<'_, DbPool>,
    sessions: State<'_, SessionStore>,
    token: Option<String>,
    state: State<'_, BackupService>,
    backup_path: String,
) -> Result<bool, AppError> {
    guard::require_role(&sessions, &pool, token, guard::ADMIN_ONLY).await?;

    // Closing the pool checkpoints and removes the WAL, so the file swap
    // below sees a complete, quiescent database. The app relaunches right
    // after a restore, which re-opens a fresh pool.
    pool.close().await;

    state.restore_backup(PathBuf::from(backup_path))?;
    Ok(true)
}
