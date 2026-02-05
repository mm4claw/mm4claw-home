/**
 * Agent Identity Protocol (AIP) - 纯 Worker 实现
 * TypeScript + D1 数据库
 */

// 导出类型
export type {
  KeyPair,
  Identity,
  IdentityMetadata,
  SocialLinks,
  VDMScore,
  VDMParams,
  AgentActivity,
  IdentityLevel,
  Endorsement,
  CreateEndorsementRequest,
  APIResponse,
  Env,
} from './types';

// 导出加密函数
export {
  generateKeyPair,
  sign,
  verify,
  toBase58,
  fromBase58,
  getIdentityId,
} from './crypto';

// 导出 VDM 计算
export {
  calculateVDMScore,
  getIdentityLevel,
  DEFAULT_VDM_PARAMS,
} from './vdm';

// 导出数据库操作
export {
  IdentityDB,
  VDMDB,
  EndorsementDB,
  ActivityDB,
} from './db';

// 导出服务
export { AIPService } from './service';

// 导出路由处理器
export { handleAIPRequest } from './routes';
