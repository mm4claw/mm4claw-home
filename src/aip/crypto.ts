/**
 * AIP 加密工具 - Ed25519 实现
 * Cloudflare Workers Web Crypto API
 */

import type { KeyPair } from './types';

/**
 * 生成 Ed25519 密钥对
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    'Ed25519',
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;

  const privateKeyBuf = await crypto.subtle.exportKey('raw', keyPair.privateKey) as ArrayBuffer;
  const publicKeyBuf = await crypto.subtle.exportKey('raw', keyPair.publicKey) as ArrayBuffer;

  return {
    privateKey: new Uint8Array(privateKeyBuf),
    publicKey: new Uint8Array(publicKeyBuf),
  };
}

/**
 * 使用私钥签名数据
 */
export async function sign(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    privateKey,
    'Ed25519',
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('Ed25519', key, data);
  return new Uint8Array(sig);
}

/**
 * 验证签名
 */
export async function verify(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      publicKey,
      'Ed25519',
      false,
      ['verify']
    );

    return crypto.subtle.verify('Ed25519', key, signature, data);
  } catch {
    return false;
  }
}

/**
 * Uint8Array 转 Base58
 */
export function toBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt(0);
  
  for (const byte of bytes) {
    num = (num << BigInt(8)) | BigInt(byte);
  }
  
  let result = '';
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    result = alphabet[remainder] + result;
    num = num / BigInt(58);
  }
  
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = '1' + result;
  }
  
  return result || '1';
}

/**
 * Base58 转 Uint8Array
 */
export function fromBase58(str: string): Uint8Array {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt(0);
  
  for (const char of str) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid Base58 character');
    num = num * BigInt(58) + BigInt(index);
  }
  
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num & BigInt(0xff)));
    num = num >> BigInt(8);
  }
  
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.unshift(0);
  }
  
  return new Uint8Array(bytes);
}

/**
 * 从公钥生成身份 ID
 */
export function getIdentityId(publicKey: Uint8Array): string {
  return toBase58(publicKey);
}

/**
 * 验证身份所有权（验证签名）
 * 用于注册和敏感操作验证
 */
export async function verifyIdentityOwnership(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array = publicKey
): Promise<boolean> {
  return verify(message, signature, publicKey);
}
