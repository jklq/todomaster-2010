package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// Session represents an active user session.
type Session struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	TokenHash string    `json:"-"` // Never expose in JSON
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateSession creates a new session for a user.
// The token should be a secure random string - this function stores its hash.
func (db *DB) CreateSession(ctx context.Context, userID int64, token string, expiresAt time.Time) (*Session, error) {
	tokenHash := hashToken(token)

	result, err := db.ExecContext(ctx,
		`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get session id: %w", err)
	}

	return &Session{
		ID:        id,
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}, nil
}

// GetSessionByToken finds a session by its token (not hash).
// Returns ErrNotFound if the session doesn't exist or has expired.
func (db *DB) GetSessionByToken(ctx context.Context, token string) (*Session, error) {
	tokenHash := hashToken(token)

	session := &Session{}
	err := db.QueryRowContext(ctx,
		`SELECT id, user_id, token_hash, expires_at, created_at 
		 FROM sessions 
		 WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP`,
		tokenHash,
	).Scan(&session.ID, &session.UserID, &session.TokenHash, &session.ExpiresAt, &session.CreatedAt)

	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return session, nil
}

// DeleteSession deletes a session by token.
func (db *DB) DeleteSession(ctx context.Context, token string) error {
	tokenHash := hashToken(token)

	_, err := db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// DeleteUserSessions deletes all sessions for a user (logout everywhere).
func (db *DB) DeleteUserSessions(ctx context.Context, userID int64) error {
	_, err := db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ?`, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}
	return nil
}

// CleanupExpiredSessions removes all expired sessions from the database.
func (db *DB) CleanupExpiredSessions(ctx context.Context) (int64, error) {
	result, err := db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP`)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup sessions: %w", err)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get cleanup count: %w", err)
	}

	return count, nil
}

// hashToken creates a SHA-256 hash of a token for secure storage.
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
