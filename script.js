let firebaseApp, auth, db, rt_db;
let initializeApp;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;
let getDatabase, ref, get, set;
let getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch;

document.addEventListener('firebaseSDKLoaded', () => {
    ({
        initializeApp,
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
        getDatabase, ref, get, set,
        getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch
    } = window.firebaseSDK);
    window.firebaseSDK.writeBatch = writeBatch;

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
            databaseURL: "https://wordapp-91c0a-default-rtdb.asia-southeast1.firebasedatabase.app/"
        },
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzmcgauS6eUd2QAncKzX_kQ1K1b7x7xn2k6s1JWwf-FxmrbIt-_9-eAvNrFkr5eDdwr0w/exec",
        MERRIAM_WEBSTER_API_KEY: "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3",
        sheetLinks: {
            '1y': 'https://docs.google.com/spreadsheets/d/1r7fWUV1ea9CU-s2iSOwLKexEe2_7L8oUKhK0n1DpDUM/edit?usp=sharing',
            '2y': 'https://docs.google.com/spreadsheets/d/1Xydj0im3Cqq9JhjN8IezZ-7DBp1-DV703cCIb3ORdc8/edit?usp=sharing',
            '3y': 'https://docs.google.com/spreadsheets/d/1Z_n9IshFSC5cBBW6IkZNfQsLb2BBrp9QeOlsGsCkn2Y/edit?usp=sharing'
        },
        backgroundImages: [],
        adminEmail: 'puroome@gmail.com'
    },
    state: {
        user: null,
        currentProgress: {},
        selectedSheet: '',
        isAppReady: false,
        translateDebounceTimeout: null,
        longPressTimer: null,
        lastCacheTimestamp: { '1y': null, '2y': null, '3y': null },
        audioContext: null,
        LOCAL_STORAGE_KEYS: { // 로컬 스토리지 키 관리
            LAST_GRADE: 'student_lastGrade', // 마지막 선택 학년
            PRACTICE_MODE: 'student_practiceMode', // 연습 모드 여부
            LAST_INDEX: (grade) => `student_lastIndex_${grade}`, // 학년별 마지막 학습 단어 인덱스
            UNSYNCED_TIME: (grade) => `student_unsyncedTime_${grade}`, // 동기화 안 된 학습 시간
            UNSYNCED_QUIZ: (grade) => `student_unsyncedQuizStats_${grade}`, // 동기화 안 된 퀴즈 통계
            UNSYNCED_PROGRESS_UPDATES: (grade) => `student_unsyncedProgress_${grade}`, // 동기화 안 된 학습 진도
            CACHE_TIMESTAMP: (grade) => `wordListCacheTimestamp_${grade}`, // 단어 목록 캐시 타임스탬프
            CACHE_VERSION: (grade) => `wordListVersion_${grade}`, // 단어 목록 캐시 버전
            // [추가] 퀴즈 범위 저장을 위한 로컬 스토리지 키 추가
            QUIZ_RANGE_START: (grade) => `student_quizRangeStart_${grade}`, // 학년별 퀴즈 시작 범위
            QUIZ_RANGE_END: (grade) => `student_quizRangeEnd_${grade}` // 학년별 퀴즈 끝 범위
            // [추가] 끝
        }
    },
    elements: { // 자주 사용하는 HTML 요소 저장
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
        lastUpdatedText: document.getElementById('last-updated-text')
    },
    async init() { // 앱 초기화 함수
        // Firebase 앱 초기화
        firebaseApp = initializeApp(this.config.firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        rt_db = getDatabase(firebaseApp);

        // IndexedDB 캐시 초기화 및 배경 이미지 미리 로드
        await Promise.all([
            translationDBCache.init(),
            audioDBCache.init(),
            imageDBCache.init(),
            this.fetchAndSetBackgroundImages()
        ]).catch(e => console.error("Cache or image init failed", e));

        // 전역 이벤트 리스너 바인딩 및 각 모듈 초기화
        this.bindGlobalEvents();
        quizMode.init();
        learningMode.init();
        dashboard.init();

        // 저장된 연습 모드 상태 불러오기
        try {
            const savedPracticeMode = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.PRACTICE_MODE);
            if (savedPracticeMode === 'true') {
                quizMode.state.isPracticeMode = true;
                this.elements.practiceModeCheckbox.checked = true;
            }
        } catch (e) {
            console.error("Error reading practice mode from localStorage", e);
        }

        // Firebase 인증 상태 변경 감지
        onAuthStateChanged(auth, async (user) => {
            if (user) { // 로그인 상태일 때
                this.state.user = user;
                // 사용자 정보 Firestore에 저장 (없으면 생성, 있으면 업데이트)
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    displayName: user.displayName,
                    email: user.email
                }, { merge: true });

                // UI 업데이트: 로그인 화면 숨기고 메인 화면 표시
                this.elements.loginScreen.classList.add('hidden');
                this.elements.mainContainer.classList.remove('hidden');
                document.body.classList.remove('items-center'); // 중앙 정렬 제거

                // 사용자 학습 진행도 불러오기 및 오프라인 데이터 동기화
                await utils.loadUserProgress();
                await this.syncOfflineData();

                // 앱 준비 상태 확인 및 초기 퀴즈 미리 로드
                if (!this.state.isAppReady) {
                    this.state.isAppReady = true;
                    await quizMode.preloadInitialQuizzes();
                }

                // URL 해시(#) 또는 로컬 스토리지 기반으로 초기 화면 결정
                const hash = window.location.hash.substring(1);
                const [view, gradeFromHash] = hash.split('-');

                let initialState = { view: 'grade' }; // 기본값: 학년 선택 화면
                try {
                    const lastGrade = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.LAST_GRADE);

                    if (gradeFromHash && ['1y', '2y', '3y'].includes(gradeFromHash)) { // #view-grade 형태
                        if (['mode', 'quiz', 'learning', 'dashboard', 'mistakeReview', 'favoriteReview'].includes(view)) {
                            initialState = { view: view, grade: gradeFromHash };
                        }
                    } else if (['1y', '2y', '3y'].includes(view)) { // #grade 형태 (mode 선택 화면으로)
                         initialState = { view: 'mode', grade: view };
                    } else if (lastGrade && ['1y', '2y', '3y'].includes(lastGrade)) { // 저장된 학년이 있으면
                        initialState = { view: 'mode', grade: lastGrade };
                    }
                } catch(e) {
                    console.error("Error reading last grade from localStorage", e);
                    initialState = { view: 'grade' }; // 오류 시 학년 선택 화면으로
                }

                history.replaceState(initialState, ''); // 브라우저 히스토리 상태 설정
                this._renderView(initialState.view, initialState.grade); // 해당 화면 렌더링
            } else { // 로그아웃 상태일 때
                this.state.user = null;
                this.state.currentProgress = {};
                // UI 업데이트: 메인 화면 숨기고 로그인 화면 표시
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.mainContainer.classList.add('hidden');
                document.body.classList.add('items-center'); // 중앙 정렬 추가
                this._renderView(null); // 모든 뷰 숨김
            }
        });
    },
    async syncOfflineData() { // 오프라인 상태에서 저장된 데이터 동기화
        if (!app.state.user) return; // 로그인 상태 아니면 중단

        for (const grade of ['1y', '2y', '3y']) { // 각 학년별로 반복
            try {
                // 학습 시간 동기화
                const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(grade);
                const timeToSync = parseInt(localStorage.getItem(timeKey) || '0');
                if (timeToSync > 0) {
                    await utils.saveStudyHistory(timeToSync, grade); // Firestore에 저장
                    localStorage.removeItem(timeKey); // 로컬 데이터 삭제
                }

                // 퀴즈 통계 동기화
                const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
                const statsToSync = JSON.parse(localStorage.getItem(quizKey) || 'null');
                if (statsToSync) {
                    await utils.syncQuizHistory(statsToSync, grade); // Firestore에 저장
                    localStorage.removeItem(quizKey); // 로컬 데이터 삭제
                }

                 // 학습 진도 동기화
                 const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                 const progressToSync = JSON.parse(localStorage.getItem(progressKey) || 'null');
                 if (progressToSync && Object.keys(progressToSync).length > 0) {
                     await utils.syncProgressUpdates(progressToSync, grade); // Firestore에 저장
                     localStorage.removeItem(progressKey); // 로컬 데이터 삭제
                 }

            } catch (error) {
                console.error(`Offline data sync failed for grade ${grade}:`, error);
            }
        }
        await utils.loadUserProgress(); // 동기화 후 최신 학습 진도 다시 로드
    },
    bindGlobalEvents() { // 앱 전역에서 사용되는 이벤트 리스너 바인딩
        // 로그인 버튼 클릭 시 Google 로그인 팝업
        this.elements.loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Google Sign-In Error:", error);
                this.showToast("로그인에 실패했습니다. 다시 시도해 주세요.", true);
            });
        });

        // 로그아웃 버튼 클릭 시 Firebase 로그아웃
        this.elements.logoutBtn.addEventListener('click', () => signOut(auth));

        // 학년 선택 카드 클릭 시 해당 학년 저장 및 모드 선택 화면으로 이동
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

        // 모드 선택 버튼들 클릭 시 해당 모드 화면으로 이동
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz', this.state.selectedSheet));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning', this.state.selectedSheet));
        document.getElementById('select-dashboard-btn').addEventListener('click', () => this.navigateTo('dashboard', this.state.selectedSheet));
        document.getElementById('select-mistakes-btn').addEventListener('click', () => this.navigateTo('mistakeReview', this.state.selectedSheet));
        this.elements.selectFavoritesBtn.addEventListener('click', () => this.navigateTo('favoriteReview', this.state.selectedSheet));

        // 홈 버튼 클릭 시 모드 선택 화면으로 이동
        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('mode', this.state.selectedSheet));
        // 학년 선택 버튼 클릭 시 학년 선택 화면으로 이동
        this.elements.backToGradeSelectionBtn.addEventListener('click', () => this.navigateTo('grade'));

        // 새로고침 버튼 클릭 시 확인 모달 표시 (관리자용)
        this.elements.refreshBtn.addEventListener('click', () => {
            if (!this.state.selectedSheet) return;
            this.elements.confirmationModal.classList.remove('hidden');
        });
        // 확인 모달 '아니오' 클릭 시 모달 숨김
        this.elements.confirmNoBtn.addEventListener('click', () => this.elements.confirmationModal.classList.add('hidden'));
        // 확인 모달 '예' 클릭 시 데이터 강제 새로고침 실행
        this.elements.confirmYesBtn.addEventListener('click', () => {
            this.elements.confirmationModal.classList.add('hidden');
            this.forceRefreshData();
        });

        // 연습 모드 체크박스 변경 시 상태 저장 및 퀴즈 재시작
        this.elements.practiceModeCheckbox.addEventListener('change', (e) => {
            quizMode.state.isPracticeMode = e.target.checked;
            try {
                localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.PRACTICE_MODE, quizMode.state.isPracticeMode);
            } catch (err) {
                console.error("Error saving practice mode state:", err);
            }
            // 현재 퀴즈 타입이 있으면 해당 타입으로 퀴즈 다시 시작
            if (quizMode.state.currentQuizType) {
                 quizMode.start(quizMode.state.currentQuizType);
            }
        });

        // 단어 컨텍스트 메뉴 외부 클릭 시 메뉴 숨김
        document.addEventListener('click', (e) => {
            if (this.elements.wordContextMenu && !this.elements.wordContextMenu.contains(e.target)) {
                ui.hideWordContextMenu();
            }
        });

        // 특정 요소(단어) 외의 영역에서 우클릭 방지
        document.addEventListener('contextmenu', (e) => {
            const isWhitelisted = e.target.closest('.interactive-word, #word-display');
            if (!isWhitelisted) e.preventDefault();
        });

        // 브라우저 뒤로가기/앞으로가기 시 오프라인 데이터 동기화 및 뷰 렌더링
        window.addEventListener('popstate', (e) => {
            this.syncOfflineData();
            const state = e.state || { view: 'grade' }; // 상태 없으면 학년 선택 화면으로
            this._renderView(state.view, state.grade);
        });

        // 페이지 닫기/새로고침 전에 남은 학습 시간 저장 및 동기화 시도
        window.addEventListener('beforeunload', (e) => {
            activityTracker.stopAndSave(); // 남은 시간 로컬 스토리지에 저장
            this.syncOfflineDataSync(); // 동기화 시도 (best-effort)
        });

        // 비프음 재생 위한 AudioContext 초기화 (사용자 인터랙션 시)
        const initAudioForBeep = () => {
            if (!this.state.audioContext) {
                 try {
                     this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                 } catch (e) {
                     console.error("Web Audio API is not supported in this browser", e);
                 }
            }
            // 초기화 후 리스너 제거
            document.body.removeEventListener('click', initAudioForBeep, { capture: true });
            document.body.removeEventListener('touchstart', initAudioForBeep, { capture: true, passive: true });
        };
        document.body.addEventListener('click', initAudioForBeep, { capture: true, once: true });
        document.body.addEventListener('touchstart', initAudioForBeep, { capture: true, passive: true, once: true });
    },
     syncOfflineDataSync() { // 페이지 닫기 직전에 동기화 시도 (성공 보장 X)
         if (!app.state.user) return;
         const grade = app.state.selectedSheet;
         if (!grade) return;

         // 로컬 스토리지 키 가져오기
         const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME(grade);
         const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
         const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);

         // 동기화할 데이터 있는지 확인
         const timeToSync = localStorage.getItem(timeKey);
         const statsToSync = localStorage.getItem(quizKey);
         const progressToSync = localStorage.getItem(progressKey);

         // 동기화할 데이터가 있으면, 동기 함수 호출 시도 (페이지 닫히기 전에 완료될지는 미지수)
         // navigator.sendBeacon 등을 사용하는 것이 더 안정적일 수 있으나, 여기서는 일단 시도만 함.
         if (timeToSync || statsToSync || progressToSync) {
            // 실제 동기화 로직은 복잡하므로 여기서는 의도만 표현
         }
     },
    navigateTo(view, grade, options = {}) { // 특정 화면으로 이동하는 함수
        const currentState = history.state || {};

        // 현재 뷰와 다를 경우, 오프라인 데이터 동기화
        if (currentState.view !== view || currentState.grade !== grade) {
            this.syncOfflineData();
        }

        // 같은 뷰/학년으로 이동 요청 시 (리뷰 제외) 무시
        if (currentState.view === view && currentState.grade === grade && view !== 'mistakeReview' && view !== 'favoriteReview') return;

        // URL 해시 업데이트
        let hash = '';
        if (view !== 'grade' && view !== null) { // 학년 선택 화면이 아닐 때
            hash = grade ? `#${grade}` : ''; // #grade (mode 선택 화면)
            if (view !== 'mode') {
                hash = `#${view}-${grade}`; // #view-grade (다른 화면들)
            }
        }

        // 브라우저 히스토리 상태 푸시 및 뷰 렌더링
        history.pushState({ view, grade, options }, '', window.location.pathname + window.location.search + hash);
        this._renderView(view, grade, options);
    },
    async _renderView(view, grade, options = {}) { // 실제 화면 렌더링 로직
        activityTracker.stopAndSave(); // 학습 시간 추적 중지 및 저장

        // 모든 화면 요소 숨기기 (초기화)
        this.elements.gradeSelectionScreen.classList.add('hidden');
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.dashboardContainer.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');
        this.elements.progressBarContainer.classList.add('hidden');

        // 상단 버튼들 숨기기 (초기화)
        this.elements.homeBtn.classList.add('hidden');
        this.elements.backToGradeSelectionBtn.classList.add('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.practiceModeControl.classList.add('hidden');
        this.elements.sheetLink.classList.add('hidden');
        this.elements.logoutBtn.classList.add('hidden');
        this.elements.lastUpdatedText.classList.add('hidden');

        if (!this.state.user) return; // 로그인 안했으면 여기서 종료

        // 로그아웃 버튼 표시
        this.elements.logoutBtn.classList.remove('hidden');

        // 학년 정보가 있으면 상태 업데이트 및 UI 설정
        if (grade) {
            const needsProgressLoad = this.state.selectedSheet !== grade; // 학년 변경 시 진행도 다시 로드 필요
            this.state.selectedSheet = grade;
            if (needsProgressLoad) await utils.loadUserProgress(); // 진행도 로드

            // 시트 링크 설정 및 표시
            this.elements.sheetLink.href = this.config.sheetLinks[grade];
            this.elements.sheetLink.classList.remove('hidden');
            // 선택 화면 제목 설정
            const gradeText = grade.replace('y', '학년');
            this.elements.selectionTitle.textContent = `${gradeText} 어휘`;
            // 최종 업데이트 시간 표시
            this.updateLastUpdatedText();
        } else { // 학년 정보 없으면 초기화
            this.state.selectedSheet = '';
            this.state.currentProgress = {};
        }

        // 학습/퀴즈 관련 화면 시작 시 활동 추적 시작
        const startModes = ['quiz-play', 'learning', 'mistakeReview', 'favoriteReview'];
        if (startModes.includes(view)) {
             activityTracker.start();
        }

        // view 값에 따라 해당 화면 표시 및 초기화/데이터 로드 로직 실행
        switch (view) {
            case 'quiz': // 퀴즈 유형 선택 화면
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.practiceModeControl.classList.remove('hidden');
                quizMode.reset(); // 퀴즈 상태 초기화
                await quizMode.updateRangeInputs(); // 범위 입력 필드 업데이트
                break;
            case 'quiz-play': // 퀴즈 풀이 화면
                this.elements.quizModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.elements.practiceModeControl.classList.remove('hidden');
                quizMode.reset(false); // 퀴즈 상태 초기화 (선택 화면은 숨김)
                if (!learningMode.state.isWordListReady[app.state.selectedSheet]) { // 단어 목록 없으면 로드
                    await learningMode.loadWordList();
                }
                quizMode.displayNextQuiz(); // 다음 퀴즈 표시
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
            case 'mistakeReview': // 오답 노트
            case 'favoriteReview': // 즐겨찾기
                this.elements.learningModeContainer.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                if (view === 'mistakeReview') {
                    learningMode.startMistakeReview(options.mistakeWords); // 오답 단어 목록으로 시작
                } else {
                    learningMode.startFavoriteReview(); // 즐겨찾기 단어 목록으로 시작
                }
                break;
            case 'mode': // 모드 선택 화면
                this.elements.selectionScreen.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                // 관리자 계정일 경우 새로고침 버튼 표시
                if (this.state.user && this.state.user.email === this.config.adminEmail) {
                    this.elements.refreshBtn.classList.remove('hidden');
                }
                this.elements.lastUpdatedText.classList.remove('hidden'); // 최종 업데이트 시간 표시
                this.loadModeImages(); // 모드 선택 이미지 로드
                quizMode.reset(); // 퀴즈 상태 초기화
                learningMode.reset(); // 학습 모드 상태 초기화
                break;
            case 'grade': // 학년 선택 화면 (기본값)
            default:
                this.elements.gradeSelectionScreen.classList.remove('hidden');
                this.setBackgroundImage(); // 배경 이미지 설정
                this.loadGradeImages(); // 학년 선택 이미지 로드
                quizMode.reset(); // 퀴즈 상태 초기화
                learningMode.reset(); // 학습 모드 상태 초기화
                break;
        }
    },
    async forceRefreshData() { // 관리자용 데이터 강제 새로고침 함수
        const sheet = this.state.selectedSheet;
        if (!sheet) return;

        // 버튼 비활성화
        const elementsToDisable = [
            this.elements.homeBtn, this.elements.refreshBtn, this.elements.backToGradeSelectionBtn,
            document.getElementById('select-learning-btn'), document.getElementById('select-quiz-btn'),
            document.getElementById('select-dashboard-btn'), document.getElementById('select-mistakes-btn'),
            this.elements.selectFavoritesBtn
        ].filter(el => el);
        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));

        // 새로고침 버튼 로딩 아이콘으로 변경
        const refreshIconHTML = this.elements.refreshBtn.innerHTML;
        this.elements.refreshBtn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        try {
            // Firebase Realtime Database에서 현재 버전 번호 가져오기
            const versionRef = ref(rt_db, `app_config/vocab_version_${sheet}`);
            const snapshot = await get(versionRef);
            const currentVersion = snapshot.val() || 0;
            
            // 새 버전 번호 및 타임스탬프 생성
            const newVersion = currentVersion + 1;
            const newTimestamp = Date.now(); // 관리자가 배포한 시점
            
            // 새 버전 번호 RTDB에 저장
            await set(versionRef, newVersion);

            // 배포 타임스탬프 RTDB에 저장
            const timestampRef = ref(rt_db, `app_config/vocab_timestamp_${sheet}`);
            await set(timestampRef, newTimestamp);

            // 관리자 본인의 로컬 캐시도 즉시 업데이트 (force=true)
            await learningMode.loadWordList(true); 
            
            this.updateLastUpdatedText(); // UI 업데이트
            this.showRefreshSuccessMessage(); // 성공 메시지 표시
        } catch(err) {
            this.showToast("데이터 새로고침(버전 업데이트)에 실패했습니다: " + err.message, true);
        } finally {
            // 버튼 다시 활성화
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            // 새로고침 버튼 아이콘 복구
            this.elements.refreshBtn.innerHTML = refreshIconHTML;
        }
    },
    showToast(message, isError = false) { // 화면 상단에 토스트 메시지 표시
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed top-20 left-1/2 -translate-x-1/2 text-white py-2 px-5 rounded-lg shadow-xl z-[200] text-lg font-semibold ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        document.body.appendChild(toast);
        // 일정 시간 후 자동으로 사라짐
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    },
    showRefreshSuccessMessage() { // 새로고침 성공 메시지 표시
        const msgEl = this.elements.refreshSuccessMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
    showImeWarning() { // 한/영 키 경고 메시지 표시
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => {
            this.elements.imeWarning.classList.add('hidden');
        }, 2000);
    },
    showNoSampleMessage() { // 예문 없음 메시지 표시
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
    updateLastUpdatedText() { // '최종 업데이트' 텍스트 업데이트
        const grade = this.state.selectedSheet;
        if (this.elements.lastUpdatedText && grade) {
            const timestamp = this.state.lastCacheTimestamp[grade]; // 캐시된 타임스탬프 사용
            if (timestamp) {
                const d = new Date(timestamp);
                const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                this.elements.lastUpdatedText.textContent = `최종 업데이트 : ${dateString}`;
                this.elements.lastUpdatedText.classList.remove('hidden');
            } else { // 타임스탬프 정보 없으면
                this.elements.lastUpdatedText.textContent = '업데이트 정보 없음';
                this.elements.lastUpdatedText.classList.remove('hidden');
            }
        } else if (this.elements.lastUpdatedText) { // 학년 선택 안됐으면 숨김
             this.elements.lastUpdatedText.classList.add('hidden');
        }
    },
    async setBackgroundImage() { // 배경 이미지 설정
        if (this.config.backgroundImages.length === 0) return; // 이미지 목록 없으면 중단
        // 랜덤 이미지 선택 및 IndexedDB 캐시에서 로드 시도
        const randomIndex = Math.floor(Math.random() * this.config.backgroundImages.length);
        const imageUrl = this.config.backgroundImages[randomIndex];
        const cachedUrl = await imageDBCache.loadImage(imageUrl); // 캐시된 Blob URL 또는 원본 URL
        // CSS 변수(--bg-image)에 설정
        document.documentElement.style.setProperty('--bg-image', `url('${cachedUrl}')`);
    },
    async fetchAndSetBackgroundImages() { // Cloudinary에서 배경 이미지 목록 가져오기
        const cloudName = 'dx07dymqs';
        const tagName = 'bgimage';
        const url = `https://res.cloudinary.com/${cloudName}/image/list/${tagName}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Cloudinary API Error: ${response.statusText}`);
            const data = await response.json();

            // 가져온 이미지 URL 목록 저장
            this.config.backgroundImages = data.resources.map(img =>
                `https://res.cloudinary.com/${cloudName}/image/upload/v${img.version}/${img.public_id}.${img.format}`
            );

        } catch (error) {
            console.warn("Failed to fetch background images from Cloudinary, using fallback.", error);
            // 실패 시 미리 정의된 대체 이미지 사용
            this.config.backgroundImages = [
                'https://i.imgur.com/EvyV4x7.jpeg',
                'https://i.imgur.com/xsnT8kO.jpeg',
                'https://i.imgur.com/6gZtYDb.jpeg'
            ];
        } finally {
            this.setBackgroundImage(); // 최종적으로 배경 이미지 설정
        }
    },
    async loadGradeImages() { // 학년 선택 화면 이미지 로드 (캐시 사용)
        document.querySelectorAll('.grade-select-card img').forEach(async (img) => {
            img.src = await imageDBCache.loadImage(img.src);
        });
    },
    async loadModeImages() { // 모드 선택 화면 이미지 로드 (캐시 사용)
        const ids = ['#select-learning-btn img', '#select-quiz-btn img', '#start-meaning-quiz-btn img', '#start-blank-quiz-btn img', '#start-definition-quiz-btn img'];
        ids.forEach(async (id) => {
            const img = document.querySelector(id);
            if (img) img.src = await imageDBCache.loadImage(img.src);
        });
    }
};

