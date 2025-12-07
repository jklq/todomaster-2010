.PHONY: all build run dev test clean

# Variables
BINARY_NAME=taskmaster-backend
BUILD_DIR=bin
GO_FILES=$(shell find . -name '*.go' -type f)

# Default target
all: build

# Build the binary
build:
	@echo "Building..."
	@mkdir -p $(BUILD_DIR)
	@go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server

# Run the server
run: build
	@echo "Starting server..."
	@./$(BUILD_DIR)/$(BINARY_NAME)

# Run with live reload (requires air: go install github.com/cosmtrek/air@latest)
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Installing air for live reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -rf ./data

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	@go mod download
	@go mod tidy

# Generate go.sum
tidy:
	@go mod tidy
