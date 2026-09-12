// 일반·혼합·오답 퀴즈 실행
const quizMode = {
         state: {
        currentQuiz: {},
        currentQuizType: null,
        sessionMode: 'SINGLE',
        sessionLimit: 10,
        mixedQuizTypes: [],
        mixedTypeCycle: [],
        reviewQueue: [],
        isPracticeMode: false,
        practiceLearnedWords: [],
        sessionAnsweredInSet: 0,
        sessionCorrectInSet: 0,
        sessionMistakes: [],
        answeredWords: new Set(),
        preloadedQuizzes: {
            '1y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '2y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '3y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null }
        },
        isPreloading: {
            '1y': {}, '2y': {}, '3y': {}
        },
        currentRangeInputTarget: null,
        isFinalResult: false,
    },
    elements: {},
    CUSTOM_PART_VALUE: '__custom__',
    init() {
        this.elements = {
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'),
            startMixedQuizBtn: document.getElementById('start-mixed-quiz-btn'),
            mixedTypeButtons: Array.from(document.querySelectorAll('.mixed-type-btn')),
            quizRangeStart: document.getElementById('quiz-range-start'),
            quizRangeEnd: document.getElementById('quiz-range-end'),
            quizPartSelect: document.getElementById('quiz-part-select'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            questionDisplay: document.getElementById('quiz-question-display'),
            choices: document.getElementById('quiz-choices'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message'),
            quizResultModal: document.getElementById('quiz-result-modal'),
            quizResultScore: document.getElementById('quiz-result-score'),
            quizResultMistakesBtn: document.getElementById('quiz-result-mistakes-btn'),
            quizResultContinueBtn: document.getElementById('quiz-result-continue-btn'),
            rangeInputModal: document.getElementById('range-input-modal'),
            rangeInputLabel: document.getElementById('range-input-label'),
            quizRangeLabel: document.getElementById('quiz-range-label'),
            rangeInputField: document.getElementById('range-input-field'),
            rangeInputCancelBtn: document.getElementById('range-input-cancel-btn'),
            rangeInputConfirmBtn: document.getElementById('range-input-confirm-btn'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));
        this.elements.startMixedQuizBtn.addEventListener('click', () => this.start('MIXED'));
        this.elements.mixedTypeButtons.forEach(button => {
            button.addEventListener('click', () => this.toggleMixedType(button));
        });
        this.elements.quizRangeStart.addEventListener('click', (e) => this.promptForRangeValue(e.target));
        this.elements.quizRangeEnd.addEventListener('click', (e) => this.promptForRangeValue(e.target));
        this.elements.quizPartSelect.addEventListener('change', () => this.applyQuizPart(this.elements.quizPartSelect.value));
        this.elements.rangeInputConfirmBtn.addEventListener('click', () => this.confirmRangeInput());
        this.elements.rangeInputCancelBtn.addEventListener('click', () => this.hideRangeInput());
        this.elements.rangeInputModal.addEventListener('click', () => this.hideRangeInput());
        this.elements.rangeInputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmRangeInput();
            if (e.key === 'Escape') this.hideRangeInput();
        });
        this.elements.quizRangeLabel.addEventListener('click', () => this.resetQuizRange());
        this.elements.quizResultContinueBtn.addEventListener('click', () => this.continueAfterResult());
        this.elements.quizResultMistakesBtn.addEventListener('click', () => this.reviewSessionMistakes());
        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;
            activityTracker.recordActivity();
            const choiceCount = Array.from(this.elements.choices.children).filter(el => !el.textContent.includes('PASS')).length;
            if (e.key.toLowerCase() === 'p' || e.key === '0') {
                 e.preventDefault();
                 const passButton = Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'));
                 if(passButton) passButton.click();
            } else {
                const choiceIndex = parseInt(e.key);
                if (choiceIndex >= 1 && choiceIndex <= choiceCount) {
                    e.preventDefault();
                    const targetLi = this.elements.choices.children[choiceIndex - 1];
                    targetLi.classList.add('bg-gray-200');
                    setTimeout(() => targetLi.classList.remove('bg-gray-200'), 150);
                    targetLi.click();
                }
            }
        });
    },
    promptForRangeValue(targetButton) {
        if (!targetButton) return;
        this.state.currentRangeInputTarget = targetButton;
        const isStart = targetButton.id === 'quiz-range-start';
        const grade = app.state.selectedSheet;
        const min = parseInt(targetButton.dataset.min) || 1;
        const max = parseInt(targetButton.dataset.max) || (learningMode.state.wordList[grade]?.length || 1);
        const labelText = isStart ? `시작번호 (1-${max}) :` : `마지막번호 (1-${max}) :`;
        this.elements.rangeInputLabel.textContent = labelText;
        this.elements.rangeInputField.value = targetButton.textContent;
        this.elements.rangeInputField.min = min;
        this.elements.rangeInputField.max = max;
        this.elements.rangeInputModal.classList.remove('hidden');
        this.elements.rangeInputField.focus();
        this.elements.rangeInputField.select();
    },
    hideRangeInput() {
        this.elements.rangeInputModal.classList.add('hidden');
        this.state.currentRangeInputTarget = null;
    },
    confirmRangeInput() {
        const targetButton = this.state.currentRangeInputTarget;
        if (!targetButton) return;
        const grade = app.state.selectedSheet;
        const min = parseInt(targetButton.dataset.min) || 1;
        const max = parseInt(targetButton.dataset.max) || (learningMode.state.wordList[grade]?.length || 1);
        const newValueStr = this.elements.rangeInputField.value;
        if (newValueStr !== null && newValueStr.trim() !== '') {
            let newValue = parseInt(newValueStr);
            if (!isNaN(newValue)) {
                newValue = Math.max(min, Math.min(max, newValue));
                targetButton.textContent = newValue;
                if (grade) {
                    const storageKey = targetButton.id === 'quiz-range-start'
                                       ? app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade)
                                       : app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade);
                    try {
                        localStorage.setItem(storageKey, newValue);
                        this.clearAndPreloadQuizzesForNewRange(grade);
                    } catch (e) {
                        console.error("Error saving quiz range to localStorage", e);
                    }
                }
            } else {
                app.showToast("숫자만 입력 가능합니다.", true);
            }
        }
        this.syncQuizPartSelect();
        this.hideRangeInput();
    },
    resetQuizRange() {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        const allWords = learningMode.state.wordList[grade] || [];
        const totalWords = allWords.length > 0 ? allWords.length : 1;
        this.elements.quizRangeStart.textContent = 1;
        this.elements.quizRangeEnd.textContent = totalWords;
        try {
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade), 1);
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade), totalWords);
            this.clearAndPreloadQuizzesForNewRange(grade);
        } catch (e) {
            console.error("Error saving reset quiz range to localStorage", e);
        }
        this.syncQuizPartSelect();
    },
    // Part를 고르면 그 Part의 첫·마지막 어휘카드 번호를 출제범위에 넣는다. 전체는 1부터 끝까지다.
    applyQuizPart(partName) {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        const part = partName && utils.getParts(grade).find(item => item.name === partName);
        if (!part) {
            this.resetQuizRange();
            return;
        }
        this.elements.quizRangeStart.textContent = part.start;
        this.elements.quizRangeEnd.textContent = part.end;
        try {
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade), part.start);
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade), part.end);
        } catch (e) {
            console.error("Error saving part quiz range to localStorage", e);
        }
        this.clearAndPreloadQuizzesForNewRange(grade);
        this.syncQuizPartSelect();
    },
    renderQuizPartOptions() {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        ui.fillPartSelect(this.elements.quizPartSelect, utils.getParts(grade).map(part => part.name));
        this.syncQuizPartSelect();
    },
    // 출제범위가 1부터 끝이면 전체, 어느 Part와 꼭 맞으면 그 Part, 둘 다 아니면 '직접 입력'을 보여 준다.
    syncQuizPartSelect() {
        const grade = app.state.selectedSheet;
        const select = this.elements.quizPartSelect;
        if (!grade || !select) return;
        const value = this.getPartValueForRange(
            parseInt(this.elements.quizRangeStart.textContent),
            parseInt(this.elements.quizRangeEnd.textContent),
            learningMode.state.wordList[grade]?.length || 0,
            utils.getParts(grade)
        );
        // '직접 입력'은 고를 수 있는 항목이 아니라 상태 표시이므로 필요할 때만 넣는다.
        select.querySelector(`option[value="${this.CUSTOM_PART_VALUE}"]`)?.remove();
        if (value === this.CUSTOM_PART_VALUE) {
            const option = document.createElement('option');
            option.value = this.CUSTOM_PART_VALUE;
            option.textContent = '직접 입력';
            option.disabled = true;
            select.appendChild(option);
        }
        select.value = value;
    },
    getPartValueForRange(start, end, totalWords, parts) {
        const low = Math.min(start, end);
        const high = Math.max(start, end);
        if (low === 1 && high === totalWords) return '';
        const part = parts.find(item => item.start === low && item.end === high);
        return part ? part.name : this.CUSTOM_PART_VALUE;
    },
    clearAndPreloadQuizzesForNewRange(grade) {
        if (!grade || !this.state.preloadedQuizzes[grade]) return;
        const quizTypes = Object.keys(this.state.preloadedQuizzes[grade]);
        quizTypes.forEach(type => {
            this.state.preloadedQuizzes[grade][type] = null;
            if (this.state.isPreloading[grade]) this.state.isPreloading[grade][type] = false;
            this.preloadNextQuiz(grade, type);
        });
    },
    async start(quizType) {
        const mixedTypes = this.elements.mixedTypeButtons
            .filter(button => button.getAttribute('aria-pressed') === 'true')
            .map(button => button.dataset.quizType);
        if (quizType === 'MIXED' && mixedTypes.length < 2) {
            app.showToast('혼합할 퀴즈 유형을 두 개 이상 선택하세요.', true);
            return;
        }
        app.navigateTo('quiz-play', app.state.selectedSheet, {
            quizType,
            mixed: quizType === 'MIXED',
            mixedTypes
        });
    },
    toggleMixedType(button) {
        const selected = button.getAttribute('aria-pressed') === 'true';
        button.setAttribute('aria-pressed', String(!selected));
    },
    configureSession(options = {}) {
        if (options.reviewItems?.length) {
            this.state.sessionMode = 'REVIEW';
            this.state.reviewQueue = [...options.reviewItems];
            this.state.sessionLimit = this.state.reviewQueue.length;
            this.state.currentQuizType = this.state.reviewQueue[0].quizType;
            this.state.mixedQuizTypes = [];
            this.state.mixedTypeCycle = [];
            return;
        }

        this.state.reviewQueue = [];
        this.state.sessionLimit = 10;
        this.state.sessionMode = options.mixed ? 'MIXED' : 'SINGLE';
        this.state.mixedQuizTypes = options.mixed && options.mixedTypes?.length
            ? [...options.mixedTypes]
            : [];
        this.state.mixedTypeCycle = [];
        this.state.currentQuizType = options.mixed ? null : options.quizType;
    },
    _pickBalancedMixedType() {
        if (this.state.mixedTypeCycle.length === 0) {
            this.state.mixedTypeCycle = utils.shuffleArray([...this.state.mixedQuizTypes]);
        }
        return this.state.mixedTypeCycle.shift() || this.state.mixedQuizTypes[0] || null;
    },
    reset(showSelection = true) {
        this.state.currentQuiz = {};
        this.state.practiceLearnedWords = [];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        if (showSelection) {
            this.state.currentQuizType = null;
            this.state.answeredWords.clear();
            this.state.sessionMode = 'SINGLE';
            this.state.sessionLimit = 10;
            this.state.reviewQueue = [];
            this.state.mixedQuizTypes = [];
            this.state.mixedTypeCycle = [];
        }
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
        if (this.elements.quizResultModal) this.elements.quizResultModal.classList.add('hidden');
    },
    async updateRangeInputs() {
        const grade = app.state.selectedSheet;
        if (!grade) return;
        let startValue = 1;
        let endValue = 1;
        let totalWords = 1;
        try {
            if (!learningMode.state.isWordListReady[grade]) {
                await learningMode.loadWordList();
            }
            totalWords = learningMode.state.wordList[grade]?.length || 1;
            endValue = totalWords;
            const startStorageKey = app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade);
            const endStorageKey = app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade);
            const savedStart = localStorage.getItem(startStorageKey);
            const savedEnd = localStorage.getItem(endStorageKey);
            if (savedStart !== null) {
                const parsedStart = parseInt(savedStart);
                if (!isNaN(parsedStart) && parsedStart >= 1 && parsedStart <= totalWords) {
                    startValue = parsedStart;
                } else {
                    localStorage.removeItem(startStorageKey);
                }
            } else {
                localStorage.setItem(startStorageKey, '1');
            }
            if (savedEnd !== null) {
                const parsedEnd = parseInt(savedEnd);
                if (!isNaN(parsedEnd) && parsedEnd >= 1 && parsedEnd <= totalWords) {
                    endValue = parsedEnd;
                } else {
                     localStorage.removeItem(endStorageKey);
                }
            } else {
                 localStorage.setItem(endStorageKey, totalWords.toString());
            }
        } catch (error) {
            console.error("Error updating quiz range inputs:", error);
            startValue = 1;
            endValue = 1;
            totalWords = 1;
        } finally {
            this.elements.quizRangeStart.textContent = startValue;
            this.elements.quizRangeStart.dataset.min = 1;
            this.elements.quizRangeStart.dataset.max = totalWords;
            this.elements.quizRangeEnd.textContent = endValue;
            this.elements.quizRangeEnd.dataset.min = 1;
            this.elements.quizRangeEnd.dataset.max = totalWords;
            this.renderQuizPartOptions();
        }
    },
    async displayNextQuiz() {
        this.showLoader(true, '다음 문제 생성 중...');
        let nextQuiz = null;
        const grade = app.state.selectedSheet;
        if (this.state.sessionMode === 'REVIEW') {
            nextQuiz = await this.generateSingleQuiz();
        } else {
            if (this.state.sessionMode === 'MIXED') {
                this.state.currentQuizType = this._pickBalancedMixedType();
            }
            const type = this.state.currentQuizType;
            let preloaded = this.state.preloadedQuizzes[grade]?.[type];
            if (preloaded) {
                const allWords = learningMode.state.wordList[grade] || [];
                const startVal = parseInt(this.elements.quizRangeStart.textContent) || 1;
                const endVal = parseInt(this.elements.quizRangeEnd.textContent) || allWords.length;
                const startNum = Math.min(startVal, endVal);
                const endNum = Math.max(startVal, endVal);
                const startIndex = Math.max(0, startNum - 1);
                const endIndex = Math.min(allWords.length - 1, endNum - 1);
                const wordIndex = allWords.findIndex(w => w.word === preloaded.question.word);
                if (wordIndex < startIndex || wordIndex > endIndex) {
                    preloaded = null;
                }
                if (preloaded && this.state.answeredWords.has(preloaded.question.word)) {
                    preloaded = null;
                }
                if (preloaded && !this.state.isPracticeMode) {
                    const learnedWordsInType = utils.getCorrectlyAnsweredWords(type);
                    if (learnedWordsInType.includes(preloaded.question.word)) {
                        preloaded = null;
                    }
                }
            }
            if (preloaded) {
                nextQuiz = preloaded;
                this.state.preloadedQuizzes[grade][type] = null;
                this.preloadNextQuiz(grade, type, nextQuiz.question.word);
            }
            if (!nextQuiz) {
                nextQuiz = await this.generateSingleQuiz();
                if (!nextQuiz && this.state.sessionMode === 'MIXED') {
                    const fallbackTypes = this.state.mixedQuizTypes
                        .filter(candidateType => candidateType !== type);
                    for (const fallbackType of utils.shuffleArray(fallbackTypes)) {
                        this.state.currentQuizType = fallbackType;
                        nextQuiz = await this.generateSingleQuiz();
                        if (nextQuiz) break;
                    }
                }
                if (nextQuiz) {
                    this.preloadNextQuiz(grade, this.state.currentQuizType, nextQuiz.question.word);
                }
            }
        }
        if (nextQuiz) {
            this.state.currentQuiz = nextQuiz;
            this.showLoader(false);
            this.renderQuiz(nextQuiz);
        } else {
            if (this.state.sessionAnsweredInSet > 0) {
                this.showSessionResultModal(true);
            } else {
                this.showFinishedScreen("No more quizzes!");
                setTimeout(() => app.navigateTo('quiz', grade), 800);
            }
        }
    },
    async generateSingleQuiz() {
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return null;
        const allWords = learningMode.state.wordList[grade] || [];
        if (allWords.length === 0) return null;
        if (this.state.sessionMode === 'REVIEW') {
            const usableAllWordsForChoices = allWords.length >= 4
                ? allWords
                : [...allWords, { word: 'dummy1', meaning: '오답1' }, { word: 'dummy2', meaning: '오답2' }, { word: 'dummy3', meaning: '오답3' }];
            while (this.state.reviewQueue.length > 0) {
                const { word, quizType } = this.state.reviewQueue.shift();
                if (utils.getCombinedProgress(word, grade)[quizType] !== 'incorrect') continue;
                const wordData = allWords.find(item => item.word === word);
                if (!wordData) continue;

                const quiz = await this._makeQuizFromCandidates(quizType, [wordData], usableAllWordsForChoices);
                if (quiz) {
                    this.state.currentQuizType = quizType;
                    return quiz;
                }
            }
            return null;
        }
        const startVal = parseInt(this.elements.quizRangeStart.textContent) || 1;
        const endVal = parseInt(this.elements.quizRangeEnd.textContent) || allWords.length;
        const startNum = Math.min(startVal, endVal);
        const endNum = Math.max(startVal, endVal);
        const startIndex = Math.max(0, startNum - 1);
        const endIndex = Math.min(allWords.length - 1, endNum - 1);
        const wordsInRange = allWords.slice(startIndex, endIndex + 1);
        if (wordsInRange.length === 0) return null;
        const learnedWordsInType = this.state.isPracticeMode ?
            this.state.practiceLearnedWords :
            utils.getCorrectlyAnsweredWords(this.state.currentQuizType);
        let candidates = wordsInRange.filter(wordObj => {
             if (this.state.answeredWords.has(wordObj.word)) {
                 return false;
             }
             if (this.state.isPracticeMode) {
                 return true;
             }
             const status = utils.getWordStatus(wordObj.word);
             return status !== 'learned' && !learnedWordsInType.includes(wordObj.word);
        });
if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
            candidates = candidates.filter(word => {
                if (!word.sample || word.sample.trim() === '') return false;
                const firstLine = word.sample.split('\n')[0];
                const placeholderRegex = /\*(.*?)\*/;
                const flexibleRegex = utils.getFlexibleRegex(word.word);
                return placeholderRegex.test(firstLine) || flexibleRegex.test(firstLine);
            });
        }
        if (candidates.length === 0) return null;
        utils.shuffleArray(candidates);
        const usableAllWordsForChoices = allWords.length >= 4 ? allWords : [...allWords, {word: 'dummy1', meaning: '오답1'}, {word: 'dummy2', meaning: '오답2'}, {word: 'dummy3', meaning: '오답3'}];
        return this._makeQuizFromCandidates(this.state.currentQuizType, candidates, usableAllWordsForChoices);
    },
    // 후보 단어 가운데 처음으로 만들어지는 퀴즈를 돌려준다. 영한·빈칸은 바로 만들 수 있어 차례로 시도하고,
    // 영영은 사전 API를 기다려야 해서 5개씩 동시에 물어 가장 먼저 뜻풀이가 온 단어로 낸다.
    // exhaustive가 false면(미리 준비용) 첫 5개만 시도한다.
    async _makeQuizFromCandidates(quizType, candidates, allWordsForChoices, { exhaustive = true } = {}) {
        if (candidates.length === 0) return null;
        if (quizType === 'MULTIPLE_CHOICE_MEANING' || quizType === 'FILL_IN_THE_BLANK') {
            for (const wordData of candidates) {
                const quiz = quizType === 'MULTIPLE_CHOICE_MEANING'
                    ? this.createMeaningQuiz(wordData, allWordsForChoices)
                    : this.createBlankQuiz(wordData, allWordsForChoices);
                if (quiz) return quiz;
            }
            return null;
        }
        if (quizType !== 'MULTIPLE_CHOICE_DEFINITION') return null;
        const BATCH_SIZE = 5;
        const limit = exhaustive ? candidates.length : Math.min(BATCH_SIZE, candidates.length);
        for (let i = 0; i < limit; i += BATCH_SIZE) {
            const batch = candidates.slice(i, Math.min(i + BATCH_SIZE, limit));
            try {
                return await Promise.any(batch.map(async wordData => {
                    const definition = await api.fetchDefinition(wordData.word);
                    const quiz = definition ? this.createDefinitionQuiz(wordData, allWordsForChoices, definition) : null;
                    if (!quiz) throw new Error('no-quiz');
                    return quiz;
                }));
            } catch (e) {
                // 이 묶음에서 하나도 만들지 못했으면 다음 묶음을 시도한다.
            }
        }
        return null;
    },
    renderQuiz(quizData) {
        const { type, question, choices } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';
        if (type === 'MULTIPLE_CHOICE_DEFINITION') {
            questionDisplay.classList.remove('justify-center', 'items-center');
            ui.displaySentences([question.definition], questionDisplay);
            const sentenceElement = questionDisplay.querySelector('p');
            if(sentenceElement) sentenceElement.className = 'text-lg sm:text-xl text-left text-gray-800 leading-relaxed';
        } else if (type === 'FILL_IN_THE_BLANK') {
            questionDisplay.classList.remove('justify-center', 'items-center');
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';
            const sentenceParts = question.sentence_with_blank.split(/(\*.*?\*|＿＿＿＿)/g);
            sentenceParts.forEach(part => {
                if (part === '＿＿＿＿') {
                    const blankSpan = document.createElement('span');
                    blankSpan.className = 'quiz-blank inline-block font-mono text-blue-600';
                    blankSpan.textContent = '___________';
                    p.appendChild(blankSpan);
                } else if (part && part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    strong.appendChild(ui.createInteractiveFragment(part.slice(1, -1), true));
                    p.appendChild(strong);
                } else if (part) {
                    p.appendChild(ui.createInteractiveFragment(part, true));
                }
            });
            questionDisplay.appendChild(p);
        } else {
            questionDisplay.classList.add('justify-center', 'items-center');
            const h1 = document.createElement('h1');
            h1.className = 'text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer';
            if (!isIosDevice()) h1.title = "클릭하여 발음 듣기";
            h1.textContent = question.word;
            h1.onclick = () => api.speak(question.word);
            questionDisplay.appendChild(h1);
            ui.adjustFontSize(h1);
        }
        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 py-3 px-4 rounded-lg cursor-pointer flex items-start transition-all text-lg hover:bg-blue-50';
            const indexSpan = document.createElement('span');
            indexSpan.className = 'font-bold mr-3';
            indexSpan.textContent = `${index + 1}.`;
            const choiceSpan = document.createElement('span');
            choiceSpan.textContent = choice;
            li.append(indexSpan, choiceSpan);
            // 정답 표시는 화면 글자가 아니라 보기 값으로 찾는다(뜻에 < & 같은 글자가 있어도 정확하다).
            li._choice = choice;
            li.onclick = () => this.checkAnswer(li, choice);
            this.elements.choices.appendChild(li);
        });
        const passLi = document.createElement('li');
        passLi.className = 'choice-item p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.style.setProperty('background', '#ffe4e6CC', 'important');
        passLi.style.setProperty('color', '#1f2937', 'important');
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED');
        this.elements.choices.appendChild(passLi);
        this.elements.choices.classList.remove('disabled');
    },
    async checkAnswer(selectedLi, selectedChoice) {
        activityTracker.recordActivity();
        this.elements.choices.classList.add('disabled');
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        const isPass = selectedChoice === 'USER_PASSED';
        const word = this.state.currentQuiz.question.word;
        const quizType = this.state.currentQuiz.type;
        this.state.answeredWords.add(word);
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (isCorrect && !isPass) {
            playSequence(correctBeep);
        } else {
            playSequence(incorrectBeep);
        }
        this.state.sessionAnsweredInSet++;
        if (isCorrect) {
            this.state.sessionCorrectInSet++;
        } else {
            this.state.sessionMistakes.push(word);
        }
        if (!this.state.isPracticeMode || this.state.sessionMode === 'REVIEW') {
            await utils.updateWordStatus(word, quizType, (isCorrect && !isPass) ? 'correct' : 'incorrect');
        } else if (isCorrect) {
             this.state.practiceLearnedWords.push(word);
        }
        if (!isCorrect || isPass) {
            const correctAnswerEl = Array.from(this.elements.choices.children)
                .find(li => li._choice === this.state.currentQuiz.answer);
            correctAnswerEl?.classList.add('correct');
        }
        // 틀렸을 때는 정답을 확인할 시간을 더 준다.
        setTimeout(() => {
            if (this.state.sessionAnsweredInSet >= this.state.sessionLimit) {
                this.showSessionResultModal(true);
            } else {
                this.displayNextQuiz();
            }
        }, (isCorrect && !isPass) ? 1200 : 2000);
    },
    showSessionResultModal(isFinal = false) {
        this.elements.quizResultScore.textContent = `${this.state.sessionAnsweredInSet}문제 중 ${this.state.sessionCorrectInSet}개 정답!`;
        this.elements.quizResultMistakesBtn.classList.toggle('hidden', this.state.sessionMistakes.length === 0);
        // 버튼 문구가 아니라 상태로 다음 동작을 정한다(문구를 바꿔도 동작이 틀어지지 않게).
        this.state.isFinalResult = isFinal;
        this.elements.quizResultContinueBtn.textContent = isFinal ? "퀴즈 유형으로" : "다음 퀴즈 계속";
        this.elements.quizResultModal.classList.remove('hidden');
    },
    continueAfterResult() {
        this.elements.quizResultModal.classList.add('hidden');
        if (this.state.isFinalResult) {
            app.syncOfflineData();
            app.navigateTo('quiz', app.state.selectedSheet);
            return;
        }
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.displayNextQuiz();
    },
    reviewSessionMistakes() {
        this.elements.quizResultModal.classList.add('hidden');
        const mistakes = [...new Set(this.state.sessionMistakes)];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        app.syncOfflineData();
        app.navigateTo('mistakeReview', app.state.selectedSheet, { mistakeWords: mistakes });
    },
    async preloadInitialQuizzesBasedOnSavedRange() {
        for (const grade of ['1y', '2y', '3y']) {
            if (!learningMode.state.isWordListReady[grade]) {
                try { await learningMode.loadWordList(false, grade); } catch(e) { continue; }
            }
            if (!learningMode.state.isWordListReady[grade]) continue;
            let startValue = 1;
            let endValue = learningMode.state.wordList[grade]?.length || 1;
             try {
                 const savedStart = localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade));
                 const savedEnd = localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade));
                 const totalWords = learningMode.state.wordList[grade]?.length || 1;
                 if (savedStart !== null) {
                     const parsedStart = parseInt(savedStart);
                     if (!isNaN(parsedStart) && parsedStart >= 1 && parsedStart <= totalWords) startValue = parsedStart;
                 }
                 if (savedEnd !== null) {
                     const parsedEnd = parseInt(savedEnd);
                     if (!isNaN(parsedEnd) && parsedEnd >= 1 && parsedEnd <= totalWords) endValue = parsedEnd;
                 }
             } catch(e) { console.warn(`Error reading saved range for ${grade} initial preload:`, e); }
            for (const type of ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION']) {
                this.preloadNextQuiz(grade, type, null, { start: startValue, end: endValue });
            }
        }
    },
    async preloadNextQuiz(grade, type, wordToExclude = null, rangeOverride = null) {
        if (!grade || !type || this.state.isPreloading[grade]?.[type] || this.state.preloadedQuizzes[grade]?.[type]) {
            return;
        }
        if (!this.state.isPreloading[grade]) this.state.isPreloading[grade] = {};
        this.state.isPreloading[grade][type] = true;
        try {
            const quiz = await this._generateSingleQuizForPreload(grade, type, wordToExclude, rangeOverride);
            if (quiz) {
                if (!this.state.preloadedQuizzes[grade]) this.state.preloadedQuizzes[grade] = {};
                 this.state.preloadedQuizzes[grade][type] = quiz;
            }
        } catch(e) {
            console.error(`Preloading ${grade}-${type} failed:`, e);
        } finally {
            if (this.state.isPreloading[grade]) this.state.isPreloading[grade][type] = false;
        }
    },
    async _generateSingleQuizForPreload(grade, quizType, wordToExclude = null, rangeOverride = null) {
        const allWords = learningMode.state.wordList[grade] || [];
        if (allWords.length === 0) return null;
        let startVal, endVal;
        if (rangeOverride) {
            startVal = rangeOverride.start;
            endVal = rangeOverride.end;
        } else {
             startVal = parseInt(this.elements.quizRangeStart.textContent) || 1;
             endVal = parseInt(this.elements.quizRangeEnd.textContent) || allWords.length;
        }
        const startNum = Math.min(startVal, endVal);
        const endNum = Math.max(startVal, endVal);
        const startIndex = Math.max(0, startNum - 1);
        const endIndex = Math.min(allWords.length - 1, endNum - 1);
        const wordsInRange = allWords.slice(startIndex, endIndex + 1);
        if (wordsInRange.length === 0) return null;
        const localUpdates = utils.getUnsyncedProgress(grade);
        const learnedWordsInType = utils.getCorrectlyAnsweredWords(quizType, grade);
        let candidates = wordsInRange.filter(wordObj => {
            const word = wordObj.word;
            if (word === wordToExclude) return false;
            if (this.state.answeredWords.has(word)) return false;
            if (this.state.isPracticeMode) return true;
            const serverStatus = app.state.currentProgress[word]?.[quizType];
            const localStatus = localUpdates[word]?.[quizType];
            const finalStatus = localStatus !== undefined ? localStatus : serverStatus;
            return finalStatus !== 'correct';
        });
if (quizType === 'FILL_IN_THE_BLANK') {
            candidates = candidates.filter(word => {
                if (!word.sample || word.sample.trim() === '') return false;
                const firstLine = word.sample.split('\n')[0];
                const placeholderRegex = /\*(.*?)\*/;
                const flexibleRegex = utils.getFlexibleRegex(word.word);
                return placeholderRegex.test(firstLine) || flexibleRegex.test(firstLine);
            });
        }
        if (candidates.length === 0) return null;
        utils.shuffleArray(candidates);
        const usableAllWordsForChoices = allWords.length >= 4 ? allWords : [...allWords, {word: 'dummy1', meaning: '오답1'}, {word: 'dummy2', meaning: '오답2'}, {word: 'dummy3', meaning: '오답3'}];
        // 미리 준비는 한 문제면 되므로 영영도 첫 5개만 시도한다.
        return this._makeQuizFromCandidates(quizType, candidates, usableAllWordsForChoices, { exhaustive: false });
    },
    _parsePosTokens(pos) {
        if (typeof pos !== 'string') return [];
        return [...new Set(
            pos.toLowerCase()
                .replace(/\./g, '')
                .split(/[\s,;/|]+/)
                .map(token => token.trim())
                .filter(Boolean)
        )];
    },
    _rankDistractorCandidatesByPos(correctWordData, allWordsData) {
        const correctPos = new Set(this._parsePosTokens(correctWordData.pos));
        const tiers = [[], [], [], []];

        allWordsData
            .filter(candidate => candidate.word !== correctWordData.word)
            .forEach(candidate => {
                const candidatePos = new Set(this._parsePosTokens(candidate.pos));
                const containsAllCorrectPos = correctPos.size > 0 &&
                    [...correctPos].every(pos => candidatePos.has(pos));
                const hasMatchingPos = correctPos.size > 0 &&
                    [...correctPos].some(pos => candidatePos.has(pos));

                if (containsAllCorrectPos && candidatePos.size === correctPos.size) {
                    // 1순위: POS 집합이 정확히 일치
                    tiers[0].push(candidate);
                } else if (containsAllCorrectPos && candidatePos.size > correctPos.size) {
                    // 2순위: 정답 POS를 모두 포함하면서 더 많은 POS를 보유
                    tiers[1].push(candidate);
                } else if (hasMatchingPos) {
                    // 3순위: 정답 POS와 하나 이상 일치
                    tiers[2].push(candidate);
                } else {
                    // 4순위: POS가 일치하지 않거나 POS 정보가 없음
                    tiers[3].push(candidate);
                }
            });

        tiers.forEach(tier => utils.shuffleArray(tier));
        return tiers.flat();
    },
    _selectDistractorsByPos(correctWordData, allWordsData, choiceField, choiceSelector = null) {
        const readChoice = choiceSelector || ((wordData) => wordData[choiceField]);
        const correctChoice = readChoice(correctWordData);
        if (!correctChoice || !String(correctChoice).trim()) return [];

        const wrongAnswers = new Set();
        const rankedCandidates = this._rankDistractorCandidatesByPos(correctWordData, allWordsData);

        for (const candidate of rankedCandidates) {
            const choice = readChoice(candidate);
            if (!choice || !String(choice).trim() || choice === correctChoice || wrongAnswers.has(choice)) continue;
            wrongAnswers.add(choice);
            if (wrongAnswers.size === 3) break;
        }

        return [...wrongAnswers];
    },
    createMeaningQuiz(correctWordData, allWordsData) {
        const getFirstMeaningLine = (wordData) => this._getFirstMeaningLine(wordData.meaning);
        const correctMeaning = getFirstMeaningLine(correctWordData);
        if (!correctMeaning) return null;

        const wrongAnswers = this._selectDistractorsByPos(
            correctWordData,
            allWordsData,
            'meaning',
            getFirstMeaningLine
        );
        if (wrongAnswers.length < 3) return null;

        const choices = [correctMeaning, ...wrongAnswers];
        utils.shuffleArray(choices);
        return {
            type: 'MULTIPLE_CHOICE_MEANING',
            question: { word: correctWordData.word },
            choices,
            answer: correctMeaning
        };
    },
    // 원본 meaning은 유지하고 영한 퀴즈 보기에서만 첫 줄의 일반 텍스트를 사용한다.
    _getFirstMeaningLine(meaning) {
        const plainText = String(meaning ?? '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(?:div|p)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&amp;/gi, '&')
            .replace(/\u00a0/g, ' ');
        const firstLine = (plainText.split(/\r\n?|\n/, 1)[0] || '').trim();
        return firstLine.replace(/[,;:，；：]+\s*$/, '').trimEnd();
    },
    createBlankQuiz(correctWordData, allWordsData) {
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null;
        const firstLineSentence = correctWordData.sample.split('\n')[0];
        let sentenceWithBlank = "";
        const placeholderRegex = /\*(.*?)\*/;
        const wordRegex = utils.getFlexibleRegex(correctWordData.word);
        
        const match = firstLineSentence.match(placeholderRegex);
        if (match) {
            sentenceWithBlank = firstLineSentence.replace(placeholderRegex, "＿＿＿＿").trim();
        } else if (firstLineSentence.match(wordRegex)) {
            sentenceWithBlank = firstLineSentence.replace(wordRegex, "＿＿＿＿").trim();
        } else {
            return null;
        }
        const wrongAnswers = this._selectDistractorsByPos(correctWordData, allWordsData, 'word');
        if (wrongAnswers.length < 3) return null;
        const choices = [correctWordData.word, ...wrongAnswers];
        utils.shuffleArray(choices);
        return { type: 'FILL_IN_THE_BLANK', question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    createDefinitionQuiz(correctWordData, allWordsData, definition) {
        if (!definition) return null;
        const wrongAnswers = this._selectDistractorsByPos(correctWordData, allWordsData, 'word');
        if (wrongAnswers.length < 3) return null;
        const choices = [correctWordData.word, ...wrongAnswers];
        utils.shuffleArray(choices);
        return { type: 'MULTIPLE_CHOICE_DEFINITION', question: { definition, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    showLoader(isLoading, message = "퀴즈 데이터를 불러오는 중...") {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.loaderText.textContent = message;
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
