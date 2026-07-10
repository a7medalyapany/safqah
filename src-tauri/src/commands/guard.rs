use crate::{
    commands::auth::SessionStore,
    db::DbPool,
    errors::AppError,
    models::user::{User, UserWithPassword},
};

/// Role sets mirroring the frontend `featurePermissions` matrix.
/// An empty slice means "any authenticated user".
pub const ANY_ROLE: &[&str] = &[];
pub const ADMIN_ONLY: &[&str] = &["admin"];
pub const ADMIN_OR_ACCOUNTANT: &[&str] = &["admin", "accountant"];
pub const ADMIN_OR_CASHIER: &[&str] = &["admin", "cashier"];

fn unauthenticated() -> AppError {
    AppError::new(
        "UNAUTHENTICATED",
        "يجب تسجيل الدخول أولاً",
        "Authentication required",
    )
}

fn forbidden() -> AppError {
    AppError::new(
        "FORBIDDEN",
        "ليس لديك صلاحية لهذه العملية",
        "Insufficient role for this operation",
    )
}

/// Resolve a session token to an active user and enforce a role set.
///
/// Every command except login/setup must call this before touching the
/// database — frontend route guards are UX only, the backend is the
/// authority. Stale tokens (deleted or deactivated users) are evicted
/// from the session store on sight.
pub async fn require_role(
    sessions: &SessionStore,
    pool: &DbPool,
    token: Option<String>,
    allowed: &[&str],
) -> Result<User, AppError> {
    let token = token.ok_or_else(unauthenticated)?;
    let user_id = sessions.user_id_for(&token).ok_or_else(unauthenticated)?;

    let user = sqlx::query_as::<_, UserWithPassword>("SELECT * FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    let Some(user) = user else {
        sessions.remove(&token);
        return Err(unauthenticated());
    };

    if user.is_active != 1 {
        sessions.remove(&token);
        return Err(unauthenticated());
    }

    let user: User = user.into();

    if !allowed.is_empty() && !allowed.iter().any(|role| *role == user.role) {
        return Err(forbidden());
    }

    Ok(user)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool() -> Result<DbPool, AppError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .map_err(AppError::from)?;

        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .map_err(|e| {
                AppError::new(
                    "TEST_MIGRATE_FAILED",
                    "فشل تشغيل migrations للاختبار",
                    &format!("Test migrations failed: {e}"),
                )
            })?;

        sqlx::query(
            "INSERT INTO users (id, name, username, password_hash, role, is_active) VALUES
             (1, 'Admin', 'admin', 'hash', 'admin', 1),
             (2, 'Cashier', 'cashier', 'hash', 'cashier', 1),
             (3, 'Gone', 'gone', 'hash', 'cashier', 0)",
        )
        .execute(&pool)
        .await?;

        Ok(pool)
    }

    fn store_with(token: &str, user_id: i64) -> SessionStore {
        let store = SessionStore::default();
        store.insert(token.to_owned(), user_id);
        store
    }

    #[tokio::test]
    async fn accepts_valid_token_with_allowed_role() {
        let pool = setup_pool().await.unwrap();
        let store = store_with("tok-admin", 1);

        let user = require_role(&store, &pool, Some("tok-admin".into()), ADMIN_ONLY)
            .await
            .unwrap();

        assert_eq!(user.id, 1);
        assert_eq!(user.role, "admin");
    }

    #[tokio::test]
    async fn any_role_accepts_every_authenticated_user() {
        let pool = setup_pool().await.unwrap();
        let store = store_with("tok-cashier", 2);

        let user = require_role(&store, &pool, Some("tok-cashier".into()), ANY_ROLE)
            .await
            .unwrap();

        assert_eq!(user.role, "cashier");
    }

    #[tokio::test]
    async fn rejects_missing_token() {
        let pool = setup_pool().await.unwrap();
        let store = SessionStore::default();

        let error = require_role(&store, &pool, None, ANY_ROLE).await.unwrap_err();
        assert_eq!(error.code, "UNAUTHENTICATED");
    }

    #[tokio::test]
    async fn rejects_unknown_token() {
        let pool = setup_pool().await.unwrap();
        let store = SessionStore::default();

        let error = require_role(&store, &pool, Some("forged".into()), ANY_ROLE)
            .await
            .unwrap_err();
        assert_eq!(error.code, "UNAUTHENTICATED");
    }

    #[tokio::test]
    async fn rejects_insufficient_role() {
        let pool = setup_pool().await.unwrap();
        let store = store_with("tok-cashier", 2);

        let error = require_role(&store, &pool, Some("tok-cashier".into()), ADMIN_ONLY)
            .await
            .unwrap_err();
        assert_eq!(error.code, "FORBIDDEN");
    }

    #[tokio::test]
    async fn rejects_and_evicts_deactivated_user() {
        let pool = setup_pool().await.unwrap();
        let store = store_with("tok-gone", 3);

        let error = require_role(&store, &pool, Some("tok-gone".into()), ANY_ROLE)
            .await
            .unwrap_err();

        assert_eq!(error.code, "UNAUTHENTICATED");
        assert!(store.user_id_for("tok-gone").is_none());
    }
}
