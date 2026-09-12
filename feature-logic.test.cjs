const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class MemoryStorage {
    constructor() {
        this.data = new Map();
        this.limit = Infinity;
    }
    getItem(key) {
        return this.data.has(key) ? this.data.get(key) : null;
    }
    setItem(key, value) {
        const previous = this.data.get(key);
        this.data.set(key, String(value));
        let size = 0;
        for (const [storedKey, storedValue] of this.data) size += storedKey.length + storedValue.length;
        if (size > this.limit) {
            if (previous === undefined) this.data.delete(key);
            else this.data.set(key, previous);
            const error = new Error('quota exceeded');
            error.name = 'QuotaExceededError';
            throw error;
        }
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
const spokenTexts = [];
const window = {
    addEventListener() {},
    removeEventListener() {},
    firebaseSDK: {},
    speechSynthesis: {
        cancel() {},
        getVoices() { return [{ name: 'Google US English', lang: 'en-US' }]; },
        speak(utterance) { spokenTexts.push(utterance.text); },
        addEventListener() {}
    }
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
    SpeechSynthesisUtterance: class {
        constructor(text) { this.text = text; }
    },
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
    `${source}\n;globalThis.__featureTest = { app, utils, quizMode, learningMode, api, isIosDevice, ui };`,
    context,
    { filename: 'script.js' }
);

const { app, utils, quizMode, learningMode, api, isIosDevice, ui } = context.__featureTest;
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

const multilineMeaningCorrect = {
    word: 'multiline-target',
    meaning: '<b>1. 정답</b>\n2. 정답의 둘째 뜻',
    pos: 'n'
};
const multilineMeaningCandidates = [
    { word: 'same-first-line', meaning: '<i>1. 정답</i><br>2. 중복 오답', pos: 'n' },
    { word: 'wrong-b', meaning: '1. 오답 B<br>2. B의 둘째 뜻', pos: 'n' },
    { word: 'wrong-c', meaning: '1. 오답 C\n2. C의 둘째 뜻', pos: 'n' },
    { word: 'wrong-d', meaning: '<div>1. 오답 D</div><div>2. D의 둘째 뜻</div>', pos: 'n' }
];
const multilineMeaningQuiz = quizMode.createMeaningQuiz(
    multilineMeaningCorrect,
    [multilineMeaningCorrect, ...multilineMeaningCandidates]
);
assert.equal(multilineMeaningQuiz.answer, '1. 정답');
assert.deepEqual(
    JSON.parse(JSON.stringify([...multilineMeaningQuiz.choices].sort())),
    ['1. 정답', '1. 오답 B', '1. 오답 C', '1. 오답 D'].sort()
);
assert.equal(new Set(multilineMeaningQuiz.choices).size, 4);
assert.equal(multilineMeaningCorrect.meaning, '<b>1. 정답</b>\n2. 정답의 둘째 뜻');
console.log('PASS 영한 퀴즈는 원본 뜻을 유지하면서 첫 줄만 사용하고 중복 오답을 제외한다');

assert.equal(quizMode._getFirstMeaningLine('크고, 아름답다,  \n둘째 뜻'), '크고, 아름답다');
assert.equal(quizMode._getFirstMeaningLine('<b>첫째 뜻，</b><br>둘째 뜻'), '첫째 뜻');
assert.equal(quizMode._getFirstMeaningLine('원인: 결과;  \n둘째 뜻'), '원인: 결과');
assert.equal(quizMode._getFirstMeaningLine('<i>첫째 뜻；：</i><br>둘째 뜻'), '첫째 뜻');
console.log('PASS 영한 퀴즈는 첫 줄 끝 쉼표·세미콜론·콜론만 제거하고 중간 기호는 유지한다');

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

learningMode.state.wordList['2y'] = [
    { word: 'intro' },
    { word: 'later-a', part: 'Lesson 2', partOrder: 2 },
    { word: 'later-b', part: 'Lesson 2', partOrder: 2 },
    { word: 'first-a', part: 'Lesson 1', partOrder: 1 },
    { word: 'first-b', part: 'Lesson 1', partOrder: 1 }
];
assert.deepEqual(
    JSON.parse(JSON.stringify(utils.getParts('2y').map(({ name, start, end, count }) => ({ name, start, end, count })))),
    [
        { name: 'Lesson 1', start: 4, end: 5, count: 2 },
        { name: 'Lesson 2', start: 2, end: 3, count: 2 }
    ]
);
console.log('PASS Part를 시트 순서대로 모으고 어휘카드 번호 범위를 계산한다');

const words2y = learningMode.state.wordList['2y'];
const lesson1 = utils.getParts('2y').find(part => part.name === 'Lesson 1');
assert.equal(learningMode.findStart(words2y, lesson1, '', 0).index, 3);
assert.equal(learningMode.findStart(words2y, null, '', 4).index, 4);
assert.equal(learningMode.findStart(words2y, null, '', 99).index, 0);
console.log('PASS 비워 두고 시작하면 Part는 첫 어휘의 전체 번호로, 전체는 최근 위치로 들어간다');

assert.equal(learningMode.findStart(words2y, lesson1, 'first-b', 0).index, 4);
const outsidePart = learningMode.findStart(words2y, lesson1, 'later-a', 0);
assert.equal(outsidePart.index, undefined);
assert.ok(outsidePart.vocabMatches.every(match => match.index === 3 || match.index === 4));
assert.equal(learningMode.findStart(words2y, null, 'later-a', 0).index, 1);
console.log('PASS 검색은 고른 Part 안에서만 찾고 찾은 카드는 전체 번호로 연다');

learningMode.state.wordList['3y'] = [
    { word: 'x1', part: 'B' },
    { word: 'x2', part: 'A' },
    { word: 'x3', part: 'A' }
];
assert.deepEqual(JSON.parse(JSON.stringify(utils.getParts('3y').map(part => part.name))), ['B', 'A']);
console.log('PASS partOrder가 없는 예전 데이터는 목록에 처음 나온 순서를 따른다');

const lessonParts = utils.getParts('2y');
assert.equal(quizMode.getPartValueForRange(1, 5, 5, lessonParts), '');
assert.equal(quizMode.getPartValueForRange(4, 5, 5, lessonParts), 'Lesson 1');
assert.equal(quizMode.getPartValueForRange(3, 2, 5, lessonParts), 'Lesson 2');
assert.equal(quizMode.getPartValueForRange(2, 4, 5, lessonParts), quizMode.CUSTOM_PART_VALUE);
console.log('PASS 출제범위가 전체·Part와 맞는지 가리고 아니면 직접 입력으로 본다');

assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' }), true);
assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)' }), true);
assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 }), false);
assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
assert.equal(isIosDevice(undefined), false);
console.log('PASS 아이폰·아이패드만 iOS로 보고 맥·윈도우·안드로이드는 제외한다');

