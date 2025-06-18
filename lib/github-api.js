const { Octokit } = require('@octokit/rest');

/**
 * Initialize GitHub API client
 */
function initialize(token) {
  return new Octokit({
    auth: token,
  });
}

/**
 * Find pull requests for a specific branch
 */
async function findPullRequestsForBranch(octokit, owner, repo, branchName) {
  try {
    // Search for PRs with the specific head branch
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branchName}`,
      state: 'all', // Include open, closed, and merged PRs
      sort: 'updated',
      direction: 'desc'
    });

    return data;
  } catch (error) {
    // If the specific head search fails, try a more general search
    if (error.status === 422) {
      try {
        const { data } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'all',
          sort: 'updated',
          direction: 'desc'
        });

        // Filter PRs that match the branch name
        return data.filter(pr => pr.head.ref === branchName);
      } catch (fallbackError) {
        throw new Error(`Failed to fetch PRs: ${fallbackError.message}`);
      }
    }
    throw new Error(`Failed to fetch PRs for branch ${branchName}: ${error.message}`);
  }
}

/**
 * Get detailed information about a specific pull request
 */
async function getPullRequestDetails(octokit, owner, repo, prNumber) {
  try {
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to get PR details for #${prNumber}: ${error.message}`);
  }
}

/**
 * Check if a pull request is merged
 */
async function isPullRequestMerged(octokit, owner, repo, prNumber) {
  try {
    await octokit.rest.pulls.checkIfMerged({
      owner,
      repo,
      pull_number: prNumber
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw new Error(`Failed to check if PR #${prNumber} is merged: ${error.message}`);
  }
}

/**
 * Get repository information
 */
async function getRepositoryInfo(octokit, owner, repo) {
  try {
    const { data } = await octokit.rest.repos.get({
      owner,
      repo
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to get repository info: ${error.message}`);
  }
}

/**
 * Search for pull requests using GitHub's search API
 */
async function searchPullRequests(octokit, owner, repo, query) {
  try {
    const searchQuery = `repo:${owner}/${repo} is:pr ${query}`;
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
      sort: 'updated',
      order: 'desc'
    });

    return data.items;
  } catch (error) {
    throw new Error(`Failed to search PRs: ${error.message}`);
  }
}

/**
 * Get all pull requests for a repository with pagination
 */
async function getAllPullRequests(octokit, owner, repo, state = 'all') {
  try {
    const allPRs = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo,
        state,
        sort: 'updated',
        direction: 'desc',
        page,
        per_page: perPage
      });

      allPRs.push(...data);

      // If we got fewer results than requested, we've reached the end
      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return allPRs;
  } catch (error) {
    throw new Error(`Failed to get all PRs: ${error.message}`);
  }
}

module.exports = {
  initialize,
  findPullRequestsForBranch,
  getPullRequestDetails,
  isPullRequestMerged,
  getRepositoryInfo,
  searchPullRequests,
  getAllPullRequests
};
