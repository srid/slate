{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = inputs@{ flake-parts, rust-overlay, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { pkgs, system, lib, ... }:
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

            # Graphics/Wayland support for WebKitGTK
            mesa
            libGL
            libglvnd
            wayland
            libxkbcommon
            vulkan-loader

            # GTK modules (silence warnings)
            libcanberra-gtk3
          ];

          # macOS-specific packages
          darwinPackages = with pkgs; [
            libiconv
          ];

          isLinux = pkgs.stdenv.isLinux;
          isDarwin = pkgs.stdenv.isDarwin;

          # Fetch Cargo dependencies for offline build
          cargoDeps = pkgs.rustPlatform.importCargoLock {
            lockFile = ./src-tauri/Cargo.lock;
          };

          # Build the Tauri app with proper bundling
          slate = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "slate";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = with pkgs; [
              rustToolchain
              cargo-tauri
              pkg-config
              nodejs_22
              pnpm
              pnpmConfigHook
            ] ++ lib.optionals isDarwin [
              pkgs.xcbuild
            ];

            buildInputs = with pkgs; [
              openssl
            ] ++ lib.optionals isLinux linuxPackages
              ++ lib.optionals isDarwin (darwinPackages ++ [
                pkgs.apple-sdk
              ]);

            # Fetch pnpm dependencies
            pnpmDeps = pkgs.fetchPnpmDeps {
              pname = "slate-pnpm-deps";
              version = "0.1.0";
              src = ./.;
              fetcherVersion = 3;
              hash = "sha256-XSXofgWErXbFF/ajS0vGchLzzJPeMPvGlswliqdKU6k=";
            };

            # Set up Cargo vendor directory
            postUnpack = ''
              export CARGO_HOME=$(mktemp -d)
              cp -r ${cargoDeps} $CARGO_HOME/registry
              chmod -R u+w $CARGO_HOME
            '';

            configurePhase = ''
              runHook preConfigure
              
              # Configure Cargo to use vendored dependencies
              mkdir -p src-tauri/.cargo
              cat > src-tauri/.cargo/config.toml << EOF
              [source.crates-io]
              replace-with = "vendored-sources"

              [source.vendored-sources]
              directory = "${cargoDeps}"
              EOF
              
              runHook postConfigure
            '';

            buildPhase = ''
              runHook preBuild
              
              # Build frontend first
              pnpm build
              
              # Build Tauri app with bundling
              cd src-tauri
              cargo tauri build --bundles ${if isDarwin then "app" else "deb"}
              cd ..
              
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              
              ${if isDarwin then ''
                # Copy macOS .app bundle
                mkdir -p $out/Applications
                cp -r src-tauri/target/release/bundle/macos/*.app $out/Applications/
                
                # Create bin symlink for nix run
                mkdir -p $out/bin
                ln -s "$out/Applications/Slate.app/Contents/MacOS/Slate" $out/bin/slate
              '' else ''
                # Copy Linux binary and desktop files
                mkdir -p $out/bin
                cp src-tauri/target/release/slate $out/bin/
                
                # Copy .deb contents if available
                if [ -d src-tauri/target/release/bundle/deb ]; then
                  cp -r src-tauri/target/release/bundle/deb/* $out/ || true
                fi
              ''}
              
              runHook postInstall
            '';

            # Tauri build settings
            TAURI_SKIP_DEVSERVER_CHECK = "true";

            meta = with lib; {
              description = "A cross-platform markdown editor built with Tauri";
              homepage = "https://github.com/srid/slate";
              license = licenses.agpl3Plus;
              platforms = platforms.linux ++ platforms.darwin;
              mainProgram = "slate";
            };
          });
        in
        {
          packages = {
            default = slate;
            inherit slate;
          };

          apps.default = {
            type = "app";
            program = "${slate}/bin/slate";
          };

          devShells.default = pkgs.mkShell {
            packages = commonPackages
              ++ pkgs.lib.optionals isLinux linuxPackages
              ++ pkgs.lib.optionals isDarwin darwinPackages;

            # Linux: Set up library paths for Tauri with proper graphics support
            shellHook = pkgs.lib.optionalString isLinux ''
              export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath linuxPackages}:$LD_LIBRARY_PATH
              # Ensure WebKitGTK can find EGL drivers
              export WEBKIT_DISABLE_DMABUF_RENDERER=1
            '';
          };
        };
    };
}
