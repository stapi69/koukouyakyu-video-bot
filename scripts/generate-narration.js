const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];
const date = game.date || '';
const SPEAKER = 3;

function log(msg) {
  console.log(msg);
  fs.appendFileSync('/tmp/narration_log.txt', msg + '\n');
}

function synthesize(text) {
  return new Promise((resolve, reject) => {
    // Step1: audio_query
    const qPath = `/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`;
    const qReq = http.request({ hostname:'localhost',port:50021,path:qPath,method:'POST' }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        log(`  audio_query status=${res.statusCode} len=${raw.length}`);
        let query;
        try { query = JSON.parse(raw); } 
        catch(e) { return reject(new Error('audio_query parse: ' + raw.slice(0,100))); }
        if (query.detail) return reject(new Error('audio_query detail: ' + query.detail));
        
        // Step2: synthesis
        const body = JSON.stringify(query);
        const sReq = http.request({
          hostname:'localhost', port:50021,
          path:`/synthesis?speaker=${SPEAKER}`, method:'POST',
          headers:{ 'Content-Type':'application/json','Content-Length':Buffer.byteLength(body) }
        }, sRes => {
          const sc = [];
          sRes.on('data', c => sc.push(c));
          sRes.on('end', () => {
            const audio = Buffer.concat(sc);
            log(`  synthesis status=${sRes.statusCode} ct=${sRes.headers['content-type']} len=${audio.length}`);
            if (audio.length < 100) return reject(new Error('synthesis too small: ' + audio.length));
            resolve(audio);
          });
        });
        sReq.on('error', e => reject(new Error('synthesis error: ' + e.message)));
        sReq.write(body);
        sReq.end();
      });
    });
    qReq.on('error', e => reject(new Error('audio_query error: ' + e.message)));
    qReq.end();
  });
}

async function main() {
  fs.mkdirSync('narration', { recursive: true });
  fs.writeFileSync('/tmp/narration_log.txt', '=== narration log ===\n');
  log(`date=${date} games=${games.length}`);

  const items = [
    { text: `${date}の高校野球、試合結果です。`, file: 'narration/opening.wav' },
    ...games.map((g,i) => ({
      text: `${g.teamA} ${g.scoreA}対${g.scoreB} ${g.teamB}`,
      file: `narration/game${i}.wav`
    })),
    { text: 'チャンネル登録お願いします', file: 'narration/ending.wav' }
  ];

  const wavs = [];
  for (const { text, file } of items) {
    log(`\n生成: ${text}`);
    try {
      const audio = await synthesize(text);
      fs.writeFileSync(file, audio);
      log(`  ✅ ${file}: ${audio.length} bytes`);
      wavs.push(file);
    } catch(e) {
      log(`  ❌ ERROR: ${e.message}`);
      // 無音フォールバック
      execSync(`ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t 3 "${file}"`, {stdio:'pipe'});
      log(`  → silent fallback`);
      wavs.push(file);
    }
  }

  fs.writeFileSync('narration/list.txt', wavs.map(w=>`file '${w}'`).join('\n'));
  execSync('ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y');
  const sz = fs.statSync('narration/combined.wav').size;
  log(`\ncombined.wav: ${sz} bytes`);
  console.log(fs.readFileSync('/tmp/narration_log.txt','utf-8'));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
