// ================================================================
// Firebase Configuration
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBE_Gxd1haPazVK61F9sjCwK0X4Gw5rERM",
    authDomain: "wordapp-91c0a.firebaseapp.com",
    databaseURL: "https://wordapp-91c0a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wordapp-91c0a",
    storageBucket: "wordapp-91c0a.firebasestorage.app",
    messagingSenderId: "213863780677",
    appId: "1:213863780677:web:78d6b8755866a0c5ddee2c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// ================================================================
// App Main Controller
// ================================================================
const app = {
    config: {
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzmcgauS6eUd2QAncKzX_kQ1K1b7x7xn2k6s1JWwf-FxmrbIt-_9-eAvNrFkr5eDdwr0w/exec",
        sheetLinks: {
            '1y': 'https://docs.google.com/spreadsheets/d/1r7fWUV1ea9CU-s2iSOwLKexEe2_7L8oUKhK0n1DpDUM/edit?usp=sharing',
            '2y': 'https://docs.google.com/spreadsheets/d/1Xydj0im3Cqq9JhjN8IezZ-7DBp1-DV703cCIb3ORdc8/edit?usp=sharing',
            '3y': 'https://docs.google.com/spreadsheets/d/1Z_n9IshFSC5cBBW6IkZNfQsLb2BBrp9QeOlsGsCkn2Y/edit?usp=sharing'
        },
        backgroundImages: []
    },
    state: {
        user: null, // 로그인한 사용자 정보
        currentProgress: {}, // 현재 학년의 학습 진행 상황
        selectedSheet: '',
        translateDebounceTimeout: null,
        longPressTimer: null,
    },
    elements: {
        loginScreen: document.getElementById('login-screen'),
        loginBtn: document.getElementById('login-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        mainContainer: document.getElementById('main-container'),
        gradeSelectionScreen: document.getElementById('grade-selection-screen'),
        selectionScreen: document.getElementById('selection-screen'),
        selectionTitle: document.getElementById('selection-title'),
        sheetLink: document.getElementById('sheet-link'),
        authorCredit: document.getElementById('author-credit'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        dashboardContainer: document.getElementById('dashboard-container'),
        homeBtn: document.getElementById('home-btn'),
        backToGradeSelectionBtn: document.getElementById('back-to-grade-selection-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        translationTooltip: document.getElementById('translation-tooltip'),
        imeWarning: document.getElementById('ime-warning'),
        noSampleMessage: document.getElementById('no-sample-message'),
        refreshSuccessMessage: document.getElementById('refresh-success-message'),
        confirmationModal: document.getElementById('confirmation-modal'),
        confirmYesBtn: document.getElementById('confirm-yes-btn'),
        confirmNoBtn: document.getElementById('confirm-no-btn'),
        practiceModeControl: document.getElementById('practice-mode-control'),
        practiceModeCheckbox: document.getElementById('practice-mode-checkbox'),
        wordContextMenu: document.getElementById('word-context-menu'),
        searchDaumContextBtn: document.getElementById('search-daum-context-btn'),
        searchNaverContextBtn: document.getElementById('search-naver-context-btn'),
        searchLongmanContextBtn: document.getElementById('search-longman-context-btn'),
    },
    async init() {
        await this.fetchAndSetBackgroundImages();
        
        try {
            await translationDBCache.init();
        } catch (e) {
            console.error("번역 캐시를 초기화할 수 없습니다.", e);
        }

        this.bindGlobalEvents();
        quizMode.init();
        learningMode.init();
        dashboard.init();
        
        auth.onAuthStateChanged(user => {
            if (user) {
                this.state.user = user;

                // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
                // ===== 바로 여기에 아래 코드 한 줄을 추가합니다 =====
                
                const userRef = db.collection('users').doc(user.uid);
                userRef.set({
                    displayName: user.displayName,
                    email: user.email
                }, { merge: true });

                // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
            
                this.elements.loginScreen.classList.add('hidden');
                this.elements.mainContainer.classList.remove('hidden');
                document.body.classList.remove('items-center');

                const hash = window.location.hash.substring(1);
                const [view, grade] = hash.split('-');
                
                let initialState = { view: 'grade' };

                if (grade && ['1y', '2y', '3y'].includes(grade)) {
                    if (['mode', 'quiz', 'learning', 'dashboard', 'mistakeReview'].includes(view)) {
                        initialState = { view: view, grade: grade };
                    }
                } else if (['1y', '2y', '3y'].includes(view)) { 
                    initialState = { view: 'mode', grade: view };
                }
                
                history.replaceState(initialState, '');
                this._renderView(initialState.view, initialState.grade);
            } else {
                this.state.user = null;
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.mainContainer.classList.add('hidden');
                document.body.classList.add('items-center');
                this._renderView(null); 
            }
        });
    },
    bindGlobalEvents() {
        this.elements.loginBtn.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => {
                console.error("Google 로그인 실패:", error);
                alert("로그인에 실패했습니다. 다시 시도해 주세요.");
            });
        });

        this.elements.logoutBtn.addEventListener('click', () => {
            auth.signOut();
        });

        document.querySelectorAll('.grade-select-card img.group').forEach(img => {
            img.addEventListener('click', () => {
                const grade = img.closest('.grade-select-card').dataset.sheet;
                this.navigateTo('mode', grade);
            });
        });

        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz', this.state.selectedSheet));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning', this.state.selectedSheet));
        document.getElementById('select-dashboard-btn').addEventListener('click', () => this.navigateTo('dashboard', this.state.selectedSheet));
        document.getElementById('select-mistakes-btn').addEventListener('click', () => this.navigateTo('mistakeReview', this.state.selectedSheet));

        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('mode', this.state.selectedSheet));
        this.elements.backToGradeSelectionBtn.addEventListener('click', () => this.navigateTo('grade'));
        
        this.elements.refreshBtn.addEventListener('click', () => {
            if (!this.state.selectedSheet) return;
            this.elements.confirmationModal.classList.remove('hidden');
        });
        this.elements.confirmNoBtn.addEventListener('click', () => this.elements.confirmationModal.classList.add('hidden'));
        this.elements.confirmYesBtn.addEventListener('click', () => {
            this.elements.confirmationModal.classList.add('hidden');
            this.forceRefreshData();
        });
        
        this.elements.practiceModeCheckbox.addEventListener('change', (e) => {
            quizMode.state.isPracticeMode = e.target.checked;
            quizMode.start(quizMode.state.currentQuizType);
        });

        document.addEventListener('click', (e) => {
            if (this.elements.wordContextMenu && !this.elements.wordContextMenu.contains(e.target)) {
                ui.hideWordContextMenu();
            }
        });

        document.addEventListener('contextmenu', (e) => {
            const isWhitelisted = e.target.closest('.interactive-word, #word-display');
            if (!isWhitelisted) e.preventDefault();
        });

        window.addEventListener('popstate', (e) => {
            const state = e.state || { view: 'grade' };
            this._renderView(state.view, state.grade);
        });
    },
    navigateTo(view, grade) {
        const currentState = history.state || {};
        if (currentState.view === view && currentState.grade === grade) return;

        let hash = '';
        if (view !== 'grade' && view !== null) {
            hash = grade ? `#${grade}` : '';
            if (view !== 'mode') {
                hash = `#${view}-${grade}`;
            }
        }

        history.pushState({ view, grade }, '', window.location.pathname + window.location.search + hash);
        this._renderView(view, grade);
    },
    async _renderView(view, grade) {
        this.elements.gradeSelectionScreen.classList.add('hidden');
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.dashboardContainer.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');
        
        this.elements.homeBtn.classList.add('hidden');
        this.elements.backToGradeSelectionBtn.classList.add('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.practiceModeControl.classList.add('hidden');
        this.elements.sheetLink.classList.add('hidden');
        this.elements.logoutBtn.classList.add('hidden');

        if (!this.state.user) return; 

        this.elements.logoutBtn.classList.remove('hidden');

        if (grade) {
            const needsProgressLoad = this.state.selectedSheet !== grade;
            this.state.selectedSheet = grade;
            if (needsProgressLoad) await utils.loadUserProgress();

            this.elements.sheetLink.href = this.config.sheetLinks[grade];
            this.elements.sheetLink.classList.remove('hidden');
            const gradeText = grade.replace('y', '학년');
            this.elements.selectionTitle.textContent = `${gradeText} 어휘`;
        } else {
            this.state.selectedSheet = '';
            this.state.currentProgress = {};
        }

        switch (view) {
            case 'quiz':
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.practiceModeControl.classList.remove('hidden');
                quizMode.reset();
                quizMode.preloadNextDefinitionQuiz();
                break;
            case 'learning':
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                learningMode.resetStartScreen();
                break;
            case 'dashboard':
                this.elements.dashboardContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                await dashboard.show();
                break;
            case 'mistakeReview':
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                learningMode.startMistakeReview();
                break;
            case 'mode':
                this.elements.selectionScreen.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.refreshBtn.classList.remove('hidden');
                this.elements.logoutBtn.classList.add('hidden');
                quizMode.reset();
                learningMode.reset();
                break;
            case 'grade':
            default:
                this.elements.gradeSelectionScreen.classList.remove('hidden');
                this.setBackgroundImage();
                quizMode.reset();
                learningMode.reset();
                break;
        }
    },
    async forceRefreshData() {
        const sheet = this.state.selectedSheet;
        if (!sheet) return;

        const elementsToDisable = [
            this.elements.homeBtn, this.elements.refreshBtn, this.elements.backToGradeSelectionBtn,
            document.getElementById('select-learning-btn'), document.getElementById('select-quiz-btn'),
            document.getElementById('select-dashboard-btn'), document.getElementById('select-mistakes-btn'),
        ].filter(el => el);

        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        
        const refreshIconHTML = this.elements.refreshBtn.innerHTML;
        this.elements.refreshBtn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        try {
            // learningMode의 loadWordList를 force 옵션과 함께 호출합니다.
            // 이 함수가 Firebase에서 직접 데이터를 가져와 로컬 캐시를 갱신합니다.
            await learningMode.loadWordList(true);
            this.showRefreshSuccessMessage();
        } catch(err) {
            console.error("Error during data refresh:", err);
            alert("데이터 새로고침에 실패했습니다: " + err.message);
        } finally {
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            this.elements.refreshBtn.innerHTML = refreshIconHTML;
        }
    },
    showRefreshSuccessMessage() {
        const msgEl = this.elements.refreshSuccessMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
    showImeWarning() {
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => {
            this.elements.imeWarning.classList.add('hidden');
        }, 2000);
    },
    showNoSampleMessage() {
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
    preloadImages() {
        this.config.backgroundImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    },
    setBackgroundImage() {
        if (this.config.backgroundImages.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.config.backgroundImages.length);
        const imageUrl = this.config.backgroundImages[randomIndex];
        document.documentElement.style.setProperty('--bg-image', `url('${imageUrl}')`);
    },
    async fetchAndSetBackgroundImages() {
        const cloudName = 'dx07dymqs';
        const tagName = 'bgimage';
        const url = `https://res.cloudinary.com/${cloudName}/image/list/${tagName}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Cloudinary API Error: ${response.statusText}`);
            const data = await response.json();
            
            this.config.backgroundImages = data.resources.map(img => 
                `https://res.cloudinary.com/${cloudName}/image/upload/v${img.version}/${img.public_id}.${img.format}`
            );

        } catch (error) {
            console.error("Cloudinary에서 배경 이미지를 불러오는 데 실패했습니다:", error);
            this.config.backgroundImages = [
                'https://i.imgur.com/EvyV4x7.jpeg',
                'https://i.imgur.com/xsnT8kO.jpeg',
                'https://i.imgur.com/6gZtYDb.jpeg'
            ];
        } finally {
            this.preloadImages();
            this.setBackgroundImage();
        }
    },
};

