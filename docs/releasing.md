# Releasing

Merging to `main` deploys the web app on its own. A release adds a version number: the npm package
(`npx ogcapibrowser`) and versioned Docker image tags.

## What happens on a merge to `main`

| Target | Workflow | Result |
|---|---|---|
| Firebase Hosting | `firebase-hosting-merge.yml` | https://ogcbrowser.rauhala.app |
| GitHub Pages | `github-pages.yml` | https://mrauhala.github.io/ogcapibrowser/ |
| GitHub Container Registry | `docker.yml` | `ghcr.io/mrauhala/ogcapibrowser:latest` and `:sha-<commit>` |

`main` is protected: every change goes through a pull request, and the checks "Lint & Type Check"
and "Build" must pass.

## Releasing a version

1. **Bump the version** on a branch, since `main` can't be pushed to directly:

   ```bash
   git checkout -b release/v0.2.0
   npm version minor --no-git-tag-version   # or patch / major
   git commit -am "chore: release 0.2.0"
   git push -u origin release/v0.2.0
   ```

   Open a pull request and merge it.

2. **Tag the merged commit.** The tag publishes the Docker image as `0.2.0` and `0.2`:

   ```bash
   git checkout main && git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. **Publish to npm** from an interactive terminal:

   ```bash
   npm publish
   ```

   `prepublishOnly` builds the app first. The account uses two-factor authentication with a
   security key: npm prints a link, you confirm in the browser, and the upload continues. In a
   non-interactive shell npm can't start that confirmation and answers 403.

   Publish without a Carto key in the environment or `.env.local` (`VITE_CARTO_API_KEY` empty).
   A key present at build time is baked into the package for every `npx` user; without one they get
   Esri's basemap, or Carto with their own `--carto-api-key`.

Check what will be published with `npm pack --dry-run`: `build/`, `bin/`, the README and the two
license files.
