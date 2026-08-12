SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -euo pipefail -c

.DEFAULT_GOAL := icons

.PHONY: icons clean

# Icon generation moved into scripts/render_brand_icons.ts.
#
# The previous pipeline needed inkscape, ImageMagick and macOS iconutil, none of
# which are installed on the development machine. It also carried a trap: the
# ImageMagick lookup fell back to `convert`, which on Windows resolves to
# C:\WINDOWS\system32\convert.exe — the filesystem conversion tool.
#
# The replacement rasterises the brand SVGs with Chromium (already a dependency
# via Puppeteer) and lets `tauri icon` emit the platform bundles, so it needs no
# external tools and works the same on every platform.
icons:
	@npm run icons

clean:
	@rm -rf dist-icons
	@echo "Cleaned dist-icons/"
