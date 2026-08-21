const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function main() {
  const videoPath = path.join(__dirname, '..', 'output_final.mp4');
  const gameJsonPath = path.join(__dirname, '..', 'game.json');

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

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // タイトル：「高校野球速報ダイジェスト YYYY年M月D日 #Shorts」
  const title = `高校野球速報ダイジェスト ${date} #Shorts`;

  // 説明：各試合結果を列挙
  const gameLines = games.map(g => {
    const winner = g.scoreA > g.scoreB ? g.teamA : g.teamB;
    return `▶ ${g.teamA} ${g.scoreA}-${g.scoreB} ${g.teamB}（${g.tournament}）`;
  }).join('\n');

  const description = [
    `📅 ${date}の高校野球試合結果ダイジェスト`,
    '',
    gameLines,
    '',
    '#高校野球 #高校野球速報 #甲子園 #野球 #Shorts'
  ].join('\n');

  console.log('タイトル:', title);
  console.log('YouTubeへのアップロードを開始します...');

  const insertParams = {
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
  };

  // チャンネルIDが指定されていればonBehalfOfContentOwnerChannelを使用
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (channelId) {
    insertParams.requestBody.snippet.channelId = channelId;
    console.log('チャンネルID指定:', channelId);
  }

  const res = await youtube.videos.insert(insertParams);

  console.log('アップロード完了: https://youtube.com/watch?v=' + res.data.id);
}

main().catch((err) => {
  console.error('アップロードに失敗しました:', err.message || err);
  process.exit(1);
});
