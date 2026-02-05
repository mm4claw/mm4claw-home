/**
 * AIP 数据库操作层
 * D1 SQLite 封装
 */

import type { D1Database, Identity, VDMScore, Endorsement, AgentActivity } from './types';

/** 身份数据库操作 */
export class IdentityDB {
  constructor(private db: D1Database) {}

  /**
   * 创建新身份
   */
  async create(identity: Identity): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identities (id, public_key, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        identity.id,
        identity.publicKey,
        JSON.stringify(identity.metadata),
        identity.createdAt,
        identity.updatedAt
      )
      .run();
  }

  /**
   * 根据 ID 获取身份
   */
  async getById(id: string): Promise<Identity | null> {
    const row = await this.db
      .prepare('SELECT * FROM identities WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        public_key: ArrayBuffer;
        metadata: string;
        created_at: number;
        updated_at: number;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      publicKey: new Uint8Array(row.public_key),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 搜索身份（按名称）
   */
  async search(query: string): Promise<Identity[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM identities WHERE metadata LIKE ?`)
      .bind(`%${query}%`)
      .all<{
        id: string;
        public_key: ArrayBuffer;
        metadata: string;
        created_at: number;
        updated_at: number;
      }>();

    return rows.results.map(row => ({
      id: row.id,
      publicKey: new Uint8Array(row.public_key),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * 更新元数据
   */
  async updateMetadata(id: string, metadata: Record<string, unknown>, updatedAt: number): Promise<void> {
    await this.db
      .prepare('UPDATE identities SET metadata = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(metadata), updatedAt, id)
      .run();
  }

  /**
   * 检查身份是否存在
   */
  async exists(id: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM identities WHERE id = ?')
      .bind(id)
      .first<{ 1: number }>();
    return !!row;
  }
}

/** VDM 评分数据库操作 */
export class VDMDB {
  constructor(private db: D1Database) {}

  /**
   * 保存 VDM 评分
   */
  async save(identityId: string, score: VDMScore): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO vdm_scores 
         (identity_id, identity_score, signal_score, entropy_score, compute_score, level, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        identityId,
        score.identity,
        score.signal,
        score.entropy,
        score.compute,
        score.level,
        score.timestamp
      )
      .run();
  }

  /**
   * 获取最新 VDM 评分
   */
  async getLatest(identityId: string): Promise<VDMScore | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM vdm_scores 
         WHERE identity_id = ? 
         ORDER BY calculated_at DESC LIMIT 1`
      )
      .bind(identityId)
      .first<{
        identity_score: number;
        signal_score: number;
        entropy_score: number;
        compute_score: number;
        level: string;
        calculated_at: number;
      }>();

    if (!row) return null;

    return {
      identity: row.identity_score,
      signal: row.signal_score,
      entropy: row.entropy_score,
      compute: row.compute_score,
      level: row.level as VDMScore['level'],
      timestamp: row.calculated_at,
    };
  }

  /**
   * 获取评分历史
   */
  async getHistory(identityId: string, limit: number = 30): Promise<VDMScore[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM vdm_scores 
         WHERE identity_id = ? 
         ORDER BY calculated_at DESC LIMIT ?`
      )
      .bind(identityId, limit)
      .all<{
        identity_score: number;
        signal_score: number;
        entropy_score: number;
        compute_score: number;
        level: string;
        calculated_at: number;
      }>();

    return rows.results.map(row => ({
      identity: row.identity_score,
      signal: row.signal_score,
      entropy: row.entropy_score,
      compute: row.compute_score,
      level: row.level as VDMScore['level'],
      timestamp: row.calculated_at,
    }));
  }
}

/** 背书数据库操作 */
export class EndorsementDB {
  constructor(private db: D1Database) {}

  /**
   * 创建背书
   */
  async create(endorsement: Endorsement): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO endorsements (id, endorser_id, recipient_id, score, signature, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        endorsement.id,
        endorsement.endorserId,
        endorsement.recipientId,
        endorsement.score,
        endorsement.signature,
        endorsement.message || null,
        endorsement.createdAt
      )
      .run();
  }

  /**
   * 获取身份收到的背书
   */
  async getByRecipient(recipientId: string): Promise<Endorsement[]> {
    const rows = await this.db
      .prepare('SELECT * FROM endorsements WHERE recipient_id = ? ORDER BY created_at DESC')
      .bind(recipientId)
      .all<{
        id: string;
        endorser_id: string;
        recipient_id: string;
        score: number;
        signature: ArrayBuffer;
        message: string | null;
        created_at: number;
      }>();

    return rows.results.map(row => ({
      id: row.id,
      endorserId: row.endorser_id,
      recipientId: row.recipient_id,
      score: row.score,
      signature: new Uint8Array(row.signature),
      message: row.message || undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * 获取背书数量
   */
  async countByRecipient(recipientId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) as count FROM endorsements WHERE recipient_id = ?')
      .bind(recipientId)
      .first<{ count: number }>();
    return row?.count || 0;
  }

  /**
   * 检查是否已背书
   */
  async hasEndorsed(endorserId: string, recipientId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM endorsements WHERE endorser_id = ? AND recipient_id = ?')
      .bind(endorserId, recipientId)
      .first<{ 1: number }>();
    return !!row;
  }
}

/** 活动数据库操作 */
export class ActivityDB {
  constructor(private db: D1Database) {}

  /**
   * 记录活动
   */
  async record(activity: AgentActivity): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO activities (identity_id, action, entropy, compute, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(activity.identityId, activity.action, activity.entropy, activity.compute, activity.timestamp)
      .run();
  }

  /**
   * 获取身份的活动记录
   */
  async getByIdentity(identityId: string, limit: number = 100): Promise<AgentActivity[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM activities WHERE identity_id = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .bind(identityId, limit)
      .all<{
        id: number;
        identity_id: string;
        action: string;
        entropy: number;
        compute: number;
        timestamp: number;
      }>();

    return rows.results.map(row => ({
      id: row.id,
      identityId: row.identity_id,
      action: row.action,
      entropy: row.entropy,
      compute: row.compute,
      timestamp: row.timestamp,
    }));
  }

  /**
   * 获取最近活动（用于 VDM 计算）
   */
  async getRecent(identityId: string, days: number = 30): Promise<AgentActivity[]> {
    const cutoff = Date.now() - days * 86400000;
    const rows = await this.db
      .prepare(
        `SELECT * FROM activities 
         WHERE identity_id = ? AND timestamp > ? 
         ORDER BY timestamp ASC`
      )
      .bind(identityId, cutoff)
      .all<{
        id: number;
        identity_id: string;
        action: string;
        entropy: number;
        compute: number;
        timestamp: number;
      }>();

    return rows.results.map(row => ({
      id: row.id,
      identityId: row.identity_id,
      action: row.action,
      entropy: row.entropy,
      compute: row.compute,
      timestamp: row.timestamp,
    }));
  }
}
