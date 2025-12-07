package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/todomaster-2010/backend/internal/database"
)

// Handler provides HTTP handlers for the API.
type Handler struct {
	db        *database.DB
	jwtSecret string
	mux       *http.ServeMux
	hub       *Hub
}

// New creates a new API handler with all routes configured.
func New(db *database.DB, jwtSecret string) http.Handler {
	hub := NewHub()
	go hub.Run()

	h := &Handler{
		db:        db,
		jwtSecret: jwtSecret,
		mux:       http.NewServeMux(),
		hub:       hub,
	}

	// Register routes
	h.registerRoutes()

	// Wrap with middleware
	return h.corsMiddleware(h.loggingMiddleware(h.mux))
}

// registerRoutes sets up all API endpoints.
func (h *Handler) registerRoutes() {
	// Health check
	h.mux.HandleFunc("GET /health", h.handleHealth)

	// Auth endpoints (public)
	h.mux.HandleFunc("POST /api/auth/register", h.handleRegister)
	h.mux.HandleFunc("POST /api/auth/login", h.handleLogin)
	h.mux.HandleFunc("POST /api/auth/logout", h.requireAuth(h.handleLogout))
	h.mux.HandleFunc("POST /api/auth/refresh", h.requireAuth(h.handleRefresh))

	// User endpoints (protected)
	h.mux.HandleFunc("GET /api/user/me", h.requireAuth(h.handleGetMe))
	h.mux.HandleFunc("PUT /api/user/me", h.requireAuth(h.handleUpdateMe))
	h.mux.HandleFunc("PUT /api/user/password", h.requireAuth(h.handleChangePassword))
	h.mux.HandleFunc("DELETE /api/user/me", h.requireAuth(h.handleDeleteMe))

	// Task endpoints (protected)
	h.mux.HandleFunc("GET /api/tasks", h.requireAuth(h.handleGetTasks))
	h.mux.HandleFunc("POST /api/tasks", h.requireAuth(h.handleCreateTask))
	h.mux.HandleFunc("GET /api/tasks/{id}", h.requireAuth(h.handleGetTask))
	h.mux.HandleFunc("PUT /api/tasks/{id}", h.requireAuth(h.handleUpdateTask))
	h.mux.HandleFunc("DELETE /api/tasks/{id}", h.requireAuth(h.handleDeleteTask))
	h.mux.HandleFunc("POST /api/tasks/reorder", h.requireAuth(h.handleReorderTasks))

	// Subtask endpoints (protected)
	h.mux.HandleFunc("POST /api/tasks/{taskId}/subtasks", h.requireAuth(h.handleCreateSubtask))
	h.mux.HandleFunc("PUT /api/subtasks/{id}", h.requireAuth(h.handleUpdateSubtask))
	h.mux.HandleFunc("DELETE /api/subtasks/{id}", h.requireAuth(h.handleDeleteSubtask))

	// List endpoints (protected)
	h.mux.HandleFunc("GET /api/lists", h.requireAuth(h.handleGetLists))
	h.mux.HandleFunc("POST /api/lists", h.requireAuth(h.handleCreateList))
	h.mux.HandleFunc("PUT /api/lists/{id}", h.requireAuth(h.handleUpdateList))
	h.mux.HandleFunc("DELETE /api/lists/{id}", h.requireAuth(h.handleDeleteList))

	// WebSocket endpoint (authentication via query param)
	h.mux.HandleFunc("GET /ws", h.handleWebSocket)
}

// corsMiddleware adds CORS headers for frontend access.
func (h *Handler) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow requests from common frontend origins
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware logs all incoming requests.
func (h *Handler) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"remote", r.RemoteAddr,
		)
		next.ServeHTTP(w, r)
	})
}

// handleHealth returns a simple health check response.
func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	h.jsonResponse(w, http.StatusOK, map[string]string{
		"status": "healthy",
	})
}

// --- Utility methods ---

// jsonResponse writes a JSON response with the given status code.
func (h *Handler) jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		if err := json.NewEncoder(w).Encode(data); err != nil {
			slog.Error("failed to encode response", "error", err)
		}
	}
}

// errorResponse writes a JSON error response.
func (h *Handler) errorResponse(w http.ResponseWriter, status int, message string) {
	h.jsonResponse(w, status, map[string]string{
		"error": message,
	})
}

// decodeJSON decodes a JSON request body into the given value.
func (h *Handler) decodeJSON(r *http.Request, v interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}

// getAuthToken extracts the bearer token from the Authorization header.
func getAuthToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}

	parts := strings.Split(auth, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

// parseJWT parses a JWT token and returns the user ID.
func parseJWT(tokenString, jwtSecret string) (int64, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return 0, errors.New("invalid or expired token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid token claims")
	}

	userIDFloat, ok := claims["sub"].(float64)
	if !ok {
		return 0, errors.New("invalid user id in token")
	}

	return int64(userIDFloat), nil
}
