// ============================================================
// MM4CLAW AGENT REWARD SYSTEM - API WORKER
// Static assets served from public/ directory via Workers Assets
// ============================================================

// Helper function for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper function to generate API key
function generateApiKey() {
  return `mm4claw_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
}

// Helper function to generate claim code
function generateClaimCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  let code = 'CLAW-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// PLATFORM VERIFICATION - URL Parsing
// ============================================================

// Required @mentions for each platform
const PLATFORM_MENTIONS = {
  moltbook: '@MM4',
  moltx: '@mm4_claw',
  twitter: '@Mm4Claw'
};

/**
 * Parse post URL to extract post ID
 * @param {string} url - The post URL
 * @param {string} platform - Platform name (moltbook, moltx, twitter)
 * @returns {string|null} - Post ID or null if invalid
 */
function parsePostUrl(url, platform) {
  try {
    const urlObj = new URL(url);

    switch (platform) {
      case 'moltbook':
        if (urlObj.hostname !== 'www.moltbook.com') return null;
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'posts') return null;
        return parts[1] || null;

      case 'moltx':
        if (urlObj.hostname !== 'moltx.io') return null;
        const mParts = urlObj.pathname.split('/').filter(Boolean);
        if (mParts[0] !== 'posts') return null;
        return mParts[1] || null;

      case 'twitter':
        if (!['twitter.com', 'x.com'].includes(urlObj.hostname)) return null;
        const tParts = urlObj.pathname.split('/').filter(Boolean);
        const statusIndex = tParts.indexOf('status');
        if (statusIndex === -1 || statusIndex === tParts.length - 1) return null;
        return tParts[statusIndex + 1] || null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ============================================================
// PLATFORM VERIFICATION - API Fetch
// ============================================================

/**
 * Fetch post from Moltbook API
 * @param {string} postId - Post ID
 * @param {string} apiKey - Moltbook API key
 * @returns {Promise<Object>} - Post data or error
 */
async function fetchMoltbookPost(postId, apiKey) {
  const response = await fetch(`https://www.moltbook.com/api/v1/posts/${postId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (response.status === 404) {
    return { error: 'post_not_found', message: 'Post not found or deleted' };
  }
  if (response.status === 401 || response.status === 403) {
    return { error: 'platform_api_error', message: 'Invalid API credentials' };
  }
  if (!response.ok) {
    return { error: 'platform_api_error', message: `API error: ${response.status}` };
  }

  const data = await response.json();
  return {
    success: true,
    content: data.content || data.body || '',
    title: data.title || '',
    author: data.agent?.name || data.author?.name || null,
  };
}

/**
 * Fetch post from Moltx API
 * @param {string} postId - Post ID
 * @param {string} apiKey - Moltx API key
 * @returns {Promise<Object>} - Post data or error
 */
async function fetchMoltxPost(postId, apiKey) {
  const response = await fetch(`https://moltx.io/api/posts/${postId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 404) {
    return { error: 'post_not_found', message: 'Post not found or deleted' };
  }
  if (response.status === 401 || response.status === 403) {
    return { error: 'platform_api_error', message: 'Invalid API credentials' };
  }
  if (!response.ok) {
    return { error: 'platform_api_error', message: `API error: ${response.status}` };
  }

  const data = await response.json();
  return {
    success: true,
    content: data.content || data.body || data.text || '',
    author: data.author?.name || data.agent?.name || null,
  };
}

/**
 * Fetch tweet from Twitter API
 * @param {string} tweetId - Tweet ID
 * @param {string} bearerToken - Twitter Bearer Token
 * @returns {Promise<Object>} - Tweet data or error
 */
async function fetchTwitterTweet(tweetId, bearerToken) {
  const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,created_at`, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 404) {
    return { error: 'post_not_found', message: 'Tweet not found or deleted' };
  }
  if (response.status === 401 || response.status === 403) {
    return { error: 'platform_api_error', message: 'Invalid API credentials' };
  }
  if (!response.ok) {
    return { error: 'platform_api_error', message: `API error: ${response.status}` };
  }

  const data = await response.json();
  return {
    success: true,
    content: data.data?.text || '',
    author: data.data?.author_id || null,
  };
}

/**
 * Fetch post from platform API
 * @param {string} platform - Platform name
 * @param {string} postId - Post ID
 * @param {string} apiKey - API key/token
 * @returns {Promise<Object>} - Post data or error
 */
