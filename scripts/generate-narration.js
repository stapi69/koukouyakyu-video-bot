const fs = require('fs');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';

fs.mkdirSync('narration', { recursive: true });

// gTTSで音声生成するPythonスクリプトを実行
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

// Pythonスクリプトを生成
const pyScript = `
from gtts import gTTS
import sys

texts = ${JSON.stringify(texts.map(t => ({ text: t.text, file: t.file })))}

for item in texts:
    print(f"生成中: {item['text'][:30]}...")
    tts = gTTS(text=item['text'], lang='ja', slow=False)
    mp3_file = item['file'] + '.mp3'
    tts.save(mp3_file)
    print(f"  -> {mp3_file}")

print("全音声生成完了")
`;

fs.writeFileSync('/tmp/gtts_script.py', pyScript);

try {
  execSync('python3 /tmp/gtts_script.py', { stdio: 'inherit' });
} catch (e) {
  console.error('gTTS生成エラー:', e.message);
  process.exit(1);
}

// mp3→wavに変換してから結合
const files = texts.map(t => t.file);
const wavFiles = [];

for (const f of files) {
  const mp3 = f + '.mp3';
  const wav = f + '.wav';
  execSync(`ffmpeg -y -i "${mp3}" -ar 22050 -ac 1 "${wav}"`, { stdio: 'pipe' });
  wavFiles.push(wav);
}

const fileList = wavFiles.map(f => `file '${f}'`).join('\n');
fs.writeFileSync('narration/list.txt', fileList);
execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav');

console.log(`✅ ${games.length}試合分のナレーション生成完了（gTTS使用）`);
