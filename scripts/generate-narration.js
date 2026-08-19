const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games;
const date = game.date;
const SPEAKER = 3; // ずんだもん
const VOICEVOX_URL = 'http://localhost:50021';

async function generateVoice(text, filename) {
  const query = await axios.post(`${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`);
  const audio = await axios.post(`${VOICEVOX_URL}/synthesis?speaker=${SPEAKER}`, query.data, { responseType: 'arraybuffer' });
  fs.writeFileSync(filename, Buffer.from(audio.data));
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });

  // オープニング
  await generateVoice(`${date}の高校野球、試合結果ダイジェストです。`, 'narration/opening.wav');

  // 各試合
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    const text = `${g.tournament}、${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}。${winner}が勝利しました。`;
    await generateVoice(text, `narration/game${i}.wav`);
  }

  // エンディング
  await generateVoice('本日も熱戦をお届けしました。チャンネル登録よろしくお願いします！', 'narration/ending.wav');

  // 全音声を結合
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
