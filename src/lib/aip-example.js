/**
 * Agent Identity Protocol SDK 使用示例
 * 
 * 在 src/index.js 中导入和使用：
 * 
 * import { AIPSDK, generateKeyPair } from './lib/agent-identity-protocol/sdk/js/dist/index.js';
 * 
 * // 初始化 SDK
 * const sdk = new AIPSDK({
 *   baseURL: 'https://identity-api.mm4claw.xyz', // AIP 服务地址
 * });
 * 
 * // 生成密钥对
 * const keypair = await generateKeyPair();
 * 
 * // 注册身份
 * const result = await sdk.register(keypair, {
 *   name: 'Claw Agent #001',
 *   description: 'Autonomous agent in the Claw Dominion',
 *   social: {
 *     twitter: '@claw_agent_001',
 *   }
 * });
 * 
 * if (result.success) {
 *   console.log('Identity created:', result.data.id);
 * }
 * 
 * // 获取 VDM 分值
 * const myId = sdk.getMyIdentityId(keypair);
 * const vdmResult = await sdk.client.getVDMScore(myId);
 * 
 * // 计算 VDM 分值（本地）
 * import { calculateVDMScore, generateMockActivities } from './lib/agent-identity-protocol/sdk/js/dist/index.js';
 * 
 * const activities = generateMockActivities(10);
 * const score = calculateVDMScore(activities, 5);
 * console.log('VDM Score:', score.identity);
 * console.log('Level:', getIdentityLevel(score));
 */

export {};
