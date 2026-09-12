// 단어 상태, 즐겨찾기, 로컬 진도 및 공통 유틸리티
const IRREGULAR_VERBS = {
    "arise": ["arose", "arisen"], "bear": ["bore", "born"], "beat": ["beat", "beaten"],
    "begin": ["began", "begun"], "bend": ["bent", "bent"], "bind": ["bound", "bound"],
    "bite": ["bit", "bitten"], "bleed": ["bled", "bled"], "blow": ["blew", "blown"],
    "break": ["broke", "broken"], "bring": ["brought", "brought"], "build": ["built", "built"],
    "burn": ["burned", "burnt"], "buy": ["bought", "bought"], "cast": ["cast", "cast"],
    "catch": ["caught", "caught"], "choose": ["chose", "chosen"], "cling": ["clung", "clung"],
    "come": ["came", "come"], "cost": ["cost", "cost"], "creep": ["crept", "crept"],
    "cut": ["cut", "cut"], "deal": ["dealt", "dealt"], "die": ["died", "died"],
    "dig": ["dug", "dug"], "do": ["did", "done"], "draw": ["drew", "drawn"],
    "drink": ["drank", "drunk"], "drive": ["drove", "driven"], "dwell": ["dwelt", "dwelt"],
    "dye": ["dyed", "dyed"], "eat": ["ate", "eaten"], "fall": ["fell", "fallen"],
    "feed": ["fed", "fed"], "feel": ["felt", "felt"], "fight": ["fought", "fought"],
    "find": ["found", "found"], "flee": ["fled", "fled"], "fling": ["flung", "flung"],
    "fly": ["flew", "flown"], "forget": ["forgot", "forgotten"], "freeze": ["froze", "frozen"],
    "get": ["got", "got"], "give": ["gave", "given"], "go": ["went", "gone"],
    "grind": ["ground", "ground"], "grow": ["grew", "grown"], "hang": ["hung", "hung"],
    "have": ["had", "had"], "hear": ["heard", "heard"], "hide": ["hid", "hidden"],
    "hit": ["hit", "hit"], "hold": ["held", "held"], "hurt": ["hurt", "hurt"],
    "keep": ["kept", "kept"], "kneel": ["knelt", "knelt"], "know": ["knew", "known"],
    "lay": ["laid", "laid"], "lead": ["led", "led"], "leave": ["left", "left"],
    "lend": ["lent", "lent"], "let": ["let", "let"], "lie": ["lay", "lain"],
    "light": ["lit", "lit"], "lose": ["lost", "lost"], "make": ["made", "made"],
    "mean": ["meant", "meant"], "meet": ["met", "met"], "pay": ["paid", "paid"],
    "prove": ["proved", "proven"], "put": ["put", "put"], "quit": ["quit", "quit"],
    "read": ["read", "read"], "rend": ["rent", "rent"], "rid": ["rid", "rid"],
    "ride": ["rode", "ridden"], "ring": ["rang", "rung"], "rise": ["rose", "risen"],
    "run": ["ran", "run"], "say": ["said", "said"], "see": ["saw", "seen"],
    "seek": ["sought", "sought"], "sell": ["sold", "sold"], "send": ["sent", "sent"],
    "set": ["set", "set"], "shake": ["shook", "shaken"], "shed": ["shed", "shed"],
    "shine": ["shone", "shone"], "shoot": ["shot", "shot"], "show": ["showed", "shown"],
    "shrink": ["shrunk", "shrunk"], "shut": ["shut", "shut"], "sing": ["sang", "sung"],
    "sink": ["sank", "sunk"], "sit": ["sat", "sat"], "slay": ["slew", "slain"],
    "sleep": ["slept", "slept"], "slide": ["slid", "slid"], "speak": ["spoke", "spoken"],
    "spend": ["spent", "spent"], "spill": ["spilt", "spilt"], "spit": ["spit", "spit"],
    "split": ["split", "split"], "spread": ["spread", "spread"], "spring": ["sprang", "sprung"],
    "stand": ["stood", "stood"], "steal": ["stole", "stolen"], "stick": ["stuck", "stuck"],
    "sting": ["stung", "stung"], "strike": ["struck", "struck"], "sweep": ["swept", "swept"],
    "swim": ["swam", "swum"], "swing": ["swung", "swung"], "take": ["took", "taken"],
    "teach": ["taught", "taught"], "tear": ["tore", "torn"], "tell": ["told", "told"],
    "think": ["thought", "thought"], "throw": ["threw", "thrown"], "thrust": ["thrust", "thrust"],
    "wake": ["woke", "woken"], "wear": ["wore", "worn"], "weep": ["wept", "wept"],
    "win": ["won", "won"], "wind": ["wound", "wound"], "write": ["wrote", "written"]
};

