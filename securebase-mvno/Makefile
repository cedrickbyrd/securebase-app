.PHONY: build test lint validate-iac up down

build:
	@echo "==> Building CoreLink MCP Server..."
	cd services/corelink-mcp-server && go build -o ../../bin/corelink-mcp-server .

test:
	@echo "==> Running unit tests..."
	cd services/corelink-mcp-server && go test -v ./...

validate-iac:
	@echo "==> Running shift-left compliance check via securebase-mcp..."
	./scripts/simulate-drift-quarantine.sh

up:
	docker-compose up -d

down:
	docker-compose down
