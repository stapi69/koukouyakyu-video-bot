#!/usr/bin/env python3
"""
VoiceVoxナレーション生成
pykakasi で漢字→カナ変換してからVoiceVoxに送る
"""
import json, os, subprocess, sys
from urllib.parse import quote

SPEAKER = 3

def to_kana(text):
    """漢字テキストをカナに変換"""
    try:
        import pykakasi
        kks = pykakasi.kakasi()
        result = kks.convert(text)
        return ''.join([item['kana'] for item in result])
    except Exception as e:
        print(f"  kana変換失敗: {e}", flush=True)
        return text  # 変換失敗時はそのまま

def vv_synth(text, out_wav, dur=3):
    """VoiceVoxで合成（bash curlと同一方式）"""
    kana = to_kana(text)
    print(f"  kana: {kana[:40]}", flush=True)
    enc = quote(kana, safe='')
    
    r1 = subprocess.run(
        f'curl -s --max-time 60 -X POST "http://localhost:50021/audio_query?text={enc}&speaker={SPEAKER}"',
        shell=True, capture_output=True)
    
    print(f"  AQ: rc={r1.returncode} len={len(r1.stdout)}", flush=True)
    if r1.returncode != 0 or len(r1.stdout) < 100:
        return False
    
    with open('/tmp/vv_aq.json', 'wb') as f:
        f.write(r1.stdout)
    
    r2 = subprocess.run(
        f'curl -s --max-time 600 -X POST "http://localhost:50021/synthesis?speaker={SPEAKER}" '
        f'-H "Content-Type: application/json" -d @/tmp/vv_aq.json -o "{out_wav}"',
        shell=True, capture_output=True)
    
    sz = os.path.getsize(out_wav) if os.path.exists(out_wav) else 0
    print(f"  Syn: rc={r2.returncode} size={sz}", flush=True)
    return r2.returncode == 0 and sz > 1000

def silent(out_wav, dur=3):
    subprocess.run(f'ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t {dur} "{out_wav}" -loglevel quiet',
        shell=True, capture_output=True)

def main():
    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date = d.get('date', '')
    print(f"games={len(games)} date={date}", flush=True)
    os.makedirs('narration', exist_ok=True)

    segments = [
        (f"{date}の高校野球試合結果です。", 'narration/00_open.wav', 2),
    ]
    for i, g in enumerate(games):
        win = g['teamA'] if int(g['scoreA']) > int(g['scoreB']) else g['teamB']
        t = f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{win}が勝利しました。"
        segments.append((t, f'narration/{i+1:02d}_game.wav', 4))
    segments.append(("チャンネル登録よろしくお願いします。", 'narration/99_end.wav', 2))

    wavs, ok = [], 0
    for text, wav, dur in segments:
        print(f"\n[{wav}] {text[:50]}", flush=True)
        if vv_synth(text, wav, dur):
            ok += 1
            print(f"  ✅ 成功", flush=True)
        else:
            silent(wav, dur)
            print(f"  → 無音", flush=True)
        wavs.append(wav)

    print(f"\n成功: {ok}/{len(segments)}", flush=True)
    with open('narration/list.txt', 'w') as f:
        f.write('\n'.join([f"file '{w}'" for w in wavs]))
    
    r = subprocess.run(
        'ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y -loglevel quiet',
        shell=True, capture_output=True)
    
    if r.returncode != 0:
        silent('narration/combined.wav', 15)
    
    sz = os.path.getsize('narration/combined.wav') if os.path.exists('narration/combined.wav') else 0
    print(f"combined.wav: {sz} bytes (ok={ok}/{len(segments)})", flush=True)

if __name__ == '__main__':
    main()
