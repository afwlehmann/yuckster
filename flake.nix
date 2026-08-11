{
  description = "Yuckster — an 80s-style pipe-puzzle browser game";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    git-hooks.url = "github:cachix/git-hooks.nix";
  };

  outputs =
    {
      self,
      systems,
      nixpkgs,
      git-hooks,
    }:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      checks = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          pre-commit-check = git-hooks.lib.${system}.run {
            src = ./.;
            hooks = {
              nixfmt.enable = true;
              prettier.enable = true;
              eslint.enable = true;
            };
          };
        }
      );

      devShells = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          inherit (self.checks.${system}.pre-commit-check) shellHook enabledPackages;
        in
        {
          default = pkgs.mkShell {
            inherit shellHook;
            packages = enabledPackages ++ [
              pkgs.nodejs_22
              pkgs.git
              pkgs.nixfmt
              pkgs.typescript-language-server
              pkgs.nil
            ];
          };
        }
      );

      packages = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "yuckster";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = [
              pkgs.nodejs_22
              pkgs.npmHooks.npm-install-hook
            ];

            npmInstallFlags = [ "--legacy-peer-deps" ];

            buildPhase = ''
              runHook preBuild
              npm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/share/yuckster
              cp -r dist/* $out/share/yuckster/
              runHook postInstall
            '';

            meta = {
              description = "An 80s-style pipe-puzzle browser game";
              mainProgram = "yuckster";
            };
          };
        }
      );
    };
}
