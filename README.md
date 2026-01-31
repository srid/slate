# Slate

A cross-platform markdown editor built with **Tauri 2.0** and **SolidJS**. The foundation for an OSS Obsidian alternative.

## Features

- 📁 **Vault Management** — Manages markdown files in `~/Dropbox/Vault` recursively
- 🔍 **Quick Switcher** — Ctrl+P fuzzy finder to jump between files
- 📝 **WYSIWYG Editing** — Edit markdown with rich text formatting
- ✅ **Task Lists** — Interactive checkboxes for GFM task lists
- 🎨 **Syntax Highlighting** — Code blocks with Prism-powered highlighting
- 💾 **Auto-Save** — Changes saved automatically with file watching
- 🌙 **Dark Theme** — Easy on the eyes
- ⚡ **Fast** — Built with Rust and SolidJS
- 🔒 **Secure** — No network required, runs entirely locally

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2.0 |
| Frontend | SolidJS + TypeScript |
| WYSIWYG Editor | Milkdown (ProseMirror-based) |
| Markdown | GFM (GitHub Flavored Markdown) |
| Syntax Highlighting | Refractor (Prism) |
| Styling | Tailwind CSS v4 |
| Build | Vite + Nix |

## Development

### Prerequisites

- [Nix](https://nixos.org/) with flakes enabled
- macOS: Xcode command line tools (`xcode-select --install`)

### Quick Start

```bash
# Enter the development shell (or use direnv)
nix develop

# Install dependencies
pnpm install

# Start development server
just dev
```

### Available Commands

```bash
just dev      # Start development server
just build    # Build for production
just check    # Type check frontend
just clean    # Clean build artifacts
```

## Building for Production

### Using Nix (Recommended)

```bash
nix build
```

The built `.app` bundle will be in `result/Applications/Slate.app`.

### Manual Build

```bash
nix develop
pnpm tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
slate/
├── flake.nix                 # Nix development environment & packaging
├── justfile                  # Command automation
├── src/                      # SolidJS frontend
│   ├── App.tsx              # Main app layout & state
│   ├── services/
│   │   └── fileService.ts   # Vault scanning & file operations
│   └── components/
│       ├── WysiwygEditor.tsx # Milkdown WYSIWYG editor
│       └── FileFinder.tsx   # Ctrl+P fuzzy file finder
└── src-tauri/               # Rust/Tauri backend
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        └── lib.rs           # Plugin registration
```

## License

MIT