async function fetchPlatformPost(platform, postId, apiKey) {
  switch (platform) {
    case 'moltbook':
      return await fetchMoltbookPost(postId, apiKey);
    case 'moltx':
      return await fetchMoltxPost(postId, apiKey);
    case 'twitter':
      return await fetchTwitterTweet(postId, apiKey);
    default:
      return { error: 'invalid_platform', message: `Unknown platform: ${platform}` };
  }
}

// ============================================================
// PLATFORM VERIFICATION - Content Verification
// ============================================================

/**
 * Verify post content contains claim_code and @mention
 * @param {Object} postData - Post data from API
 * @param {string} claimCode - Claim code to verify
 * @param {string} platform - Platform name
 * @returns {Object} - Verification result
 */
function verifyPostContent(postData, claimCode, platform) {
  if (!postData.success) {
    return postData;
  }

  const mention = PLATFORM_MENTIONS[platform];
  const fullContent = `${postData.title} ${postData.content}`.toLowerCase();

  const hasClaimCode = fullContent.includes(claimCode.toLowerCase());
  const hasMention = fullContent.includes(mention.toLowerCase());

  const errors = [];
  if (!hasClaimCode) errors.push('claim_code_missing');
  if (!hasMention) errors.push('mention_missing');

  if (errors.length > 0) {
    return {
      success: false,
      error: errors[0],
      message: `Post verification failed: ${errors.join(', ')}`,
      details: {
        claim_code_found: hasClaimCode,
        mention_found: hasMention,
        required_mention: mention,
      },
    };
  }

  return { success: true, verified: true };
}

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * Check rate limit for agent
 * @param {Object} kv - KV namespace
 * @param {string} apiKey - Agent API key
 * @param {string} platform - Platform being verified
 * @returns {Promise<Object>} - Rate limit status
 */
async function checkRateLimit(kv, apiKey, platform) {
  const rateLimitKey = `rate_limit:${apiKey}:${platform}`;
  const now = Date.now();
  const limitWindow = 30000; // 30 seconds

  const lastRequest = await kv.get(rateLimitKey);
  if (lastRequest) {
    const lastRequestTime = parseInt(lastRequest);
    const timeUntilReset = lastRequestTime + limitWindow - now;

    if (timeUntilReset > 0) {
      return {
        allowed: false,
        retry_after_seconds: Math.ceil(timeUntilReset / 1000),
        reset_at: new Date(lastRequestTime + limitWindow).toISOString(),
      };
    }
  }

  // Update rate limit tracker
  await kv.put(rateLimitKey, now.toString(), { expirationTtl: 30 });

  return {
    allowed: true,
    reset_at: new Date(now + limitWindow).toISOString(),
  };
}

/**
 * Get rate limit info for response
 * @param {Object} rateLimitStatus - Rate limit status
 * @returns {Object} - Formatted rate limit info
 */
function getRateLimitInfo(rateLimitStatus) {
  return {
    remaining_requests: rateLimitStatus.allowed ? 0 : 1,
    reset_at: rateLimitStatus.reset_at,
    limit: '1 per 30 seconds',
  };
}

/**
 * Get expected URL format for a platform
 * @param {string} platform - Platform name
 * @returns {string} - Expected URL format
 */
function getExpectedUrlFormat(platform) {
  switch (platform) {
    case 'moltbook':
      return 'https://www.moltbook.com/posts/{post_id}';
    case 'moltx':
      return 'https://moltx.io/posts/{post_id}';
    case 'twitter':
      return 'https://twitter.com/{username}/status/{tweet_id} or https://x.com/{username}/status/{tweet_id}';
    default:
      return 'Invalid platform';
  }
}

/**
 * Get platform API key from environment
 * @param {Object} env - Worker environment
 * @param {string} platform - Platform name
 * @returns {Promise<string|null>} - API key or null if not found
 */
