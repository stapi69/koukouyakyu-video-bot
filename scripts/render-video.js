const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const game = JSON.parse(fs.readFileSync('game.json', 'utf-8'));
const games = game.games || [game];

async function main() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  const htmlPath = path.resolve('composition/index.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  fs.mkdirSync('frames', { recursive: true });

  // スライドを取得して各スライドのスクリーンショットを撮る
  const slideCount = await page.evaluate(() => {
    return document.querySelectorAll('.slide').length;
  });

  // 各スライドの表示時間
  const OPENING_SECS = 2;
  const GAME_SECS = 3;
  const ENDING_SECS = 2;
  const FPS = 30;

  let frameIdx = 0;

  for (let i = 0; i < slideCount; i++) {
    // このスライドだけを表示
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, j) => {
        s.style.opacity = j === idx ? '1' : '0';
      });
    }, i);

    // このスライドの表示秒数を決定
    let secs = GAME_SECS;
    if (i === 0) secs = OPENING_SECS;
    if (i === slideCount - 1) secs = ENDING_SECS;

    const frameCount = Math.round(secs * FPS);
    const screenshot = await page.screenshot({ type: 'png' });

    for (let f = 0; f < frameCount; f++) {
      const fname = `frames/frame_${String(frameIdx).padStart(6, '0')}.png`;
      fs.writeFileSync(fname, screenshot);
      frameIdx++;
    }
    console.log(`スライド ${i+1}/${slideCount} 完了 (${secs}秒 = ${frameCount}フレーム)`);
  }

  await browser.close();

  // ffmpegでフレームを動画に変換
  execSync(`ffmpeg -y -framerate ${FPS} -i frames/frame_%06d.png -c:v libx264 -pix_fmt yuv420p -r ${FPS} output.mp4`);
  console.log('✅ 動画レンダリング完了: output.mp4');
}

main().catch(e => { console.error(e); process.exit(1); });
