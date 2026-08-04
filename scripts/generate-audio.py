"""
generate-audio.py - 从 daily-content.json 读取文本，生成 TTS 音频文件
使用 gTTS (Google Text-to-Speech) 生成 MP3
运行：python scripts/generate-audio.py
"""

import json
import os
import hashlib
from gtts import gTTS

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', 'audio')
INPUT_FILE = os.path.join(DATA_DIR, 'daily-content.json')

def text_to_filename(text, prefix):
    """将文本转为稳定的文件名"""
    h = hashlib.md5(text.encode()).hexdigest()[:12]
    return f"{prefix}_{h}.mp3"

def generate_tts(text, output_path, lang='en', slow=False):
    """生成 TTS 音频文件"""
    if not text or not text.strip():
        return False
    try:
        tts = gTTS(text=text, lang=lang, slow=slow)
        tts.save(output_path)
        return True
    except Exception as e:
        print(f"  生成失败 [{output_path}]: {e}")
        return False

def main():
    print("=== 生成 TTS 音频文件 ===")

    # 创建音频目录
    os.makedirs(AUDIO_DIR, exist_ok=True)

    # 读取今日内容
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"错误：无法读取 {INPUT_FILE}: {e}")
        return

    generated = 0
    skipped = 0

    # 1. 单词音频
    word = data.get('word', {})
    if word:
        # 单词本身（慢速，方便学习）
        fn = text_to_filename(word.get('word', ''), 'word')
        path = os.path.join(AUDIO_DIR, fn)
        if not os.path.exists(path):
            if generate_tts(word.get('word', ''), path, slow=True):
                generated += 1
                print(f"  ✓ 单词: {word.get('word')}")
            else:
                skipped += 1
        else:
            skipped += 1

        # 例句
        fn = text_to_filename(word.get('example', ''), 'example')
        path = os.path.join(AUDIO_DIR, fn)
        if not os.path.exists(path):
            if generate_tts(word.get('example', ''), path):
                generated += 1
                print(f"  ✓ 例句: {word.get('word')}")
            else:
                skipped += 1
        else:
            skipped += 1

        # 电影台词
        mq = word.get('movieQuote', {})
        if mq and mq.get('quote'):
            fn = text_to_filename(mq['quote'], 'movie')
            path = os.path.join(AUDIO_DIR, fn)
            if not os.path.exists(path):
                if generate_tts(mq['quote'], path, slow=True):
                    generated += 1
                    print(f"  ✓ 电影台词: {mq.get('movie')}")
                else:
                    skipped += 1
            else:
                skipped += 1

    # 2. 口语范例音频
    speaking = data.get('speaking', {})
    if speaking and speaking.get('sampleAnswer'):
        fn = text_to_filename(speaking['sampleAnswer'], 'speaking')
        path = os.path.join(AUDIO_DIR, fn)
        if not os.path.exists(path):
            if generate_tts(speaking['sampleAnswer'], path):
                generated += 1
                print(f"  ✓ 口语范例: {speaking.get('topic')}")
            else:
                skipped += 1
        else:
            skipped += 1

    # 3. 语法例句音频
    grammar = data.get('grammar', {})
    for i, ex in enumerate(grammar.get('examples', [])):
        sentence = ex.get('sentence', '')
        if not sentence:
            continue
        fn = text_to_filename(sentence, 'grammar')
        path = os.path.join(AUDIO_DIR, fn)
        if not os.path.exists(path):
            if generate_tts(sentence, path, slow=True):
                generated += 1
                print(f"  ✓ 语法例句 {i+1}")
            else:
                skipped += 1
        else:
            skipped += 1

    print(f"\n完成：生成 {generated} 个音频，跳过 {skipped} 个")
    print(f"音频目录: {os.path.relpath(AUDIO_DIR, os.path.dirname(__file__))}")

if __name__ == '__main__':
    main()
