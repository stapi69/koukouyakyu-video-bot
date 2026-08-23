const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3; // ずんだもん

function voicevoxPost(path, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : '';
    const opts = {
      hostname: 'localhost',
      port: 50021,
      path: path,
      method: 'POST',
      headers: bodyObj
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        : {}
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Content-Typeがapplication/jsonならパース
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { resolve(JSON.parse(buf.toString())); }
          catch (e) { reject(new Error('JSON parse error: ' + buf.toString().slice(0, 100))); }
        } else {
          resolve(buf); // バイナリ（wav）
        }
      });
    });
    req.on('error', reject);
    if (bodyObj) req.write(body);
    req.end();
  });
}

async function generateVoice(text, filename) {
  console.log(`生成中: ${text.slice(0, 30)}...`);
  // audio_query
  const query = await voicevoxPost(
    `/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`, null
  );
  if (query.detail) throw new Error('audio_query error: ' + query.detail);
  
  // synthesis（タイムアウトなし - CPUでも完了まで待つ）
  const audio = await voicevoxPost(
    `/synthesis?speaker=${SPEAKER}`, query
  );
  if (!(audio instanceof Buffer) || audio.length < 100) {
    throw new Error(`synthesis failed: ${audio.length || 0} bytes`);
  }
  fs.writeFileSync(filename, audio);
  console.log(`  ✅ ${filename}: ${audio.length} bytes`);
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });

  const items = [
    { text: `${date}の高校野球、試合結果ダイジェストです。`, file: 'narration/opening.wav' },
    ...games.map((g, i) => {
      const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
      return {
        text: `${g.tournament}。${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}。${winner}が勝利しました。`,
        file: `narration/game${i}.wav`
      };
    }),
    { text: '本日も熱戦をお届けしました。チャンネル登録よろしくお願いします！', file: 'narration/ending.wav' }
  ];

  for (const { text, file } of items) {
    await generateVoice(text, file);
  }

  const fileList = items.map(i => `file '${i.file}'`).join('\n');
  fs.writeFileSync('narration/list.txt', fileList);
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');
  console.log(`✅ ${games.length}試合分 ナレーション完了`);
}

main().catch(e => {
  console.error('❌ ナレーション失敗:', e.message);
  process.exit(1);
});
