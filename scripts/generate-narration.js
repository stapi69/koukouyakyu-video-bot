const fs = require('fs');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3;

function pad2(n) { return String(n).padStart(2, '0'); }

function synth(text, file) {
  console.log('生成:', text.slice(0, 40));
  const enc = encodeURIComponent(text);

  // audio_query
  const aqJson = execSync(
    `curl -s -X POST "http://localhost:50021/audio_query?text=${enc}&speaker=${SPEAKER}"`,
    { encoding: 'buffer', timeout: 30000 }
  );
  console.log('  AQ size:', aqJson.length);
  if (aqJson.length < 100) throw new Error('audio_query too small: ' + aqJson.length);

  // synthesis（WAVファイルに直接書き込む）
  const tmpJson = '/tmp/vv_aq_' + Date.now() + '.json';
  fs.writeFileSync(tmpJson, aqJson);

  execSync(
    `curl -s -X POST "http://localhost:50021/synthesis?speaker=${SPEAKER}" ` +
    `-H "Content-Type: application/json" -d @${tmpJson} -o "${file}"`,
    { timeout: 300000 }
  );

  const sz = fs.statSync(file).size;
  console.log('  Wav size:', sz);
  if (sz < 1000) throw new Error('synthesis too small: ' + sz);
  console.log('  ✅ OK');
}

function silent(file, dur) {
  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${dur} "${file}" -loglevel quiet`);
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });

  const items = [
    { t: date + 'の高校野球、試合結果です。', f: 'narration/00_open.wav', d: 2 }
  ];
  games.forEach(function(g, i) {
    const w = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    items.push({
      t: g.teamA + '対' + g.teamB + '、' + w + 'が勝利。',
      f: 'narration/' + pad2(i+1) + '_game.wav',
      d: 4
    });
  });
  items.push({ t: 'チャンネル登録よろしくお願いします。', f: 'narration/99_end.wav', d: 2 });

  var ok = 0;
  for (var i = 0; i < items.length; i++) {
    try {
      synth(items[i].t, items[i].f);
      ok++;
    } catch(e) {
      console.log('  ❌', e.message);
      try { silent(items[i].f, items[i].d); } catch(e2) {}
    }
  }

  console.log('成功:', ok, '/', items.length);

  const list = items.map(function(x) { return "file '" + x.f + "'"; }).join('\n');
  fs.writeFileSync('narration/list.txt', list);
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y');
  console.log('✅ combined.wav 完成');
}

main().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
