.PHONY: help docker-build

FRONTEND_IMAGE ?= nexus-studio-prod-frontend
VITE_API_ORIGIN ?=

help:
	@echo "生产镜像:"
	@echo "  make docker-build              构建 frontend 镜像（同域 /api）"
	@echo "  make docker-build VITE_API_ORIGIN=https://api.example.com"

docker-build:
	docker build \
		$(if $(VITE_API_ORIGIN),--build-arg VITE_API_ORIGIN=$(VITE_API_ORIGIN),) \
		-t $(FRONTEND_IMAGE) .
