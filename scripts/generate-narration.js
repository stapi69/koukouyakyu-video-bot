const { execSync, execFileSync } = require('child_process');
const http = require('http');

console.log('=== Node.js VoiceVox診断 ===');

// 1. curlコマンドでVoiceVoxにアクセス
try {
  const v = execSync('curl -s http://127.0.0.1:50021/version', {encoding: 'utf-8', timeout: 5000});
  console.log('curl 127.0.0.1 version:', v.trim().slice(0, 50));
} catch(e) {
  console.log('curl FAILED:', e.message.slice(0, 100));
}

// 2. Node.js http でアクセス
const req = http.request({
  hostname: '127.0.0.1', port: 50021, path: '/version', method: 'GET'
}, res => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    console.log('http.request version:', Buffer.concat(chunks).toString().slice(0, 50));
    
    // 3. audio_query
    const aqReq = http.request({
      hostname: '127.0.0.1', port: 50021,
      path: '/audio_query?text=%E3%83%86%E3%82%B9%E3%83%88&speaker=3',
      method: 'POST'
    }, aqRes => {
      const ac = [];
      aqRes.on('data', c => ac.push(c));
      aqRes.on('end', () => {
        const body = Buffer.concat(ac).toString();
        console.log('audio_query len:', body.length, 'status:', aqRes.statusCode);
        console.log('accent_phrases:', body.includes('accent_phrases') ? 'YES' : 'NO');
        process.exit(0);
      });
    });
    aqReq.on('error', e => { console.log('audio_query error:', e.message); process.exit(1); });
    aqReq.end();
  });
});
req.on('error', e => {
  console.log('http.request FAILED:', e.message);
  process.exit(1);
});
req.end();