const translationDBCache = {
    db: null, dbName: 'translationCacheDB_B', storeName: 'translationStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, translation caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => reject(event.target.error);
        });
    },
    get: key => new Promise((resolve, reject) => {
        if (!translationDBCache.db) return resolve(null);
        const request = translationDBCache.db.transaction([translationDBCache.storeName], 'readonly').objectStore(translationDBCache.storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = event => reject(event.target.error);
    }),
    save: (key, data) => {
        if (!translationDBCache.db) return;
        try { translationDBCache.db.transaction([translationDBCache.storeName], 'readwrite').objectStore(translationDBCache.storeName).put(data, key); } 
        catch (e) { console.error("IndexedDB save error:", e); }
    }
};

const api = {
    googleTtsApiKey: 'AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA',
    audioCache: {},

    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('sheet', app.state.selectedSheet);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.message);
        return data;
    },
    async translateText(text) {
        try {
            const cached = await translationDBCache.get(text);
            if (cached) return cached;
            const data = await this.fetchFromGoogleSheet('translateText', { text });
            if (data.success) {
                translationDBCache.save(text, data.translatedText);
                return data.translatedText;
            }
            return '번역 실패';
        } catch (error) {
            console.error('Translation error:', error);
            return '번역 오류';
        }
    },
    async speak(text) {
        if (!text || !text.trim()) return;

        const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
        const isAndroid = /android/i.test(navigator.userAgent);

        if (isAndroid && 'speechSynthesis' in window) {
            try {
                // Cancel any ongoing speech to prevent overlap
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(processedText);
                utterance.lang = 'en-US';
                window.speechSynthesis.speak(utterance);
                return;
            } catch (error) {
                console.warn("Android 내장 TTS 실행 실패, Google TTS로 대체:", error);
            }
        }
        
        if (this.audioCache[processedText]) {
            this.audioCache[processedText].currentTime = 0;
            this.audioCache[processedText].play();
            return;
        }

        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleTtsApiKey}`;
        const requestBody = {
            input: { text: processedText },
            voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
            audioConfig: { audioEncoding: 'MP3' }
        };

        try {
            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Google TTS API Error:', errorData.error.message);
                return;
            }

            const data = await response.json();
            if (data.audioContent) {
                const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;
                const audio = new Audio(audioSrc);
                this.audioCache[processedText] = audio;
                audio.play();
            }
        } catch (error) {
            console.error('Error fetching TTS audio:', error);
        }
    },
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); } 
            catch (err) { console.error('Clipboard copy failed:', err); }
        }
    },
    async fetchDefinition(word) {
        // Merriam-Webster API 키를 이곳으로 옮겨옵니다.
        const MERRIAM_WEBSTER_API_KEY = "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3";
        const url = `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${MERRIAM_WEBSTER_API_KEY}`;
        
        try {
            // 이전에 번역 캐시용으로 만든 IndexedDB를 영영풀이 캐시에도 활용합니다.
            const cached = await translationDBCache.get(`definition_${word}`);
            if (cached) return cached;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const firstResult = data[0];
                if (typeof firstResult === 'object' && firstResult.shortdef && firstResult.shortdef.length > 0) {
                    const definitionText = firstResult.shortdef.join('; ');
                    // 캐시에 저장
                    translationDBCache.save(`definition_${word}`, definitionText);
                    return definitionText;
                }
            }
            return null;
        } catch (e) {
            console.error(`Merriam-Webster API 호출 실패 for "${word}": ${e.message}`);
            return null;
        }
    }
};

const ui = {
    adjustFontSize(element) {
        element.style.fontSize = '';
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const container = element.parentElement;
        const containerStyle = window.getComputedStyle(container);
        const containerWidth = container.clientWidth - parseFloat(containerStyle.paddingLeft) - parseFloat(containerStyle.paddingRight);
        const minFontSize = 16;
        while (element.scrollWidth > containerWidth && currentFontSize > minFontSize) {
            element.style.fontSize = `${--currentFontSize}px`;
        }
    },
    renderInteractiveText(targetElement, text) {
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        const regex = /(\[.*?\]|\bS\+V\b)|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach(line => {
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line))) {
                if (match.index > lastIndex) targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
                const [_, nonClickable, englishPhrase] = match;
                if (englishPhrase) {
                    const span = document.createElement('span');
                    span.textContent = englishPhrase;
                    span.className = 'interactive-word cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors';
                    span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(englishPhrase); api.copyToClipboard(englishPhrase); };
                    span.oncontextmenu = e => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); };
                    let touchMove = false;
                    span.addEventListener('touchstart', e => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700); }, { passive: true });
                    span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                    span.addEventListener('touchend', () => clearTimeout(app.state.longPressTimer));
                    targetElement.appendChild(span);
                } else if (nonClickable) {
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            targetElement.appendChild(document.createElement('br'));
        });
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.translateDebounceTimeout);
        app.state.translateDebounceTimeout = setTimeout(async () => {
            const tooltip = app.elements.translationTooltip;
            const targetRect = event.target.getBoundingClientRect();
            Object.assign(tooltip.style, { left: `${targetRect.left + window.scrollX}px`, top: `${targetRect.bottom + window.scrollY + 5}px` });
            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            tooltip.textContent = await api.translateText(sentence);
        }, 1000);
    },
    handleSentenceMouseOut() {
        clearTimeout(app.state.translateDebounceTimeout);
        app.elements.translationTooltip.classList.add('hidden');
    },
    displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence';
            p.onclick = () => api.speak(p.textContent);
            p.addEventListener('mouseover', e => { if (!e.target.classList.contains('interactive-word')) this.handleSentenceMouseOver(e, p.textContent); else this.handleSentenceMouseOut(); });
            p.addEventListener('mouseout', this.handleSentenceMouseOut);
            const processTextInto = (target, text) => {
                text.split(/([,\s\.'])/g).filter(part => part).forEach(part => {
                    if (/[a-zA-Z]/.test(part)) {
                        const span = document.createElement('span');
                        span.textContent = part;
                        span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word';
                        span.onclick = e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); api.speak(part); api.copyToClipboard(part); };
                        span.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); this.showWordContextMenu(e, part); };
                        let touchMove = false;
                        span.addEventListener('touchstart', e => { e.stopPropagation(); touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, part); }, 700); }, { passive: true });
                        span.addEventListener('touchmove', e => { e.stopPropagation(); touchMove = true; clearTimeout(app.state.longPressTimer); });
                        span.addEventListener('touchend', e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); });
                        target.appendChild(span);
                    } else {
                        target.appendChild(document.createTextNode(part));
                    }
                });
            };
            sentence.split(/(\*.*?\*)/g).forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    processTextInto(strong, part.slice(1, -1));
                    p.appendChild(strong);
                } else if (part) {
                    processTextInto(p, part);
                }
            });
            containerElement.appendChild(p);
        });
    },
    showWordContextMenu(event, word) {
        event.preventDefault();
        const menu = app.elements.wordContextMenu;
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;
        Object.assign(menu.style, { top: `${y}px`, left: `${x}px` });
        menu.classList.remove('hidden');
        const encodedWord = encodeURIComponent(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, 'daum-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, 'naver-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, 'longman-dictionary'); this.hideWordContextMenu(); };
    },
    hideWordContextMenu() {
        if (app.elements.wordContextMenu) app.elements.wordContextMenu.classList.add('hidden');
    }
};

const utils = {
    _getProgressRef() {
        if (!app.state.user || !app.state.selectedSheet) return null;
        return db.collection('users').doc(app.state.user.uid).collection('progress').doc(app.state.selectedSheet);
    },

    async loadUserProgress() {
        const docRef = this._getProgressRef();
        if (!docRef) {
            app.state.currentProgress = {};
            return;
        }
        try {
            const docSnap = await docRef.get();
            app.state.currentProgress = docSnap.exists ? docSnap.data() : {};
        } catch (error) {
            console.error("Error loading user progress:", error);
            app.state.currentProgress = {};
        }
    },

    async _saveCurrentProgress() {
        const docRef = this._getProgressRef();
        if (!docRef) return;
        try {
            await docRef.set(app.state.currentProgress, { merge: true });
        } catch (error) {
            console.error("Error saving user progress:", error);
        }
    },
    
    getWordStatus(word) {
        const progress = app.state.currentProgress[word];
        if (!progress) return 'unseen';

        const statuses = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION']
            .map(type => progress[type] || 'unseen');

        if (statuses.includes('incorrect')) return 'review';
        if (statuses.every(s => s === 'correct')) return 'learned';
        if (statuses.some(s => s === 'correct')) return 'learning';
        return 'unseen';
    },

    updateWordStatus(word, quizType, result) {
        if (!word || !quizType) return;
        
        if (!app.state.currentProgress[word]) {
            app.state.currentProgress[word] = {};
        }
        app.state.currentProgress[word][quizType] = result;
        
        this._saveCurrentProgress(); 
    },

    getCorrectlyAnsweredWords(quizType) {
        if (!quizType) return [];
        const allProgress = app.state.currentProgress;
        return Object.keys(allProgress)
            .filter(word => allProgress[word] && allProgress[word][quizType] === 'correct');
    },
    
    getIncorrectWords() {
        const allWords = learningMode.state.wordList;
        return allWords
            .filter(wordObj => this.getWordStatus(wordObj.word) === 'review')
            .map(wordObj => wordObj.word);
    }
};

const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
    },
    init() {},
    async show() {
        if (!learningMode.state.isWordListReady) {
            this.elements.content.innerHTML = `<div class="text-center p-10"><div class="loader mx-auto"></div><p class="mt-4 text-gray-600">단어 목록을 동기화하는 중...</p></div>`;
            await learningMode.loadWordList();
        }
        this.render();
    },
    render() {
        const allWords = learningMode.state.wordList;
        const totalWords = allWords.length;
        if (totalWords === 0) {
            this.elements.content.innerHTML = `<p class="text-center text-gray-600">학습할 단어가 없습니다.</p>`;
            return;
        }

        const counts = { learned: 0, learning: 0, review: 0, unseen: 0 };
        allWords.forEach(wordObj => {
            counts[utils.getWordStatus(wordObj.word)]++;
        });

        const stats = [
            { name: '미학습', description: '아직 어떤 퀴즈도 풀지 않음', count: counts.unseen, color: 'bg-gray-400' },
            { name: '학습 중', description: '최소 1종류의 퀴즈를 풀어서 맞힘, 아직 틀리지 않음', count: counts.learning, color: 'bg-blue-500' },
            { name: '복습 필요', description: '최소 1종류의 퀴즈에서 틀림', count: counts.review, color: 'bg-orange-500' },
            { name: '학습 완료', description: '모든 종류의 퀴즈에서 정답을 맞힘', count: counts.learned, color: 'bg-green-500' }
        ];

        let contentHTML = `
            <div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center">
                <p class="text-lg text-gray-600">총 단어 수</p>
                <p class="text-4xl font-bold text-gray-800">${totalWords}</p>
            </div>
            <div>
                <h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2>
                <div class="space-y-4">`;

        stats.forEach(stat => {
            const percentage = totalWords > 0 ? ((stat.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `
                <div class="w-full">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-base font-semibold text-gray-700" title="${stat.description}">${stat.name}</span>
                        <span class="text-sm font-medium text-gray-500">${stat.count}개 (${percentage}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4">
                        <div class="${stat.color} h-4 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>`;
        });

        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
    }
};

