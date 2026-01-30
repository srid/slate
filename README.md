# Slate

A cross-platform markdown editor built with **Tauri 2.0** and **SolidJS**. The foundation for an OSS Obsidian alternative.

## Features

- 📝 **Live Preview** — See your changes in real-time
- 💾 **Native File Dialogs** — Open and save files seamlessly
- 🎨 **Dark Theme** — Easy on the eyes
- ⚡ **Fast** — Built with Rust and SolidJS
- 🔒 **Secure** — No network required, runs entirely locally

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2.0 |
| Frontend | SolidJS + TypeScript |
| Styling | Tailwind CSS v4 |
| Markdown | marked |
| Build | Vite |

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
pnpm tauri dev
```

### Available Commands

```bash
just dev      # Start development server
just build    # Build for production
just check    # Type check frontend
just clean    # Clean build artifacts
```

## Building for Production

### macOS

```bash
nix develop
pnpm tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

### Linux

Ensure you have the required system dependencies (gtk3, webkit2gtk, etc.) installed via your package manager or Nix.

```bash
nix develop
pnpm tauri build
```

### Windows

1. Install [Rust](https://rustup.rs/) with MSVC toolchain
2. Install [Node.js](https://nodejs.org/)
3. Run:

```powershell
pnpm install
pnpm tauri build
```

## Project Structure

```
slate/
├── flake.nix              # Nix development environment
├── justfile               # Command automation
├── src/                   # SolidJS frontend
│   ├── App.tsx           # Main app with split-pane layout
│   └── components/
│       ├── Editor.tsx    # Markdown textarea
│       └── Preview.tsx   # Live HTML preview
└── src-tauri/            # Rust/Tauri backend
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        └── lib.rs        # Plugin registration
```

## License

MIT
