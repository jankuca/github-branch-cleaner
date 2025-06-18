# GitHub Branch Cleaner

A command-line tool to clean up local Git branches based on their associated GitHub Pull Request status.

## Features

- 🧹 Clean up local branches with merged or closed PRs
- 🔍 Automatically matches local branches with their GitHub PRs
- 🛡️ Safety checks to protect important branches (main, master, develop, etc.)
- 🔍 Dry-run mode to preview what would be deleted
- ⚡ Force mode to skip confirmation prompts
- 📊 Clear reporting of what branches will be affected

## Installation

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your GitHub token (see Configuration section)

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Get a GitHub Personal Access Token:
   - Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Give it a descriptive name like "Branch Cleaner"
   - Select scopes:
     - For public repositories: `public_repo`
     - For private repositories: `repo`
   - Copy the generated token

3. Add your token to the `.env` file:
   ```
   GITHUB_TOKEN=your_actual_token_here
   ```

## Usage

Run the tool from within any Git repository:

```bash
# Show help
node index.js --help

# Delete branches with merged PRs (with confirmation)
node index.js --merged

# Delete branches with closed PRs (with confirmation)
node index.js --closed

# Delete both merged and closed PR branches
node index.js --merged --closed

# Preview what would be deleted (dry run)
node index.js --merged --dry-run

# Delete without confirmation prompts
node index.js --merged --force

# Combine options
node index.js --merged --closed --dry-run
```

## Options

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

### Clean up merged branches
```bash
$ node index.js --merged
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
$ node index.js --merged --closed --dry-run
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

### "GITHUB_TOKEN environment variable is required"
- Make sure you've created a `.env` file with your GitHub token
- Verify the token has the correct permissions (repo or public_repo scope)

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

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC License
