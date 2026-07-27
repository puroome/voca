// 앱 초기화, 화면 이동, 활동 시간 및 동기화 흐름
const activityTracker = {
    sessionSecondsByDate: {},
    partialMilliseconds: 0,
    lastActivityTimestamp: 0,
    lastCountTimestamp: 0,
    activeGrade: '',
    timerInterval: null,
    saveInterval: null,
    INACTIVITY_LIMIT: 120000,

    _recordElapsed(now = Date.now()) {
        if (!this.lastCountTimestamp) {
            this.lastCountTimestamp = now;
            return;
        }
        if (document.hidden) {
            this.lastCountTimestamp = now;
            return;
        }
        const activeUntil = Math.min(now, this.lastActivityTimestamp + this.INACTIVITY_LIMIT);
        const elapsed = Math.max(0, activeUntil - this.lastCountTimestamp);
        this.partialMilliseconds += elapsed;
        const wholeSeconds = Math.floor(this.partialMilliseconds / 1000);
        if (wholeSeconds > 0) {
            const date = vocaStatsStore.getLocalDateString();
            this.sessionSecondsByDate[date] =
                Number(this.sessionSecondsByDate[date] || 0) + wholeSeconds;
            this.partialMilliseconds -= wholeSeconds * 1000;
        }
        this.lastCountTimestamp = now;
    },

    _flushSessionTime() {
        if (!this.activeGrade) return;
        try {
            Object.entries(this.sessionSecondsByDate).forEach(([date, seconds]) => {
                vocaStatsStore.addStudySeconds(this.activeGrade, date, seconds);
            });
            this.sessionSecondsByDate = {};
        } catch (error) {
            console.error("Error saving study time to localStorage", error);
        }
    },

    start() {
        if (this.timerInterval) return;
        const now = Date.now();
        this.activeGrade = app.state.selectedSheet;
        this.lastActivityTimestamp = now;
        this.lastCountTimestamp = now;
        this.partialMilliseconds = 0;
        this.sessionSecondsByDate = {};
        this.timerInterval = setInterval(() => this._recordElapsed(), 1000);
        this.saveInterval = setInterval(() => {
            this._recordElapsed();
            this._flushSessionTime();
        }, 10000);
        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.addEventListener(event, this.recordActivity, true));
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    },
    stopAndSave() {
        if (!this.timerInterval) return;
        this._recordElapsed();
        clearInterval(this.timerInterval);
        clearInterval(this.saveInterval);
        this.timerInterval = null;
        this.saveInterval = null;
        this._flushSessionTime();
        this.partialMilliseconds = 0;
        this.activeGrade = '';
        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.removeEventListener(event, this.recordActivity, true));
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    },
    recordActivity() {
        activityTracker._recordElapsed();
        activityTracker.lastActivityTimestamp = Date.now();
    },
    handleVisibilityChange() {
        const now = Date.now();
        activityTracker._recordElapsed(now);
        if (!document.hidden) activityTracker.lastActivityTimestamp = now;
        activityTracker.lastCountTimestamp = now;
    }
};

