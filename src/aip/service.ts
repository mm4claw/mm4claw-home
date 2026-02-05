/**
 * AIP 业务逻辑服务层
 */

import type { D1Database, Identity, VDMScore, Endorsement, AgentActivity, APIResponse } from './types';
import { IdentityDB, VDMDB, EndorsementDB, ActivityDB } from './db';
import { getIdentityId, verify, sign } from './crypto';
import { calculateVDMScore } from './vdm';

export class AIPService {
  private identityDB: IdentityDB;
  private vdmDB: VDMDB;
  private endorsementDB: EndorsementDB;
  private activityDB: ActivityDB;

  constructor(db: D1Database) {
    this.identityDB = new IdentityDB(db);
    this.vdmDB = new VDMDB(db);
    this.endorsementDB = new EndorsementDB(db);
    this.activityDB = new ActivityDB(db);
  }

  /**
   * 注册新身份
   */
  async registerIdentity(
    publicKey: Uint8Array,
    signature: Uint8Array,
    metadata: Record<string, unknown>
  ): Promise<APIResponse<Identity>> {
    const id = getIdentityId(publicKey);

    // 检查身份是否已存在
    if (await this.identityDB.exists(id)) {
      return { success: false, error: 'Identity already exists' };
    }

    // 验证签名（对自身公钥签名）
    const isValid = await verify(publicKey, signature, publicKey);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    const now = Date.now();
    const identity: Identity = {
      id,
      publicKey,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.identityDB.create(identity);

    return { success: true, data: identity };
  }

  /**
   * 获取身份详情
   */
  async getIdentity(id: string): Promise<APIResponse<Identity>> {
    const identity = await this.identityDB.getById(id);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }
    return { success: true, data: identity };
  }

  /**
   * 搜索身份
   */
  async searchIdentities(query: string): Promise<APIResponse<Identity[]>> {
    const identities = await this.identityDB.search(query);
    return { success: true, data: identities };
  }

  /**
   * 更新身份元数据
   */
  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
    signature: Uint8Array
  ): Promise<APIResponse<Identity>> {
    const identity = await this.identityDB.getById(id);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    // 验证签名
    const message = new TextEncoder().encode(`update:${id}:${JSON.stringify(metadata)}`);
    const isValid = await verify(message, signature, identity.publicKey);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    const now = Date.now();
    await this.identityDB.updateMetadata(id, metadata, now);

    const updated = await this.identityDB.getById(id);
    return { success: true, data: updated! };
  }

  /**
   * 计算并保存 VDM 评分
   */
  async calculateVDM(identityId: string): Promise<APIResponse<VDMScore>> {
    const identity = await this.identityDB.getById(identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    // 获取活动记录
    const activities = await this.activityDB.getRecent(identityId, 30);

    // 获取背书数量
    const endorsementCount = await this.endorsementDB.countByRecipient(identityId);

    // 计算 VDM 评分
    const result = calculateVDMScore(activities, endorsementCount);
    const score: VDMScore = {
      ...result,
      timestamp: Date.now(),
    };

    // 保存到数据库
    await this.vdmDB.save(identityId, score);

    return { success: true, data: score };
  }

  /**
   * 获取最新 VDM 评分
   */
  async getVDMScore(identityId: string): Promise<APIResponse<VDMScore>> {
    const identity = await this.identityDB.getById(identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    const score = await this.vdmDB.getLatest(identityId);
    if (!score) {
      return { success: false, error: 'VDM score not calculated yet' };
    }

    return { success: true, data: score };
  }

  /**
   * 获取 VDM 历史
   */
  async getVDMHistory(identityId: string): Promise<APIResponse<VDMScore[]>> {
    const identity = await this.identityDB.getById(identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    const history = await this.vdmDB.getHistory(identityId);
    return { success: true, data: history };
  }

  /**
   * 创建背书
   */
  async createEndorsement(
    endorserId: string,
    recipientId: string,
    score: number,
    signature: Uint8Array,
    message?: string
  ): Promise<APIResponse<Endorsement>> {
    // 验证身份存在
    const endorser = await this.identityDB.getById(endorserId);
    if (!endorser) {
      return { success: false, error: 'Endorser identity not found' };
    }

    const recipient = await this.identityDB.getById(recipientId);
    if (!recipient) {
      return { success: false, error: 'Recipient identity not found' };
    }

    // 不能背书自己
    if (endorserId === recipientId) {
      return { success: false, error: 'Cannot endorse yourself' };
    }

    // 检查是否已背书
    if (await this.endorsementDB.hasEndorsed(endorserId, recipientId)) {
      return { success: false, error: 'Already endorsed this identity' };
    }

    // 验证分数范围
    if (score < 0 || score > 100) {
      return { success: false, error: 'Score must be between 0 and 100' };
    }

    // 验证签名
    const messageData = new TextEncoder().encode(
      `endorse:${endorserId}:${recipientId}:${score}`
    );
    const isValid = await verify(messageData, signature, endorser.publicKey);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    const endorsement: Endorsement = {
      id: crypto.randomUUID(),
      endorserId,
      recipientId,
      score,
      signature,
      message,
      createdAt: Date.now(),
    };

    await this.endorsementDB.create(endorsement);

    return { success: true, data: endorsement };
  }

  /**
   * 获取身份的背书
   */
  async getEndorsements(identityId: string): Promise<APIResponse<Endorsement[]>> {
    const identity = await this.identityDB.getById(identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    const endorsements = await this.endorsementDB.getByRecipient(identityId);
    return { success: true, data: endorsements };
  }

  /**
   * 记录活动
   */
  async recordActivity(activity: AgentActivity): Promise<APIResponse<void>> {
    const identity = await this.identityDB.getById(activity.identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    await this.activityDB.record(activity);
    return { success: true };
  }

  /**
   * 获取活动记录
   */
  async getActivities(identityId: string): Promise<APIResponse<AgentActivity[]>> {
    const identity = await this.identityDB.getById(identityId);
    if (!identity) {
      return { success: false, error: 'Identity not found' };
    }

    const activities = await this.activityDB.getByIdentity(identityId);
    return { success: true, data: activities };
  }
}
