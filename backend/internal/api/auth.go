package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/todomaster-2010/backend/internal/database"
	"golang.org/x/crypto/bcrypt"
)

// Context key for user ID
type contextKey string

const userIDKey contextKey = "userID"

// Token expiration times
const (
	accessTokenExpiry  = 15 * time.Minute
	refreshTokenExpiry = 7 * 24 * time.Hour
)

// RegisterRequest is the request body for user registration.
type RegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName,omitempty"`
}

// LoginRequest is the request body for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse is the response for successful authentication.
type AuthResponse struct {
	User         *database.User `json:"user"`
	AccessToken  string         `json:"accessToken"`
	RefreshToken string         `json:"refreshToken"`
	ExpiresAt    time.Time      `json:"expiresAt"`
}

// handleRegister handles user registration.
func (h *Handler) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate input
	if req.Email == "" {
		h.errorResponse(w, http.StatusBadRequest, "email is required")
		return
	}
	if len(req.Password) < 8 {
		h.errorResponse(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	// Create user
	user, err := h.db.CreateUser(r.Context(), req.Email, string(passwordHash), req.DisplayName)
	if err != nil {
		if errors.Is(err, database.ErrDuplicateEmail) {
			h.errorResponse(w, http.StatusConflict, "email already registered")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	// Generate tokens
	authResp, err := h.generateAuthResponse(r.Context(), user)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	h.jsonResponse(w, http.StatusCreated, authResp)
}

// handleLogin handles user login.
func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get user by email
	user, err := h.db.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, database.ErrNotFound) {
			h.errorResponse(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		h.errorResponse(w, http.StatusInternalServerError, "failed to authenticate")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		h.errorResponse(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	// Generate tokens
	authResp, err := h.generateAuthResponse(r.Context(), user)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	h.jsonResponse(w, http.StatusOK, authResp)
}

// handleLogout handles user logout.
func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := getAuthToken(r)
	if token != "" {
		// Delete session (ignore errors - logout should always succeed)
		_ = h.db.DeleteSession(r.Context(), token)
	}

	h.jsonResponse(w, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
}

// RefreshRequest is the request body for token refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// handleRefresh handles token refresh using the refresh token.
func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := h.decodeJSON(r, &req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		h.errorResponse(w, http.StatusBadRequest, "refresh token is required")
		return
	}

	// Validate refresh token against database
	session, err := h.db.GetSessionByToken(r.Context(), req.RefreshToken)
	if err != nil {
		h.errorResponse(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	// Get user
	user, err := h.db.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		h.errorResponse(w, http.StatusUnauthorized, "user not found")
		return
	}

	// Delete old session (rotating refresh tokens for security)
	_ = h.db.DeleteSession(r.Context(), req.RefreshToken)

	// Generate new tokens
	authResp, err := h.generateAuthResponse(r.Context(), user)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	h.jsonResponse(w, http.StatusOK, authResp)
}

// generateAuthResponse creates JWT access token and refresh token session.
func (h *Handler) generateAuthResponse(ctx context.Context, user *database.User) (*AuthResponse, error) {
	expiresAt := time.Now().Add(accessTokenExpiry)

	// Generate JWT access token
	claims := jwt.MapClaims{
		"sub": user.ID,
		"exp": expiresAt.Unix(),
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return nil, err
	}

	// Generate refresh token (random string stored in DB)
	refreshBytes := make([]byte, 32)
	if _, err := rand.Read(refreshBytes); err != nil {
		return nil, err
	}
	refreshToken := base64.URLEncoding.EncodeToString(refreshBytes)

	// Store refresh token session
	_, err = h.db.CreateSession(ctx, user.ID, refreshToken, time.Now().Add(refreshTokenExpiry))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

// requireAuth is middleware that requires a valid JWT token.
func (h *Handler) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString := getAuthToken(r)
		if tokenString == "" {
			h.errorResponse(w, http.StatusUnauthorized, "authorization required")
			return
		}

		// Parse and validate JWT
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("invalid signing method")
			}
			return []byte(h.jwtSecret), nil
		})

		if err != nil || !token.Valid {
			h.errorResponse(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			h.errorResponse(w, http.StatusUnauthorized, "invalid token claims")
			return
		}

		userIDFloat, ok := claims["sub"].(float64)
		if !ok {
			h.errorResponse(w, http.StatusUnauthorized, "invalid user id in token")
			return
		}

		userID := int64(userIDFloat)

		// Add user ID to context
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}
