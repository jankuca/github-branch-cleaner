# GitHub Branch Cleaner

[![npm version](https://badge.fury.io/js/github-branch-cleaner.svg)](https://www.npmjs.com/package/github-branch-cleaner)

A command-line tool to clean up local Git branches based on their associated GitHub Pull Request status.

## Features

- 🧹 Clean up local branches with merged or closed PRs
- 🔍 Automatically matches local branches with their GitHub PRs
- 🛡️ Safety checks to protect important branches (main, master, develop, etc.)
- 🔍 Dry-run mode to preview what would be deleted
- ⚡ Force mode to skip confirmation prompts
- 📊 Clear reporting of what branches will be affected

## Installation

Install globally via npm:

```bash
npm install -g github-branch-cleaner
```

After installation, the `github-branch-cleaner` command will be available globally.

## Configuration

Run the login command to set up authentication:

```bash
github-branch-cleaner --login
```

This will:
- Prompt you for a GitHub Personal Access Token
- Validate the token
- Save it securely to `~/.github-branch-cleaner-auth`
- Set appropriate file permissions

### Getting a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "Branch Cleaner"
4. Select scopes:
   - For public repositories: `public_repo`
   - For private repositories: `repo`
5. Copy the generated token and use it with the `--login` command

## Usage

Run the tool from within any Git repository:

```bash
# Set up authentication (first time only)
github-branch-cleaner --login

# Show help
github-branch-cleaner --help

# Delete branches with merged PRs (with confirmation)
github-branch-cleaner --merged

# Delete branches with closed PRs (with confirmation)
github-branch-cleaner --closed

# Delete both merged and closed PR branches
github-branch-cleaner --merged --closed

# Preview what would be deleted (dry run)
github-branch-cleaner --merged --dry-run

# Delete without confirmation prompts
github-branch-cleaner --merged --force

# Combine options
github-branch-cleaner --merged --closed --dry-run
```

## Options

- `--login`: Set up GitHub authentication (prompts for token and saves it)
- `--merged`: Delete branches that have associated merged PRs
- `--closed`: Delete branches that have associated closed (but not merged) PRs
- `--dry-run`: Show what would be deleted without actually deleting anything
- `--force`: Skip confirmation prompts and delete immediately
- `--help`: Show help information
- `--version`: Show version information

## Safety Features

The tool includes several safety measures:

1. **Protected Branches**: Never deletes `main`, `master`, `develop`, or `dev` branches
2. **Current Branch**: Never deletes the currently checked out branch
3. **Confirmation**: Asks for confirmation before deleting (unless `--force` is used)
4. **Dry Run**: Preview mode to see what would happen
5. **Error Handling**: Graceful handling of API errors and git command failures

## How It Works

1. **Repository Detection**: Verifies you're in a Git repository
2. **Branch Discovery**: Lists all local branches (excluding current and protected branches)
3. **PR Matching**: For each branch, searches for associated GitHub PRs using multiple strategies:
   - Direct branch name matching
   - GitHub API search
   - Fallback to scanning all repository PRs
4. **Status Analysis**: Determines PR status (open, closed, merged)
5. **Filtering**: Identifies branches that match your deletion criteria
6. **Confirmation**: Shows what will be deleted and asks for confirmation
7. **Deletion**: Removes the selected branches from your local repository

## Examples

### First time setup
```bash
$ github-branch-cleaner --login
🔐 GitHub Authentication Setup

You need a GitHub Personal Access Token to use this tool.
Create one at: https://github.com/settings/tokens

Required scopes:
  - For public repositories: public_repo
  - For private repositories: repo

Enter your GitHub Personal Access Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

🔍 Validating token...
✅ Token validated successfully! Authenticated as: your-username
✅ Token saved to: /Users/your-username/.github-branch-cleaner-auth

🎉 Authentication setup complete! You can now use the tool without --login.
```

### Clean up merged branches
```bash
$ github-branch-cleaner --merged
🔍 Analyzing local branches and their GitHub PRs...

Repository: username/my-project
Current branch: main
Branches to check: 5

🗑️  feature/user-auth: merged PR #123 - "Add user authentication"
🗑️  bugfix/login-issue: merged PR #124 - "Fix login redirect bug"
✅ feature/new-dashboard: open PR #125 - keeping

📋 Found 2 branch(es) to delete:
  - feature/user-auth (merged PR #123)
  - bugfix/login-issue (merged PR #124)

❓ Do you want to delete these branches? (y/N): y

🗑️  Deleting branches...
✅ Deleted: feature/user-auth
✅ Deleted: bugfix/login-issue

🎉 Successfully deleted 2 out of 2 branches
```

### Dry run to preview
```bash
$ github-branch-cleaner --merged --closed --dry-run
🔍 Analyzing local branches and their GitHub PRs...

Repository: username/my-project
Current branch: main
Branches to check: 3

🗑️  old-feature: closed PR #120 - "Old feature attempt"
🗑️  hotfix/critical-bug: merged PR #122 - "Critical security fix"

📋 Found 2 branch(es) to delete:
  - old-feature (closed PR #120)
  - hotfix/critical-bug (merged PR #122)

🔍 Dry run mode - no branches were deleted
```

## Troubleshooting

### "GitHub token is required"
- Run `github-branch-cleaner --login` to set up authentication
- Verify the token has the correct permissions (repo or public_repo scope)
- Check that the auth file exists: `~/.github-branch-cleaner-auth`

### "This command must be run from within a Git repository"
- Navigate to a directory that contains a Git repository
- Make sure the repository has a GitHub remote origin

### "Could not parse GitHub repository from remote URL"
- Ensure your repository has a GitHub remote origin configured
- Check with: `git remote -v`

### API rate limiting
- GitHub API has rate limits (5000 requests/hour for authenticated users)
- The tool is designed to be efficient, but very large repositories might hit limits
- Wait an hour or use a different token if you hit rate limits

## Local Development

If you want to contribute or run the tool locally:

1. Clone this repository:
   ```bash
   git clone https://github.com/jankuca/github-branch-cleaner.git
   cd github-branch-cleaner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   node index.js --help
   node index.js --login
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC License