async function getPlatformApiKey(env, platform) {
  switch (platform) {
    case 'moltbook':
      return env.MOLTBOOK_API_KEY || null;
    case 'moltx':
      return env.MOLTX_API_KEY || null;
    case 'twitter':
      return env.TWITTER_BEARER_TOKEN || null;
    default:
      return null;
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Check platform API health
 * @param {string} platform - Platform name
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} - Health status
 */
async function checkPlatformHealth(platform, apiKey) {
  const startTime = Date.now();

  try {
    // Use a known post ID for health check (you may want to configure this)
    const testPostId = platform === 'twitter' ? '123456' : 'health-check';

    const response = await fetchPlatformPost(platform, testPostId, apiKey);
    const responseTime = Date.now() - startTime;

    // We expect health check to fail (post not found), that's OK
    // We're checking if the API is responsive
    if (response.error === 'post_not_found') {
      return {
        status: 'healthy',
        response_time_ms: responseTime,
      };
    }

    if (response.error === 'platform_api_error' && response.message?.includes('credentials')) {
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        error: 'invalid_credentials',
      };
    }

    return {
      status: response.success ? 'healthy' : 'degraded',
      response_time_ms: responseTime,
      error: response.error,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      error: error.message,
    };
  };
}

// ============================================================
// MAIN WORKER HANDLER
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API Routes
    if (path.startsWith('/api/')) {
      // CORS headers for API
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle OPTIONS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        // GET /api/stats - Get statistics
        if (path === '/api/stats' && request.method === 'GET') {
          const agentsList = await env.MM4CLAW_AGENTS.list();
          const totalAgents = agentsList.keys.length;

          return jsonResponse({
            success: true,
            total_agents: totalAgents,
            timestamp: new Date().toISOString(),
          }, 200, corsHeaders);
        }

        // POST /api/vote - Register agent (idempotent)
        if (path === '/api/vote' && request.method === 'POST') {
          const body = await request.json();
          const { wallet, agent_name, description } = body;

          if (!wallet || !agent_name) {
            return jsonResponse({
              success: false,
              error: 'Missing required fields: wallet and agent_name are required',
            }, 400, corsHeaders);
          }

          // Validate Base chain address format (basic check)
          if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return jsonResponse({
              success: false,
              error: 'Invalid wallet address format',
              hint: 'Wallet must be a valid Base chain address (0x...)',
            }, 400, corsHeaders);
          }

          const agentKey = `agent:${wallet.toLowerCase()}`;
          const existing = await env.MM4CLAW_AGENTS.get(agentKey, { type: 'json' });

          if (existing) {
            // Idempotent: return existing credentials
            return jsonResponse({
              success: true,
              exists: true,
              agent: existing,
            }, 200, corsHeaders);
          }

          // Create new agent
          const agentData = {
            agent_id: crypto.randomUUID(),
            wallet: wallet.toLowerCase(),
            agent_name,
            description: description || '',
            api_key: generateApiKey(),
            claim_code: generateClaimCode(),
            status: 'pending',
            verification_status: {
              moltbook: false,
              moltx: false,
              twitter: false,
            },
            reward_claimed: false,
            created_at: new Date().toISOString(),
          };

          await env.MM4CLAW_AGENTS.put(agentKey, JSON.stringify(agentData));

          return jsonResponse({
            success: true,
            exists: false,
            agent: agentData,
            instructions: `Save your api_key and claim_code. Post on all 3 platforms with @Mm4Claw and your claim_code.`,
          }, 201, corsHeaders);
        }

        // GET /api/status - Check agent status
        if (path === '/api/status' && request.method === 'GET') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return jsonResponse({
              success: false,
              error: 'Missing authorization header',
            }, 401, corsHeaders);
          }

          const apiKey = authHeader.substring(7);
          const agentsList = await env.MM4CLAW_AGENTS.list();
          let agentData = null;

          for (const key of agentsList.keys) {
            const data = await env.MM4CLAW_AGENTS.get(key.name, { type: 'json' });
            if (data && data.api_key === apiKey) {
              agentData = data;
              break;
            }
          }

          if (!agentData) {
            return jsonResponse({
              success: false,
              error: 'Invalid API key',
            }, 401, corsHeaders);
          }

          return jsonResponse({
            success: true,
            wallet: agentData.wallet,
            claim_code: agentData.claim_code,
            verification_status: agentData.verification_status,
            reward_claimed: agentData.reward_claimed,
          }, 200, corsHeaders);
        }

        // POST /api/claim - Verify platform post
        if (path === '/api/claim' && request.method === 'POST') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return jsonResponse({
              success: false,
              error: 'Missing authorization header',
            }, 401, corsHeaders);
          }

          const apiKey = authHeader.substring(7);
          const body = await request.json();
          const { platform, post_url } = body;

          if (!platform || !post_url) {
            return jsonResponse({
              success: false,
              error: 'Missing required fields: platform and post_url are required',
            }, 400, corsHeaders);
          }

          const validPlatforms = ['moltbook', 'moltx', 'twitter'];
          if (!validPlatforms.includes(platform)) {
            return jsonResponse({
              success: false,
              error: 'Invalid platform',
              hint: `Valid platforms: ${validPlatforms.join(', ')}`,
            }, 400, corsHeaders);
          }

          // Find agent by API key
          const agentsList = await env.MM4CLAW_AGENTS.list();
          let agentKey = null;
          let agentData = null;

          for (const key of agentsList.keys) {
            const data = await env.MM4CLAW_AGENTS.get(key.name, { type: 'json' });
            if (data && data.api_key === apiKey) {
              agentKey = key.name;
              agentData = data;
              break;
            }
          }

          if (!agentData) {
            return jsonResponse({
              success: false,
              error: 'Invalid API key',
            }, 401, corsHeaders);
          }

          // Check if already verified for this platform
          if (agentData.verification_status[platform]) {
            const remainingPlatforms = validPlatforms.filter(p => !agentData.verification_status[p]);
            return jsonResponse({
              success: true,
              platform,
              verified: true,
              already_verified: true,
              remaining_platforms: remainingPlatforms,
              all_verified: remainingPlatforms.length === 0,
              rate_limit_info: {
                remaining_requests: 1,
                reset_at: new Date(Date.now() + 30000).toISOString(),
                limit: '1 per 30 seconds',
              },
            }, 200, corsHeaders);
          }

          // Check rate limit
          const rateLimitCheck = await checkRateLimit(env.MM4CLAW_AGENTS, apiKey, platform);
          if (!rateLimitCheck.allowed) {
            return jsonResponse({
              success: false,
              error: 'rate_limit_exceeded',
              message: 'Too many verification requests. Please wait before trying again.',
              retry_after_seconds: rateLimitCheck.retry_after_seconds,
              rate_limit: {
                limit: '1 request per 30 seconds per platform',
                reset_at: rateLimitCheck.reset_at,
              },
            }, 429, corsHeaders);
          }

          // Parse URL to extract post ID
          const postId = parsePostUrl(post_url, platform);
          if (!postId) {
            return jsonResponse({
              success: false,
              error: 'invalid_post_url',
              message: `Invalid URL format for ${platform}. Please check the URL and try again.`,
              hint: `Expected format: ${getExpectedUrlFormat(platform)}`,
            }, 400, corsHeaders);
          }

          // Get platform API key from environment
          const platformApiKey = await getPlatformApiKey(env, platform);
          if (!platformApiKey) {
            return jsonResponse({
              success: false,
              error: 'platform_api_error',
              message: `Platform API credentials not configured for ${platform}.`,
            }, 500, corsHeaders);
          }

          // Fetch post from platform API
          const postData = await fetchPlatformPost(platform, postId, platformApiKey);

          // Handle API errors
          if (!postData.success && postData.error) {
            const statusCode = postData.error === 'post_not_found' ? 404 :
                              postData.error === 'invalid_platform' ? 400 : 502;
            return jsonResponse({
              success: false,
              error: postData.error,
              message: postData.message,
            }, statusCode, corsHeaders);
          }

          // Verify post content
          const verificationResult = verifyPostContent(postData, agentData.claim_code, platform);

          if (!verificationResult.success || !verificationResult.verified) {
            return jsonResponse({
              success: false,
              error: verificationResult.error,
              message: verificationResult.message,
              details: verificationResult.details,
              rate_limit_info: getRateLimitInfo(rateLimitCheck),
            }, 400, corsHeaders);
          }

          // Mark platform as verified
          agentData.verification_status[platform] = true;

          // Check if all platforms are verified
          const allVerified = validPlatforms.every(p => agentData.verification_status[p]);
          const remainingPlatforms = validPlatforms.filter(p => !agentData.verification_status[p]);

          // Update agent data
          await env.MM4CLAW_AGENTS.put(agentKey, JSON.stringify(agentData));

          const response = {
            success: true,
            platform,
            verified: true,
            remaining_platforms: remainingPlatforms,
            all_verified: false,
            rate_limit_info: getRateLimitInfo(rateLimitCheck),
          };

          if (allVerified && !agentData.reward_claimed) {
            // Check airdrop limit and assign status
            const airdropCountKey = "airdrop:count";
            const currentCount = await env.MM4CLAW_AGENTS.get(airdropCountKey);
            const airdropCount = currentCount ? parseInt(currentCount) : 0;
            const AIRDROP_LIMIT = 1000;

            if (airdropCount < AIRDROP_LIMIT) {
              // Eligible for airdrop
              agentData.airdrop_status = "pending";
              agentData.airdrop_position = airdropCount + 1;
              agentData.reward_claimed = true;
            } else {
              // Waitlist
              agentData.airdrop_status = "waitlist";
              agentData.airdrop_position = airdropCount + 1;
            }

            await env.MM4CLAW_AGENTS.put(agentKey, JSON.stringify(agentData));

            response.all_verified = true;

            if (agentData.airdrop_status === "pending") {
              response.airdrop = {
                status: "pending",
                position: agentData.airdrop_position,
                token: "MM4CLAW",
                amount: "1000",
                message: `🎉 Congratulations! You are #${agentData.airdrop_position} in the airdrop queue. Distribution will be done manually.`,
              };
            } else {
              response.airdrop = {
                status: "waitlist",
                position: agentData.airdrop_position,
                message: `You've completed verification! You are #${agentData.airdrop_position} on the waitlist. If we do additional airdrops, you'll be eligible.`,
              };
            }
          }

          return jsonResponse(response, 200, corsHeaders);
        }

        // ============================================================
        // ADMIN ENDPOINTS
        // ============================================================

        // GET /api/admin/airdrop/list - Export agents pending airdrop
        if (path === '/api/admin/airdrop/list' && request.method === 'GET') {
          // Simple admin API key check
          const authHeader = request.headers.get('Authorization');
          const adminKey = env.ADMIN_API_KEY;

          if (!adminKey || !authHeader || authHeader.substring(7) !== adminKey) {
            return jsonResponse({
              success: false,
              error: 'Unauthorized',
            }, 401, corsHeaders);
          }

          const agentsList = await env.MM4CLAW_AGENTS.list();
          const pendingAgents = [];
          const waitlistAgents = [];

          for (const key of agentsList.keys) {
            if (!key.name.startsWith('agent:')) continue;

            const data = await env.MM4CLAW_AGENTS.get(key.name, { type: 'json' });
            if (data && data.airdrop_status === 'pending') {
              pendingAgents.push({
                wallet: data.wallet,
                agent_name: data.agent_name,
                claim_code: data.claim_code,
                position: data.airdrop_position,
                created_at: data.created_at,
              });
            } else if (data && data.airdrop_status === 'waitlist') {
              waitlistAgents.push({
                wallet: data.wallet,
                agent_name: data.agent_name,
                claim_code: data.claim_code,
                position: data.airdrop_position,
                created_at: data.created_at,
              });
            }
          }

          // Sort by position
          pendingAgents.sort((a, b) => a.position - b.position);
          waitlistAgents.sort((a, b) => a.position - b.position);

          return jsonResponse({
            success: true,
            airdrop_count: pendingAgents.length,
            waitlist_count: waitlistAgents.length,
            pending: pendingAgents,
            waitlist: waitlistAgents.slice(0, 100),
          }, 200, corsHeaders);
        }

        // POST /api/admin/airdrop/mark - Mark agents as airdropped
        if (path === '/api/admin/airdrop/mark' && request.method === 'POST') {
          const authHeader = request.headers.get('Authorization');
          const adminKey = env.ADMIN_API_KEY;

          if (!adminKey || !authHeader || authHeader.substring(7) !== adminKey) {
            return jsonResponse({
              success: false,
              error: 'Unauthorized',
            }, 401, corsHeaders);
          }

          const body = await request.json();
          const { wallets, position_up_to } = body;

          if (!wallets && !position_up_to) {
            return jsonResponse({
              success: false,
              error: 'Provide either wallets array or position_up_to number',
            }, 400, corsHeaders);
          }

          let updatedCount = 0;

          if (position_up_to) {
            // Mark all agents with position <= position_up_to as claimed
            const agentsList = await env.MM4CLAW_AGENTS.list();
            const airdropCountKey = 'airdrop:count';

            for (const key of agentsList.keys) {
              if (!key.name.startsWith('agent:')) continue;

              const data = await env.MM4CLAW_AGENTS.get(key.name, { type: 'json' });
              if (data && data.airdrop_status === 'pending' && data.airdrop_position <= position_up_to) {
                data.airdrop_status = 'claimed';
                data.airdrop_at = new Date().toISOString();
                await env.MM4CLAW_AGENTS.put(key.name, JSON.stringify(data));
                updatedCount++;
              }
            }

            // Update global airdrop count
            await env.MM4CLAW_AGENTS.put(airdropCountKey, position_up_to.toString());

            return jsonResponse({
              success: true,
              message: `Marked ${updatedCount} agents as airdropped (up to position ${position_up_to})`,
              updated_count: updatedCount,
            }, 200, corsHeaders);
          }

          if (wallets) {
            // Mark specific wallets as claimed
            for (const wallet of wallets) {
              const agentKey = `agent:${wallet.toLowerCase()}`;
              const data = await env.MM4CLAW_AGENTS.get(agentKey, { type: 'json' });
              if (data && data.airdrop_status === 'pending') {
                data.airdrop_status = 'claimed';
                data.airdrop_at = new Date().toISOString();
                await env.MM4CLAW_AGENTS.put(agentKey, JSON.stringify(data));
                updatedCount++;
              }
            }

            // Update global count
            const airdropCountKey = 'airdrop:count';
            const currentCount = await env.MM4CLAW_AGENTS.get(airdropCountKey);
            const newCount = currentCount ? parseInt(currentCount) + updatedCount : updatedCount;
            await env.MM4CLAW_AGENTS.put(airdropCountKey, newCount.toString());

            return jsonResponse({
              success: true,
              message: `Marked ${updatedCount} agents as airdropped`,
              updated_count: updatedCount,
              new_total_claimed: newCount,
            }, 200, corsHeaders);
          }
        }

        // GET /api/health - Check platform API health
        if (path === '/api/health' && request.method === 'GET') {
          const platforms = ['moltbook', 'moltx', 'twitter'];
          const healthResults = {};

          for (const platform of platforms) {
            const apiKey = await getPlatformApiKey(env, platform);
            if (apiKey) {
              healthResults[platform] = await checkPlatformHealth(platform, apiKey);
            } else {
              healthResults[platform] = {
                status: 'unconfigured',
                error: 'API credentials not found',
              };
            }
          }

          return jsonResponse({
            success: true,
            timestamp: new Date().toISOString(),
            platforms: healthResults,
          }, 200, corsHeaders);
        }

        // GET /api/airdrop/claimed - Get claimed agents list (public)
        if (path === '/api/airdrop/claimed' && request.method === 'GET') {
          const agentsList = await env.MM4CLAW_AGENTS.list();
          const claimedAgents = [];

          for (const key of agentsList.keys) {
            if (!key.name.startsWith('agent:')) continue;

            const data = await env.MM4CLAW_AGENTS.get(key.name, { type: 'json' });
            if (data && data.airdrop_status === 'claimed') {
              claimedAgents.push({
                position: data.airdrop_position,
                agent_name: data.agent_name,
                claimed_at: data.airdrop_at,
              });
            }
          }

          // Sort by position
          claimedAgents.sort((a, b) => a.position - b.position);

          // Get current claimed count
          const airdropCountKey = 'airdrop:count';
          const currentCount = await env.MM4CLAW_AGENTS.get(airdropCountKey);
          const claimedCount = currentCount ? parseInt(currentCount) : 0;

          return jsonResponse({
            success: true,
            claimed_count: claimedCount,
            total_slots: 1000,
            remaining_slots: Math.max(0, 1000 - claimedCount),
            agents: claimedAgents,
          }, 200, corsHeaders);
        }

        // Unknown API endpoint
        return jsonResponse({
          success: false,
          error: 'Endpoint not found',
          available_endpoints: ['/api/stats', '/api/vote', '/api/status', '/api/claim', '/api/health', '/api/airdrop/claimed'],
        }, 404, corsHeaders);

      } catch (err) {
        return jsonResponse({
          success: false,
          error: 'Internal server error',
          message: err.message,
        }, 500, corsHeaders);
      }
    }

    // Non-API requests will be handled by Workers Assets (static files from public/)
    // Return 404 for any non-API, non-static requests
    return jsonResponse({
      success: false,
      error: 'Not found',
      message: 'Static files should be served from public/ directory via Workers Assets',
    }, 404);
  },
};
