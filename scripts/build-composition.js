// game.json の内容をテンプレートに差し込んで、レンダリング用の index.html を生成する
const fs = require('fs');
const path = require('path');

const gameJsonPath = path.join(__dirname, '..', 'game.json');
const templatePath = path.join(__dirname, '..', 'template', 'composition.template.html');
const outputDir = path.join(__dirname, '..', 'composition');
const outputPath = path.join(outputDir, 'index.html');

if (!fs.existsSync(gameJsonPath)) {
  console.error('game.json が見つかりません。GitHub Actions のワークフローが正しく生成しているか確認してください。');
  process.exit(1);
}

const game = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));

const required = ['teamA', 'scoreA', 'teamB', 'scoreB', 'tournament'];
for (const key of required) {
  if (game[key] === undefined || game[key] === null || game[key] === '') {
    console.error(`game.json に必須フィールド "${key}" がありません。`);
    process.exit(1);
  }
}

const scoreA = Number(game.scoreA);
const scoreB = Number(game.scoreB);
const winner = scoreA > scoreB ? game.teamA : game.teamB;
const winScore = Math.max(scoreA, scoreB);
const loseScore = Math.min(scoreA, scoreB);
const hashtags = game.hashtags || '#高校野球 #高校野球速報 #甲子園への道';

let html = fs.readFileSync(templatePath, 'utf-8');

const replacements = {
  '{{TOURNAMENT}}': escapeHtml(game.tournament),
  '{{TEAM_A}}': escapeHtml(game.teamA),
  '{{TEAM_B}}': escapeHtml(game.teamB),
  '{{SCORE_A}}': String(scoreA),
  '{{SCORE_B}}': String(scoreB),
  '{{WINNER}}': escapeHtml(winner),
  '{{WIN_SCORE}}': String(winScore),
  '{{LOSE_SCORE}}': String(loseScore),
  '{{HASHTAGS}}': escapeHtml(hashtags),
};

for (const [key, value] of Object.entries(replacements)) {
  html = html.split(key).join(value);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf-8');

console.log('composition/index.html を生成しました。');
console.log(`  ${game.tournament} : ${game.teamA} ${scoreA} - ${scoreB} ${game.teamB}`);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

