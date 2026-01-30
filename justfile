# Default recipe - show available commands
default:
    @just --list

# Start development server
dev:
    pnpm tauri dev

# Type check frontend
check:
    pnpm tsc --noEmit

# Build for production
build:
    pnpm tauri build

# Clean build artifacts
clean:
    rm -rf dist node_modules/.vite src-tauri/target

# Install dependencies
install:
    pnpm install
