// レンダリング済みのMP4をYouTube Data API v3でアップロードする
// 必要な環境変数（GitHub Secretsから渡される）:
//   YOUTUBE_CLIENT_ID
//   YOUTUBE_CLIENT_SECRET
//   YOUTUBE_REFRESH_TOKEN
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function main() {
  const videoPath = path.join(__dirname, '..', 'output.mp4');
  const gameJsonPath = path.join(__dirname, '..', 'game.json');

  if (!fs.existsSync(videoPath)) {
    console.error('output.mp4 が見つかりません。先に hyperframes render を実行してください。');
    process.exit(1);
  }

  const game = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const title = `【${game.tournament}】${game.teamA} ${game.scoreA}-${game.scoreB} ${game.teamB} #Shorts`;
  const description = [
    `${game.tournament}`,
    `${game.teamA} ${game.scoreA} - ${game.scoreB} ${game.teamB}`,
    '',
    game.hashtags || '#高校野球 #高校野球速報 #甲子園への道',
  ].join('\n');

  console.log('YouTubeへのアップロードを開始します...');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description,
        categoryId: '17',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  console.log('アップロード完了: https://youtube.com/watch?v=' + res.data.id);
}

main().catch((err) => {
  console.error('アップロードに失敗しました:', err.message || err);
  process.exit(1);
});

