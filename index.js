#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

// Authentication file path
const AUTH_FILE_PATH = path.join(os.homedir(), '.github-branch-cleaner-auth');

const program = new Command();

// Import our modules (will be created next)
const gitOps = require('./lib/git-operations');
const githubApi = require('./lib/github-api');
const branchMatcher = require('./lib/branch-matcher');

program
  .name('github-branch-cleaner')
  .description('Clean up local Git branches based on GitHub PR status')
  .version('1.0.0');

program
  .option('--merged', 'Delete branches with merged PRs')
  .option('--closed', 'Delete branches with closed PRs')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--force', 'Skip confirmation prompts')
  .option('--login', 'Prompt for GitHub token and save it for future use')
  .action(async (options) => {
    try {
      if (options.login) {
        await handleLogin();
        return;
      }
      await main(options);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Load GitHub token from auth file
 */
function loadGitHubToken() {
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      const authFileContent = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
      // Simple parsing of GITHUB_TOKEN=value format
      const lines = authFileContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('GITHUB_TOKEN=')) {
          return trimmedLine.substring('GITHUB_TOKEN='.length);
        }
      }
    }
  } catch (error) {
    // Ignore errors reading auth file, will fall through to error below
  }

  return null;
}

/**
 * Handle the --login option
 */
async function handleLogin() {
  console.log('🔐 GitHub Authentication Setup\n');
  console.log('You need a GitHub Personal Access Token to use this tool.');
  console.log('Create one at: https://github.com/settings/tokens\n');
  console.log('Required scopes:');
  console.log('  - For public repositories: public_repo');
  console.log('  - For private repositories: repo\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const token = await new Promise((resolve) => {
      rl.question('Enter your GitHub Personal Access Token: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!token) {
      throw new Error('No token provided');
    }

    // Validate the token by making a simple API call
    console.log('\n🔍 Validating token...');
    const github = githubApi.initialize(token);

    try {
      // Test the token by getting user info
      const { data: user } = await github.rest.users.getAuthenticated();
      console.log(`✅ Token validated successfully! Authenticated as: ${user.login}`);
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }

    // Save the token to the auth file
    const authContent = `# GitHub Personal Access Token for github-branch-cleaner\n# This file was created by running: github-branch-cleaner --login\nGITHUB_TOKEN=${token}\n`;

    try {
      fs.writeFileSync(AUTH_FILE_PATH, authContent, { mode: 0o600 }); // Restrict file permissions
      console.log(`✅ Token saved to: ${AUTH_FILE_PATH}`);
      console.log('\n🎉 Authentication setup complete! You can now use the tool without --login.');
    } catch (error) {
      throw new Error(`Failed to save token: ${error.message}`);
    }

  } finally {
    rl.close();
  }
}

async function main(options) {
  // Validate that at least one option is provided
  if (!options.merged && !options.closed) {
    throw new Error('Please specify at least one option: --merged or --closed');
  }

  // Validate that we're in a git repository
  if (!gitOps.isGitRepository()) {
    throw new Error('This command must be run from within a Git repository');
  }

  // Load and validate GitHub token
  const githubToken = loadGitHubToken();
  if (!githubToken) {
    throw new Error('GitHub token is required. Please run "github-branch-cleaner --login" to set up authentication.');
  }

  console.log('🔍 Analyzing local branches and their GitHub PRs...\n');

  // Get repository information
  const repoInfo = await gitOps.getRepositoryInfo();
  console.log(`Repository: ${repoInfo.owner}/${repoInfo.name}`);

  // Get all local branches except current branch
  const currentBranch = await gitOps.getCurrentBranch();
  const allBranches = await gitOps.getLocalBranches();
  const branchesToCheck = allBranches.filter(branch =>
    branch !== currentBranch &&
    !['main', 'master', 'develop', 'dev'].includes(branch)
  );

  if (branchesToCheck.length === 0) {
    console.log('✅ No branches to check (excluding current branch and protected branches)');
    return;
  }

  console.log(`Current branch: ${currentBranch}`);
  console.log(`Branches to check: ${branchesToCheck.length}\n`);

  // Initialize GitHub API
  const github = githubApi.initialize(githubToken);

  // Find PRs for each branch and determine which ones to delete
  const branchesToDelete = [];

  for (const branch of branchesToCheck) {
    try {
      const pr = await branchMatcher.findPRForBranch(github, repoInfo, branch);

      if (!pr) {
        console.log(`⚠️  ${branch}: No PR found`);
        continue;
      }

      const shouldDelete = branchMatcher.shouldDeleteBranch(pr, options);

      if (shouldDelete) {
        branchesToDelete.push({ branch, pr });
        console.log(`🗑️  ${branch}: ${pr.state} PR #${pr.number} - "${pr.title}"`);
      } else {
        console.log(`✅ ${branch}: ${pr.state} PR #${pr.number} - keeping`);
      }
    } catch (error) {
      console.log(`❌ ${branch}: Error checking PR - ${error.message}`);
    }
  }

  if (branchesToDelete.length === 0) {
    console.log('\n✅ No branches to delete based on the specified criteria');
    return;
  }

  console.log(`\n📋 Found ${branchesToDelete.length} branch(es) to delete:`);
  branchesToDelete.forEach(({ branch, pr }) => {
    console.log(`  - ${branch} (${pr.state} PR #${pr.number})`);
  });

  if (options.dryRun) {
    console.log('\n🔍 Dry run mode - no branches were deleted');
    return;
  }

  // Ask for confirmation unless --force is used
  if (!options.force) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n❓ Do you want to delete these branches? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled');
      return;
    }
  }

  // Delete the branches
  console.log('\n🗑️  Deleting branches...');
  let deletedCount = 0;

  for (const { branch } of branchesToDelete) {
    try {
      await gitOps.deleteBranch(branch);
      console.log(`✅ Deleted: ${branch}`);
      deletedCount++;
    } catch (error) {
      console.log(`❌ Failed to delete ${branch}: ${error.message}`);
    }
  }

  console.log(`\n🎉 Successfully deleted ${deletedCount} out of ${branchesToDelete.length} branches`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

program.parse();
