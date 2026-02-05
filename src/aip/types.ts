/**
 * AIP (Agent Identity Protocol) - 类型定义
 * 纯 Worker 实现
 */

// ==================== 核心类型 ====================

/** Ed25519 密钥对 */
export interface KeyPair {
  publicKey: Uint8Array;  // 32 bytes
  privateKey: Uint8Array; // 32 bytes seed
}

/** 代理身份 */
export interface Identity {
  id: string;                    // base58 编码的公钥
  publicKey: Uint8Array;
  metadata: IdentityMetadata;
  createdAt: number;
  updatedAt: number;
}

/** 身份元数据 */
export interface IdentityMetadata {
  name?: string;
  description?: string;
  avatar?: string;
  social?: SocialLinks;
  [key: string]: unknown;
}

/** 社交链接 */
export interface SocialLinks {
  twitter?: string;
  github?: string;
  discord?: string;
  [key: string]: string | undefined;
}

// ==================== VDM 类型 ====================

/** VDM 热力学分值 */
export interface VDMScore {
  identity: number;      // 身份稳定性分值
  signal: number;        // 信号强度
  entropy: number;       // 熵值（越低越好）
  compute: number;       // 计算能量
  level: IdentityLevel;
  timestamp: number;
}

/** 身份等级 */
export type IdentityLevel = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

/** VDM 计算参数 */
export interface VDMParams {
  activityWeight: number;
  consistencyWeight: number;
  endorsementWeight: number;
  timeDecayFactor: number;
}

/** 代理活动记录 */
export interface AgentActivity {
  id?: number;
  identityId: string;
  action: string;
  entropy: number;
  compute: number;
  timestamp: number;
}

// ==================== 背书类型 ====================

/** 背书记录 */
export interface Endorsement {
  id: string;
  endorserId: string;
  recipientId: string;
  score: number;         // 0-100
  signature: Uint8Array;
  message?: string;
  createdAt: number;
}

/** 创建背书请求 */
export interface CreateEndorsementRequest {
  endorserId: string;
  recipientId: string;
  score: number;
  signature: Uint8Array;
  message?: string;
}

// ==================== API 类型 ====================

/** API 响应包装 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 注册身份请求 */
export interface RegisterIdentityRequest {
  publicKey: Uint8Array;
  signature: Uint8Array; // 对自身公钥的签名
  metadata: IdentityMetadata;
}

/** 更新元数据请求 */
export interface UpdateMetadataRequest {
  metadata: IdentityMetadata;
  signature: Uint8Array;
}

// ==================== D1 数据库类型 ====================

/** D1 数据库绑定 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run<T>(): Promise<D1Result<T>>;
  all<T>(): Promise<D1Result<T>>;
  raw<T>(): Promise<T[]>;
}

export interface D1Result<T> {
  results: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

/** 环境变量 */
export interface Env {
  AIP_DB: D1Database;
  MM4CLAW_AGENTS?: KVNamespace;
}