Object.assign(context.navigator, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' });
api.speak('apple');
assert.deepEqual(spokenTexts, []);
Object.assign(context.navigator, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 });
api.speak('apple');
assert.deepEqual(spokenTexts, ['apple']);
console.log('PASS iOS에서는 발음하지 않고 다른 기기에서는 그대로 발음한다');

const plain = value => JSON.parse(JSON.stringify(value));
const temperatureBlocks = plain(ui.parseExplanation([
    '[동의어] fever (열)',
    '',
    '[연어] room temperature (실온), body temperature (체온)',
    "take one's temperature (~의 체온을 재다)",
    '[숙어] have a temperature (열이 나다)',
    '[관련어] thermometer (온도계), thermal (열의), Celsius (섭씨의)',
    'Fahrenheit (화씨의)',
    '[혼동어휘] temperament (기질), temperate (온화한)'
].join('\n')));
assert.deepEqual(temperatureBlocks.map(block => block.tag), ['동의어', '숙어', '연어', '관련어', '혼동어휘']);
assert.equal(temperatureBlocks.find(block => block.tag === '연어').rows.length, 1);
assert.deepEqual(temperatureBlocks.find(block => block.tag === '연어').rows[0].items.map(item => item.english),
    ['room temperature', 'body temperature', "take one's temperature"]);
