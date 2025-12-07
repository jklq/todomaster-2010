package database

import (
	"context"
	"fmt"
	"time"
)

// List represents a user-created list of tasks.
type List struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateList creates a new list.
func (db *DB) CreateList(ctx context.Context, userID int64, title string) (*List, error) {
	result, err := db.ExecContext(ctx,
		`INSERT INTO lists (user_id, title) VALUES (?, ?)`,
		userID, title,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create list: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get list id: %w", err)
	}

	return &List{
		ID:        id,
		UserID:    userID,
		Title:     title,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

// GetLists retrieves all lists for a user.
func (db *DB) GetLists(ctx context.Context, userID int64) ([]*List, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, user_id, title, created_at, updated_at FROM lists WHERE user_id = ? ORDER BY title ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query lists: %w", err)
	}
	defer rows.Close()

	var lists []*List
	for rows.Next() {
		list := &List{}
		if err := rows.Scan(&list.ID, &list.UserID, &list.Title, &list.CreatedAt, &list.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan list: %w", err)
		}
		lists = append(lists, list)
	}

	return lists, rows.Err()
}

// UpdateList updates a list's title.
func (db *DB) UpdateList(ctx context.Context, userID, listID int64, title string) (*List, error) {
	result, err := db.ExecContext(ctx,
		`UPDATE lists SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
		title, listID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update list: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, ErrNotFound
	}

	return &List{
		ID:        listID,
		UserID:    userID,
		Title:     title,
		UpdatedAt: time.Now(), // Approx
	}, nil
}

// DeleteList deletes a list and (optionally) its tasks or unassigns them.
// For now, we will CASCADE delete tasks via FK constraint if simpler, or just delete list.
// The schema should probably handle CASCADE.
func (db *DB) DeleteList(ctx context.Context, userID, listID int64) error {
	result, err := db.ExecContext(ctx, `DELETE FROM lists WHERE id = ? AND user_id = ?`, listID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete list: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
