# English Teacher - 英語読み上げプレーヤー

Web Speech APIとElevenLabs APIを使用した高品質な英語読み上げプレーヤーです。

## 機能

- **Web Speech API**: ブラウザ標準の音声合成機能
- **ElevenLabs API**: 高品質なAI音声合成
- **行ごとの読み上げ**: 英語文章を行ごとに分割して個別に再生
- **音声設定**: 速度、ピッチ、音量の調整
- **音声選択**: 複数の音声から選択可能
- **API接続テスト**: ElevenLabs APIの接続状況を確認

## 使用方法

1. HTMLファイルをブラウザで開く
2. 英語の文章をテキストエリアに入力
3. 「行に分割して表示」ボタンをクリック
4. 各行の「▶ 再生」ボタンで音声再生

## ElevenLabs API設定

ElevenLabs APIを使用する場合は、`script.js`内のAPIキーを設定してください。

```javascript
const ELEVENLABS_API_KEY = 'your-api-key-here';
```

## ファイル構成

- `index.html` - メインのHTMLファイル
- `script.js` - JavaScript機能（Web Speech API + ElevenLabs API）
- `styles.css` - CSSスタイル
- `README.md` - このファイル

## 技術仕様

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Speech API
- ElevenLabs API
- Git/GitHub

## ライセンス

MIT License
