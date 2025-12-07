package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Task represents a task item.
type Task struct {
	ID         int64      `json:"id"`
	UserID     int64      `json:"userId"`
	ListID     *int64     `json:"listId"`
	Text       string     `json:"text"`
	Completed  bool       `json:"completed"`
	Important  bool       `json:"important"`
	IsExpanded bool       `json:"isExpanded"`
	SortOrder  int        `json:"sortOrder"`
	Tags       []string   `json:"tags,omitempty"`
	Subtasks   []*Subtask `json:"subtasks,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// Subtask represents a subtask within a task.
type Subtask struct {
	ID        int64     `json:"id"`
	TaskID    int64     `json:"taskId"`
	Text      string    `json:"text"`
	Completed bool      `json:"completed"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateTask creates a new task for a user.
func (db *DB) CreateTask(ctx context.Context, userID int64, listID *int64, text string, tags []string, important, completed bool) (*Task, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get the next sort order
	var maxOrder sql.NullInt64
	err = tx.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM tasks WHERE user_id = ?`,
		userID,
	).Scan(&maxOrder)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get max sort order: %w", err)
	}

	sortOrder := int(maxOrder.Int64) + 1

	result, err := tx.ExecContext(ctx,
		`INSERT INTO tasks (user_id, list_id, text, sort_order, important, completed) VALUES (?, ?, ?, ?, ?, ?)`,
		userID, listID, text, sortOrder, important, completed,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	taskID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get task id: %w", err)
	}

	// Add tags
	if err := addTagsToTaskTx(ctx, tx, taskID, tags); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return db.GetTask(ctx, userID, taskID)
}

// GetTask retrieves a single task by ID for a specific user.
func (db *DB) GetTask(ctx context.Context, userID, taskID int64) (*Task, error) {
	task := &Task{}
	err := db.QueryRowContext(ctx,
		`SELECT id, user_id, list_id, text, completed, important, is_expanded, sort_order, created_at, updated_at 
		 FROM tasks WHERE id = ? AND user_id = ?`,
		taskID, userID,
	).Scan(&task.ID, &task.UserID, &task.ListID, &task.Text, &task.Completed, &task.Important,
		&task.IsExpanded, &task.SortOrder, &task.CreatedAt, &task.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Load tags
	tags, err := db.getTaskTags(ctx, taskID)
	if err != nil {
		return nil, err
	}
	task.Tags = tags

	// Load subtasks
	subtasks, err := db.GetSubtasks(ctx, taskID)
	if err != nil {
		return nil, err
	}
	task.Subtasks = subtasks

	return task, nil
}

// GetUserTasks retrieves all tasks for a user.
func (db *DB) GetUserTasks(ctx context.Context, userID int64) ([]*Task, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, user_id, list_id, text, completed, important, is_expanded, sort_order, created_at, updated_at 
		 FROM tasks WHERE user_id = ? ORDER BY sort_order ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		task := &Task{}
		err := rows.Scan(&task.ID, &task.UserID, &task.ListID, &task.Text, &task.Completed, &task.Important,
			&task.IsExpanded, &task.SortOrder, &task.CreatedAt, &task.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}
		tasks = append(tasks, task)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tasks: %w", err)
	}

	// Load tags and subtasks for each task
	for _, task := range tasks {
		tags, err := db.getTaskTags(ctx, task.ID)
		if err != nil {
			return nil, err
		}
		task.Tags = tags

		subtasks, err := db.GetSubtasks(ctx, task.ID)
		if err != nil {
			return nil, err
		}
		task.Subtasks = subtasks
	}

	return tasks, nil
}

// UpdateTask updates a task's properties.
func (db *DB) UpdateTask(ctx context.Context, userID, taskID int64, updates map[string]interface{}) (*Task, error) {
	// Build dynamic update query
	setClause := "updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}

	if text, ok := updates["text"].(string); ok {
		setClause += ", text = ?"
		args = append(args, text)
	}
	if completed, ok := updates["completed"].(bool); ok {
		setClause += ", completed = ?"
		args = append(args, completed)
	}
	if important, ok := updates["important"].(bool); ok {
		setClause += ", important = ?"
		args = append(args, important)
	}
	if isExpanded, ok := updates["isExpanded"].(bool); ok {
		setClause += ", is_expanded = ?"
		args = append(args, isExpanded)
	}
	if sortOrder, ok := updates["sortOrder"].(float64); ok {
		setClause += ", sort_order = ?"
		args = append(args, int(sortOrder))
	}
	if listID, ok := updates["listId"]; ok {
		setClause += ", list_id = ?"
		// Handle null/nil for removing from list
		if listID == nil {
			args = append(args, nil)
		} else {
			// Ensure it's treated as float64 (JSON number) or int64
			if v, ok := listID.(float64); ok {
				args = append(args, int64(v))
			} else if v, ok := listID.(int64); ok {
				args = append(args, v)
			} else {
				args = append(args, nil) // Fallback
			}
		}
	}

	args = append(args, taskID, userID)

	result, err := db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE tasks SET %s WHERE id = ? AND user_id = ?`, setClause),
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, ErrNotFound
	}

	// Handle tags update if provided
	if tags, ok := updates["tags"].([]interface{}); ok {
		tagStrings := make([]string, len(tags))
		for i, t := range tags {
			tagStrings[i] = t.(string)
		}
		if err := db.setTaskTags(ctx, taskID, tagStrings); err != nil {
			return nil, err
		}
	}

	return db.GetTask(ctx, userID, taskID)
}

