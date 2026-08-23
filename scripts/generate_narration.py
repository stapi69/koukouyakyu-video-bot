#!/usr/bin/env python3
"""
VoiceVoxナレーション生成スクリプト
bashのcurlコマンドで直接VoiceVox APIを呼び出す
"""
import json, os, subprocess, sys
from urllib.parse import quote

SPEAKER = 3

def vv_synthesize_text(text, out_wav):
    """VoiceVoxでテキストをWAVに変換。失敗時はFalseを返す"""
    enc = quote(text, safe='')
    
    # audio_query
    r1 = subprocess.run(
        f'curl -s -X POST "http://localhost:50021/audio_query?text={enc}&speaker={SPEAKER}"',
        shell=True, capture_output=True
    )
    if r1.returncode != 0 or len(r1.stdout) < 100:
        print(f"    audio_query失敗 rc={r1.returncode} size={len(r1.stdout)}", flush=True)
        return False
    
    # JSONチェック
    try:
        q = json.loads(r1.stdout)
    except Exception as e:
        print(f"    JSON解析エラー: {e}", flush=True)
        return False
    
    # synthesis
    with open('/tmp/vv_aq.json', 'wb') as f:
        f.write(r1.stdout)
    
    r2 = subprocess.run(
        f'curl -s -X POST "http://localhost:50021/synthesis?speaker={SPEAKER}" '
        f'-H "Content-Type: application/json" -d @/tmp/vv_aq.json -o "{out_wav}"',
        shell=True, capture_output=True
    )
    
    sz = os.path.getsize(out_wav) if os.path.exists(out_wav) else 0
    print(f"    synthesis rc={r2.returncode} size={sz}", flush=True)
    return r2.returncode == 0 and sz > 1000

def make_silent(out_wav, seconds=3):
    subprocess.run(
        f'ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t {seconds} "{out_wav}"',
        shell=True, capture_output=True
    )

def main():
    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date = d.get('date', '')
    print(f"date={date} games={len(games)}", flush=True)
    os.makedirs('narration', exist_ok=True)

    wavs = []
    ok = 0

    segments = [
        (f"{date}の高校野球試合結果です。", 'narration/00_open.wav', 2),
    ]
    for i, g in enumerate(games):
        win = g['teamA'] if int(g['scoreA']) > int(g['scoreB']) else g['teamB']
        t = f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{win}が勝利。"
        segments.append((t, f'narration/{i+1:02d}_game.wav', 4))
    segments.append(("チャンネル登録お願いします。", 'narration/99_end.wav', 2))

    for text, wav, dur in segments:
        print(f"\n[{wav}] {text[:50]}", flush=True)
        if vv_synthesize_text(text, wav):
            ok += 1
            print(f"  ✅ 成功", flush=True)
        else:
            make_silent(wav, dur)
            print(f"  → 無音フォールバック", flush=True)
        wavs.append(wav)

    print(f"\n成功: {ok}/{len(segments)}", flush=True)

    # 結合
    list_txt = '\n'.join([f"file '{w}'" for w in wavs])
    with open('narration/list.txt', 'w') as f:
        f.write(list_txt)
    
    r = subprocess.run(
        'ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y',
        shell=True, capture_output=True
    )
    if r.returncode != 0:
        print(f"concat失敗: {r.stderr.decode()[:300]}", flush=True)
        # フォールバック: 無音のcombined.wavを生成
        subprocess.run(
            'ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 15 narration/combined.wav',
            shell=True, capture_output=True
        )
    
    sz = os.path.getsize('narration/combined.wav') if os.path.exists('narration/combined.wav') else 0
    print(f"✅ combined.wav: {sz} bytes", flush=True)

if __name__ == '__main__':
    main()