const app = {
    config: {
        firebaseConfig: {
            apiKey: "AIzaSyBE_Gxd1haPazVK61F9sjCwK0X4Gw5rERM",
            authDomain: "wordapp-91c0a.firebaseapp.com",
            projectId: "wordapp-91c0a",
            storageBucket: "wordapp-91c0a.firebasestorage.app",
            messagingSenderId: "213863780677",
            appId: "1:213863780677:web:78d6b8755866a0c5ddee2c",
            databaseURL: "https://wordapp-91c0a-default-rtdb.asia-southeast1.firebasedatabase.app/"
        },
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzjtB_Mh6TlEGwd_UzBe-gwOJ6-LxViJuFl1C-4U_4qhOb2cZGL-MRQ1nP39c3ibF4/exec",
        MERRIAM_WEBSTER_API_KEY: "",
        sheetLinks: {
            '1y': 'https://docs.google.com/spreadsheets/d/1r7fWUV1ea9CU-s2iSOwLKexEe2_7L8oUKhK0n1DpDUM/edit?usp=sharing',
            '2y': 'https://docs.google.com/spreadsheets/d/1Xydj0im3Cqq9JhjN8IezZ-7DBp1-DV703cCIb3ORdc8/edit?usp=sharing',
            '3y': 'https://docs.google.com/spreadsheets/d/1Z_n9IshFSC5cBBW6IkZNfQsLb2BBrp9QeOlsGsCkn2Y/edit?usp=sharing'
        },
        backgroundImages: [],
        adminEmail: ['puroome@gmail.com', 'puroome82@gmail.com']
    },
    state: {
        user: null,
        canEdit: false,
        currentProgress: {},
        selectedSheet: '',
        isAppReady: false,
        translateDebounceTimeout: null,
        longPressTimer: null,
        lastCacheTimestamp: { '1y': null, '2y': null, '3y': null },
        audioContext: null,
        LOCAL_STORAGE_KEYS: {
            LAST_GRADE: 'student_lastGrade',
            PRACTICE_MODE: 'student_practiceMode',
            LAST_INDEX: (grade) => `student_lastIndex_${grade}`,
            UNSYNCED_PROGRESS_UPDATES: (grade) => `student_unsyncedProgress_${grade}`,
            CACHE_TIMESTAMP: (grade) => `wordListCacheTimestamp_${grade}`,
            CACHE_VERSION: (grade) => `wordListVersion_${grade}`,
            QUIZ_RANGE_START: (grade) => `student_quizRangeStart_${grade}`,
            QUIZ_RANGE_END: (grade) => `student_quizRangeEnd_${grade}`
        }
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
        progressBarContainer: document.getElementById('progress-bar-container'),
        selectFavoritesBtn: document.getElementById('select-favorites-btn'),
        todaySummary: document.getElementById('today-summary'),
        mistakeModeModal: document.getElementById('mistake-mode-modal'),
        mistakeModeCount: document.getElementById('mistake-mode-count'),
        mistakeVocabBtn: document.getElementById('mistake-vocab-btn'),
        mistakeQuizBtn: document.getElementById('mistake-quiz-btn'),
        mistakeModeCancelBtn: document.getElementById('mistake-mode-cancel-btn'),
        lastUpdatedText: document.getElementById('last-updated-text'),
        permissionRequestModal: document.getElementById('permission-request-modal'),
        prNameInput: document.getElementById('pr-name-input'),
        prGradeInput: document.getElementById('pr-grade-input'),
        prSubmitBtn: document.getElementById('pr-submit-btn'),
        permissionStatusModal: document.getElementById('permission-status-modal'),
        psTitle: document.getElementById('ps-title'),
        psMessage: document.getElementById('ps-message'),
        psCloseBtn: document.getElementById('ps-close-btn'),
        prLogoutBtn: document.getElementById('pr-logout-btn'),
      },
    async init() {
        firebaseApp = initializeApp(this.config.firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        rt_db = getDatabase(firebaseApp);

        // [보안 수정] 1. 앱 초기화 시 보안 키값을 먼저 불러옵니다.
        await this.loadSecureKeys();

        await Promise.all([
            translationDBCache.init(),
            audioDBCache.init(),
            this.fetchAndSetBackgroundImages()
        ]).catch(e => console.error("Cache or image init failed", e));
        this.bindGlobalEvents();
        quizMode.init();
        learningMode.init();
        dashboard.init();
        try {
            const savedPracticeMode = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.PRACTICE_MODE);
            if (savedPracticeMode === 'true') {
                quizMode.state.isPracticeMode = true;
                this.elements.practiceModeCheckbox.checked = true;
            }
        } catch (e) {
            console.error("Error reading practice mode from localStorage", e);
        }
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                await this.handlePermissionFlow(user);
            } else {
                this.state.user = null;
                this.state.canEdit = false;
                this.state.currentProgress = {};
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.mainContainer.classList.add('hidden');
                document.body.classList.add('items-center');
                this._renderView(null);
            }
        });
    },
    // [보안 수정] 2. Firebase RTDB에서 보안 키를 불러오는 함수 추가
    async loadSecureKeys() {
        try {
            // DB 경로: 'secure_config' (1단계에서 만든 경로와 일치해야 함)
            const configRef = ref(rt_db, 'secure_config');
            const snapshot = await get(configRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // 앱 설정(config)에 키 주입
                this.config.MERRIAM_WEBSTER_API_KEY = data.merriam_webster_key || "";
                this.config.SCRIPT_URL = data.script_url || "";
                console.log("보안 설정을 성공적으로 불러왔습니다.");
            } else {
                console.warn("보안 설정 데이터(secure_config)가 DB에 없습니다. 기능이 제한될 수 있습니다.");
            }
        } catch (error) {
            console.error("보안 설정을 불러오는 중 오류 발생:", error);
        }
    },
    async handlePermissionFlow(user) {
        this.elements.loginScreen.classList.add('hidden');
        this.elements.mainContainer.classList.add('hidden');
        document.body.classList.add('items-center');
        const userRef = doc(db, 'users', user.uid);
        
        await setDoc(userRef, { displayName: user.displayName, email: user.email }, { merge: true });

        try {
            const { status, canEdit } = await api.checkPermission(user.email); 
            
            const userDoc = await getDoc(userRef);
            const isRequested = userDoc.exists() && userDoc.data().permissionRequested === true;

            if (status === 'approved') {
                this.state.user = user;
                this.state.canEdit = canEdit;
                
                this.elements.mainContainer.classList.remove('hidden');
                document.body.classList.remove('items-center');
                await utils.loadUserProgress();
                await this.syncOfflineData();
                if (!this.state.isAppReady) {
                    this.state.isAppReady = true;
                    await quizMode.preloadInitialQuizzesBasedOnSavedRange();
                }
                const hash = window.location.hash.substring(1);
                const [view, gradeFromHash] = hash.split('-');
                let initialState = { view: 'grade' };
                try {
                    const lastGrade = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.LAST_GRADE);
                    if (gradeFromHash && ['1y', '2y', '3y'].includes(gradeFromHash)) {
                        if (['mode', 'quiz', 'learning', 'dashboard', 'mistakeReview', 'favoriteReview'].includes(view)) {
                            initialState = { view: view, grade: gradeFromHash };
                        }
                    } else if (['1y', '2y', '3y'].includes(view)) {
                         initialState = { view: 'mode', grade: view };
                    } else if (lastGrade && ['1y', '2y', '3y'].includes(lastGrade)) {
                        initialState = { view: 'mode', grade: lastGrade };
                    }
                } catch(e) {
                    console.error("Error reading last grade from localStorage", e);
                    initialState = { view: 'grade' };
                }
                history.replaceState(initialState, '');
                this._renderView(initialState.view, initialState.grade);
            } else if (status === 'denied') {
                this.showStatusModal(
                    '접근 제한', 
                    '관리자에 의해 앱 접근이 제한되었습니다.', 
                    'text-red-500',
                    () => signOut(auth)
                );
            } else if (status === 'pending') { 
                this.showStatusModal(
                    '확인 중', 
                    '관리자가 확인 중이니 기다려주세요.', 
                    'text-blue-500',
                    () => signOut(auth)
                );
            } else { // 'not_found'
                this.state.user = user;
                
                if (isRequested) {
                    this.showStatusModal(
                        '확인 중', 
                        '관리자가 확인 중이니 기다려주세요.', 
                        'text-blue-500',
                        () => signOut(auth)
                    );
                } else {
                    this.showRequestModal();
                }
            }
        } catch (error) {
            console.error("Permission Check Error:", error);
            this.showToast("권한 확인 중 오류가 발생했습니다. 다시 시도해 주세요.", true);
            signOut(auth);
        }
    },
    async submitPermissionRequest() {
        if (!this.state.user) return;
        const name = this.elements.prNameInput.value.trim();
        const gradeStr = this.elements.prGradeInput.value.trim();
        const gradeNum = parseInt(gradeStr);
        if (!name) {
            this.elements.prNameInput.focus();
            return;
        }
        if (isNaN(gradeNum) || ![1, 2, 3].includes(gradeNum)) {
            this.elements.prGradeInput.focus();
            return;
        }

        const gradeWithSuffix = gradeNum + 'y'; 
        
        this.elements.prSubmitBtn.disabled = true;
        this.elements.prSubmitBtn.textContent = '요청 중...';
        
        try {
            const result = await api.requestPermission(this.state.user.email, name, gradeWithSuffix);
            
            if (result.success) {
                await updateDoc(doc(db, 'users', this.state.user.uid), { permissionRequested: true });
            }

            this.elements.permissionRequestModal.classList.add('hidden');
            if (result.success) {
                this.showStatusModal(
                    '요청 완료',
                    '관리자에게 요청하였으니 기다려주세요.',
                    'text-blue-500',
                    () => signOut(auth)
                );
            } else {
                this.showToast(result.message || "권한 요청에 실패했습니다. 다시 시도해 주세요.", true);
                this.elements.prSubmitBtn.disabled = false;
                this.elements.prSubmitBtn.textContent = '권한 요청';
            }
        } catch (error) {
            console.error("Permission Request API Error:", error);
            this.elements.permissionRequestModal.classList.add('hidden');
            this.showToast("서버 오류로 인해 요청에 실패했습니다. 다시 시도해 주세요.", true);
            signOut(auth);
        }
    },
    showStatusModal(title, message, titleClass = 'text-green-500', onClose = null) {
        this.elements.psTitle.textContent = title;
        this.elements.psTitle.className = `text-2xl font-bold mb-4 ${titleClass}`;
        this.elements.psMessage.textContent = message;
        this.elements.permissionStatusModal.classList.remove('hidden');
        const closeHandler = () => {
             this.elements.permissionStatusModal.classList.add('hidden');
             this.elements.psCloseBtn.removeEventListener('click', closeHandler);
             if (onClose) onClose();
        };
        this.elements.psCloseBtn.addEventListener('click', closeHandler);
    },
    showRequestModal() {
        this.elements.prNameInput.value = ''; 
        this.elements.prGradeInput.value = '';
        this.elements.prSubmitBtn.disabled = false;
        this.elements.prSubmitBtn.textContent = '권한 요청';
        this.elements.permissionRequestModal.classList.remove('hidden');
    },
    async renderTodaySummary() {
        const grade = this.state.selectedSheet;
        if (!this.elements.todaySummary || !this.state.user || !grade) return;
        this.elements.todaySummary.textContent = '오늘의 학습 기록을 불러오는 중...';

        let remoteStudy = {};
        let remoteQuiz = {};
        try {
            const [studyDoc, quizDoc] = await Promise.all([
                getDoc(doc(db, 'users', this.state.user.uid, 'history', 'study')),
                getDoc(doc(db, 'users', this.state.user.uid, 'history', 'quiz'))
            ]);
            remoteStudy = studyDoc.exists() ? studyDoc.data() : {};
            remoteQuiz = quizDoc.exists() ? quizDoc.data() : {};
        } catch (error) {
            console.warn('오늘의 학습 요약 서버 기록을 불러오지 못했습니다.', error);
        }

        const studyHistory = vocaStatsStore.mergeStudyHistory(remoteStudy, grade);
        const quizHistory = vocaStatsStore.mergeQuizHistory(remoteQuiz, grade);
        const today = vocaStatsStore.getLocalDateString();
        const minutes = Math.floor(Number(studyHistory[today]?.[grade] || 0) / 60);
        const quizTotal = Object.values(quizHistory[today]?.[grade] || {})
            .reduce((sum, stats) => sum + Number(stats?.total || 0), 0);

        let streak = 0;
        const cursor = new Date();
        while (true) {
            const date = vocaStatsStore.getLocalDateString(cursor);
            const studied = Number(studyHistory[date]?.[grade] || 0) > 0;
            if (!studied && date === today) {
                cursor.setDate(cursor.getDate() - 1);
                continue;
            }
            if (!studied) break;
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        this.elements.todaySummary.textContent =
            `🔥 ${streak}일 연속 · 오늘 ${minutes}분 · 퀴즈 ${quizTotal}문제`;
    },
    async syncOfflineData() {
        if (!app.state.user) return;
        if (this._syncPromise) return this._syncPromise;

        this._syncPromise = (async () => {
            for (const grade of ['1y', '2y', '3y']) {
                const statsSnapshot = vocaStatsStore.snapshot(grade);
                const syncedSnapshot = { study: {}, quiz: {} };
                const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                let progressToSync = null;

                try {
                    progressToSync = JSON.parse(localStorage.getItem(progressKey) || 'null');
                } catch (error) {
                    console.warn(`로컬 진도 데이터가 손상되어 초기화합니다: ${grade}`, error);
                    localStorage.removeItem(progressKey);
                }

                try {
                    if (Object.keys(statsSnapshot.study).length > 0) {
                        await utils.saveStudyHistory(statsSnapshot.study, grade);
                        syncedSnapshot.study = statsSnapshot.study;
                    }
                } catch (error) {
                    console.error(`학습 시간 동기화 실패 (${grade}):`, error);
                }

                try {
                    if (Object.keys(statsSnapshot.quiz).length > 0) {
                        await utils.syncQuizHistory(statsSnapshot.quiz, grade);
                        syncedSnapshot.quiz = statsSnapshot.quiz;
                    }
                } catch (error) {
                    console.error(`퀴즈 기록 동기화 실패 (${grade}):`, error);
                }

                vocaStatsStore.subtractSnapshot(grade, syncedSnapshot);

                try {
                    if (progressToSync && Object.keys(progressToSync).length > 0) {
                        await utils.syncProgressUpdates(progressToSync, grade);
                        const current = JSON.parse(localStorage.getItem(progressKey) || '{}');
                        Object.entries(progressToSync).forEach(([word, fields]) => {
                            if (!current[word] || !fields || typeof fields !== 'object') return;
                            Object.entries(fields).forEach(([key, value]) => {
                                if (JSON.stringify(current[word][key]) === JSON.stringify(value)) {
                                    delete current[word][key];
                                }
                            });
                            if (Object.keys(current[word]).length === 0) delete current[word];
                        });
                        if (Object.keys(current).length === 0) localStorage.removeItem(progressKey);
                        else localStorage.setItem(progressKey, JSON.stringify(current));
                    }
                } catch (error) {
                    console.error(`진도 동기화 실패 (${grade}):`, error);
                }
            }
            await utils.loadUserProgress();
        })().finally(() => {
            this._syncPromise = null;
        });

        return this._syncPromise;
    },
    bindGlobalEvents() {
        this.elements.loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Google Sign-In Error:", error);
                this.showToast("로그인에 실패했습니다. 다시 시도해 주세요.", true);
            });
        });
        this.elements.logoutBtn.addEventListener('click', () => signOut(auth));
        document.querySelectorAll('.grade-select-card').forEach(card => {
            card.addEventListener('click', () => {
                const grade = card.dataset.sheet;
                try {
                    localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.LAST_GRADE, grade);
                } catch (e) {
                    console.error("Error saving last grade to localStorage", e);
                }
                this.navigateTo('mode', grade);
            });
        });
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz', this.state.selectedSheet));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning', this.state.selectedSheet));
        document.getElementById('select-dashboard-btn').addEventListener('click', () => this.navigateTo('dashboard', this.state.selectedSheet));
        document.getElementById('select-mistakes-btn').addEventListener('click', async () => {
            const grade = this.state.selectedSheet;
            if (!learningMode.state.isWordListReady[grade]) {
                await learningMode.loadWordList(false, grade);
            }
            const reviewItems = utils.getMistakeReviewItems();
            if (reviewItems.length === 0) {
                this.showToast('오답 노트에 단어가 없습니다.', true);
                return;
            }
            this._pendingMistakeItems = reviewItems;
            const wordCount = new Set(reviewItems.map(item => item.word)).size;
            this.elements.mistakeModeCount.textContent =
                `${wordCount}개 단어 · ${reviewItems.length}개 오답 유형`;
            this.elements.mistakeModeModal.classList.remove('hidden');
        });
        this.elements.mistakeVocabBtn.addEventListener('click', () => {
            const mistakeWords = [...new Set((this._pendingMistakeItems || []).map(item => item.word))];
            this.elements.mistakeModeModal.classList.add('hidden');
            this.navigateTo('mistakeReview', this.state.selectedSheet, { mistakeWords });
        });
        this.elements.mistakeQuizBtn.addEventListener('click', () => {
            const reviewItems = [...(this._pendingMistakeItems || [])];
            this.elements.mistakeModeModal.classList.add('hidden');
            this.navigateTo('quiz-play', this.state.selectedSheet, { reviewItems });
        });
        this.elements.mistakeModeCancelBtn.addEventListener('click', () =>
            this.elements.mistakeModeModal.classList.add('hidden')
        );
        this.elements.mistakeModeModal.addEventListener('click', event => {
            if (event.target === this.elements.mistakeModeModal) {
                this.elements.mistakeModeModal.classList.add('hidden');
            }
        });
        this.elements.selectFavoritesBtn.addEventListener('click', () => this.navigateTo('favoriteReview', this.state.selectedSheet));
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
            try {
                localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.PRACTICE_MODE, quizMode.state.isPracticeMode);
            } catch (err) {
                console.error("Error saving practice mode state:", err);
            }
            if (history.state?.view === 'quiz-play') {
                 quizMode.reset(false);
                 quizMode.displayNextQuiz();
            }
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
            this.syncOfflineData();
            const state = e.state || { view: 'grade' };
            this._renderView(state.view, state.grade, state.options || {});
        });
        window.addEventListener('beforeunload', () => {
            activityTracker.stopAndSave();
        });
        const initAudioForBeep = () => {
            if (!this.state.audioContext) {
                 try {
                     this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                 } catch (e) {
                     console.error("Web Audio API is not supported in this browser", e);
                 }
            }
            document.body.removeEventListener('click', initAudioForBeep, { capture: true });
            document.body.removeEventListener('touchstart', initAudioForBeep, { capture: true, passive: true });
        };
        document.body.addEventListener('click', initAudioForBeep, { capture: true, once: true });
        document.body.addEventListener('touchstart', initAudioForBeep, { capture: true, passive: true, once: true });
        this.elements.prSubmitBtn.addEventListener('click', () => this.submitPermissionRequest());
        this.elements.prGradeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitPermissionRequest();
        });
        this.elements.prLogoutBtn.addEventListener('click', () => { 
            this.elements.permissionRequestModal.classList.add('hidden');
            signOut(auth);
        });
    },
    navigateTo(view, grade, options = {}) {
        const currentState = history.state || {};
        if (currentState.view !== view || currentState.grade !== grade) {
            this.syncOfflineData();
        }
        if (currentState.view === view && currentState.grade === grade && view !== 'mistakeReview' && view !== 'favoriteReview') return;
        let hash = '';
        if (view !== 'grade' && view !== null) {
            hash = grade ? `#${grade}` : '';
            if (view !== 'mode') {
                hash = `#${view}-${grade}`;
            }
        }
        history.pushState({ view, grade, options }, '', window.location.pathname + window.location.search + hash);
        this._renderView(view, grade, options);
    },
    async _renderView(view, grade, options = {}) {
        activityTracker.stopAndSave();
        this.elements.gradeSelectionScreen.classList.add('hidden');
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.dashboardContainer.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');
        this.elements.progressBarContainer.classList.add('hidden');
        this.elements.homeBtn.classList.add('hidden');
        this.elements.backToGradeSelectionBtn.classList.add('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.practiceModeControl.classList.add('hidden');
        this.elements.sheetLink.classList.add('hidden');
        this.elements.logoutBtn.classList.add('hidden');
        this.elements.lastUpdatedText.classList.add('hidden');
        this.elements.permissionRequestModal.classList.add('hidden');
        this.elements.permissionStatusModal.classList.add('hidden');
        this.elements.mistakeModeModal.classList.add('hidden');
        if (!this.state.user) return;
        this.elements.logoutBtn.classList.remove('hidden');
        if (grade) {
            const needsProgressLoad = this.state.selectedSheet !== grade;
            this.state.selectedSheet = grade;
            if (needsProgressLoad) await utils.loadUserProgress();
            
            if (this.state.canEdit) {
                this.elements.sheetLink.href = this.config.sheetLinks[grade];
                this.elements.sheetLink.classList.remove('hidden');
            } else {
                this.elements.sheetLink.classList.add('hidden');
            }

            const gradeText = grade.replace('y', '학년');
            this.elements.selectionTitle.textContent = `${gradeText} 어휘`;
            this.updateLastUpdatedText();
        } else {
            this.state.selectedSheet = '';
            this.state.currentProgress = {};
        }
        const startModes = ['quiz-play', 'learning', 'mistakeReview', 'favoriteReview'];
        if (startModes.includes(view)) {
             activityTracker.start();
        }
        switch (view) {
            case 'quiz':
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.practiceModeControl.classList.remove('hidden');
                quizMode.reset();
                await quizMode.updateRangeInputs();
                break;
            case 'quiz-play':
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.practiceModeControl.classList.remove('hidden');
                quizMode.reset(false);
                if (!learningMode.state.isWordListReady[app.state.selectedSheet]) {
                    await learningMode.loadWordList();
                }
                quizMode.configureSession(options);
                quizMode.displayNextQuiz();
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
                await this.syncOfflineData();
                await dashboard.show();
                break;
            case 'mistakeReview':
            case 'favoriteReview':
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                if (view === 'mistakeReview') {
                    learningMode.startMistakeReview(options.mistakeWords);
                } else {
                    learningMode.startFavoriteReview();
                }
                break;
            case 'mode':
                this.elements.selectionScreen.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                if (this.state.user && this.config.adminEmail.includes(this.state.user.email)) {
                    this.elements.refreshBtn.classList.remove('hidden');
                }
                this.elements.lastUpdatedText.classList.remove('hidden');
                this.loadModeImages();
                quizMode.reset();
                learningMode.reset();
                await this.syncOfflineData();
                await this.renderTodaySummary();
                break;
            case 'grade':
            default:
                this.elements.gradeSelectionScreen.classList.remove('hidden');
                this.fetchAndSetBackgroundImages();
                this.loadGradeImages();
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
            this.elements.selectFavoritesBtn
        ].filter(el => el);
        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        const refreshIconHTML = this.elements.refreshBtn.innerHTML;
        this.elements.refreshBtn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
        try {
            const versionRef = ref(rt_db, `app_config/vocab_version_${sheet}`);
            const snapshot = await get(versionRef);
            const currentVersion = snapshot.val() || 0;
            const newVersion = currentVersion + 1;
            const newTimestamp = Date.now();
            await set(versionRef, newVersion);
            const timestampRef = ref(rt_db, `app_config/vocab_timestamp_${sheet}`);
            await set(timestampRef, newTimestamp);
            await learningMode.loadWordList(true);
            this.updateLastUpdatedText();
            this.showRefreshSuccessMessage();
        } catch(err) {
            this.showToast("데이터 새로고침(버전 업데이트)에 실패했습니다: " + err.message, true);
        } finally {
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            this.elements.refreshBtn.innerHTML = refreshIconHTML;
        }
    },
    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed top-20 left-1/2 -translate-x-1/2 text-white py-2 px-5 rounded-lg shadow-xl z-[200] text-lg font-semibold ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
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
    updateLastUpdatedText() {
        const grade = this.state.selectedSheet;
        if (this.elements.lastUpdatedText && grade) {
            const timestamp = this.state.lastCacheTimestamp[grade];
            if (timestamp) {
                const d = new Date(timestamp);
                const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                this.elements.lastUpdatedText.textContent = `Update:  ${dateString}`;
                this.elements.lastUpdatedText.classList.remove('hidden');
            } else {
                this.elements.lastUpdatedText.textContent = '업데이트 정보 없음';
                this.elements.lastUpdatedText.classList.remove('hidden');
            }
        } else if (this.elements.lastUpdatedText) {
             this.elements.lastUpdatedText.classList.add('hidden');
        }
    },
    async fetchAndSetBackgroundImages() {
        const images = this.config.backgroundImages;
        if (images.length === 0) return;
        const randomIndex = Math.floor(Math.random() * images.length);
        const imageUrl = images[randomIndex];
        document.documentElement.style.setProperty('--bg-image', `url('${imageUrl}')`);
    },
    async loadGradeImages() {
        document.querySelectorAll('.grade-select-card img').forEach(async (img) => {
            img.src = img.src;
        });
    },
    async loadModeImages() {
        const ids = ['#select-learning-btn img', '#select-quiz-btn img', '#start-meaning-quiz-btn img', '#start-blank-quiz-btn img', '#start-definition-quiz-btn img'];
        ids.forEach(async (id) => {
            const img = document.querySelector(id);
            if (img) img.src = img.src;
        });
    }
};
