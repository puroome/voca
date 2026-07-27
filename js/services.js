// Firebase/API, 번역·음성 캐시 및 효과음
function playSingleBeep({ frequency, duration = 0.1, type = 'sine', gain = 0.3, endFrequency }) {
    if (!app.state.audioContext) {
        console.warn("AudioContext not initialized. Cannot play beep.");
        return;
    }
    const oscillator = app.state.audioContext.createOscillator();
    const gainNode = app.state.audioContext.createGain();
    const now = app.state.audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) {
        oscillator.frequency.linearRampToValueAtTime(endFrequency, now + duration);
    }
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.01);
    oscillator.connect(gainNode);
    gainNode.connect(app.state.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
}
function playSequence(soundDefinition) {
    if (soundDefinition.sequence && Array.isArray(soundDefinition.sequence)) {
        soundDefinition.sequence.forEach(note => {
            if (note.delay) {
                setTimeout(() => { playSingleBeep(note); }, note.delay);
            } else {
                playSingleBeep(note);
            }
        });
    } else {
        playSingleBeep(soundDefinition);
    }
}
const correctBeep = {
    name: '또로롱 (물방울)',
    sequence: [
        { frequency: 523, duration: 0.07, type: 'triangle', gain: 0.25 },
        { delay: 80, frequency: 659, duration: 0.07, type: 'triangle', gain: 0.25 },
        { delay: 160, frequency: 783, duration: 0.07, type: 'triangle', gain: 0.25 }
    ]
};
const incorrectBeep = {
    name: '삐빅 (경고)',
    sequence: [
        { frequency: 400, duration: 0.07, type: 'square', gain: 0.15 },
        { delay: 90, frequency: 400, duration: 0.07, type: 'square', gain: 0.15 }
    ]
};
const audioDBCache = {
    db: null, dbName: 'ttsAudioCacheDB_voca', storeName: 'audioStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, TTS caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) { db.createObjectStore(this.storeName); } };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error:", event.target.error); reject(event.target.error); };
        });
    },
    getAudio: key => new Promise((resolve) => {
        if (!audioDBCache.db) return resolve(null);
         try {
            const request = audioDBCache.db.transaction([audioDBCache.storeName]).objectStore(audioDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => { console.error("IndexedDB getAudio error:", e.target.error); resolve(null); };
        } catch (e) {
            console.error("IndexedDB transaction error (getAudio):", e); resolve(null);
        }
    }),
    saveAudio: (key, audioData) => {
        if (!audioDBCache.db) return;
        try {
            const tx = audioDBCache.db.transaction([audioDBCache.storeName], 'readwrite');
            tx.objectStore(audioDBCache.storeName).put(audioData, key);
            tx.onerror = (e) => console.error("IndexedDB saveAudio transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB save audio error:", e); }
    }
};
const translationDBCache = {
    db: null, dbName: 'translationCacheDB_B', storeName: 'translationStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported for translation cache.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error (translation):", event.target.error); reject(event.target.error); };
        });
    },
    get: key => new Promise((resolve, reject) => {
        if (!translationDBCache.db) return resolve(null);
        try {
            const request = translationDBCache.db.transaction([translationDBCache.storeName], 'readonly').objectStore(translationDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = event => { console.error("IndexedDB get translation error:", event.target.error); reject(event.target.error); };
        } catch (e) {
            console.error("IndexedDB transaction error (get translation):", e); reject(e);
        }
    }),
    save: (key, data) => {
        if (!translationDBCache.db) return;
        try {
            const tx = translationDBCache.db.transaction([translationDBCache.storeName], 'readwrite');
            tx.objectStore(translationDBCache.storeName).put(data, key);
            tx.onerror = (e) => console.error("IndexedDB save translation transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB save translation error:", e); }
    }
};
const api = {
    async translateText(text) {
        if (!text) return "";

        // 1. 캐시 확인 (이미 번역한 문장은 저장소에서 가져옴)
        try {
            if (typeof translationDBCache !== 'undefined') {
                const cached = await translationDBCache.get(text);
                if (cached) return cached;
            }
        } catch (e) { console.warn("Cache check error:", e); }

        // 2. 학생명단 GAS 주소(SCRIPT_URL) 가져오기
        // (config에 있는 ...3ibF4/exec 주소를 자동으로 사용합니다)
        const GAS_URL = app.config.SCRIPT_URL; 
        
        if (!GAS_URL) {
            console.error("설정 오류: SCRIPT_URL이 없습니다.");
            return "설정 오류 발생";
        }

        // 3. 서버에 번역 요청 (action=translateText)
        const requestUrl = `${GAS_URL}?action=translateText&text=${encodeURIComponent(text)}`;

        try {
            const response = await fetch(requestUrl);

            if (!response.ok) {
                throw new Error(`통신 오류: ${response.status}`);
            }

            const data = await response.json();
            
            // 4. 결과 처리
            if (data.success) {
                const translatedText = data.translatedText;
                
                // 캐시에 저장 (다음엔 서버 요청 안 하도록)
                try {
                    if (typeof translationDBCache !== 'undefined' && translatedText) {
                        translationDBCache.save(text, translatedText);
                    }
                } catch (e) {}

                return translatedText;
            } else {
                throw new Error(data.message || "번역 실패");
            }

        } catch (error) {
            console.error("번역 실패:", error);
            return "번역 서버 연결 실패 (잠시 후 다시 시도)"; 
        }
    },
    
    // [보안] 기존에 있던 API Key 관련 변수는 이제 필요 없으므로 비워둡니다.
    geminiApiKey: '',

// [최종 수정] OS 상관없이 무조건 무료! + 오류 방지 적용
      async speak(text) {
    if (!text) return;
    // 1. 활동 감지
    if (typeof activityTracker !== 'undefined') activityTracker.recordActivity();
    // 2. sb -> somebody
    const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
    // 3. TTS 지원 확인
    if (!window.speechSynthesis) { console.warn('TTS 지원 안 됨'); return; }
    // 4. 발화
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;

// ✅ [추가] iOS 포함 전 플랫폼 최적 음성 선택 (고품질 우선)
            const setVoiceAndSpeak = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length === 0) return;
                const enVoices = voices.filter(v => v.lang === 'en-US' || v.lang.startsWith('en-US') || v.lang.startsWith('en'));
                
                // 1. 고품질 음성 찾기
                const quality = ['premium', 'enhanced', 'high quality', '고품질', '향상됨', '프리미엄'];
                let best = enVoices.find(v => 
                    quality.some(q => 
                        v.name.toLowerCase().includes(q) || 
                        (v.voiceURI && v.voiceURI.toLowerCase().includes(q))
                    )
                );
                
                if (!best) {
                    // 2. 선호하는 기본 음성 먼저 확인 (Compact 제외)
                    const preferred = ['Alex', 'Siri', 'Victoria', 'Karen', 'Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft David'];
                    for (const name of preferred) {
                        best = enVoices.find(v => 
                            v.name.toLowerCase().includes(name.toLowerCase()) && 
                            !v.name.toLowerCase().includes('compact') &&
                            (!v.voiceURI || !v.voiceURI.toLowerCase().includes('compact'))
                        );
                        if (best) break;
                    }
                    
                    // 3. [핵심 수정] 위에서 못 찾았다면, 저음질(Compact)이더라도 익숙한 선호 음성(Samantha 등)을 최우선으로 선택
                    if (!best) {
                        for (const name of preferred) {
                            best = enVoices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
                            if (best) break;
                        }
                    }

                    // 4. 그래도 없다면, 특정 튀는 목소리(Rocko, Bubbles 등)를 제외한 평범한 음성 찾기
                    if (!best) {
                        const weirdVoices = ['rocko', 'shelley', 'sandy', 'eddy', 'flo', 'reed', 'grandma', 'grandpa', 'bubbles', 'bells', 'boing', 'trinoids', 'whisper', 'zarvox', 'cellos'];
                        best = enVoices.find(v => !weirdVoices.some(w => v.name.toLowerCase().includes(w)));
                    }

                    // 5. 최후의 보루
                    if (!best) best = enVoices[0];
                }
                
                if (best) utterance.voice = best;
                console.log('[TTS] 선택된 음성:', best?.name ?? '기본값');
                window.speechSynthesis.speak(utterance);
            };

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            setVoiceAndSpeak();
        } else {
            window.speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
            setTimeout(() => {
                if (!utterance.voice) setVoiceAndSpeak();
            }, 500);
        }
    // ✅ [끝]

    // 5. 아이콘 상태 (this = app)
    if (typeof app !== 'undefined' && app.state) app.state.isSpeaking = true;
    if (typeof app.updateSpeakerIcon === 'function') app.updateSpeakerIcon(true);
    utterance.onend = () => {
      if (typeof app !== 'undefined') app.state.isSpeaking = false;
      if (typeof app.updateSpeakerIcon === 'function') app.updateSpeakerIcon(false);
    };
    utterance.onerror = () => {
      if (typeof app !== 'undefined') app.state.isSpeaking = false;
      if (typeof app.updateSpeakerIcon === 'function') app.updateSpeakerIcon(false);
    };
  },
    
    async copyToClipboard(text) {
        if (navigator.clipboard && text) {
            try { await navigator.clipboard.writeText(text); }
            catch (err) { console.warn("Clipboard write failed:", err); }
        }
    },
    async fetchDefinition(word) {
        if (!word) return null;
        const apiKey = app.config.MERRIAM_WEBSTER_API_KEY;
        const url = `https://dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Definition fetch failed for ${word}: Status ${response.status}`);
                return null;
            }
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const firstResult = data[0];
                if (typeof firstResult === 'object' && firstResult !== null && firstResult.shortdef && Array.isArray(firstResult.shortdef) && firstResult.shortdef.length > 0) {
                    return firstResult.shortdef[0].split(';')[0].trim();
                }
            }
            return null;
        } catch (e) {
            console.error(`Error fetching definition for ${word}:`, e);
            return null;
        }
    },
    async checkPermission(email) {
        const rtdbKey = email.toLowerCase().replace(/\./g, '_');
        const rtdbRef = ref(rt_db, `roster/${rtdbKey}`);

        try {
            const snapshot = await get(rtdbRef);
            const data = snapshot.val();

            if (data && data.permissions) {
                return {
                    status: data.permissions,
                    canEdit: data.canEdit === true
                };
            }
            return { status: 'not_found', canEdit: false };
        } catch (error) {
            console.error("RTDB Permission Check Error:", error);
            return { status: 'not_found', canEdit: false };
        }
    },
    async requestPermission(email, name, grade) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', 'requestPermission');
        url.searchParams.append('email', email);
        url.searchParams.append('name', name);
        url.searchParams.append('grade', grade); 
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }
};
