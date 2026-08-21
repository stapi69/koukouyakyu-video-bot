const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3; // ずんだもん

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 50021,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpPostBinary(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 50021,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateVoice(text, filename) {
  const base = `http://localhost:50021`;
  const queryRes = await new Promise((resolve, reject) => {
    const path = `/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`;
    const options = { hostname: 'localhost', port: 50021, path, method: 'POST' };
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
    });
    req.on('error', reject);
    req.end();
  });

  const audioRes = await httpPostBinary(
    `http://localhost:50021/synthesis?speaker=${SPEAKER}`,
    queryRes
  );
  fs.writeFileSync(filename, audioRes);
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });

  await generateVoice(`${date}の高校野球、試合結果ダイジェストです。`, 'narration/opening.wav');

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    const text = `${g.tournament}、${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}。${winner}が勝利しました。`;
    await generateVoice(text, `narration/game${i}.wav`);
  }

  await generateVoice('本日も熱戦をお届けしました。チャンネル登録よろしくお願いします！', 'narration/ending.wav');

  const files = [
    'narration/opening.wav',
    ...games.map((_, i) => `narration/game${i}.wav`),
    'narration/ending.wav'
  ];
  const fileList = files.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync('narration/list.txt', fileList);
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');

  console.log(`✅ ${games.length}試合分のナレーションを生成・結合しました`);
}

main().catch(console.error);
