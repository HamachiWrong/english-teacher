(function() {
  /**
   * Line-by-line TTS player using Web Speech API and ElevenLabs API
   */

  const inputEl = document.getElementById('inputText');
  const splitButton = document.getElementById('splitButton');
  const continuousPlayButton = document.getElementById('continuousPlayButton');
  const linesContainer = document.getElementById('linesContainer');
  const voiceInfoEl = document.getElementById('voiceInfo');
  const rateInput = document.getElementById('rateInput');
  const rateValue = document.getElementById('rateValue');
  const voiceSelect = document.getElementById('voiceSelect');
  const pitchInput = document.getElementById('pitchInput');
  const pitchValue = document.getElementById('pitchValue');
  const volumeInput = document.getElementById('volumeInput');
  const volumeValue = document.getElementById('volumeValue');
  const engineSelect = document.getElementById('engineSelect');

  // ElevenLabs API設定
  const ELEVENLABS_API_KEY = 'sk_2da63f8ca0289839043cb1a8851f60a6de1920c2a6e2380d';
  const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
  
  // APIキーの検証
  function validateApiKey() {
    if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.length < 10) {
      console.error('ElevenLabs APIキーが無効です');
      voiceInfoEl.textContent = 'ElevenLabs APIキーが設定されていません';
      return false;
    }
    console.log('ElevenLabs APIキー検証OK:', ELEVENLABS_API_KEY.substring(0, 10) + '...');
    return true;
  }
  
  /** @type {string} */
  let currentEngine = 'elevenlabs'; // 'webspeech' or 'elevenlabs'
  
  /** @type {string|null} */
  let selectedElevenLabsVoice = null;
  
  /** @type {string|null} */
  let selectedWebSpeechVoice = null;
  
  /** @type {boolean} */
  let isContinuousPlaying = false;
  
  /** @type {number} */
  let currentPlayingIndex = -1;

  /** @type {Array} */
  let elevenLabsVoices = [];
  
  /** @type {Array} */
  let webSpeechVoices = [];

  // TTS音声キャッシュ（voiceId + text -> objectURL）
  const ttsAudioCache = new Map();
  function getCacheKey(text) {
    return `${currentEngine}::${selectedElevenLabsVoice || selectedWebSpeechVoice || ''}::${text}`;
  }
  async function getAudioUrlForText(text) {
    if (currentEngine === 'webspeech') {
      // Web Speech APIはキャッシュしない（直接再生）
      return null;
    }
    
    const key = getCacheKey(text);
    if (ttsAudioCache.has(key)) {
      return ttsAudioCache.get(key);
    }
    
    if (currentEngine === 'elevenlabs') {
      const url = await generateElevenLabsSpeech(text, selectedElevenLabsVoice);
      ttsAudioCache.set(key, url);
      return url;
    }
    
    return null;
  }
  function clearTtsCache() {
    for (const url of ttsAudioCache.values()) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
    ttsAudioCache.clear();
  }

  // ElevenLabs API機能
  async function fetchElevenLabsVoices() {
    try {
      if (!validateApiKey()) {
        return [];
      }
      
      console.log('ElevenLabs API接続中...', `${ELEVENLABS_API_URL}/voices`);
      
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });
      
      console.log('ElevenLabs API レスポンス:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API エラーレスポンス:', errorText);
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('ElevenLabs API データ:', data);
      
      elevenLabsVoices = data.voices || [];
      console.log('取得した音声数:', elevenLabsVoices.length);
      
      return elevenLabsVoices;
    } catch (error) {
      console.error('ElevenLabs音声取得エラー:', error);
      voiceInfoEl.textContent = `ElevenLabs API エラー: ${error.message}`;
      return [];
    }
  }

  async function generateElevenLabsSpeech(text, voiceId) {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      return audioUrl;
    } catch (error) {
      console.error('ElevenLabs TTS エラー:', error);
      throw error;
    }
  }

  // Web Speech API機能
  function getWebSpeechVoices() {
    if (!('speechSynthesis' in window)) {
      console.error('Web Speech APIがサポートされていません');
      return [];
    }
    return speechSynthesis.getVoices();
  }

  async function buildWebSpeechVoiceList() {
    voiceSelect.innerHTML = '<option value="">音声を読み込み中...</option>';
    voiceInfoEl.textContent = 'Web Speech API音声を読み込み中...';
    
    try {
      // ブラウザによっては一度setTimeoutが必要な場合がある
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const voices = getWebSpeechVoices();
      webSpeechVoices = voices;
      
      voiceSelect.innerHTML = '';
      
      if (voices.length === 0) {
        voiceSelect.innerHTML = '<option value="">音声が見つかりません</option>';
        voiceInfoEl.textContent = 'Web Speech API音声が見つかりませんでした。';
        return;
      }

      console.log('利用可能なWeb Speech音声:', voices.length);

      // 英語の音声をフィルタリング
      const englishVoices = voices.filter(voice => 
        voice.lang.startsWith('en') || voice.lang.includes('English')
      );

      (englishVoices.length > 0 ? englishVoices : voices).forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(opt);
      });

      // デフォルト音声を選択
      if (voiceSelect.options.length > 0) {
        voiceSelect.value = voiceSelect.options[0].value;
        selectedWebSpeechVoice = voiceSelect.options[0].value;
      }

      updateVoiceInfo();
    } catch (error) {
      console.error('Web Speech音声一覧構築エラー:', error);
      voiceSelect.innerHTML = '<option value="">エラー: 音声を取得できません</option>';
      voiceInfoEl.textContent = `Web Speech API エラー: ${error.message}`;
    }
  }

  function speakWithWebSpeech(text) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Web Speech APIがサポートされていません'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedWebSpeechVoice) {
        const voices = getWebSpeechVoices();
        const voice = voices.find(v => v.name === selectedWebSpeechVoice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.rate = parseFloat(rateInput.value);
      utterance.pitch = parseFloat(pitchInput.value);
      utterance.volume = parseFloat(volumeInput.value);

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(e.error));
      
      speechSynthesis.speak(utterance);
    });
  }

  function updateRateLabel() {
    rateValue.textContent = parseFloat(rateInput.value).toFixed(2) + 'x';
  }
  updateRateLabel();
  rateInput.addEventListener('input', updateRateLabel);

  function updatePitchVolumeLabels() {
    pitchValue.textContent = parseFloat(pitchInput.value).toFixed(2);
    volumeValue.textContent = parseFloat(volumeInput.value).toFixed(2);
  }
  updatePitchVolumeLabels();
  pitchInput.addEventListener('input', updatePitchVolumeLabels);
  volumeInput.addEventListener('input', updatePitchVolumeLabels);

  async function buildVoiceList() {
    if (currentEngine === 'webspeech') {
      await buildWebSpeechVoiceList();
    } else if (currentEngine === 'elevenlabs') {
      await buildElevenLabsVoiceList();
    }
  }

  async function buildElevenLabsVoiceList() {
    voiceSelect.innerHTML = '<option value="">音声を読み込み中...</option>';
    voiceInfoEl.textContent = 'ElevenLabs音声を取得中...';
    
    try {
      const voices = await fetchElevenLabsVoices();
      
      // Clear and rebuild
      voiceSelect.innerHTML = '';
      
      if (voices.length === 0) {
        voiceSelect.innerHTML = '<option value="">音声が見つかりません</option>';
        voiceInfoEl.textContent = 'ElevenLabs音声が見つかりませんでした。APIキーまたはアカウント設定を確認してください。';
        return;
      }

      console.log('利用可能な音声:', voices);

      voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voice_id;
        opt.textContent = `${voice.name} (${voice.labels?.gender || 'unknown'})`;
        voiceSelect.appendChild(opt);
      });

      // Select Roger voice by default, or first voice if Roger not found
      let defaultVoice = voices.find(v => v.name.toLowerCase().includes('roger'));
      if (!defaultVoice && voices.length > 0) {
        defaultVoice = voices[0];
      }
      
      if (defaultVoice) {
        voiceSelect.value = defaultVoice.voice_id;
        selectedElevenLabsVoice = defaultVoice.voice_id;
        console.log('デフォルト音声選択:', defaultVoice);
      }

      updateVoiceInfo();
    } catch (error) {
      console.error('ElevenLabs音声一覧構築エラー:', error);
      voiceSelect.innerHTML = '<option value="">エラー: 音声を取得できません</option>';
      voiceInfoEl.textContent = `ElevenLabs API エラー: ${error.message}`;
    }
  }

  function updateVoiceInfo() {
    if (currentEngine === 'webspeech') {
      if (selectedWebSpeechVoice) {
        const voice = webSpeechVoices.find(v => v.name === selectedWebSpeechVoice);
        if (voice) {
          voiceInfoEl.textContent = `Web Speech音声: ${voice.name} (${voice.lang})`;
        } else {
          voiceInfoEl.textContent = 'Web Speech音声: 選択中...';
        }
      } else {
        voiceInfoEl.textContent = 'Web Speech音声: 選択中...';
      }
    } else if (currentEngine === 'elevenlabs') {
      if (selectedElevenLabsVoice) {
        const voice = elevenLabsVoices.find(v => v.voice_id === selectedElevenLabsVoice);
        if (voice) {
          voiceInfoEl.textContent = `ElevenLabs音声: ${voice.name} (${voice.labels?.gender || 'unknown'})`;
        } else {
          voiceInfoEl.textContent = 'ElevenLabs音声: 選択中...';
        }
      } else {
        voiceInfoEl.textContent = 'ElevenLabs音声: 選択中...';
      }
    }
  }

  function refreshVoiceSelection() {
    buildVoiceList();
  }

  
  // 初期化処理
  function initializeApp() {
    console.log('アプリ初期化中...');
    
    // 初期エンジン設定
    engineSelect.value = currentEngine;
    refreshVoiceSelection();
    
    // エンジン切り替えイベント
    engineSelect.addEventListener('change', async () => {
      currentEngine = engineSelect.value;
      clearTtsCache();
      
      // エンジンが変わる前に連続再生を停止
      if (isContinuousPlaying) {
        stopContinuousPlay();
      }
      
      // 音声リストを更新
      await buildVoiceList();
    });
    
    // Web Speech APIの音声リスト更新イベント
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', () => {
        if (currentEngine === 'webspeech') {
          buildWebSpeechVoiceList();
        }
      });
    }
  }
  
  // DOM読み込み完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  voiceSelect.addEventListener('change', () => {
    if (currentEngine === 'webspeech') {
      selectedWebSpeechVoice = voiceSelect.value;
    } else if (currentEngine === 'elevenlabs') {
      selectedElevenLabsVoice = voiceSelect.value;
      // 音声が変わったらキャッシュをクリア
      clearTtsCache();
    }
    updateVoiceInfo();
  });

  function splitIntoLines(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  function clearLines() {
    linesContainer.innerHTML = '';
  }

  function createLineItem(index, lineText) {
    const item = document.createElement('div');
    item.className = 'line-item';

    const idx = document.createElement('div');
    idx.className = 'line-index';
    idx.textContent = String(index + 1);

    const text = document.createElement('div');
    text.className = 'line-text';
    text.textContent = lineText;

    const actions = document.createElement('div');
    actions.className = 'line-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn';
    playBtn.textContent = '▶ 再生';

    const statusPill = document.createElement('span');
    statusPill.className = 'pill';
    statusPill.textContent = 'idle';

    actions.appendChild(playBtn);
    actions.appendChild(statusPill);

    item.appendChild(idx);
    item.appendChild(text);
    item.appendChild(actions);

    let currentUtterance = null;

    function setPlaying(playing) {
      if (playing) {
        item.classList.add('playing');
        statusPill.textContent = 'playing';
      } else {
        item.classList.remove('playing');
        statusPill.textContent = 'idle';
      }
    }

    playBtn.addEventListener('click', async () => {
      if (!lineText) return;
      
      // Reset all playing indicators
      document.querySelectorAll('.line-item.playing').forEach(el => el.classList.remove('playing'));

      setPlaying(true);

      try {
        if (currentEngine === 'webspeech') {
          // Web Speech APIで再生
          if (!selectedWebSpeechVoice) {
            throw new Error('音声を選択してください');
          }
          await speakWithWebSpeech(lineText);
          setPlaying(false);
        } else if (currentEngine === 'elevenlabs') {
          // ElevenLabsで再生
          const audioUrl = await getAudioUrlForText(lineText);
          if (!audioUrl) {
            throw new Error('ElevenLabs APIで音声を生成できませんでした');
          }
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            setPlaying(false);
          };
          
          audio.onerror = () => {
            setPlaying(false);
            throw new Error('音声の再生に失敗しました');
          };

          await audio.play();
        }
      } catch (error) {
        setPlaying(false);
        console.error('音声再生エラー:', error);
        alert(`音声再生エラー: ${error.message}`);
      }
    });


    return item;
  }

  function renderLines() {
    const lines = splitIntoLines(inputEl.value);
    clearLines();
    if (lines.length === 0) return;
    const frag = document.createDocumentFragment();
    lines.forEach((line, i) => {
      frag.appendChild(createLineItem(i, line));
    });
    linesContainer.appendChild(frag);
  }

  splitButton.addEventListener('click', renderLines);

  // 連続再生機能
  continuousPlayButton.addEventListener('click', async () => {
    const lineItems = document.querySelectorAll('.line-item');
    if (lineItems.length === 0) {
      alert('まず「行に分割して表示」をクリックしてください');
      return;
    }

    if (currentEngine === 'webspeech' && !selectedWebSpeechVoice) {
      alert('音声を選択してください');
      return;
    } else if (currentEngine === 'elevenlabs' && !selectedElevenLabsVoice) {
      alert('音声を選択してください');
      return;
    }

    if (isContinuousPlaying) {
      // 連続再生を停止
      stopContinuousPlay();
    } else {
      // 連続再生を開始
      await startContinuousPlay(lineItems);
    }
  });

  // 連続再生開始
  async function startContinuousPlay(lineItems) {
    isContinuousPlaying = true;
    currentPlayingIndex = 0;
    continuousPlayButton.textContent = '停止する';

    // 全ての再生状態をリセット
    document.querySelectorAll('.line-item.playing').forEach(el => el.classList.remove('playing'));

    try {
      for (let i = 0; i < lineItems.length && isContinuousPlaying; i++) {
        currentPlayingIndex = i;
        const lineItem = lineItems[i];
        const lineText = lineItem.querySelector('.line-text').textContent.trim();
        
        if (!lineText) continue;

        // 現在の行を再生状態に
        lineItem.classList.add('playing');

        // 音声再生（キャッシュ利用）
        await playSingleLine(lineText);

        // 再生完了後、少し待機
        if (isContinuousPlaying && i < lineItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 再生状態を解除
        lineItem.classList.remove('playing');
      }
    } catch (error) {
      console.error('連続再生エラー:', error);
      alert(`読み上げエラー: ${error.message}`);
    } finally {
      stopContinuousPlay();
    }
  }

  // 連続再生停止
  function stopContinuousPlay() {
    isContinuousPlaying = false;
    currentPlayingIndex = -1;
    continuousPlayButton.textContent = '連続再生する';
    
    // 全ての再生状態をリセット
    document.querySelectorAll('.line-item.playing').forEach(el => el.classList.remove('playing'));
  }

  // 単一行の再生（キャッシュ利用）
  async function playSingleLine(text) {
    if (currentEngine === 'webspeech') {
      if (!selectedWebSpeechVoice) {
        throw new Error('Web Speech音声が選択されていません');
      }
      await speakWithWebSpeech(text);
    } else if (currentEngine === 'elevenlabs') {
      if (!selectedElevenLabsVoice) {
        throw new Error('ElevenLabs音声が選択されていません');
      }

      try {
        const audioUrl = await getAudioUrlForText(text);
        if (!audioUrl) {
          throw new Error('ElevenLabs APIで音声を生成できませんでした');
        }
        const audio = new Audio(audioUrl);
        
        return new Promise((resolve, reject) => {
          audio.onended = () => {
            resolve();
          };
          
          audio.onerror = () => {
            reject(new Error('音声の再生に失敗しました'));
          };

          audio.play().catch(reject);
        });
      } catch (error) {
        throw error;
      }
    }
  }

})();


