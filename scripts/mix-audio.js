// narration/combined.wav と assets/bgm 内のBGMをミックスして output_final.mp4 を生成する
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VIDEO_PATH = path.join(ROOT, 'output.mp4');
const NARRATION_PATH = path.join(ROOT, 'narration', 'combined.wav');
const BGM_DIR = path.join(ROOT, 'assets', 'bgm');
const FINAL_PATH = path.join(ROOT, 'output_final.mp4');

function getDurationSeconds(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return parseFloat(result.trim()) || 0;
  } catch (e) {
    return 0;
  }
}

function pickRandomBgm() {
  if (!fs.existsSync(BGM_DIR)) return null;
  const files = fs.readdirSync(BGM_DIR)
    .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
  if (files.length === 0) return null;
  const picked = files[Math.floor(Math.random() * files.length)];
  console.log('選ばれたBGM:', picked);
  return path.join(BGM_DIR, picked);
}

// ナレーションなし時: BGMのみミックス
function mixBgmOnly() {
  const bgmPath = pickRandomBgm();
  if (!bgmPath) {
    console.log('BGMファイルなし - 音声なしでコピー');
    fs.copyFileSync(VIDEO_PATH, FINAL_PATH);
    return;
  }
  console.log('BGMのみミックス中:', bgmPath);
  try {
    execSync(
      `ffmpeg -y -i "${VIDEO_PATH}" -stream_loop -1 -i "${bgmPath}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${FINAL_PATH}"`,
      { stdio: 'pipe' }
    );
    console.log('BGMミックス完了');
  } catch (e) {
    console.log('BGMミックス失敗:', e.message, '→ 音声なしでコピー');
    fs.copyFileSync(VIDEO_PATH, FINAL_PATH);
  }
}

if (!fs.existsSync(NARRATION_PATH)) {
  console.log('narration/combined.wav が見つかりません。BGMのみミックスします。');
  if (fs.existsSync(VIDEO_PATH)) {
    mixBgmOnly();
  }
  process.exit(0);
}

if (!fs.existsSync(VIDEO_PATH)) {
  throw new Error('output.mp4 が見つかりません。');
}

const narrationDuration = getDurationSeconds(NARRATION_PATH);
const videoDuration = getDurationSeconds(VIDEO_PATH);

console.log(`ナレーション長: ${narrationDuration}s / 動画長: ${videoDuration}s`);

// 動画をナレーションの長さに合わせてパディング
let paddedVideoPath = VIDEO_PATH;
const targetDuration = Math.max(narrationDuration + 0.5, videoDuration);

if (targetDuration > videoDuration + 0.1) {
  paddedVideoPath = path.join(ROOT, 'output_padded.mp4');
  execSync(
    `ffmpeg -y -i "${VIDEO_PATH}" -vf "tpad=stop_mode=clone:stop_duration=${targetDuration - videoDuration}" "${paddedVideoPath}"`,
    { stdio: 'pipe' }
  );
}

const bgmPath = pickRandomBgm();

let audioFilterInputs = `-i "${NARRATION_PATH}"`;
let filterComplex = '';
let mapAudio = '1:a';

if (bgmPath) {
  audioFilterInputs += ` -stream_loop -1 -i "${bgmPath}"`;
  filterComplex = `-filter_complex "[2:a]volume=0.2,apad[bgm];[1:a]apad[narr];[narr][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"`;
  mapAudio = '[aout]';
}

const cmd = bgmPath
  ? `ffmpeg -y -i "${paddedVideoPath}" ${audioFilterInputs} ${filterComplex} -map 0:v -map "${mapAudio}" -c:v copy -c:a aac -shortest "${FINAL_PATH}"`
  : `ffmpeg -y -i "${paddedVideoPath}" -i "${NARRATION_PATH}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${FINAL_PATH}"`;

execSync(cmd, { stdio: 'pipe' });
fs.copyFileSync(FINAL_PATH, VIDEO_PATH);
console.log('output.mp4 にナレーション＋BGMを合成しました。');
