use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::Serialize;

use crate::errors::AppError;

#[derive(Clone, Debug)]
pub struct BackupService {
    db_path: PathBuf,
    backup_dir: PathBuf,
    max_backups: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

impl BackupService {
    pub fn new() -> Self {
        let data_dir = dirs::data_dir().expect("Unable to resolve app data directory");
        let app_dir = data_dir.join("pos");
        let backup_dir = app_dir.join("backups");

        fs::create_dir_all(&backup_dir).expect("Unable to create backup directory");

        Self {
            db_path: app_dir.join("pos.db"),
            backup_dir,
            max_backups: 7,
        }
    }

    pub fn create_backup(&self) -> Result<PathBuf, AppError> {
        if !self.db_path.exists() {
            return Err(AppError::new(
                "DATABASE_NOT_FOUND",
                "ملف قاعدة البيانات غير موجود",
                "Database file not found",
            ));
        }

        let filename = format!("pos_{}.db", Local::now().format("%Y%m%d_%H%M%S"));
        let backup_path = self.backup_dir.join(filename);

        fs::copy(&self.db_path, &backup_path).map_err(|error| {
            AppError::new(
                "BACKUP_FAILED",
                "فشل إنشاء النسخة الاحتياطية",
                &format!("Failed to create backup: {error}"),
            )
        })?;

        self.cleanup_old_backups();

        Ok(backup_path)
    }

    pub fn cleanup_old_backups(&self) {
        let mut backup_paths = self.backup_paths();

        if backup_paths.len() <= self.max_backups {
            return;
        }

        backup_paths.sort_by(|left, right| {
            let left_name = left
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            let right_name = right
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();

            left_name.cmp(right_name)
        });

        let remove_count = backup_paths.len() - self.max_backups;

        for path in backup_paths.iter().take(remove_count) {
            let _ = fs::remove_file(path);
        }
    }

    pub fn list_backups(&self) -> Vec<BackupInfo> {
        let mut backups: Vec<BackupInfo> = self
            .backup_paths()
            .into_iter()
            .filter_map(|path| Self::backup_info_from_path(&path).ok())
            .collect();

        backups.sort_by(|left, right| right.filename.cmp(&left.filename));
        backups
    }

    pub fn restore_backup(&self, backup_path: PathBuf) -> Result<(), AppError> {
        if !backup_path.exists() {
            return Err(AppError::new(
                "BACKUP_NOT_FOUND",
                "ملف النسخة الاحتياطية غير موجود",
                "Backup file not found",
            ));
        }

        let is_db_file = backup_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("db"))
            .unwrap_or(false);

        if !is_db_file {
            return Err(AppError::new(
                "INVALID_BACKUP_FILE",
                "الملف المحدد ليس نسخة احتياطية صالحة",
                "The selected file is not a valid backup",
            ));
        }

        self.create_backup()?;

        fs::copy(&backup_path, &self.db_path).map_err(|error| {
            AppError::new(
                "RESTORE_FAILED",
                "فشل استعادة النسخة الاحتياطية",
                &format!("Failed to restore backup: {error}"),
            )
        })?;

        Ok(())
    }

    pub(crate) fn backup_info_from_path(path: &Path) -> Result<BackupInfo, AppError> {
        let metadata = fs::metadata(path).map_err(|error| {
            AppError::new(
                "BACKUP_METADATA_ERROR",
                "تعذر قراءة بيانات النسخة الاحتياطية",
                &format!("Failed to read backup metadata: {error}"),
            )
        })?;

        let modified_at = metadata.modified().map_err(|error| {
            AppError::new(
                "BACKUP_METADATA_ERROR",
                "تعذر قراءة تاريخ النسخة الاحتياطية",
                &format!("Failed to read backup modified time: {error}"),
            )
        })?;

        let created_at = chrono::DateTime::<Local>::from(modified_at).to_rfc3339();
        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| {
                AppError::new(
                    "INVALID_BACKUP_FILE",
                    "اسم ملف النسخة الاحتياطية غير صالح",
                    "Invalid backup file name",
                )
            })?
            .to_owned();

        Ok(BackupInfo {
            filename,
            path: path.to_string_lossy().to_string(),
            size_bytes: metadata.len(),
            created_at,
        })
    }

    fn backup_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        let entries = match fs::read_dir(&self.backup_dir) {
            Ok(entries) => entries,
            Err(_) => return paths,
        };

        for entry in entries.flatten() {
            let path = entry.path();

            let is_db_file = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case("db"))
                .unwrap_or(false);

            if is_db_file {
                paths.push(path);
            }
        }

        paths
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn unique_temp_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "safqah-backup-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ))
    }

    fn prepare_service() -> (BackupService, PathBuf) {
        let data_home = unique_temp_root();
        fs::create_dir_all(&data_home).expect("temp data dir should be writable");
        std::env::set_var("XDG_DATA_HOME", &data_home);

        let service = BackupService::new();
        let db_path = data_home.join("pos/pos.db");
        (service, db_path)
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent directory should exist");
        }

        let mut file = fs::File::create(path).expect("file should be creatable");
        file.write_all(contents.as_bytes())
            .expect("file should be writable");
    }

    #[test]
    fn create_and_list_backups_return_newest_first() {
        let (service, db_path) = prepare_service();
        write_file(&db_path, "db-one");

        let first_backup = service.create_backup().expect("first backup should succeed");
        let first_name = first_backup
            .file_name()
            .and_then(|value| value.to_str())
            .expect("backup file name should be valid")
            .to_owned();

        std::thread::sleep(std::time::Duration::from_secs(1));
        write_file(&db_path, "db-two");
        let second_backup = service.create_backup().expect("second backup should succeed");

        let backups = service.list_backups();

        assert_eq!(backups.len(), 2);
        assert_eq!(backups[0].filename, second_backup.file_name().and_then(|value| value.to_str()).unwrap());
        assert_eq!(backups[1].filename, first_name);
        assert!(backups[0].size_bytes > 0);
        assert!(backups[0].created_at.contains('T'));
    }

    #[test]
    fn cleanup_old_backups_keeps_latest_seven() {
        let (service, _db_path) = prepare_service();

        for index in 0..8 {
            let file_name = format!("pos_20260101_00000{index}.db");
            let backup_path = service.backup_dir.join(file_name);
            write_file(&backup_path, &format!("backup-{index}"));
        }

        service.cleanup_old_backups();

        let backups = service.list_backups();
        assert_eq!(backups.len(), 7);
        assert!(backups.iter().all(|backup| !backup.filename.ends_with("000000.db")));
        assert!(backups.iter().any(|backup| backup.filename.ends_with("000007.db")));
    }

    #[test]
    fn restore_backup_replaces_current_database() {
        let (service, db_path) = prepare_service();
        let backup_dir = service.backup_dir.clone();

        write_file(&db_path, "current-db");
        let restore_source = backup_dir.join("pos_20260101_010101.db");
        write_file(&restore_source, "restored-db");

        service
            .restore_backup(restore_source.clone())
            .expect("restore should succeed");

        let restored_contents = fs::read_to_string(&db_path).expect("restored db should be readable");
        assert_eq!(restored_contents, "restored-db");

        let safety_backups = service.list_backups();
        assert!(safety_backups.len() >= 2);
        assert!(backup_dir.exists());
    }
}