const githubApi = require('./github-api');

/**
 * Find the pull request associated with a branch
 */
async function findPRForBranch(octokit, repoInfo, branchName) {
  try {
    // First, try to find PRs with exact branch match
    const prs = await githubApi.findPullRequestsForBranch(
      octokit,
      repoInfo.owner,
      repoInfo.name,
      branchName
    );

    if (prs.length > 0) {
      // Get full PR details to ensure we have the 'merged' property
      const prDetails = await githubApi.getPullRequestDetails(
        octokit,
        repoInfo.owner,
        repoInfo.name,
        prs[0].number
      );
      return prDetails;
    }

    // If no exact match, try searching with different strategies
    const searchStrategies = [
      // Try searching by branch name in the title or body
      `head:${branchName}`,
      // Try searching for branch name in PR title
      `in:title ${branchName}`,
      // Try searching for branch name anywhere
      branchName
    ];

    for (const query of searchStrategies) {
      try {
        const searchResults = await githubApi.searchPullRequests(
          octokit,
          repoInfo.owner,
          repoInfo.name,
          query
        );

        // Filter results to find exact branch matches
        const exactMatch = searchResults.find(pr =>
          pr.pull_request && pr.pull_request.head && pr.pull_request.head.ref === branchName
        );

        if (exactMatch) {
          // Get full PR details
          const prDetails = await githubApi.getPullRequestDetails(
            octokit,
            repoInfo.owner,
            repoInfo.name,
            exactMatch.number
          );
          return prDetails;
        }
      } catch (searchError) {
        // Continue to next strategy if this one fails
        console.warn(`Search strategy "${query}" failed: ${searchError.message}`);
      }
    }

    // Last resort: get all PRs and find a match
    try {
      const allPRs = await githubApi.getAllPullRequests(
        octokit,
        repoInfo.owner,
        repoInfo.name
      );

      const matchingPR = allPRs.find(pr => pr.head.ref === branchName);
      if (matchingPR) {
        // Get full PR details to ensure we have the 'merged' property
        const prDetails = await githubApi.getPullRequestDetails(
          octokit,
          repoInfo.owner,
          repoInfo.name,
          matchingPR.number
        );
        return prDetails;
      }
      return null;
    } catch (error) {
      console.warn(`Failed to get all PRs: ${error.message}`);
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to find PR for branch ${branchName}: ${error.message}`);
  }
}

/**
 * Determine if a branch should be deleted based on its PR status and options
 */
function shouldDeleteBranch(pr, options) {
  if (!pr) {
    return false;
  }

  // Check if PR is merged
  if (options.merged && pr.merged) {
    return true;
  }

  // Check if PR is closed (but not merged)
  if (options.closed && pr.state === 'closed' && !pr.merged) {
    return true;
  }

  return false;
}

/**
 * Get a summary of the PR status
 */
function getPRStatusSummary(pr) {
  if (!pr) {
    return 'No PR found';
  }

  if (pr.merged) {
    return `Merged (${pr.state})`;
  }

  return pr.state.charAt(0).toUpperCase() + pr.state.slice(1);
}

/**
 * Validate that a branch is safe to delete
 */
function isBranchSafeToDelete(branchName, currentBranch, protectedBranches = ['main', 'master', 'develop', 'dev']) {
  // Don't delete current branch
  if (branchName === currentBranch) {
    return false;
  }

  // Don't delete protected branches
  if (protectedBranches.includes(branchName)) {
    return false;
  }

  return true;
}

/**
 * Group branches by their PR status
 */
async function groupBranchesByPRStatus(octokit, repoInfo, branches) {
  const groups = {
    merged: [],
    closed: [],
    open: [],
    noPR: [],
    error: []
  };

  for (const branch of branches) {
    try {
      const pr = await findPRForBranch(octokit, repoInfo, branch);

      if (!pr) {
        groups.noPR.push({ branch, pr: null });
      } else if (pr.merged) {
        groups.merged.push({ branch, pr });
      } else if (pr.state === 'closed') {
        groups.closed.push({ branch, pr });
      } else if (pr.state === 'open') {
        groups.open.push({ branch, pr });
      }
    } catch (error) {
      groups.error.push({ branch, error: error.message });
    }
  }

  return groups;
}

/**
 * Filter branches that match the deletion criteria
 */
function filterBranchesForDeletion(branchGroups, options, currentBranch) {
  const branchesToDelete = [];

  if (options.merged) {
    branchGroups.merged.forEach(({ branch, pr }) => {
      if (isBranchSafeToDelete(branch, currentBranch)) {
        branchesToDelete.push({ branch, pr, reason: 'merged' });
      }
    });
  }

  if (options.closed) {
    branchGroups.closed.forEach(({ branch, pr }) => {
      if (isBranchSafeToDelete(branch, currentBranch)) {
        branchesToDelete.push({ branch, pr, reason: 'closed' });
      }
    });
  }

  return branchesToDelete;
}

module.exports = {
  findPRForBranch,
  shouldDeleteBranch,
  getPRStatusSummary,
  isBranchSafeToDelete,
  groupBranchesByPRStatus,
  filterBranchesForDeletion
};
