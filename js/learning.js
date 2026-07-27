// 어휘카드 학습과 복습 실행
const learningMode = {
     state: {
        wordList: { '1y': [], '2y': [], '3y': [] },
        isWordListReady: { '1y': false, '2y': false, '3y': false },
        currentIndex: 0,
        isMistakeMode: false,
        isFavoriteMode: false,
        touchstartX: 0, touchstartY: 0,
        currentDisplayList: [],
        isDragging: false,
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
            backContent: document.getElementById('learning-back-content'),
            progressBarTrack: document.getElementById('progress-bar-track'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressBarHandle: document.getElementById('progress-bar-handle'),
            progressBarNumber: document.getElementById('progress-bar-number'),
            favoriteBtn: document.getElementById('favorite-btn'),
            favoriteIcon: document.getElementById('favorite-icon'),
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
            if (word) { api.speak(word); }
        });
        this.elements.wordDisplay.oncontextmenu = e => {
            e.preventDefault();
            const wordData = this.state.currentDisplayList[this.state.currentIndex];
            if(wordData) ui.showWordContextMenu(e, wordData.word);
        };
        this.elements.favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        let wordDisplayTouchMove = false;
        this.elements.wordDisplay.addEventListener('touchstart', e => { wordDisplayTouchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { const wordData = this.state.currentDisplayList[this.state.currentIndex]; if (!wordDisplayTouchMove && wordData) ui.showWordContextMenu(e, wordData.word); }, 700); }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => { wordDisplayTouchMove = true; clearTimeout(app.state.longPressTimer); });
        this.elements.wordDisplay.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.elements.progressBarTrack.addEventListener('mousedown', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mousemove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mouseup', this.handleProgressBarInteraction.bind(this));
        this.elements.progressBarTrack.addEventListener('touchstart', this.handleProgressBarInteraction.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('touchend', this.handleProgressBarInteraction.bind(this));
    },
    async loadWordList(force = false, grade = app.state.selectedSheet) {
        if (!grade) return;
        if (!force && this.state.isWordListReady[grade]) return;
        const cacheKey = `wordListCache_${grade}`;
        const timestampKey = app.state.LOCAL_STORAGE_KEYS.CACHE_TIMESTAMP(grade);
        const versionKey = app.state.LOCAL_STORAGE_KEYS.CACHE_VERSION(grade);
        let forceRefreshDueToVersion = false;
        if (!force) {
            try {
                const versionRef = ref(rt_db, `app_config/vocab_version_${grade}`);
                const snapshot = await get(versionRef);
                const remoteVersion = snapshot.val() || 0;
                const localVersion = parseInt(localStorage.getItem(versionKey) || '0');
                if (remoteVersion > localVersion) {
                    forceRefreshDueToVersion = true;
                }
            } catch (e) {
                console.error("버전 확인 중 오류 발생:", e);
                forceRefreshDueToVersion = true;
            }
        }
        const shouldForceRefresh = force || forceRefreshDueToVersion;
        if (shouldForceRefresh) {
            try {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(timestampKey);
                localStorage.removeItem(versionKey);
            } catch(e) {}
            this.state.isWordListReady[grade] = false;
        }
        try {
            const cachedData = localStorage.getItem(cacheKey);
            const savedTimestamp = localStorage.getItem(timestampKey);
            if (!shouldForceRefresh && cachedData && savedTimestamp) {
                const { words } = JSON.parse(cachedData);
                this.state.wordList[grade] = words.sort((a, b) => a.id - b.id);
                this.state.isWordListReady[grade] = true;
                app.state.lastCacheTimestamp[grade] = parseInt(savedTimestamp);
                app.updateLastUpdatedText();
                return;
            }
        } catch (e) {
            console.warn("Error reading or parsing word list cache:", e);
            try {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(timestampKey);
                localStorage.removeItem(versionKey);
            } catch(e2) {}
        }
        try {
            const dbRef = ref(rt_db, `${grade}/vocabulary`);
            const snapshot = await get(dbRef);
            const data = snapshot.val();
            if (!data) throw new Error(`Firebase에 '${grade}' 단어 데이터가 없습니다.`);
            const wordsArray = Object.values(data).sort((a, b) => a.id - b.id);
            this.state.wordList[grade] = wordsArray;
            this.state.isWordListReady[grade] = true;
            const timestampRef = ref(rt_db, `app_config/vocab_timestamp_${grade}`);
            const timestampSnapshot = await get(timestampRef);
            const newTimestamp = timestampSnapshot.val() || Date.now();
            const versionRef = ref(rt_db, `app_config/vocab_version_${grade}`);
            const versionSnapshot = await get(versionRef);
            const currentRemoteVersion = versionSnapshot.val() || 1;
            const cachePayload = { words: wordsArray };
             try {
                localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
                localStorage.setItem(timestampKey, newTimestamp.toString());
                app.state.lastCacheTimestamp[grade] = newTimestamp;
                localStorage.setItem(versionKey, currentRemoteVersion.toString());
                app.updateLastUpdatedText();
             } catch(e) { console.error("Error saving word list cache:", e); }
        } catch (error) {
            this.showError(error.message);
            throw error;
        }
    },
    async start() {
        activityTracker.recordActivity();
        const grade = app.state.selectedSheet;
        if (!this.state.isWordListReady[grade]) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            this.elements.loader.classList.remove('hidden');
            this.elements.startScreen.classList.add('hidden');
            await this.loadWordList(false, grade);
            this.elements.loader.classList.add('hidden');
            this.elements.startScreen.classList.remove('hidden');
            if (!this.state.isWordListReady[grade]) return;
        }
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = false;
        const currentWordList = this.state.wordList[grade];
        const startWord = this.elements.startWordInput.value.trim().toLowerCase();
        if (!startWord) {
            this.elements.startScreen.classList.add('hidden');
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(grade);
                const savedIndex = parseInt(localStorage.getItem(key) || '0');
                this.state.currentIndex = (savedIndex >= 0 && savedIndex < currentWordList.length) ? savedIndex : 0;
            } catch(e) {
                this.state.currentIndex = 0;
            }
            this.launchApp(currentWordList);
            return;
        }
        const exactMatchIndex = currentWordList.findIndex(item => item.word.toLowerCase() === startWord);
        if (exactMatchIndex !== -1) {
            this.elements.startScreen.classList.add('hidden');
            this.state.currentIndex = exactMatchIndex;
            this.launchApp(currentWordList);
            return;
        }
        const searchRegex = new RegExp(`\\b${startWord}\\b`, 'i');
        const explanationMatches = currentWordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((item, index) => {
                const explanation = currentWordList[index].explanation;
                if (!explanation) return false;
                const cleanedExplanation = explanation.replace(/\[.*?\]/g, '');
                return searchRegex.test(cleanedExplanation);
            });
        const levenshteinSuggestions = currentWordList
            .map((item, index) => ({
                word: item.word, index,
                distance: levenshteinDistance(startWord, item.word.toLowerCase())
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .filter(s => s.distance < s.word.length / 2 + 1);
        if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) {
            const title = `<strong>'${startWord}'</strong>(을)를 찾을 수 없습니다. 혹시 이 단어인가요?`;
            this.displaySuggestions(levenshteinSuggestions, explanationMatches, currentWordList, title);
        } else {
            const title = `<strong>'${startWord}'</strong>에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], [], currentWordList, title);
        }
    },
    async startMistakeReview(mistakeWordsFromQuiz) {
        this.state.isMistakeMode = true;
        this.state.isFavoriteMode = false;
        const grade = app.state.selectedSheet;
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }
        const incorrectWords = mistakeWordsFromQuiz || utils.getIncorrectWords();
        if (incorrectWords.length === 0) {
            app.showToast("오답 노트에 단어가 없습니다!", false);
            app.navigateTo('mode', grade);
            return;
        }
        const mistakeWordList = this.state.wordList[grade].filter(wordObj => incorrectWords.includes(wordObj.word));
        this.state.currentIndex = 0;
        this.launchApp(mistakeWordList);
    },
    async startFavoriteReview() {
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = true;
        const grade = app.state.selectedSheet;
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }
        const favoriteWords = utils.getFavoriteWords();
        if (favoriteWords.length === 0) {
            app.showToast("즐겨찾기에 등록된 단어가 없습니다!", false);
            app.navigateTo('mode', grade);
            return;
        }
        const favoriteWordList = favoriteWords.map(word => this.state.wordList[grade].find(wordObj => wordObj.word === word)).filter(Boolean);
        this.state.currentIndex = 0;
        this.launchApp(favoriteWordList);
    },
    displaySuggestions(vocabSuggestions, explanationSuggestions, sourceList, title) {
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
                btn.onclick = () => { this.state.currentIndex = index; this.launchApp(sourceList); };
                listElement.appendChild(btn);
            });
        };
        populateList(this.elements.suggestionsVocabList, vocabSuggestions);
        populateList(this.elements.suggestionsExplanationList, explanationSuggestions);
        this.elements.suggestionsContainer.classList.remove('hidden');
    },
    reset() {
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        app.elements.progressBarContainer.classList.add('hidden');
        this.state.currentDisplayList = [];
    },
    resetStartScreen() {
        this.reset();
        this.elements.startScreen.classList.remove('hidden');
        this.elements.startInputContainer.classList.remove('hidden');
        this.elements.suggestionsContainer.classList.add('hidden');
        this.elements.startWordInput.value = '';
        this.elements.startWordInput.focus();
        if (app.state.selectedSheet) {
            this.loadWordList(false, app.state.selectedSheet);
        }
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
        app.elements.progressBarContainer.classList.remove('hidden');
        this.displayWord(this.state.currentIndex);
    },
    async displayWord(index) {
        activityTracker.recordActivity();
        this.updateProgressBar(index);
        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = this.state.currentDisplayList[index];
        if (!wordData) return;
        if (!this.state.isMistakeMode && !this.state.isFavoriteMode) {
             try {
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(app.state.selectedSheet);
                localStorage.setItem(key, index);
            } catch (e) {
                console.error("Error saving last index to localStorage", e);
            }
        }
        this.elements.wordDisplay.textContent = wordData.word;
        ui.adjustFontSize(this.elements.wordDisplay);
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        const hasSample = wordData.sample && wordData.sample.trim() !== '';
        const defaultImg = 'images/cat-add.png';
        const sampleImg = 'images/cat-delivery.png';
        const backImgUrl = 'images/cat-remove.png';
        this.elements.sampleBtnImg.src = this.elements.cardBack.classList.contains('is-slid-up') ? backImgUrl : (hasSample ? sampleImg : defaultImg);
        
        const grade = app.state.selectedSheet;
        const isFavorite = utils.getCombinedProgress(wordData.word, grade).favorite || false;
        this.updateFavoriteIcon(isFavorite);
    },
    updateFavoriteIcon(isFavorite) {
        const icon = this.elements.favoriteIcon;
        icon.classList.toggle('fill-current', isFavorite);
        icon.classList.toggle('text-yellow-400', isFavorite);
        icon.classList.toggle('text-gray-400', !isFavorite);
    },
    async toggleFavorite() {
        activityTracker.recordActivity();
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        if (!wordData) return;
        const isFavorite = await utils.toggleFavorite(wordData.word);
        this.updateFavoriteIcon(isFavorite);
        if (this.state.isFavoriteMode && !isFavorite) {
             this.state.currentDisplayList.splice(this.state.currentIndex, 1);
             if (this.state.currentDisplayList.length === 0) {
                 app.showToast("즐겨찾기 목록이 비었습니다.", false);
                 app.navigateTo('mode', app.state.selectedSheet);
                 return;
             }
             if(this.state.currentIndex >= this.state.currentDisplayList.length) {
                 this.state.currentIndex = this.state.currentDisplayList.length - 1;
             }
             this.displayWord(this.state.currentIndex);
        }
    },
    navigate(direction) {
        activityTracker.recordActivity();
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const len = this.state.currentDisplayList.length;
        if (len === 0) return;
        const navigateAction = () => { this.state.currentIndex = (this.state.currentIndex + direction + len) % len; this.displayWord(this.state.currentIndex); };
        if (isBackVisible) { this.handleFlip(); setTimeout(navigateAction, 300); }
        else { navigateAction(); }
    },
    async handleFlip() {
        activityTracker.recordActivity();
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        const hasSample = wordData && wordData.sample && wordData.sample.trim() !== '';
        const backImgUrl = 'images/cat-remove.png';
        const sampleImgUrl = 'images/cat-delivery.png';
        const noSampleImgUrl = 'images/cat-add.png';
        if (!isBackVisible) {
            if (!hasSample) { app.showNoSampleMessage(); return; }
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent);
            this.elements.cardBack.classList.add('is-slid-up');
            this.elements.sampleBtnImg.src = backImgUrl;
        } else {
            this.elements.cardBack.classList.remove('is-slid-up');
            this.displayWord(this.state.currentIndex);
        }
    },
    isLearningModeActive() { return !this.elements.appContainer.classList.contains('hidden'); },
    handleMiddleClick(e) { if (this.isLearningModeActive() && e.button === 1) { e.preventDefault(); this.elements.sampleBtn.click(); } },
    handleKeyDown(e) {
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        activityTracker.recordActivity();
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': 1, 'ArrowDown': -1 };
        if (keyMap[e.key] !== undefined) { e.preventDefault(); this.navigate(keyMap[e.key]); }
        else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); }
        else if (e.key === 'F5' || e.key === 'Escape') { e.preventDefault(); this.handleFlip(); }
        else if (e.key === 'b' || e.key === '.') { e.preventDefault(); api.speak(this.elements.wordDisplay.textContent); }
        else if (e.key === ' ') { e.preventDefault(); if (!this.elements.cardBack.classList.contains('is-slid-up')) api.speak(this.elements.wordDisplay.textContent); }
    },
    handleTouchStart(e) {
        if (!this.isLearningModeActive() || e.target.closest('.interactive-word, #word-display, #favorite-btn, #progress-bar-track, #sample-btn, #prev-btn, #next-btn')) return;
        this.state.touchstartX = e.changedTouches[0].screenX; this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) {
        if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick], #progress-bar-track')) { this.state.touchstartX = this.state.touchstartY = 0; return; }
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX;
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1);
        this.state.touchstartX = this.state.touchstartY = 0;
    },
    updateProgressBar(index) {
        const total = this.state.currentDisplayList.length;
        if (total <= 1) {
            this.elements.progressBarFill.style.width = '100%';
            this.elements.progressBarHandle.style.left = '100%';
            if (this.elements.progressBarNumber) {
                this.elements.progressBarNumber.textContent = total > 0 ? '1' : '';
                this.elements.progressBarNumber.style.left = '100%';
            }
            return;
        }
        const percentage = (index / (total - 1)) * 100;
        this.elements.progressBarFill.style.width = `${percentage}%`;
        this.elements.progressBarHandle.style.left = `calc(${percentage}% - ${this.elements.progressBarHandle.offsetWidth / 2}px)`;
        if (this.elements.progressBarNumber) {
            this.elements.progressBarNumber.textContent = index + 1;
            this.elements.progressBarNumber.style.left = `${percentage}%`;
        }
    },
    handleProgressBarInteraction(e) {
        if (!this.isLearningModeActive()) return;
        const track = this.elements.progressBarTrack;
        const totalWords = this.state.currentDisplayList.length;
        if (totalWords <= 1) return;
        const handleInteraction = (clientX) => {
            activityTracker.recordActivity();
            const rect = track.getBoundingClientRect();
            const x = clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            const newIndex = Math.round(percentage * (totalWords - 1));
            if (newIndex !== this.state.currentIndex) {
                this.state.currentIndex = newIndex;
                this.displayWord(newIndex);
            }
        };
        switch (e.type) {
            case 'mousedown':
            case 'touchstart':
                e.preventDefault();
                this.state.isDragging = true;
                handleInteraction(e.type === 'touchstart' ? e.touches[0].clientX : e.clientX);
                break;
            case 'mousemove':
            case 'touchmove':
                if (this.state.isDragging) {
                    handleInteraction(e.type === 'touchmove' ? e.touches[0].clientX : e.clientX);
                }
                break;
            case 'mouseup':
            case 'mouseleave':
            case 'touchend':
                this.state.isDragging = false;
                break;
        }
    },
};
function levenshteinDistance(a = '', b = '') {
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator,
            );
        }
    }
    return track[b.length][a.length];
}
