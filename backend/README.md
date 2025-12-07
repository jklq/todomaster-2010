# TaskMaster 2010 Backend

A Go backend API for TaskMaster 2010, providing authentication and persistent storage using modernc.org/sqlite (pure Go SQLite implementation).

## Features

- **Authentication**: JWT-based access tokens + session-based refresh tokens
- **User Management**: Registration, login, profile updates, password changes
- **Task Management**: Full CRUD for tasks with tags and subtasks
- **SQLite Storage**: Pure Go SQLite using modernc.org/sqlite (no CGO required)

## Requirements

- Go 1.22+

## Quick Start

```bash
# Download dependencies
make deps

# Build and run
make run

# Or run with live reload (development)
make dev
```

## Environment Variables

| Variable        | Default                | Description                                           |
| --------------- | ---------------------- | ----------------------------------------------------- |
| `PORT`          | `8080`                 | Server port                                           |
| `DATABASE_PATH` | `./data/taskmaster.db` | SQLite database file path                             |
| `JWT_SECRET`    | `dev-secret-...`       | Secret for signing JWT tokens (change in production!) |

## API Endpoints

### Authentication

| Method | Endpoint             | Description                 |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/auth/register` | Register a new user         |
| POST   | `/api/auth/login`    | Login and get tokens        |
| POST   | `/api/auth/logout`   | Logout (invalidate session) |
| POST   | `/api/auth/refresh`  | Refresh access token        |

### User

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| GET    | `/api/user/me`       | Get current user profile     |
| PUT    | `/api/user/me`       | Update profile (displayName) |
| PUT    | `/api/user/password` | Change password              |
| DELETE | `/api/user/me`       | Delete account               |

### Tasks

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| GET    | `/api/tasks`         | Get all tasks     |
| POST   | `/api/tasks`         | Create a new task |
| GET    | `/api/tasks/{id}`    | Get a task by ID  |
| PUT    | `/api/tasks/{id}`    | Update a task     |
| DELETE | `/api/tasks/{id}`    | Delete a task     |
| POST   | `/api/tasks/reorder` | Reorder tasks     |

### Subtasks

| Method | Endpoint                       | Description      |
| ------ | ------------------------------ | ---------------- |
| POST   | `/api/tasks/{taskId}/subtasks` | Create a subtask |
| PUT    | `/api/subtasks/{id}`           | Update a subtask |
| DELETE | `/api/subtasks/{id}`           | Delete a subtask |

## Example Requests

### Register

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "displayName": "John"}'
```

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Create Task (with auth)

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"text": "Buy groceries", "tags": ["shopping", "urgent"]}'
```

### Update Task

```bash
curl -X PUT http://localhost:8080/api/tasks/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"completed": true}'
```

## Database Schema

The backend uses SQLite with the following tables:

- **users**: User accounts with email and password hash
- **sessions**: Refresh token sessions
- **tasks**: User tasks with text, status, and sort order
- **subtasks**: Subtasks belonging to tasks
- **tags**: Tag definitions
- **task_tags**: Many-to-many relationship between tasks and tags

## Project Structure

```
backend/
├── cmd/server/          # Main entry point
├── internal/
│   ├── api/             # HTTP handlers
│   │   ├── handler.go   # Router and middleware
│   │   ├── auth.go      # Auth handlers
│   │   ├── users.go     # User handlers
│   │   └── tasks.go     # Task handlers
│   └── database/        # Database layer
│       ├── database.go  # DB connection and migrations
│       ├── users.go     # User repository
│       ├── sessions.go  # Session repository
│       └── tasks.go     # Task repository
├── go.mod
├── Makefile
└── README.md
```
