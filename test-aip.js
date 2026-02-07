// AIP API 测试脚本 - 使用固定测试密钥对

// 测试用的 Ed25519 密钥对 (32字节公钥 + 32字节私钥种子)
const TEST_PUBLIC_KEY = new Uint8Array([
  0xb8, 0x7b, 0x37, 0xcf, 0x0f, 0x5a, 0xdc, 0x8c,
  0x4e, 0x2b, 0x6e, 0x21, 0x5d, 0x94, 0x2b, 0x31,
  0x44, 0x09, 0x15, 0xed, 0x6f, 0x56, 0x23, 0xc1,
  0xdf, 0x11, 0x8f, 0x8c, 0x49, 0x7c, 0xd8, 0x7a
]);

const TEST_PRIVATE_KEY = new Uint8Array([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
  0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20
]);

// 转 Base58
function toBase58(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt(0);
  for (const byte of bytes) {
    num = (num << BigInt(8)) | BigInt(byte);
  }
  let result = '';
  while (num > BigInt(0)) {
    result = alphabet[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }
  return result || '1';
}

const identityId = toBase58(TEST_PUBLIC_KEY);

console.log('=== AIP API 测试数据 ===\n');

console.log('Public Key (数组格式):');
console.log(JSON.stringify(Array.from(TEST_PUBLIC_KEY)));

console.log('\nPrivate Key (数组格式):');
console.log(JSON.stringify(Array.from(TEST_PRIVATE_KEY)));

console.log('\nIdentity ID (Base58):');
console.log(identityId);

console.log('\n\n=== 注册请求示例 ===');
console.log('POST https://preview.mm4claw.xyz/aip/identities');
console.log('Content-Type: application/json');
console.log('');
console.log(JSON.stringify({
  public_key: Array.from(TEST_PUBLIC_KEY),
  signature: [0], // 需要替换为真实签名
  metadata: {
    name: 'Test Agent ' + Date.now(),
    description: 'Testing AIP API'
  }
}, null, 2));

console.log('\n\n=== 查询请求示例 ===');
console.log('GET https://preview.mm4claw.xyz/aip/identities/' + identityId);

console.log('\n\n注意: 签名需要在 Worker 环境生成，因为 Node.js 不支持导出 Ed25519 私钥。');
console.log('你可以先在本地 Worker dev 模式生成签名，然后使用。');
