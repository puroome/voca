const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class MemoryStorage {
    constructor() {
        this.data = new Map();
    }
    getItem(key) {
        return this.data.has(key) ? this.data.get(key) : null;
    }
    setItem(key, value) {
        this.data.set(key, String(value));
    }
    removeItem(key) {
        this.data.delete(key);
    }
}

const localStorage = new MemoryStorage();
const elementStub = () => ({ classList: { add() {}, remove() {}, contains() { return false; } } });
const document = {
    body: elementStub(),
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return elementStub(); },
    querySelectorAll() { return []; },
    createElement() { return elementStub(); }
};
const window = {
    addEventListener() {},
    removeEventListener() {},
    firebaseSDK: {}
};
const context = {
    console,
    document,
    window,
    localStorage,
    history: {},
    navigator: {},
    location: {},
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    Date,
    Map,
    Set,
    Promise,
    JSON,
    Math,
    RegExp,
    Array,
    Object,
    Number,
    String,
    Error,
    URL,
    URLSearchParams,
    vocaStatsStore: {
        getLocalDateString: () => '2026-07-26'
    }
};
context.globalThis = context;

const sourceFiles = [
    './script.js',
    './js/app.js',
    './js/services.js',
    './js/ui.js',
    './js/utils.js',
    './js/dashboard.js',
    './js/quiz.js',
    './js/learning.js'
];
const source = sourceFiles
    .map(file => fs.readFileSync(require.resolve(file), 'utf8'))
    .join('\n');
vm.runInNewContext(
    `${source}\n;globalThis.__featureTest = { app, utils, quizMode, learningMode };`,
    context,
    { filename: 'script.js' }
);

const { app, utils, quizMode, learningMode } = context.__featureTest;
app.state.selectedSheet = '1y';
app.state.user = { uid: 'test-user' };
learningMode.state.wordList['1y'] = [
    { word: 'apple' },
    { word: 'banana' },
    { word: 'cherry' }
];
learningMode.state.isWordListReady['1y'] = true;

const posCorrect = {
    word: 'target',
    meaning: 'correct-meaning',
    pos: 'n, v.',
    sample: 'The target changes.'
};
const posCandidates = [
    { word: 'exact', meaning: 'exact-meaning', pos: 'V; N' },
    { word: 'superset', meaning: 'superset-meaning', pos: 'adv / n / v' },
    { word: 'overlap', meaning: 'overlap-meaning', pos: 'n' },
    { word: 'unrelated', meaning: 'unrelated-meaning', pos: 'a' }
];
const rankedPosCandidates = quizMode._rankDistractorCandidatesByPos(
    posCorrect,
    [posCorrect, ...posCandidates]
);
assert.deepEqual(
    JSON.parse(JSON.stringify(rankedPosCandidates.map(candidate => candidate.word))),
    ['exact', 'superset', 'overlap', 'unrelated']
);
console.log('PASS 품사 순서와 구분 기호를 무시하고 4단계 우선순위로 오답 후보를 정렬한다');

const meaningQuiz = quizMode.createMeaningQuiz(posCorrect, [posCorrect, ...posCandidates]);
assert.deepEqual(
    JSON.parse(JSON.stringify([...meaningQuiz.choices].sort())),
    ['correct-meaning', 'exact-meaning', 'overlap-meaning', 'superset-meaning'].sort()
);

const blankQuiz = quizMode.createBlankQuiz(posCorrect, [posCorrect, ...posCandidates]);
const definitionQuiz = quizMode.createDefinitionQuiz(
    posCorrect,
    [posCorrect, ...posCandidates],
    'a definition for the target'
);
for (const quiz of [blankQuiz, definitionQuiz]) {
    assert.deepEqual(
        JSON.parse(JSON.stringify([...quiz.choices].sort())),
        ['target', 'exact', 'superset', 'overlap'].sort()
    );
}
console.log('PASS 영한·빈칸·영영 퀴즈가 동일한 품사 우선순위로 오답을 선택한다');

app.state.currentProgress = {
    apple: {
        MULTIPLE_CHOICE_MEANING: 'incorrect',
        FILL_IN_THE_BLANK: 'correct',
        MULTIPLE_CHOICE_DEFINITION: 'incorrect'
    },
    banana: {
        MULTIPLE_CHOICE_MEANING: 'correct',
        FILL_IN_THE_BLANK: 'correct',
        MULTIPLE_CHOICE_DEFINITION: 'correct'
    },
    old: { favorite: true, favoritedAt: 100 },
    recent: { favorite: true, favoritedAt: 300 },
    middle: { favorite: true, favoritedAt: 200 }
};

const reviewItems = utils.getMistakeReviewItems();
assert.deepEqual(
    JSON.parse(JSON.stringify(reviewItems)),
    [
        { word: 'apple', quizType: 'MULTIPLE_CHOICE_MEANING' },
        { word: 'apple', quizType: 'MULTIPLE_CHOICE_DEFINITION' }
    ]
);
console.log('PASS 오답 단어에서 틀린 퀴즈 유형만 추린다');

const mixedTypes = [
    'MULTIPLE_CHOICE_MEANING',
    'FILL_IN_THE_BLANK',
    'MULTIPLE_CHOICE_DEFINITION'
];
quizMode.configureSession({ mixed: true, mixedTypes });
const mixedPicks = Array.from({ length: 6 }, () => quizMode._pickBalancedMixedType());
const mixedCounts = Object.fromEntries(mixedTypes.map(type => [
    type,
    mixedPicks.filter(picked => picked === type).length
]));
assert.deepEqual(JSON.parse(JSON.stringify(mixedCounts)), {
    MULTIPLE_CHOICE_MEANING: 2,
    FILL_IN_THE_BLANK: 2,
    MULTIPLE_CHOICE_DEFINITION: 2
});
console.log('PASS 혼합 퀴즈 유형을 주기마다 균형 있게 선택한다');

assert.deepEqual(
    JSON.parse(JSON.stringify(utils.getFavoriteWords())),
    ['recent', 'middle', 'old']
);
console.log('PASS 즐겨찾기를 최근 등록순으로 정렬한다');

utils.addProgressUpdateToLocalSync(
    'banana',
    'MULTIPLE_CHOICE_MEANING',
    'incorrect',
    '1y'
);
assert.equal(
    utils.getCombinedProgress('banana', '1y').MULTIPLE_CHOICE_MEANING,
    'incorrect'
);
assert.equal(utils.getWordStatus('banana'), 'review');
console.log('PASS 로컬 변경값이 서버 진행상태보다 우선하며 즉시 반영된다');
