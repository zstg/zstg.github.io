{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      deps = with pkgs; [
        go
        hugo
        dart-sass
        nodejs_latest
        pnpm
      ];
    in {
      packages.${system}.default = pkgs.stdenv.mkDerivation {
        pname = "hugo-site";
        version = "0.1.0";
        src = ./.;

        buildInputs = deps;

        buildPhase = ''
          # Ensure Go is available
          export GOPATH=$(pwd)/go
          export GOROOT=${pkgs.go}/lib/go
          export PATH=$PATH:${pkgs.go}/bin

          pnpm install
          hugo
        '';

        installPhase = ''
          mkdir -p $out
          cp -r public/* $out/
        '';
      };

      apps.${system}.default = {
        type = "app";

        program = toString (pkgs.writeShellScript "run-hugo-server" ''
          export PATH=$PATH:${pkgs.go}/bin
          exec ${pkgs.hugo}/bin/hugo server --disableFastRender
        '');
      };

      devShells.${system}.default = pkgs.mkShell {
        buildInputs = deps;
      };
    };
}
