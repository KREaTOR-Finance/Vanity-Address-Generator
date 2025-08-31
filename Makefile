SHELL := /bin/sh

up:
	docker compose up -d --build

logs:
	docker compose logs -f --tail=200

down:
	docker compose down

migrate:
	@echo "Apply Supabase SQL locally or via psql"

seed:
	@echo "No seeds defined"