// DeleteTask deletes a task.
func (db *DB) DeleteTask(ctx context.Context, userID, taskID int64) error {
	result, err := db.ExecContext(ctx,
		`DELETE FROM tasks WHERE id = ? AND user_id = ?`,
		taskID, userID,
	)
	if err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// ReorderTasks updates the sort order of tasks.
func (db *DB) ReorderTasks(ctx context.Context, userID int64, taskIDs []int64) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for i, taskID := range taskIDs {
		_, err := tx.ExecContext(ctx,
			`UPDATE tasks SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
			 WHERE id = ? AND user_id = ?`,
			i, taskID, userID,
		)
		if err != nil {
			return fmt.Errorf("failed to update sort order: %w", err)
		}
	}

	return tx.Commit()
}

// getTaskTags retrieves all tags for a task.
func (db *DB) getTaskTags(ctx context.Context, taskID int64) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT t.name FROM tags t
		 JOIN task_tags tt ON t.id = tt.tag_id
		 WHERE tt.task_id = ?`,
		taskID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, tag)
	}

	return tags, rows.Err()
}

// setTaskTags replaces all tags for a task.
func (db *DB) setTaskTags(ctx context.Context, taskID int64, tags []string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing tags
	_, err = tx.ExecContext(ctx, `DELETE FROM task_tags WHERE task_id = ?`, taskID)
	if err != nil {
		return fmt.Errorf("failed to remove existing tags: %w", err)
	}

	// Add new tags
	if err := addTagsToTaskTx(ctx, tx, taskID, tags); err != nil {
		return err
	}

	return tx.Commit()
}

// addTagsToTaskTx adds tags to a task within a transaction.
func addTagsToTaskTx(ctx context.Context, tx *sql.Tx, taskID int64, tags []string) error {
	for _, tag := range tags {
		// Upsert tag
		_, err := tx.ExecContext(ctx,
			`INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING`,
			tag,
		)
		if err != nil {
			return fmt.Errorf("failed to insert tag: %w", err)
		}

		// Get tag ID
		var tagID int64
		err = tx.QueryRowContext(ctx, `SELECT id FROM tags WHERE name = ?`, tag).Scan(&tagID)
		if err != nil {
			return fmt.Errorf("failed to get tag id: %w", err)
		}

		// Link tag to task
		_, err = tx.ExecContext(ctx,
			`INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			taskID, tagID,
		)
		if err != nil {
			return fmt.Errorf("failed to link tag to task: %w", err)
		}
	}

	return nil
}

// --- Subtask operations ---

