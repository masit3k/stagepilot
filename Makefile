SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -euo pipefail -c

ICON_SVG ?= packages/desktop/assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg
ICON_NAME ?= $(basename $(notdir $(ICON_SVG)))
ICON_DIST_DIR ?= dist-icons/$(ICON_NAME)

PNG_DIR := $(ICON_DIST_DIR)/png
PNG_SIZES := 16 32 48 64 128 256 512
PNG_FILES := $(foreach size,$(PNG_SIZES),$(PNG_DIR)/$(ICON_NAME)-$(size).png)

ICO_FILE := $(ICON_DIST_DIR)/$(ICON_NAME).ico
ICNS_FILE := $(ICON_DIST_DIR)/$(ICON_NAME).icns

UNAME_S := $(shell uname -s)
ICONUTIL := $(shell command -v iconutil 2>/dev/null || echo "")
# Prefer ImageMagick v7 command name "magick", fallback to "convert" (common on Linux).
IM_CMD := $(shell command -v magick 2>/dev/null || command -v convert 2>/dev/null || echo "")

.DEFAULT_GOAL := icons

.PHONY: icons png ico icns clean tools

icons: tools png ico icns
	@echo "✅ Icon export pipeline finished for $(ICON_NAME)"

tools:
	@command -v inkscape >/dev/null 2>&1 || { \
		echo "❌ inkscape not found. Install inkscape to export PNG files."; \
		exit 1; \
	}
	@echo "✅ inkscape found"

	@if [ -n "$(IM_CMD)" ]; then \
		echo "✅ ImageMagick found ($(IM_CMD)) (ICO enabled)"; \
	else \
		echo "ℹ️  ImageMagick not found (ICO skipped)"; \
	fi

	@if [ "$(UNAME_S)" = "Darwin" ]; then \
		if [ -n "$(ICONUTIL)" ]; then \
			echo "✅ iconutil found (ICNS enabled)"; \
		else \
			echo "ℹ️  iconutil not found (ICNS skipped)"; \
		fi; \
	else \
		echo "ℹ️  Not macOS (ICNS skipped)"; \
	fi

$(PNG_DIR):
	@mkdir -p "$@"

png: $(PNG_FILES)
	@echo "✅ PNG exports are ready in $(PNG_DIR)"

$(PNG_DIR)/$(ICON_NAME)-%.png: $(ICON_SVG) | $(PNG_DIR)
	@inkscape "$(ICON_SVG)" \
		--export-type=png \
		--export-filename="$@" \
		-w "$*" -h "$*" >/dev/null
	@echo "Generated $@"

ico: $(ICO_FILE)

$(ICO_FILE): png
	@if [ -z "$(IM_CMD)" ]; then \
		echo "ℹ️  Skipping ICO export: ImageMagick not found (magick/convert)."; \
		exit 0; \
	fi

	@mkdir -p "$(ICON_DIST_DIR)"
	@"$(IM_CMD)" $(foreach size,$(PNG_SIZES),"$(PNG_DIR)/$(ICON_NAME)-$(size).png") "$(ICO_FILE)"
	@echo "✅ ICO created: $(ICO_FILE)"

# ICNS is macOS-only. Outside macOS, this is a clean no-op.
icns:
	@if [ "$(UNAME_S)" != "Darwin" ]; then \
		echo "ℹ️  Skipping ICNS export: macOS only."; \
		exit 0; \
	fi
	@if [ -z "$(ICONUTIL)" ]; then \
		echo "ℹ️  Skipping ICNS export: iconutil not found."; \
		exit 0; \
	fi
	@$(MAKE) "$(ICNS_FILE)"

$(ICNS_FILE): png
	@tmpdir="$$(mktemp -d)"; \
	iconset_dir="$$tmpdir/$(ICON_NAME).iconset"; \
	mkdir -p "$$iconset_dir"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-16.png"  "$$iconset_dir/icon_16x16.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-32.png"  "$$iconset_dir/icon_16x16@2x.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-32.png"  "$$iconset_dir/icon_32x32.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-64.png"  "$$iconset_dir/icon_32x32@2x.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-128.png" "$$iconset_dir/icon_128x128.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-256.png" "$$iconset_dir/icon_128x128@2x.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-256.png" "$$iconset_dir/icon_256x256.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-512.png" "$$iconset_dir/icon_256x256@2x.png"; \
	cp "$(PNG_DIR)/$(ICON_NAME)-512.png" "$$iconset_dir/icon_512x512.png"; \
	inkscape "$(ICON_SVG)" \
		--export-type=png \
		--export-filename="$$iconset_dir/icon_512x512@2x.png" \
		-w 1024 -h 1024 >/dev/null; \
	iconutil -c icns "$$iconset_dir" -o "$(ICNS_FILE)"; \
	rm -rf "$$tmpdir"
	@echo "✅ ICNS created: $(ICNS_FILE)"

clean:
	@rm -rf dist-icons
	@echo "🧹 Cleaned dist-icons/"