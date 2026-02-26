# GitHub setup for SEO WIBE

## 1) Create repository on GitHub
1. Open: `https://github.com/new`
2. Repository name: `seo-wibe` (or any name you prefer).
3. Visibility: Public or Private.
4. Do **not** initialize with README/.gitignore/license (repo must be empty).
5. Create repository.

## 2) Connect local project to GitHub
Run in project root:

```bash
git remote add origin https://github.com/EraserHead8/<REPO_NAME>.git
git add -A
git commit -m "chore: initial import"
git push -u origin main
```

If remote `origin` already exists and points to another repository:

```bash
git remote remove origin
git remote add origin https://github.com/EraserHead8/<REPO_NAME>.git
git push -u origin main
```

## 3) Standard workflow for each version

Manual:

```bash
git add -A
git commit -m "feat: short description"
git push
```

Using helper script:

```bash
scripts/release.sh "feat: short description"
```

## 4) Recommended branch policy
- `main`: stable production branch.
- `codex/<task>`: task branches for active work.
- Merge to `main` only after local check (`python -m compileall app`, quick UI smoke test).

## 5) Next step for auto-deploy
After repository URL and server SSH/deploy path are confirmed, add:
- GitHub Actions workflow (`.github/workflows/deploy.yml`) for deploy on push to `main`.
- Server deploy key or secret token in GitHub repository secrets.