const utils = {
    // 복수형, 과거형, 진행형, 불규칙형을 함께 찾는다.
    getFlexibleRegex(word) {
        if (!word) return new RegExp("match_nothing_$^");
        
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = [escaped]; 
        const lowerWord = word.toLowerCase();

        // 1. 불규칙 동사 추가
        if (IRREGULAR_VERBS[lowerWord]) {
            IRREGULAR_VERBS[lowerWord].forEach(form => parts.push(form));
        }

        // 2. 규칙 변화 (s, es, d, ed, ing) - 명사 복수형 및 동사 변화 포함
        parts.push(`${escaped}(?:s|es|d|ed|ing)`);

        // 3. 자음+y -> ies/ied (study -> studies, studied)
        if (word.length > 2 && lowerWord.endsWith('y')) {
            const base = escaped.slice(0, -1);
            parts.push(`${base}(?:ies|ied)`);
        }

        // 4. f/fe -> ves (leaf -> leaves, knife -> knives)
        if (word.length > 2 && lowerWord.endsWith('f')) {
            parts.push(`${escaped.slice(0, -1)}ves`);
        }
        if (word.length > 3 && lowerWord.endsWith('fe')) {
            parts.push(`${escaped.slice(0, -2)}ves`);
        }

        // 5. e로 끝나는 경우 (make -> making)
        if (word.length > 2 && lowerWord.endsWith('e')) {
            const base = escaped.slice(0, -1);
            parts.push(`${base}(?:ing|d)`);
        }

        // 6. 자음 하나 더 추가 (run -> running)
        const lastChar = escaped.slice(-1);
        if (/[a-zA-Z]/.test(lastChar)) {
             parts.push(`${escaped}${lastChar}(?:ing|ed)`);
        }

        return new RegExp(`\\b(?:${parts.join('|')})\\b`, 'i');
    },

    _getProgressRef(grade = app.state.selectedSheet) {
        if (!app.state.user || !grade) return null;
        return doc(db, 'users', app.state.user.uid, 'progress', grade);
    },
    _unsyncedProgressCache: new Map(),
    getUnsyncedProgress(grade = app.state.selectedSheet) {
        if (!grade) return {};

        try {
            const localKey = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
            const raw = localStorage.getItem(localKey) || '';
            const cached = this._unsyncedProgressCache.get(grade);
            if (cached?.raw === raw) return cached.value;

            const parsed = JSON.parse(raw || '{}');
            const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            this._unsyncedProgressCache.set(grade, { raw, value });
            return value;
        } catch (error) {
            console.warn('로컬 단어 상태를 읽지 못했습니다.', error);
            return {};
        }
    },
    _writeUnsyncedProgress(grade, value) {
        const localKey = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
        const hasUpdates = Object.keys(value).length > 0;
        const raw = hasUpdates ? JSON.stringify(value) : '';

        if (hasUpdates) {
            localStorage.setItem(localKey, raw);
        } else {
            localStorage.removeItem(localKey);
        }
        this._unsyncedProgressCache.set(grade, { raw, value });
    },
    addProgressUpdateToLocalSync(word, key, value, grade = app.state.selectedSheet) {
        if (!grade) return;
        try {
            this.withStorageRecovery(() => {
                const previous = this.getUnsyncedProgress(grade);
                const unsynced = {
                    ...previous,
                    [word]: {
                        ...(previous[word] || {}),
                        [key]: value
                    }
                };
                this._writeUnsyncedProgress(grade, unsynced);
            });
        } catch (e) {
            console.error("Error adding progress update to localStorage sync", e);
        }
    },
    async loadUserProgress() {
        const currentGrade = app.state.selectedSheet;
        if (!currentGrade) {
            app.state.currentProgress = {};
            return;
        }
        const docRef = this._getProgressRef(currentGrade);
        if (!docRef) {
            app.state.currentProgress = {};
            return;
        }
        try {
            const docSnap = await getDoc(docRef);
            app.state.currentProgress = docSnap.exists() ? docSnap.data() : {};
        } catch (error) {
            console.error(`Error loading progress for grade ${currentGrade}:`, error);
            app.state.currentProgress = {};
        }
    },
    getWordStatus(word) {
        const progress = this.getCombinedProgress(word);
        const quizTypes = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION'];
        const statuses = quizTypes.map(type => progress[type] || 'unseen');
        if (Object.keys(progress).length === 0) return 'unseen';
        if (statuses.includes('incorrect')) return 'review';
        if (statuses.every(s => s === 'correct')) return 'learned';
        if (statuses.some(s => s === 'correct')) return 'learning';
        return 'unseen';
    },
    getCombinedProgress(word, grade = app.state.selectedSheet) {
        const localStatus = this.getUnsyncedProgress(grade)[word] || {};
        return {
            ...(app.state.currentProgress[word] || {}),
            ...localStatus
        };
    },
    getIncorrectQuizTypes(word, grade = app.state.selectedSheet) {
        const progress = this.getCombinedProgress(word, grade);
        return ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION']
            .filter(type => progress[type] === 'incorrect');
    },
    getMistakeReviewItems() {
        const grade = app.state.selectedSheet;
        const words = learningMode.state.wordList[grade] || [];
        return words.flatMap(wordObj =>
            this.getIncorrectQuizTypes(wordObj.word, grade)
                .map(quizType => ({ word: wordObj.word, quizType }))
        );
    },
    async updateWordStatus(word, quizType, result) {
        const grade = app.state.selectedSheet;
        if (!word || !quizType || !app.state.user || !grade) return;
        const isCorrect = result === 'correct';
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word][quizType] = result;
        this.addProgressUpdateToLocalSync(word, quizType, result, grade);
        this.saveQuizHistoryToLocal(quizType, isCorrect, grade);
    },
    getCorrectlyAnsweredWords(quizType, grade = app.state.selectedSheet) {
        if (!quizType || !grade) return [];
        const localUpdates = this.getUnsyncedProgress(grade);
        const allProgress = app.state.currentProgress;
        const combinedKeys = new Set([...Object.keys(allProgress), ...Object.keys(localUpdates)]);
        const correctWords = [];
        combinedKeys.forEach(word => {
            const serverState = allProgress[word]?.[quizType];
            const localState = localUpdates[word]?.[quizType];
            const finalStatus = localState !== undefined ? localState : serverState;
            if (finalStatus === 'correct') {
                correctWords.push(word);
            }
        });
        return correctWords;
    },
    getIncorrectWords() {
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return [];
        const allWords = learningMode.state.wordList[grade];
        return allWords
            .filter(wordObj => this.getWordStatus(wordObj.word) === 'review')
            .map(wordObj => wordObj.word);
    },
    async toggleFavorite(word) {
        const grade = app.state.selectedSheet;
        if (!word || !app.state.user || !grade) return false;
        const isCurrentlyFavorite = this.getCombinedProgress(word, grade).favorite || false;
        const newFavoriteStatus = !isCurrentlyFavorite;
        const favoritedAt = newFavoriteStatus ? Date.now() : 0;
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word].favorite = newFavoriteStatus;
        app.state.currentProgress[word].favoritedAt = favoritedAt;
        this.addProgressUpdateToLocalSync(word, 'favorite', newFavoriteStatus, grade);
        this.addProgressUpdateToLocalSync(word, 'favoritedAt', favoritedAt, grade);
        return newFavoriteStatus;
    },
    getFavoriteWords() {
        const grade = app.state.selectedSheet;
        const localUpdates = this.getUnsyncedProgress(grade);
        const allProgress = app.state.currentProgress;
        const combinedKeys = new Set([...Object.keys(allProgress), ...Object.keys(localUpdates)]);
        const favoriteWords = [];
        combinedKeys.forEach(word => {
            const serverState = allProgress[word] || {};
            const localState = localUpdates[word] || {};
            const combinedState = {
                ...serverState,
                favorite: localState.favorite !== undefined ? localState.favorite : serverState.favorite,
                favoritedAt: localState.favoritedAt !== undefined ? localState.favoritedAt : serverState.favoritedAt
            };
            if (combinedState.favorite === true) {
                favoriteWords.push({ word, time: Number(combinedState.favoritedAt || 0) });
            }
        });
        return favoriteWords.sort((a, b) => b.time - a.time).map(item => item.word);
    },
    async saveStudyHistory(studyByDate, grade) {
        if (!app.state.user || !studyByDate || Object.keys(studyByDate).length === 0 || !grade) return;
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'study');
        try {
            const payload = {};
            Object.entries(studyByDate).forEach(([date, seconds]) => {
                const amount = Math.max(0, Math.floor(Number(seconds) || 0));
                if (amount > 0) payload[date] = { [grade]: increment(amount) };
            });
            if (Object.keys(payload).length > 0) {
                await setDoc(historyRef, payload, { merge: true });
            }
        } catch (e) {
            console.error("Failed to update study history:", e);
            throw e;
        }
    },
    
    saveQuizHistoryToLocal(quizType, isCorrect, grade) {
        if (!grade || !quizType) return;
        try {
            this.withStorageRecovery(() => vocaStatsStore.addQuizResult(
                grade,
                vocaStatsStore.getLocalDateString(),
                quizType,
                isCorrect
            ));
        } catch (e) {
            console.error("Error saving quiz stats to localStorage", e);
        }
    },
    async syncQuizHistory(statsByDate, grade) {
        if (!app.state.user || !statsByDate || Object.keys(statsByDate).length === 0 || !grade) return;
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'quiz');
        try {
            const payload = {};
            Object.entries(statsByDate).forEach(([date, daily]) => {
                const gradeData = {};
                Object.entries(daily || {}).forEach(([type, stats]) => {
                    const total = Math.max(0, Number(stats.total || 0));
                    const correct = Math.max(0, Number(stats.correct || 0));
                    if (total > 0) {
                        gradeData[type] = {
                            total: increment(total),
                            correct: increment(correct)
                        };
                    }
                });
                if (Object.keys(gradeData).length > 0) payload[date] = { [grade]: gradeData };
            });
            if (Object.keys(payload).length > 0) {
                await setDoc(historyRef, payload, { merge: true });
            }
        } catch (e) {
            console.error("Failed to sync quiz history:", e);
            throw e;
        }
    },
    async syncProgressUpdates(progressToSync, grade) {
         if (!app.state.user || !progressToSync || Object.keys(progressToSync).length === 0 || !grade) return;
         const progressRef = this._getProgressRef(grade);
         if (!progressRef) return;
         try {
             // progress 문서가 존재하지 않으면 setDoc으로 생성, 존재하면 updateDoc과 동일하게 작동
             await setDoc(progressRef, progressToSync, { merge: true }); 
         } catch (error) {
             console.error("Firebase progress sync (setDoc merge) failed:", error);
             throw error;
         }
     },
    isQuotaError(error) {
        return Boolean(error) && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || error.code === 22 || error.code === 1014);
    },
    _removeWordListCache(grade) {
        const keys = app.state.LOCAL_STORAGE_KEYS;
        [keys.WORD_LIST_CACHE(grade), keys.CACHE_TIMESTAMP(grade), keys.CACHE_VERSION(grade)]
            .forEach(key => localStorage.removeItem(key));
    },
    // 저장 공간이 차서 쓰기가 실패하면 다시 받을 수 있는 단어장 캐시를 비우고 한 번 더 쓴다.
    // 학습 기록은 다시 만들 수 없으니 캐시를 먼저 비운다. 지금 학년 단어장은 이미 화면에 올라와 있어 맨 나중에 비운다.
    withStorageRecovery(write) {
        try {
            return write();
        } catch (error) {
            if (!this.isQuotaError(error)) throw error;
            let lastError = error;
            const current = app.state.selectedSheet;
            const grades = ['1y', '2y', '3y'];
            for (const batch of [grades.filter(grade => grade !== current), grades.filter(grade => grade === current)]) {
                if (batch.length === 0) continue;
                batch.forEach(grade => this._removeWordListCache(grade));
                try {
                    const result = write();
                    console.warn(`저장 공간이 부족해 단어장 캐시(${batch.join(', ')})를 비우고 저장했습니다.`);
                    return result;
                } catch (retryError) {
                    if (!this.isQuotaError(retryError)) throw retryError;
                    lastError = retryError;
                }
            }
            throw lastError;
        }
    },
    // 시트 Part 열로 나눈 구간을 시트에 적힌 순서대로 돌려준다. start·end는 어휘카드 번호(1부터)다.
    getParts(grade = app.state.selectedSheet) {
        const words = learningMode.state.wordList[grade] || [];
        const parts = new Map();
        words.forEach((wordObj, index) => {
            const name = this.getPartName(wordObj);
            if (!name) return;
            if (!parts.has(name)) {
                parts.set(name, {
                    name,
                    order: Number(wordObj.partOrder) || Infinity,
                    start: index + 1,
                    end: index + 1,
                    count: 0
                });
            }
            const part = parts.get(name);
            part.end = index + 1;
            part.count++;
        });
        // partOrder가 없는 예전 데이터는 목록에 처음 나온 순서를 따른다.
        return [...parts.values()].sort((a, b) => (a.order - b.order) || (a.start - b.start));
    },
    getPartName(wordObj) {
        return String(wordObj?.part ?? '').trim();
    },
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};