assert.deepEqual(temperatureBlocks.find(block => block.tag === '관련어').rows[0].items.map(item => item.gloss), ['온도계', '열의', '섭씨의', '화씨의']);
console.log('PASS 설명을 테마별로 묶고 빈 행은 버리며 태그 없는 줄은 앞 테마 목록에 잇는다');

const [rootBlock] = plain(ui.parseExplanation('[어근] -tend-, -tens- (뻗다): extend (~을 확장하다), intend (~을 의도하다)'));
assert.equal(rootBlock.rows[0].root, '-tend-, -tens- (뻗다)');
assert.deepEqual(rootBlock.rows[0].items, [
    { english: 'extend', gloss: '~을 확장하다' },
    { english: 'intend', gloss: '~을 의도하다' }
]);
console.log('PASS 어근 줄은 첫 콜론 앞을 어근 정보로, 뒤를 어휘 목록으로 나눈다');

const [edgeBlock] = plain(ui.parseExplanation('[연어] extend (~을 확장하다, 늘리다), have (a) temperature (열이 나다)'));
assert.deepEqual(edgeBlock.rows[0].items, [
    { english: 'extend', gloss: '~을 확장하다, 늘리다' },
    { english: 'have (a) temperature', gloss: '열이 나다' }
]);
const [proseBlock] = plain(ui.parseExplanation("[참고] temper는 원래 '섞다'라는 뜻이다, 그래서 기질이 되었다."));
assert.equal(proseBlock.rows[0].items, null);
assert.equal(proseBlock.rows[0].text, "temper는 원래 '섞다'라는 뜻이다, 그래서 기질이 되었다.");
console.log('PASS 뜻 괄호 속 쉼표는 나누지 않고, 목록 모양이 아닌 문장은 그대로 둔다');

assert.deepEqual(plain(ui.explanationThemes['참고']), plain(ui.explanationThemes['관련어']));
console.log('PASS 참고는 관련어와 같은 기호와 색으로 보인다');

assert.deepEqual(plain(ui.explanationThemes['용례']), plain(ui.explanationThemes['연어']));
const oldFormatBlocks = plain(ui.parseExplanation([
    '[반의어] 종속적인: subordinate / 열성의: recessive',
    '[파생어] dominate',
    'dominance',
    'dominantly',
    '[반의어] 정서적인: emotional, affective',
    '[동의어] calculate, judge, reckon / 추정치: estimation, assessment',
    '[어근] simpl- + -fic-: simple, simplicity',
    '[연어] and/or, either way'
].join('\n')));
const [labeledBlock, sharedGlossBlock] = oldFormatBlocks.filter(block => block.tag === '반의어');
const blockOf = tag => oldFormatBlocks.find(block => block.tag === tag);
assert.deepEqual(labeledBlock.rows[0].items, [
    { english: 'subordinate', gloss: '종속적인', breakBefore: false },
    { english: 'recessive', gloss: '열성의', breakBefore: false }
]);
assert.deepEqual(blockOf('파생어').rows[0].items.map(item => item.english), ['dominate', 'dominance', 'dominantly']);
assert.deepEqual(sharedGlossBlock.rows[0].items, [
    { english: 'emotional, affective', gloss: '정서적인', breakBefore: false }
]);
assert.deepEqual(blockOf('동의어').rows[0].items, [
    { english: 'calculate', gloss: '', breakBefore: false },
    { english: 'judge', gloss: '', breakBefore: false },
    { english: 'reckon', gloss: '', breakBefore: false },
    { english: 'estimation, assessment', gloss: '추정치', breakBefore: true }
]);
assert.equal(blockOf('어근').rows[0].root, 'simpl- + -fic-');
assert.deepEqual(blockOf('어근').rows[0].items.map(item => item.english), ['simple', 'simplicity']);
assert.deepEqual(blockOf('연어').rows[0].items.map(item => item.english), ['and/or', 'either way']);
console.log('PASS 예전 형식(한글 뜻: 어휘 / …, 줄바꿈 목록, 용례)을 지금 규칙으로 읽는다');

