const assert = require('node:assert/strict');

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
    clear() {
        this.data.clear();
    }
}

global.localStorage = new MemoryStorage();
const statsStore = require('./stats-store.js');

function test(name, fn) {
    try {
        localStorage.clear();
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

test('기존 단일 통계를 오늘 날짜 통계로 옮긴다', () => {
    localStorage.setItem('student_unsyncedTime_1y', '75');
    localStorage.setItem(
        'student_unsyncedQuizStats_1y',
        JSON.stringify({ MULTIPLE_CHOICE_MEANING: { correct: 2, total: 3 } })
    );

    const snapshot = statsStore.snapshot('1y');
    const today = statsStore.getLocalDateString();

    assert.equal(snapshot.study[today], 75);
    assert.deepEqual(
        snapshot.quiz[today].MULTIPLE_CHOICE_MEANING,
        { correct: 2, total: 3 }
    );
    assert.equal(localStorage.getItem('student_unsyncedTime_1y'), null);
    assert.equal(localStorage.getItem('student_unsyncedQuizStats_1y'), null);
});

test('학년과 날짜별로 기록을 분리한다', () => {
    statsStore.addStudySeconds('1y', '2026-07-24', 40);
    statsStore.addStudySeconds('1y', '2026-07-25', 20);
    statsStore.addStudySeconds('2y', '2026-07-25', 90);
    statsStore.addQuizResult('1y', '2026-07-25', 'FILL_IN_THE_BLANK', true);

    assert.deepEqual(statsStore.getPendingStudy('1y'), {
        '2026-07-24': 40,
        '2026-07-25': 20
    });
    assert.deepEqual(statsStore.getPendingStudy('2y'), { '2026-07-25': 90 });
    assert.deepEqual(statsStore.getPendingQuiz('1y')['2026-07-25'].FILL_IN_THE_BLANK, {
        correct: 1,
        total: 1
    });
});

test('동기화 도중 새로 쌓인 기록은 삭제하지 않는다', () => {
    statsStore.addStudySeconds('3y', '2026-07-25', 30);
    statsStore.addQuizResult('3y', '2026-07-25', 'MULTIPLE_CHOICE_DEFINITION', false);
    const snapshot = statsStore.snapshot('3y');

    statsStore.addStudySeconds('3y', '2026-07-25', 12);
    statsStore.addQuizResult('3y', '2026-07-25', 'MULTIPLE_CHOICE_DEFINITION', true);
    statsStore.subtractSnapshot('3y', snapshot);

    assert.deepEqual(statsStore.getPendingStudy('3y'), { '2026-07-25': 12 });
    assert.deepEqual(
        statsStore.getPendingQuiz('3y')['2026-07-25'].MULTIPLE_CHOICE_DEFINITION,
        { correct: 1, total: 1 }
    );
});

test('서버 통계와 아직 전송되지 않은 통계를 화면용으로 합산한다', () => {
    statsStore.addStudySeconds('2y', '2026-07-25', 20);
    statsStore.addQuizResult('2y', '2026-07-25', 'MULTIPLE_CHOICE_MEANING', true);

    const study = statsStore.mergeStudyHistory(
        { '2026-07-25': { '1y': 10, '2y': 40 } },
        '2y'
    );
    const quiz = statsStore.mergeQuizHistory(
        {
            '2026-07-25': {
                '2y': { MULTIPLE_CHOICE_MEANING: { correct: 2, total: 4 } }
            }
        },
        '2y'
    );

    assert.deepEqual(study['2026-07-25'], { '1y': 10, '2y': 60 });
    assert.deepEqual(quiz['2026-07-25']['2y'].MULTIPLE_CHOICE_MEANING, {
        correct: 3,
        total: 5
    });
});
