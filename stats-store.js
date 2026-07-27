(function (root) {
    'use strict';

    const KEYS = {
        LEGACY_TIME: grade => `student_unsyncedTime_${grade}`,
        LEGACY_QUIZ: grade => `student_unsyncedQuizStats_${grade}`,
        TIME_BY_DATE: grade => `student_unsyncedTimeByDate_${grade}`,
        QUIZ_BY_DATE: grade => `student_unsyncedQuizByDate_${grade}`
    };

    function readJson(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch (error) {
            console.warn(`통계 데이터가 손상되어 초기화합니다: ${key}`, error);
            return {};
        }
    }

    function writeJson(key, value) {
        if (Object.keys(value).length === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function getLocalDateString(date = new Date()) {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    }

    const vocaStatsStore = {
        getLocalDateString,

        migrateLegacyPending(grade, today = getLocalDateString()) {
            if (!grade) return;

            const legacySeconds = Math.max(
                0,
                parseInt(localStorage.getItem(KEYS.LEGACY_TIME(grade)) || '0', 10) || 0
            );
            if (legacySeconds > 0) {
                const pending = this.getPendingStudy(grade);
                pending[today] = Number(pending[today] || 0) + legacySeconds;
                writeJson(KEYS.TIME_BY_DATE(grade), pending);
                localStorage.removeItem(KEYS.LEGACY_TIME(grade));
            }

            const legacyQuiz = readJson(KEYS.LEGACY_QUIZ(grade));
            if (Object.keys(legacyQuiz).length > 0) {
                const pending = this.getPendingQuiz(grade);
                if (!pending[today]) pending[today] = {};
                Object.entries(legacyQuiz).forEach(([type, stats]) => {
                    if (!stats || typeof stats !== 'object') return;
                    if (!pending[today][type]) pending[today][type] = { correct: 0, total: 0 };
                    pending[today][type].correct += Number(stats.correct || 0);
                    pending[today][type].total += Number(stats.total || 0);
                });
                writeJson(KEYS.QUIZ_BY_DATE(grade), pending);
                localStorage.removeItem(KEYS.LEGACY_QUIZ(grade));
            }
        },

        getPendingStudy(grade) {
            return grade ? readJson(KEYS.TIME_BY_DATE(grade)) : {};
        },

        getPendingQuiz(grade) {
            return grade ? readJson(KEYS.QUIZ_BY_DATE(grade)) : {};
        },

        addStudySeconds(grade, date, seconds) {
            const amount = Math.max(0, Math.floor(Number(seconds) || 0));
            if (!grade || !date || amount < 1) return;
            const pending = this.getPendingStudy(grade);
            pending[date] = Number(pending[date] || 0) + amount;
            writeJson(KEYS.TIME_BY_DATE(grade), pending);
        },

        addQuizResult(grade, date, quizType, isCorrect) {
            if (!grade || !date || !quizType) return;
            const pending = this.getPendingQuiz(grade);
            if (!pending[date]) pending[date] = {};
            if (!pending[date][quizType]) pending[date][quizType] = { correct: 0, total: 0 };
            pending[date][quizType].total += 1;
            if (isCorrect) pending[date][quizType].correct += 1;
            writeJson(KEYS.QUIZ_BY_DATE(grade), pending);
        },

        snapshot(grade) {
            this.migrateLegacyPending(grade);
            return {
                study: clone(this.getPendingStudy(grade)),
                quiz: clone(this.getPendingQuiz(grade))
            };
        },

        subtractSnapshot(grade, snapshot) {
            const currentStudy = this.getPendingStudy(grade);
            Object.entries(snapshot.study || {}).forEach(([date, seconds]) => {
                currentStudy[date] = Math.max(0, Number(currentStudy[date] || 0) - Number(seconds || 0));
                if (currentStudy[date] === 0) delete currentStudy[date];
            });
            writeJson(KEYS.TIME_BY_DATE(grade), currentStudy);

            const currentQuiz = this.getPendingQuiz(grade);
            Object.entries(snapshot.quiz || {}).forEach(([date, daily]) => {
                if (!currentQuiz[date]) return;
                Object.entries(daily || {}).forEach(([type, stats]) => {
                    if (!currentQuiz[date][type]) return;
                    currentQuiz[date][type].correct = Math.max(
                        0,
                        Number(currentQuiz[date][type].correct || 0) - Number(stats.correct || 0)
                    );
                    currentQuiz[date][type].total = Math.max(
                        0,
                        Number(currentQuiz[date][type].total || 0) - Number(stats.total || 0)
                    );
                    if (currentQuiz[date][type].total === 0) delete currentQuiz[date][type];
                });
                if (Object.keys(currentQuiz[date]).length === 0) delete currentQuiz[date];
            });
            writeJson(KEYS.QUIZ_BY_DATE(grade), currentQuiz);
        },

        mergeStudyHistory(remote = {}, grade) {
            const merged = clone(remote);
            Object.entries(this.getPendingStudy(grade)).forEach(([date, seconds]) => {
                if (!merged[date] || typeof merged[date] !== 'object') merged[date] = {};
                merged[date][grade] = Number(merged[date][grade] || 0) + Number(seconds || 0);
            });
            return merged;
        },

        mergeQuizHistory(remote = {}, grade) {
            const merged = clone(remote);
            Object.entries(this.getPendingQuiz(grade)).forEach(([date, daily]) => {
                if (!merged[date] || typeof merged[date] !== 'object') merged[date] = {};
                if (!merged[date][grade] || typeof merged[date][grade] !== 'object') {
                    merged[date][grade] = {};
                }
                Object.entries(daily || {}).forEach(([type, stats]) => {
                    if (!merged[date][grade][type]) {
                        merged[date][grade][type] = { correct: 0, total: 0 };
                    }
                    merged[date][grade][type].correct =
                        Number(merged[date][grade][type].correct || 0) + Number(stats.correct || 0);
                    merged[date][grade][type].total =
                        Number(merged[date][grade][type].total || 0) + Number(stats.total || 0);
                });
            });
            return merged;
        }
    };

    root.vocaStatsStore = vocaStatsStore;
    if (typeof module !== 'undefined' && module.exports) module.exports = vocaStatsStore;
})(typeof window !== 'undefined' ? window : globalThis);
