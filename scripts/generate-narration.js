// game.json からナレーション文を組み立て、VOICEVOXエンジン（ローカルAPI）で
// 音声合成し narration.wav を生成する
const fs = require('fs');
const path = require('path');

const VOICEVOX_URL = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
// ずんだもん（ノーマル）のスピーカーID
const SPEAKER_ID = process.env.VOICEVOX_SPEAKER_ID || '3';

async function main() {
  const gameJsonPath = path.join(__dirname, '..', 'game.json');
  const game = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));

  const text = buildNarrationText(game);
  console.log('ナレーション文:', text);

  // 1. audio_query
  const queryRes = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' }
  );
  if (!queryRes.ok) {
    throw new Error('audio_query に失敗しました: ' + (await queryRes.text()));
  }
  const query = await queryRes.json();

  // 話速を少し速めにして、テンポの良いショート動画向けにする
  query.speedScale = 1.1;

  // 2. synthesis
  const synthRes = await fetch(
    `${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    }
  );
  if (!synthRes.ok) {
    throw new Error('synthesis に失敗しました: ' + (await synthRes.text()));
  }

  const buffer = Buffer.from(await synthRes.arrayBuffer());
  const outputPath = path.join(__dirname, '..', 'narration.wav');
  fs.writeFileSync(outputPath, buffer);
  console.log('narration.wav を生成しました。');
}

function buildNarrationText(game) {
  const { teamA, scoreA, teamB, scoreB, tournament } = game;
  const sA = Number(scoreA);
  const sB = Number(scoreB);
  const winner = sA > sB ? teamA : teamB;
  const loser = sA > sB ? teamB : teamA;
  const winScore = Math.max(sA, sB);
  const loseScore = Math.min(sA, sB);

  return `${tournament}。${winner}が${loser}に、${winScore}対${loseScore}で勝利しました。`;
}

main().catch((err) => {
  console.error('ナレーション生成に失敗しました:', err.message || err);
  process.exit(1);
});
