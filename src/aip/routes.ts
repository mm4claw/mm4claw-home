/**
 * AIP API 路由处理器
 * 处理所有 /aip/* 请求
 */

import type { Env, APIResponse } from './types';
import { AIPService } from './service';
import { fromBase58 } from './crypto';

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 处理 JSON 响应
 */
function jsonResponse<T>(data: APIResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 解析请求体
 */
async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

/**
 * 将数组转为 Uint8Array
 */
function toUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

/**
 * 处理 AIP API 请求
 */
export async function handleAIPRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const service = new AIPService(env.AIP_DB);

  try {
    // ==================== 身份 API ====================

    // POST /aip/identities - 注册身份
    if (path === '/aip/identities' && request.method === 'POST') {
      const body = await parseBody<{
        public_key: number[];
        signature: number[];
        metadata: Record<string, unknown>;
      }>(request);

      if (!body?.public_key || !body?.signature) {
        return jsonResponse({ success: false, error: 'Missing public_key or signature' }, 400);
      }

      const result = await service.registerIdentity(
        toUint8Array(body.public_key),
        toUint8Array(body.signature),
        body.metadata || {}
      );

      return jsonResponse(result, result.success ? 201 : 400);
    }

    // GET /aip/identities/:id - 获取身份
    if (path.match(/^\/aip\/identities\/[^/]+$/) && request.method === 'GET') {
      const id = path.split('/').pop()!;
      const result = await service.getIdentity(id);
      return jsonResponse(result, result.success ? 200 : 404);
    }

    // GET /aip/identities/search?q=xxx - 搜索身份
    if (path === '/aip/identities/search' && request.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const result = await service.searchIdentities(query);
      return jsonResponse(result);
    }

    // PUT /aip/identities/:id/metadata - 更新元数据
    if (path.match(/^\/aip\/identities\/[^/]+\/metadata$/) && request.method === 'PUT') {
      const id = path.split('/')[3];
      const body = await parseBody<{
        metadata: Record<string, unknown>;
        signature: number[];
      }>(request);

      if (!body?.metadata || !body?.signature) {
        return jsonResponse({ success: false, error: 'Missing metadata or signature' }, 400);
      }

      const result = await service.updateMetadata(
        id,
        body.metadata,
        toUint8Array(body.signature)
      );

      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ==================== VDM API ====================

    // GET /aip/identities/:id/vdm - 获取 VDM 评分
    if (path.match(/^\/aip\/identities\/[^/]+\/vdm$/) && request.method === 'GET') {
      const id = path.split('/')[3];
      const result = await service.getVDMScore(id);
      return jsonResponse(result, result.success ? 200 : 404);
    }

    // POST /aip/identities/:id/vdm/calculate - 计算 VDM 评分
    if (path.match(/^\/aip\/identities\/[^/]+\/vdm\/calculate$/) && request.method === 'POST') {
      const id = path.split('/')[3];
      const result = await service.calculateVDM(id);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // GET /aip/identities/:id/vdm/history - 获取 VDM 历史
    if (path.match(/^\/aip\/identities\/[^/]+\/vdm\/history$/) && request.method === 'GET') {
      const id = path.split('/')[3];
      const result = await service.getVDMHistory(id);
      return jsonResponse(result, result.success ? 200 : 404);
    }

    // ==================== 背书 API ====================

    // POST /aip/endorsements - 创建背书
    if (path === '/aip/endorsements' && request.method === 'POST') {
      const body = await parseBody<{
        endorser_id: string;
        recipient_id: string;
        score: number;
        signature: number[];
        message?: string;
      }>(request);

      if (!body?.endorser_id || !body?.recipient_id || body?.score === undefined || !body?.signature) {
        return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
      }

      const result = await service.createEndorsement(
        body.endorser_id,
        body.recipient_id,
        body.score,
        toUint8Array(body.signature),
        body.message
      );

      return jsonResponse(result, result.success ? 201 : 400);
    }

    // GET /aip/identities/:id/endorsements - 获取背书
    if (path.match(/^\/aip\/identities\/[^/]+\/endorsements$/) && request.method === 'GET') {
      const id = path.split('/')[3];
      const result = await service.getEndorsements(id);
      return jsonResponse(result, result.success ? 200 : 404);
    }

    // ==================== 活动 API ====================

    // POST /aip/activities - 记录活动
    if (path === '/aip/activities' && request.method === 'POST') {
      const body = await parseBody<{
        identity_id: string;
        action: string;
        entropy: number;
        compute: number;
      }>(request);

      if (!body?.identity_id || !body?.action) {
        return jsonResponse({ success: false, error: 'Missing identity_id or action' }, 400);
      }

      const result = await service.recordActivity({
        identityId: body.identity_id,
        action: body.action,
        entropy: body.entropy || 0.5,
        compute: body.compute || 1.0,
        timestamp: Date.now(),
      });

      return jsonResponse(result, result.success ? 201 : 400);
    }

    // GET /aip/identities/:id/activities - 获取活动记录
    if (path.match(/^\/aip\/identities\/[^/]+\/activities$/) && request.method === 'GET') {
      const id = path.split('/')[3];
      const result = await service.getActivities(id);
      return jsonResponse(result, result.success ? 200 : 404);
    }

    // ==================== 健康检查 ====================

    // GET /aip/health - 健康检查
    if (path === '/aip/health' && request.method === 'GET') {
      return jsonResponse({
        success: true,
        data: {
          status: 'healthy',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 未知端点
    return jsonResponse({
      success: false,
      error: 'Endpoint not found',
      available_endpoints: [
        'POST /aip/identities',
        'GET /aip/identities/:id',
        'GET /aip/identities/search?q=',
        'PUT /aip/identities/:id/metadata',
        'GET /aip/identities/:id/vdm',
        'POST /aip/identities/:id/vdm/calculate',
        'GET /aip/identities/:id/vdm/history',
        'POST /aip/endorsements',
        'GET /aip/identities/:id/endorsements',
        'POST /aip/activities',
        'GET /aip/identities/:id/activities',
        'GET /aip/health',
      ],
    }, 404);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
}