for (const tag of ['기타', 'etc', 'ETC']) {
    assert.deepEqual(plain(ui.getExplanationTheme(tag)), plain(ui.explanationThemes['관련어']));
}
const orderedTags = plain(ui.parseExplanation([
    '맨 앞에 적힌 안내 글',
    '[어근] -domin-: dominate',
    '[모름] something',
    '[혼동어휘] dominion (영토)',
    '[etc] domino',
    '[용례] a dominant role',
    '[연어] the dominant group',
    '[숙어] rule the roost',
    '[파생어] dominance',
    '[참고] domain',
    '[반의어] recessive',
    '[동의어] main'
].join('\n'))).map(block => block.tag);
assert.deepEqual(orderedTags,
    ['', '동의어', '반의어', '파생어', '숙어', '용례', '연어', 'etc', '참고', '혼동어휘', '어근', '모름']);
console.log('PASS 테마는 시트 순서와 상관없이 정해진 순서로, 같은 순서끼리는 시트 순서대로 보인다');

const [illustrateBlock] = plain(ui.parseExplanation(['[파생어] illustrate 설명하다', 'illustration', 'illustrator'].join('\n')));
assert.equal(illustrateBlock.rows.length, 1);
assert.deepEqual(illustrateBlock.rows[0].items, [
    { english: 'illustrate', gloss: '설명하다' },
    { english: 'illustration', gloss: '' },
    { english: 'illustrator', gloss: '' }
]);
assert.deepEqual(plain(ui._parseExplanationItem("take one's temperature ~의 체온을 재다")),
    { english: "take one's temperature", gloss: '~의 체온을 재다' });
assert.deepEqual(plain(ui._parseExplanationItem('keep ~ in mind 명심하다')),
    { english: 'keep ~ in mind', gloss: '명심하다' });
console.log('PASS 괄호 없이 띄어 쓴 뜻도 영어와 뜻으로 나누고 이어진 줄과 한 목록으로 묶는다');

const fluidBlocks = plain(ui.parseExplanation([
    '[동의어] liquid / 유동적인: flexible, changeable, smooth',
    '[반의어] 고체: solid / 고정된: fixed, rigid'
].join('\n')));
assert.deepEqual(fluidBlocks[0].rows[0].items, [
    { english: 'liquid', gloss: '유동적인', breakBefore: false },
    { english: 'flexible', gloss: '', breakBefore: false },
    { english: 'changeable', gloss: '', breakBefore: false },
    { english: 'smooth', gloss: '', breakBefore: false }
]);
assert.deepEqual(fluidBlocks[1].rows[0].items, [
    { english: 'solid', gloss: '고체', breakBefore: false },
    { english: 'fixed, rigid', gloss: '고정된', breakBefore: false }
]);
console.log('PASS 뜻 없는 어휘 하나 뒤의 뜻 머리는 그 어휘의 뜻으로 보고, 묶음마다 뜻이 있으면 한 줄로 잇는다');

const [blastBlock] = plain(ui.parseExplanation('[동의어] blast, detonation, eruption (폭발), boom, surge (폭발적 증가)'));
assert.deepEqual(blastBlock.rows[0].items, [
    { english: 'blast, detonation, eruption', gloss: '폭발' },
    { english: 'boom, surge', gloss: '폭발적 증가' }
]);
const [trailingBlock] = plain(ui.parseExplanation('[파생어] illustrate (설명하다), illustration, illustrator'));
assert.deepEqual(trailingBlock.rows[0].items, [
    { english: 'illustrate', gloss: '설명하다' },
    { english: 'illustration', gloss: '' },
    { english: 'illustrator', gloss: '' }
]);
const [separateLinesBlock] = plain(ui.parseExplanation(['[파생어] illustrate 설명하다', 'illustration', 'illustrator 삽화가'].join('\n')));
assert.deepEqual(separateLinesBlock.rows[0].items, [
    { english: 'illustrate', gloss: '설명하다' },
    { english: 'illustration', gloss: '' },
    { english: 'illustrator', gloss: '삽화가' }
]);
console.log('PASS 같은 줄에서만 뜻 없는 어휘가 뒤의 뜻을 함께 쓰고, 줄바꿈을 넘어서는 묶지 않는다');

