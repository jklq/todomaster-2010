package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/todomaster-2010/backend/internal/database"
)

// CreateTaskRequest is the request body for creating a task.
type CreateTaskRequest struct {
	Text      string   `json:"text"`
	Tags      []string `json:"tags,omitempty"`
	Important bool     `json:"important,omitempty"`
	Completed bool     `json:"completed,omitempty"`
	ListID    *int64   `json:"listId,omitempty"`
}

// ReorderTasksRequest is the request body for reordering tasks.
type ReorderTasksRequest struct {
	TaskIDs []int64 `json:"taskIds"`
}

// CreateSubtaskRequest is the request body for creating a subtask.
type CreateSubtaskRequest struct {
	Text string `json:"text"`
}

// handleGetTasks returns all tasks for the current user.
func (h *Handler) handleGetTasks(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	tasks, err := h.db.GetUserTasks(r.Context(), userID)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to get tasks")
		return
	}

	// Return empty array instead of null
	if tasks == nil {
		tasks = []*database.Task{}
	}

	h.jsonResponse(w, http.StatusOK, tasks)
}

// handleCreateTask creates a new task.
func (h *Handler) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	var req CreateTaskRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Text == "" {
		h.errorResponse(w, http.StatusBadRequest, "text is required")
		return
	}

	task, err := h.db.CreateTask(r.Context(), userID, req.ListID, req.Text, req.Tags, req.Important, req.Completed)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "task_created",
		Payload: task,
	})

	h.jsonResponse(w, http.StatusCreated, task)
}

// handleGetTask returns a single task.
func (h *Handler) handleGetTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	taskID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid task id")
		return
	}

	task, err := h.db.GetTask(r.Context(), userID, taskID)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "task not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to get task")
		return
	}

	h.jsonResponse(w, http.StatusOK, task)
}

// handleUpdateTask updates a task.
func (h *Handler) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	taskID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var updates map[string]interface{}
	if err := h.decodeJSON(r, &updates); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.db.UpdateTask(r.Context(), userID, taskID, updates)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "task not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to update task")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "task_updated",
		Payload: task,
	})

	h.jsonResponse(w, http.StatusOK, task)
}

// handleDeleteTask deletes a task.
func (h *Handler) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	taskID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid task id")
		return
	}

	if err := h.db.DeleteTask(r.Context(), userID, taskID); err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "task not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to delete task")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "task_deleted",
		Payload: map[string]int64{"id": taskID},
	})

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "task deleted successfully",
	})
}

// handleReorderTasks reorders tasks.
func (h *Handler) handleReorderTasks(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	var req ReorderTasksRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.db.ReorderTasks(r.Context(), userID, req.TaskIDs); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to reorder tasks")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "tasks_reordered",
		Payload: map[string][]int64{"taskIds": req.TaskIDs},
	})

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "tasks reordered successfully",
	})
}

// handleCreateSubtask creates a new subtask.
func (h *Handler) handleCreateSubtask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	taskID, err := strconv.ParseInt(r.PathValue("taskId"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var req CreateSubtaskRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Text == "" {
		h.errorResponse(w, http.StatusBadRequest, "text is required")
		return
	}

	subtask, err := h.db.CreateSubtask(r.Context(), userID, taskID, req.Text)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "task not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to create subtask")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "subtask_created",
		Payload: subtask,
	})

	h.jsonResponse(w, http.StatusCreated, subtask)
}

// handleUpdateSubtask updates a subtask.
func (h *Handler) handleUpdateSubtask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	subtaskID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid subtask id")
		return
	}

	var updates map[string]interface{}
	if err := h.decodeJSON(r, &updates); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	subtask, err := h.db.UpdateSubtask(r.Context(), userID, subtaskID, updates)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "subtask not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to update subtask")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "subtask_updated",
		Payload: subtask,
	})

	h.jsonResponse(w, http.StatusOK, subtask)
}

// handleDeleteSubtask deletes a subtask.
func (h *Handler) handleDeleteSubtask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	subtaskID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid subtask id")
		return
	}

	if err := h.db.DeleteSubtask(r.Context(), userID, subtaskID); err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "subtask not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to delete subtask")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "subtask_deleted",
		Payload: map[string]int64{"id": subtaskID},
	})

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "subtask deleted successfully",
	})
}
