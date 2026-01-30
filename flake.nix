{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = inputs@{ flake-parts, rust-overlay, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { pkgs, system, ... }:
        let
          # Apply rust-overlay to get the latest stable Rust
          pkgsWithRust = import inputs.nixpkgs {
            inherit system;
            overlays = [ rust-overlay.overlays.default ];
          };

          rustToolchain = pkgsWithRust.rust-bin.stable.latest.default.override {
            extensions = [ "rust-src" "rust-analyzer" ];
          };

          # Common packages for all platforms
          commonPackages = with pkgs; [
            # Rust
            rustToolchain
            cargo-tauri

            # Node.js
            nodejs_22
            pnpm

            # Dev tools
            just
          ];

          # Linux-specific packages (for Tauri/WebKit)
          linuxPackages = with pkgs; [
            # Build tools
            pkg-config
            gobject-introspection

            # Tauri dependencies
            webkitgtk_4_1
            gtk3
            libsoup_3
            gdk-pixbuf
            cairo
            pango
            harfbuzz
            librsvg
            openssl
            glib
            at-spi2-atk
            atkmm
          ];

          # macOS-specific packages
          # On macOS, Tauri uses the system WebKit - no explicit framework packages needed
          # The apple-sdk is automatically available via stdenv on darwin
          darwinPackages = with pkgs; [
            libiconv
          ];

          isLinux = pkgs.stdenv.isLinux;
          isDarwin = pkgs.stdenv.isDarwin;
        in
        {
          devShells.default = pkgs.mkShell {
            packages = commonPackages
              ++ pkgs.lib.optionals isLinux linuxPackages
              ++ pkgs.lib.optionals isDarwin darwinPackages;

            # Linux: Set up library paths for Tauri
            shellHook = pkgs.lib.optionalString isLinux ''
              export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath linuxPackages}:$LD_LIBRARY_PATH
            '';
          };
        };
    };
}
