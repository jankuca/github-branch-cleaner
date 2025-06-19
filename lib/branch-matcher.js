const githubApi = require('./github-api');
const gitOps = require('./git-operations');

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
 * Group branches by their PR status using batch fetching for better performance
 */
async function groupBranchesByPRStatus(octokit, repoInfo, branches) {
  const groups = {
    merged: [],
    closed: [],
    open: [],
    noPR: [],
    error: []
  };

  try {
    // Get the oldest commit date among all branches to limit PR fetching
    console.log('🔍 Analyzing local branch commit dates...');
    const oldestCommitDate = await gitOps.getOldestLocalCommitDate(branches);

    // Add buffer time to account for clock skew, rebases, etc.
    const bufferDays = 30;
    const searchSince = new Date(oldestCommitDate.getTime() - (bufferDays * 24 * 60 * 60 * 1000));

    console.log(`📡 Fetching PRs since ${searchSince.toISOString().split('T')[0]} (oldest local commit: ${oldestCommitDate.toISOString().split('T')[0]} + ${bufferDays}d buffer)...`);

    // Fetch PRs with time-based filtering
    const allPRs = await githubApi.getAllPullRequests(
      octokit,
      repoInfo.owner,
      repoInfo.name,
      { since: searchSince.toISOString() }
    );

    // Create a lookup map: branch name -> PR for O(1) lookups
    const branchToPRMap = new Map();
    allPRs.forEach(pr => {
      branchToPRMap.set(pr.head.ref, pr);
    });

    console.log(`✅ Found ${allPRs.length} recent PRs (time-filtered), processing ${branches.length} branches...`);

    // Now process each branch with local lookup, fetching details only when needed
    for (const branch of branches) {
      try {
        const basicPR = branchToPRMap.get(branch);

        if (!basicPR) {
          groups.noPR.push({ branch, pr: null });
        } else {
          // Fetch detailed PR info to get the 'merged' property
          const detailedPR = await githubApi.getPullRequestDetails(
            octokit,
            repoInfo.owner,
            repoInfo.name,
            basicPR.number
          );

          if (detailedPR.merged) {
            groups.merged.push({ branch, pr: detailedPR });
          } else if (detailedPR.state === 'closed') {
            groups.closed.push({ branch, pr: detailedPR });
          } else if (detailedPR.state === 'open') {
            groups.open.push({ branch, pr: detailedPR });
          }
        }
      } catch (error) {
        groups.error.push({ branch, error: error.message });
      }
    }
  } catch (error) {
    // Fallback to the original method if batch fetching fails
    console.warn(`⚠️  Batch fetching failed (${error.message}), falling back to individual branch lookup...`);

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

/**
 * Optimized function to find branches to delete using batch PR fetching
 * This is more efficient than the groupBranchesByPRStatus + filterBranchesForDeletion approach
 */
async function findBranchesToDelete(octokit, repoInfo, branches, options, currentBranch) {
  const branchesToDelete = [];
  const branchStatus = [];

  try {
    // Get the oldest commit date among all branches to limit PR fetching
    console.log('🔍 Analyzing local branch commit dates...');
    const oldestCommitDate = await gitOps.getOldestLocalCommitDate(branches);

    // Add buffer time to account for clock skew, rebases, etc.
    const bufferDays = 30;
    const searchSince = new Date(oldestCommitDate.getTime() - (bufferDays * 24 * 60 * 60 * 1000));

    console.log(`📡 Fetching PRs since ${searchSince.toISOString().split('T')[0]} (oldest local commit: ${oldestCommitDate.toISOString().split('T')[0]} + ${bufferDays}d buffer)...`);

    // Fetch PRs with time-based filtering
    const allPRs = await githubApi.getAllPullRequests(
      octokit,
      repoInfo.owner,
      repoInfo.name,
      { since: searchSince.toISOString() }
    );

    // Create a lookup map: branch name -> PR for O(1) lookups
    const branchToPRMap = new Map();
    allPRs.forEach(pr => {
      branchToPRMap.set(pr.head.ref, pr);
    });

    console.log(`✅ Found ${allPRs.length} recent PRs (time-filtered), processing ${branches.length} branches...`);

    // Process each branch with local lookup, fetching details only when needed
    for (const branch of branches) {
      try {
        const basicPR = branchToPRMap.get(branch);

        if (!basicPR) {
          branchStatus.push({ branch, pr: null, status: 'No PR found' });
          continue;
        }

        // Fetch detailed PR info to get the 'merged' property
        const detailedPR = await githubApi.getPullRequestDetails(
          octokit,
          repoInfo.owner,
          repoInfo.name,
          basicPR.number
        );

        const shouldDelete = shouldDeleteBranch(detailedPR, options);
        const status = detailedPR.merged ? 'merged' : detailedPR.state;

        branchStatus.push({
          branch,
          pr: detailedPR,
          status: `${status} PR #${detailedPR.number} - "${detailedPR.title}"`,
          shouldDelete
        });

        if (shouldDelete && isBranchSafeToDelete(branch, currentBranch)) {
          const reason = detailedPR.merged ? 'merged' : 'closed';
          branchesToDelete.push({ branch, pr: detailedPR, reason });
        }
      } catch (error) {
        branchStatus.push({
          branch,
          pr: null,
          status: `Error: ${error.message}`,
          shouldDelete: false
        });
      }
    }
  } catch (error) {
    // Fallback to the original method if batch fetching fails
    console.warn(`⚠️  Batch fetching failed (${error.message}), falling back to individual branch lookup...`);

    for (const branch of branches) {
      try {
        const pr = await findPRForBranch(octokit, repoInfo, branch);

        if (!pr) {
          branchStatus.push({ branch, pr: null, status: 'No PR found' });
          continue;
        }

        const shouldDelete = shouldDeleteBranch(pr, options);
        const status = pr.merged ? 'merged' : pr.state;

        branchStatus.push({
          branch,
          pr,
          status: `${status} PR #${pr.number} - "${pr.title}"`,
          shouldDelete
        });

        if (shouldDelete && isBranchSafeToDelete(branch, currentBranch)) {
          const reason = pr.merged ? 'merged' : 'closed';
          branchesToDelete.push({ branch, pr, reason });
        }
      } catch (error) {
        branchStatus.push({
          branch,
          pr: null,
          status: `Error: ${error.message}`,
          shouldDelete: false
        });
      }
    }
  }

  return { branchesToDelete, branchStatus };
}

module.exports = {
  findPRForBranch,
  shouldDeleteBranch,
  getPRStatusSummary,
  isBranchSafeToDelete,
  groupBranchesByPRStatus,
  filterBranchesForDeletion,
  findBranchesToDelete
};
