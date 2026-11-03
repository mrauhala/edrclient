# Releasing

Merging to `main` deploys the web app on its own. A release adds a version number: the npm package
(`npx ogcapi-browser`), versioned Docker image tags, a GitHub release and the changelog. Releases are
made by [release-please](https://github.com/googleapis/release-please) from the commit messages.

## What happens on a merge to `main`

| Target | Workflow | Result |
|---|---|---|
| Firebase Hosting | `firebase-hosting-merge.yml` | https://ogcbrowser.rauhala.app |
| GitHub Pages | `github-pages.yml` | https://mrauhala.github.io/ogcapi-browser/ |
| GitHub Container Registry | `docker.yml` | `ghcr.io/mrauhala/ogcapi-browser:latest` and `:sha-<commit>` |
| Release pull request | `release-please.yml` | opened or updated, see below |

`main` is protected: every change goes through a pull request, and the checks "Lint & Type Check"
and "Build" must pass.

## Releasing a version

release-please keeps one pull request open, titled like `chore(main): release 0.2.0`. Each merge to
`main` updates it with:

- the next version in `package.json`, `package-lock.json` and `.release-please-manifest.json`
- `CHANGELOG.md`, listing the `feat:` and `fix:` commits since the last release

To release, **merge that pull request**. Then:

1. release-please tags the merge commit `v0.2.0` and creates the GitHub release with its changelog.
2. The same workflow publishes `ogcapi-browser@0.2.0` to npm, with provenance.
3. The tag starts `docker.yml`, which pushes the image as `0.2.0` and `0.2` too.

Nothing to do when there is nothing worth releasing: the pull request just waits.

### Which version

The version follows the [Conventional Commits](https://www.conventionalcommits.org/) prefixes of
the commits merged since the last release. Pull requests are squash-merged (the only merge method
the repository allows), and the pull request's title becomes the commit message, so **the title
needs the prefix**: one changelog line per pull request. While the version is below 1.0:

| Commit | Example | 0.1.0 becomes |
|---|---|---|
| `fix:` | `fix: show what the server says went wrong` | 0.1.1 |
| `feat:` | `feat: add DMI Forecast preset` | 0.2.0 |
| breaking: `feat!:`, or a `BREAKING CHANGE:` footer | `feat!: drop the --carto-api-key flag` | 0.2.0 |

`docs:`, `chore:`, `test:`, `refactor:`, `ci:` and `style:` titles don't bump the version or appear
in the changelog. A title without a prefix is left out too.

To pick a version yourself, for example 1.0.0, add a `Release-As: 1.0.0` footer to a commit message
on `main`.

The first release counts from `77abc8e`, the commit 0.1.0 was published from (`bootstrap-sha` in
`release-please-config.json`). Pull requests up to #132 were merged with merge commits, which
release-please reads twice (the pull request's title and the branch's commits), so the 0.2.0
changelog lists some changes twice until it is tidied in the release pull request.

## One-time setup

Both steps need your accounts, so they can't be done from the repository. The second is done.

### 1. A token for release-please

Pull requests and tags made with the workflow's own `GITHUB_TOKEN` don't start other workflows. The
required checks would never run on the release pull request, so it couldn't be merged, and the tag
wouldn't build the Docker image. release-please therefore uses a fine-grained personal access
token. The release pull requests are opened in your name.

1. GitHub → your avatar → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `release-please ogcapi-browser`. **Expiration:** your choice; when it expires,
   the release workflow fails until you renew it.
3. **Resource owner:** `mrauhala`. **Repository access:** **Only select repositories** →
   `mrauhala/ogcapi-browser`.
4. **Permissions** → **Repository permissions**:
   - **Contents:** Read and write (commits the version bump, creates tags and releases)
   - **Pull requests:** Read and write (opens and updates the release pull request)
   - **Issues:** Read and write (labels the pull request `autorelease: pending`, then `autorelease: tagged`)
   - Metadata: Read-only is added automatically
5. **Generate token** and copy it.
6. Store it as the repository secret `RELEASE_PLEASE_TOKEN`: the repository → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**. Or from a terminal, pasting
   the token at the prompt:

   ```bash
   gh secret set RELEASE_PLEASE_TOKEN --repo mrauhala/ogcapi-browser
   ```

### 2. npm trusted publishing

Done for `ogcapi-browser`. The npm account uses two-factor authentication with a security key,
which a workflow can't use. Trusted publishing lets npm accept the workflow's OIDC identity
instead, so no npm token is stored anywhere.

npm only sets up trusted publishing for a package that already exists, so the first version was
published by hand: `ogcapi-browser@0.1.0` is the 0.1.0 commit with only the name changed. The
earlier `ogcapibrowser` package was unpublished first, because npm refuses a new name that equals
an existing one once punctuation is removed. To set up the trusted publisher again, from an
interactive terminal:

```bash
npm trust github ogcapi-browser --file release-please.yml --repo mrauhala/ogcapi-browser --allow-publish
```

Or on https://www.npmjs.com → **Packages** → `ogcapi-browser` → **Settings** → **Trusted
publishing** → **GitHub Actions**: user `mrauhala`, repository `ogcapi-browser`, workflow
`release-please.yml` (the file name only), no environment. `npm trust list ogcapi-browser` shows
the current one; npm allows one per package.

Recommended once a release has gone through: under **Publishing access**, choose **Require
two-factor authentication and disallow tokens**. Trusted publishing keeps working, and no stolen
token can publish.

npm checks that `repository.url` in `package.json` matches the repository, and needs npm 11.5.1 or
later (Node 24 on the runners has 11.19).

## If something goes wrong

- **The release pull request has no checks:** the workflow ran without `RELEASE_PLEASE_TOKEN`, or
  the token has expired. Fix the secret, then push any commit to `main` or re-run the workflow.
- **npm publish fails with 404 or 403:** the trusted publisher on npmjs.com doesn't match (user,
  repository, or a workflow file name other than `release-please.yml`). The GitHub release and tag
  already exist; fix the setting and re-run the **Publish to npm** job.
- **Publishing by hand** still works from an interactive terminal on the tagged commit:
  `git checkout v0.2.0 && npm ci && npm publish`. npm prints a link for the security key
  confirmation; in a non-interactive shell it can't start that and answers 403. An expired login
  answers 404 on publish (`npm whoami` says 401): run `npm login` first.

Publish without a Carto key in the environment or `.env.local` (`VITE_CARTO_API_KEY` empty). A key
present at build time is baked into the package for every `npx` user; without one they get Esri's
basemap, or Carto with their own `--carto-api-key`. The release workflow has no key.

Check what will be published with `npm pack --dry-run`: `build/`, `bin/`, the README and the two
license files.
