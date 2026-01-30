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
          ];

          # macOS-specific packages
          darwinPackages = with pkgs; [
            libiconv
          ];

          isLinux = pkgs.stdenv.isLinux;
          isDarwin = pkgs.stdenv.isDarwin;

          # Build the frontend using pnpm
          frontendBuild = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "slate-frontend";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = with pkgs; [ 
              nodejs_22 
              pnpm
              pnpmConfigHook
            ];

            # Fetch pnpm dependencies
            pnpmDeps = pkgs.fetchPnpmDeps {
              pname = "slate-frontend-deps";
              version = "0.1.0";
              src = ./.;
              fetcherVersion = 3;
              hash = "sha256-FipCvudNewZmCRu7zDIWJqLif4/lmE/w+19kUl/4Yu4="; # pnpm deps hash
            };

            buildPhase = ''
              runHook preBuild
              pnpm build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              cp -r dist $out
              runHook postInstall
            '';
          });

          # Build the Tauri app
          slate = pkgs.rustPlatform.buildRustPackage {
            pname = "slate";
            version = "0.1.0";
            src = ./src-tauri;

            cargoLock = {
              lockFile = ./src-tauri/Cargo.lock;
            };

            nativeBuildInputs = with pkgs; [
              pkg-config
              cargo-tauri
            ];

            buildInputs = with pkgs; [
              openssl
            ] ++ lib.optionals isLinux linuxPackages
              ++ lib.optionals isDarwin (darwinPackages ++ [
                pkgs.apple-sdk
              ]);

            # Copy frontend build to the right place
            preBuild = ''
              mkdir -p ../dist
              cp -r ${frontendBuild}/* ../dist/
            '';

            # Tauri expects frontend at specific location
            TAURI_SKIP_DEVSERVER_CHECK = "true";

            meta = with lib; {
              description = "A cross-platform markdown editor built with Tauri";
              homepage = "https://github.com/srid/slate";
              license = licenses.agpl3Plus;
              platforms = platforms.linux ++ platforms.darwin;
              mainProgram = "slate";
            };
          };
        in
        {
          packages = {
            default = slate;
            inherit slate frontendBuild;
          };

          apps.default = {
            type = "app";
            program = "${slate}/bin/slate";
          };

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
