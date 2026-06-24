use std::collections::HashMap;
use std::sync::Mutex;

use rand::{rngs::OsRng as RandomOsRng, RngCore};
use tauri::State;

use argon2::password_hash::{rand_core::OsRng, PasswordHash, SaltString};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};

use crate::{
    db::DbPool,
    errors::AppError,
    models::user::{CreateUserPayload, UpdateUserPayload, User, UserWithPassword},
};

/// In-memory map of active session tokens to their user id.
///
/// Stored as Tauri-managed state, so it survives a webview reload (the Rust
/// process stays alive) but is intentionally cleared on a full app restart.
#[derive(Default)]
pub struct SessionStore(Mutex<HashMap<String, i64>>);

#[derive(Debug, serde::Serialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn normalize_required_string(value: String, message_ar: &str) -> Result<String, AppError> {
    let trimmed = value.trim().to_owned();
    if trimmed.is_empty() {
        Err(AppError::validation(message_ar))
    } else {
        Ok(trimmed)
    }
}

fn validate_role(role: &str) -> Result<String, AppError> {
    let role = role.trim().to_owned();

    match role.as_str() {
        "admin" | "cashier" | "accountant" => Ok(role),
        _ => Err(AppError::validation("الدور غير صالح")),
    }
}

fn invalid_credentials_error() -> AppError {
    AppError::new(
        "INVALID_CREDENTIALS",
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        "Invalid username or password",
    )
}

fn generate_session_token() -> String {
    let mut bytes = [0u8; 16];
    RandomOsRng.fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

async fn get_user_record_by_id(pool: &DbPool, id: i64) -> Result<UserWithPassword, AppError> {
    sqlx::query_as::<_, UserWithPassword>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("المستخدم"))
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| {
            AppError::new(
                "HASH_ERROR",
                "خطأ في معالجة كلمة المرور",
                "Password hashing failed",
            )
        })
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = PasswordHash::new(hash).ok();
    parsed
        .map(|hash| Argon2::default().verify_password(password.as_bytes(), &hash).is_ok())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn login(
    pool: State<'_, DbPool>,
    sessions: State<'_, SessionStore>,
    username: String,
    password: String,
) -> Result<AuthResponse, AppError> {
    let username = normalize_required_string(username, "اسم المستخدم مطلوب")?;
    let password = normalize_required_string(password, "كلمة المرور مطلوبة")?;

    let user = sqlx::query_as::<_, UserWithPassword>(
        "SELECT * FROM users WHERE username = ? AND is_active = 1",
    )
    .bind(username)
    .fetch_optional(&*pool)
    .await?
    .ok_or_else(invalid_credentials_error)?;

    if !verify_password(&password, &user.password_hash) {
        return Err(invalid_credentials_error());
    }

    let user: User = user.into();
    let token = generate_session_token();
    sessions
        .0
        .lock()
        .expect("session store mutex poisoned")
        .insert(token.clone(), user.id);

    Ok(AuthResponse { user, token })
}

#[tauri::command]
pub async fn logout(sessions: State<'_, SessionStore>, token: String) -> Result<bool, AppError> {
    sessions
        .0
        .lock()
        .expect("session store mutex poisoned")
        .remove(&token);
    Ok(true)
}

#[tauri::command]
pub async fn get_current_user(
    pool: State<'_, DbPool>,
    sessions: State<'_, SessionStore>,
    token: String,
) -> Result<Option<User>, AppError> {
    let user_id = sessions
        .0
        .lock()
        .expect("session store mutex poisoned")
        .get(&token)
        .copied();

    let Some(user_id) = user_id else {
        return Ok(None);
    };

    match get_user_record_by_id(&pool, user_id).await {
        Ok(user) => {
            // Only an active user keeps a valid session.
            if user.is_active == 1 {
                Ok(Some(user.into()))
            } else {
                sessions
                    .0
                    .lock()
                    .expect("session store mutex poisoned")
                    .remove(&token);
                Ok(None)
            }
        }
        Err(_) => {
            sessions
                .0
                .lock()
                .expect("session store mutex poisoned")
                .remove(&token);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn list_users(pool: State<'_, DbPool>) -> Result<Vec<User>, AppError> {
    let users = sqlx::query_as::<_, UserWithPassword>("SELECT * FROM users ORDER BY id DESC")
        .fetch_all(&*pool)
        .await?;

    Ok(users.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn create_user(
    pool: State<'_, DbPool>,
    payload: CreateUserPayload,
) -> Result<User, AppError> {
    let name = normalize_required_string(payload.name, "الاسم مطلوب")?;
    let username = normalize_required_string(payload.username, "اسم المستخدم مطلوب")?;
    let role = validate_role(&payload.role)?;
    let password = normalize_required_string(payload.password, "كلمة المرور مطلوبة")?;

    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(&*pool)
        .await?;

    if existing.is_some() {
        return Err(AppError::new(
            "DUPLICATE_USERNAME",
            "اسم المستخدم مستخدم من قبل",
            "Username already exists",
        ));
    }

    let password_hash = hash_password(&password)?;

    let result = sqlx::query(
        r#"
        INSERT INTO users (name, username, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 1)
        "#,
    )
    .bind(name)
    .bind(username)
    .bind(password_hash)
    .bind(role)
    .execute(&*pool)
    .await?;

    Ok(get_user_record_by_id(&pool, result.last_insert_rowid()).await?.into())
}

#[tauri::command]
pub async fn update_user(
    pool: State<'_, DbPool>,
    id: i64,
    payload: UpdateUserPayload,
) -> Result<User, AppError> {
    let current_user = get_user_record_by_id(&pool, id).await?;
    let current_username = current_user.username.clone();

    let name = match payload.name {
        Some(value) => normalize_required_string(value, "الاسم مطلوب")?,
        None => current_user.name,
    };

    let username = match payload.username {
        Some(value) => normalize_required_string(value, "اسم المستخدم مطلوب")?,
        None => current_username.clone(),
    };

    if username != current_username {
        let existing: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM users WHERE username = ? AND id <> ?",
        )
        .bind(&username)
        .bind(id)
        .fetch_optional(&*pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::new(
                "DUPLICATE_USERNAME",
                "اسم المستخدم مستخدم من قبل",
                "Username already exists",
            ));
        }
    }

    let role = match payload.role {
        Some(value) => validate_role(&value)?,
        None => current_user.role,
    };

    let is_active = payload.is_active.unwrap_or(current_user.is_active);
    let password_hash = match payload.password {
        Some(password) => {
            let password = normalize_optional_string(Some(password))
                .ok_or_else(|| AppError::validation("كلمة المرور مطلوبة"))?;
            hash_password(&password)?
        }
        None => current_user.password_hash,
    };

    sqlx::query(
        r#"
        UPDATE users
        SET name = ?, username = ?, password_hash = ?, role = ?, is_active = ?
        WHERE id = ?
        "#,
    )
    .bind(name)
    .bind(username)
    .bind(password_hash)
    .bind(role)
    .bind(is_active)
    .bind(id)
    .execute(&*pool)
    .await?;

    Ok(get_user_record_by_id(&pool, id).await?.into())
}

#[tauri::command]
pub async fn deactivate_user(pool: State<'_, DbPool>, id: i64) -> Result<bool, AppError> {
    let result = sqlx::query("UPDATE users SET is_active = 0 WHERE id = ?")
        .bind(id)
        .execute(&*pool)
        .await?;

    Ok(result.rows_affected() > 0)
}