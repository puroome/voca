let firebaseApp, auth, db, rt_db;
let initializeApp;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;
let getDatabase, ref, get;
let getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch; // Added writeBatch

document.addEventListener('firebaseSDKLoaded', () => {
    ({
        initializeApp,
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
        getDatabase, ref, get,
        getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch // Ensure writeBatch is available
    } = window.firebaseSDK);
    window.firebaseSDK.writeBatch = writeBatch; // Make it available globally

    app.init();
});

const activityTracker = {
    sessionSeconds: 0,
    lastActivityTimestamp: 0,
    timerInterval: null,
    saveInterval: null,
    INACTIVITY_LIMIT: 30000,

    start() {
        if (this.timerInterval) return;
        this.lastActivityTimestamp = Date.now();
        this.sessionSeconds = 0;
        this.timerInterval = setInterval(() => {
            if (document.hidden) return;
            const now = Date.now();
            if (now - this.lastActivityTimestamp < this.INACTIVITY_LIMIT) {
                this.sessionSeconds++;
            }
        }, 1000);

        this.saveInterval = setInterval(() => {
            if (this.sessionSeconds > 0 && app.state.selectedSheet) {
                try {
                    const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(app.state.selectedSheet);
                    const currentLocalTime = parseInt(localStorage.getItem(key) || '0');
                    localStorage.setItem(key, currentLocalTime + this.sessionSeconds);
                    this.sessionSeconds = 0;
                } catch (e) {
                    console.error("Error saving study time to localStorage", e);
                }
            }
        }, 10000);

        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.addEventListener(event, this.recordActivity, true));
    },

    stopAndSave() {
        if (!this.timerInterval) return;
        clearInterval(this.timerInterval);
        clearInterval(this.saveInterval);
        this.timerInterval = null;
        this.saveInterval = null;

        if (this.sessionSeconds > 0 && app.state.selectedSheet) {
             try {
                 const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(app.state.selectedSheet);
                 const currentLocalTime = parseInt(localStorage.getItem(key) || '0');
                 localStorage.setItem(key, currentLocalTime + this.sessionSeconds);
             } catch (e) {
                 console.error("Error saving remaining study time to localStorage", e);
             }
        }
        this.sessionSeconds = 0;

        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.removeEventListener(event, this.recordActivity, true));
    },

    recordActivity() {
        activityTracker.lastActivityTimestamp = Date.now();
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
            databaseURL: "https://wordapp-91c0a-default-rtdb.asia-southeast1.firebasedate.app/" // 오타 수정: firebasedatabase.app
        },
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzmcgauS6eUd2QAncKzX_kQ1K1b7x7xn2k6s1JWwf-FxmrbIt-_9-eAvNrFkr5eDdwr0w/exec",
        MERRIAM_WEBSTER_API_KEY: "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3",
        sheetLinks: {
            '1y': 'https://docs.google.com/spreadsheets/d/1r7fWUV1ea9CU-s2iSOwLKexEe2_7L8oUKhK0n1DpDUM/edit?usp=sharing',
            '2y': 'https://docs.google.com/spreadsheets/d/1Xydj0im3Cqq9JhjN8IezZ-7DBp1-DV703cCIb3ORdc8/edit?usp=sharing',
            '3y': 'https://docs.google.com/spreadsheets/d/1Z_n9IshFSC5cBBW6IkZNfQsLb2BBrp9QeOlsGsCkn2Y/edit?usp=sharing'
        },
        backgroundImages: []
    },
    state: {
        user: null,
        currentProgress: {}, // 서버에서 로드한 기본 진행 상태 (RAM)
        selectedSheet: '',
        isAppReady: false,
        translateDebounceTimeout: null,
        longPressTimer: null,
        LOCAL_STORAGE_KEYS: {
            LAST_GRADE: 'student_lastGrade',
            PRACTICE_MODE: 'student_practiceMode',
            LAST_INDEX: (grade) => `student_lastIndex_${grade}`,
            UNSYNCED_TIME: (grade) => `student_unsyncedTime_${grade}`,
            UNSYNCED_QUIZ: (grade) => `student_unsyncedQuizStats_${grade}`,
            // [수정] 'correct', 'incorrect', 'favorite' 상태를 모두 저장하는 통합 키
            UNSYNCED_PROGRESS_UPDATES: (grade) => `student_unsyncedProgress_${grade}`
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
    },
    async init() {
        firebaseApp = initializeApp(this.config.firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        rt_db = getDatabase(firebaseApp);

        await Promise.all([
            translationDBCache.init(),
            audioDBCache.init(),
            imageDBCache.init(),
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
                this.state.user = user;
                const userRef = doc(db, 'users', user.uid);
                // 사용자 정보 Firestore에 저장 (없으면 생성, 있으면 병합)
                await setDoc(userRef, {
                    displayName: user.displayName,
                    email: user.email
                }, { merge: true });

                this.elements.loginScreen.classList.add('hidden');
                this.elements.mainContainer.classList.remove('hidden');
                document.body.classList.remove('items-center'); // 로그인 후 중앙 정렬 해제

                // 서버에서 진행 상태 로드 후 로컬 변경사항 동기화 시도
                await utils.loadUserProgress(); // 먼저 서버 상태 로드
                await this.syncOfflineData(); // 로컬 변경사항 동기화 시도

                if (!this.state.isAppReady) {
                    this.state.isAppReady = true;
                    // 앱이 처음 준비될 때 퀴즈 미리 로드
                    await quizMode.preloadInitialQuizzes();
                }

                // URL 해시 또는 LocalStorage 기반 초기 화면 설정
                const hash = window.location.hash.substring(1);
                const [view, gradeFromHash] = hash.split('-');

                let initialState = { view: 'grade' }; // 기본값: 학년 선택 화면
                try {
                    const lastGrade = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.LAST_GRADE);

                    if (gradeFromHash && ['1y', '2y', '3y'].includes(gradeFromHash)) {
                        // URL에 학년 정보가 있으면 해당 학년의 모드 선택 화면으로
                        if (['mode', 'quiz', 'learning', 'dashboard', 'mistakeReview', 'favoriteReview'].includes(view)) {
                            initialState = { view: view, grade: gradeFromHash };
                        }
                    } else if (['1y', '2y', '3y'].includes(view)) {
                         // URL에 학년 정보만 있으면 해당 학년의 모드 선택 화면으로
                         initialState = { view: 'mode', grade: view };
                    } else if (lastGrade && ['1y', '2y', '3y'].includes(lastGrade)) {
                        // 마지막으로 선택한 학년 정보가 있으면 해당 학년의 모드 선택 화면으로
                        initialState = { view: 'mode', grade: lastGrade };
                    }
                } catch(e) {
                    console.error("Error reading last grade from localStorage", e);
                    initialState = { view: 'grade' }; // 오류 시 기본값
                }


                history.replaceState(initialState, ''); // 초기 히스토리 상태 설정
                this._renderView(initialState.view, initialState.grade); // 초기 화면 렌더링
            } else {
                // 로그아웃 상태
                this.state.user = null;
                this.state.currentProgress = {}; // 진행 상태 초기화
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.mainContainer.classList.add('hidden');
                document.body.classList.add('items-center'); // 로그인 화면 중앙 정렬
                this._renderView(null); // 모든 화면 숨김
            }
        });
    },
    async syncOfflineData() {
        if (!app.state.user) return; // 로그인 상태 아니면 동기화 안 함

        // 각 학년별로 로컬에 저장된 미동기화 데이터 확인 및 전송
        for (const grade of ['1y', '2y', '3y']) {
            try {
                // 1. 학습 시간 동기화
                const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(grade);
                const timeToSync = parseInt(localStorage.getItem(timeKey) || '0');
                if (timeToSync > 0) {
                    await utils.saveStudyHistory(timeToSync, grade); // 서버에 저장
                    localStorage.removeItem(timeKey); // 로컬 데이터 삭제
                }

                // 2. 퀴즈 통계 동기화
                const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
                const statsToSync = JSON.parse(localStorage.getItem(quizKey) || 'null');
                if (statsToSync) {
                    await utils.syncQuizHistory(statsToSync, grade); // 서버에 저장
                    localStorage.removeItem(quizKey); // 로컬 데이터 삭제
                }

                 // 3. [수정] 통합된 Progress 업데이트 동기화 (correct, incorrect, favorite)
                 const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                 const progressToSync = JSON.parse(localStorage.getItem(progressKey) || 'null');
                 if (progressToSync && Object.keys(progressToSync).length > 0) {
                     await utils.syncProgressUpdates(progressToSync, grade); // 서버에 저장
                     localStorage.removeItem(progressKey); // 로컬 데이터 삭제
                 }

            } catch (error) {
                console.error(`Offline data sync failed for grade ${grade}:`, error);
                // 동기화 실패 시 로컬 데이터를 지우지 않음 (다음 시도 위해)
            }
        }
        // 동기화 후 서버의 최신 상태를 다시 로드하여 RAM 상태 업데이트
        await utils.loadUserProgress();
    },
    bindGlobalEvents() {
        // 로그인 버튼
        this.elements.loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Google Sign-In Error:", error);
                this.showToast("로그인에 실패했습니다. 다시 시도해 주세요.", true);
            });
        });

        // 로그아웃 버튼
        this.elements.logoutBtn.addEventListener('click', () => signOut(auth));

        // 학년 선택 카드
        document.querySelectorAll('.grade-select-card').forEach(card => {
            card.addEventListener('click', () => {
                const grade = card.dataset.sheet;
                try {
                    // 마지막 선택 학년 로컬에 저장
                    localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.LAST_GRADE, grade);
                } catch (e) {
                    console.error("Error saving last grade to localStorage", e);
                }
                // 해당 학년의 모드 선택 화면으로 이동
                this.navigateTo('mode', grade);
            });
        });

        // 모드 선택 버튼들
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz', this.state.selectedSheet));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning', this.state.selectedSheet));
        document.getElementById('select-dashboard-btn').addEventListener('click', () => this.navigateTo('dashboard', this.state.selectedSheet));
        document.getElementById('select-mistakes-btn').addEventListener('click', () => this.navigateTo('mistakeReview', this.state.selectedSheet));
        this.elements.selectFavoritesBtn.addEventListener('click', () => this.navigateTo('favoriteReview', this.state.selectedSheet));

        // 네비게이션 버튼 (홈, 학년 선택으로 돌아가기)
        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('mode', this.state.selectedSheet));
        this.elements.backToGradeSelectionBtn.addEventListener('click', () => this.navigateTo('grade'));

        // 데이터 새로고침 버튼
        this.elements.refreshBtn.addEventListener('click', () => {
            if (!this.state.selectedSheet) return;
            this.elements.confirmationModal.classList.remove('hidden'); // 확인 모달 표시
        });
        this.elements.confirmNoBtn.addEventListener('click', () => this.elements.confirmationModal.classList.add('hidden')); // 취소
        this.elements.confirmYesBtn.addEventListener('click', () => {
            this.elements.confirmationModal.classList.add('hidden');
            this.forceRefreshData(); // 확인 시 새로고침 실행
        });

        // 퀴즈 연습 모드 체크박스
        this.elements.practiceModeCheckbox.addEventListener('change', (e) => {
            quizMode.state.isPracticeMode = e.target.checked;
            try {
                // 연습 모드 상태 로컬에 저장
                localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.PRACTICE_MODE, quizMode.state.isPracticeMode);
            } catch (err) {
                console.error("Error saving practice mode state:", err);
            }
            // 연습 모드 변경 시 현재 퀴즈 타입으로 다시 시작
            if (quizMode.state.currentQuizType) {
                 quizMode.start(quizMode.state.currentQuizType);
            }
        });

        // 단어 우클릭 메뉴 닫기 (메뉴 영역 밖 클릭 시)
        document.addEventListener('click', (e) => {
            if (this.elements.wordContextMenu && !this.elements.wordContextMenu.contains(e.target)) {
                ui.hideWordContextMenu();
            }
        });

        // 기본 우클릭 메뉴 방지 (특정 영역 제외)
        document.addEventListener('contextmenu', (e) => {
            const isWhitelisted = e.target.closest('.interactive-word, #word-display'); // 허용 영역
            if (!isWhitelisted) e.preventDefault();
        });

        // 뒤로가기/앞으로가기 버튼 (브라우저)
        window.addEventListener('popstate', (e) => {
            this.syncOfflineData(); // 페이지 이동 시 동기화
            const state = e.state || { view: 'grade' }; // 히스토리 상태 없으면 기본값
            this._renderView(state.view, state.grade); // 해당 상태 화면 렌더링
        });

        // 창 닫기 시도 시
        window.addEventListener('beforeunload', (e) => {
            activityTracker.stopAndSave(); // 마지막 학습 시간 로컬 저장
            this.syncOfflineDataSync(); // 최선을 다해 마지막 동기화 시도 (불안정)
        });
    },
     // beforeunload 시 동기화 (최선 노력)
     syncOfflineDataSync() {
         if (!app.state.user) return;
         const grade = app.state.selectedSheet;
         if (!grade) return;

         const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(grade);
         const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
         // [수정] 새 progress 키 사용
         const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);

         const timeToSync = localStorage.getItem(timeKey);
         const statsToSync = localStorage.getItem(quizKey);
         const progressToSync = localStorage.getItem(progressKey);

         // 비동기 작업(Firebase 전송)은 beforeunload에서 완료 보장 안됨
         // 로컬 저장만 확실히 하고, 다음 앱 시작 시 동기화하는 것이 주된 방식
         if (timeToSync || statsToSync || progressToSync) {
            // console.log("Data pending sync exists, will sync on next load.");
         }
     },
    // 화면 네비게이션 함수
    navigateTo(view, grade, options = {}) {
        const currentState = history.state || {};

        // 화면이나 학년이 변경될 때 동기화 수행
        if (currentState.view !== view || currentState.grade !== grade) {
            this.syncOfflineData();
        }

        // 같은 화면/학년으로 다시 이동하는 경우 (특정 모드 제외) 무시
        if (currentState.view === view && currentState.grade === grade && view !== 'mistakeReview' && view !== 'favoriteReview') return;


        // URL 해시 설정 (#grade 또는 #view-grade 형식)
        let hash = '';
        if (view !== 'grade' && view !== null) { // 'grade'는 해시 없음
            hash = grade ? `#${grade}` : ''; // 학년만 있으면 #1y
            if (view !== 'mode') { // 'mode' 아니면 #view-1y
                hash = `#${view}-${grade}`;
            }
        }

        // 브라우저 히스토리 상태 업데이트 및 URL 변경
        history.pushState({ view, grade, options }, '', window.location.pathname + window.location.search + hash);
        // 화면 렌더링 함수 호출
        this._renderView(view, grade, options);
    },
    // 화면 렌더링 함수
    async _renderView(view, grade, options = {}) {
        activityTracker.stopAndSave(); // 화면 전환 시 학습 시간 측정 중지 및 저장

        // 모든 컨테이너 숨김 처리
        this.elements.gradeSelectionScreen.classList.add('hidden');
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.dashboardContainer.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');
        this.elements.progressBarContainer.classList.add('hidden');

        // 상단 버튼 숨김 처리
        this.elements.homeBtn.classList.add('hidden');
        this.elements.backToGradeSelectionBtn.classList.add('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.practiceModeControl.classList.add('hidden');
        this.elements.sheetLink.classList.add('hidden');
        this.elements.logoutBtn.classList.add('hidden');

        if (!this.state.user) return; // 로그인 상태 아니면 여기서 중단

        this.elements.logoutBtn.classList.remove('hidden'); // 로그인 상태면 로그아웃 버튼 표시

        // 학년 정보가 있으면 상태 업데이트 및 UI 설정
        if (grade) {
            // 학년이 변경되었는지 확인
            const needsProgressLoad = this.state.selectedSheet !== grade;
            this.state.selectedSheet = grade; // 현재 선택된 학년 업데이트
            // 학년 변경 시 해당 학년의 진행 상태 로드
            if (needsProgressLoad) await utils.loadUserProgress();

            this.elements.sheetLink.href = this.config.sheetLinks[grade]; // 시트 링크 설정
            this.elements.sheetLink.classList.remove('hidden');
            const gradeText = grade.replace('y', '학년');
            this.elements.selectionTitle.textContent = `${gradeText} 어휘`; // 제목 설정
        } else {
            // 학년 정보 없으면 초기화
            this.state.selectedSheet = '';
            this.state.currentProgress = {};
        }

        // 학습/퀴즈 관련 모드 시작 시 학습 시간 측정 시작
        const startModes = ['quiz', 'learning', 'mistakeReview', 'favoriteReview'];
        if (startModes.includes(view)) {
             activityTracker.start();
        }

        // view 값에 따라 해당 화면 표시 및 초기화/설정
        switch (view) {
            case 'quiz': // 퀴즈 모드 선택 화면
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden'); // 홈 버튼 표시
                this.elements.backToGradeSelectionBtn.classList.remove('hidden'); // 학년 선택 버튼 표시
                this.elements.practiceModeControl.classList.remove('hidden'); // 연습 모드 표시
                quizMode.reset(); // 퀴즈 상태 초기화
                break;
            case 'learning': // 학습 모드 시작 화면
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                learningMode.resetStartScreen(); // 학습 시작 화면 초기화
                break;
            case 'dashboard': // 학습 통계 화면
                this.elements.dashboardContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                await dashboard.show(); // 통계 데이터 로드 및 표시
                break;
            case 'mistakeReview': // 오답 노트 학습
            case 'favoriteReview': // 즐겨찾기 학습
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                if (view === 'mistakeReview') {
                    // 오답 목록으로 학습 시작
                    learningMode.startMistakeReview(options.mistakeWords);
                } else {
                    // 즐겨찾기 목록으로 학습 시작
                    learningMode.startFavoriteReview();
                }
                break;
            case 'mode': // 모드 선택 화면
                this.elements.selectionScreen.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden'); // 학년 선택 버튼 표시
                this.elements.refreshBtn.classList.remove('hidden'); // 새로고침 버튼 표시
                // this.elements.logoutBtn.classList.add('hidden'); // 모드 선택 화면에서는 로그아웃 숨김 (상단에 있음)
                this.loadModeImages(); // 이미지 로드
                quizMode.reset(); // 퀴즈 초기화
                learningMode.reset(); // 학습 초기화
                break;
            case 'grade': // 학년 선택 화면
            default: // 기본값
                this.elements.gradeSelectionScreen.classList.remove('hidden');
                this.setBackgroundImage(); // 배경 이미지 설정
                this.loadGradeImages(); // 이미지 로드
                quizMode.reset();
                learningMode.reset();
                break;
        }
    },
    // 데이터 강제 새로고침
    async forceRefreshData() {
        const sheet = this.state.selectedSheet;
        if (!sheet) return; // 학년 선택 안됐으면 중단

        // 버튼 비활성화 UI 처리
        const elementsToDisable = [
            this.elements.homeBtn, this.elements.refreshBtn, this.elements.backToGradeSelectionBtn,
            document.getElementById('select-learning-btn'), document.getElementById('select-quiz-btn'),
            document.getElementById('select-dashboard-btn'), document.getElementById('select-mistakes-btn'),
            this.elements.selectFavoritesBtn // 즐겨찾기 버튼 추가
        ].filter(el => el);

        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));

        const refreshIconHTML = this.elements.refreshBtn.innerHTML; // 원래 아이콘 저장
        this.elements.refreshBtn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`; // 로딩 스피너 표시

        try {
            await learningMode.loadWordList(true); // 단어 목록 강제 새로고침
            this.showRefreshSuccessMessage(); // 성공 메시지 표시
        } catch(err) {
            this.showToast("데이터 새로고침에 실패했습니다: " + err.message, true); // 실패 메시지 표시
        } finally {
            // 버튼 다시 활성화
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            this.elements.refreshBtn.innerHTML = refreshIconHTML; // 원래 아이콘 복원
        }
    },
    // 토스트 메시지 표시
    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed top-20 left-1/2 -translate-x-1/2 text-white py-2 px-5 rounded-lg shadow-xl z-[200] text-lg font-semibold ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500); // 2.5초 후 사라짐
    },
    // 새로고침 성공 메시지
    showRefreshSuccessMessage() {
        const msgEl = this.elements.refreshSuccessMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500); // 1.5초 후 사라짐
    },
    // IME 경고 메시지 (한글 입력 시)
    showImeWarning() {
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => {
            this.elements.imeWarning.classList.add('hidden');
        }, 2000); // 2초 후 사라짐
    },
    // 예문 없음 메시지
    showNoSampleMessage() {
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500); // 1.5초 후 사라짐
    },
    // 배경 이미지 설정 (랜덤)
    async setBackgroundImage() {
        if (this.config.backgroundImages.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.config.backgroundImages.length);
        const imageUrl = this.config.backgroundImages[randomIndex];
        // 이미지 캐시에서 로드 시도, 없으면 fetch 후 캐싱
        const cachedUrl = await imageDBCache.loadImage(imageUrl);
        document.documentElement.style.setProperty('--bg-image', `url('${cachedUrl}')`);
    },
    // Cloudinary에서 배경 이미지 URL 목록 가져오기
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
            console.warn("Failed to fetch background images from Cloudinary, using fallback.", error);
            // 실패 시 기본 이미지 사용
            this.config.backgroundImages = [
                'https://i.imgur.com/EvyV4x7.jpeg',
                'https://i.imgur.com/xsnT8kO.jpeg',
                'https://i.imgur.com/6gZtYDb.jpeg'
            ];
        } finally {
            this.setBackgroundImage(); // 최종적으로 배경 이미지 설정
        }
    },
    // 학년 선택 카드 이미지 캐싱 적용
    async loadGradeImages() {
        document.querySelectorAll('.grade-select-card img').forEach(async (img) => {
            img.src = await imageDBCache.loadImage(img.src);
        });
    },
    // 모드 선택 버튼 이미지 캐싱 적용
    async loadModeImages() {
        const ids = ['#select-learning-btn img', '#select-quiz-btn img', '#start-meaning-quiz-btn img', '#start-blank-quiz-btn img', '#start-definition-quiz-btn img'];
        ids.forEach(async (id) => {
            const img = document.querySelector(id);
            if (img) img.src = await imageDBCache.loadImage(img.src);
        });
    }
};

// 이미지 캐싱 IndexedDB
const imageDBCache = {
    db: null, dbName: 'imageCacheDB', storeName: 'imageStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB for images not supported.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore(this.storeName);
            request.onsuccess = e => { this.db = e.target.result; resolve(); };
            request.onerror = e => reject(e.target.error);
        });
    },
    async loadImage(url) {
        if (!this.db || !url) return url;
        try {
            const cachedBlob = await this.getImage(url);
            if (cachedBlob) return URL.createObjectURL(cachedBlob);

            const response = await fetch(url);
            if (!response.ok) {
                 console.warn(`Failed to fetch image: ${url}, Status: ${response.status}`);
                 return url; // Fetch 실패 시 원본 URL 반환
            }
            const blob = await response.blob();
            this.saveImage(url, blob);
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error(`Error loading/caching image ${url}:`, e);
            return url; // 오류 발생 시 원본 URL 반환
        }
    },
    getImage: key => new Promise((resolve) => {
        if (!imageDBCache.db) return resolve(null);
        try {
            const request = imageDBCache.db.transaction([imageDBCache.storeName]).objectStore(imageDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => { console.error("IndexedDB getImage error:", e.target.error); resolve(null); };
        } catch (e) {
             console.error("IndexedDB transaction error (getImage):", e); resolve(null);
        }
    }),
    saveImage: (key, blob) => {
        if (!imageDBCache.db) return;
        try {
             const tx = imageDBCache.db.transaction([imageDBCache.storeName], 'readwrite');
             tx.objectStore(imageDBCache.storeName).put(blob, key);
             tx.onerror = (e) => console.error("IndexedDB saveImage transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB saveImage error:", e); }
    }
};

// TTS 오디오 캐싱 IndexedDB
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

// 번역 캐싱 IndexedDB
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

// 외부 API 호출 (TTS, 번역, 정의)
const api = {
    // Google Apps Script 이용한 번역
    async translateText(text) {
        if (!text || !text.trim()) return '';
        try {
            const cached = await translationDBCache.get(text);
            if (cached) return cached;

            const url = new URL(app.config.SCRIPT_URL);
            url.searchParams.append('action', 'translateText');
            url.searchParams.append('text', text);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) {
                translationDBCache.save(text, data.translatedText);
                return data.translatedText;
            }
            console.error("Translation API Error:", data.message);
            return '번역 실패';
        } catch (error) {
            console.error("Translation Fetch Error:", error);
            return '번역 오류';
        }
    },
    // Google Cloud TTS API (or fallback to browser TTS)
    googleTtsApiKey: 'AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA',
    async speak(text) {
        if (!text || !text.trim()) return;
        activityTracker.recordActivity(); // 사용자 활동 기록
        // 약어 처리
        const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');

        // iOS 아닌 환경에서 브라우저 기본 TTS 우선 시도
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!isIOS && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel(); // 이전 발음 취소
                const utterance = new SpeechSynthesisUtterance(processedText);
                utterance.lang = 'en-US';
                window.speechSynthesis.speak(utterance);
                return; // 성공 시 여기서 종료
            } catch (error) {
                console.warn("Native TTS failed, falling back to Google TTS API:", error);
            }
        }

        // 브라우저 TTS 실패 또는 iOS 환경 시 Google TTS API 사용
        const cacheKey = processedText;
        try {
            const cachedAudio = await audioDBCache.getAudio(cacheKey);
            if (cachedAudio) {
                const audio = new Audio(URL.createObjectURL(new Blob([cachedAudio], { type: 'audio/mp3' })));
                audio.play();
                return; // 캐시된 오디오 재생 성공
            }

            // Google TTS API 호출
            const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleTtsApiKey}`;
            const requestBody = {
                input: { text: processedText },
                voice: { languageCode: 'en-US', name: 'en-US-Standard-C' }, // 표준 C 음성 사용
                audioConfig: { audioEncoding: 'MP3' }
            };

            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`Google TTS API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (data.audioContent) {
                // Base64 디코딩 및 Blob 생성
                const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
                // 캐시에 저장 (ArrayBuffer 형태로)
                const arrayBuffer = await audioBlob.arrayBuffer();
                audioDBCache.saveAudio(cacheKey, arrayBuffer);
                // 오디오 재생
                const audio = new Audio(URL.createObjectURL(audioBlob));
                audio.play();
            } else {
                 throw new Error("No audio content received from Google TTS API");
            }
        } catch (error) {
            console.error('Error fetching/playing TTS audio:', error);
            // 필요 시 사용자에게 오류 알림 (예: app.showToast)
        }
    },
    // 클립보드 복사
    async copyToClipboard(text) {
        if (navigator.clipboard && text) {
            try { await navigator.clipboard.writeText(text); }
            catch (err) { console.warn("Clipboard write failed:", err); }
        }
    },
    // Merriam-Webster Learner's Dictionary API로 영영 정의 가져오기
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
            // API 응답 구조 확인 및 정의 추출
            if (Array.isArray(data) && data.length > 0) {
                const firstResult = data[0];
                if (typeof firstResult === 'object' && firstResult !== null && firstResult.shortdef && Array.isArray(firstResult.shortdef) && firstResult.shortdef.length > 0) {
                    // 여러 정의 중 첫 번째 정의 반환, 세미콜론으로 구분된 경우도 처리
                    return firstResult.shortdef[0].split(';')[0].trim();
                }
            }
            // console.warn(`No definition found for ${word} in API response.`);
            return null; // 정의 못 찾음
        } catch (e) {
            console.error(`Error fetching definition for ${word}:`, e);
            return null; // 네트워크 오류 등
        }
    }
};

// UI 관련 헬퍼 함수
const ui = {
    // 상호작용 안 할 단어 목록 (관사, 대명사, 전치사, 접속사 등)
    nonInteractiveWords: new Set(['a', 'an', 'the', 'I', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'something', 'anybody', 'anyone', 'anything', 'nobody', 'no one', 'nothing', 'everybody', 'everyone', 'everything', 'all', 'any', 'both', 'each', 'either', 'every', 'few', 'little', 'many', 'much', 'neither', 'none', 'one', 'other', 'several', 'some', 'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'to', 'toward', 'under', 'underneath', 'until', 'unto', 'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'after', 'although', 'as', 'because', 'before', 'if', 'once', 'since', 'than', 'that', 'though', 'till', 'unless', 'until', 'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how', 'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'not', 'very', 'too', 'so', 'just', 'well', 'often', 'always', 'never', 'sometimes', 'here', 'there', 'now', 'then', 'again', 'also', 'ever', 'even', 'how', 'quite', 'rather', 'soon', 'still', 'more', 'most', 'less', 'least', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'then', 'there', 'here', "don't", "didn't", "can't", "couldn't", "she's", "he's", "i'm", "you're", "they're", "we're", "it's", "that's"]),

    // 단어 카드 글자 크기 자동 조절
    adjustFontSize(element) {
        if (!element || !element.parentElement) return;
        element.style.fontSize = ''; // 기본 크기로 리셋
        const defaultFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        let currentFontSize = defaultFontSize;
        const container = element.parentElement;
        // 부모 너비 넘치면 폰트 크기 줄임 (최소 12px)
        while (element.scrollWidth > container.clientWidth - 80 && currentFontSize > 12) { // 80px 여유 공간
            currentFontSize -= 1;
            element.style.fontSize = `${currentFontSize}px`;
        }
    },
    // 설명 텍스트를 단어 단위로 분리하여 상호작용 가능하게 렌더링
    renderInteractiveText(targetElement, text) {
        if (!targetElement) return;
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        // 정규식: [...] 또는 S+V / 영어 단어 또는 구 (하이픈, 아포스트로피 포함)
        const regex = /(\[.*?\]|\bS\+V\b)|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach(line => { // 줄바꿈 기준으로 처리
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line))) {
                // 매치 이전의 텍스트 추가
                if (match.index > lastIndex) targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
                const [_, nonClickable, englishPhrase] = match; // 그룹 분해 할당
                if (englishPhrase) { // 영어 단어/구 매치 시
                    const span = document.createElement('span');
                    span.textContent = englishPhrase;
                    // 상호작용 제외 목록에 없으면 이벤트 리스너 추가
                    if (!this.nonInteractiveWords.has(englishPhrase.toLowerCase())) {
                        span.className = 'interactive-word';
                        // 클릭: TTS 재생
                        span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(englishPhrase); };
                        // 우클릭: 컨텍스트 메뉴 표시
                        span.oncontextmenu = e => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); };
                        // 터치: 길게 누르면 컨텍스트 메뉴 (700ms)
                        let touchMove = false;
                        span.addEventListener('touchstart', e => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700); }, { passive: true });
                        span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); }); // 움직이면 취소
                        span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); }); // 떼면 취소
                    }
                    targetElement.appendChild(span);
                } else if (nonClickable) { // [...] 또는 S+V 매치 시 그대로 추가
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex; // 다음 검색 시작 위치 업데이트
            }
            // 마지막 매치 이후 텍스트 추가
            if (lastIndex < line.length) targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            targetElement.appendChild(document.createElement('br')); // 줄바꿈 추가
        });
        // 마지막 불필요한 <br> 제거
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    // 예문 마우스 오버 시 번역 툴팁 표시 (지연 포함)
    handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.translateDebounceTimeout); // 이전 타이머 취소
        // 1초 후 번역 실행
        app.state.translateDebounceTimeout = setTimeout(async () => {
            const tooltip = app.elements.translationTooltip;
            const targetRect = event.target.getBoundingClientRect(); // 요소 위치 가져오기
            // 툴팁 위치 설정 (요소 아래)
            Object.assign(tooltip.style, { left: `${targetRect.left + window.scrollX}px`, top: `${targetRect.bottom + window.scrollY + 5}px` });
            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            tooltip.textContent = await api.translateText(sentence); // 번역 API 호출
        }, 1000);
    },
    // 마우스 아웃 시 번역 타이머 취소 및 툴팁 숨김
    handleSentenceMouseOut() {
        clearTimeout(app.state.translateDebounceTimeout);
        app.elements.translationTooltip.classList.add('hidden');
    },
    // 텍스트를 단어 단위로 분리하여 상호작용 가능한 DocumentFragment 생성
    createInteractiveFragment(text, isForSampleSentence = false) {
        const fragment = document.createDocumentFragment();
        if (!text || !text.trim()) return fragment;
        // 영어 단어 기준으로 분리
        const parts = text.split(/([a-zA-Z0-9'-]+)/g);
        parts.forEach(part => {
            // 영어 단어이고 상호작용 제외 목록에 없으면 span으로 감싸고 이벤트 추가
            if (/([a-zA-Z0-9'-]+)/.test(part) && !this.nonInteractiveWords.has(part.toLowerCase())) {
                const span = document.createElement('span');
                span.textContent = part;
                span.className = 'interactive-word';
                // 클릭: TTS 재생 (예문 내 단어 클릭 시 예문 전체 재생 방지)
                span.onclick = (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    clearTimeout(app.state.longPressTimer);
                    api.speak(part);
                };
                // 우클릭: 컨텍스트 메뉴 (이벤트 버블링 방지)
                span.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (isForSampleSentence) e.stopPropagation();
                    this.showWordContextMenu(e, part);
                };
                // 터치: 길게 누르면 컨텍스트 메뉴
                 let touchMove = false;
                span.addEventListener('touchstart', (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    touchMove = false;
                    clearTimeout(app.state.longPressTimer);
                    app.state.longPressTimer = setTimeout(() => { if (!touchMove) { this.showWordContextMenu(e, part); } }, 700);
                }, { passive: true });
                span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                fragment.appendChild(span);
            } else { // 그 외 텍스트는 그대로 추가
                const span = document.createElement('span');
                span.textContent = part;
                 // 예문 내 일반 텍스트 클릭 시 예문 전체 재생 방지
                span.onclick = (e) => e.stopPropagation();
                fragment.appendChild(span);
            }
        });
        return fragment;
    },
    // 예문 목록을 받아 컨테이너에 상호작용 가능하게 렌더링
    displaySentences(sentences, containerElement) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        sentences.filter(s => s && s.trim()).forEach(sentence => { // 빈 예문 제외
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors sample-sentence'; // 스타일 클래스
            // 클릭: 예문 전체 TTS 재생 및 번역 표시
            p.onclick = (e) => {
                // 예문 안의 단어 클릭 시에는 전체 재생 안 함
                if (e.target.closest('.sentence-content-area .interactive-word')) return;
                api.speak(p.textContent); // 예문 전체 읽기
                this.handleSentenceMouseOver(e, p.textContent); // 번역 툴팁 표시
            };
            // 마우스 오버: 1초 후 번역 툴팁 표시
            p.addEventListener('mouseover', (e) => {
                 // 단어 위가 아닐 때만 전체 번역 툴팁 표시
                if (!e.target.closest('.sentence-content-area')) {
                     this.handleSentenceMouseOver(e, p.textContent);
                }
            });
            // 마우스 아웃: 번역 타이머 취소 및 툴팁 숨김
            p.addEventListener('mouseout', this.handleSentenceMouseOut);

            // 예문 내용 담을 span (단어 위 마우스오버 시 전체 번역 방지용)
            const sentenceContent = document.createElement('span');
            sentenceContent.className = 'sentence-content-area';
             sentenceContent.addEventListener('mouseenter', () => {
                clearTimeout(app.state.translateDebounceTimeout); // 단어 위에 있으면 전체 번역 타이머 취소
                this.handleSentenceMouseOut(); // 툴팁 숨김
            });

            // *단어* 부분을 <strong>으로 감싸고 나머지는 일반 텍스트 처리
            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) { // *단어* 부분
                    const strong = document.createElement('strong');
                    strong.appendChild(this.createInteractiveFragment(part.slice(1, -1), true)); // * 제거 후 상호작용 프래그먼트 생성
                    sentenceContent.appendChild(strong);
                } else if (part) { // 일반 텍스트 부분
                    sentenceContent.appendChild(this.createInteractiveFragment(part, true)); // 상호작용 프래그먼트 생성
                }
            });
            p.appendChild(sentenceContent);
            containerElement.appendChild(p);
        });
    },
    // 단어 우클릭/길게 누르기 시 컨텍스트 메뉴 표시
    showWordContextMenu(event, word) {
        event.preventDefault();
        const menu = app.elements.wordContextMenu;
        // 터치 또는 마우스 클릭 위치 계산
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;
        // 메뉴 위치 설정 및 표시
        Object.assign(menu.style, { top: `${y}px`, left: `${x}px` });
        menu.classList.remove('hidden');
        // 각 사전 검색 버튼에 클릭 이벤트 할당
        const encodedWord = encodeURIComponent(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, 'daum-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, 'naver-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, 'longman-dictionary'); this.hideWordContextMenu(); };
    },
    // 컨텍스트 메뉴 숨김
    hideWordContextMenu() {
        if (app.elements.wordContextMenu) app.elements.wordContextMenu.classList.add('hidden');
    }
};

// 유틸리티 함수 (Firestore 경로, 상태 계산, 데이터 저장/동기화 등)
const utils = {
    // Firestore progress 문서 참조 반환
    _getProgressRef(grade = app.state.selectedSheet) {
        if (!app.state.user || !grade) return null;
        // users/{userId}/progress/{grade} 경로
        return doc(db, 'users', app.state.user.uid, 'progress', grade);
    },

    // [수정] 모든 progress 변경 사항(correct, incorrect, favorite)을 LocalStorage에 추가/업데이트
    addProgressUpdateToLocalSync(word, key, value, grade = app.state.selectedSheet) {
        if (!grade) return; // 학년 정보 없으면 저장 안 함
        try {
            const localKey = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
            const unsynced = JSON.parse(localStorage.getItem(localKey) || '{}');
            if (!unsynced[word]) {
                unsynced[word] = {}; // 해당 단어 객체 없으면 생성
            }
            // 새로운 값으로 업데이트 (항상 최신 상태 유지)
            unsynced[word][key] = value;
            localStorage.setItem(localKey, JSON.stringify(unsynced));
        } catch (e) {
            console.error("Error adding progress update to localStorage sync", e);
        }
    },

    // Firestore에서 사용자 진행 상태 로드하여 app.state.currentProgress(RAM)에 저장
    async loadUserProgress() {
        // 모든 학년에 대해 로드 시도 (앱 시작 시 등)
        for (const grade of ['1y', '2y', '3y']) {
            const docRef = this._getProgressRef(grade);
            if (!docRef) continue; // 해당 학년 참조 없으면 건너뜀

            try {
                const docSnap = await getDoc(docRef);
                 // RAM 상태 업데이트 (현재 선택된 학년 아니어도 일단 로드)
                 // 주의: 이 로직은 현재 선택된 학년(app.state.selectedSheet)만 업데이트해야 함
                 // 수정 필요 -> 아래와 같이 현재 선택된 학년만 업데이트하도록 변경
                 if (grade === app.state.selectedSheet) {
                    app.state.currentProgress = docSnap.exists() ? docSnap.data() : {};
                 }
                 // 일단 모든 학년 로드하도록 유지 (나중에 최적화 고려) -> 아니, 현재 학년만!
                 // app.state.currentProgress[grade] = docSnap.exists() ? docSnap.data() : {};

            } catch (error) {
                console.error(`Error loading progress for grade ${grade}:`, error);
                if (grade === app.state.selectedSheet) {
                     app.state.currentProgress = {}; // 오류 시 현재 학년 진행 상태 초기화
                }
            }
        }
         // 위 로직 수정: 현재 선택된 학년만 로드하도록 변경
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

    // 단어의 현재 학습 상태 계산 (서버 상태 + 로컬 변경사항 반영)
    getWordStatus(word) {
        const grade = app.state.selectedSheet;

        // 1. 로컬(LocalStorage)에 저장된 최신 변경사항 가져오기
        let localStatus = {};
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
                if (unsynced[word]) {
                    localStatus = unsynced[word]; // 해당 단어의 로컬 변경사항
                }
            } catch(e) { console.warn("Error reading local progress updates:", e); }
        }

        // 2. 서버에서 로드한 상태(RAM)에 로컬 변경사항을 덮어써 최신 상태 만듦
        //    예: 서버 상태 { M: 'correct' }, 로컬 변경 { M: 'incorrect' } -> 최종 { M: 'incorrect' }
        const progress = { ...(app.state.currentProgress[word] || {}), ...localStatus };

        // 3. 퀴즈 상태 배열 생성 (정의 퀴즈 포함)
        const quizTypes = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION'];
        const statuses = quizTypes.map(type => progress[type] || 'unseen'); // 없으면 'unseen'

        // 4. 상태 판정 로직
        if (Object.keys(progress).length === 0 && Object.keys(localStatus).length === 0) return 'unseen'; // 서버/로컬 모두 기록 없으면 unseen
        if (statuses.includes('incorrect')) return 'review';      // 하나라도 틀렸으면 review
        if (statuses.every(s => s === 'correct')) return 'learned'; // 모두 맞혔으면 learned
        if (statuses.some(s => s === 'correct')) return 'learning';  // 하나라도 맞혔으면 learning

        return 'unseen'; // 그 외 (예: 즐겨찾기만 있고 퀴즈 기록 없음)
    },

    // 퀴즈 결과(correct/incorrect) 업데이트 (로컬 우선 저장)
    async updateWordStatus(word, quizType, result) {
        const grade = app.state.selectedSheet;
        if (!word || !quizType || !app.state.user || !grade) return; // 필수 정보 없으면 중단

        const isCorrect = result === 'correct';

        // 1. RAM 상태 즉시 업데이트 (UI 즉각 반영 위함)
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word][quizType] = result;

        // 2. [수정] LocalStorage에 변경 사항 저장 (correct/incorrect 모두)
        this.addProgressUpdateToLocalSync(word, quizType, result, grade);

        // 3. 퀴즈 통계는 별도 로컬 저장 (일일 집계 방식 유지)
        this.saveQuizHistoryToLocal(quizType, isCorrect, grade);
    },

    // 특정 퀴즈 타입에서 정답 맞힌 단어 목록 반환 (RAM 기준)
    // 주의: 이 함수는 로컬 변경사항(LocalStorage)을 반영하지 않음.
    // preload 등에서 서버 상태 기준으로만 판단할 때 사용.
    getCorrectlyAnsweredWords(quizType) {
        if (!quizType) return [];
        const allProgress = app.state.currentProgress; // RAM 상태만 사용
        return Object.keys(allProgress)
            .filter(word => allProgress[word] && allProgress[word][quizType] === 'correct');
    },

    // 현재 복습이 필요한(review) 단어 목록 반환 (로컬 변경사항 반영)
    getIncorrectWords() {
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return [];

        const allWords = learningMode.state.wordList[grade];
        // getWordStatus 사용 -> 로컬 변경사항 포함하여 최신 상태로 판단
        return allWords
            .filter(wordObj => this.getWordStatus(wordObj.word) === 'review')
            .map(wordObj => wordObj.word);
    },

    // 즐겨찾기 상태 토글 (로컬 우선 저장)
    async toggleFavorite(word) {
        const grade = app.state.selectedSheet;
        if (!word || !app.state.user || !grade) return false; // 필수 정보 없으면 중단

        // 현재 상태 계산 (서버 + 로컬 반영)
        let isCurrentlyFavorite = app.state.currentProgress[word]?.favorite || false;
        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
            const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
            if (unsynced[word] && unsynced[word].favorite !== undefined) {
                isCurrentlyFavorite = unsynced[word].favorite;
            }
        } catch(e) {}

        const newFavoriteStatus = !isCurrentlyFavorite; // 상태 반전

        // 1. RAM 상태 즉시 업데이트 (UI 즉각 반영)
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word].favorite = newFavoriteStatus;

        // 2. [수정] LocalStorage에 변경 사항 저장
        this.addProgressUpdateToLocalSync(word, 'favorite', newFavoriteStatus, grade);

        // 3. 새로운 상태 즉시 반환 (UI 업데이트용)
        return newFavoriteStatus;
    },

    // 즐겨찾기된 단어 목록 반환 (로컬 변경사항 반영)
    getFavoriteWords() {
        const grade = app.state.selectedSheet;
        let localUpdates = {}; // 로컬 변경사항 저장 객체
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                localUpdates = JSON.parse(localStorage.getItem(key) || '{}');
            } catch (e) { console.warn("Error reading local progress updates for favorites:", e); }
        }

        const allProgress = app.state.currentProgress; // 서버 상태 (RAM)
        // 서버 상태와 로컬 변경사항의 모든 단어 키 합집합 생성
        const combinedKeys = new Set([...Object.keys(allProgress), ...Object.keys(localUpdates)]);

        const favoriteWords = [];
        combinedKeys.forEach(word => {
            const serverState = allProgress[word] || {};
            const localState = localUpdates[word] || {};
            // 서버 상태에 로컬 변경사항 덮어쓰기
            const combinedState = { ...serverState, ...localState };

            // 최종 상태가 favorite: true 이면 목록에 추가
            if (combinedState.favorite === true) {
                // favoritedAt 정보는 현재 없으므로 시간순 정렬 불가, 그냥 단어만 추가
                favoriteWords.push(word);
            }
        });

        // 현재는 시간 정보 없으므로 정렬 없이 반환
        return favoriteWords;
    },

    // 학습 시간 Firestore에 저장 (일별, 학년별 누적)
    async saveStudyHistory(seconds, grade) {
        if (!app.state.user || seconds < 1 || !grade) return;

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD 형식 날짜
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'study');

        try {
            // Firestore 문서 읽기 (없으면 생성됨)
            const docSnap = await getDoc(historyRef);
            const data = docSnap.exists() ? docSnap.data() : {};
            const dailyData = data[today] || {}; // 오늘 날짜 데이터 없으면 빈 객체
            const currentSeconds = dailyData[grade] || 0; // 해당 학년 데이터 없으면 0

            // 오늘 날짜 필드에 학년별 누적 시간 업데이트 (병합)
            await setDoc(historyRef, { [today]: { [grade]: currentSeconds + seconds } }, { merge: true });
        } catch(e) {
            console.error("Failed to update study history:", e);
            throw e; // 에러 다시 던져서 syncOfflineData에서 처리하게 함
        }
    },

    // 퀴즈 통계 LocalStorage에 저장 (일괄 동기화 위해)
    saveQuizHistoryToLocal(quizType, isCorrect, grade) {
        if (!grade || !quizType) return;

        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
            const stats = JSON.parse(localStorage.getItem(key) || '{}');
            if (!stats[quizType]) {
                stats[quizType] = { total: 0, correct: 0 }; // 해당 퀴즈 타입 없으면 생성
            }
            stats[quizType].total += 1; // 시도 횟수 증가
            if (isCorrect) {
                stats[quizType].correct += 1; // 정답 횟수 증가
            }
            localStorage.setItem(key, JSON.stringify(stats));
        } catch (e) {
            console.error("Error saving quiz stats to localStorage", e);
        }
    },

    // LocalStorage의 퀴즈 통계를 Firestore에 동기화 (일별, 학년별, 타입별 누적)
    async syncQuizHistory(statsToSync, grade) {
        if (!app.state.user || !statsToSync || !grade) return;
        const today = new Date().toISOString().slice(0, 10);
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'quiz');

        try {
            const docSnap = await getDoc(historyRef);
            const data = docSnap.exists() ? docSnap.data() : {};

            const todayData = data[today] || {}; // 오늘 날짜 데이터
            const gradeData = todayData[grade] || {}; // 해당 학년 데이터

            // 로컬 통계(statsToSync)를 서버 통계에 합산
            for (const type in statsToSync) {
                if (statsToSync.hasOwnProperty(type)) {
                    const typeStats = gradeData[type] || { correct: 0, total: 0 }; // 해당 타입 데이터
                    typeStats.total += statsToSync[type].total;
                    typeStats.correct += statsToSync[type].correct;
                    gradeData[type] = typeStats; // 업데이트
                }
            }

            // Firestore에 업데이트 (병합)
            await setDoc(historyRef, { [today]: { [grade]: gradeData } }, { merge: true });
        } catch(e) {
            console.error("Failed to sync quiz history:", e);
            throw e; // 에러 다시 던짐
        }
    },

    // [수정] LocalStorage의 통합 progress 업데이트를 Firestore에 동기화
    async syncProgressUpdates(progressToSync, grade) {
         if (!app.state.user || !progressToSync || Object.keys(progressToSync).length === 0 || !grade) return;
         const progressRef = this._getProgressRef(grade);
         if (!progressRef) return;

         try {
             // setDoc + merge:true 사용 -> Firestore 문서 구조에 맞춰 중첩 업데이트 수행
             // 예: progressToSync = { "wordA": { "favorite": true }, "wordB": { "QUIZ_TYPE": "correct" } }
             // Firestore의 /users/{uid}/progress/{grade} 문서에 wordA와 wordB 필드를 병합
             await setDoc(progressRef, progressToSync, { merge: true });
         } catch (error) {
             console.error("Firebase progress sync (setDoc merge) failed:", error);
             throw error; // 에러 다시 던져서 syncOfflineData에서 처리하게 함
         }
     }
};

// 학습 통계 대시보드
const dashboard = {
    // ... (dashboard 객체 내용은 이전과 동일하게 유지) ...
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
        stats7DayContainer: document.getElementById('dashboard-stats-7day-container'),
        stats30DayContainer: document.getElementById('dashboard-stats-30day-container'),
        statsTotalContainer: document.getElementById('dashboard-stats-total-container'),
    },
    state: {
        studyTimeChart: null,
        quiz1Chart: null,
        quiz2Chart: null,
        quiz3Chart: null,
    },
    init() {},
    async show() {
        this.destroyCharts();

        this.elements.content.innerHTML = `<div class="text-center p-4"><div class="loader mx-auto"></div></div>`;
        this.elements.stats30DayContainer.innerHTML = '';
        this.elements.statsTotalContainer.innerHTML = '';

        if (!learningMode.state.isWordListReady[app.state.selectedSheet]) {
            await learningMode.loadWordList();
        }

        this.renderBaseStats();
        // 비동기로 고급 통계 렌더링 (차트 등)
        setTimeout(async () => {
            await this.renderAdvancedStats();
        }, 1);
    },
    renderBaseStats() {
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) {
             this.elements.content.innerHTML = `<p class="text-center text-gray-600">데이터를 불러올 수 없습니다.</p>`;
             return;
        }
        const allWords = learningMode.state.wordList[grade] || [];
        const totalWords = allWords.length;
        if (totalWords === 0) {
            this.elements.content.innerHTML = `<p class="text-center text-gray-600">학습할 단어가 없습니다.</p>`;
            return;
        }

        const counts = { learned: 0, learning: 0, review: 0, unseen: 0 };
        allWords.forEach(wordObj => {
            // [수정] utils.getWordStatus가 LocalStorage 포함 최신 상태 반환
            counts[utils.getWordStatus(wordObj.word)]++;
        });

        const stats = [
            { name: '미학습', description: '아직 어떤 퀴즈도 풀지 않음', count: counts.unseen, color: 'bg-gray-400' },
            { name: '학습 중', description: '최소 1종류의 퀴즈를 풀어서 맞힘, 아직 틀리지 않음', count: counts.learning, color: 'bg-blue-500' },
            { name: '복습 필요', description: '최소 1종류의 퀴즈에서 틀림', count: counts.review, color: 'bg-orange-500' },
            { name: '학습 완료', description: '모든 종류의 퀴즈에서 정답을 맞힘', count: counts.learned, color: 'bg-green-500' }
        ];

        let contentHTML = `<div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center"><p class="text-lg text-gray-600">총 단어 수</p><p class="text-4xl font-bold text-gray-800">${totalWords}</p></div><div><h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2><div class="space-y-4">`;
        stats.forEach(stat => {
            const percentage = totalWords > 0 ? ((stat.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `<div class="w-full"><div class="flex justify-between items-center mb-1"><span class="text-base font-semibold text-gray-700" title="${stat.description}">${stat.name}</span><span class="text-sm font-medium text-gray-500">${stat.count}개 (${percentage}%)</span></div><div class="w-full bg-gray-200 rounded-full h-4"><div class="${stat.color} h-4 rounded-full" style="width: ${percentage}%"></div></div></div>`;
        });
        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
    },

    async renderAdvancedStats() {
        if (!app.state.user || !app.state.selectedSheet) return;
        const grade = app.state.selectedSheet;

        try {
            // Firestore에서 학습/퀴즈 기록 가져오기
            const studyHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'study'));
            const quizHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'quiz'));
            const studyHistory = studyHistoryDoc.exists() ? studyHistoryDoc.data() : {};
            const quizHistory = quizHistoryDoc.exists() ? quizHistoryDoc.data() : {};

            this.render7DayCharts(studyHistory, quizHistory, grade); // 7일 차트 렌더링
            this.renderSummaryCards(studyHistory, quizHistory, grade); // 30일/누적 카드 렌더링

        } catch (e) {
            console.error("Error rendering advanced stats:", e);
            this.elements.content.innerHTML += `<p class="text-red-500 text-center mt-4">추가 통계 정보를 불러오는 데 실패했습니다.</p>`;
        }
    },

    destroyCharts() {
        if (this.state.studyTimeChart) this.state.studyTimeChart.destroy();
        if (this.state.quiz1Chart) this.state.quiz1Chart.destroy();
        if (this.state.quiz2Chart) this.state.quiz2Chart.destroy();
        if (this.state.quiz3Chart) this.state.quiz3Chart.destroy();
        this.state.studyTimeChart = this.state.quiz1Chart = this.state.quiz2Chart = this.state.quiz3Chart = null;
    },

    render7DayCharts(studyHistory, quizHistory, grade) {
        const today = new Date();
        const labels = [];
        const studyData = [];
        // 최근 7일 날짜 및 학습 시간 데이터 준비
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().slice(0, 10);
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`); // MM/DD 형식 라벨
            studyData.push(Math.round(((studyHistory[dateString] && studyHistory[dateString][grade]) || 0) / 60)); // 분 단위 변환
        }

        // 학습 시간 막대 차트 생성
        const studyTimeCtx = document.getElementById('study-time-chart')?.getContext('2d');
        if (studyTimeCtx) {
            this.state.studyTimeChart = new Chart(studyTimeCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: '학습 시간 (분)',
                        data: studyData,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: { // 차트 옵션
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, suggestedMax: 60 } }, // Y축 설정
                    plugins: { legend: { display: false } } // 범례 숨김
                }
            });
        }

        // 최근 7일 퀴즈 통계 계산
        const quizStats7Days = {
            'MULTIPLE_CHOICE_MEANING': { correct: 0, total: 0 },
            'FILL_IN_THE_BLANK': { correct: 0, total: 0 },
            'MULTIPLE_CHOICE_DEFINITION': { correct: 0, total: 0 },
        };
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().slice(0, 10);
            if (quizHistory[dateString] && quizHistory[dateString][grade]) {
                for(const type in quizStats7Days){
                    if(quizHistory[dateString][grade][type]){
                        quizStats7Days[type].correct += quizHistory[dateString][grade][type].correct || 0;
                        quizStats7Days[type].total += quizHistory[dateString][grade][type].total || 0;
                    }
                }
            }
        }

        // 각 퀴즈 타입별 도넛 차트 생성
        this.state.quiz1Chart = this.createDoughnutChart('quiz1-chart', 'quiz1-label', '영한 뜻', quizStats7Days['MULTIPLE_CHOICE_MEANING']);
        this.state.quiz2Chart = this.createDoughnutChart('quiz2-chart', 'quiz2-label', '빈칸 추론', quizStats7Days['FILL_IN_THE_BLANK']);
        this.state.quiz3Chart = this.createDoughnutChart('quiz3-chart', 'quiz3-label', '영영 풀이', quizStats7Days['MULTIPLE_CHOICE_DEFINITION']);
    },

    // 도넛 차트 생성 헬퍼 함수
    createDoughnutChart(elementId, labelId, labelText, stats) {
        const ctx = document.getElementById(elementId)?.getContext('2d');
        if (!ctx) return null;

        const correct = stats.correct || 0;
        const total = stats.total || 0;
        const incorrect = total - correct;

        const hasAttempts = total > 0; // 시도 횟수 있는지 여부
        const accuracy = hasAttempts ? Math.round((correct / total) * 100) : 0; // 정확도 계산

        // 시도 횟수에 따라 색상 및 데이터 설정
        const chartColors = hasAttempts ? ['#34D399', '#F87171'] : ['#E5E7EB', '#E5E7EB']; // 녹색, 빨강 / 회색
        const chartData = hasAttempts ? [correct, incorrect > 0 ? incorrect : 0.0001] : [0, 1]; // 0이면 오류날 수 있어 작은 값 추가 / 회색 처리

        const centerText = hasAttempts ? `${accuracy}%` : '-'; // 중앙 텍스트

        // 차트 아래 라벨 업데이트 (예: 영한 뜻 (15/20))
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
            labelEl.textContent = `${labelText} (${correct}/${total})`;
        }

        // Chart.js 도넛 차트 생성
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: hasAttempts ? ['정답', '오답'] : ['기록 없음'],
                datasets: [{ data: chartData, backgroundColor: chartColors, hoverBackgroundColor: chartColors, borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '70%', // 도넛 모양 설정
                plugins: { legend: { display: false }, tooltip: { enabled: false } } // 범례, 툴팁 숨김
            },
            plugins: [{ // 중앙 텍스트 표시 플러그인
                id: 'doughnutLabel',
                beforeDraw: (chart) => {
                    const { ctx, width, height } = chart;
                    ctx.restore();
                    const fontSize = (height / 114).toFixed(2); // 크기에 맞게 폰트 조절
                    ctx.font = `bold ${fontSize}em sans-serif`;
                    ctx.textBaseline = 'middle';
                    const text = centerText;
                    const textX = Math.round((width - ctx.measureText(text).width) / 2);
                    const textY = height / 2;
                    ctx.fillStyle = hasAttempts ? '#374151' : '#9CA3AF'; // 색상 설정
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    },

    // 30일 / 누적 통계 카드 렌더링
    renderSummaryCards(studyHistory, quizHistory, grade) {
        const today = new Date();
        const quizTypes = [
            { id: 'MULTIPLE_CHOICE_MEANING', name: '영한 뜻' },
            { id: 'FILL_IN_THE_BLANK', name: '빈칸 추론' },
            { id: 'MULTIPLE_CHOICE_DEFINITION', name: '영영 풀이' }
        ];

        // 특정 기간 통계 계산 함수
        const getStatsForPeriod = (days) => {
            let totalSeconds = 0;
            const quizStats = { /* ... 초기화 ... */ };
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 }); // 초기화
            for (let i = 0; i < days; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().slice(0, 10);

                if(studyHistory[dateString]){
                    totalSeconds += studyHistory[dateString][grade] || 0;
                }

                if (quizHistory[dateString] && quizHistory[dateString][grade]) {
                    for(const type in quizStats){
                        if(quizHistory[dateString][grade][type]){
                            quizStats[type].correct += quizHistory[dateString][grade][type].correct || 0;
                            quizStats[type].total += quizHistory[dateString][grade][type].total || 0;
                        }
                    }
                }
            }
            return { totalSeconds, quizStats };
        };

        // 누적 통계 계산
        const totalStats = (() => {
            let totalSeconds = 0;
            const quizStats = { /* ... 초기화 ... */ };
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 }); // 초기화
            // 모든 날짜의 기록 합산
            Object.values(quizHistory).forEach(dailyStats => {
                if (dailyStats[grade]) {
                    for(const type in quizStats){
                        if(dailyStats[grade][type]){
                            quizStats[type].correct += dailyStats[grade][type].correct || 0;
                            quizStats[type].total += dailyStats[grade][type].total || 0;
                        }
                    }
                }
            });
            Object.values(studyHistory).forEach(dailyData => {
                totalSeconds += dailyData[grade] || 0;
            });
            return { totalSeconds, quizStats };
        })();

        const stats30 = getStatsForPeriod(30); // 30일 통계 계산

        // 통계 카드 HTML 생성 함수
        const createCardHTML = (title, time, stats) => {
            let cards = '';
            quizTypes.forEach(type => {
                const { correct, total } = stats[type.id] || { correct: 0, total: 0 };
                const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                cards += `
                    <div class="bg-white p-2 rounded-lg shadow-sm text-center">
                        <p class="text-sm font-semibold text-gray-500">${type.name}</p>
                        <p class="font-bold text-gray-800 text-xl">${accuracy}%</p>
                        <p class="text-xs text-gray-400">(${correct}/${total})</p>
                    </div>
                `;
            });

            return `
                <div class="bg-gray-50 p-4 rounded-xl shadow-inner">
                    <h4 class="font-bold text-gray-700 mb-4 text-lg text-center">
                        ${title}
                        <span class="font-normal text-gray-500">(${this.formatSeconds(time)})</span>
                    </h4>
                    <div class="grid grid-cols-3 gap-1">
                        ${cards}
                    </div>
                </div>
            `;
        };

        // 30일 / 누적 카드 HTML 삽입
        this.elements.stats30DayContainer.innerHTML = createCardHTML('최근 30일 기록', stats30.totalSeconds, stats30.quizStats);
        this.elements.statsTotalContainer.innerHTML = createCardHTML('누적 총학습 기록', totalStats.totalSeconds, totalStats.quizStats);
    },

    // 초를 "X시간 Y분" 형식으로 변환
    formatSeconds(totalSeconds) {
        if (!totalSeconds || totalSeconds < 60) return `0분`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        let result = '';
        if (h > 0) result += `${h}시간 `;
        if (m > 0) result += `${m}분`;
        return result.trim() || '0분'; // 둘 다 0이면 0분
    },
};

// 퀴즈 모드 로직
const quizMode = {
    // ... (quizMode 객체 내용은 이전과 거의 동일하게 유지, 상태 업데이트 로직은 utils 함수 호출로 변경됨) ...
     state: {
        currentQuiz: {},
        currentQuizType: null,
        isPracticeMode: false,
        practiceLearnedWords: [],
        sessionAnsweredInSet: 0,
        sessionCorrectInSet: 0,
        sessionMistakes: [],
        preloadedQuizzes: {
            '1y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '2y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '3y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null }
        },
        isPreloading: {
            '1y': {}, '2y': {}, '3y': {}
        },
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
            finishedMessage: document.getElementById('quiz-finished-message'),
            quizResultModal: document.getElementById('quiz-result-modal'),
            quizResultScore: document.getElementById('quiz-result-score'),
            quizResultMistakesBtn: document.getElementById('quiz-result-mistakes-btn'),
            quizResultContinueBtn: document.getElementById('quiz-result-continue-btn'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));

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
                    // 키보드 입력 시 선택 효과 추가
                    const targetLi = this.elements.choices.children[choiceIndex - 1];
                    targetLi.classList.add('bg-gray-200'); // 임시 배경색
                    setTimeout(() => targetLi.classList.remove('bg-gray-200'), 150); // 짧게 표시 후 제거
                    targetLi.click(); // 클릭 이벤트 트리거
                }
            }
        });
    },
    async start(quizType) {
        this.state.currentQuizType = quizType;
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.reset(false); // 화면 초기화 (선택 화면은 숨김)
        // 단어 목록 준비 확인 및 로드
        if (!learningMode.state.isWordListReady[app.state.selectedSheet]) {
            await learningMode.loadWordList();
        }
        this.displayNextQuiz(); // 첫 퀴즈 표시
    },
    reset(showSelection = true) {
        // 퀴즈 상태 초기화
        this.state.currentQuiz = {};
        this.state.practiceLearnedWords = [];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];

        // 로더 UI 초기화
        this.elements.loader.querySelector('.loader').style.display = 'block';
        this.elements.loaderText.textContent = "퀴즈 데이터를 불러오는 중...";
        // 화면 표시/숨김 처리
        if (showSelection) {
            this.elements.quizSelectionScreen.classList.remove('hidden');
            this.elements.loader.classList.add('hidden');
        } else {
            this.showLoader(true); // 로더 표시
        }
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
        if (this.elements.quizResultModal) this.elements.quizResultModal.classList.add('hidden');
    },
    async displayNextQuiz() {
        this.showLoader(true, '다음 문제 생성 중...');
        let nextQuiz = null;
        const grade = app.state.selectedSheet;
        const type = this.state.currentQuizType;

        // 미리 로드된 퀴즈 확인
        const preloaded = this.state.preloadedQuizzes[grade]?.[type];
        if (preloaded) {
            nextQuiz = preloaded;
            this.state.preloadedQuizzes[grade][type] = null; // 사용했으니 제거
            this.preloadNextQuiz(grade, type); // 다음 퀴즈 미리 로드 시작
        }

        // 미리 로드된 퀴즈 없으면 새로 생성
        if (!nextQuiz) {
            nextQuiz = await this.generateSingleQuiz();
        }

        if (nextQuiz) { // 퀴즈 생성 성공 시
            this.state.currentQuiz = nextQuiz; // 현재 퀴즈 상태 업데이트
            this.showLoader(false); // 로더 숨김
            this.renderQuiz(nextQuiz); // 퀴즈 화면 렌더링
        } else { // 생성 실패 시 (풀 문제 없음)
            if (this.state.sessionAnsweredInSet > 0) { // 이번 세션에 푼 문제 있으면 결과 표시
                this.showSessionResultModal(true); // isFinal = true
            } else { // 푼 문제 없으면 완료 화면 표시
                this.showFinishedScreen("모든 단어 학습을 완료했거나, 더 이상 만들 퀴즈가 없습니다!");
            }
        }
    },
    async generateSingleQuiz() {
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return null;

        const allWords = learningMode.state.wordList[grade] || [];
        if (allWords.length < 5) return null; // 퀴즈 생성 최소 단어 수 부족

        // 현재 퀴즈 타입에서 정답 맞힌 단어 목록 가져오기 (RAM 기준)
        const learnedWordsInType = this.state.isPracticeMode ?
            this.state.practiceLearnedWords : // 연습 모드 시 세션 내 맞힌 단어 제외
            utils.getCorrectlyAnsweredWords(this.state.currentQuizType);

        // 퀴즈 후보 단어 필터링
        let candidates = allWords.filter(wordObj => {
             // getWordStatus 사용: 서버+로컬 상태 종합하여 'learned' 아닌 단어만
             const status = utils.getWordStatus(wordObj.word);
             // 현재 타입에서 맞혔거나(learnedWordsInType), 전체 상태가 learned면 제외
             return status !== 'learned' && !learnedWordsInType.includes(wordObj.word);
        });

        // 빈칸 퀴즈 시 예문 있는 단어만 필터링
        if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
            candidates = candidates.filter(word => {
                if (!word.sample || word.sample.trim() === '') return false;
                const firstLine = word.sample.split('\n')[0];
                const placeholderRegex = /\*(.*?)\*/; // *word* 형식
                const wordRegex = new RegExp(`\\b${word.word}\\b`, 'i'); // 단어 직접 포함 형식
                // 예문 첫 줄에 *word* 또는 word가 포함되어야 함
                return placeholderRegex.test(firstLine) || wordRegex.test(firstLine);
            });
        }

        if (candidates.length === 0) return null; // 후보 없음

        candidates.sort(() => 0.5 - Math.random()); // 랜덤 섞기

        // 후보 단어 순회하며 퀴즈 생성 시도
        for (const wordData of candidates) {
            let quiz = null;
            if (this.state.currentQuizType === 'MULTIPLE_CHOICE_MEANING') {
                quiz = this.createMeaningQuiz(wordData, allWords);
            } else if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
                quiz = this.createBlankQuiz(wordData, allWords);
            } else if (this.state.currentQuizType === 'MULTIPLE_CHOICE_DEFINITION') {
                const definition = await api.fetchDefinition(wordData.word); // 영영 정의 가져오기
                if (definition) {
                    quiz = this.createDefinitionQuiz(wordData, allWords, definition);
                }
            }
            if (quiz) return quiz; // 생성 성공 시 반환
        }

        return null; // 모든 후보로 생성 실패 시 null 반환
    },
    renderQuiz(quizData) {
        const { type, question, choices } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';

        // 퀴즈 타입별 질문 UI 렌더링
        if (type === 'MULTIPLE_CHOICE_DEFINITION') { // 영영 정의
            questionDisplay.classList.remove('justify-center', 'items-center'); // 중앙 정렬 해제
            ui.displaySentences([question.definition], questionDisplay); // 상호작용 가능하게 표시
            const sentenceElement = questionDisplay.querySelector('p');
            if(sentenceElement) sentenceElement.className = 'text-lg sm:text-xl text-left text-gray-800 leading-relaxed'; // 스타일 적용
        } else if (type === 'FILL_IN_THE_BLANK') { // 빈칸 추론
            questionDisplay.classList.remove('justify-center', 'items-center');
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';
            // 예문에서 빈칸(____) 또는 *단어* 부분 처리하며 상호작용 가능하게 렌더링
            const sentenceParts = question.sentence_with_blank.split(/(\*.*?\*|＿＿＿＿)/g);
            sentenceParts.forEach(part => {
                if (part === '＿＿＿＿') {
                    const blankSpan = document.createElement('span');
                    blankSpan.style.whiteSpace = 'nowrap'; blankSpan.textContent = '＿＿＿＿';
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
        } else { // 영한 뜻 (MULTIPLE_CHOICE_MEANING)
            questionDisplay.classList.add('justify-center', 'items-center'); // 중앙 정렬
            const h1 = document.createElement('h1');
            h1.className = 'text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer';
            h1.title = "클릭하여 발음 듣기";
            h1.textContent = question.word;
            h1.onclick = () => api.speak(question.word); // 클릭 시 TTS
            questionDisplay.appendChild(h1);
            ui.adjustFontSize(h1); // 폰트 크기 자동 조절
        }

        // 선택지 UI 렌더링
        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`; // 번호 매기기
            li.onclick = () => this.checkAnswer(li, choice); // 클릭 시 정답 확인
            this.elements.choices.appendChild(li);
        });

        // PASS 버튼 추가
        const passLi = document.createElement('li');
        passLi.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED'); // PASS 처리
        this.elements.choices.appendChild(passLi);

        this.elements.choices.classList.remove('disabled'); // 선택 가능 상태로 변경
    },
    // 정답 확인 로직
    async checkAnswer(selectedLi, selectedChoice) {
        activityTracker.recordActivity(); // 사용자 활동 기록
        this.elements.choices.classList.add('disabled'); // 선택 비활성화
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        const isPass = selectedChoice === 'USER_PASSED';
        const word = this.state.currentQuiz.question.word;
        const quizType = this.state.currentQuiz.type;

        // 선택한 답 UI 피드백 (맞으면 초록, 틀리면 빨강)
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');

        // 세션 통계 업데이트
        this.state.sessionAnsweredInSet++;
        if (isCorrect) {
            this.state.sessionCorrectInSet++;
        } else {
            this.state.sessionMistakes.push(word); // 오답 단어 기록
        }

        // 연습 모드가 아닐 때만 학습 상태 업데이트 (로컬 저장)
        if (!this.state.isPracticeMode) {
             // utils.updateWordStatus가 LocalStorage에 저장
            await utils.updateWordStatus(word, quizType, (isCorrect && !isPass) ? 'correct' : 'incorrect');
        } else if (isCorrect) {
            // 연습 모드에서는 맞힌 단어 목록에 추가 (다음 퀴즈 생성 시 제외용)
             this.state.practiceLearnedWords.push(word);
        }


        // 틀렸거나 PASS 했을 때 정답 표시
        if (!isCorrect || isPass) {
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => {
                const choiceSpan = li.querySelector('span:last-child');
                return choiceSpan && choiceSpan.textContent === this.state.currentQuiz.answer;
            });
            correctAnswerEl?.classList.add('correct'); // 정답 선택지 초록색 표시
        }

        // 0.6초 후 다음 단계 진행
        setTimeout(() => {
            if (this.state.sessionAnsweredInSet >= 10) { // 10문제 풀었으면 결과 모달 표시
                this.showSessionResultModal();
            } else { // 아니면 다음 문제 표시
                this.displayNextQuiz();
            }
        }, 600);
    },
    // 퀴즈 세션 결과 모달 표시
    showSessionResultModal(isFinal = false) {
        this.elements.quizResultScore.textContent = `${this.state.sessionAnsweredInSet}문제 중 ${this.state.sessionCorrectInSet}개 정답!`;
        this.elements.quizResultMistakesBtn.classList.toggle('hidden', this.state.sessionMistakes.length === 0); // 틀린 문제 없으면 버튼 숨김
        this.elements.quizResultContinueBtn.textContent = isFinal ? "모드 선택으로" : "다음 퀴즈 계속";
        this.elements.quizResultModal.classList.remove('hidden');
    },
    // 결과 모달에서 "다음 퀴즈 계속" 버튼 클릭 시
    continueAfterResult() {
        this.elements.quizResultModal.classList.add('hidden');
        if (this.elements.quizResultContinueBtn.textContent === "모드 선택으로") {
            app.syncOfflineData(); // 모드 이동 전 동기화
            app.navigateTo('mode', app.state.selectedSheet); // 모드 선택 화면으로
            return;
        }
        // 세션 상태 초기화 후 다음 퀴즈 표시
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.displayNextQuiz();
    },
    // 결과 모달에서 "오답 노트" 버튼 클릭 시
    reviewSessionMistakes() {
        this.elements.quizResultModal.classList.add('hidden');
        const mistakes = [...new Set(this.state.sessionMistakes)]; // 중복 제거
        // 세션 상태 초기화
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        app.syncOfflineData(); // 모드 이동 전 동기화
        // 오답 목록 전달하며 오답 리뷰 모드로 이동
        app.navigateTo('mistakeReview', app.state.selectedSheet, { mistakeWords: mistakes });
    },
    // 앱 시작 시 모든 학년/타입 퀴즈 미리 로드 시작
    async preloadInitialQuizzes() {
        for (const grade of ['1y', '2y', '3y']) {
            // 해당 학년 단어 목록 없으면 로드
            if (!learningMode.state.isWordListReady[grade]) {
                await learningMode.loadWordList(false, grade);
            }
            // 각 퀴즈 타입별로 미리 로드 함수 호출
            for (const type of ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION']) {
                this.preloadNextQuiz(grade, type);
            }
        }
    },
    // 다음 퀴즈 미리 로드 (백그라운드 실행)
    async preloadNextQuiz(grade, type) {
        // 이미 진행 중이거나 미리 로드된 퀴즈 있으면 중단
        if (!grade || !type || this.state.isPreloading[grade]?.[type] || this.state.preloadedQuizzes[grade]?.[type]) {
            return;
        }

        if (!this.state.isPreloading[grade]) this.state.isPreloading[grade] = {};
        this.state.isPreloading[grade][type] = true; // 로딩 시작 플래그

        try {
            const allWords = learningMode.state.wordList[grade] || [];
            if (allWords.length < 5) return; // 단어 수 부족

            // RAM 기준 정답 맞힌 단어 (로컬 상태 미반영, preload 성능 위해)
            const learnedWordsInType = utils.getCorrectlyAnsweredWords(type);

            // 후보 단어 필터링 (RAM 기준 상태 + 타입별 정답 여부)
            const candidates = allWords.filter(wordObj => {
                 const status = utils.getWordStatus(wordObj.word); // 로컬 포함 최신 상태 확인은 필요
                 return status !== 'learned' && !learnedWordsInType.includes(wordObj.word);
            }).sort(() => 0.5 - Math.random());


            // 후보 단어 순회하며 퀴즈 생성 시도
            for (const wordData of candidates) {
                 let quiz = null;
                 if (type === 'MULTIPLE_CHOICE_MEANING') quiz = this.createMeaningQuiz(wordData, allWords);
                 else if (type === 'FILL_IN_THE_BLANK') quiz = this.createBlankQuiz(wordData, allWords);
                 else if (type === 'MULTIPLE_CHOICE_DEFINITION') {
                     const definition = await api.fetchDefinition(wordData.word);
                     if (definition) quiz = this.createDefinitionQuiz(wordData, allWords, definition);
                 }
                 if (quiz) { // 생성 성공 시
                     if (!this.state.preloadedQuizzes[grade]) this.state.preloadedQuizzes[grade] = {};
                     this.state.preloadedQuizzes[grade][type] = quiz; // 상태에 저장
                     return; // 하나만 미리 로드
                 }
            }
        } catch(e) {
            console.error(`Preloading ${grade}-${type} failed:`, e);
        } finally {
            if (this.state.isPreloading[grade]) this.state.isPreloading[grade][type] = false; // 로딩 종료 플래그
        }
    },
    // 영한 뜻 퀴즈 생성
    createMeaningQuiz(correctWordData, allWordsData) {
        const wrongAnswers = new Set();
        // 같은 품사, 다른 뜻 단어 필터링
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.meaning !== correctWordData.meaning);
        candidates.sort(() => 0.5 - Math.random());
        // 최대 3개 선택
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.meaning));
        // 부족하면 전체 단어에서 랜덤 추가
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.meaning !== correctWordData.meaning) wrongAnswers.add(randomWord.meaning);
        }
        // 정답 + 오답 섞어서 선택지 생성
        const choices = [correctWordData.meaning, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'MULTIPLE_CHOICE_MEANING', question: { word: correctWordData.word }, choices, answer: correctWordData.meaning };
    },
    // 빈칸 추론 퀴즈 생성
    createBlankQuiz(correctWordData, allWordsData) {
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null; // 예문 없으면 생성 불가

        const firstLineSentence = correctWordData.sample.split('\n')[0]; // 첫 줄만 사용
        let sentenceWithBlank = "";
        const placeholderRegex = /\*(.*?)\*/; // *word* 형식
        const match = firstLineSentence.match(placeholderRegex);
        const wordRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i'); // 단어 직접 포함 형식

        // *word* 또는 word 부분을 '＿＿＿＿'로 치환
        if (match) {
            sentenceWithBlank = firstLineSentence.replace(placeholderRegex, "＿＿＿＿").trim();
        } else if (firstLineSentence.match(wordRegex)) {
            sentenceWithBlank = firstLineSentence.replace(wordRegex, "＿＿＿＿").trim();
        } else {
            return null; // 예문에 단어 없으면 생성 불가
        }

        // 오답 선택지 생성 (위와 유사)
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = [correctWordData.word, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'FILL_IN_THE_BLANK', question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    // 영영 정의 퀴즈 생성
    createDefinitionQuiz(correctWordData, allWordsData, definition) {
        if (!definition) return null; // 정의 없으면 생성 불가
        // 오답 선택지 생성 (위와 유사)
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = [correctWordData.word, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'MULTIPLE_CHOICE_DEFINITION', question: { definition, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    // 로더 표시/숨김
    showLoader(isLoading, message = "퀴즈 데이터를 불러오는 중...") {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.loaderText.textContent = message;
        this.elements.quizSelectionScreen.classList.add('hidden'); // 로더 표시 시 선택 화면 숨김
        this.elements.contentContainer.classList.toggle('hidden', isLoading); // 로더<->콘텐츠 전환
        this.elements.finishedScreen.classList.add('hidden'); // 완료 화면 숨김
    },
    // 퀴즈 완료 화면 표시
    showFinishedScreen(message) {
        this.showLoader(false); // 로더 숨김
        this.elements.contentContainer.classList.add('hidden'); // 콘텐츠 숨김
        this.elements.finishedScreen.classList.remove('hidden'); // 완료 화면 표시
        this.elements.finishedMessage.textContent = message; // 메시지 설정
    },
};

// 학습 모드 로직
const learningMode = {
    // ... (learningMode 객체 내용은 이전과 거의 동일하게 유지, 상태 업데이트 로직은 utils 함수 호출로 변경됨) ...
     state: {
        wordList: { '1y': [], '2y': [], '3y': [] }, // 학년별 단어 목록
        isWordListReady: { '1y': false, '2y': false, '3y': false }, // 로드 완료 여부
        currentIndex: 0, // 현재 보고 있는 단어 인덱스
        isMistakeMode: false, // 오답 노트 모드 여부
        isFavoriteMode: false, // 즐겨찾기 모드 여부
        touchstartX: 0, touchstartY: 0, // 터치 스와이프 시작 좌표
        currentDisplayList: [], // 현재 화면에 표시되는 단어 목록 (일반/오답/즐찾)
        isDragging: false, // 프로그레스 바 드래그 중 여부
    },
    elements: {}, // UI 요소 참조 저장 객체
    init() { // 초기화 함수
        // UI 요소 ID로 참조 연결
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
            cardBack: document.getElementById('learning-card-back'), // 예문 표시 뒷면 카드
            wordDisplay: document.getElementById('word-display'),
            meaningDisplay: document.getElementById('meaning-display'),
            explanationDisplay: document.getElementById('explanation-display'),
            explanationContainer: document.getElementById('explanation-container'),
            fixedButtons: document.getElementById('learning-fixed-buttons'), // 하단 고정 버튼 영역
            nextBtn: document.getElementById('next-btn'),
            prevBtn: document.getElementById('prev-btn'),
            sampleBtn: document.getElementById('sample-btn'), // 예문 보기/카드 뒤집기 버튼
            sampleBtnImg: document.getElementById('sample-btn-img'),
            backTitle: document.getElementById('learning-back-title'), // 뒷면 카드 제목 (단어)
            backContent: document.getElementById('learning-back-content'), // 뒷면 카드 내용 (예문)
            progressBarTrack: document.getElementById('progress-bar-track'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressBarHandle: document.getElementById('progress-bar-handle'),
            favoriteBtn: document.getElementById('favorite-btn'),
            favoriteIcon: document.getElementById('favorite-icon'),
        };
        this.bindEvents(); // 이벤트 리스너 바인딩
    },
    bindEvents() { // 이벤트 리스너 설정
        // 학습 시작 관련
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.startWordInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.start(); });
        this.elements.startWordInput.addEventListener('input', e => { // 영어만 입력되도록 필터링 + IME 경고
            const originalValue = e.target.value;
            const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, '');
            if (originalValue !== sanitizedValue) app.showImeWarning();
            e.target.value = sanitizedValue;
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen()); // 검색 결과에서 다시 입력

        // 카드 네비게이션
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1)); // 다음 단어
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1)); // 이전 단어
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip()); // 예문 보기/뒤집기
        this.elements.wordDisplay.addEventListener('click', () => { // 단어 클릭 시 TTS
            const word = this.state.currentDisplayList[this.state.currentIndex]?.word;
            if (word) { api.speak(word); }
        });
        this.elements.wordDisplay.oncontextmenu = e => { // 단어 우클릭 시 컨텍스트 메뉴
            e.preventDefault();
            const wordData = this.state.currentDisplayList[this.state.currentIndex];
            if(wordData) ui.showWordContextMenu(e, wordData.word);
        };
        this.elements.favoriteBtn.addEventListener('click', () => this.toggleFavorite()); // 즐겨찾기 버튼

        // 단어 길게 누르기 (터치)
        let wordDisplayTouchMove = false;
        this.elements.wordDisplay.addEventListener('touchstart', e => { wordDisplayTouchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { const wordData = this.state.currentDisplayList[this.state.currentIndex]; if (!wordDisplayTouchMove && wordData) ui.showWordContextMenu(e, wordData.word); }, 700); }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => { wordDisplayTouchMove = true; clearTimeout(app.state.longPressTimer); });
        this.elements.wordDisplay.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });

        // 마우스 휠클릭(가운데 버튼)으로 카드 뒤집기
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        // 키보드 이벤트 (방향키, Enter, Space)
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        // 터치 스와이프 이벤트
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        // 프로그레스 바 상호작용 (클릭, 드래그, 터치)
        this.elements.progressBarTrack.addEventListener('mousedown', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mousemove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mouseup', this.handleProgressBarInteraction.bind(this));
        this.elements.progressBarTrack.addEventListener('touchstart', this.handleProgressBarInteraction.bind(this), { passive: false }); // preventDefault 위해 passive: false
        document.addEventListener('touchmove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('touchend', this.handleProgressBarInteraction.bind(this));
    },
    // 단어 목록 로드 (Firebase RTDB 또는 LocalStorage 캐시)
    async loadWordList(force = false, grade = app.state.selectedSheet) {
        if (!grade) return; // 학년 정보 없으면 중단
        // 강제 새로고침 아니면서 이미 로드된 상태면 중단
        if (!force && this.state.isWordListReady[grade]) return;

        // 강제 새로고침 시 캐시 삭제 및 상태 초기화
        if (force) {
            try { localStorage.removeItem(`wordListCache_${grade}`); } catch(e) {}
            this.state.isWordListReady[grade] = false;
        }

        // LocalStorage 캐시 확인
        try {
            const cachedData = localStorage.getItem(`wordListCache_${grade}`);
            if (cachedData) {
                const { timestamp, words } = JSON.parse(cachedData);

                // 캐시 유효기간 확인 (이번 주 월요일 이후 데이터인지)
                const now = new Date();
                const lastMonday = new Date(now);
                const todayDay = now.getDay(); // 0(일)~6(토)
                const diff = todayDay === 0 ? 6 : todayDay - 1; // 월요일과의 날짜 차이
                lastMonday.setDate(now.getDate() - diff);
                lastMonday.setHours(0, 0, 0, 0); // 월요일 0시

                if (timestamp >= lastMonday.getTime()) { // 캐시가 유효하면
                    this.state.wordList[grade] = words.sort((a, b) => a.id - b.id); // id 순 정렬
                    this.state.isWordListReady[grade] = true; // 로드 완료 상태로 변경
                    return; // 로드 종료
                }
            }
        } catch (e) {
            console.warn("Error reading or parsing word list cache:", e);
            try { localStorage.removeItem(`wordListCache_${grade}`); } catch(e2) {} // 파싱 오류 시 캐시 삭제
        }

        // 캐시 없거나 만료 시 Firebase RTDB에서 로드
        try {
            const dbRef = ref(rt_db, `${grade}/vocabulary`); // 해당 학년 경로 참조
            const snapshot = await get(dbRef); // 데이터 가져오기
            const data = snapshot.val();
            if (!data) throw new Error(`Firebase에 '${grade}' 단어 데이터가 없습니다.`);

            // 객체를 배열로 변환하고 id 순 정렬
            const wordsArray = Object.values(data).sort((a, b) => a.id - b.id);
            this.state.wordList[grade] = wordsArray;
            this.state.isWordListReady[grade] = true; // 로드 완료

            // LocalStorage에 캐시 저장 (타임스탬프 포함)
            const cachePayload = { timestamp: Date.now(), words: wordsArray };
             try { localStorage.setItem(`wordListCache_${grade}`, JSON.stringify(cachePayload)); } catch(e) { console.error("Error saving word list cache:", e); }
        } catch (error) {
            this.showError(error.message); // 오류 메시지 표시
            throw error; // 에러 다시 던져서 상위에서 처리
        }
    },
    // 학습 시작 (일반 모드)
    async start() {
        activityTracker.recordActivity(); // 사용자 활동 기록
        const grade = app.state.selectedSheet;
        // 단어 목록 준비 안 됐으면 로드
        if (!this.state.isWordListReady[grade]) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            this.elements.loader.classList.remove('hidden');
            this.elements.startScreen.classList.add('hidden');
            await this.loadWordList(false, grade);
            this.elements.loader.classList.add('hidden');
            this.elements.startScreen.classList.remove('hidden');
            if (!this.state.isWordListReady[grade]) return; // 로드 실패 시 중단
        }

        this.state.isMistakeMode = false; // 모드 상태 초기화
        this.state.isFavoriteMode = false;
        const currentWordList = this.state.wordList[grade]; // 현재 학년 단어 목록
        const startWord = this.elements.startWordInput.value.trim().toLowerCase(); // 입력 단어

        // 입력 단어 없으면 마지막 위치 또는 처음부터 시작
        if (!startWord) {
            this.elements.startScreen.classList.add('hidden');
            try {
                // LocalStorage에서 마지막 인덱스 가져오기
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(grade);
                const savedIndex = parseInt(localStorage.getItem(key) || '0');
                this.state.currentIndex = (savedIndex >= 0 && savedIndex < currentWordList.length) ? savedIndex : 0;
            } catch(e) {
                this.state.currentIndex = 0; // 오류 시 처음부터
            }
            this.launchApp(currentWordList); // 학습 화면 실행
            return;
        }

        // 입력 단어와 정확히 일치하는 단어 찾기
        const exactMatchIndex = currentWordList.findIndex(item => item.word.toLowerCase() === startWord);
        if (exactMatchIndex !== -1) { // 찾았으면
            this.elements.startScreen.classList.add('hidden');
            this.state.currentIndex = exactMatchIndex; // 해당 인덱스로 설정
            this.launchApp(currentWordList); // 학습 화면 실행
            return;
        }

        // 정확히 일치하는 단어 없으면 유사 단어 및 설명 포함 단어 검색
        const searchRegex = new RegExp(`\\b${startWord}\\b`, 'i'); // 설명 검색용 정규식
        // 설명에 포함된 단어 검색
        const explanationMatches = currentWordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((item, index) => {
                const explanation = currentWordList[index].explanation;
                if (!explanation) return false;
                const cleanedExplanation = explanation.replace(/\[.*?\]/g, ''); // [...] 부분 제거
                return searchRegex.test(cleanedExplanation);
            });
        // 유사 단어 검색 (Levenshtein 거리 사용) - 상위 5개, 거리 임계값 적용
        const levenshteinSuggestions = currentWordList
            .map((item, index) => ({
                word: item.word, index,
                distance: levenshteinDistance(startWord, item.word.toLowerCase())
            }))
            .sort((a, b) => a.distance - b.distance) // 거리 순 정렬
            .slice(0, 5) // 상위 5개
            .filter(s => s.distance < s.word.length / 2 + 1); // 너무 다른 단어 제외

        // 검색 결과 있으면 제안 화면 표시
        if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) {
            const title = `<strong>'${startWord}'</strong>(을)를 찾을 수 없습니다. 혹시 이 단어인가요?`;
            this.displaySuggestions(levenshteinSuggestions, explanationMatches, currentWordList, title);
        } else { // 결과 없으면 없다고 표시
            const title = `<strong>'${startWord}'</strong>에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], [], currentWordList, title);
        }
    },
    // 오답 노트 학습 시작
    async startMistakeReview(mistakeWordsFromQuiz) {
        this.state.isMistakeMode = true; // 모드 상태 설정
        this.state.isFavoriteMode = false;
        const grade = app.state.selectedSheet;
        // 단어 목록 준비 확인 및 로드
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }

        // 오답 단어 목록 가져오기 (퀴즈 결과에서 오거나 전체 오답 목록)
        const incorrectWords = mistakeWordsFromQuiz || utils.getIncorrectWords();

        // 오답 없으면 메시지 표시 후 모드 선택 화면으로
        if (incorrectWords.length === 0) {
            app.showToast("오답 노트에 단어가 없습니다!", false); // isError = false
            app.navigateTo('mode', grade);
            return;
        }
        // 전체 단어 목록에서 오답 단어만 필터링
        const mistakeWordList = this.state.wordList[grade].filter(wordObj => incorrectWords.includes(wordObj.word));
        this.state.currentIndex = 0; // 처음부터 시작
        this.launchApp(mistakeWordList); // 학습 화면 실행
    },
    // 즐겨찾기 학습 시작
    async startFavoriteReview() {
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = true; // 모드 상태 설정
        const grade = app.state.selectedSheet;
        // 단어 목록 준비 확인 및 로드
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }

        // 즐겨찾기 단어 목록 가져오기 (로컬 상태 반영)
        const favoriteWords = utils.getFavoriteWords();
        // 즐겨찾기 없으면 메시지 표시 후 모드 선택 화면으로
        if (favoriteWords.length === 0) {
            app.showToast("즐겨찾기에 등록된 단어가 없습니다!", false); // isError = false
            app.navigateTo('mode', grade);
            return;
        }

        // 전체 단어 목록에서 즐겨찾기 단어만 필터링
        const favoriteWordList = favoriteWords.map(word => this.state.wordList[grade].find(wordObj => wordObj.word === word)).filter(Boolean); // filter(Boolean)으로 혹시 모를 null 제거
        this.state.currentIndex = 0; // 처음부터 시작
        this.launchApp(favoriteWordList); // 학습 화면 실행
    },
    // 단어 검색 제안 화면 표시
    displaySuggestions(vocabSuggestions, explanationSuggestions, sourceList, title) {
        this.elements.startInputContainer.classList.add('hidden'); // 입력 영역 숨김
        this.elements.suggestionsTitle.innerHTML = title; // 제목 설정

        // 제안 목록 UI 생성 함수
        const populateList = (listElement, suggestions) => {
            listElement.innerHTML = ''; // 기존 목록 비우기
            if (suggestions.length === 0) { // 제안 없으면 메시지 표시
                listElement.innerHTML = '<p class="text-gray-400 text-sm p-3">결과 없음</p>';
                return;
            }
            // 각 제안 단어 버튼 생성
            suggestions.forEach(({ word, index }) => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 py-3 px-4 rounded-lg transition-colors';
                btn.textContent = word;
                // 클릭 시 해당 단어로 학습 시작
                btn.onclick = () => { this.state.currentIndex = index; this.launchApp(sourceList); };
                listElement.appendChild(btn);
            });
        };

        // 유사 단어 / 설명 포함 단어 목록 각각 채우기
        populateList(this.elements.suggestionsVocabList, vocabSuggestions);
        populateList(this.elements.suggestionsExplanationList, explanationSuggestions);

        this.elements.suggestionsContainer.classList.remove('hidden'); // 제안 컨테이너 표시
    },
    // 학습 모드 초기화 (다른 모드로 전환 시)
    reset() {
        this.elements.appContainer.classList.add('hidden'); // 학습 카드 숨김
        this.elements.loader.classList.add('hidden'); // 로더 숨김
        this.elements.fixedButtons.classList.add('hidden'); // 하단 버튼 숨김
        app.elements.progressBarContainer.classList.add('hidden'); // 프로그레스 바 숨김
        this.state.currentDisplayList = []; // 현재 목록 비우기
    },
    // 학습 시작 화면 초기화 (재검색 등)
    resetStartScreen() {
        this.reset(); // 기본 리셋 호출
        this.elements.startScreen.classList.remove('hidden'); // 시작 화면 표시
        this.elements.startInputContainer.classList.remove('hidden'); // 입력 영역 표시
        this.elements.suggestionsContainer.classList.add('hidden'); // 제안 영역 숨김
        this.elements.startWordInput.value = ''; // 입력 값 초기화
        this.elements.startWordInput.focus(); // 입력 창 포커스
        // 현재 선택된 학년 단어 목록 미리 로드 (캐시 있으면 빠름)
        if (app.state.selectedSheet) {
            this.loadWordList(false, app.state.selectedSheet);
        }
    },
    // 오류 메시지 표시 (로더 영역)
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none'; // 스피너 숨김
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    // 학습 화면 실행
    launchApp(wordList) {
        this.state.currentDisplayList = wordList; // 현재 표시할 단어 목록 설정
        app.elements.refreshBtn.classList.add('hidden'); // 새로고침 버튼 숨김 (학습 중에는 X)
        this.elements.startScreen.classList.add('hidden'); // 시작 화면 숨김
        this.elements.loader.classList.add('hidden'); // 로더 숨김
        this.elements.appContainer.classList.remove('hidden'); // 학습 카드 표시
        this.elements.fixedButtons.classList.remove('hidden'); // 하단 버튼 표시
        app.elements.progressBarContainer.classList.remove('hidden'); // 프로그레스 바 표시
        this.displayWord(this.state.currentIndex); // 현재 인덱스 단어 표시
    },
    // 특정 인덱스의 단어 정보 표시
    async displayWord(index) {
        activityTracker.recordActivity(); // 사용자 활동 기록
        this.updateProgressBar(index); // 프로그레스 바 업데이트
        this.elements.cardBack.classList.remove('is-slid-up'); // 뒷면 카드 숨김
        const wordData = this.state.currentDisplayList[index]; // 현재 단어 데이터
        if (!wordData) return; // 데이터 없으면 중단

        // 일반 학습 모드일 때만 마지막 인덱스 저장
        if (!this.state.isMistakeMode && !this.state.isFavoriteMode) {
             try {
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(app.state.selectedSheet);
                localStorage.setItem(key, index);
            } catch (e) {
                console.error("Error saving last index to localStorage", e);
            }
        }

        // UI 요소 업데이트
        this.elements.wordDisplay.textContent = wordData.word; // 단어 표시
        ui.adjustFontSize(this.elements.wordDisplay); // 폰트 크기 조절

        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>'); // 뜻 표시 (줄바꿈 처리)
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation); // 설명 표시 (상호작용)
        // 설명 없으면 숨김
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        const hasSample = wordData.sample && wordData.sample.trim() !== ''; // 예문 유무 확인

        // 예문 버튼 이미지 설정 (캐싱 적용)
        const defaultImg = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png'; // 예문 없음
        const sampleImg = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png'; // 예문 있음
        this.elements.sampleBtnImg.src = await imageDBCache.loadImage(hasSample ? sampleImg : defaultImg);

        // [수정] 즐겨찾기 아이콘 상태 업데이트 (로컬 상태 반영)
        const grade = app.state.selectedSheet;
        let isFavorite = app.state.currentProgress[wordData.word]?.favorite || false;
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
                if (unsynced[wordData.word] && unsynced[wordData.word].favorite !== undefined) {
                    isFavorite = unsynced[wordData.word].favorite; // 로컬 변경사항 있으면 덮어씀
                }
            } catch (e) { console.warn("Error reading local favorite status:", e); }
        }
        this.updateFavoriteIcon(isFavorite);
    },
    // 즐겨찾기 아이콘 UI 업데이트
    updateFavoriteIcon(isFavorite) {
        const icon = this.elements.favoriteIcon;
        icon.classList.toggle('fill-current', isFavorite); // 채우기
        icon.classList.toggle('text-yellow-400', isFavorite); // 노란색
        icon.classList.toggle('text-gray-400', !isFavorite); // 회색
    },
    // 즐겨찾기 상태 토글 (로컬 저장)
    async toggleFavorite() {
        activityTracker.recordActivity(); // 사용자 활동 기록
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        if (!wordData) return;

        // [수정] utils.toggleFavorite 호출 (로컬 저장 후 상태 반환)
        const isFavorite = await utils.toggleFavorite(wordData.word);
        this.updateFavoriteIcon(isFavorite); // 아이콘 UI 업데이트

        // 즐겨찾기 모드에서 즐겨찾기 해제 시 목록에서 제거 및 다음 단어 표시
        if (this.state.isFavoriteMode && !isFavorite) {
             this.state.currentDisplayList.splice(this.state.currentIndex, 1); // 현재 목록에서 제거
             if (this.state.currentDisplayList.length === 0) { // 목록 비었으면
                 app.showToast("즐겨찾기 목록이 비었습니다.", false);
                 app.navigateTo('mode', app.state.selectedSheet); // 모드 선택으로 이동
                 return;
             }
             // 인덱스 조정 (삭제 후 현재 인덱스가 목록 길이 넘어가면 마지막으로)
             if(this.state.currentIndex >= this.state.currentDisplayList.length) {
                 this.state.currentIndex = this.state.currentDisplayList.length - 1;
             }
             this.displayWord(this.state.currentIndex); // 조정된 인덱스 단어 표시
        }
    },
    // 이전/다음 단어 이동
    navigate(direction) {
        activityTracker.recordActivity(); // 사용자 활동 기록
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up'); // 뒷면 보이는지 확인
        const len = this.state.currentDisplayList.length;
        if (len === 0) return; // 단어 없으면 중단
        // 다음 인덱스 계산 (순환)
        const navigateAction = () => { this.state.currentIndex = (this.state.currentIndex + direction + len) % len; this.displayWord(this.state.currentIndex); };
        // 뒷면 보이면 뒤집고 나서 이동, 아니면 바로 이동
        if (isBackVisible) { this.handleFlip(); setTimeout(navigateAction, 300); } // 0.3초 후 이동
        else { navigateAction(); }
    },
    // 카드 뒤집기 (앞면 <-> 뒷면 예문)
    async handleFlip() {
        activityTracker.recordActivity(); // 사용자 활동 기록
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        const hasSample = wordData && wordData.sample && wordData.sample.trim() !== '';

        // 버튼 이미지 URL (캐싱 위해)
        const backImgUrl = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png'; // 뒤로가기 아이콘
        const sampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png'; // 예문 있음 아이콘
        const noSampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png'; // 예문 없음 아이콘

        if (!isBackVisible) { // 현재 앞면 -> 뒷면으로
            if (!hasSample) { app.showNoSampleMessage(); return; } // 예문 없으면 메시지 표시 후 중단
            // 뒷면 카드 내용 설정
            this.elements.backTitle.textContent = wordData.word; // 단어 제목
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent); // 예문 표시
            this.elements.cardBack.classList.add('is-slid-up'); // 슬라이드 업 애니메이션 클래스 추가
            this.elements.sampleBtnImg.src = await imageDBCache.loadImage(backImgUrl); // 버튼 아이콘 변경 (뒤로가기)
        } else { // 현재 뒷면 -> 앞면으로
            this.elements.cardBack.classList.remove('is-slid-up'); // 슬라이드 다운
            // 버튼 아이콘 원래대로 (예문 유무 따라) - displayWord에서 처리하므로 여기선 제거
            // this.elements.sampleBtnImg.src = await imageDBCache.loadImage(hasSample ? sampleImgUrl : noSampleImgUrl);
            this.displayWord(this.state.currentIndex); // 앞면 다시 렌더링 (혹시 모를 상태 변경 반영)
        }
    },
    // 현재 학습 모드 활성화 여부 반환
    isLearningModeActive() { return !this.elements.appContainer.classList.contains('hidden'); },
    // 마우스 휠클릭(가운데 버튼) 이벤트 처리
    handleMiddleClick(e) { if (this.isLearningModeActive() && e.button === 1) { e.preventDefault(); this.elements.sampleBtn.click(); } }, // 휠클릭 시 카드 뒤집기
    // 키보드 이벤트 처리
    handleKeyDown(e) {
        // 학습 모드 아니거나 입력 필드 포커스 시 무시
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        activityTracker.recordActivity(); // 사용자 활동 기록
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': -1, 'ArrowDown': 1 }; // 방향키 매핑
        if (keyMap[e.key] !== undefined) { e.preventDefault(); this.navigate(keyMap[e.key]); } // 방향키: 이전/다음
        else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); } // Enter: 카드 뒤집기
        else if (e.key === ' ') { e.preventDefault(); if (!this.elements.cardBack.classList.contains('is-slid-up')) api.speak(this.elements.wordDisplay.textContent); } // Space: 단어 TTS (앞면일 때만)
    },
    // 터치 시작 이벤트 처리 (스와이프 시작점 기록)
    handleTouchStart(e) {
        // 학습 모드 아니거나 특정 요소 터치 시 무시
        if (!this.isLearningModeActive() || e.target.closest('.interactive-word, #word-display, #favorite-btn, #progress-bar-track, #sample-btn, #prev-btn, #next-btn')) return;
        this.state.touchstartX = e.changedTouches[0].screenX; this.state.touchstartY = e.changedTouches[0].screenY;
    },
    // 터치 종료 이벤트 처리 (스와이프 방향 판단 및 네비게이션)
    handleTouchEnd(e) {
        // 학습 모드 아니거나 시작점 없거나 특정 요소 터치 종료 시 무시
        if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick], #progress-bar-track')) { this.state.touchstartX = this.state.touchstartY = 0; return; }
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX; // X축 이동 거리
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY; // Y축 이동 거리
        // 좌우 스와이프 (X 이동 거리가 더 크고 50px 이상)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1); // 오른쪽: 이전, 왼쪽: 다음
        // 상하 스와이프 (Y 이동 거리가 더 크고 50px 이상, 특정 영역 제외) - 위로 스와이프 시 다음 단어 (선택적)
        // else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50 && !e.target.closest('#learning-app-container')) { if (deltaY < 0) this.navigate(1); }
        this.state.touchstartX = this.state.touchstartY = 0; // 시작점 초기화
    },
    // 프로그레스 바 UI 업데이트
    updateProgressBar(index) {
        const total = this.state.currentDisplayList.length;
        if (total <= 1) { // 단어 1개 이하면 항상 100%
            this.elements.progressBarFill.style.width = '100%';
            this.elements.progressBarHandle.style.left = '100%';
            return;
        }
        const percentage = (index / (total - 1)) * 100; // 현재 인덱스 비율 계산
        this.elements.progressBarFill.style.width = `${percentage}%`; // 채우기 업데이트
        // 핸들 위치 계산 (핸들 너비 절반 빼서 중앙 정렬)
        this.elements.progressBarHandle.style.left = `calc(${percentage}% - ${this.elements.progressBarHandle.offsetWidth / 2}px)`;
    },
    // 프로그레스 바 상호작용 (클릭/드래그/터치) 처리
    handleProgressBarInteraction(e) {
        if (!this.isLearningModeActive()) return; // 학습 모드 아니면 무시

        const track = this.elements.progressBarTrack;
        const totalWords = this.state.currentDisplayList.length;
        if (totalWords <= 1) return; // 단어 1개 이하면 무시

        // 클릭/터치 위치 기반으로 인덱스 계산 및 단어 표시 함수
        const handleInteraction = (clientX) => {
            activityTracker.recordActivity(); // 사용자 활동 기록
            const rect = track.getBoundingClientRect(); // 트랙 위치/크기
            const x = clientX - rect.left; // 트랙 내 클릭 X 좌표
            const percentage = Math.max(0, Math.min(1, x / rect.width)); // 0~1 사이 비율로 변환
            const newIndex = Math.round(percentage * (totalWords - 1)); // 인덱스 계산 (반올림)
            if (newIndex !== this.state.currentIndex) { // 인덱스 변경 시
                this.state.currentIndex = newIndex;
                this.displayWord(newIndex); // 해당 단어 표시
            }
        };

        // 이벤트 타입별 처리
        switch (e.type) {
            case 'mousedown': // 마우스 누를 때
                this.state.isDragging = true; // 드래그 시작
                handleInteraction(e.clientX); // 현재 위치로 이동
                break;
            case 'mousemove': // 마우스 이동 시 (드래그 중일 때만)
                if (this.state.isDragging) handleInteraction(e.clientX);
                break;
            case 'mouseup': // 마우스 뗄 때
            case 'mouseleave': // 마우스 벗어날 때 (추가)
                this.state.isDragging = false; // 드래그 종료
                break;
            case 'touchstart': // 터치 시작 시
                e.preventDefault(); // 스크롤 방지
                this.state.isDragging = true;
                handleInteraction(e.touches[0].clientX);
                break;
            case 'touchmove': // 터치 이동 시 (드래그 중일 때만)
                if (this.state.isDragging) handleInteraction(e.touches[0].clientX);
                break;
            case 'touchend': // 터치 뗄 때
                this.state.isDragging = false;
                break;
        }
    },
};

// Levenshtein 거리 계산 함수 (두 문자열 간 편집 거리)
function levenshteinDistance(a = '', b = '') {
    // 행렬 생성 및 초기화
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i; // 첫 행 초기화 (0~a 길이)
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j; // 첫 열 초기화 (0~b 길이)
    // 행렬 채우기 (동적 프로그래밍)
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            // 문자가 같으면 비용 0, 다르면 1
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            // 왼쪽, 위쪽, 왼쪽 위 대각선 값 중 최소값 + 비용
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // 삽입
                track[j - 1][i] + 1, // 삭제
                track[j - 1][i - 1] + indicator, // 변경 또는 같음
            );
        }
    }
    // 최종 우측 하단 값 반환
    return track[b.length][a.length];
}
