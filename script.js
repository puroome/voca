@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');

/* 배경 이미지를 위한 가상 요소 추가 */
:root {
    --bg-image: url('');
}

body {
    font-family: 'Noto Sans KR', sans-serif;
    -webkit-tap-highlight-color: transparent;
    background-color: #f1f5f9;
}

body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-image: var(--bg-image);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.5; /* 외부 배경 진하게 */
    z-index: -1;
    background-color: #f1f5f9;
    transition: background-image 1s ease-in-out;
}

/* 앱 내부 화면을 위한 반투명 스타일 (블러 제거) */
.content-panel {
    background-color: rgba(255, 255, 255, 0.8); /* 내부 패널 투명도 조정 */
}

/* 제작자 문구 스타일 */
.author-text {
    color: rgba(107, 114, 128, 0.8); /* gray-500, 80% opacity */
}

.loader {
    border: 4px solid #f3f3f3;
    border-radius: 50%;
    border-top: 4px solid #3498db;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* 학년 선택 화면 스타일 수정 */
.perspective-container {
    perspective: 1000px;
}
.grade-select-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
}
.grade-select-card img.group {
    cursor: pointer;
    transition: transform 0.4s ease, filter 0.4s ease; /* filter transition 추가 */
    transform-style: preserve-3d;
}
.grade-select-card img.group:hover {
    transform: translateY(-10px) rotateX(5deg) scale(1.05);
    filter: drop-shadow(0 15px 10px rgba(0, 0, 0, 0.3)); /* box-shadow 대신 drop-shadow 사용 */
}
.grade-select-card .emoji {
    pointer-events: none;
}
/* 학년별 이미지 크기 조정 */
.grade-3 { max-width: 100%; }
.grade-2 { max-width: 90%; }
.grade-1 { max-width: 80%; }


/* 퀴즈 모드 및 UX 개선 스타일 */
.choice-item:hover { transform: scale(1.02); }
.choice-item.submitting { background-color: #e2e8f0; } /* Tailwind gray-200 */
.correct { background-color: #28a745 !important; color: white !important; transform: scale(1.05); border-color: #28a745; }
.incorrect { background-color: #dc3545 !important; color: white !important; border-color: #dc3545; }
.disabled { pointer-events: none; opacity: 0.7; }

/* 학습/퀴즈 공통 스타일 */
#word-display, #quiz-word {
    white-space: nowrap;
}

/* 단어 위 텍스트 선택 방지 (터치 시 기본 메뉴 비활성화) */
.interactive-word {
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none;    /* Firefox */
    -ms-user-select: none;     /* IE/Edge */
    user-select: none;         /* Standard */
}

#word-display:hover, #quiz-word:hover, .interactive-word:hover { 
    color: #1e40af; 
    cursor: pointer; 
}
#word-display.word-clicked, #quiz-word.word-clicked, .interactive-word.word-clicked {
    background-color: #d1fae5; /* Tailwind green-100 */
    transition: background-color 0.1s;
    border-radius: 0.375rem;
}
.sample-sentence:hover { 
    background-color: #f0f4f8; 
    cursor: pointer; 
}

/* 학습 모드 - 슬라이드 패널 (A어플 스타일) */
#learning-app-container .relative {
    overflow: hidden;
    border-radius: 0.5rem;
}

#learning-card-back {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transform: translateY(100%);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease-in-out;
    pointer-events: none;
    display: flex;
    flex-direction: column;
}

#learning-card-back.is-slid-up {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
}


#learning-card-front {
    min-height: 45vh; /* 화면 높이의 45%를 최소 높이로 지정 */
}

/* 빈칸 채우기 퀴즈 문장 줄바꿈 시 들여쓰기 */
.quiz-sentence-indent {
    padding-left: 1.5em; 
    text-indent: -1.5em;
}

/* 프로그레스 바 핸들 활성화 스타일 추가 */
#progress-bar-handle:active {
    cursor: grabbing;
    transform: scale(1.2) translateY(-10%);
}
