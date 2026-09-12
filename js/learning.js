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
            startTitle: document.getElementById('learning-start-title'),
            startHint: document.getElementById('learning-start-hint'),
            partSelect: document.getElementById('learning-part-select'),
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
        this.elements.partSelect.addEventListener('change', () => this.selectPart(this.elements.partSelect.value));
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
    // 같은 학년 목록을 여러 곳에서 동시에 부르면 진행 중인 요청 하나를 함께 기다린다(중복 요청 방지).
    _loadingWordLists: {},
    loadWordList(force = false, grade = app.state.selectedSheet) {
        if (!grade) return Promise.resolve();
        if (!force && this.state.isWordListReady[grade]) return Promise.resolve();
        const inFlight = this._loadingWordLists[grade];
        if (inFlight) {
            // 강제 새로고침은 진행 중인 요청이 끝난 뒤 한 번 더 받아야 최신 버전이 확실하다.
            return force ? inFlight.catch(() => {}).then(() => this.loadWordList(true, grade)) : inFlight;
        }
        const loading = this._fetchWordList(force, grade).finally(() => {
            if (this._loadingWordLists[grade] === loading) delete this._loadingWordLists[grade];
        });
        this._loadingWordLists[grade] = loading;
        return loading;
    },
    // 단어장은 기기에 저장해 두고 서버 버전이 더 새로울 때만 다시 받는다.
    // 버전 확인이나 다시 받기가 실패하면(오프라인 등) 저장해 둔 단어장을 그대로 쓴다. 지워 버리면 앱을 쓸 수 없게 된다.
    async _fetchWordList(force, grade) {
        const keys = app.state.LOCAL_STORAGE_KEYS;
        const cacheKey = keys.WORD_LIST_CACHE(grade);
        const timestampKey = keys.CACHE_TIMESTAMP(grade);
        const versionKey = keys.CACHE_VERSION(grade);
        const applyWords = (words, timestamp) => {
            this.state.wordList[grade] = words.sort((a, b) => a.id - b.id);
            this.state.isWordListReady[grade] = true;
            app.state.lastCacheTimestamp[grade] = timestamp;
            app.updateLastUpdatedText();
        };

        let cached = null;
        try {
            const cachedData = localStorage.getItem(cacheKey);
            const savedTimestamp = localStorage.getItem(timestampKey);
            if (cachedData && savedTimestamp) {
                const { words } = JSON.parse(cachedData);
                if (Array.isArray(words)) cached = { words, timestamp: parseInt(savedTimestamp) };
            }
        } catch (e) {
            console.warn("Error reading or parsing word list cache:", e);
            utils._removeWordListCache(grade);
        }

        let needsFetch = force || !cached;
        if (!needsFetch) {
            try {
                const snapshot = await get(ref(rt_db, `app_config/vocab_version_${grade}`));
                const remoteVersion = snapshot.val() || 0;
                const localVersion = parseInt(localStorage.getItem(versionKey) || '0');
                needsFetch = remoteVersion > localVersion;
            } catch (e) {
                console.warn(`버전을 확인하지 못해 저장해 둔 '${grade}' 단어장을 씁니다.`, e);
            }
        }
        if (!needsFetch) {
            applyWords(cached.words, cached.timestamp);
            return;
        }

        try {
            const snapshot = await get(ref(rt_db, `${grade}/vocabulary`));
            const data = snapshot.val();
            if (!data) throw new Error(`Firebase에 '${grade}' 단어 데이터가 없습니다.`);
            const wordsArray = Object.values(data);
            const timestampSnapshot = await get(ref(rt_db, `app_config/vocab_timestamp_${grade}`));
            const newTimestamp = timestampSnapshot.val() || Date.now();
            const versionSnapshot = await get(ref(rt_db, `app_config/vocab_version_${grade}`));
            const currentRemoteVersion = versionSnapshot.val() || 1;
            applyWords(wordsArray, newTimestamp);
            try {
                utils.withStorageRecovery(() => {
                    localStorage.setItem(cacheKey, JSON.stringify({ words: wordsArray }));
                    localStorage.setItem(timestampKey, newTimestamp.toString());
                    localStorage.setItem(versionKey, currentRemoteVersion.toString());
                });
            } catch (e) { console.error("Error saving word list cache:", e); }
        } catch (error) {
            if (cached && !force) {
                console.warn(`새 '${grade}' 단어장을 받지 못해 저장해 둔 단어장을 씁니다.`, error);
                applyWords(cached.words, cached.timestamp);
                return;
            }
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
            this.renderPartOptions();
        }
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = false;
        const allWords = this.state.wordList[grade];
        const partName = this.elements.partSelect.value;
        const part = partName ? utils.getParts(grade).find(item => item.name === partName) : null;
        if (partName && !part) {
            app.showToast('선택한 Part에 어휘가 없습니다.', true);
            return;
        }
        const startWord = this.elements.startWordInput.value.trim().toLowerCase();
        let savedIndex = 0;
        if (!startWord) {
            try {
                savedIndex = parseInt(localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(grade)) || '0');
            } catch (e) {}
        }
        const result = this.findStart(allWords, part, startWord, savedIndex);
        if (result.index !== undefined) {
            this.elements.startScreen.classList.add('hidden');
            this.state.currentIndex = result.index;
            this.launchApp(allWords);
            return;
        }
        // 제목 줄이 가려지므로 어느 Part에서 찾았는지 안내문에 함께 적는다.
        const scope = part ? `<strong>${ui.escapeHtml(part.name)}</strong>에서` : '';
        if (result.vocabMatches.length > 0 || result.explanationMatches.length > 0) {
            const title = `<strong>'${startWord}'</strong>(을)를${scope ? ' ' + scope : ''} 찾을 수 없습니다. 혹시 이 단어인가요?`;
            this.displaySuggestions(result.vocabMatches, result.explanationMatches, allWords, title);
        } else {
            const title = `${scope ? scope + ' ' : ''}<strong>'${startWord}'</strong>에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], [], allWords, title);
        }
    },
    // 시작할 카드를 정한다. Part는 시작 위치와 검색 범위만 정하고, 카드 목록과 번호는 늘 전체 기준이라
    // 들어간 뒤에는 앞뒤로 Part를 넘나든다. 반환하는 index는 전체 목록에서의 위치다.
    findStart(allWords, part, startWord, savedIndex) {
        if (!startWord) {
            if (part) return { index: part.start - 1 };
            return { index: savedIndex >= 0 && savedIndex < allWords.length ? savedIndex : 0 };
        }
        const searchEntries = allWords
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !part || utils.getPartName(item) === part.name);
        const exactMatch = searchEntries.find(({ item }) => item.word.toLowerCase() === startWord);
        if (exactMatch) return { index: exactMatch.index };
        const searchRegex = new RegExp(`\\b${startWord}\\b`, 'i');
        const explanationMatches = searchEntries
            .filter(({ item }) => item.explanation && searchRegex.test(item.explanation.replace(/\[.*?\]/g, '')))
            .map(({ item, index }) => ({ word: item.word, index }));
        // 앞 글자가 같은 단어 → 검색어를 포함한 단어 → 철자가 비슷한 단어 순으로 최대 50개를 보여 준다.
        const startsWith = [];
        const includes = [];
        const similar = [];
        searchEntries.forEach(({ item, index }) => {
            const wordLower = item.word.toLowerCase();
            if (wordLower.startsWith(startWord)) {
                startsWith.push({ word: item.word, index });
            } else if (wordLower.includes(startWord)) {
                includes.push({ word: item.word, index });
            } else if (Math.abs(wordLower.length - startWord.length) <= 2) {
                const distance = levenshteinDistance(startWord, wordLower, 2);
                if (distance <= 2 && distance < Math.max(wordLower.length, startWord.length) * 0.4) {
                    similar.push({ word: item.word, index, distance });
                }
            }
        });
        similar.sort((a, b) => a.distance - b.distance);
        const vocabMatches = [...startsWith, ...includes, ...similar].slice(0, 50);
        return { vocabMatches, explanationMatches };
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
        this.renderPartOptions();
        if (app.state.selectedSheet) {
            this.loadWordList(false, app.state.selectedSheet)
                .then(() => this.renderPartOptions())
                .catch(error => console.error('단어 목록을 불러오지 못했습니다.', error));
        }
    },
    // 학습 Part 목록을 채우고 제목을 맞춘다. 저장해 둔 Part가 사라졌으면 전체로 돌린다.
    renderPartOptions() {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        const isReady = this.state.isWordListReady[grade];
        const partNames = isReady ? utils.getParts(grade).map(part => part.name) : [];
        let selected = '';
        try {
            selected = localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.LEARNING_PART(grade)) || '';
        } catch (e) {}
        // 목록을 받기 전에는 저장된 Part를 그대로 보여 두고, 받은 뒤에 아직 있는지 확인한다.
        if (!isReady && selected) partNames.push(selected);
        if (isReady && !partNames.includes(selected)) selected = '';
        ui.fillPartSelect(this.elements.partSelect, partNames);
        this.elements.partSelect.value = selected;
        this.updateStartText(selected);
    },
    selectPart(partName) {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        try {
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.LEARNING_PART(grade), partName);
        } catch (e) {
            console.error("Error saving learning part to localStorage", e);
        }
        this.updateStartText(partName);
    },
    updateStartText(partName) {
        this.elements.startTitle.textContent = `학습 모드 (${partName || '전체'})`;
        this.elements.startHint.textContent = partName
            ? '(비워두면 이 Part의 첫 어휘부터 시작합니다.)'
            : '(비워두면 최근 학습한 어휘부터 시작합니다.)';
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
        ui.renderExplanation(this.elements.explanationDisplay, wordData.explanation);
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
        // 가로 움직임이 세로의 2배를 넘을 때만 넘긴다. 설명을 위아래로 스크롤하다 카드가 넘어가지 않게 한다.
        if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1);
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
// 편집 거리. limit를 주면 그보다 커지는 순간 limit + 1을 돌려주고 멈춘다(검색이 빨라진다).
function levenshteinDistance(s = '', t = '', limit = Infinity) {
    if (s === t) return 0;
    if (s.length === 0) return t.length;
    if (t.length === 0) return s.length;
    if (Math.abs(s.length - t.length) > limit) return limit + 1;
    let v0 = new Array(t.length + 1);
    let v1 = new Array(t.length + 1);
    for (let i = 0; i < v0.length; i++) v0[i] = i;
    for (let i = 0; i < s.length; i++) {
        v1[0] = i + 1;
        let minRow = v1[0];
        for (let j = 0; j < t.length; j++) {
            const cost = s[i] === t[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
            minRow = Math.min(minRow, v1[j + 1]);
        }
        if (minRow > limit) return limit + 1;
        [v0, v1] = [v1, v0];
    }
    return v0[t.length];
}
