#!/usr/bin/env python3
"""
Google Cloud Text-to-Speech でナレーション生成
- 月50万文字まで無料（Standard音声）
- 認証: GOOGLE_APPLICATION_CREDENTIALS 環境変数
"""
import json, os, subprocess, sys, base64
from urllib.request import urlopen, Request
from urllib.error import URLError

def get_access_token():
    """サービスアカウントのJSONキーからアクセストークンを取得"""
    creds_file = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')
    if not creds_file or not os.path.exists(creds_file):
        raise RuntimeError('GOOGLE_APPLICATION_CREDENTIALS が設定されていません')

    # gcloudコマンドでトークン取得（GitHub Actionsでgcloud利用可能）
    r = subprocess.run(['gcloud', 'auth', 'print-access-token'],
                       capture_output=True, text=True)
    if r.returncode == 0:
        return r.stdout.strip()

    # フォールバック: metadataサーバーやcurlでも取得試みる
    raise RuntimeError(f'アクセストークン取得失敗: {r.stderr[:100]}')

def tts_synthesize(text, lang='ja-JP', voice='ja-JP-Neural2-B'):
    """Google Cloud TTSでテキストを音声化してWAVバイト列を返す"""
    token = get_access_token()
    payload = json.dumps({
        'input': {'text': text},
        'voice': {'languageCode': lang, 'name': voice},
        'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}
    }).encode('utf-8')

    req = Request(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        data=payload,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    )
    with urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())

    audio_content = result.get('audioContent', '')
    if not audio_content:
        raise RuntimeError('audioContent が空です')

    # base64デコードしてWAVに変換（LINEAR16 = PCM）
    pcm_data = base64.b64decode(audio_content)

    # PCM → WAV（ヘッダー追加）
    import struct
    channels, rate, bits = 1, 24000, 16
    data_size = len(pcm_data)
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', data_size + 36, b'WAVE',
        b'fmt ', 16, 1, channels, rate,
        rate * channels * bits // 8, channels * bits // 8, bits,
        b'data', data_size)
    return header + pcm_data

def silent_wav(duration_sec=3, rate=24000):
    """無音WAVを生成"""
    import struct
    channels, bits = 1, 16
    data_size = int(duration_sec * rate * channels * bits // 8)
    pcm_data = b'\x00' * data_size
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', data_size + 36, b'WAVE',
        b'fmt ', 16, 1, channels, rate,
        rate * channels * bits // 8, channels * bits // 8, bits,
        b'data', data_size)
    return header + pcm_data

def main():
    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date = d.get('date', '')
    print(f"games={len(games)} date={date}", flush=True)
    os.makedirs('narration', exist_ok=True)

    segments = [
        (f"{date}の高校野球、試合結果ダイジェストです。", 'narration/00_open.wav', 2),
    ]
    for i, g in enumerate(games):
        win = g['teamA'] if int(g['scoreA']) > int(g['scoreB']) else g['teamB']
        t = f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{win}が勝利しました。"
        segments.append((t, f"narration/{i+1:02d}_game.wav", 4))
    segments.append(("本日も熱戦をお届けしました。チャンネル登録よろしくお願いします。", 'narration/99_end.wav', 2))

    wavs, ok = [], 0
    for text, wav, dur in segments:
        print(f"\n生成: {text[:50]}", flush=True)
        try:
            audio = tts_synthesize(text)
            with open(wav, 'wb') as f:
                f.write(audio)
            print(f"  ✅ {wav}: {len(audio)} bytes", flush=True)
            ok += 1
        except Exception as e:
            print(f"  ❌ {e}", flush=True)
            with open(wav, 'wb') as f:
                f.write(silent_wav(dur))
        wavs.append(wav)

    print(f"\n成功: {ok}/{len(segments)}", flush=True)
    with open('narration/list.txt', 'w') as f:
        f.write('\n'.join([f"file '{w}'" for w in wavs]))

    r = subprocess.run(
        'ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y -loglevel quiet',
        shell=True, capture_output=True)
    if r.returncode != 0:
        with open('narration/combined.wav', 'wb') as f:
            f.write(silent_wav(15))
    sz = os.path.getsize('narration/combined.wav')
    print(f"combined.wav: {sz} bytes (ok={ok}/{len(segments)})", flush=True)

if __name__ == '__main__':
    main()