// 비프음 재생 관련 함수들
function playSingleBeep({ frequency, duration = 0.1, type = 'sine', gain = 0.3, endFrequency }) {
    if (!app.state.audioContext) { // AudioContext 없으면 중단
        console.warn("AudioContext not initialized. Cannot play beep.");
        return;
    }
    const oscillator = app.state.audioContext.createOscillator(); // 소리 생성기
    const gainNode = app.state.audioContext.createGain(); // 볼륨 조절기
    const now = app.state.audioContext.currentTime;
    oscillator.type = type; // 파형 (sine, square, triangle 등)
    oscillator.frequency.setValueAtTime(frequency, now); // 시작 주파수
    if (endFrequency) { // 끝 주파수 있으면 주파수 변화 설정
        oscillator.frequency.linearRampToValueAtTime(endFrequency, now + duration);
    }
    gainNode.gain.setValueAtTime(0, now); // 시작 볼륨 0
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.01); // 짧게 볼륨 올림
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.01); // 소리 끝날 때 볼륨 내림
    oscillator.connect(gainNode); // 소리 생성기 -> 볼륨 조절기 연결
    gainNode.connect(app.state.audioContext.destination); // 볼륨 조절기 -> 스피커 연결
    oscillator.start(now); // 소리 시작
    oscillator.stop(now + duration + 0.01); // 소리 정지 예약
}
function playSequence(soundDefinition) { // 여러 비프음 순차 재생 (딜레이 포함)
    if (soundDefinition.sequence && Array.isArray(soundDefinition.sequence)) {
        soundDefinition.sequence.forEach(note => {
            if (note.delay) { // 딜레이 있으면 setTimeout 사용
                setTimeout(() => { playSingleBeep(note); }, note.delay);
            } else { // 딜레이 없으면 바로 재생
                playSingleBeep(note);
            }
        });
    } else { // 단일 비프음이면 바로 재생
        playSingleBeep(soundDefinition);
    }
}
// 정답/오답 비프음 정의
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

// IndexedDB 이미지 캐시 모듈
const imageDBCache = {
    db: null, dbName: 'imageCacheDB', storeName: 'imageStore',
    init() { // DB 열기/생성
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB for images not supported.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore(this.storeName); // 스토어 생성
            request.onsuccess = e => { this.db = e.target.result; resolve(); }; // 성공 시 DB 객체 저장
            request.onerror = e => reject(e.target.error); // 실패 시 reject
        });
    },
    async loadImage(url) { // 이미지 로드 (캐시 우선)
        if (!this.db || !url) return url; // DB 없거나 URL 없으면 원본 URL 반환
        try {
            const cachedBlob = await this.getImage(url); // 캐시에서 가져오기
            if (cachedBlob) return URL.createObjectURL(cachedBlob); // 캐시 있으면 Blob URL 반환

            // 캐시 없으면 네트워크에서 가져오기
            const response = await fetch(url);
            if (!response.ok) { // 실패 시 경고 후 원본 URL 반환
                 console.warn(`Failed to fetch image: ${url}, Status: ${response.status}`);
                 return url;
            }
            const blob = await response.blob();
            this.saveImage(url, blob); // 캐시에 저장
            return URL.createObjectURL(blob); // Blob URL 반환
        } catch (e) { // 오류 발생 시 원본 URL 반환
            console.error(`Error loading/caching image ${url}:`, e);
            return url;
        }
    },
    getImage: key => new Promise((resolve) => { // 캐시에서 이미지 가져오기
        if (!imageDBCache.db) return resolve(null);
        try {
            const request = imageDBCache.db.transaction([imageDBCache.storeName]).objectStore(imageDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result); // 성공 시 결과(Blob) 반환
            request.onerror = (e) => { console.error("IndexedDB getImage error:", e.target.error); resolve(null); }; // 실패 시 null 반환
        } catch (e) {
             console.error("IndexedDB transaction error (getImage):", e); resolve(null);
        }
    }),
    saveImage: (key, blob) => { // 캐시에 이미지 저장
        if (!imageDBCache.db) return;
        try {
             const tx = imageDBCache.db.transaction([imageDBCache.storeName], 'readwrite');
             tx.objectStore(imageDBCache.storeName).put(blob, key); // 저장 (덮어쓰기)
             tx.onerror = (e) => console.error("IndexedDB saveImage transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB saveImage error:", e); }
    }
};

// IndexedDB 오디오 캐시 모듈 (TTS용)
const audioDBCache = {
    db: null, dbName: 'ttsAudioCacheDB_voca', storeName: 'audioStore',
    init() { // DB 열기/생성
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, TTS caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) { db.createObjectStore(this.storeName); } };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error:", event.target.error); reject(event.target.error); };
        });
    },
    getAudio: key => new Promise((resolve) => { // 캐시에서 오디오 데이터(ArrayBuffer) 가져오기
        if (!audioDBCache.db) return resolve(null);
         try {
            const request = audioDBCache.db.transaction([audioDBCache.storeName]).objectStore(audioDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => { console.error("IndexedDB getAudio error:", e.target.error); resolve(null); };
        } catch (e) {
            console.error("IndexedDB transaction error (getAudio):", e); resolve(null);
        }
    }),
    saveAudio: (key, audioData) => { // 캐시에 오디오 데이터(ArrayBuffer) 저장
        if (!audioDBCache.db) return;
        try {
            const tx = audioDBCache.db.transaction([audioDBCache.storeName], 'readwrite');
            tx.objectStore(audioDBCache.storeName).put(audioData, key);
            tx.onerror = (e) => console.error("IndexedDB saveAudio transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB save audio error:", e); }
    }
};

