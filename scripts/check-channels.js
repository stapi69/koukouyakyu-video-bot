const { google } = require('googleapis');

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const res = await youtube.channels.list({
    part: ['snippet', 'id'],
    mine: true
  });

  console.log('アクセス可能なチャンネル:');
  (res.data.items || []).forEach(ch => {
    console.log(`  ID: ${ch.id} | 名前: ${ch.snippet.title}`);
  });
}

main().catch(console.error);
