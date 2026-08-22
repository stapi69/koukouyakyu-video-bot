const fs = require('fs');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';

fs.mkdirSync('narration', { recursive: true });

const texts = [
  { text: `${date}の高校野球、試合結果ダイジェストです。`, file: 'narration/opening' },
  ...games.map((g, i) => {
    const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    return {
      text: `${g.tournament}。${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}。${winner}が勝利しました。`,
      file: `narration/game${i}`
    };
  }),
  { text: '本日も熱戦をお届けしました。チャンネル登録よろしくお願いします。', file: 'narration/ending' }
];

// espeak-ngで音声生成（オフライン、日本語対応）
for (const { text, file } of texts) {
  console.log(`生成中: ${text.slice(0, 30)}...`);
  // テキストをファイルに書き出してから読み込む（特殊文字対策）
  fs.writeFileSync('/tmp/tts_input.txt', text, 'utf-8');
  execSync(
    `espeak-ng -v ja -s 130 -p 55 -f /tmp/tts_input.txt -w "${file}.wav"`,
    { stdio: 'inherit' }
  );
  console.log(`  ✅ ${file}.wav`);
}

// 結合
const wavFiles = texts.map(t => t.file + '.wav');
const fileList = wavFiles.map(f => `file '${f}'`).join('\n');
fs.writeFileSync('narration/list.txt', fileList);
execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');
console.log(`✅ ${games.length}試合分のナレーション生成完了（espeak-ng）`);
