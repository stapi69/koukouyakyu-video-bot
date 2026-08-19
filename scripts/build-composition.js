const fs = require('fs');
const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const template = fs.readFileSync('template/composition.template.html', 'utf-8');

const games = game.games;
const date = game.date;

// 試合スライドHTML生成
const gameSlides = games.map((g, i) => {
  const isAWin = g.scoreA > g.scoreB;
  return `
<div class="slide slide-game" id="slide-game-${i + 1}">
  <div class="tournament-label">${g.tournament}</div>
  <div class="matchup">
    <div class="team-block">
      <div class="team-name">${g.teamA}</div>
      <div class="score">${g.scoreA}</div>
      ${isAWin ? '<div class="win-badge">勝利</div>' : ''}
    </div>
    <div class="vs-label">－</div>
    <div class="team-block">
      <div class="team-name">${g.teamB}</div>
      <div class="score">${g.scoreB}</div>
      ${!isAWin ? '<div class="win-badge">勝利</div>' : ''}
    </div>
  </div>
  <div class="slide-counter">${i + 1} / ${games.length}</div>
</div>`;
}).join('\n');

// 試合数分の尺（各3秒）
const gameDurations = games.map(() => 3).join(', ');

// テンプレートに埋め込み
let html = template
  .replace('{{DATE}}', date)
  .replace('{{GAME_SLIDES}}', gameSlides)
  .replace('{{GAME_DURATIONS}}', gameDurations);

fs.mkdirSync('composition', { recursive: true });
fs.writeFileSync('composition/index.html', html);
console.log(`✅ ${games.length}試合分のスライドを生成しました`);
