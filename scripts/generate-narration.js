const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3; // ずんだもん
const VOICEVOX_BASE = 'http://localhost:50021';

async function generateVoice(text, filename) {
  console.log(`生成中: ${text.slice(0, 20)}... → ${filename}`);

  // Step 1: audio_query
  const queryData = await new Promise((resolve, reject) => {
    const path = `/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`;
    const req = http.request(
      { hostname: 'localhost', port: 50021, path, method: 'POST' },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString());
            if (parsed.detail) {
              reject(new Error('audio_query error: ' + parsed.detail));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error('audio_query JSON parse error: ' + e.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('audio_query timeout')));
    req.end();
  });

  // Step 2: synthesis
  const body = JSON.stringify(queryData);
  const audioData = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 50021,
        path: `/synthesis?speaker=${SPEAKER}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => reject(new Error('synthesis timeout')));
    req.write(body);
    req.end();
  });

  if (audioData.length < 100) {
    throw new Error(`synthesis returned too small data: ${audioData.length} bytes`);
  }

  fs.writeFileSync(filename, audioData);
  console.log(`  ✅ 生成完了: ${audioData.length} bytes`);
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

main().catch(e => {
  console.error('❌ ナレーション生成失敗:', e.message);
  process.exit(1);
});