// CreateSubtask creates a new subtask for a task.
func (db *DB) CreateSubtask(ctx context.Context, userID, taskID int64, text string) (*Subtask, error) {
	// Verify task ownership
	var ownerID int64
	err := db.QueryRowContext(ctx, `SELECT user_id FROM tasks WHERE id = ?`, taskID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify task ownership: %w", err)
	}
	if ownerID != userID {
		return nil, ErrNotFound
	}

	// Get the next sort order
	var maxOrder sql.NullInt64
	err = db.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM subtasks WHERE task_id = ?`,
		taskID,
	).Scan(&maxOrder)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get max sort order: %w", err)
	}

	sortOrder := int(maxOrder.Int64) + 1

	result, err := db.ExecContext(ctx,
		`INSERT INTO subtasks (task_id, text, sort_order) VALUES (?, ?, ?)`,
		taskID, text, sortOrder,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create subtask: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get subtask id: %w", err)
	}

	return &Subtask{
		ID:        id,
		TaskID:    taskID,
		Text:      text,
		Completed: false,
		SortOrder: sortOrder,
		CreatedAt: time.Now(),
	}, nil
}

// GetSubtasks retrieves all subtasks for a task.
func (db *DB) GetSubtasks(ctx context.Context, taskID int64) ([]*Subtask, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, task_id, text, completed, sort_order, created_at 
		 FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC`,
		taskID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query subtasks: %w", err)
	}
	defer rows.Close()

	var subtasks []*Subtask
	for rows.Next() {
		subtask := &Subtask{}
		err := rows.Scan(&subtask.ID, &subtask.TaskID, &subtask.Text,
			&subtask.Completed, &subtask.SortOrder, &subtask.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan subtask: %w", err)
		}
		subtasks = append(subtasks, subtask)
	}

	return subtasks, rows.Err()
}

// UpdateSubtask updates a subtask's properties.
func (db *DB) UpdateSubtask(ctx context.Context, userID, subtaskID int64, updates map[string]interface{}) (*Subtask, error) {
	// Verify ownership through task
	var ownerID int64
	err := db.QueryRowContext(ctx,
		`SELECT t.user_id FROM tasks t
		 JOIN subtasks s ON s.task_id = t.id
		 WHERE s.id = ?`,
		subtaskID,
	).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify ownership: %w", err)
	}
	if ownerID != userID {
		return nil, ErrNotFound
	}

	// Build dynamic update
	setClause := ""
	args := []interface{}{}

	if text, ok := updates["text"].(string); ok {
		if setClause != "" {
			setClause += ", "
		}
		setClause += "text = ?"
		args = append(args, text)
	}
	if completed, ok := updates["completed"].(bool); ok {
		if setClause != "" {
			setClause += ", "
		}
		setClause += "completed = ?"
		args = append(args, completed)
	}

	if setClause == "" {
		return nil, fmt.Errorf("no valid updates provided")
	}

	args = append(args, subtaskID)

	_, err = db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE subtasks SET %s WHERE id = ?`, setClause),
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update subtask: %w", err)
	}

	// Return updated subtask
	subtask := &Subtask{}
	err = db.QueryRowContext(ctx,
		`SELECT id, task_id, text, completed, sort_order, created_at FROM subtasks WHERE id = ?`,
		subtaskID,
	).Scan(&subtask.ID, &subtask.TaskID, &subtask.Text, &subtask.Completed, &subtask.SortOrder, &subtask.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated subtask: %w", err)
	}

	return subtask, nil
}

// DeleteSubtask deletes a subtask.
func (db *DB) DeleteSubtask(ctx context.Context, userID, subtaskID int64) error {
	// Verify ownership
	var ownerID int64
	err := db.QueryRowContext(ctx,
		`SELECT t.user_id FROM tasks t
		 JOIN subtasks s ON s.task_id = t.id
		 WHERE s.id = ?`,
		subtaskID,
	).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to verify ownership: %w", err)
	}
	if ownerID != userID {
		return ErrNotFound
	}

	_, err = db.ExecContext(ctx, `DELETE FROM subtasks WHERE id = ?`, subtaskID)
	if err != nil {
		return fmt.Errorf("failed to delete subtask: %w", err)
	}

	return nil
}
