#!/usr/bin/env node

const { Command } = require('commander');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

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
  .action(async (options) => {
    try {
      await main(options);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

async function main(options) {
  // Validate that we're in a git repository
  if (!gitOps.isGitRepository()) {
    throw new Error('This command must be run from within a Git repository');
  }

  // Validate GitHub token
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required. Please set it in your .env file.');
  }

  // Validate that at least one option is provided
  if (!options.merged && !options.closed) {
    throw new Error('Please specify at least one option: --merged or --closed');
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
  const github = githubApi.initialize(process.env.GITHUB_TOKEN);

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
    const readline = require('readline');
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
