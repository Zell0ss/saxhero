.PHONY: build deploy dev dev-back test lint status start stop restart logs

# Build frontend and deploy to production
build:
	cd frontend && npm run build

deploy: build
	sudo systemctl restart saxhero.service

# Dev servers (run separately in two terminals)
dev:
	cd frontend && npm run dev

dev-back:
	cd backend && source .venv/bin/activate && uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Backend tests
test:
	cd backend && .venv/bin/pytest

# Frontend lint
lint:
	cd frontend && npm run lint

# Service management
status:
	sudo systemctl status saxhero.service

start:
	sudo systemctl start saxhero.service

stop:
	sudo systemctl stop saxhero.service

restart:
	sudo systemctl restart saxhero.service

# Live logs
logs:
	journalctl -u saxhero.service -f