const quizMode = {
    state: {
        currentQuiz: {},
        quizBatch: [],
        isFetching: false,
        isFinished: false,
        isPracticeMode: false,
        practiceLearnedWords: [],
        currentQuizType: null,
        preloadedDefinitionQuiz: null,
        preloadingDefinitionWord: null,
    },
    elements: {},
    init() {
        this.elements = {
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            questionDisplay: document.getElementById('quiz-question-display'),
            choices: document.getElementById('quiz-choices'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message')
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));
        
        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;

            const choiceCount = Array.from(this.elements.choices.children).filter(el => !el.textContent.includes('PASS')).length;
            
            if (e.key.toLowerCase() === 'p' || e.key === '0') {
                 e.preventDefault();
                 const passButton = Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'));
                 if(passButton) passButton.click();
            } else {
                const choiceIndex = parseInt(e.key);
                if (choiceIndex >= 1 && choiceIndex <= choiceCount) {
                    e.preventDefault();
                    this.elements.choices.children[choiceIndex - 1].click();
                }
            }
        });
    },
    async start(quizType) {
        this.state.currentQuizType = quizType;
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.reset(false);
        if (!learningMode.state.isWordListReady) {
            await learningMode.loadWordList();
        }
        await this.fetchQuizBatch();
        this.displayNextQuiz();
    },
    reset(showSelection = true) {
        this.state.quizBatch = [];
        this.state.isFetching = false;
        this.state.isFinished = false;
        this.state.practiceLearnedWords = [];
        this.elements.loader.querySelector('.loader').style.display = 'block';
        this.elements.loaderText.textContent = "퀴즈 데이터를 불러오는 중...";
        if (showSelection) {
            this.elements.quizSelectionScreen.classList.remove('hidden');
            this.elements.loader.classList.add('hidden');
        } else {
            this.showLoader(true);
        }
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
    },
    async fetchQuizBatch() {
        if (this.state.isFetching || this.state.isFinished) return;
        this.state.isFetching = true;

        try {
            const BATCH_SIZE = 10;
            const allWordsData = learningMode.state.wordList;
            if (allWordsData.length < 5) {
                this.state.isFinished = true;
                this.showFinishedScreen('퀴즈를 만들 단어가 부족합니다.');
                return;
            }

            const wordsToExclude = this.state.isPracticeMode ? 
                this.state.practiceLearnedWords : 
                utils.getCorrectlyAnsweredWords(this.state.currentQuizType);
            
            let candidateWords = allWordsData.filter(item => !wordsToExclude.includes(item.word));

            // 퀴즈 유형에 따라 후보 단어 추가 필터링
            if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
                candidateWords = candidateWords.filter(word => {
                    if (!word.sample || word.sample.trim() === '') return false;
                    const firstLine = word.sample.split('\n')[0];
                    const placeholderRegex = /\*(.*?)\*/;
                    const wordRegex = new RegExp(`\\b${word.word}\\b`, 'i');
                    return placeholderRegex.test(firstLine) || wordRegex.test(firstLine);
                });
            }

            if (candidateWords.length === 0) {
                this.state.isFinished = true;
                this.showFinishedScreen('풀 수 있는 모든 퀴즈를 완료했습니다!');
                return;
            }

            // 후보 단어를 무작위로 섞음
            candidateWords.sort(() => 0.5 - Math.random());
            
            const newQuizzes = [];
            for (const correctWordData of candidateWords) {
                if (newQuizzes.length >= BATCH_SIZE) break;

                let quiz;
                if (this.state.currentQuizType === 'MULTIPLE_CHOICE_MEANING') {
                    quiz = this.createMeaningQuiz(correctWordData, allWordsData);
                } else if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
                    quiz = this.createBlankQuiz(correctWordData, allWordsData);
                } else if (this.state.currentQuizType === 'MULTIPLE_CHOICE_DEFINITION') {
                    // 영영풀이 퀴즈는 API 호출이 필요하므로 await 사용
                    quiz = await this.createDefinitionQuiz(correctWordData, allWordsData);
                }
                
                if (quiz) {
                    newQuizzes.push(quiz);
                }
            }

            this.state.quizBatch.push(...newQuizzes);

        } catch (error) {
            console.error("퀴즈 묶음 생성 실패:", error);
            this.showError(error.message);
        } finally {
            this.state.isFetching = false;
        }
    },
    createMeaningQuiz(correctWordData, allWordsData) {
        const wrongAnswers = new Set();
        // 1. 같은 품사, 다른 뜻을 가진 단어를 오답 후보로 우선 추가
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.meaning !== correctWordData.meaning);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.meaning));

        // 2. 오답이 3개 미만이면 품사와 관계없이 다른 단어의 뜻을 추가
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.meaning !== correctWordData.meaning) {
                wrongAnswers.add(randomWord.meaning);
            }
        }
        
        const choices = [correctWordData.meaning, ...Array.from(wrongAnswers)];
        choices.sort(() => 0.5 - Math.random());

        return {
            type: 'MULTIPLE_CHOICE_MEANING',
            question: { word: correctWordData.word, word_info: correctWordData },
            choices: choices,
            answer: correctWordData.meaning
        };
    },

    createBlankQuiz(correctWordData, allWordsData) {
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null;
        
        const firstLineSentence = correctWordData.sample.split('\n')[0];
        let sentenceWithBlank = "";

        const placeholderRegex = /\*(.*?)\*/;
        const match = firstLineSentence.match(placeholderRegex);

        if (match) {
            sentenceWithBlank = firstLineSentence.replace(placeholderRegex, "＿＿＿＿").trim();
        } else {
            const wordRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i');
            if (firstLineSentence.match(wordRegex)) {
                sentenceWithBlank = firstLineSentence.replace(wordRegex, "＿＿＿＿").trim();
            } else {
                return null;
            }
        }

        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));

        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) {
                wrongAnswers.add(randomWord.word);
            }
        }

        const choices = [correctWordData.word, ...Array.from(wrongAnswers)];
        choices.sort(() => 0.5 - Math.random());

        return {
            type: 'FILL_IN_THE_BLANK',
            question: { sentence_with_blank: sentenceWithBlank, word_info: correctWordData },
            choices: choices,
            answer: correctWordData.word
        };
    },
    
    async createDefinitionQuiz(correctWordData, allWordsData) {
        const definition = await api.fetchDefinition(correctWordData.word);
        if (!definition) return null; // 영영풀이를 가져오지 못하면 퀴즈 생성 실패

        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));

        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) {
                wrongAnswers.add(randomWord.word);
            }
        }

        const choices = [correctWordData.word, ...Array.from(wrongAnswers)];
        choices.sort(() => 0.5 - Math.random());

        return {
            type: 'MULTIPLE_CHOICE_DEFINITION',
            question: { definition: definition, word_info: correctWordData },
            choices: choices,
            answer: correctWordData.word
        };
    },
    async preloadNextDefinitionQuiz() {
        // 이미 불러온 퀴즈가 있거나, 현재 다른 퀴즈를 불러오는 중이거나, 단어 목록이 준비되지 않았으면 실행하지 않습니다.
        if (this.state.preloadedDefinitionQuiz || this.state.preloadingDefinitionWord || !learningMode.state.isWordListReady) {
            return;
        }

        const allWords = learningMode.state.wordList;
        if (allWords.length < 5) return;

        // 연습 모드 여부에 따라 제외할 단어 목록을 가져옵니다.
        const wordsToExclude = this.state.isPracticeMode ? 
            this.state.practiceLearnedWords : 
            utils.getCorrectlyAnsweredWords('MULTIPLE_CHOICE_DEFINITION');

        // 아직 풀지 않은 영영풀이 퀴즈 후보 단어들을 찾습니다.
        const candidates = allWords.filter(w => !wordsToExclude.includes(w.word));
        
        if(candidates.length === 0) return;

        // 후보 중 무작위로 하나를 선택합니다.
        const wordData = candidates[Math.floor(Math.random() * candidates.length)];

        try {
            this.state.preloadingDefinitionWord = wordData.word;
            const quiz = await this.createDefinitionQuiz(wordData, allWords);
            
            if (quiz) {
                this.state.preloadedDefinitionQuiz = quiz;
            }
        } catch (error) {
            console.error("영영풀이 퀴즈 미리 불러오기 실패:", error);
        } finally {
            this.state.preloadingDefinitionWord = null;
        }
    },
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">퀴즈를 가져올 수 없습니다.</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    displayNextQuiz() {
        // [수정] 영영퀴즈이고 미리 불러온 퀴즈가 있으면 즉시 사용합니다.
        if (this.state.currentQuizType === 'MULTIPLE_CHOICE_DEFINITION' && this.state.preloadedDefinitionQuiz) {
            this.state.currentQuiz = this.state.preloadedDefinitionQuiz;
            this.state.preloadedDefinitionQuiz = null; // 사용했으니 비웁니다.
            this.showLoader(false);
            this.renderQuiz(this.state.currentQuiz);
            this.preloadNextDefinitionQuiz(); // 다음 퀴즈를 미리 불러옵니다.
            return;
        }

        if (!this.state.isFetching && this.state.quizBatch.length <= 3) this.fetchQuizBatch();
        
        if (this.state.quizBatch.length === 0) {
            if (this.state.isFetching) {
                this.elements.loaderText.textContent = "다음 퀴즈를 준비 중입니다...";
                this.showLoader(true);
                const checker = setInterval(() => {
                    if (this.state.quizBatch.length > 0) { clearInterval(checker); this.displayNextQuiz(); }
                }, 100);
            } else if (this.state.isFinished) {
                this.showFinishedScreen("모든 단어 학습을 완료했습니다!");
            } else if (!this.state.isFetching) {
                this.showFinishedScreen("풀 수 있는 퀴즈가 더 이상 없습니다!");
            }
            return;
        }
        this.state.currentQuiz = this.state.quizBatch.shift();
        this.showLoader(false);
        this.renderQuiz(this.state.currentQuiz);

        // [추가] 일반 퀴즈를 푼 후에도 다음 영영풀이 퀴즈를 미리 준비합니다.
        if(this.state.currentQuizType === 'MULTIPLE_CHOICE_DEFINITION') {
            this.preloadNextDefinitionQuiz();
        }
    },
    renderQuiz(quizData) {
        const { type, question, choices } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';

        if (type === 'MULTIPLE_CHOICE_DEFINITION') {
            questionDisplay.classList.remove('justify-center', 'items-center');
            ui.displaySentences([question.definition], questionDisplay);
            const sentenceElement = questionDisplay.querySelector('.sample-sentence');
            if(sentenceElement){
                sentenceElement.classList.add('text-lg', 'sm:text-xl', 'text-left', 'text-gray-800', 'leading-relaxed');
                sentenceElement.classList.remove('p-2', 'hover:bg-gray-200');
            }
        } else if (type === 'FILL_IN_THE_BLANK') {
            questionDisplay.classList.remove('justify-center', 'items-center');
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';

            const processTextInto = (targetElement, text) => {
                const parts = text.split(/([,\s\.'])/g).filter(part => part);
                parts.forEach(part => {
                    if (/[a-zA-Z]/.test(part)) {
                        const span = document.createElement('span');
                        span.textContent = part;
                        span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word';
                        span.onclick = e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); api.speak(part); api.copyToClipboard(part); };
                        span.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); ui.showWordContextMenu(e, part); };
                        let touchMove = false;
                        span.addEventListener('touchstart', e => { e.stopPropagation(); touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) ui.showWordContextMenu(e, part); }, 700); }, { passive: true });
                        span.addEventListener('touchmove', e => { e.stopPropagation(); touchMove = true; clearTimeout(app.state.longPressTimer); });
                        span.addEventListener('touchend', e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); });
                        targetElement.appendChild(span);
                    } else {
                        targetElement.appendChild(document.createTextNode(part));
                    }
                });
            };

            const sentenceParts = question.sentence_with_blank.split(/(\*.*?\*|＿＿＿＿)/g);
            sentenceParts.forEach(part => {
                if (part === '＿＿＿＿') {
                    const blankSpan = document.createElement('span');
                    blankSpan.style.whiteSpace = 'nowrap';
                    blankSpan.textContent = '＿＿＿＿';
                    p.appendChild(blankSpan);
                } else if (part && part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    processTextInto(strong, part.slice(1, -1));
                    p.appendChild(strong);
                } else if (part) {
                    processTextInto(p, part);
                }
            });
            questionDisplay.appendChild(p);
        } else {
            questionDisplay.classList.add('justify-center', 'items-center');
            const h1 = document.createElement('h1');
            h1.className = 'text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer';
            h1.title = "클릭하여 발음 듣기";
            h1.textContent = question.word;
            h1.onclick = () => api.speak(question.word);
            questionDisplay.appendChild(h1);
            ui.adjustFontSize(h1);
        }
        
        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`;
            li.onclick = () => this.checkAnswer(li, choice);
            this.elements.choices.appendChild(li);
        });
        
        const passLi = document.createElement('li');
        passLi.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED');
        this.elements.choices.appendChild(passLi);

        this.elements.choices.classList.remove('disabled');
    },
    checkAnswer(selectedLi, selectedChoice) {
        this.elements.choices.classList.add('disabled');
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        const isPass = selectedChoice === 'USER_PASSED';
        const word = this.state.currentQuiz.question.word_info.word;
        const quizType = this.state.currentQuiz.type;

        if (isPass) {
            selectedLi.classList.add('incorrect');
        } else {
            selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        }

        if (this.state.isPracticeMode) {
             if(isCorrect) this.state.practiceLearnedWords.push(word);
        } else {
            utils.updateWordStatus(word, quizType, (isCorrect && !isPass) ? 'correct' : 'incorrect');
        }
        
        // [수정 1] PASS를 포함하여 정답이 아닐 경우, 항상 정답 선택지를 초록색으로 표시합니다.
        if (!isCorrect) { 
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => {
                const choiceSpan = li.querySelector('span:last-child');
                return choiceSpan && choiceSpan.textContent === this.state.currentQuiz.answer;
            });
            correctAnswerEl?.classList.add('correct');
        }
        
        // [수정 2] 딜레이 시간을 1200ms에서 300ms로 절반 단축합니다.
        setTimeout(() => this.displayNextQuiz(), 300); 
    },
    showLoader(isLoading) {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
        this.elements.finishedScreen.classList.add('hidden');
    },
    showFinishedScreen(message) {
        this.showLoader(false);
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.remove('hidden');
        this.elements.finishedMessage.textContent = message;
    },
};

function levenshteinDistance(a = '', b = '') {
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
        }
    }
    return track[b.length][a.length];
}

const learningMode = {
    state: {
        wordList: [], isWordListReady: false, currentIndex: 0,
        touchstartX: 0, touchstartY: 0, currentDisplayList: [],
    },
    elements: {},
    init() {
        this.elements = {
            startScreen: document.getElementById('learning-start-screen'),
            startInputContainer: document.getElementById('learning-start-input-container'),
            startWordInput: document.getElementById('learning-start-word-input'),
            startBtn: document.getElementById('learning-start-btn'),
            suggestionsContainer: document.getElementById('learning-suggestions-container'),
            suggestionsTitle: document.getElementById('learning-suggestions-title'),
            suggestionsVocabList: document.getElementById('learning-suggestions-vocab-list'),
            suggestionsExplanationList: document.getElementById('learning-suggestions-explanation-list'),
            backToStartBtn: document.getElementById('learning-back-to-start-btn'),
            loader: document.getElementById('learning-loader'),
            loaderText: document.getElementById('learning-loader-text'),
            appContainer: document.getElementById('learning-app-container'),
            cardBack: document.getElementById('learning-card-back'),
            wordDisplay: document.getElementById('word-display'),
            meaningDisplay: document.getElementById('meaning-display'),
            explanationDisplay: document.getElementById('explanation-display'),
            explanationContainer: document.getElementById('explanation-container'),
            fixedButtons: document.getElementById('learning-fixed-buttons'),
            nextBtn: document.getElementById('next-btn'),
            prevBtn: document.getElementById('prev-btn'),
            sampleBtn: document.getElementById('sample-btn'),
            sampleBtnImg: document.getElementById('sample-btn-img'),
            backTitle: document.getElementById('learning-back-title'),
            backContent: document.getElementById('learning-back-content')
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.startWordInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.start(); });
        this.elements.startWordInput.addEventListener('input', e => {
            const originalValue = e.target.value;
            const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, '');
            if (originalValue !== sanitizedValue) app.showImeWarning();
            e.target.value = sanitizedValue;
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen());
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip());
        this.elements.wordDisplay.addEventListener('click', () => {
            const word = this.state.currentDisplayList[this.state.currentIndex]?.word;
            if (word) { api.speak(word); api.copyToClipboard(word); }
        });
        this.elements.wordDisplay.oncontextmenu = e => {
            e.preventDefault();
            const wordData = this.state.currentDisplayList[this.state.currentIndex];
            if(wordData) ui.showWordContextMenu(e, wordData.word);
        };
        let wordDisplayTouchMove = false;
        this.elements.wordDisplay.addEventListener('touchstart', e => { wordDisplayTouchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { const wordData = this.state.currentDisplayList[this.state.currentIndex]; if (!wordDisplayTouchMove && wordData) ui.showWordContextMenu(e, wordData.word); }, 700); }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => { wordDisplayTouchMove = true; clearTimeout(app.state.longPressTimer); });
        this.elements.wordDisplay.addEventListener('touchend', () => clearTimeout(app.state.longPressTimer));
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async forceRefreshData() {
        const sheet = this.state.selectedSheet;
        if (!sheet) return;

        const elementsToDisable = [
            this.elements.homeBtn, this.elements.refreshBtn, this.elements.backToGradeSelectionBtn,
            document.getElementById('select-learning-btn'), document.getElementById('select-quiz-btn'),
            document.getElementById('select-dashboard-btn'), document.getElementById('select-mistakes-btn'),
        ].filter(el => el);

        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        
        const refreshIconHTML = this.elements.refreshBtn.innerHTML;
        this.elements.refreshBtn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        try {
            // 위에서 수정한 최종 버전의 loadWordList를 force: true 옵션으로 호출합니다.
            await learningMode.loadWordList(true);
            this.showRefreshSuccessMessage();
        } catch(err) {
            console.error("Error during data refresh:", err);
            alert("데이터 새로고침에 실패했습니다: " + err.message);
        } finally {
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            this.elements.refreshBtn.innerHTML = refreshIconHTML;
        }
    },
    async start() {
        if (!this.state.isWordListReady) {
            await this.loadWordList();
            if (!this.state.isWordListReady) return;
        }
    
        const startWord = this.elements.startWordInput.value.trim().toLowerCase();
    
        if (!startWord) {
            this.elements.startScreen.classList.add('hidden');
            // NOTE: The concept of a device-specific "last index" is less relevant
            // with user accounts. Starting from 0 or a user-saved preference would be better.
            // For now, we'll keep it simple and start from 0 for blank input.
            this.state.currentIndex = 0;
            this.launchApp(this.state.wordList);
            return;
        }
    
        const exactMatchIndex = this.state.wordList.findIndex(item => item.word.toLowerCase() === startWord);
        if (exactMatchIndex !== -1) {
            this.elements.startScreen.classList.add('hidden');
            this.state.currentIndex = exactMatchIndex;
            this.launchApp(this.state.wordList);
            return;
        }
    
        const searchRegex = new RegExp(`\\b${startWord}\\b`, 'i');
        const explanationMatches = this.state.wordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((item, index) => {
                const explanation = this.state.wordList[index].explanation;
                if (!explanation) return false;
                const cleanedExplanation = explanation.replace(/\[.*?\]/g, '');
                return searchRegex.test(cleanedExplanation);
            });
    
        const levenshteinSuggestions = this.state.wordList
            .map((item, index) => ({
                word: item.word,
                index,
                distance: levenshteinDistance(startWord, item.word.toLowerCase())
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .filter(s => s.distance < s.word.length / 2 + 1);
    
        if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) {
            const title = `<strong>${startWord}</strong> 없으니, 아래에서 확인하세요.`;
            this.displaySuggestions(levenshteinSuggestions, explanationMatches, title);
        } else {
            const title = `<strong>${startWord}</strong>에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], [], title);
        }
    },
    async startMistakeReview() {
        if (!this.state.isWordListReady) { await this.loadWordList(); if (!this.state.isWordListReady) return; }
        const incorrectWords = utils.getIncorrectWords();
        if (incorrectWords.length === 0) {
            alert("오답 노트에 단어가 없습니다!");
            app.navigateTo('mode', app.state.selectedSheet);
            return;
        }
        const mistakeWordList = this.state.wordList.filter(wordObj => incorrectWords.includes(wordObj.word));
        this.state.currentIndex = 0;
        this.launchApp(mistakeWordList);
    },
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    launchApp(wordList) {
        this.state.currentDisplayList = wordList;
        app.elements.refreshBtn.classList.add('hidden');
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
        this.elements.fixedButtons.classList.remove('hidden');
        this.displayWord(this.state.currentIndex);
    },
    reset() {
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        this.state.wordList = []; this.state.isWordListReady = false; this.state.currentDisplayList = [];
    },
    resetStartScreen() {
        this.reset();
        this.elements.startScreen.classList.remove('hidden');
        this.elements.startInputContainer.classList.remove('hidden');
        this.elements.suggestionsContainer.classList.add('hidden');
        this.elements.startWordInput.value = '';
        this.elements.startWordInput.focus();
        this.loadWordList();
    },
    displaySuggestions(vocabSuggestions, explanationSuggestions, title) {
        this.elements.startInputContainer.classList.add('hidden');
        this.elements.suggestionsTitle.innerHTML = title;
        
        const populateList = (listElement, suggestions) => {
            listElement.innerHTML = '';
            if (suggestions.length === 0) {
                listElement.innerHTML = '<p class="text-gray-400 text-sm p-3">결과 없음</p>';
                return;
            }
            suggestions.forEach(({ word, index }) => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 py-3 px-4 rounded-lg transition-colors';
                btn.textContent = word;
                btn.onclick = () => { this.state.currentIndex = index; this.launchApp(this.state.wordList); };
                listElement.appendChild(btn);
            });
        };

        populateList(this.elements.suggestionsVocabList, vocabSuggestions);
        populateList(this.elements.suggestionsExplanationList, explanationSuggestions);
        
        this.elements.suggestionsContainer.classList.remove('hidden');
    },
    displayWord(index) {
        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = this.state.currentDisplayList[index];
        if (!wordData) return;
        this.elements.wordDisplay.textContent = wordData.word;
        ui.adjustFontSize(this.elements.wordDisplay);
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        const hasSample = wordData.sample && wordData.sample.trim() !== '';
        this.elements.sampleBtnImg.src = hasSample ? 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png' : 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
    },
    navigate(direction) {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const len = this.state.currentDisplayList.length;
        if (len === 0) return;
        const navigateAction = () => { this.state.currentIndex = (this.state.currentIndex + direction + len) % len; this.displayWord(this.state.currentIndex); };
        if (isBackVisible) { this.handleFlip(); setTimeout(navigateAction, 300); } 
        else { navigateAction(); }
    },
    handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        const hasSample = wordData && wordData.sample && wordData.sample.trim() !== '';
        if (!isBackVisible) {
            if (!hasSample) { app.showNoSampleMessage(); return; }
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent);
            this.elements.cardBack.classList.add('is-slid-up');
            this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png';
        } else {
            this.elements.cardBack.classList.remove('is-slid-up');
            this.displayWord(this.state.currentIndex);
        }
    },
    isLearningModeActive() { return !this.elements.appContainer.classList.contains('hidden'); },
    handleMiddleClick(e) { if (this.isLearningModeActive() && e.button === 1) { e.preventDefault(); this.elements.sampleBtn.click(); } },
    handleKeyDown(e) {
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': -1, 'ArrowDown': 1 };
        if (keyMap[e.key] !== undefined) { e.preventDefault(); this.navigate(keyMap[e.key]); } 
        else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); } 
        else if (e.key === ' ') { e.preventDefault(); if (!this.elements.cardBack.classList.contains('is-slid-up')) api.speak(this.elements.wordDisplay.textContent); }
    },
    handleTouchStart(e) {
        if (!this.isLearningModeActive() || e.target.closest('.interactive-word, #word-display')) return;
        this.state.touchstartX = e.changedTouches[0].screenX; this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) {
        if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick]')) { this.state.touchstartX = this.state.touchstartY = 0; return; }
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX;
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1);
        else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50 && !e.target.closest('#learning-app-container')) { if (deltaY < 0) this.navigate(1); }
        this.state.touchstartX = this.state.touchstartY = 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});






