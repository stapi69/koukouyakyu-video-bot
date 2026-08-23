const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3;

function vvApi(path, bodyJson) {
  return new Promise((resolve, reject) => {
    const body = bodyJson ? JSON.stringify(bodyJson) : null;
    const req = http.request({
      hostname: 'localhost', port: 50021, path, method: 'POST',
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('json')) {
          try {
            const obj = JSON.parse(buf.toString());
            if (obj.detail) return reject(new Error('API error: ' + obj.detail));
            resolve(obj);
          } catch (e) { reject(new Error('JSON parse error: ' + buf.toString().slice(0, 100))); }
        } else {
          if (buf.length < 100) return reject(new Error('Too small: ' + buf.length));
          resolve(buf);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function synth(text, file) {
  console.log('生成:', text.slice(0, 40));
  const q = await vvApi(`/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`, null);
  const wav = await vvApi(`/synthesis?speaker=${SPEAKER}`, q);
  fs.writeFileSync(file, wav);
  console.log(' ✅', file, wav.length, 'bytes');
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });
  const items = [
    { t: `${date}の高校野球、試合結果です。`, f: 'narration/00_open.wav' },
    ...games.map((g, i) => {
      const w = g.scoreA > g.scoreB ? g.teamA : g.teamB;
      return { t: `${g.teamA}対${g.teamB}、${w}が勝利。`, f: `narration/${i+1:02}_game.wav` };
    }),
    { t: 'チャンネル登録よろしくお願いします。', f: 'narration/99_end.wav' }
  ];

  for (const { t, f } of items) {
    await synth(t, f);
  }

  const list = items.map(x => `file '${x.f}'`).join('\n');
  fs.writeFileSync('narration/list.txt', list);
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y');
  console.log('✅ combined.wav 完成');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
