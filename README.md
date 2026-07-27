# koukouyakyu-video-bot

高校野球の試合結果を、HyperFrames（HTML→MP4のOSSレンダラー）で自動的にショート動画化し、
YouTube Shortsに自動投稿するbotです。GASの「高校野球速報bot」から起動されます。

## 仕組み

GAS（高校野球速報bot）が試合をランダム選出（Threads投稿と同じタイミング）
→ GitHub Actions（repository_dispatch）が起動
→ 1. game.json を作成
  2. HTMLコンポジションに差し込み
    3. HyperFramesでMP4にレンダリング
      4. YouTube Data APIでShortsとしてアップロード
      → YouTube Shorts に公開
      
      ## セットアップ手順（初回のみ）
      
      ### 1. YouTube Data API の認証情報を取得
      
      1. Google Cloud Console で新しいプロジェクトを作成（または既存のものを使用）
      2. 「APIとサービス」→「ライブラリ」から YouTube Data API v3 を有効化
      3. 「APIとサービス」→「認証情報」→「OAuthクライアントIDを作成」
         アプリケーションの種類：デスクトップアプリ
            作成後、クライアントIDとクライアントシークレットをメモ
            4. OAuth同意画面で、テストユーザーとしてYouTubeにアップロードしたいGoogleアカウントを追加
            5. Google OAuth Playground を使ってリフレッシュトークンを取得
               1. 右上の歯車アイコンで自分のクライアントID/シークレットを入力
                  2. スコープ一覧から youtube.upload を選択して認可
                     3. Exchange authorization code for tokens で Refresh token を発行
                     
                     ### 2. GitHub Secretsに登録
                     
                     Settings → Secrets and variables → Actions で、以下の3つを登録してください。
                       YOUTUBE_CLIENT_ID
                         YOUTUBE_CLIENT_SECRET
                           YOUTUBE_REFRESH_TOKEN
                           
                           ### 3. GitHub Personal Access Token を発行（GAS側で使用）
                           
                           1. GitHubの Settings → Developer settings → Personal access tokens → Fine-grained tokens で新規発行
                           2. このリポジトリのみにアクセス権を絞る
                           3. 権限は Contents: Read and write があれば十分
                           4. 発行されたトークンを、GAS側のスクリプトプロパティに GITHUB_TOKEN として保存
                           
                           ### 4. 動作確認
                           
                           Actionsタブ → Render and Upload Koshien Short → Run workflow から、
                           サンプルデータで手動実行できます。
                           
                           ## 注意事項
                           
                           - YouTube Data APIの1日の割当量には上限があります。1日に投稿できる本数は数本程度が目安です。
                           - 動画のデザインは template フォルダ内のファイルで自由に調整できます。
                           koukouyakyu-video-bot
