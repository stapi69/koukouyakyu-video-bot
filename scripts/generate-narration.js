const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';

fs.mkdirSync('narration', { recursive: true });

const texts = [
  { text: `${date}の高校野球、試合結果です。`, file: 'narration/opening' },
  ...games.map((g, i) => {
    const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    return {
      text: `${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}、${winner}勝利。`,
      file: `narration/game${i}`
    };
  }),
  { text: 'チャンネル登録よろしくお願いします。', file: 'narration/ending' }
];

// espeak-ngで日本語テキストを直接渡す（-f フラグなし）
for (const { text, file } of texts) {
  console.log(`生成中: ${text.slice(0, 30)}...`);

  // まずespeak-ngで試す
  const result = spawnSync('espeak-ng', ['-v', 'ja', '-s', '130', text, '-w', `${file}.wav`], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    console.log(`espeak-ng失敗: ${result.stderr}`);
    // フォールバック: ffmpegで無音WAVを生成（3秒）
    console.log(`  → 無音ファイルで代替`);
    execSync(`ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t 3 "${file}.wav"`, { stdio: 'pipe' });
  } else {
    console.log(`  ✅ ${file}.wav (espeak-ng)`);
  }
}

// 結合
const wavFiles = texts.map(t => t.file + '.wav');
const fileList = wavFiles.map(f => `file '${f}'`).join('\n');
fs.writeFileSync('narration/list.txt', fileList);
execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');
console.log(`✅ ナレーション生成完了（${games.length}試合分）`);
