package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrNotFound is returned when a requested resource doesn't exist.
var ErrNotFound = errors.New("resource not found")

// ErrDuplicateEmail is returned when trying to create a user with an existing email.
var ErrDuplicateEmail = errors.New("email already exists")

// User represents a registered user.
type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // Never expose password hash in JSON
	DisplayName  string    `json:"displayName,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateUser creates a new user with the given email and password hash.
func (db *DB) CreateUser(ctx context.Context, email, passwordHash, displayName string) (*User, error) {
	result, err := db.ExecContext(ctx,
		`INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)`,
		email, passwordHash, displayName,
	)
	if err != nil {
		// Check for unique constraint violation
		if isConstraintError(err) {
			return nil, ErrDuplicateEmail
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get user id: %w", err)
	}

	return db.GetUserByID(ctx, id)
}

// GetUserByID retrieves a user by their ID.
func (db *DB) GetUserByID(ctx context.Context, id int64) (*User, error) {
	user := &User{}
	err := db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, COALESCE(display_name, ''), created_at, updated_at 
		 FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// GetUserByEmail retrieves a user by their email address.
func (db *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{}
	err := db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, COALESCE(display_name, ''), created_at, updated_at 
		 FROM users WHERE email = ?`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// UpdateUser updates a user's profile information.
func (db *DB) UpdateUser(ctx context.Context, id int64, displayName string) (*User, error) {
	_, err := db.ExecContext(ctx,
		`UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		displayName, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return db.GetUserByID(ctx, id)
}

// UpdateUserPassword updates a user's password.
func (db *DB) UpdateUserPassword(ctx context.Context, id int64, newPasswordHash string) error {
	_, err := db.ExecContext(ctx,
		`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		newPasswordHash, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	return nil
}

// DeleteUser deletes a user and all their associated data.
func (db *DB) DeleteUser(ctx context.Context, id int64) error {
	result, err := db.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check deletion result: %w", err)
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// isConstraintError checks if an error is a unique constraint violation.
func isConstraintError(err error) bool {
	// modernc/sqlite uses error strings for constraint violations
	return err != nil && (contains(err.Error(), "UNIQUE constraint failed") ||
		contains(err.Error(), "constraint failed"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr))
}

func containsAt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
