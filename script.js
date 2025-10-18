(function() {
  /**
   * Line-by-line TTS player using Web Speech API and ElevenLabs API
   */

  const inputEl = document.getElementById('inputText');
  const splitButton = document.getElementById('splitButton');
  const linesContainer = document.getElementById('linesContainer');
  const stopAllButton = document.getElementById('stopAllButton');
  const voiceInfoEl = document.getElementById('voiceInfo');
  const rateInput = document.getElementById('rateInput');
  const rateValue = document.getElementById('rateValue');
  const voiceSelect = document.getElementById('voiceSelect');
  const maleOnlyCheckbox = document.getElementById('maleOnly');
  const langSelect = document.getElementById('langSelect');
  const refreshVoicesBtn = document.getElementById('refreshVoices');
  const pitchInput = document.getElementById('pitchInput');
  const pitchValue = document.getElementById('pitchValue');
  const volumeInput = document.getElementById('volumeInput');
  const volumeValue = document.getElementById('volumeValue');
  const ttsProviderSelect = document.getElementById('ttsProvider');

  // ElevenLabs API設定
  const ELEVENLABS_API_KEY = 'sk_5cf916d2d44a5678a646f71557d2e3d489c6981c328e0957';
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
  
  /** @type {SpeechSynthesisVoice|null} */
  let selectedVoice = null;
  
  /** @type {Array} */
  let elevenLabsVoices = [];
  
  /** @type {string|null} */
  let selectedElevenLabsVoice = null;

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
    const provider = ttsProviderSelect?.value || 'web';
    
    if (provider === 'elevenlabs') {
      await buildElevenLabsVoiceList();
    } else {
      buildWebSpeechVoiceList();
    }
  }

  function buildWebSpeechVoiceList() {
    const voices = window.speechSynthesis.getVoices() || [];
    const wantMale = !!maleOnlyCheckbox?.checked;
    const langPref = langSelect?.value || 'auto';

    // naive male detection by name hints
    const maleHints = /(male|guy|alex|daniel|fred|george|hank|mike)/i;

    let pool = voices;
    if (langPref === 'auto') {
      pool = voices.filter(v => /en[-_]/i.test(v.lang));
    } else if (langPref !== '*') {
      pool = voices.filter(v => v.lang === langPref || v.lang?.startsWith(langPref + '-'));
    }

    const filtered = pool.filter(v => !wantMale || maleHints.test(v.name));
    const list = filtered.length ? filtered : pool;

    // Clear and rebuild
    voiceSelect.innerHTML = '';
    list.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });

    // Try to keep previous selection if possible
    const keepName = selectedVoice?.name;
    if (keepName && list.some(v => v.name === keepName)) {
      voiceSelect.value = keepName;
    } else if (list.length > 0) {
      voiceSelect.value = list[0].name;
      selectedVoice = list[0];
    } else {
      selectedVoice = null;
    }

    updateVoiceInfo();
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

      // Select first voice by default
      if (voices.length > 0) {
        voiceSelect.value = voices[0].voice_id;
        selectedElevenLabsVoice = voices[0].voice_id;
        console.log('デフォルト音声選択:', voices[0]);
      }

      updateVoiceInfo();
    } catch (error) {
      console.error('ElevenLabs音声一覧構築エラー:', error);
      voiceSelect.innerHTML = '<option value="">エラー: 音声を取得できません</option>';
      voiceInfoEl.textContent = `ElevenLabs API エラー: ${error.message}`;
    }
  }

  function updateVoiceInfo() {
    const provider = ttsProviderSelect?.value || 'web';
    
    if (provider === 'elevenlabs') {
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
    } else {
      if (selectedVoice) {
        voiceInfoEl.textContent = `Web Speech音声: ${selectedVoice.name} (${selectedVoice.lang})`;
      } else {
        voiceInfoEl.textContent = 'Web Speech音声が見つかりませんでした。ブラウザ設定で英語音声を有効にしてください。';
      }
    }
  }

  function refreshVoiceSelection() {
    buildVoiceList();
  }

  // Some browsers (esp. Chrome) load voices asynchronously
  window.speechSynthesis.onvoiceschanged = function() { refreshVoiceSelection(); };
  
  // 初期化処理
  function initializeApp() {
    console.log('アプリ初期化中...');
    console.log('選択された音声エンジン:', ttsProviderSelect?.value);
    
    // Try initial selection
    refreshVoiceSelection();
  }
  
  // DOM読み込み完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  voiceSelect.addEventListener('change', () => {
    const provider = ttsProviderSelect?.value || 'web';
    
    if (provider === 'elevenlabs') {
      selectedElevenLabsVoice = voiceSelect.value;
    } else {
      const voices = window.speechSynthesis.getVoices() || [];
      const v = voices.find(v => v.name === voiceSelect.value);
      selectedVoice = v || null;
    }
    updateVoiceInfo();
  });

  ttsProviderSelect.addEventListener('change', () => {
    buildVoiceList();
  });

  maleOnlyCheckbox.addEventListener('change', () => {
    if (ttsProviderSelect?.value === 'web') {
      buildVoiceList();
    }
  });

  langSelect.addEventListener('change', () => {
    if (ttsProviderSelect?.value === 'web') {
      buildVoiceList();
    }
  });

  refreshVoicesBtn.addEventListener('click', () => {
    buildVoiceList();
  });

  // API接続テストボタン
  const testApiBtn = document.getElementById('testApi');
  testApiBtn.addEventListener('click', async () => {
    console.log('=== ElevenLabs API接続テスト開始 ===');
    voiceInfoEl.textContent = 'API接続テスト中...';
    
    try {
      const voices = await fetchElevenLabsVoices();
      if (voices.length > 0) {
        voiceInfoEl.textContent = `API接続成功！${voices.length}個の音声を取得しました。`;
        console.log('=== API接続テスト成功 ===');
      } else {
        voiceInfoEl.textContent = 'API接続は成功しましたが、音声が見つかりませんでした。';
        console.log('=== API接続テスト: 音声なし ===');
      }
    } catch (error) {
      voiceInfoEl.textContent = `API接続テスト失敗: ${error.message}`;
      console.log('=== API接続テスト失敗 ===', error);
    }
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
      
      const provider = ttsProviderSelect?.value || 'web';
      
      // Stop any current global speech
      window.speechSynthesis.cancel();
      // Reset all playing indicators
      document.querySelectorAll('.line-item.playing').forEach(el => el.classList.remove('playing'));

      setPlaying(true);

      try {
        if (provider === 'elevenlabs') {
          await playElevenLabsSpeech(lineText);
        } else {
          playWebSpeech(lineText);
        }
      } catch (error) {
        console.error('音声再生エラー:', error);
        setPlaying(false);
        alert(`音声再生エラー: ${error.message}`);
      }
    });

    async function playElevenLabsSpeech(text) {
      if (!selectedElevenLabsVoice) {
        throw new Error('ElevenLabs音声が選択されていません');
      }

      try {
        const audioUrl = await generateElevenLabsSpeech(text, selectedElevenLabsVoice);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setPlaying(false);
          URL.revokeObjectURL(audioUrl);
          throw new Error('音声の再生に失敗しました');
        };

        await audio.play();
      } catch (error) {
        setPlaying(false);
        throw error;
      }
    }

    function playWebSpeech(text) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = selectedVoice?.lang || 'en-US';
      if (selectedVoice) utter.voice = selectedVoice;
      utter.rate = parseFloat(rateInput.value) || 1;
      utter.pitch = parseFloat(pitchInput.value) || 1;
      utter.volume = parseFloat(volumeInput.value) || 1;

      currentUtterance = utter;

      utter.onend = () => {
        setPlaying(false);
        currentUtterance = null;
      };
      utter.onerror = () => {
        setPlaying(false);
        currentUtterance = null;
      };

      window.speechSynthesis.speak(utter);
    }

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

  stopAllButton.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.line-item.playing').forEach(el => el.classList.remove('playing'));
  });
})();


