package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin during development
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// WebSocketEvent represents an event broadcast to clients.
type WebSocketEvent struct {
	Type    string      `json:"type"`    // "task_created", "task_updated", "task_deleted", "tasks_reordered", etc.
	Payload interface{} `json:"payload"` // The relevant data
}

// Client represents a connected WebSocket client.
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	userID int64
	send   chan []byte
}

// Hub maintains the set of active clients and broadcasts messages to clients.
type Hub struct {
	// Registered clients grouped by userID
	clients map[int64]map[*Client]bool

	// Inbound messages from clients (not used for now)
	broadcast chan *broadcastMessage

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	mu sync.RWMutex
}

type broadcastMessage struct {
	userID  int64
	message []byte
}

// NewHub creates a new hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[int64]map[*Client]bool),
		broadcast:  make(chan *broadcastMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.userID] == nil {
				h.clients[client.userID] = make(map[*Client]bool)
			}
			h.clients[client.userID][client] = true
			h.mu.Unlock()
			slog.Info("ws client connected", "userID", client.userID)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.userID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.clients, client.userID)
					}
				}
			}
			h.mu.Unlock()
			slog.Info("ws client disconnected", "userID", client.userID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[msg.userID]
			h.mu.RUnlock()

			for client := range clients {
				select {
				case client.send <- msg.message:
				default:
					// Client's send buffer is full, close connection
					h.mu.Lock()
					delete(h.clients[msg.userID], client)
					close(client.send)
					h.mu.Unlock()
				}
			}
		}
	}
}

// BroadcastToUser sends a message to all connections for a specific user.
func (h *Hub) BroadcastToUser(userID int64, event WebSocketEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to marshal ws event", "error", err)
		return
	}

	h.broadcast <- &broadcastMessage{
		userID:  userID,
		message: data,
	}
}

// readPump pumps messages from the WebSocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("ws read error", "error", err)
			}
			break
		}
		// We don't process incoming messages for now, just keep connection alive
	}
}

// writePump pumps messages from the hub to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleWebSocket handles WebSocket connection requests.
func (h *Handler) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from query param (token validation)
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Validate token and get user ID
	userID, err := h.validateToken(tokenString)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}

	client := &Client{
		hub:    h.hub,
		conn:   conn,
		userID: userID,
		send:   make(chan []byte, 256),
	}

	h.hub.register <- client

	// Start read/write pumps in separate goroutines
	go client.writePump()
	go client.readPump()
}

// validateToken validates a JWT token and returns the user ID.
func (h *Handler) validateToken(tokenString string) (int64, error) {
	token, err := parseJWT(tokenString, h.jwtSecret)
	if err != nil {
		return 0, err
	}
	return token, nil
}
