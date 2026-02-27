# GitHub setup for SEO WIBE

## 1) Repository and remote
Repository is expected as:

```text
git@github.com:EraserHead8/SEO_WIBE.git
```

Check local remote:

```bash
git remote -v
```

If needed, rebind:

```bash
git remote remove origin
git remote add origin git@github.com:EraserHead8/SEO_WIBE.git
```

## 2) Access for push from this machine
Use SSH auth so pushes work without typing credentials each time.

If SSH key is not configured yet:

```bash
ssh-keygen -t ed25519 -C "seo-wibe"
cat ~/.ssh/id_ed25519.pub
```

Then add public key to GitHub:
- `GitHub -> Settings -> SSH and GPG keys -> New SSH key`.

Verify access:

```bash
ssh -T git@github.com
```

## 3) Push first version
```bash
git add -A
git commit -m "chore: initial import"
git push -u origin main
```

## 4) Standard release flow
Manual:

```bash
git add -A
git commit -m "feat: short description"
git push
```

Helper script:

```bash
scripts/release.sh "feat: short description"
```

## 5) GitHub Actions already prepared
Configured workflows:
- `.github/workflows/ci.yml` -> syntax checks on push/PR.
- `.github/workflows/deploy.yml` -> auto-deploy on push to `main`.

Deploy workflow is safe now: if deploy secrets are missing, it skips deployment.

## 6) Enable auto-deploy when server is ready
Add repository secrets:
- `DEPLOY_HOST` -> server host or IP
- `DEPLOY_USER` -> SSH user
- `DEPLOY_SSH_KEY` -> private SSH key (multiline)
- `DEPLOY_PATH` -> path to app on server, e.g. `/opt/seo_wibe`
- `DEPLOY_PORT` -> optional, default `22`
- `DEPLOY_RESTART_CMD` -> optional, e.g. `sudo systemctl restart seo_wibe`

After that, every push to `main` will auto-deploy.
