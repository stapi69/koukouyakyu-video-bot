const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3; // ずんだもん

// CPU版VoiceVoxは非常に遅いため長めのタイムアウトを設定
const QUERY_TIMEOUT_MS = 60000;   // 60秒
const SYNTH_TIMEOUT_MS = 300000;  // 5分（CPU合成は非常に遅い）

async function generateVoice(text, filename) {
  console.log(`生成中 [${filename}]: "${text.slice(0, 30)}..."`);

  // Step 1: audio_query
  const queryData = await new Promise((resolve, reject) => {
    const path = `/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`;
    const req = http.request(
      { hostname: 'localhost', port: 50021, path, method: 'POST' },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.detail) reject(new Error('audio_query error: ' + parsed.detail));
            else resolve(parsed);
          } catch (e) {
            reject(new Error('audio_query parse error: ' + e.message + ' | raw: ' + raw.slice(0, 100)));
          }
        });
      }
    );
    req.on('error', e => reject(new Error('audio_query network error: ' + e.message)));
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`audio_query timeout (${QUERY_TIMEOUT_MS}ms)`));
    }, QUERY_TIMEOUT_MS);
    req.on('close', () => clearTimeout(timer));
    req.end();
  });

  console.log(`  audio_query OK → synthesis開始 (CPU版は時間がかかります)`);

  // Step 2: synthesis（CPU版は非常に遅い）
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
    req.on('error', e => reject(new Error('synthesis network error: ' + e.message)));
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`synthesis timeout (${SYNTH_TIMEOUT_MS}ms) - CPU版が遅すぎる可能性`));
    }, SYNTH_TIMEOUT_MS);
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });

  if (audioData.length < 100) {
    throw new Error(`synthesis結果が小さすぎます: ${audioData.length} bytes`);
  }

  fs.writeFileSync(filename, audioData);
  console.log(`  ✅ ${filename}: ${audioData.length} bytes`);
}

async function main() {
  console.log('VoiceVoxナレーション生成開始');
  fs.mkdirSync('narration', { recursive: true });

  const texts = [
    { text: `${date}の高校野球、試合結果ダイジェストです。`, file: 'narration/opening.wav' },
    ...games.map((g, i) => {
      const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
      return {
        text: `${g.tournament}、${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}。${winner}が勝利しました。`,
        file: `narration/game${i}.wav`
      };
    }),
    { text: '本日も熱戦をお届けしました。チャンネル登録よろしくお願いします！', file: 'narration/ending.wav' }
  ];

  for (const { text, file } of texts) {
    await generateVoice(text, file);
  }

  const fileList = texts.map(t => `file '${t.file}'`).join('\n');
  fs.writeFileSync('narration/list.txt', fileList);
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');

  console.log(`✅ ${games.length}試合分のナレーション生成完了`);
}

main().catch(e => {
  console.error('❌ ナレーション生成失敗:', e.message);
  process.exit(1);
});
