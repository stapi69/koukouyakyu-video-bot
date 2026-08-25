const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function main() {
  const videoPath = path.join(__dirname, '..', 'output_final.mp4');
  const gameJsonPath = path.join(__dirname, '..', 'game.json');

  console.log('NODE_VERSION:', process.version);
  console.log('YOUTUBE_CLIENT_ID exists:', !!process.env.YOUTUBE_CLIENT_ID);
  console.log('YOUTUBE_CLIENT_SECRET exists:', !!process.env.YOUTUBE_CLIENT_SECRET);
  console.log('YOUTUBE_REFRESH_TOKEN exists:', !!process.env.YOUTUBE_REFRESH_TOKEN);
  console.log('videoPath:', videoPath);
  console.log('file exists:', fs.existsSync(videoPath));
  if (fs.existsSync(videoPath)) {
    console.log('file size:', fs.statSync(videoPath).size, 'bytes');
  }

  if (!fs.existsSync(videoPath)) {
    console.error('output_final.mp4 が見つかりません。');
    process.exit(1);
  }

  const game = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));
  const games = game.games || [game];
  const date = game.date || '';

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

  // アクセストークンを事前取得してテスト
  try {
    const tokenInfo = await oauth2Client.getAccessToken();
    console.log('✅ アクセストークン取得成功');
  } catch (tokenErr) {
    console.error('❌ アクセストークン取得失敗:', tokenErr.message);
    process.exit(1);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const title = `高校野球速報ダイジェスト ${date} #Shorts`;
  const gameLines = games.map(g => {
    return `▶ ${g.teamA} ${g.scoreA}-${g.scoreB} ${g.teamB}（${g.tournament}）`;
  }).join('\n');
  const description = [`📅 ${date}の高校野球試合結果ダイジェスト`, '', gameLines, '', '#高校野球 #高校野球速報 #甲子園 #野球 #Shorts'].join('\n');

  console.log('タイトル:', title);
  console.log('YouTubeへのアップロードを開始します...');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title: title.slice(0, 100), description, categoryId: '17' },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  console.log('✅ アップロード完了: https://youtube.com/watch?v=' + res.data.id);
}

main().catch((err) => {
  console.error('❌ アップロードに失敗しました:');
  console.error('message:', err.message);
  console.error('code:', err.code);
  if (err.response) {
    console.error('response.status:', err.response.status);
    console.error('response.data:', JSON.stringify(err.response.data));

    // クォータ超過の場合はArtifactに動画を残してexit 0（ワークフローを失敗させない）
    const errors = err.response.data?.error?.errors || [];
    if (errors.some(e => e.reason === 'uploadLimitExceeded')) {
      console.log('');
      console.log('⚠️ YouTubeアップロードクォータ超過。');
      console.log('⚠️ 動画はArtifactに保存されます。翌日以降に手動アップロードしてください。');
      process.exit(0); // 正常終了 → Artifactステップが確実に動く
    }
  }
  process.exit(1);
});
