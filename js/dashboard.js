// 학습 통계 집계와 차트 렌더링
let chartJsPromise = null;
function loadChartJs() {
    if (window.Chart) return Promise.resolve();
    if (chartJsPromise) return chartJsPromise;

    chartJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = error => {
            chartJsPromise = null;
            reject(error);
        };
        document.head.appendChild(script);
    });
    return chartJsPromise;
}

const dashboard = {
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
            const studyHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'study'));
            const quizHistoryDoc = await getDoc(doc(db, 'users', app.state.user.uid, 'history', 'quiz'));
            const studyHistory = vocaStatsStore.mergeStudyHistory(
                studyHistoryDoc.exists() ? studyHistoryDoc.data() : {},
                grade
            );
            const quizHistory = vocaStatsStore.mergeQuizHistory(
                quizHistoryDoc.exists() ? quizHistoryDoc.data() : {},
                grade
            );
            this.renderSummaryCards(studyHistory, quizHistory, grade);
            try {
                await loadChartJs();
                this.render7DayCharts(studyHistory, quizHistory, grade);
            } catch (chartError) {
                console.warn('통계 그래프를 불러오지 못해 숫자 요약만 표시합니다.', chartError);
            }
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
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = vocaStatsStore.getLocalDateString(d);
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            studyData.push(Math.floor(((studyHistory[dateString] && studyHistory[dateString][grade]) || 0) / 60));
        }
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
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, suggestedMax: 60 } },
                    plugins: { legend: { display: false } }
                }
            });
        }
        const quizStats7Days = {
            'MULTIPLE_CHOICE_MEANING': { correct: 0, total: 0 },
            'FILL_IN_THE_BLANK': { correct: 0, total: 0 },
            'MULTIPLE_CHOICE_DEFINITION': { correct: 0, total: 0 },
        };
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = vocaStatsStore.getLocalDateString(d);
            if (quizHistory[dateString] && quizHistory[dateString][grade]) {
                for(const type in quizStats7Days){
                    if(quizHistory[dateString][grade][type]){
                        quizStats7Days[type].correct += quizHistory[dateString][grade][type].correct || 0;
                        quizStats7Days[type].total += quizHistory[dateString][grade][type].total || 0;
                    }
                }
            }
        }
        this.state.quiz1Chart = this.createDoughnutChart('quiz1-chart', 'quiz1-label', '영한 뜻', quizStats7Days['MULTIPLE_CHOICE_MEANING']);
        this.state.quiz2Chart = this.createDoughnutChart('quiz2-chart', 'quiz2-label', '빈칸 추론', quizStats7Days['FILL_IN_THE_BLANK']);
        this.state.quiz3Chart = this.createDoughnutChart('quiz3-chart', 'quiz3-label', '영영 풀이', quizStats7Days['MULTIPLE_CHOICE_DEFINITION']);
    },
    createDoughnutChart(elementId, labelId, labelText, stats) {
        const ctx = document.getElementById(elementId)?.getContext('2d');
        if (!ctx) return null;
        const correct = stats.correct || 0;
        const total = stats.total || 0;
        const incorrect = total - correct;
        const hasAttempts = total > 0;
        const accuracy = hasAttempts ? Math.round((correct / total) * 100) : 0;
        const chartColors = hasAttempts ? ['#34D399', '#F87171'] : ['#E5E7EB', '#E5E7EB'];
        const chartData = hasAttempts ? [correct, incorrect > 0 ? incorrect : 0.0001] : [0, 1];
        const centerText = hasAttempts ? `${accuracy}%` : '-';
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
            labelEl.textContent = `${labelText} (${correct}/${total})`;
        }
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: hasAttempts ? ['정답', '오답'] : ['기록 없음'],
                datasets: [{ data: chartData, backgroundColor: chartColors, hoverBackgroundColor: chartColors, borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            },
            plugins: [{
                id: 'doughnutLabel',
                beforeDraw: (chart) => {
                    const { ctx, width, height } = chart;
                    ctx.restore();
                    const fontSize = (height / 114).toFixed(2);
                    ctx.font = `bold ${fontSize}em sans-serif`;
                    ctx.textBaseline = 'middle';
                    const text = centerText;
                    const textX = Math.round((width - ctx.measureText(text).width) / 2);
                    const textY = height / 2;
                    ctx.fillStyle = hasAttempts ? '#374151' : '#9CA3AF';
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    },
    renderSummaryCards(studyHistory, quizHistory, grade) {
        const today = new Date();
        const quizTypes = [
            { id: 'MULTIPLE_CHOICE_MEANING', name: '영한 뜻' },
            { id: 'FILL_IN_THE_BLANK', name: '빈칸 추론' },
            { id: 'MULTIPLE_CHOICE_DEFINITION', name: '영영 풀이' }
        ];
        const getStatsForPeriod = (days) => {
            let totalSeconds = 0;
            const quizStats = { };
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 });
            for (let i = 0; i < days; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateString = vocaStatsStore.getLocalDateString(d);
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
        const totalStats = (() => {
            let totalSeconds = 0;
            const quizStats = { };
             Object.keys(quizTypes).forEach(key => quizStats[quizTypes[key].id] = { correct: 0, total: 0 });
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
        const stats30 = getStatsForPeriod(30);
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
        this.elements.stats30DayContainer.innerHTML = createCardHTML('최근 30일 기록', stats30.totalSeconds, stats30.quizStats);
        this.elements.statsTotalContainer.innerHTML = createCardHTML('누적 총학습 기록', totalStats.totalSeconds, totalStats.quizStats);
    },
    formatSeconds(totalSeconds) {
        if (!totalSeconds || totalSeconds < 60) return `0분`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        let result = '';
        if (h > 0) result += `${h}시간 `;
        if (m > 0) result += `${m}분`;
        return result.trim() || '0분';
    },
};
