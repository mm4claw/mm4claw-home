/**
 * VDM (Variational Decision Making) 热力学分值计算
 * Identity = Compute_Energy / Signal_Entropy
 */

import type { VDMScore, VDMParams, AgentActivity, IdentityLevel } from './types';

/** 默认 VDM 参数 */
export const DEFAULT_VDM_PARAMS: VDMParams = {
  activityWeight: 0.3,
  consistencyWeight: 0.4,
  endorsementWeight: 0.3,
  timeDecayFactor: 0.99,
};

/**
 * 计算 VDM 热力学分值
 * 
 * 公式：
 * - Identity = Compute_Energy / Signal_Entropy
 * - Signal_Entropy = Σ(activity.entropy × time_decay)
 * - Compute_Energy = Σ(activity.compute × consistency_bonus)
 */
export function calculateVDMScore(
  activities: AgentActivity[],
  endorsements: number = 0,
  params: VDMParams = DEFAULT_VDM_PARAMS
): Omit<VDMScore, 'timestamp'> {
  const now = Date.now();
  
  // 计算信号熵
  let signalEntropy = 0;
  for (const activity of activities) {
    const age = now - activity.timestamp;
    const timeDecay = Math.pow(params.timeDecayFactor, age / 86400000);
    signalEntropy += activity.entropy * timeDecay;
  }
  
  // 计算计算能量
  let computeEnergy = 0;
  let consistencyScore = 0;
  
  if (activities.length > 1) {
    // 计算行为一致性
    const intervals: number[] = [];
    for (let i = 1; i < activities.length; i++) {
      intervals.push(activities[i].timestamp - activities[i-1].timestamp);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // 一致性得分：标准差越小越一致 (0-1)
    consistencyScore = Math.max(0, 1 - stdDev / avgInterval);
  } else {
    consistencyScore = 0.5;
  }
  
  for (const activity of activities) {
    const consistencyBonus = 1 + consistencyScore * params.consistencyWeight;
    computeEnergy += activity.compute * consistencyBonus;
  }
  
  // 背书加成
  const endorsementBonus = 1 + Math.log1p(endorsements) * params.endorsementWeight;
  computeEnergy *= endorsementBonus;
  
  // 防止除以零
  if (signalEntropy < 0.001) {
    signalEntropy = 0.001;
  }
  
  // 计算最终分值
  const identityScore = computeEnergy / signalEntropy;
  const signalScore = activities.length > 0 ? activities.length / Math.log1p(signalEntropy) : 0;
  
  return {
    identity: Math.round(identityScore * 100) / 100,
    signal: Math.round(signalScore * 100) / 100,
    entropy: Math.round(signalEntropy * 100) / 100,
    compute: Math.round(computeEnergy * 100) / 100,
    level: getIdentityLevel(identityScore),
  };
}

/**
 * 根据分值获取身份等级
 */
export function getIdentityLevel(score: number): IdentityLevel {
  if (score > 100) return 'Legendary';
  if (score > 50) return 'Epic';
  if (score > 20) return 'Rare';
  if (score > 10) return 'Uncommon';
  return 'Common';
}

/**
 * 生成模拟活动数据（用于测试）
 */
export function generateMockActivities(count: number = 10): AgentActivity[] {
  const activities: AgentActivity[] = [];
  const now = Date.now();
  const baseEntropy = 0.5;
  const baseCompute = 1.0;
  
  for (let i = 0; i < count; i++) {
    activities.push({
      timestamp: now - (count - i) * 86400000,
      action: ['post', 'interact', 'compute', 'verify'][Math.floor(Math.random() * 4)],
      entropy: baseEntropy + Math.random() * 0.5,
      compute: baseCompute + Math.random(),
    });
  }
  
  return activities;
}
