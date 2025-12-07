package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/todomaster-2010/backend/internal/database"
)

// CreateListRequest is the request body for creating a list.
type CreateListRequest struct {
	Title string `json:"title"`
}

// UpdateListRequest is the request body for updating a list.
type UpdateListRequest struct {
	Title string `json:"title"`
}

// handleGetLists returns all lists for the current user.
func (h *Handler) handleGetLists(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	lists, err := h.db.GetLists(r.Context(), userID)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to get lists")
		return
	}

	// Return empty array instead of null
	if lists == nil {
		lists = []*database.List{}
	}

	h.jsonResponse(w, http.StatusOK, lists)
}

// handleCreateList creates a new list.
func (h *Handler) handleCreateList(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	var req CreateListRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		h.errorResponse(w, http.StatusBadRequest, "title is required")
		return
	}

	list, err := h.db.CreateList(r.Context(), userID, req.Title)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to create list")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "list_created",
		Payload: list,
	})

	h.jsonResponse(w, http.StatusCreated, list)
}

// handleUpdateList updates a list's title.
func (h *Handler) handleUpdateList(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	listID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid list id")
		return
	}

	var req UpdateListRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		h.errorResponse(w, http.StatusBadRequest, "title is required")
		return
	}

	list, err := h.db.UpdateList(r.Context(), userID, listID, req.Title)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "list not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to update list")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "list_updated",
		Payload: list,
	})

	h.jsonResponse(w, http.StatusOK, list)
}

// handleDeleteList deletes a list.
func (h *Handler) handleDeleteList(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	listID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid list id")
		return
	}

	if err := h.db.DeleteList(r.Context(), userID, listID); err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "list not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to delete list")
		return
	}

	// Broadcast to other sessions
	h.hub.BroadcastToUser(userID, WebSocketEvent{
		Type:    "list_deleted",
		Payload: map[string]int64{"id": listID},
	})

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "list deleted successfully",
	})
}
