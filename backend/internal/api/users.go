package api

import (
	"errors"
	"net/http"

	"github.com/todomaster-2010/backend/internal/database"
	"golang.org/x/crypto/bcrypt"
)

// UpdateUserRequest is the request body for updating user profile.
type UpdateUserRequest struct {
	DisplayName string `json:"displayName"`
}

// ChangePasswordRequest is the request body for changing password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// handleGetMe returns the current user's profile.
func (h *Handler) handleGetMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	user, err := h.db.GetUserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "user not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to get user")
		return
	}

	h.jsonResponse(w, http.StatusOK, user)
}

// handleUpdateMe updates the current user's profile.
func (h *Handler) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	var req UpdateUserRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.db.UpdateUser(r.Context(), userID, req.DisplayName)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "user not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	h.jsonResponse(w, http.StatusOK, user)
}

// handleChangePassword changes the current user's password.
func (h *Handler) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	var req ChangePasswordRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.NewPassword) < 8 {
		h.errorResponse(w, http.StatusBadRequest, "new password must be at least 8 characters")
		return
	}

	// Get current user
	user, err := h.db.GetUserByID(r.Context(), userID)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to get user")
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		h.errorResponse(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	// Hash new password
	newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	// Update password
	if err := h.db.UpdateUserPassword(r.Context(), userID, string(newPasswordHash)); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	// Invalidate all sessions
	_ = h.db.DeleteUserSessions(r.Context(), userID)

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "password changed successfully",
	})
}

// handleDeleteMe deletes the current user's account.
func (h *Handler) handleDeleteMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(int64)

	if err := h.db.DeleteUser(r.Context(), userID); err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusNotFound, "user not found")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to delete user")
		return
	}

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "account deleted successfully",
	})
}
