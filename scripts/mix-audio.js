// narration.wav と assets/bgm 内からランダムに選んだBGMをミックスし、
// output.mp4（HyperFramesでレンダリング済み・無音）に合成する。
// ナレーションが動画より長い場合は、最後のフレームを止め絵にして動画を延長する。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NARRATION_PATH = path.join(ROOT, 'narration', 'combined.wav');
const VIDEO_PATH = path.join(ROOT, 'output.mp4');
const BGM_DIR = path.join(ROOT, 'assets', 'bgm');
const FINAL_PATH = path.join(ROOT, 'output_final.mp4');

function getDurationSeconds(filePath) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
  )
    .toString()
    .trim();
  return parseFloat(out);
}

function pickRandomBgm() {
  if (!fs.existsSync(BGM_DIR)) return null;
  const files = fs
    .readdirSync(BGM_DIR)
    .filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
  if (files.length === 0) return null;
  const picked = files[Math.floor(Math.random() * files.length)];
  console.log('選ばれたBGM:', picked);
  return path.join(BGM_DIR, picked);
}

function main() {
  if (!fs.existsSync(NARRATION_PATH)) {
    console.log('narration.wav が見つからないため、音声合成をスキップします。');
    return;
  }
  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error('output.mp4 が見つかりません。先に hyperframes render を実行してください。');
  }

  const narrationDuration = getDurationSeconds(NARRATION_PATH);
  const videoDuration = getDurationSeconds(VIDEO_PATH);
  console.log(`ナレーション長: ${narrationDuration}s / 動画長: ${videoDuration}s`);

  // ナレーションが動画より長ければ、最後のフレームを止めて動画を延長する
  let paddedVideoPath = VIDEO_PATH;
  const targetDuration = Math.max(narrationDuration + 0.5, videoDuration);
  if (targetDuration > videoDuration) {
    paddedVideoPath = path.join(ROOT, 'output_padded.mp4');
    execSync(
      `ffmpeg -y -i "${VIDEO_PATH}" -vf "tpad=stop_mode=clone:stop_duration=${(
        targetDuration - videoDuration
      ).toFixed(2)}" -c:v libx264 -pix_fmt yuv420p "${paddedVideoPath}"`,
      { stdio: 'inherit' }
    );
  }

  const bgmPath = pickRandomBgm();

  let audioFilterInputs = `-i "${NARRATION_PATH}"`;
  let filterComplex;
  let mapAudio = '1:a';

  if (bgmPath) {
    audioFilterInputs += ` -stream_loop -1 -i "${bgmPath}"`;
    // BGMは音量を下げてループ、ナレーションと長さを合わせてミックス
    filterComplex = `[2:a]volume=0.18,atrim=0:${targetDuration.toFixed(
      2
    )}[bgm];[1:a]apad[narr];[narr][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
    mapAudio = '[aout]';
  }

  const cmd = bgmPath
    ? `ffmpeg -y -i "${paddedVideoPath}" ${audioFilterInputs} -filter_complex "${filterComplex}" -map 0:v -map "${mapAudio}" -c:v copy -c:a aac -shortest "${FINAL_PATH}"`
    : `ffmpeg -y -i "${paddedVideoPath}" -i "${NARRATION_PATH}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${FINAL_PATH}"`;

  console.log('ffmpeg合成コマンドを実行します...');
  execSync(cmd, { stdio: 'inherit' });

  // アップロード対象を差し替え
  fs.copyFileSync(FINAL_PATH, VIDEO_PATH);
  console.log('output.mp4 にナレーション＋BGMを合成しました。');
}

main();