const levenshtein = vm.runInContext('levenshteinDistance', context);
assert.equal(levenshtein('kitten', 'sitting'), 3);
assert.equal(levenshtein('abcdef', 'xyz', 2), 3);
const searchWords = ['illustrate', 'still', 'illusion', 'allusion', 'illustration'].map((word, id) => ({ id, word }));
assert.deepEqual(plain(learningMode.findStart(searchWords, null, 'illus', 0)).vocabMatches.map(m => m.word),
    ['illustrate', 'illusion', 'illustration']);
assert.deepEqual(plain(learningMode.findStart(searchWords, null, 'strat', 0)).vocabMatches.map(m => m.word),
    ['illustrate', 'illustration']);
assert.deepEqual(plain(learningMode.findStart(searchWords, null, 'illustrait', 0)).vocabMatches.map(m => m.word),
    ['illustrate']);
console.log('PASS 검색은 앞 글자 → 포함 → 비슷한 철자 순으로 찾는다');

const storageSize = () => [...localStorage.data].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
localStorage.setItem('wordListCache_1y', JSON.stringify({ words: [] }));
localStorage.setItem('wordListCache_2y', 'x'.repeat(300));
localStorage.setItem('wordListCacheTimestamp_2y', '1');
localStorage.setItem('wordListCache_3y', 'x'.repeat(300));
localStorage.limit = storageSize() + 10;
utils.addProgressUpdateToLocalSync('cherry', 'favorite', true, '1y');
localStorage.limit = Infinity;
assert.equal(utils.getCombinedProgress('cherry', '1y').favorite, true);
assert.equal(localStorage.getItem('wordListCache_2y'), null);
assert.equal(localStorage.getItem('wordListCacheTimestamp_2y'), null);
assert.equal(localStorage.getItem('wordListCache_3y'), null);
assert.notEqual(localStorage.getItem('wordListCache_1y'), null);
localStorage.removeItem('wordListCache_1y');
console.log('PASS 저장 공간이 차면 다른 학년 단어장 캐시부터 비우고 학습 기록을 저장한다');

