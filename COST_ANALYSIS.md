# MM4CLAW Cost Analysis

**Last Updated:** 2025-02-04

## Overview

This document analyzes the running costs of MM4CLAW Agent Reward System hosted on Cloudflare Workers.

---

## Cloudflare Pricing (as of 2025)

### Free Tier (Workers Paid)

| Resource | Free Tier | Paid Tier |
|----------|-----------|------------|
| **Workers Requests** | 100,000/day | $5/million |
| **Workers CPU Time** | Included | $12.50/million ms |
| **KV Reads** | 1,000/day | $0.50/million |
| **KV Writes** | 1,000/day | $5.00/million |
| **KV Storage** | 1 GB | $0.50/GB/month |
| **KV List Operations** | 1,000/day | $0.50/million |

**Workers Paid Plan:** $5/month minimum when exceeding free tier

---

## Estimated Monthly Costs

### Scenario 1: Low Traffic (100 agents, ~1,000 requests/day)

| Item | Daily | Monthly | Cost |
|------|-------|---------|------|
| Worker Requests | 1,000 | 30,000 | $0 (Free) |
| KV Reads | 2,000 | 60,000 | $0 (Free) |
| KV Writes | 50 | 1,500 | $0 (Free) |
| KV Storage | ~100 KB | ~100 KB | $0 (Free) |
| **Total** | | | **$0/month** |

### Scenario 2: Medium Traffic (1,000 agents, ~10,000 requests/day)

| Item | Daily | Monthly | Cost |
|------|-------|---------|------|
| Worker Requests | 10,000 | 300,000 | $0 (Free) |
| KV Reads | 20,000 | 600,000 | $0 (Free) |
| KV Writes | 500 | 15,000 | $0 (Free) |
| KV Storage | ~1 MB | ~1 MB | $0 (Free) |
| **Total** | | | **$0/month** |

### Scenario 3: High Traffic (10,000 agents, ~100,000 requests/day)

| Item | Daily | Monthly | Cost |
|------|-------|---------|------|
| Worker Requests | 100,000 | 3,000,000 | $0 (Free limit hit!) |
| KV Reads | 200,000 | 6,000,000 | $2.50 |
| KV Writes | 5,000 | 150,000 | $0.65 |
| KV Storage | ~10 MB | ~10 MB | $0 (Free) |
| Workers Paid Plan | | | $5.00 (minimum) |
| **Total** | | | **~$8/month** |

### Scenario 4: Very High Traffic (100,000 agents, ~1M requests/day)

| Item | Daily | Monthly | Cost |
|------|-------|---------|------|
| Worker Requests | 1,000,000 | 30,000,000 | $130 |
| KV Reads | 2,000,000 | 60,000,000 | $25 |
| KV Writes | 50,000 | 1,500,000 | $6.50 |
| KV Storage | ~100 MB | ~100 MB | $0.05 |
| **Total** | | | **~$162/month** |

---

## Cost Breakdown by Operation

### Agent Registration (`POST /api/vote`)

| Operation | Cost |
|-----------|------|
| Worker Request | $0 (first 100K/day) |
| KV Write (store agent) | $0.005 per 1,000 |
| **Total per registration** | ~$0.000005 |

### Status Check (`GET /api/status`)

| Operation | Cost |
|-----------|------|
| Worker Request | $0 (first 100K/day) |
| KV Read (fetch agent) | $0.0005 per 1,000 |
| **Total per check** | ~$0.0000005 |

### Verification (`POST /api/claim`)

| Operation | Cost |
|-----------|------|
| Worker Request | $0 (first 100K/day) |
| KV Read (fetch agent) | $0.0005 per 1,000 |
| KV Read (rate limit check) | $0.0005 per 1,000 |
| KV Write (update status) | $0.005 per 1,000 |
| Platform API Call | Varies (see below) |
| **Total per verification** | ~$0.000006 + platform API |

### Stats (`GET /api/stats`)

| Operation | Cost |
|-----------|------|
| Worker Request | $0 (first 100K/day) |
| KV List (count agents) | $0.0005 per 1,000 |
| **Total per request** | ~$0.0000005 |

---

## Third-Party API Costs

### Moltbook API

| Tier | Cost |
|------|------|
| Free | Likely free for basic operations |
| Check | https://www.moltbook.com |

### Moltx API

| Tier | Cost |
|------|------|
| Free | Likely free for basic operations |
| Check | https://moltx.io |

### Twitter API v2

| Tier | Cost |
|------|------|
| Free | 500,000 tweets/month (read-only) |
| Basic | $100/month (write access) |
| Pro | $5,000/month |
| Check | https://developer.twitter.com |

**Note:** For fetching tweets (read-only), Free tier should be sufficient.

---

## Domain Costs

| Item | Cost | Frequency |
|------|------|-----------|
| `mm4claw.xyz` | ~$10-15/year | Annual |
| `www.mm4claw.xyz` | Included | - |
| `preview.mm4claw.xyz` | ~$10-15/year | Annual (optional) |
| **Total** | **$10-30/year** | Annual |

---

## Total Cost Summary

### Monthly Operating Costs

| Traffic Level | Monthly Cost |
|---------------|--------------|
| **Low** (<100 agents) | $0 |
| **Medium** (<1,000 agents) | $0 |
| **High** (<10,000 agents) | ~$8 |
| **Very High** (<100,000 agents) | ~$162 |

### Annual Fixed Costs

| Item | Annual Cost |
|------|-------------|
| Domain(s) | $10-30 |
| **Total** | **$10-30** |

---

## Cost Optimization Tips

### 1. Reduce KV List Operations

The `/api/stats` endpoint uses KV list which is more expensive:

```javascript
// Current (expensive)
const agentsList = await env.MM4CLAW_AGENTS.list();
const totalAgents = agentsList.keys.length;

// Better: cache the count
// Store in KV with TTL, refresh every 5 minutes
```

### 2. Batch Operations

If processing many verifications, use batching to reduce overhead.

### 3. Cache Platform API Responses

Cache fetched post data for 5-10 minutes to reduce duplicate API calls.

### 4. Use Durable Objects for High Traffic

For very high traffic scenarios, consider Durable Objects for better pricing.

---

## Breakeven Analysis

### When to switch from Free to Paid

| Metric | Free Limit | Paid Cost |
|--------|-----------|------------|
| Workers Requests | 100K/day | $5/million |
| KV Reads | 1K/day | $0.50/million |
| KV Writes | 1K/day | $5.00/million |

**Breakeven point:** Around 3,000 agents with moderate activity (~10 operations/day each)

---

## Monitoring Costs

### Check Usage

```bash
# View KV usage
npx wrangler kv:statistics

# View analytics (if enabled)
npx wrangler analytics
```

### Set Up Budget Alerts

Cloudflare doesn't have built-in budget alerts, but you can:

1. Monitor usage regularly
2. Set up Cloudflare billing alerts
3. Use worker analytics dashboards

---

## Conclusion

**MM4CLAW is extremely cost-effective:**

- **0 - 1,000 agents**: $0/month (Free tier)
- **1,000 - 3,000 agents**: $0-5/month
- **3,000 - 10,000 agents**: ~$8/month
- **10,000 - 100,000 agents**: ~$162/month

The primary cost driver is verification requests which make multiple KV reads/writes and external API calls.

**Recommendation:** Start with free tier, monitor usage, and scale to Workers Paid plan when needed.