// IndexedDB 번역 캐시 모듈
const translationDBCache = {
    db: null, dbName: 'translationCacheDB_B', storeName: 'translationStore',
    init() { // DB 열기/생성
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported for translation cache.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error (translation):", event.target.error); reject(event.target.error); };
        });
    },
    get: key => new Promise((resolve, reject) => { // 캐시에서 번역 텍스트 가져오기
        if (!translationDBCache.db) return resolve(null);
        try {
            const request = translationDBCache.db.transaction([translationDBCache.storeName], 'readonly').objectStore(translationDBCache.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = event => { console.error("IndexedDB get translation error:", event.target.error); reject(event.target.error); };
        } catch (e) {
            console.error("IndexedDB transaction error (get translation):", e); reject(e);
        }
    }),
    save: (key, data) => { // 캐시에 번역 텍스트 저장
        if (!translationDBCache.db) return;
        try {
            const tx = translationDBCache.db.transaction([translationDBCache.storeName], 'readwrite');
            tx.objectStore(translationDBCache.storeName).put(data, key);
            tx.onerror = (e) => console.error("IndexedDB save translation transaction error:", e.target.error);
        }
        catch (e) { console.error("IndexedDB save translation error:", e); }
    }
};

// API 호출 관련 함수 모음
const api = {
    async translateText(text) { // Google Apps Script 통해 텍스트 번역 (캐시 우선)
        if (!text || !text.trim()) return ''; // 빈 텍스트는 번역 안 함
        try {
            const cached = await translationDBCache.get(text); // 캐시 확인
            if (cached) return cached; // 캐시 있으면 반환

            // 캐시 없으면 Apps Script 호출
            const url = new URL(app.config.SCRIPT_URL);
            url.searchParams.append('action', 'translateText');
            url.searchParams.append('text', text);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) { // 성공 시
                translationDBCache.save(text, data.translatedText); // 캐시에 저장
                return data.translatedText; // 번역 결과 반환
            }
            console.error("Translation API Error:", data.message);
            return '번역 실패';
        } catch (error) {
            console.error("Translation Fetch Error:", error);
            return '번역 오류';
        }
    },
    googleTtsApiKey: 'AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA', // Google TTS API 키
    async speak(text) { // 텍스트 음성 변환 (TTS)
        if (!text || !text.trim()) return; // 빈 텍스트 무시
        activityTracker.recordActivity(); // 사용자 활동 기록
        // 약어 처리 ('sb' -> 'somebody', 'sth' -> 'something')
        const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');

        // iOS 아니면서 브라우저 내장 TTS 기능 있으면 사용 (더 빠름)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!isIOS && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel(); // 이전 재생 취소
                const utterance = new SpeechSynthesisUtterance(processedText);
                utterance.lang = 'en-US'; // 영어(미국) 설정
                window.speechSynthesis.speak(utterance);
                return; // 내장 TTS 성공 시 종료
            } catch (error) {
                console.warn("Native TTS failed, falling back to Google TTS API:", error);
                // 실패 시 Google TTS API 사용
            }
        }

        // Google TTS API 사용 (캐시 우선)
        const cacheKey = processedText;
        let ttsAudioContext = null; // 재생용 AudioContext (비프음과 분리)
        try {
            const cachedAudio = await audioDBCache.getAudio(cacheKey); // 캐시 확인
            if (cachedAudio) { // 캐시 있으면 재생
                ttsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                if(ttsAudioContext.state === 'suspended') await ttsAudioContext.resume(); // 비활성 상태면 활성화
                const audioBuffer = await ttsAudioContext.decodeAudioData(cachedAudio.slice(0)); // 버퍼 복사해서 디코딩
                const source = ttsAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ttsAudioContext.destination);
                source.start(0); // 즉시 재생
                source.onended = () => ttsAudioContext.close(); // 재생 끝나면 컨텍스트 닫기
                return; // 캐시 재생 성공 시 종료
            }

            // 캐시 없으면 Google TTS API 호출
            const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleTtsApiKey}`;
            const requestBody = {
                input: { text: processedText },
                voice: { languageCode: 'en-US', name: 'en-US-Standard-C' }, // 목소리 설정
                audioConfig: { audioEncoding: 'MP3' } // 오디오 형식
            };

            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) { // API 호출 실패 시
                 const errorData = await response.json();
                 throw new Error(`Google TTS API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (data.audioContent) { // 오디오 데이터 받으면
                // Base64 디코딩 -> Blob -> ArrayBuffer 변환
                const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                audioDBCache.saveAudio(cacheKey, arrayBuffer.slice(0)); // 캐시에 저장 (버퍼 복사)

                // 오디오 재생
                ttsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                if(ttsAudioContext.state === 'suspended') await ttsAudioContext.resume();
                const audioBuffer = await ttsAudioContext.decodeAudioData(arrayBuffer); // 원본 버퍼 디코딩
                const source = ttsAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ttsAudioContext.destination);
                source.start(0);
                source.onended = () => ttsAudioContext.close();
            } else {
                 throw new Error("No audio content received from Google TTS API");
            }
        } catch (error) {
            console.error('Error fetching/playing TTS audio:', error);
             // 오류 발생 시에도 컨텍스트 닫기
             if (ttsAudioContext && ttsAudioContext.state !== 'closed') {
                 ttsAudioContext.close();
             }
        }
    },
    async copyToClipboard(text) { // 텍스트 클립보드에 복사
        if (navigator.clipboard && text) {
            try { await navigator.clipboard.writeText(text); }
            catch (err) { console.warn("Clipboard write failed:", err); }
        }
    },
    async fetchDefinition(word) { // Merriam-Webster 사전 API로 영영 풀이 가져오기
        if (!word) return null;
        const apiKey = app.config.MERRIAM_WEBSTER_API_KEY;
        const url = `https://dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) { // API 호출 실패
                console.warn(`Definition fetch failed for ${word}: Status ${response.status}`);
                return null;
            }
            const data = await response.json();
            // 응답 데이터 파싱하여 첫 번째 짧은 정의 반환
            if (Array.isArray(data) && data.length > 0) {
                const firstResult = data[0];
                if (typeof firstResult === 'object' && firstResult !== null && firstResult.shortdef && Array.isArray(firstResult.shortdef) && firstResult.shortdef.length > 0) {
                    return firstResult.shortdef[0].split(';')[0].trim(); // 세미콜론 기준으로 첫 부분만 사용
                }
            }
            return null; // 정의 못 찾으면 null 반환
        } catch (e) { // 네트워크 오류 등
            console.error(`Error fetching definition for ${word}:`, e);
            return null;
        }
    }
};

// UI 관련 함수 모음
const ui = {
    // TTS/상호작용에서 제외할 일반적인 단어 목록 (관사, 대명사, 전치사 등)
    nonInteractiveWords: new Set(['a', 'an', 'the', 'I', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'something', 'anybody', 'anyone', 'anything', 'nobody', 'no one', 'nothing', 'everybody', 'everyone', 'everything', 'all', 'any', 'both', 'each', 'either', 'every', 'few', 'little', 'many', 'much', 'neither', 'none', 'one', 'other', 'several', 'some', 'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'to', 'toward', 'under', 'underneath', 'until', 'unto', 'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'after', 'although', 'as', 'because', 'before', 'if', 'once', 'since', 'than', 'that', 'though', 'till', 'unless', 'until', 'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how', 'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'not', 'very', 'too', 'so', 'just', 'well', 'often', 'always', 'never', 'sometimes', 'here', 'there', 'now', 'then', 'again', 'also', 'ever', 'even', 'how', 'quite', 'rather', 'soon', 'still', 'more', 'most', 'less', 'least', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'then', 'there', 'here', "don't", "didn't", "can't", "couldn't", "she's", "he's", "i'm", "you're", "they're", "we're", "it's", "that's"]),

    adjustFontSize(element) { // 요소 너비에 맞게 폰트 크기 자동 조절
        if (!element || !element.parentElement) return;
        element.style.fontSize = ''; // 초기화
        const defaultFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        let currentFontSize = defaultFontSize;
        const container = element.parentElement;
        // 너비 넘치면 폰트 크기 줄임 (최소 12px)
        while (element.scrollWidth > container.clientWidth - 80 && currentFontSize > 12) {
            currentFontSize -= 1;
            element.style.fontSize = `${currentFontSize}px`;
        }
    },
    renderInteractiveText(targetElement, text) { // 텍스트를 단어 단위로 분리하여 상호작용 가능하게 렌더링
        if (!targetElement) return;
        targetElement.innerHTML = ''; // 내용 초기화
        if (!text || !text.trim()) return;
        // 정규식: '[...]' 또는 'S+V' | 영어 단어/구
        const regex = /(\[.*?\]|\bS\+V\b)|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach(line => { // 줄 단위로 처리
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line))) { // 정규식 매칭 반복
                // 매칭 안 된 부분은 그냥 텍스트 노드로 추가
                if (match.index > lastIndex) targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
                const [_, nonClickable, englishPhrase] = match; // 그룹 분해
                if (englishPhrase) { // 영어 단어/구일 경우
                    const span = document.createElement('span');
                    span.textContent = englishPhrase;
                    // 제외 목록에 없으면 상호작용 클래스 및 이벤트 추가
                    if (!this.nonInteractiveWords.has(englishPhrase.toLowerCase())) {
                        span.className = 'interactive-word';
                        span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(englishPhrase); }; // 클릭 시 TTS
                        span.oncontextmenu = e => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); }; // 우클릭 시 컨텍스트 메뉴
                        // 터치 이벤트 (길게 누르면 컨텍스트 메뉴)
                        let touchMove = false;
                        span.addEventListener('touchstart', e => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700); }, { passive: true });
                        span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                        span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                    }
                    targetElement.appendChild(span);
                } else if (nonClickable) { // '[...]' 또는 'S+V'는 그냥 텍스트 노드로 추가
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex; // 다음 검색 위치 업데이트
            }
            // 남은 텍스트 추가
            if (lastIndex < line.length) targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            targetElement.appendChild(document.createElement('br')); // 줄바꿈
        });
        // 마지막 불필요한 <br> 제거
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    handleSentenceMouseOver(event, sentence) { // 문장에 마우스 올렸을 때 번역 툴팁 표시 (딜레이 후)
        clearTimeout(app.state.translateDebounceTimeout); // 이전 타이머 취소
        app.state.translateDebounceTimeout = setTimeout(async () => { // 1초 후 실행
            const tooltip = app.elements.translationTooltip;
            const targetRect = event.target.getBoundingClientRect(); // 요소 위치 가져오기
            // 툴팁 위치 설정
            Object.assign(tooltip.style, { left: `${targetRect.left + window.scrollX}px`, top: `${targetRect.bottom + window.scrollY + 5}px` });
            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            tooltip.textContent = await api.translateText(sentence); // 번역 API 호출 및 결과 표시
        }, 1000);
    },
    handleSentenceMouseOut() { // 문장에서 마우스 벗어났을 때 번역 툴팁 숨김
        clearTimeout(app.state.translateDebounceTimeout); // 번역 타이머 취소
        app.elements.translationTooltip.classList.add('hidden'); // 툴팁 숨김
    },
    createInteractiveFragment(text, isForSampleSentence = false) { // 텍스트를 상호작용 가능한 DocumentFragment로 만듦 (renderInteractiveText 와 유사하나 단일 라인 처리)
        const fragment = document.createDocumentFragment();
        if (!text || !text.trim()) return fragment;
        const parts = text.split(/([a-zA-Z0-9'-]+)/g); // 영어 단어 기준으로 분리
        parts.forEach(part => {
            if (/([a-zA-Z0-9'-]+)/.test(part) && !this.nonInteractiveWords.has(part.toLowerCase())) { // 영어 단어이고 제외 목록에 없으면
                const span = document.createElement('span');
                span.textContent = part;
                span.className = 'interactive-word';
                // 이벤트 추가 (isForSampleSentence 플래그에 따라 이벤트 전파 중지 여부 결정)
                span.onclick = (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    clearTimeout(app.state.longPressTimer);
                    api.speak(part);
                };
                span.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (isForSampleSentence) e.stopPropagation();
                    this.showWordContextMenu(e, part);
                };
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
            } else { // 영어 단어 아니거나 제외 목록에 있으면 일반 span으로 추가
                const span = document.createElement('span');
                span.textContent = part;
                span.onclick = (e) => e.stopPropagation(); // 예문 전체 듣기 방지
                fragment.appendChild(span);
            }
        });
        return fragment;
    },
    displaySentences(sentences, containerElement) { // 여러 문장을 상호작용 가능하게 표시
        if (!containerElement) return;
        containerElement.innerHTML = ''; // 내용 초기화
        sentences.filter(s => s && s.trim()).forEach(sentence => { // 빈 문장 제외
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors sample-sentence'; // 스타일 클래스
            // 문장 전체 클릭 시 TTS 및 번역 툴팁 (단, 단어 클릭 시는 제외)
            p.onclick = (e) => {
                if (e.target.closest('.sentence-content-area .interactive-word')) return; // 단어 클릭 시 무시
                api.speak(p.textContent);
                this.handleSentenceMouseOver(e, p.textContent);
            };
            // 마우스 오버/아웃 시 번역 툴팁 처리
            p.addEventListener('mouseover', (e) => {
                if (!e.target.closest('.sentence-content-area')) { // 단어 위가 아닐 때만
                     this.handleSentenceMouseOver(e, p.textContent);
                }
            });
            p.addEventListener('mouseout', this.handleSentenceMouseOut);

            // 실제 문장 내용 담을 span
            const sentenceContent = document.createElement('span');
            sentenceContent.className = 'sentence-content-area';
             // 단어 위에 마우스 올리면 문장 전체 번역 툴팁 숨김
             sentenceContent.addEventListener('mouseenter', () => {
                clearTimeout(app.state.translateDebounceTimeout);
                this.handleSentenceMouseOut();
            });

            // 문장을 '*' 기준으로 분리하여 처리 (*단어*는 강조)
            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) { // 강조 부분
                    const strong = document.createElement('strong');
                    strong.appendChild(this.createInteractiveFragment(part.slice(1, -1), true)); // * 제거하고 상호작용 프래그먼트 생성
                    sentenceContent.appendChild(strong);
                } else if (part) { // 일반 부분
                    sentenceContent.appendChild(this.createInteractiveFragment(part, true)); // 상호작용 프래그먼트 생성
                }
            });
            p.appendChild(sentenceContent); // p 태그에 내용 추가
            containerElement.appendChild(p); // 컨테이너에 p 태그 추가
        });
    },
    showWordContextMenu(event, word) { // 단어 우클릭/길게 누르기 시 컨텍스트 메뉴 표시
        event.preventDefault(); // 기본 메뉴 방지
        const menu = app.elements.wordContextMenu;
        // 터치/마우스 위치 계산
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;
        // 메뉴 위치 설정 및 표시
        Object.assign(menu.style, { top: `${y}px`, left: `${x}px` });
        menu.classList.remove('hidden');
        // 각 사전 검색 버튼에 클릭 이벤트 할당 (새 탭에서 열기)
        const encodedWord = encodeURIComponent(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, 'daum-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, 'naver-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, 'longman-dictionary'); this.hideWordContextMenu(); };
    },
    hideWordContextMenu() { // 컨텍스트 메뉴 숨김
        if (app.elements.wordContextMenu) app.elements.wordContextMenu.classList.add('hidden');
    }
};

// 유틸리티 함수 모음 (학습 진도, 통계 관련)
const utils = {
    _getProgressRef(grade = app.state.selectedSheet) { // 현재 사용자의 학년별 학습 진도 Firestore 문서 참조 반환
        if (!app.state.user || !grade) return null;
        return doc(db, 'users', app.state.user.uid, 'progress', grade);
    },

    addProgressUpdateToLocalSync(word, key, value, grade = app.state.selectedSheet) { // 학습 진도 변경 사항 로컬 스토리지에 임시 저장 (동기화 큐)
        if (!grade) return;
        try {
            const localKey = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
            const unsynced = JSON.parse(localStorage.getItem(localKey) || '{}');
            if (!unsynced[word]) {
                unsynced[word] = {}; // 해당 단어 없으면 객체 생성
            }
            unsynced[word][key] = value; // 값 업데이트 (예: { "apple": { "MULTIPLE_CHOICE_MEANING": "correct" } })
            localStorage.setItem(localKey, JSON.stringify(unsynced));
        } catch (e) {
            console.error("Error adding progress update to localStorage sync", e);
        }
    },

    async loadUserProgress() { // Firestore에서 현재 선택된 학년의 학습 진도 불러오기
        const currentGrade = app.state.selectedSheet;
        if (!currentGrade) { // 학년 선택 안됐으면 초기화
            app.state.currentProgress = {};
            return;
        }
        const docRef = this._getProgressRef(currentGrade); // 문서 참조 가져오기
        if (!docRef) { // 참조 없으면 (로그인 안 됨 등) 초기화
            app.state.currentProgress = {};
            return;
        }
        try {
            const docSnap = await getDoc(docRef); // 문서 스냅샷 가져오기
            // 문서 있으면 데이터 사용, 없으면 빈 객체 사용
            app.state.currentProgress = docSnap.exists() ? docSnap.data() : {};
        } catch (error) { // 오류 시 초기화
            console.error(`Error loading progress for grade ${currentGrade}:`, error);
            app.state.currentProgress = {};
        }
    },

    getWordStatus(word) { // 특정 단어의 학습 상태 반환 (unseen, learning, review, learned)
        const grade = app.state.selectedSheet;

        // 로컬 스토리지에 저장된 임시 변경 사항 가져오기
        let localStatus = {};
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
                if (unsynced[word]) {
                    localStatus = unsynced[word];
                }
            } catch(e) { console.warn("Error reading local progress updates:", e); }
        }

        // Firestore 진행도 + 로컬 변경 사항 병합 (로컬 우선)
        const progress = { ...(app.state.currentProgress[word] || {}), ...localStatus };

        // 퀴즈 타입별 결과 확인
        const quizTypes = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION'];
        const statuses = quizTypes.map(type => progress[type] || 'unseen'); // 결과 없으면 'unseen'

        // 상태 판별 로직
        if (Object.keys(progress).length === 0 && Object.keys(localStatus).length === 0) return 'unseen'; // 기록 없음
        if (statuses.includes('incorrect')) return 'review'; // 하나라도 틀렸으면 'review'
        if (statuses.every(s => s === 'correct')) return 'learned'; // 모두 맞았으면 'learned'
        if (statuses.some(s => s === 'correct')) return 'learning'; // 일부 맞았으면 'learning'

        return 'unseen'; // 그 외 (이론상 도달 X)
    },

    async updateWordStatus(word, quizType, result) { // 퀴즈 결과에 따라 단어 상태 업데이트
        const grade = app.state.selectedSheet;
        if (!word || !quizType || !app.state.user || !grade) return; // 필수 정보 없으면 중단

        const isCorrect = result === 'correct';

        // 메모리 상의 진행도 업데이트
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word][quizType] = result;

        // 로컬 스토리지 동기화 큐에 추가
        this.addProgressUpdateToLocalSync(word, quizType, result, grade);

        // 로컬 스토리지 퀴즈 통계 큐에 추가
        this.saveQuizHistoryToLocal(quizType, isCorrect, grade);
    },

    getCorrectlyAnsweredWords(quizType) { // 특정 퀴즈 타입에서 정답 맞힌 단어 목록 반환
        if (!quizType) return [];
        const allProgress = app.state.currentProgress; // 현재 메모리 상의 진행도 사용
        return Object.keys(allProgress)
            .filter(word => allProgress[word] && allProgress[word][quizType] === 'correct');
    },

    getIncorrectWords() { // '복습 필요(review)' 상태인 단어 목록 반환
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return []; // 단어 목록 없으면 빈 배열

        const allWords = learningMode.state.wordList[grade];
        // 전체 단어 목록 순회하며 상태 확인
        return allWords
            .filter(wordObj => this.getWordStatus(wordObj.word) === 'review')
            .map(wordObj => wordObj.word); // 단어 텍스트만 추출
    },

    async toggleFavorite(word) { // 단어 즐겨찾기 상태 토글
        const grade = app.state.selectedSheet;
        if (!word || !app.state.user || !grade) return false;

        // 현재 즐겨찾기 상태 확인 (로컬 변경 사항 우선)
        let isCurrentlyFavorite = app.state.currentProgress[word]?.favorite || false;
        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
            const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
            if (unsynced[word] && unsynced[word].favorite !== undefined) {
                isCurrentlyFavorite = unsynced[word].favorite;
            }
        } catch(e) {}

        const newFavoriteStatus = !isCurrentlyFavorite; // 상태 반전

        // 메모리 상 상태 업데이트
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word].favorite = newFavoriteStatus;

        // 로컬 동기화 큐에 추가
        this.addProgressUpdateToLocalSync(word, 'favorite', newFavoriteStatus, grade);

        return newFavoriteStatus; // 변경된 상태 반환
    },

    getFavoriteWords() { // 즐겨찾기된 단어 목록 반환
        const grade = app.state.selectedSheet;
        // 로컬 변경 사항 가져오기
        let localUpdates = {};
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                localUpdates = JSON.parse(localStorage.getItem(key) || '{}');
            } catch (e) { console.warn("Error reading local progress updates for favorites:", e); }
        }

        const allProgress = app.state.currentProgress; // Firestore 진행도
        // Firestore 와 로컬 변경 사항에 있는 모든 단어 키 합치기 (중복 제거)
        const combinedKeys = new Set([...Object.keys(allProgress), ...Object.keys(localUpdates)]);

        const favoriteWords = [];
        combinedKeys.forEach(word => {
            // Firestore 상태와 로컬 상태 병합 (로컬 우선)
            const serverState = allProgress[word] || {};
            const localState = localUpdates[word] || {};
            const combinedState = { ...serverState, ...localState };

            // 최종 상태가 favorite: true 이면 목록에 추가
            if (combinedState.favorite === true) {
                favoriteWords.push(word);
            }
        });

        return favoriteWords;
    },

    async saveStudyHistory(seconds, grade) { // 학습 시간 Firestore에 저장 (일별/학년별 누적)
        if (!app.state.user || seconds < 1 || !grade) return;

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD 형식
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'study'); // 문서 참조

        try {
            const docSnap = await getDoc(historyRef); // 현재 데이터 가져오기
            const data = docSnap.exists() ? docSnap.data() : {};
            const dailyData = data[today] || {}; // 오늘 데이터 없으면 빈 객체
            const currentSeconds = dailyData[grade] || 0; // 해당 학년 데이터 없으면 0

            // 오늘 날짜 필드에 학년별 누적 시간 업데이트 (merge: true 로 해당 필드만 덮어씀)
            await setDoc(historyRef, { [today]: { [grade]: currentSeconds + seconds } }, { merge: true });
        } catch(e) {
            console.error("Failed to update study history:", e);
            throw e; // 오류 발생 시 호출한 곳으로 전파 (동기화 재시도 등 위함)
        }
    },

    saveQuizHistoryToLocal(quizType, isCorrect, grade) { // 퀴즈 결과 로컬 스토리지에 임시 저장 (동기화 큐)
        if (!grade || !quizType) return;

        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ(grade);
            const stats = JSON.parse(localStorage.getItem(key) || '{}');
            if (!stats[quizType]) { // 해당 퀴즈 타입 없으면 초기화
                stats[quizType] = { total: 0, correct: 0 };
            }
            stats[quizType].total += 1; // 총 횟수 증가
            if (isCorrect) {
                stats[quizType].correct += 1; // 정답 횟수 증가
            }
            localStorage.setItem(key, JSON.stringify(stats)); // 로컬 스토리지에 저장
        } catch (e) {
            console.error("Error saving quiz stats to localStorage", e);
        }
    },

    async syncQuizHistory(statsToSync, grade) { // 로컬에 저장된 퀴즈 통계 Firestore에 동기화 (일별/학년별/타입별 누적)
        if (!app.state.user || !statsToSync || !grade) return;
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const historyRef = doc(db, 'users', app.state.user.uid, 'history', 'quiz'); // 문서 참조

        try {
            const docSnap = await getDoc(historyRef); // 현재 데이터 가져오기
            const data = docSnap.exists() ? docSnap.data() : {};

            const todayData = data[today] || {}; // 오늘 데이터
            const gradeData = todayData[grade] || {}; // 해당 학년 데이터

            // 로컬 데이터(statsToSync)를 Firestore 데이터에 합산
            for (const type in statsToSync) {
                if (statsToSync.hasOwnProperty(type)) {
                    const typeStats = gradeData[type] || { correct: 0, total: 0 }; // 해당 타입 데이터
                    typeStats.total += statsToSync[type].total;
                    typeStats.correct += statsToSync[type].correct;
                    gradeData[type] = typeStats; // 업데이트된 데이터 저장
                }
            }

            // Firestore 문서 업데이트 (merge: true)
            await setDoc(historyRef, { [today]: { [grade]: gradeData } }, { merge: true });
        } catch(e) {
            console.error("Failed to sync quiz history:", e);
            throw e; // 오류 전파
        }
    },

    async syncProgressUpdates(progressToSync, grade) { // 로컬에 저장된 학습 진도 변경 사항 Firestore에 동기화
         if (!app.state.user || !progressToSync || Object.keys(progressToSync).length === 0 || !grade) return;
         const progressRef = this._getProgressRef(grade); // 문서 참조
         if (!progressRef) return;

         try {
             // Firestore 문서 업데이트 (merge: true 로 변경된 단어만 덮어씀)
             await setDoc(progressRef, progressToSync, { merge: true });
         } catch (error) {
             console.error("Firebase progress sync (setDoc merge) failed:", error);
             throw error; // 오류 전파
         }
     }
};

// 학습 통계(Dashboard) 모듈
const dashboard = {
    elements: { // 관련 HTML 요소
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
        stats7DayContainer: document.getElementById('dashboard-stats-7day-container'),
        stats30DayContainer: document.getElementById('dashboard-stats-30day-container'),
        statsTotalContainer: document.getElementById('dashboard-stats-total-container'),
    },
    state: { // 차트 객체 저장
        studyTimeChart: null,
        quiz1Chart: null,
        quiz2Chart: null,
        quiz3Chart: null,
    },
    init() {}, // 초기화 (특별한 로직 없음)
    async show() { // 대시보드 표시 함수
        this.destroyCharts(); // 기존 차트 제거

        // 로딩 표시
        this.elements.content.innerHTML = `<div class="text-center p-4"><div class="loader mx-auto"></div></div>`;
        this.elements.stats30DayContainer.innerHTML = '';
        this.elements.statsTotalContainer.innerHTML = '';

        // 단어 목록 없으면 로드
        if (!learningMode.state.isWordListReady[app.state.selectedSheet]) {
            await learningMode.loadWordList();
        }

        // 기본 통계 (학습 단계별 분포) 렌더링
        this.renderBaseStats();
        // 상세 통계 (차트, 요약 카드)는 약간의 지연 후 비동기 로드 (기본 통계 먼저 보여주기 위함)
        setTimeout(async () => {
            await this.renderAdvancedStats();
        }, 1);
    },
    renderBaseStats() { // 학습 단계별 분포 표시
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) { // 데이터 없으면 메시지 표시
             this.elements.content.innerHTML = `<p class="text-center text-gray-600">데이터를 불러올 수 없습니다.</p>`;
             return;
        }
        const allWords = learningMode.state.wordList[grade] || [];
        const totalWords = allWords.length;
        if (totalWords === 0) { // 단어 없으면 메시지 표시
            this.elements.content.innerHTML = `<p class="text-center text-gray-600">학습할 단어가 없습니다.</p>`;
            return;
        }

        // 각 상태별 단어 수 계산
        const counts = { learned: 0, learning: 0, review: 0, unseen: 0 };
        allWords.forEach(wordObj => {
            counts[utils.getWordStatus(wordObj.word)]++;
        });

        // 표시할 데이터 배열 생성
        const stats = [
            { name: '미학습', description: '아직 어떤 퀴즈도 풀지 않음', count: counts.unseen, color: 'bg-gray-400' },
            { name: '학습 중', description: '최소 1종류의 퀴즈를 풀어서 맞힘, 아직 틀리지 않음', count: counts.learning, color: 'bg-blue-500' },
            { name: '복습 필요', description: '최소 1종류의 퀴즈에서 틀림', count: counts.review, color: 'bg-orange-500' },
            { name: '학습 완료', description: '모든 종류의 퀴즈에서 정답을 맞힘', count: counts.learned, color: 'bg-green-500' }
        ];

        // HTML 생성
        let contentHTML = `<div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center"><p class="text-lg text-gray-600">총 단어 수</p><p class="text-4xl font-bold text-gray-800">${totalWords}</p></div><div><h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2><div class="space-y-4">`;
        stats.forEach(stat => {
            const percentage = totalWords > 0 ? ((stat.count / totalWords) * 100).toFixed(1) : 0;
            // 각 상태별 진행 바 HTML 추가
            contentHTML += `<div class="w-full"><div class="flex justify-between items-center mb-1"><span class="text-base font-semibold text-gray-700" title="${stat.description}">${stat.name}</span><span class="text-sm font-medium text-gray-500">${stat.count}개 (${percentage}%)</span></div><div class="w-full bg-gray-200 rounded-full h-4"><div class="${stat.color} h-4 rounded-full" style="width: ${percentage}%"></div></div></div>`;
        });
        contentHTML += `</div></div>`;
        // 생성된 HTML 삽입
        this.elements.content.innerHTML = contentHTML;
    },

    async renderAdvancedStats() { // 상세 통계 (차트, 요약 카드) 렌더링
        if (!app.state.user || !app.state.selectedSheet) return;
        const grade = app.state.selectedSheet;

        try {
            // Firestore에서 학습 시간 및 퀴즈 기록 가져오기
            const studyHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'study'));
            const quizHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'quiz'));
            const studyHistory = studyHistoryDoc.exists() ? studyHistoryDoc.data() : {};
            const quizHistory = quizHistoryDoc.exists() ? quizHistoryDoc.data() : {};

            // 7일 차트 및 요약 카드 렌더링
            this.render7DayCharts(studyHistory, quizHistory, grade);
            this.renderSummaryCards(studyHistory, quizHistory, grade);

        } catch (e) { // 오류 발생 시 메시지 표시
            console.error("Error rendering advanced stats:", e);
            this.elements.content.innerHTML += `<p class="text-red-500 text-center mt-4">추가 통계 정보를 불러오는 데 실패했습니다.</p>`;
        }
    },

    destroyCharts() { // 기존 차트 객체 파괴 (메모리 누수 방지)
        if (this.state.studyTimeChart) this.state.studyTimeChart.destroy();
        if (this.state.quiz1Chart) this.state.quiz1Chart.destroy();
        if (this.state.quiz2Chart) this.state.quiz2Chart.destroy();
        if (this.state.quiz3Chart) this.state.quiz3Chart.destroy();
        this.state.studyTimeChart = this.state.quiz1Chart = this.state.quiz2Chart = this.state.quiz3Chart = null;
    },

    render7DayCharts(studyHistory, quizHistory, grade) { // 최근 7일 학습 시간 막대 차트 및 퀴즈 정답률 도넛 차트 생성
        const today = new Date();
        const labels = []; // 차트 x축 레이블 (날짜)
        const studyData = []; // 학습 시간 데이터 (분)
        // 최근 7일 데이터 추출
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().slice(0, 10);
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`); // '월/일' 형식
            studyData.push(Math.round(((studyHistory[dateString] && studyHistory[dateString][grade]) || 0) / 60)); // 초 -> 분 변환
        }

        // 학습 시간 막대 차트 생성 (Chart.js 사용)
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
                    responsive: true, maintainAspectRatio: false, // 반응형 크기
                    scales: { y: { beginAtZero: true, suggestedMax: 60 } }, // y축 설정
                    plugins: { legend: { display: false } } // 범례 숨김
                }
            });
        }

        // 최근 7일 퀴즈 타입별 정답/총 문제 수 계산
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

    createDoughnutChart(elementId, labelId, labelText, stats) { // 도넛 차트 생성 헬퍼 함수
        const ctx = document.getElementById(elementId)?.getContext('2d');
        if (!ctx) return null; // 캔버스 없으면 중단

        const correct = stats.correct || 0;
        const total = stats.total || 0;
        const incorrect = total - correct;

        const hasAttempts = total > 0; // 시도 횟수 있는지
        const accuracy = hasAttempts ? Math.round((correct / total) * 100) : 0; // 정답률 계산

        // 시도 횟수에 따라 색상 및 데이터 설정
        const chartColors = hasAttempts ? ['#34D399', '#F87171'] : ['#E5E7EB', '#E5E7EB']; // 초록/빨강 or 회색
        const chartData = hasAttempts ? [correct, incorrect > 0 ? incorrect : 0.0001] : [0, 1]; // 오답 0일 때 아주 작은 값 추가 (차트 표시 위함)

        const centerText = hasAttempts ? `${accuracy}%` : '-'; // 중앙에 표시될 텍스트

        // 차트 아래 레이블 텍스트 업데이트
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
            plugins: [{ // 차트 중앙에 텍스트 표시하는 플러그인
                id: 'doughnutLabel',
                beforeDraw: (chart) => {
                    const { ctx, width, height } = chart;
                    ctx.restore();
                    const fontSize = (height / 114).toFixed(2); // 높이에 비례하는 폰트 크기
                    ctx.font = `bold ${fontSize}em sans-serif`;
                    ctx.textBaseline = 'middle';
                    const text = centerText;
                    const textX = Math.round((width - ctx.measureText(text).width) / 2); // 가로 중앙 정렬
                    const textY = height / 2; // 세로 중앙 정렬
                    ctx.fillStyle = hasAttempts ? '#374151' : '#9CA3AF'; // 색상 설정
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    },

    renderSummaryCards(studyHistory, quizHistory, grade) { // 30일 및 전체 기간 요약 카드 렌더링
        const today = new Date();
        const quizTypes = [ // 퀴즈 타입 정보
            { id: 'MULTIPLE_CHOICE_MEANING', name: '영한 뜻' },
            { id: 'FILL_IN_THE_BLANK', name: '빈칸 추론' },
            { id: 'MULTIPLE_CHOICE_DEFINITION', name: '영영 풀이' }
        ];

        // 특정 기간 동안의 통계 계산 함수
        const getStatsForPeriod = (days) => {
            let totalSeconds = 0; // 총 학습 시간
            const quizStats = { }; // 퀴즈 타입별 통계
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 }); // 초기화
            // 지정된 기간(days)만큼 반복
            for (let i = 0; i < days; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().slice(0, 10);

                // 학습 시간 누적
                if(studyHistory[dateString]){
                    totalSeconds += studyHistory[dateString][grade] || 0;
                }

                // 퀴즈 통계 누적
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

        // 전체 기간 통계 계산 (days를 매우 크게 설정)
        const totalStats = (() => {
            let totalSeconds = 0;
            const quizStats = { };
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 });
            // 모든 날짜 데이터 순회하며 누적
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

        // 30일 통계 계산
        const stats30 = getStatsForPeriod(30);

        // 요약 카드 HTML 생성 함수
        const createCardHTML = (title, time, stats) => {
            let cards = '';
            // 각 퀴즈 타입별로 작은 카드 생성
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

            // 전체 카드 틀 HTML 반환
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

        // 생성된 HTML 삽입
        this.elements.stats30DayContainer.innerHTML = createCardHTML('최근 30일 기록', stats30.totalSeconds, stats30.quizStats);
        this.elements.statsTotalContainer.innerHTML = createCardHTML('누적 총학습 기록', totalStats.totalSeconds, totalStats.quizStats);
    },

    formatSeconds(totalSeconds) { // 초를 'X시간 Y분' 형식으로 변환
        if (!totalSeconds || totalSeconds < 60) return `0분`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        let result = '';
        if (h > 0) result += `${h}시간 `;
        if (m > 0) result += `${m}분`;
        return result.trim() || '0분';
    },
};

// 퀴즈 모드 모듈
const quizMode = {
     state: { // 퀴즈 모드 상태 관리
        currentQuiz: {}, // 현재 출제된 퀴즈 데이터
        currentQuizType: null, // 현재 진행 중인 퀴즈 타입
        isPracticeMode: false, // 연습 모드 여부
        practiceLearnedWords: [], // 연습 모드에서 맞힌 단어 목록
        sessionAnsweredInSet: 0, // 현재 세트(10문제)에서 푼 문제 수
        sessionCorrectInSet: 0, // 현재 세트에서 맞힌 문제 수
        sessionMistakes: [], // 현재 세트에서 틀린 단어 목록
        preloadedQuizzes: { // 미리 로드된 퀴즈 (학년별, 타입별)
            '1y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '2y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null },
            '3y': { 'MULTIPLE_CHOICE_MEANING': null, 'FILL_IN_THE_BLANK': null, 'MULTIPLE_CHOICE_DEFINITION': null }
        },
        isPreloading: { // 현재 미리 로드 중인지 여부 (중복 방지)
            '1y': {}, '2y': {}, '3y': {}
        },
    },
    elements: {}, // 관련 HTML 요소
    init() { // 초기화
        this.elements = { // 요소 바인딩
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'),
            // [수정] input -> button 요소 참조
            quizRangeStart: document.getElementById('quiz-range-start'),
            quizRangeEnd: document.getElementById('quiz-range-end'),
            // [수정] 끝
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
        this.bindEvents(); // 이벤트 리스너 바인딩
    },
    bindEvents() { // 이벤트 리스너 바인딩 함수
        // 퀴즈 시작 버튼 클릭 시 start 함수 호출
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));

        // [수정] 범위 버튼 클릭 시 prompt 표시 함수 연결
        this.elements.quizRangeStart.addEventListener('click', (e) => this.promptForRangeValue(e.target, '시작 어휘의 숫자를 입력하세요'));
        this.elements.quizRangeEnd.addEventListener('click', (e) => this.promptForRangeValue(e.target, '마지막 어휘의 숫자를 입력하세요'));
        // [수정] 끝

        // 퀴즈 결과 모달 버튼 클릭 이벤트
        this.elements.quizResultContinueBtn.addEventListener('click', () => this.continueAfterResult()); // 계속하기
        this.elements.quizResultMistakesBtn.addEventListener('click', () => this.reviewSessionMistakes()); // 오답노트 보기

        // 키보드 이벤트 (숫자 키로 선택, P/0으로 PASS)
        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return; // 퀴즈 활성 상태 아니면 무시
            activityTracker.recordActivity(); // 활동 기록

            // PASS 아닌 선택지 개수 확인
            const choiceCount = Array.from(this.elements.choices.children).filter(el => !el.textContent.includes('PASS')).length;

            if (e.key.toLowerCase() === 'p' || e.key === '0') { // P 또는 0 키
                 e.preventDefault();
                 const passButton = Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'));
                 if(passButton) passButton.click(); // PASS 버튼 클릭
            } else { // 숫자 키 (1 ~ choiceCount)
                const choiceIndex = parseInt(e.key);
                if (choiceIndex >= 1 && choiceIndex <= choiceCount) {
                    e.preventDefault();
                    const targetLi = this.elements.choices.children[choiceIndex - 1];
                    targetLi.classList.add('bg-gray-200'); // 잠깐 배경색 변경 효과
                    setTimeout(() => targetLi.classList.remove('bg-gray-200'), 150);
                    targetLi.click(); // 해당 선택지 클릭
                }
            }
        });
    },
    // [추가] 범위 값 입력을 위한 prompt 표시 함수
    promptForRangeValue(targetButton, promptMessage) {
        if (!targetButton) return;
        const currentValue = targetButton.textContent;
        const min = parseInt(targetButton.dataset.min) || 1;
        const max = parseInt(targetButton.dataset.max) || 1;

        // prompt 표시 (기본값: 현재 값)
        const newValueStr = window.prompt(promptMessage + `\n(범위: ${min} ~ ${max})`, currentValue);

        // 입력값이 있고, 취소하지 않았을 때
        if (newValueStr !== null && newValueStr.trim() !== '') {
            let newValue = parseInt(newValueStr);
            if (!isNaN(newValue)) { // 숫자인 경우
                // min/max 범위 내로 보정
                newValue = Math.max(min, Math.min(max, newValue));
                targetButton.textContent = newValue; // 버튼 텍스트 업데이트

                // 로컬 스토리지에 값 저장
                const grade = app.state.selectedSheet;
                if (grade) {
                    // 버튼 ID에 따라 적절한 로컬 스토리지 키 선택
                    const storageKey = targetButton.id === 'quiz-range-start' 
                                       ? app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade) 
                                       : app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade);
                    try {
                        localStorage.setItem(storageKey, newValue);
                    } catch (e) {
                        console.error("Error saving quiz range to localStorage", e);
                    }
                }
            } else { // 숫자가 아닌 경우 토스트 메시지 표시
                app.showToast("숫자만 입력 가능합니다.", true);
            }
        }
    },
    // [추가] 끝
    async start(quizType) { // 퀴즈 시작 (퀴즈 플레이 화면으로 이동)
        this.state.currentQuizType = quizType;
        app.navigateTo('quiz-play', app.state.selectedSheet);
    },
    reset(showSelection = true) { // 퀴즈 상태 초기화
        // 상태 변수 초기화
        this.state.currentQuiz = {};
        this.state.practiceLearnedWords = [];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];

        if (showSelection) { // 선택 화면 보여줘야 하면 타입도 초기화
            this.state.currentQuizType = null;
        }
        
        // 로더 기본 상태 설정
        this.elements.loader.querySelector('.loader').style.display = 'block';
        this.elements.loaderText.textContent = "퀴즈 데이터를 불러오는 중...";
        // UI 초기화 (선택 화면 또는 로더 표시, 결과 화면 숨김 등)
        if (showSelection) {
            this.elements.quizSelectionScreen.classList.remove('hidden');
            this.elements.loader.classList.add('hidden');
        } else {
            this.showLoader(true); // 퀴즈 플레이 직전에는 로더 표시
        }
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
        if (this.elements.quizResultModal) this.elements.quizResultModal.classList.add('hidden');
    },
    async updateRangeInputs() { // 퀴즈 범위 버튼 초기화 및 최대값 설정
        const grade = app.state.selectedSheet;
        if (!grade) return;

        let startValue = 1;
        let endValue = 1;
        let totalWords = 1;

        try {
            // 단어 목록 로드 확인/실행
            if (!learningMode.state.isWordListReady[grade]) {
                await learningMode.loadWordList();
            }
            
            totalWords = learningMode.state.wordList[grade]?.length || 1;
            endValue = totalWords; // 끝 번호 기본값 = 총 단어 수

            // 로컬 스토리지에서 저장된 범위 값 불러오기
            const startStorageKey = app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_START(grade);
            const endStorageKey = app.state.LOCAL_STORAGE_KEYS.QUIZ_RANGE_END(grade);

            const savedStart = localStorage.getItem(startStorageKey);
            const savedEnd = localStorage.getItem(endStorageKey);

            // 저장된 값 유효성 검사 및 적용
            if (savedStart !== null) {
                const parsedStart = parseInt(savedStart);
                if (!isNaN(parsedStart) && parsedStart >= 1 && parsedStart <= totalWords) {
                    startValue = parsedStart;
                } else { // 유효하지 않으면 로컬 스토리지 값 제거
                    localStorage.removeItem(startStorageKey); 
                }
            }
            if (savedEnd !== null) {
                const parsedEnd = parseInt(savedEnd);
                if (!isNaN(parsedEnd) && parsedEnd >= 1 && parsedEnd <= totalWords) {
                    endValue = parsedEnd;
                } else { // 유효하지 않으면 로컬 스토리지 값 제거
                     localStorage.removeItem(endStorageKey); 
                }
            }

        } catch (error) { // 오류 발생 시 기본값 사용
            console.error("Error updating quiz range inputs:", error);
            startValue = 1;
            endValue = 1;
            totalWords = 1;
        } finally { // 최종적으로 버튼 텍스트 및 data 속성 설정
            this.elements.quizRangeStart.textContent = startValue;
            this.elements.quizRangeStart.dataset.min = 1;
            this.elements.quizRangeStart.dataset.max = totalWords;

            this.elements.quizRangeEnd.textContent = endValue;
            this.elements.quizRangeEnd.dataset.min = 1;
            this.elements.quizRangeEnd.dataset.max = totalWords;
        }
    },
    async displayNextQuiz() { // 다음 퀴즈 문제 표시
        this.showLoader(true, '다음 문제 생성 중...'); // 로더 표시
        let nextQuiz = null;
        const grade = app.state.selectedSheet;
        const type = this.state.currentQuizType;

        // 미리 로드된 퀴즈 확인
        const preloaded = this.state.preloadedQuizzes[grade]?.[type];
        if (preloaded) { // 있으면 사용
            nextQuiz = preloaded;
            this.state.preloadedQuizzes[grade][type] = null; // 사용했으니 비움
            this.preloadNextQuiz(grade, type); // 다음 퀴즈 미리 로드 시작
        }

        if (!nextQuiz) { // 미리 로드된 퀴즈 없으면 즉시 생성
            nextQuiz = await this.generateSingleQuiz();
        }

        if (nextQuiz) { // 생성 성공 시
            this.state.currentQuiz = nextQuiz; // 현재 퀴즈 상태 업데이트
            this.showLoader(false); // 로더 숨김
            this.renderQuiz(nextQuiz); // 퀴즈 UI 렌더링
        } else { // 생성 실패 시 (더 이상 문제 없거나 오류)
            if (this.state.sessionAnsweredInSet > 0) { // 현재 세트 진행 중이었으면 결과 모달 표시
                this.showSessionResultModal(true); // isFinal=true 로 '모드 선택으로' 버튼 표시
            } else { // 세트 시작도 못했으면 종료 화면 표시
                this.showFinishedScreen("모든 단어 학습을 완료했거나, 더 이상 만들 퀴즈가 없습니다!");
            }
        }
    },
    async generateSingleQuiz() { // 단일 퀴즈 문제 생성
        const grade = app.state.selectedSheet;
        if (!grade || !learningMode.state.wordList[grade]) return null; // 단어 목록 없으면 null

        const allWords = learningMode.state.wordList[grade] || [];
        if (allWords.length === 0) return null; // 단어 없으면 null (이론상 도달 X)

        // 사용자가 선택한 범위 값 가져오기
        const startVal = parseInt(this.elements.quizRangeStart.textContent) || 1;
        const endVal = parseInt(this.elements.quizRangeEnd.textContent) || allWords.length;

        // 작은 값/큰 값으로 시작/끝 번호 결정
        const startNum = Math.min(startVal, endVal);
        const endNum = Math.max(startVal, endVal);

        // 1기반 번호 -> 0기반 인덱스 변환 (범위 보정 포함)
        const startIndex = Math.max(0, startNum - 1); 
        const endIndex = Math.min(allWords.length - 1, endNum - 1); 

        // 지정된 범위의 단어 목록 추출
        const wordsInRange = allWords.slice(startIndex, endIndex + 1);
        if (wordsInRange.length === 0) return null; // 범위 내 단어 없으면 null

        // 현재 퀴즈 타입에서 이미 맞힌 단어 목록 가져오기 (연습 모드 여부 고려)
        const learnedWordsInType = this.state.isPracticeMode ?
            this.state.practiceLearnedWords :
            utils.getCorrectlyAnsweredWords(this.state.currentQuizType);

        // 범위 내 단어 중, 아직 안 배웠거나 틀렸던 단어만 필터링
        let candidates = wordsInRange.filter(wordObj => {
             const status = utils.getWordStatus(wordObj.word);
             // 'learned' 아니고, 이번 타입에서 맞힌 적 없는 단어
             return status !== 'learned' && !learnedWordsInType.includes(wordObj.word);
        });

        // 빈칸 퀴즈일 경우, 예문이 있고 예문에 단어가 포함된 경우만 필터링
        if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
            candidates = candidates.filter(word => {
                if (!word.sample || word.sample.trim() === '') return false;
                const firstLine = word.sample.split('\n')[0]; // 첫 줄만 사용
                const placeholderRegex = /\*(.*?)\*/; // *...* 형식
                const wordRegex = new RegExp(`\\b${word.word}\\b`, 'i'); // 단어 자체 (대소문자 무시)
                return placeholderRegex.test(firstLine) || wordRegex.test(firstLine); // 둘 중 하나라도 있으면 통과
            });
        }

        if (candidates.length === 0) return null; // 문제 낼 후보 단어 없으면 null

        candidates.sort(() => 0.5 - Math.random()); // 후보 단어 랜덤 섞기
        
        // 오답 보기 생성을 위해 전체 단어 목록 준비 (단어 수가 4개 미만이면 더미 추가)
        const usableAllWordsForChoices = allWords.length >= 4 ? allWords : [...allWords, {word: 'dummy1', meaning: '오답1'}, {word: 'dummy2', meaning: '오답2'}, {word: 'dummy3', meaning: '오답3'}];


        // 후보 단어 순회하며 퀴즈 생성 시도
        for (const wordData of candidates) {
            let quiz = null;
            if (this.state.currentQuizType === 'MULTIPLE_CHOICE_MEANING') {
                quiz = this.createMeaningQuiz(wordData, usableAllWordsForChoices); // 영한 뜻 퀴즈 생성
            } else if (this.state.currentQuizType === 'FILL_IN_THE_BLANK') {
                quiz = this.createBlankQuiz(wordData, usableAllWordsForChoices); // 빈칸 퀴즈 생성
            } else if (this.state.currentQuizType === 'MULTIPLE_CHOICE_DEFINITION') {
                const definition = await api.fetchDefinition(wordData.word); // 영영 풀이 가져오기
                if (definition) { // 성공 시
                    quiz = this.createDefinitionQuiz(wordData, usableAllWordsForChoices, definition); // 영영 풀이 퀴즈 생성
                }
            }
            if (quiz) return quiz; // 생성 성공 시 반환
        }

        return null; // 모든 후보 단어로 생성 실패 시 null 반환
    },
    renderQuiz(quizData) { // 퀴즈 UI 렌더링
        const { type, question, choices } = quizData; // 퀴즈 데이터 분해
        const questionDisplay = this.elements.questionDisplay; // 문제 표시 영역
        questionDisplay.innerHTML = ''; // 초기화

        // 퀴즈 타입별 문제 표시 방식 설정
        if (type === 'MULTIPLE_CHOICE_DEFINITION') { // 영영 풀이
            questionDisplay.classList.remove('justify-center', 'items-center'); // 중앙 정렬 제거
            ui.displaySentences([question.definition], questionDisplay); // 문장 렌더링 함수 사용
            const sentenceElement = questionDisplay.querySelector('p'); // 스타일 조정
            if(sentenceElement) sentenceElement.className = 'text-lg sm:text-xl text-left text-gray-800 leading-relaxed';
        } else if (type === 'FILL_IN_THE_BLANK') { // 빈칸
            questionDisplay.classList.remove('justify-center', 'items-center');
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';
            // 문장을 빈칸('＿＿＿＿') 또는 강조('*...*') 기준으로 분리하여 처리
            const sentenceParts = question.sentence_with_blank.split(/(\*.*?\*|＿＿＿＿)/g);
            sentenceParts.forEach(part => {
                if (part === '＿＿＿＿') { // 빈칸 부분
                    const blankSpan = document.createElement('span');
                    blankSpan.style.whiteSpace = 'nowrap'; blankSpan.textContent = '＿＿＿＿';
                    p.appendChild(blankSpan);
                } else if (part && part.startsWith('*') && part.endsWith('*')) { // 강조 부분
                    const strong = document.createElement('strong');
                    strong.appendChild(ui.createInteractiveFragment(part.slice(1, -1), true)); // 상호작용 프래그먼트 생성
                    p.appendChild(strong);
                } else if (part) { // 일반 부분
                    p.appendChild(ui.createInteractiveFragment(part, true)); // 상호작용 프래그먼트 생성
                }
            });
            questionDisplay.appendChild(p);
        } else { // 영한 뜻 (기본)
            questionDisplay.classList.add('justify-center', 'items-center'); // 중앙 정렬
            const h1 = document.createElement('h1');
            h1.className = 'text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer';
            h1.title = "클릭하여 발음 듣기";
            h1.textContent = question.word;
            h1.onclick = () => api.speak(question.word); // 클릭 시 TTS
            questionDisplay.appendChild(h1);
            ui.adjustFontSize(h1); // 폰트 크기 자동 조절
        }

        // 선택지 렌더링
        this.elements.choices.innerHTML = ''; // 초기화
        choices.forEach((choice, index) => { // 각 선택지에 대해 li 요소 생성
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`; // 번호와 내용 표시
            li.onclick = () => this.checkAnswer(li, choice); // 클릭 시 정답 확인 함수 호출
            this.elements.choices.appendChild(li);
        });

        // PASS 버튼 추가
        const passLi = document.createElement('li');
        passLi.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED'); // 클릭 시 'USER_PASSED' 값으로 정답 확인
        this.elements.choices.appendChild(passLi);

        this.elements.choices.classList.remove('disabled'); // 선택지 활성화
    },
    async checkAnswer(selectedLi, selectedChoice) { // 정답 확인 및 처리
        activityTracker.recordActivity(); // 활동 기록
        this.elements.choices.classList.add('disabled'); // 선택지 비활성화
        const isCorrect = selectedChoice === this.state.currentQuiz.answer; // 정답 여부 확인
        const isPass = selectedChoice === 'USER_PASSED'; // PASS 선택 여부
        const word = this.state.currentQuiz.question.word; // 현재 단어
        const quizType = this.state.currentQuiz.type; // 현재 퀴즈 타입

        // 선택한 항목에 정답/오답 스타일 적용
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');

        // 비프음 재생
        if (isCorrect && !isPass) {
            playSequence(correctBeep);
        } else {
            playSequence(incorrectBeep); // 오답 또는 PASS 시
        }

        // 세트 진행 상태 업데이트
        this.state.sessionAnsweredInSet++;
        if (isCorrect) {
            this.state.sessionCorrectInSet++;
        } else { // 오답 또는 PASS 시
            this.state.sessionMistakes.push(word); // 틀린 단어 목록에 추가
        }

        // 학습 진도 업데이트 (연습 모드 아닐 때만)
        if (!this.state.isPracticeMode) {
            await utils.updateWordStatus(word, quizType, (isCorrect && !isPass) ? 'correct' : 'incorrect'); // PASS는 incorrect로 기록
        } else if (isCorrect) { // 연습 모드에서 맞혔으면 해당 단어 목록에 추가 (중복 출제 방지)
             this.state.practiceLearnedWords.push(word);
        }

        // 오답 또는 PASS 시 정답 표시
        if (!isCorrect || isPass) {
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => {
                const choiceSpan = li.querySelector('span:last-child');
                return choiceSpan && choiceSpan.textContent === this.state.currentQuiz.answer;
            });
            correctAnswerEl?.classList.add('correct'); // 정답 선택지에 correct 스타일 적용
        }

        // 0.6초 후 다음 처리
        setTimeout(() => {
            if (this.state.sessionAnsweredInSet >= 10) { // 10문제 풀었으면 결과 모달 표시
                this.showSessionResultModal();
            } else { // 아니면 다음 문제 표시
                this.displayNextQuiz();
            }
        }, 600);
    },
    showSessionResultModal(isFinal = false) { // 퀴즈 세트 결과 모달 표시
        // 점수 표시
        this.elements.quizResultScore.textContent = `${this.state.sessionAnsweredInSet}문제 중 ${this.state.sessionCorrectInSet}개 정답!`;
        // 틀린 문제 없으면 오답노트 버튼 숨김
        this.elements.quizResultMistakesBtn.classList.toggle('hidden', this.state.sessionMistakes.length === 0);
        // 최종 결과면 '모드 선택으로', 아니면 '다음 퀴즈 계속' 버튼 텍스트 설정
        this.elements.quizResultContinueBtn.textContent = isFinal ? "모드 선택으로" : "다음 퀴즈 계속";
        // 모달 표시
        this.elements.quizResultModal.classList.remove('hidden');
    },
    continueAfterResult() { // 결과 모달 '계속하기' 버튼 클릭 시
        this.elements.quizResultModal.classList.add('hidden'); // 모달 숨김
        // 버튼 텍스트 따라 분기
        if (this.elements.quizResultContinueBtn.textContent === "모드 선택으로") { // 최종 결과였으면
            app.syncOfflineData(); // 오프라인 데이터 동기화
            app.navigateTo('mode', app.state.selectedSheet); // 모드 선택 화면으로 이동
            return;
        }
        // 다음 세트 진행
        this.state.sessionAnsweredInSet = 0; // 세트 상태 초기화
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.displayNextQuiz(); // 다음 문제 표시
    },
    reviewSessionMistakes() { // 결과 모달 '오답노트' 버튼 클릭 시
        this.elements.quizResultModal.classList.add('hidden'); // 모달 숨김
        const mistakes = [...new Set(this.state.sessionMistakes)]; // 중복 제거된 틀린 단어 목록
        // 세트 상태 초기화
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        app.syncOfflineData(); // 오프라인 데이터 동기화
        // 오답노트 화면으로 이동 (틀린 단어 목록 전달)
        app.navigateTo('mistakeReview', app.state.selectedSheet, { mistakeWords: mistakes });
    },
    async preloadInitialQuizzes() { // 앱 초기 로드 시 모든 학년/타입 퀴즈 1개씩 미리 로드
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
    async preloadNextQuiz(grade, type) { // 특정 학년/타입 퀴즈 1개 미리 로드
        // 이미 로드 중이거나, 로드된 퀴즈가 있거나, 정보 부족 시 중단
        if (!grade || !type || this.state.isPreloading[grade]?.[type] || this.state.preloadedQuizzes[grade]?.[type]) {
            return;
        }

        // 로딩 중 상태 설정
        if (!this.state.isPreloading[grade]) this.state.isPreloading[grade] = {};
        this.state.isPreloading[grade][type] = true;

        try {
            const allWords = learningMode.state.wordList[grade] || [];
            if (allWords.length === 0) return; // 단어 없으면 중단

            // 해당 타입에서 맞힌 단어 목록 가져오기
            const learnedWordsInType = utils.getCorrectlyAnsweredWords(type);

            // 아직 안 배웠거나 틀렸던 단어 필터링 후 랜덤 섞기
            const candidates = allWords.filter(wordObj => {
                 const status = utils.getWordStatus(wordObj.word);
                 return status !== 'learned' && !learnedWordsInType.includes(wordObj.word);
            }).sort(() => 0.5 - Math.random());
            
            // 오답 보기용 단어 목록 준비
            const usableAllWordsForChoices = allWords.length >= 4 ? allWords : [...allWords, {word: 'dummy1', meaning: '오답1'}, {word: 'dummy2', meaning: '오답2'}, {word: 'dummy3', meaning: '오답3'}];

            // 후보 단어 순회하며 퀴즈 생성 시도
            for (const wordData of candidates) {
                 let quiz = null;
                 if (type === 'MULTIPLE_CHOICE_MEANING') quiz = this.createMeaningQuiz(wordData, usableAllWordsForChoices);
                 else if (type === 'FILL_IN_THE_BLANK') quiz = this.createBlankQuiz(wordData, usableAllWordsForChoices);
                 else if (type === 'MULTIPLE_CHOICE_DEFINITION') {
                     const definition = await api.fetchDefinition(wordData.word);
                     if (definition) quiz = this.createDefinitionQuiz(wordData, usableAllWordsForChoices, definition);
                 }
                 if (quiz) { // 생성 성공 시
                     if (!this.state.preloadedQuizzes[grade]) this.state.preloadedQuizzes[grade] = {};
                     this.state.preloadedQuizzes[grade][type] = quiz; // 상태에 저장
                     return; // 하나만 로드하고 종료
                 }
            }
        } catch(e) {
            console.error(`Preloading ${grade}-${type} failed:`, e);
        } finally {
            // 로딩 중 상태 해제
            if (this.state.isPreloading[grade]) this.state.isPreloading[grade][type] = false;
        }
    },
    createMeaningQuiz(correctWordData, allWordsData) { // 영한 뜻 퀴즈 생성
        const wrongAnswers = new Set(); // 오답 목록 (중복 방지 위해 Set 사용)
        // 정답과 다른 뜻을 가진 단어 필터링 후 랜덤 섞기
        let candidates = allWordsData.filter(w => w.word !== correctWordData.word && w.meaning !== correctWordData.meaning);
        candidates.sort(() => 0.5 - Math.random());
        // 최대 3개 오답 추가
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.meaning));
        // 3개 안되면 전체 단어에서 랜덤하게 추가 (정답 제외)
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word && randomWord.meaning !== correctWordData.meaning) wrongAnswers.add(randomWord.meaning);
        }
        if(wrongAnswers.size < 3) return null; // 오답 3개 못 만들면 실패
        // 정답 + 오답 섞어서 선택지 생성
        const choices = [correctWordData.meaning, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'MULTIPLE_CHOICE_MEANING', question: { word: correctWordData.word }, choices, answer: correctWordData.meaning };
    },
    createBlankQuiz(correctWordData, allWordsData) { // 빈칸 퀴즈 생성
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null; // 예문 없으면 실패

        const firstLineSentence = correctWordData.sample.split('\n')[0]; // 첫 줄만 사용
        let sentenceWithBlank = "";
        const placeholderRegex = /\*(.*?)\*/; // *...*
        const match = firstLineSentence.match(placeholderRegex);
        const wordRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i'); // 단어 자체

        // *...* 또는 단어 자체를 빈칸(＿＿＿＿)으로 치환
        if (match) {
            sentenceWithBlank = firstLineSentence.replace(placeholderRegex, "＿＿＿＿").trim();
        } else if (firstLineSentence.match(wordRegex)) {
            sentenceWithBlank = firstLineSentence.replace(wordRegex, "＿＿＿＿").trim();
        } else {
            return null; // 둘 다 없으면 실패
        }

        // 오답 선택지 생성 (createMeaningQuiz와 유사하나, '단어'를 오답으로 사용)
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        if(wrongAnswers.size < 3) return null; // 오답 3개 못 만들면 실패
        const choices = [correctWordData.word, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'FILL_IN_THE_BLANK', question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    createDefinitionQuiz(correctWordData, allWordsData, definition) { // 영영 풀이 퀴즈 생성
        if (!definition) return null; // 영영 풀이 없으면 실패
        // 오답 선택지 생성 (createBlankQuiz와 동일)
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.word !== correctWordData.word);
        candidates.sort(() => 0.5 - Math.random());
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3 && allWordsData.length > 4) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        if(wrongAnswers.size < 3) return null; // 오답 3개 못 만들면 실패
        const choices = [correctWordData.word, ...Array.from(wrongAnswers)].sort(() => 0.5 - Math.random());
        return { type: 'MULTIPLE_CHOICE_DEFINITION', question: { definition, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    showLoader(isLoading, message = "퀴즈 데이터를 불러오는 중...") { // 로더 표시/숨김
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.loaderText.textContent = message;
        // 로더 표시 시 다른 화면 숨김
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
        this.elements.finishedScreen.classList.add('hidden');
    },
    showFinishedScreen(message) { // 퀴즈 종료 화면 표시
        this.showLoader(false); // 로더 숨김
        this.elements.contentContainer.classList.add('hidden'); // 퀴즈 내용 숨김
        this.elements.finishedScreen.classList.remove('hidden'); // 종료 화면 표시
        this.elements.finishedMessage.textContent = message; // 메시지 설정
    },
};

// 학습 모드 모듈
const learningMode = {
     state: { // 학습 모드 상태 관리
        wordList: { '1y': [], '2y': [], '3y': [] }, // 학년별 전체 단어 목록
        isWordListReady: { '1y': false, '2y': false, '3y': false }, // 단어 목록 로드 완료 여부
        currentIndex: 0, // 현재 보고 있는 단어 인덱스
        isMistakeMode: false, // 오답 노트 모드 여부
        isFavoriteMode: false, // 즐겨찾기 모드 여부
        touchstartX: 0, touchstartY: 0, // 터치 시작 좌표 (스와이프 감지용)
        currentDisplayList: [], // 현재 화면에 표시 중인 단어 목록 (전체, 오답, 즐겨찾기)
        isDragging: false, // 진행 바 드래그 중 여부
    },
    elements: {}, // 관련 HTML 요소
    init() { // 초기화
        this.elements = { // 요소 바인딩
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
        this.bindEvents(); // 이벤트 리스너 바인딩
    },
    bindEvents() { // 이벤트 리스너 바인딩 함수
        // 학습 시작 화면 이벤트
        this.elements.startBtn.addEventListener('click', () => this.start()); // 시작 버튼
        this.elements.startWordInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.start(); }); // 엔터 키
        this.elements.startWordInput.addEventListener('input', e => { // 입력 시 영어만 가능하도록 필터링 + 경고
            const originalValue = e.target.value;
            const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, ''); // 영어, 공백, '-', '\'' 외 제거
            if (originalValue !== sanitizedValue) app.showImeWarning(); // 변경됐으면 경고 표시
            e.target.value = sanitizedValue;
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen()); // '다시 입력' 버튼

        // 학습 화면 (카드) 이벤트
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1)); // 다음 버튼
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1)); // 이전 버튼
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip()); // 예문/뒤로 버튼 (카드 뒤집기)
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

        // 단어 길게 누르기 시 컨텍스트 메뉴
        let wordDisplayTouchMove = false;
        this.elements.wordDisplay.addEventListener('touchstart', e => { wordDisplayTouchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { const wordData = this.state.currentDisplayList[this.state.currentIndex]; if (!wordDisplayTouchMove && wordData) ui.showWordContextMenu(e, wordData.word); }, 700); }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => { wordDisplayTouchMove = true; clearTimeout(app.state.longPressTimer); });
        this.elements.wordDisplay.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });

        // 전역 이벤트 (학습 모드 활성화 시)
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this)); // 마우스 휠 클릭 시 카드 뒤집기
        document.addEventListener('keydown', this.handleKeyDown.bind(this)); // 키보드 방향키/엔터/스페이스 처리
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true }); // 터치 시작 (스와이프 감지용)
        document.addEventListener('touchend', this.handleTouchEnd.bind(this)); // 터치 끝 (스와이프 감지용)
        // 진행 바 상호작용 이벤트
        this.elements.progressBarTrack.addEventListener('mousedown', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mousemove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mouseup', this.handleProgressBarInteraction.bind(this));
        this.elements.progressBarTrack.addEventListener('touchstart', this.handleProgressBarInteraction.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('touchend', this.handleProgressBarInteraction.bind(this));
    },
    async loadWordList(force = false, grade = app.state.selectedSheet) { // 단어 목록 로드 (캐시 우선, 버전 체크)
        if (!grade) return; // 학년 없으면 중단
        // 강제 로드 아니고, 이미 로드 완료됐으면 중단
        if (!force && this.state.isWordListReady[grade]) return;

        // 로컬 스토리지 키
        const cacheKey = `wordListCache_${grade}`;
        const timestampKey = app.state.LOCAL_STORAGE_KEYS.CACHE_TIMESTAMP(grade);
        const versionKey = app.state.LOCAL_STORAGE_KEYS.CACHE_VERSION(grade);

        let forceRefreshDueToVersion = false; // 버전 때문에 강제 새로고침 필요한지 여부
        if (!force) { // 강제 새로고침 아니면 버전 체크
            try {
                // Firebase RTDB에서 최신 버전 번호 가져오기
                const versionRef = ref(rt_db, `app_config/vocab_version_${grade}`);
                const snapshot = await get(versionRef);
                const remoteVersion = snapshot.val() || 0; // 없으면 0
                // 로컬 스토리지에서 저장된 버전 번호 가져오기
                const localVersion = parseInt(localStorage.getItem(versionKey) || '0'); // 없으면 0

                // 원격 버전이 더 높으면 강제 새로고침 필요
                if (remoteVersion > localVersion) {
                    console.log(`[${grade}] 새 버전 감지 (Remote: ${remoteVersion} > Local: ${localVersion}). 캐시를 강제 새로고침합니다.`);
                    forceRefreshDueToVersion = true;
                }
            } catch (e) { // 버전 확인 중 오류 발생 시 안전하게 새로고침
                console.error("버전 확인 중 오류 발생:", e);
                forceRefreshDueToVersion = true; 
            }
        }
        
        // 최종 강제 새로고침 여부 결정 (관리자 요청 or 버전 업데이트)
        const shouldForceRefresh = force || forceRefreshDueToVersion;

        // 강제 새로고침 필요하면 로컬 캐시 삭제
        if (shouldForceRefresh) {
            try { 
                localStorage.removeItem(cacheKey); 
                localStorage.removeItem(timestampKey);
                localStorage.removeItem(versionKey);
            } catch(e) {}
            this.state.isWordListReady[grade] = false; // 로드 필요 상태로 변경
        }

        try { // 로컬 스토리지 캐시 확인 및 사용 시도
            const cachedData = localStorage.getItem(cacheKey);
            const savedTimestamp = localStorage.getItem(timestampKey);
            // 강제 새로고침 아니고, 캐시 데이터와 타임스탬프 모두 있으면 캐시 사용
            if (!shouldForceRefresh && cachedData && savedTimestamp) {
                const { words } = JSON.parse(cachedData); // 파싱
                this.state.wordList[grade] = words.sort((a, b) => a.id - b.id); // id 순 정렬하여 저장
                this.state.isWordListReady[grade] = true; // 로드 완료 상태로 변경
                app.state.lastCacheTimestamp[grade] = parseInt(savedTimestamp); // 타임스탬프 저장
                app.updateLastUpdatedText(); // UI 업데이트
                return; // 캐시 사용 성공, 함수 종료
            }
        } catch (e) { // 캐시 읽기/파싱 오류 시 캐시 삭제
            console.warn("Error reading or parsing word list cache:", e);
            try {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(timestampKey);
                localStorage.removeItem(versionKey);
            } catch(e2) {}
        }

        // 캐시 없거나 무효화된 경우, Firebase RTDB에서 데이터 로드
        try {
            const dbRef = ref(rt_db, `${grade}/vocabulary`); // 해당 학년 데이터 참조
            const snapshot = await get(dbRef); // 데이터 가져오기
            const data = snapshot.val();
            if (!data) throw new Error(`Firebase에 '${grade}' 단어 데이터가 없습니다.`);

            // 객체 -> 배열 변환 및 id 순 정렬
            const wordsArray = Object.values(data).sort((a, b) => a.id - b.id);
            this.state.wordList[grade] = wordsArray; // 상태에 저장
            this.state.isWordListReady[grade] = true; // 로드 완료

            // Firebase에서 최신 타임스탬프 및 버전 번호 가져오기
            const timestampRef = ref(rt_db, `app_config/vocab_timestamp_${grade}`);
            const timestampSnapshot = await get(timestampRef);
            const newTimestamp = timestampSnapshot.val() || Date.now(); // 없으면 현재 시간

            const versionRef = ref(rt_db, `app_config/vocab_version_${grade}`);
            const versionSnapshot = await get(versionRef);
            const currentRemoteVersion = versionSnapshot.val() || 1; // 없으면 1

            // 가져온 데이터 로컬 스토리지에 캐싱
            const cachePayload = { words: wordsArray };
             try {
                localStorage.setItem(cacheKey, JSON.stringify(cachePayload)); // 단어 목록 저장
                localStorage.setItem(timestampKey, newTimestamp.toString()); // 타임스탬프 저장
                app.state.lastCacheTimestamp[grade] = newTimestamp; // 상태에도 저장
                localStorage.setItem(versionKey, currentRemoteVersion.toString()); // 버전 번호 저장
                app.updateLastUpdatedText(); // UI 업데이트
             } catch(e) { console.error("Error saving word list cache:", e); }
        } catch (error) { // 로드 실패 시 오류 표시
            this.showError(error.message);
            throw error; // 오류 전파
        }
    },
    async start() { // 학습 시작 함수 (시작 화면에서 버튼 클릭 시)
        activityTracker.recordActivity(); // 활동 기록
        const grade = app.state.selectedSheet;
        // 단어 목록 로드 확인/실행
        if (!this.state.isWordListReady[grade]) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            this.elements.loader.classList.remove('hidden');
            this.elements.startScreen.classList.add('hidden');
            await this.loadWordList(false, grade); // 로드
            this.elements.loader.classList.add('hidden');
            this.elements.startScreen.classList.remove('hidden');
            if (!this.state.isWordListReady[grade]) return; // 로드 실패 시 중단
        }

        // 상태 초기화
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = false;
        const currentWordList = this.state.wordList[grade]; // 현재 학년 단어 목록
        const startWord = this.elements.startWordInput.value.trim().toLowerCase(); // 입력된 시작 단어

        if (!startWord) { // 시작 단어 입력 안 했으면
            this.elements.startScreen.classList.add('hidden'); // 시작 화면 숨김
            // 로컬 스토리지에서 마지막 학습 위치 불러오기
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(grade);
                const savedIndex = parseInt(localStorage.getItem(key) || '0');
                // 유효한 인덱스면 사용, 아니면 0
                this.state.currentIndex = (savedIndex >= 0 && savedIndex < currentWordList.length) ? savedIndex : 0;
            } catch(e) { // 오류 시 0부터 시작
                this.state.currentIndex = 0;
            }
            this.launchApp(currentWordList); // 학습 앱 실행
            return;
        }

        // 시작 단어 정확히 일치하는 인덱스 찾기 (대소문자 무시)
        const exactMatchIndex = currentWordList.findIndex(item => item.word.toLowerCase() === startWord);
        if (exactMatchIndex !== -1) { // 찾았으면
            this.elements.startScreen.classList.add('hidden');
            this.state.currentIndex = exactMatchIndex; // 해당 인덱스 설정
            this.launchApp(currentWordList); // 학습 앱 실행
            return;
        }

        // 정확히 일치하는 단어 없으면, 유사 단어 또는 설명 포함 단어 검색
        const searchRegex = new RegExp(`\\b${startWord}\\b`, 'i'); // 설명 검색용 정규식
        // 설명에 포함된 단어 찾기
        const explanationMatches = currentWordList
            .map((item, index) => ({ word: item.word, index })) // 단어와 인덱스 매핑
            .filter((item, index) => { // 필터링
                const explanation = currentWordList[index].explanation;
                if (!explanation) return false;
                const cleanedExplanation = explanation.replace(/\[.*?\]/g, ''); // [...] 제거
                return searchRegex.test(cleanedExplanation); // 정규식 테스트
            });
        // 유사 단어 찾기 (Levenshtein 거리 사용)
        const levenshteinSuggestions = currentWordList
            .map((item, index) => ({
                word: item.word, index,
                distance: levenshteinDistance(startWord, item.word.toLowerCase()) // 편집 거리 계산
            }))
            .sort((a, b) => a.distance - b.distance) // 거리 순 정렬
            .slice(0, 5) // 상위 5개
            .filter(s => s.distance < s.word.length / 2 + 1); // 거리가 너무 멀면 제외

        // 결과 있으면 추천 화면 표시
        if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) {
            const title = `<strong>'${startWord}'</strong>(을)를 찾을 수 없습니다. 혹시 이 단어인가요?`;
            this.displaySuggestions(levenshteinSuggestions, explanationMatches, currentWordList, title);
        } else { // 결과 없으면 없음 메시지 표시
            const title = `<strong>'${startWord}'</strong>에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], [], currentWordList, title);
        }
    },
    async startMistakeReview(mistakeWordsFromQuiz) { // 오답 노트 시작
        this.state.isMistakeMode = true; // 오답 모드 활성화
        this.state.isFavoriteMode = false;
        const grade = app.state.selectedSheet;
        // 단어 목록 로드 확인/실행
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }

        // 틀린 단어 목록 가져오기 (퀴즈 결과에서 전달받거나, 전체 'review' 상태 단어)
        const incorrectWords = mistakeWordsFromQuiz || utils.getIncorrectWords();

        if (incorrectWords.length === 0) { // 틀린 단어 없으면
            app.showToast("오답 노트에 단어가 없습니다!", false);
            app.navigateTo('mode', grade); // 모드 선택 화면으로 이동
            return;
        }
        // 전체 단어 목록에서 틀린 단어만 필터링하여 표시 목록 생성
        const mistakeWordList = this.state.wordList[grade].filter(wordObj => incorrectWords.includes(wordObj.word));
        this.state.currentIndex = 0; // 첫 단어부터 시작
        this.launchApp(mistakeWordList); // 학습 앱 실행
    },
    async startFavoriteReview() { // 즐겨찾기 시작
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = true; // 즐겨찾기 모드 활성화
        const grade = app.state.selectedSheet;
        // 단어 목록 로드 확인/실행
        if (!this.state.isWordListReady[grade]) { await this.loadWordList(false, grade); if (!this.state.isWordListReady[grade]) return; }

        const favoriteWords = utils.getFavoriteWords(); // 즐겨찾기 단어 목록 가져오기
        if (favoriteWords.length === 0) { // 즐겨찾기 없으면
            app.showToast("즐겨찾기에 등록된 단어가 없습니다!", false);
            app.navigateTo('mode', grade); // 모드 선택 화면으로 이동
            return;
        }

        // 전체 단어 목록에서 즐겨찾기 단어만 필터링하여 표시 목록 생성
        const favoriteWordList = favoriteWords.map(word => this.state.wordList[grade].find(wordObj => wordObj.word === word)).filter(Boolean); // find 결과가 null/undefined일 수 있으므로 filter(Boolean)
        this.state.currentIndex = 0; // 첫 단어부터 시작
        this.launchApp(favoriteWordList); // 학습 앱 실행
    },
    displaySuggestions(vocabSuggestions, explanationSuggestions, sourceList, title) { // 단어 추천 화면 표시
        this.elements.startInputContainer.classList.add('hidden'); // 입력 필드 숨김
        this.elements.suggestionsTitle.innerHTML = title; // 제목 설정

        // 추천 목록 생성 함수
        const populateList = (listElement, suggestions) => {
            listElement.innerHTML = ''; // 초기화
            if (suggestions.length === 0) { // 추천 없으면 메시지 표시
                listElement.innerHTML = '<p class="text-gray-400 text-sm p-3">결과 없음</p>';
                return;
            }
            // 각 추천 단어에 대해 버튼 생성
            suggestions.forEach(({ word, index }) => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 py-3 px-4 rounded-lg transition-colors';
                btn.textContent = word;
                // 버튼 클릭 시 해당 인덱스로 학습 앱 실행
                btn.onclick = () => { this.state.currentIndex = index; this.launchApp(sourceList); };
                listElement.appendChild(btn);
            });
        };

        // 유사 단어 및 설명 포함 단어 목록 채우기
        populateList(this.elements.suggestionsVocabList, vocabSuggestions);
        populateList(this.elements.suggestionsExplanationList, explanationSuggestions);

        // 추천 컨테이너 표시
        this.elements.suggestionsContainer.classList.remove('hidden');
    },
    reset() { // 학습 모드 UI 초기화 (다른 모드로 이동 시 호출)
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        app.elements.progressBarContainer.classList.add('hidden');
        this.state.currentDisplayList = []; // 표시 목록 비우기
    },
    resetStartScreen() { // 학습 모드 시작 화면으로 돌아갈 때 호출
        this.reset(); // 공통 UI 초기화
        this.elements.startScreen.classList.remove('hidden'); // 시작 화면 표시
        this.elements.startInputContainer.classList.remove('hidden'); // 입력 필드 표시
        this.elements.suggestionsContainer.classList.add('hidden'); // 추천 영역 숨김
        this.elements.startWordInput.value = ''; // 입력 필드 비우기
        this.elements.startWordInput.focus(); // 입력 필드 포커스
        // 현재 선택된 학년 단어 목록 미리 로드 시도 (캐시 있으면 빠름)
        if (app.state.selectedSheet) {
            this.loadWordList(false, app.state.selectedSheet);
        }
    },
    showError(message) { // 단어 목록 로드 실패 시 오류 메시지 표시
        this.elements.loader.querySelector('.loader').style.display = 'none'; // 로더 아이콘 숨김
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`; // 메시지 표시
    },
    launchApp(wordList) { // 학습 앱 화면 시작
        this.state.currentDisplayList = wordList; // 표시할 단어 목록 설정
        app.elements.refreshBtn.classList.add('hidden'); // 새로고침 버튼 숨김 (학습 중에는 불필요)
        // UI 요소 표시/숨김
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
        this.elements.fixedButtons.classList.remove('hidden');
        app.elements.progressBarContainer.classList.remove('hidden');
        // 현재 인덱스 단어 표시
        this.displayWord(this.state.currentIndex);
    },
    async displayWord(index) { // 특정 인덱스의 단어 정보 표시
        activityTracker.recordActivity(); // 활동 기록
        this.updateProgressBar(index); // 진행 바 업데이트
        this.elements.cardBack.classList.remove('is-slid-up'); // 카드 뒷면 숨김
        const wordData = this.state.currentDisplayList[index]; // 해당 인덱스 단어 데이터
        if (!wordData) return; // 데이터 없으면 중단

        // 일반 학습 모드일 때만 마지막 위치 저장
        if (!this.state.isMistakeMode && !this.state.isFavoriteMode) {
             try {
                const key = app.state.LOCAL_STORAGE_KEYS.LAST_INDEX(app.state.selectedSheet);
                localStorage.setItem(key, index); // 로컬 스토리지에 저장
            } catch (e) {
                console.error("Error saving last index to localStorage", e);
            }
        }

        // 단어, 뜻, 설명 표시
        this.elements.wordDisplay.textContent = wordData.word;
        ui.adjustFontSize(this.elements.wordDisplay); // 폰트 크기 조절
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>'); // 줄바꿈 처리
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation); // 설명 상호작용 가능하게 렌더링
        // 설명 없으면 영역 숨김
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        const hasSample = wordData.sample && wordData.sample.trim() !== ''; // 예문 존재 여부

        // 예문 버튼 이미지 설정 (예문 있으면 sampleImg, 없으면 defaultImg)
        const defaultImg = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
        const sampleImg = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png';
        this.elements.sampleBtnImg.src = await imageDBCache.loadImage(hasSample ? sampleImg : defaultImg); // 캐시 사용

        // 즐겨찾기 버튼 상태 업데이트
        const grade = app.state.selectedSheet;
        let isFavorite = app.state.currentProgress[wordData.word]?.favorite || false; // 기본값 false
        // 로컬 변경 사항 확인
        if (grade) {
            try {
                const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES(grade);
                const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
                if (unsynced[wordData.word] && unsynced[wordData.word].favorite !== undefined) {
                    isFavorite = unsynced[wordData.word].favorite; // 로컬 값 우선
                }
            } catch (e) { console.warn("Error reading local favorite status:", e); }
        }
        this.updateFavoriteIcon(isFavorite); // 아이콘 UI 업데이트
    },
    updateFavoriteIcon(isFavorite) { // 즐겨찾기 아이콘 스타일 업데이트
        const icon = this.elements.favoriteIcon;
        icon.classList.toggle('fill-current', isFavorite); // 채우기
        icon.classList.toggle('text-yellow-400', isFavorite); // 노란색
        icon.classList.toggle('text-gray-400', !isFavorite); // 회색
    },
    async toggleFavorite() { // 즐겨찾기 버튼 클릭 시 상태 토글
        activityTracker.recordActivity();
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        if (!wordData) return;

        // utils 함수 호출하여 상태 토글 (메모리 + 로컬 큐 업데이트)
        const isFavorite = await utils.toggleFavorite(wordData.word);
        this.updateFavoriteIcon(isFavorite); // 아이콘 UI 업데이트

        // 즐겨찾기 모드에서 즐겨찾기 해제 시, 목록에서 제거
        if (this.state.isFavoriteMode && !isFavorite) {
             this.state.currentDisplayList.splice(this.state.currentIndex, 1); // 현재 인덱스 단어 제거
             if (this.state.currentDisplayList.length === 0) { // 목록 비었으면
                 app.showToast("즐겨찾기 목록이 비었습니다.", false);
                 app.navigateTo('mode', app.state.selectedSheet); // 모드 선택 화면으로 이동
                 return;
             }
             // 현재 인덱스가 목록 범위를 벗어나면 마지막 인덱스로 조정
             if(this.state.currentIndex >= this.state.currentDisplayList.length) {
                 this.state.currentIndex = this.state.currentDisplayList.length - 1;
             }
             this.displayWord(this.state.currentIndex); // 변경된 목록 기준으로 단어 다시 표시
        }
    },
    navigate(direction) { // 이전/다음 단어로 이동
        activityTracker.recordActivity();
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up'); // 카드 뒷면 보이는지
        const len = this.state.currentDisplayList.length;
        if (len === 0) return; // 목록 없으면 중단
        // 이동 로직 함수
        const navigateAction = () => {
            // 인덱스 계산 (순환, 음수 방지)
            this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
            this.displayWord(this.state.currentIndex); // 해당 단어 표시
        };
        // 카드 뒷면 보이면 뒤집고 약간 지연 후 이동, 아니면 바로 이동
        if (isBackVisible) { this.handleFlip(); setTimeout(navigateAction, 300); }
        else { navigateAction(); }
    },
    async handleFlip() { // 카드 뒤집기 (예문 표시/숨김)
        activityTracker.recordActivity();
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentDisplayList[this.state.currentIndex];
        const hasSample = wordData && wordData.sample && wordData.sample.trim() !== ''; // 예문 있는지

        // 버튼 이미지 URL
        const backImgUrl = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png'; // 뒤로가기 아이콘
        const sampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png'; // 예문 아이콘
        const noSampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png'; // 예문 없음 아이콘

        if (!isBackVisible) { // 앞면 보이는 상태 -> 뒷면 표시 시도
            if (!hasSample) { app.showNoSampleMessage(); return; } // 예문 없으면 메시지 표시 후 중단
            // 뒷면 내용 설정
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent); // 예문 렌더링
            // 뒷면 표시 (슬라이드 업 애니메이션)
            this.elements.cardBack.classList.add('is-slid-up');
            // 버튼 이미지 '뒤로가기'로 변경
            this.elements.sampleBtnImg.src = await imageDBCache.loadImage(backImgUrl);
        } else { // 뒷면 보이는 상태 -> 앞면 표시
            this.elements.cardBack.classList.remove('is-slid-up'); // 뒷면 숨김
            // 앞면 내용 다시 표시 (버튼 이미지 포함)
            this.displayWord(this.state.currentIndex); // displayWord 함수가 버튼 이미지도 다시 설정함
        }
    },
    isLearningModeActive() { return !this.elements.appContainer.classList.contains('hidden'); }, // 학습 모드 활성화 여부 반환
    handleMiddleClick(e) { // 마우스 휠 클릭 시 카드 뒤집기
        if (this.isLearningModeActive() && e.button === 1) { // 학습 모드 활성화 & 휠 클릭(button 1)
            e.preventDefault();
            this.elements.sampleBtn.click(); // 예문 버튼 클릭 효과
        }
    },
    handleKeyDown(e) { // 키보드 이벤트 처리
        // 학습 모드 아니거나 입력 필드 포커스 시 무시
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        activityTracker.recordActivity();
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': -1, 'ArrowDown': 1 }; // 방향키 매핑
        if (keyMap[e.key] !== undefined) { e.preventDefault(); this.navigate(keyMap[e.key]); } // 방향키 -> 이전/다음
        else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); } // 엔터 -> 카드 뒤집기
        else if (e.key === ' ') { e.preventDefault(); if (!this.elements.cardBack.classList.contains('is-slid-up')) api.speak(this.elements.wordDisplay.textContent); } // 스페이스 -> 단어 TTS (앞면일 때만)
    },
    handleTouchStart(e) { // 터치 시작 (스와이프 감지)
        // 학습 모드 아니거나, 특정 상호작용 요소 터치 시 무시
        if (!this.isLearningModeActive() || e.target.closest('.interactive-word, #word-display, #favorite-btn, #progress-bar-track, #sample-btn, #prev-btn, #next-btn')) return;
        // 시작 좌표 저장
        this.state.touchstartX = e.changedTouches[0].screenX; this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) { // 터치 끝 (스와이프 감지)
        // 학습 모드 아니거나, 시작 좌표 없거나, 버튼 등 터치 시 무시
        if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick], #progress-bar-track')) { this.state.touchstartX = this.state.touchstartY = 0; return; }
        // 이동 거리 계산
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX;
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY;
        // 가로 이동 거리가 더 크고, 50px 이상 이동했으면 스와이프로 간주
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1); // 왼쪽->오른쪽: 이전, 오른쪽->왼쪽: 다음
        // 시작 좌표 초기화
        this.state.touchstartX = this.state.touchstartY = 0;
    },
    updateProgressBar(index) { // 진행 바 UI 업데이트
        const total = this.state.currentDisplayList.length;
        if (total <= 1) { // 단어 1개 이하면 항상 100%
            this.elements.progressBarFill.style.width = '100%';
            this.elements.progressBarHandle.style.left = '100%';
            if (this.elements.progressBarNumber) { // 숫자 표시
                this.elements.progressBarNumber.textContent = total > 0 ? '1' : ''; // 1 또는 빈칸
                this.elements.progressBarNumber.style.left = '100%';
            }
            return;
        }
        // 현재 인덱스 비율 계산
        const percentage = (index / (total - 1)) * 100;
        // 채워진 바 너비 설정
        this.elements.progressBarFill.style.width = `${percentage}%`;
        // 핸들 위치 설정 (핸들 너비 절반만큼 왼쪽으로 이동하여 중앙 맞춤)
        this.elements.progressBarHandle.style.left = `calc(${percentage}% - ${this.elements.progressBarHandle.offsetWidth / 2}px)`;
        // 숫자 표시 및 위치 설정
        if (this.elements.progressBarNumber) {
            this.elements.progressBarNumber.textContent = index + 1; // 1부터 시작하는 번호
            this.elements.progressBarNumber.style.left = `${percentage}%`; // 핸들 아래 중앙
        }       
    },
    handleProgressBarInteraction(e) { // 진행 바 클릭/드래그 처리
        if (!this.isLearningModeActive()) return; // 학습 모드 아니면 무시

        const track = this.elements.progressBarTrack;
        const totalWords = this.state.currentDisplayList.length;
        if (totalWords <= 1) return; // 단어 1개 이하면 무시

        // 클릭/터치 위치 기반으로 인덱스 계산 및 단어 표시 함수
        const handleInteraction = (clientX) => {
            activityTracker.recordActivity(); // 활동 기록
            const rect = track.getBoundingClientRect(); // 진행 바 영역 정보
            const x = clientX - rect.left; // 영역 내 x 좌표
            const percentage = Math.max(0, Math.min(1, x / rect.width)); // 비율 계산 (0~1)
            const newIndex = Math.round(percentage * (totalWords - 1)); // 해당 비율의 인덱스 계산
            // 인덱스 변경됐으면 단어 표시 업데이트
            if (newIndex !== this.state.currentIndex) {
                this.state.currentIndex = newIndex;
                this.displayWord(newIndex);
            }
        };

        // 이벤트 타입별 처리
        switch (e.type) {
            case 'mousedown': // 마우스 누름
                this.state.isDragging = true; // 드래그 시작
                handleInteraction(e.clientX); // 현재 위치 처리
                break;
            case 'mousemove': // 마우스 이동
                if (this.state.isDragging) handleInteraction(e.clientX); // 드래그 중일 때만 처리
                break;
            case 'mouseup': // 마우스 뗌
            case 'mouseleave': // 마우스 벗어남
                this.state.isDragging = false; // 드래그 종료
                break;
            case 'touchstart': // 터치 시작
                e.preventDefault(); // 스크롤 등 기본 동작 방지
                this.state.isDragging = true; // 드래그 시작
                handleInteraction(e.touches[0].clientX); // 현재 위치 처리
                break;
            case 'touchmove': // 터치 이동
                if (this.state.isDragging) handleInteraction(e.touches[0].clientX); // 드래그 중일 때만 처리
                break;
            case 'touchend': // 터치 끝
                this.state.isDragging = false; // 드래그 종료
                break;
        }
    },
};

// Levenshtein 거리 계산 함수 (두 문자열 간의 편집 거리)
function levenshteinDistance(a = '', b = '') {
    // 행렬 생성 (b 길이 + 1) x (a 길이 + 1)
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    // 첫 행 초기화 (0, 1, 2, ...)
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
    // 첫 열 초기화 (0, 1, 2, ...)
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
    // 행렬 채우기
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            // 문자가 같으면 비용 0, 다르면 1
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            // 왼쪽, 위쪽, 왼쪽 위 대각선 값 + 비용 중 최솟값 선택
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // 삽입
                track[j - 1][i] + 1, // 삭제
                track[j - 1][i - 1] + indicator, // 변경 또는 유지
            );
        }
    }
    // 최종 편집 거리 반환 (행렬의 마지막 값)
    return track[b.length][a.length];
}

