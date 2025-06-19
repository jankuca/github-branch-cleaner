#!/usr/bin/env node

/**
 * Simple test script to validate the GitHub branch cleaner modules
 */

const gitOps = require('./lib/git-operations');
const githubApi = require('./lib/github-api');
const branchMatcher = require('./lib/branch-matcher');

async function runTests() {
  console.log('🧪 Running GitHub Branch Cleaner Tests\n');

  // Test 1: Git repository detection
  console.log('Test 1: Git repository detection');
  try {
    const isGitRepo = gitOps.isGitRepository();
    console.log(`✅ Is Git repository: ${isGitRepo}`);
  } catch (error) {
    console.log(`❌ Git repository test failed: ${error.message}`);
  }

  // Test 2: Get current branch
  console.log('\nTest 2: Get current branch');
  try {
    const currentBranch = await gitOps.getCurrentBranch();
    console.log(`✅ Current branch: ${currentBranch}`);
  } catch (error) {
    console.log(`❌ Get current branch failed: ${error.message}`);
  }

  // Test 3: Get local branches
  console.log('\nTest 3: Get local branches');
  try {
    const branches = await gitOps.getLocalBranches();
    console.log(`✅ Local branches (${branches.length}): ${branches.join(', ')}`);
  } catch (error) {
    console.log(`❌ Get local branches failed: ${error.message}`);
  }

  // Test 4: Get repository info (if remote exists)
  console.log('\nTest 4: Get repository info');
  try {
    const repoInfo = await gitOps.getRepositoryInfo();
    console.log(`✅ Repository: ${repoInfo.owner}/${repoInfo.name}`);
  } catch (error) {
    console.log(`⚠️  Repository info test: ${error.message}`);
    console.log('   (This is expected if no GitHub remote is configured)');
  }

  // Test 5: Branch safety checks
  console.log('\nTest 5: Branch safety checks');
  const testBranches = ['main', 'master', 'feature/test', 'develop'];
  const currentBranch = 'main';

  testBranches.forEach(branch => {
    const isSafe = branchMatcher.isBranchSafeToDelete(branch, currentBranch);
    console.log(`   ${branch}: ${isSafe ? '✅ Safe to delete' : '❌ Protected'}`);
  });

  // Test 6: PR status determination
  console.log('\nTest 6: PR status determination');
  const testPRs = [
    { state: 'open', merged: false },
    { state: 'closed', merged: false },
    { state: 'closed', merged: true }
  ];

  const testOptions = { merged: true, closed: true };

  testPRs.forEach((pr, index) => {
    const shouldDelete = branchMatcher.shouldDeleteBranch(pr, testOptions);
    const status = branchMatcher.getPRStatusSummary(pr);
    console.log(`   PR ${index + 1} (${status}): ${shouldDelete ? '🗑️  Delete' : '✅ Keep'}`);
  });

  // Test 7: Token loading functionality
  console.log('\nTest 7: Token loading functionality');
  try {
    // Test the loadGitHubToken function (we need to import it or recreate the logic)
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const AUTH_FILE_PATH = path.join(os.homedir(), '.github-branch-cleaner-auth');

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
        // Ignore errors reading auth file
      }

      return null;
    }

    const token = loadGitHubToken();
    if (token) {
      console.log('✅ GitHub token found and loaded successfully');
      console.log('   Source: Auth file');

      // Test GitHub API initialization
      try {
        const github = githubApi.initialize(token);
        console.log('✅ GitHub API client initialized successfully');
      } catch (error) {
        console.log(`❌ GitHub API initialization failed: ${error.message}`);
      }
    } else {
      console.log('⚠️  No GitHub token found');
      console.log('   Run "node index.js --login" to set up authentication');
    }
  } catch (error) {
    console.log(`❌ Token loading test failed: ${error.message}`);
  }

  console.log('\n🎉 Test suite completed!');
  console.log('\n📝 Notes:');
  console.log('   - To test GitHub API functionality, run "node index.js --login" to set up authentication');
  console.log('   - To test with a real repository, add a GitHub remote origin');
  console.log('   - The tool is designed to be safe and will ask for confirmation before deleting branches');
}

// No environment variables to load - using auth file only

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});
