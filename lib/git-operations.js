const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if the current directory is a Git repository
 */
function isGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the current branch name
 */
async function getCurrentBranch() {
  try {
    const result = execSync('git branch --show-current', { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error.message}`);
  }
}

/**
 * Get all local branches
 */
async function getLocalBranches() {
  try {
    const result = execSync('git branch --format="%(refname:short)"', { encoding: 'utf8' });
    return result
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch.length > 0);
  } catch (error) {
    throw new Error(`Failed to get local branches: ${error.message}`);
  }
}

/**
 * Delete a local branch
 */
async function deleteBranch(branchName) {
  try {
    // Use -D to force delete (equivalent to --delete --force)
    // This ensures we can delete branches even if they haven't been merged to current branch
    execSync(`git branch -D "${branchName}"`, { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
  }
}

/**
 * Get repository information (owner and name) from git remote
 */
async function getRepositoryInfo() {
  try {
    // Get the remote URL
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    
    // Parse GitHub URL to extract owner and repo name
    let owner, name;
    
    if (remoteUrl.startsWith('git@github.com:')) {
      // SSH format: git@github.com:owner/repo.git
      const match = remoteUrl.match(/git@github\.com:([^\/]+)\/(.+)\.git$/);
      if (match) {
        owner = match[1];
        name = match[2];
      }
    } else if (remoteUrl.startsWith('https://github.com/')) {
      // HTTPS format: https://github.com/owner/repo.git
      const match = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        owner = match[1];
        name = match[2];
      }
    }
    
    if (!owner || !name) {
      throw new Error(`Could not parse GitHub repository from remote URL: ${remoteUrl}`);
    }
    
    return { owner, name };
  } catch (error) {
    throw new Error(`Failed to get repository information: ${error.message}`);
  }
}

/**
 * Check if a branch exists locally
 */
async function branchExists(branchName) {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the commit hash for a branch
 */
async function getBranchCommit(branchName) {
  try {
    const result = execSync(`git rev-parse "${branchName}"`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    throw new Error(`Failed to get commit for branch ${branchName}: ${error.message}`);
  }
}

module.exports = {
  isGitRepository,
  getCurrentBranch,
  getLocalBranches,
  deleteBranch,
  getRepositoryInfo,
  branchExists,
  getBranchCommit
};
