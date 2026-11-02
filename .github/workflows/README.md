# GitHub Actions Workflows

This project uses GitHub Actions for continuous integration, testing, and deployment to Firebase Hosting.

## Workflows

### 1. CI (`ci.yml`)
**Triggers:** Push to `main`/`develop` branches, Pull requests to `main`/`develop`

**Purpose:** Runs automated linting, type checking, and builds on every push and pull request.

**Jobs:**
- **Lint & Type Check**: 
  - Runs on Node.js 18.x and 20.x (matrix strategy)
  - Installs dependencies with npm caching
  - Runs ESLint to check code quality
  - Performs TypeScript type checking

- **Build**:
  - Runs after lint and type check pass
  - Creates production build
  - Uploads build artifacts for 7 days

### 2. Firebase Hosting - Production (`firebase-hosting-merge.yml`)
**Triggers:** Push to `main` branch

**Purpose:** Automatically deploys the application to Firebase Hosting production environment.

**Jobs:**
- Builds the application
- Deploys to Firebase Hosting live channel
- Uses `FIREBASE_SERVICE_ACCOUNT_EDRCLIENT_METEO_FI` secret for authentication

### 3. Firebase Hosting - Preview (`firebase-hosting-pull-request.yml`)
**Triggers:** Pull requests to `main` branch

**Purpose:** Creates preview deployments for pull requests.

**Jobs:**
- Builds the application
- Deploys to temporary Firebase Hosting preview channel
- Adds preview URL as a comment on the PR
- Only runs for PRs from the same repository (security)

### 4. Dependency Review (`dependency-review.yml`)
**Triggers:** Pull requests to `main` branch

**Purpose:** Reviews dependency changes for security vulnerabilities and license compliance.

**Features:**
- Fails on high severity vulnerabilities
- Provides detailed dependency change analysis

### 5. CodeQL Security Analysis (`codeql.yml`)
**Triggers:** 
- Push to `main` branch
- Pull requests to `main` branch
- Scheduled: Every Monday at 2:00 AM

**Purpose:** Performs automated security scanning of the codebase.

**Features:**
- Scans JavaScript/TypeScript code
- Runs security and quality queries
- Creates security alerts for vulnerabilities
- Scheduled weekly scans

### 6. GitHub Pages (`github-pages.yml`)
**Triggers:** Push to `main` branch, or run manually (Actions → Deploy to GitHub Pages → Run workflow)

**Purpose:** Publishes the application to GitHub Pages at https://mrauhala.github.io/ogcapibrowser/.

**Jobs:**
- Builds with the base path GitHub Pages reports (`/ogcapibrowser/`), so assets and the bundled schemas load from the sub-path
- Deploys with `actions/deploy-pages` to the `github-pages` environment; no secrets needed

**Setup:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

### 7. Docker image (`docker.yml`)
**Triggers:** Push to `main`, version tags (`v*`), pull requests to `main`, or run manually

**Purpose:** Builds the Docker image (nginx serving the static build) and publishes it to GitHub Container Registry as `ghcr.io/mrauhala/ogcapibrowser`.

**Jobs:**
- Builds for `linux/amd64` and `linux/arm64`; the app itself is built once on the runner's platform
- Pull requests only build (no push), to catch a broken Dockerfile before merging
- Tags: `latest` and `sha-<commit>` from `main`; `1.2.3` and `1.2` from a `v1.2.3` tag
- Pushes with the workflow's `GITHUB_TOKEN` (`packages: write`); no secrets needed

## Required Secrets

The following secrets must be configured in your GitHub repository:

1. `FIREBASE_SERVICE_ACCOUNT_EDRCLIENT_METEO_FI` - Firebase service account credentials for deployment
2. `GITHUB_TOKEN` - Automatically provided by GitHub Actions
3. `CARTO_API_KEY` - Carto basemap API key used by the Firebase deployment workflows

> **Note:** Preview and production currently use the same Carto API key. To use different keys, add separate GitHub Actions secrets (for example, `CARTO_API_KEY_PREVIEW` and `CARTO_API_KEY_PRODUCTION`) and update `VITE_CARTO_API_KEY` in each deployment workflow to reference the appropriate secret.

## Setup Instructions

### Firebase Service Account
1. Go to your Firebase project settings
2. Navigate to Service Accounts
3. Generate a new private key
4. Add the JSON content as a secret in GitHub repository settings

## Best Practices

- All workflows use Node.js caching to speed up execution
- Dependencies are installed with `npm ci` for reproducible builds
- Build artifacts are uploaded for debugging
- Security scanning runs automatically
- Preview deployments help review changes before production
- Code quality is enforced through ESLint and TypeScript type checking

## Workflow Status Badges

Add these badges to your main README.md:

```markdown
![CI](https://github.com/mrauhala/ogcapibrowser/workflows/CI/badge.svg)
![Deploy to Firebase Hosting (Production)](https://github.com/mrauhala/ogcapibrowser/workflows/Deploy%20to%20Firebase%20Hosting%20(Production)/badge.svg)
```

## Troubleshooting

### Build Failures
- Check Node.js version compatibility (18.x or 20.x)
- Verify all dependencies are properly listed in `package.json`
- Review build logs in the Actions tab

### Deployment Failures
- Verify Firebase service account secret is correctly configured
- Ensure Firebase project ID is correct
- Check Firebase Hosting quota and limits

### Linting or Type Check Failures
- Run `npm run lint` locally to see linting errors
- Run `npm run lint:fix` to auto-fix issues
- Run `npx tsc --noEmit` to check TypeScript errors
- Review error messages in the Actions tab
