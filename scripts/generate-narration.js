const fs = require('fs');
const { execSync } = require('child_process');

try {
  const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
  const games = game.games || [game];
  
  fs.mkdirSync('narration', { recursive: true });
  
  console.log('game.json読み込み成功:', JSON.stringify(game).slice(0, 100));
  console.log('試合数:', games.length);
  
  // 総ビデオ時間を計算（オープニング2s + 各試合3s + エンディング2s）
  const totalSecs = 2 + (games.length * 3) + 2;
  
  // ffmpegで無音wavを生成（後でBGMがミックスされる）
  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t ${totalSecs} narration/combined.wav`, { stdio: 'inherit' });
  
  console.log(`✅ narration/combined.wav 生成 (${totalSecs}秒)`);
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
}
