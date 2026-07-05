# Contributing Workflow

Use one shared GitHub repository, but keep `main` stable. Nobody should work directly on `main`; all changes should go through a task branch and a pull request.

## Branch Rules

- `main` is for stable, reviewed code only.
- One task gets one branch.
- One branch gets one pull request.
- Keep branches small and focused.
- Pull the latest `main` before starting new work.
- Tell the other person before editing the same large or shared file.

Good branch names:

```text
feature/login-page
feature/customer-care-api
feature/arpit-login
feature/person2-dashboard
fix/navbar-tabs
fix/auth-error
fix/arpit-auth-bug
```

## Issues

Use GitHub Issues to divide work into small pieces. Assign each issue to the person responsible for it.

Examples:

- Issue 1: Build login UI
- Issue 2: Connect login API
- Issue 3: Add complaint form backend
- Issue 4: Build complaint screen

Each issue should include:

- What needs to be built or fixed
- Which files or area may be affected
- Who is assigned
- Any testing notes

## Daily Workflow

Before starting work:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-task-name
```

After coding:

```bash
git add .
git commit -m "Add login screen"
git push origin feature/your-task-name
```

Then open a pull request on GitHub:

```text
feature/your-task-name -> main
```

The other person should review the pull request, leave comments if needed, and merge only when the change is ready.

After someone merges a pull request, both people should update their local copy:

```bash
git checkout main
git pull origin main
```

Then create the next task branch from the updated `main`.

## Pull Request Checklist

Before asking for review, check that:

- The branch is based on the latest `main`.
- The pull request handles one issue or one clear task.
- The code runs locally.
- Tests pass, if tests exist for the changed area.
- No `.env` files, API keys, secrets, or `node_modules` are committed.
- The pull request description explains what changed and how to test it.

Suggested pull request description:

```md
## What changed
- Added ...

## How to test
- Run ...
- Open ...

## Related issue
Closes #...
```

## Commit Guidelines

Use small commits with clear names:

```text
Add login screen
Connect login form to API
Fix auth error message
Update dashboard workspace cards
```

Avoid vague commits:

```text
final update
changes
done
fix all
```

## Avoid

- Pushing directly to `main`
- Both editing the same big file at the same time
- Huge pull requests with unrelated changes
- Keeping branches open for many days without pulling `main`
- Committing `.env` files, API keys, secrets, build output, or `node_modules`

## Recommended GitHub Settings

In GitHub repo settings, protect the `main` branch and enable:

- Require a pull request before merging
- Require 1 approval
- Block direct pushes to `main`
- Require status checks before merging, once tests or builds are configured

This keeps `main` clean and makes sure every important change is reviewed before it becomes part of the stable code.

