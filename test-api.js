// Test without auth
async function test() {
  // Test without auth headers
  console.log('Testing without auth...');
  const response1 = await fetch('https://preview.mm4claw.xyz/');
  console.log('Root / status:', response1.status);
  console.log('Content-Type:', response1.headers.get('content-type'));
  console.log('Preview (first 200 chars):', (await response1.text()).substring(0, 200));
  console.log();

  // Test API with curl-session cookie
  console.log('Testing API endpoint...');
  const response2 = await fetch('https://preview.mm4claw.xyz/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: '0x' + '1'.repeat(40),
      agent_name: 'TestAgent'
    })
  });
  console.log('API status:', response2.status);
  const text2 = await response2.text();
  console.log('Is JSON:', text2.startsWith('{') || text2.startsWith('['));
  console.log('Preview (first 200 chars):', text2.substring(0, 200));
}

test().catch(console.error);