(async () => {
    const setFirebase = impl => {
        context.__getImpl = impl;
        vm.runInContext('ref = (_db, path) => path; get = path => __getImpl(path);', context);
    };

    localStorage.setItem('wordListCache_3y', JSON.stringify({ words: [{ id: 2, word: 'b' }, { id: 1, word: 'a' }] }));
    localStorage.setItem('wordListCacheTimestamp_3y', '123');
    localStorage.setItem('wordListVersion_3y', '5');
    learningMode.state.isWordListReady['3y'] = false;
    setFirebase(async () => { throw new Error('Client is offline'); });
    await learningMode.loadWordList(false, '3y');
    assert.deepEqual(plain(learningMode.state.wordList['3y'].map(w => w.word)), ['a', 'b']);
    assert.notEqual(localStorage.getItem('wordListCache_3y'), null);
    console.log('PASS 오프라인이라 버전을 확인하지 못해도 저장해 둔 단어장을 지우지 않고 쓴다');

    learningMode.state.isWordListReady['3y'] = false;
    setFirebase(async path => {
        if (path === 'app_config/vocab_version_3y') return { val: () => 99 };
        throw new Error('network');
    });
    await learningMode.loadWordList(false, '3y');
    assert.equal(learningMode.state.isWordListReady['3y'], true);
    assert.equal(localStorage.getItem('wordListVersion_3y'), '5');
    console.log('PASS 새 버전을 받다가 실패하면 저장해 둔 단어장으로 계속한다');

    let vocabularyRequests = 0;
    learningMode.state.isWordListReady['2y'] = false;
    setFirebase(async path => {
        if (path === '2y/vocabulary') {
            vocabularyRequests++;
            await new Promise(resolve => setTimeout(resolve, 10));
            return { val: () => ({ a: { id: 1, word: 'a' } }) };
        }
        return { val: () => 7 };
    });
    await Promise.all([learningMode.loadWordList(false, '2y'), learningMode.loadWordList(false, '2y')]);
    assert.equal(vocabularyRequests, 1);
    assert.equal(localStorage.getItem('wordListVersion_2y'), '7');
    console.log('PASS 같은 학년 단어장을 동시에 불러도 서버 요청은 한 번이다');

    setFirebase(async () => { throw new Error('Client is offline'); });
    await assert.rejects(api.checkPermission('student@school.kr'));
    setFirebase(async () => { throw new Error('Permission denied'); });
    assert.deepEqual(plain(await api.checkPermission('student@school.kr')), { status: 'not_found', canEdit: false });
    setFirebase(async () => ({ val: () => ({ permissions: 'approved', canEdit: true }) }));
    assert.deepEqual(plain(await api.checkPermission('student@school.kr')), { status: 'approved', canEdit: true });
    console.log('PASS 통신 오류는 권한 요청 창 대신 오류로 처리하고, 권한 없음만 명단에 없음으로 본다');

    const definitionWords = Array.from({ length: 7 }, (_, i) => ({ word: `w${i + 1}`, pos: 'n', meaning: `m${i + 1}` }));
    const originalFetchDefinition = api.fetchDefinition;
    const asked = [];
    api.fetchDefinition = async word => {
        asked.push(word);
        await new Promise(resolve => setTimeout(resolve, 5));
        return word === 'w6' ? 'a thing' : null;
    };
    const found = await quizMode._makeQuizFromCandidates('MULTIPLE_CHOICE_DEFINITION', definitionWords, definitionWords);
    assert.equal(found.question.word, 'w6');
    assert.deepEqual(plain(asked.slice(0, 5)), ['w1', 'w2', 'w3', 'w4', 'w5']);
    asked.length = 0;
    const preloadOnly = await quizMode._makeQuizFromCandidates(
        'MULTIPLE_CHOICE_DEFINITION', definitionWords, definitionWords, { exhaustive: false });
    assert.equal(preloadOnly, null);
    assert.equal(asked.length, 5);
    api.fetchDefinition = originalFetchDefinition;
    console.log('PASS 영영 퀴즈는 5개씩 동시에 뜻풀이를 물어 만들고, 미리 준비는 첫 5개만 본다');

    let fetchCount = 0;
    context.fetch = async url => {
        fetchCount++;
        const word = decodeURIComponent(url.split('/json/')[1].split('?')[0]);
        if (word === 'offline') throw new Error('offline');
        return { ok: true, json: async () => (word === 'nodef' ? ['suggestion'] : [{ shortdef: ['to make larger; to extend'] }]) };
    };
    const quietError = console.error;
    console.error = () => {};
    assert.equal(await api.fetchDefinition('Extend'), 'to make larger');
    assert.equal(await api.fetchDefinition('extend'), 'to make larger');
    assert.equal(fetchCount, 1);
    assert.equal(await api.fetchDefinition('nodef'), null);
    assert.equal(await api.fetchDefinition('nodef'), null);
    assert.equal(fetchCount, 2);
    assert.equal(await api.fetchDefinition('offline'), null);
    assert.equal(await api.fetchDefinition('offline'), null);
    assert.equal(fetchCount, 4);
    console.error = quietError;
    console.log('PASS 영영 풀이는 한 번 받으면 저장해 다시 묻지 않고, 통신 오류는 저장하지 않는다');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
