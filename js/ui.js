// 공통 UI 상호작용과 편집 도구
const ui = {
    nonInteractiveWords: new Set(['a', 'an', 'the', 'I', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'something', 'anybody', 'anyone', 'anything', 'nobody', 'no one', 'nothing', 'everybody', 'everyone', 'everything', 'all', 'any', 'both', 'each', 'either', 'every', 'few', 'little', 'many', 'much', 'neither', 'none', 'one', 'other', 'several', 'some', 'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'to', 'toward', 'under', 'underneath', 'until', 'unto', 'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'after', 'although', 'as', 'because', 'before', 'if', 'once', 'since', 'than', 'that', 'though', 'till', 'unless', 'until', 'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how', 'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'not', 'very', 'too', 'so', 'just', 'well', 'often', 'always', 'never', 'sometimes', 'here', 'there', 'now', 'then', 'again', 'also', 'ever', 'even', 'how', 'quite', 'rather', 'soon', 'still', 'more', 'most', 'less', 'least', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'then', 'there', 'here', "don't", "didn't", "can't", "couldn't", "she's", "he's", "i'm", "you're", "they're", "we're", "it's", "that's"]),
    adjustFontSize(element) {
        if (!element || !element.parentElement) return;
        element.style.fontSize = '';
        const defaultFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        let currentFontSize = defaultFontSize;
        const container = element.parentElement;
        while (element.scrollWidth > container.clientWidth - 80 && currentFontSize > 12) {
            currentFontSize -= 1;
            element.style.fontSize = `${currentFontSize}px`;
        }
    },
    // 설명의 [테마] 태그를 기호와 색으로 바꾼다. 같은 색은 성격이 비슷한 테마끼리 묶었다.
    // order는 화면에 나오는 순서다. 시트에 적힌 순서와 상관없이 이 순서로 보인다.
    // 표에 없는 태그는 회색 배지에 첫 글자를 적고 맨 끝에 둔다.
    explanationThemes: {
        '동의어': { symbol: '≈', tone: 'blue', order: 1 },
        '반의어': { symbol: '↔', tone: 'blue', order: 2 },
        '파생어': { symbol: '↳', tone: 'purple', order: 3 },
        '숙어': { symbol: '“', tone: 'green', order: 4 },
        '연어': { symbol: '+', tone: 'green', order: 5 },
        '용례': { symbol: '+', tone: 'green', order: 5 },
        '관련어': { symbol: '#', tone: 'purple', order: 6 },
        '참고': { symbol: '#', tone: 'purple', order: 6 },
        '기타': { symbol: '#', tone: 'purple', order: 6 },
        'etc': { symbol: '#', tone: 'purple', order: 6 },
        '혼동어휘': { symbol: '≠', tone: 'red', order: 7 },
        '어근': { symbol: '√', tone: 'purple', order: 8 }
    },
    getExplanationTheme(tag) {
        return this.explanationThemes[tag] || this.explanationThemes[String(tag).toLowerCase()] || null;
    },
    // [태그]로 시작하는 줄이 테마의 시작이고, 태그 없는 줄은 앞 테마에 잇는다. 빈 행은 버린다.
    parseExplanation(text) {
        const blocks = [];
        String(text || '').split('\n').forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) return;
            const tagMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
            if (tagMatch) {
                blocks.push({ tag: tagMatch[1].trim(), rows: [] });
            } else if (blocks.length === 0) {
                blocks.push({ tag: '', rows: [] });
            }
            const content = tagMatch ? tagMatch[2] : line;
            if (!content) return;
            const block = blocks[blocks.length - 1];
            const row = this._parseExplanationRow(content, block.tag);
            const previous = block.rows[block.rows.length - 1];
            // 시트에서 줄이 바뀌었어도 목록이 이어지면 하나로 합쳐 줄 끝까지 채운다.
            if (previous?.items && row.items && !row.root) previous.items.push(...row.items);
            else block.rows.push(row);
        });
        // 태그 없이 맨 앞에 적힌 글은 맨 위에 둔다. 같은 순서끼리는 시트에 적힌 순서를 지킨다.
        const rank = block => block.tag ? (this.getExplanationTheme(block.tag)?.order ?? 99) : 0;
        return blocks.sort((a, b) => rank(a) - rank(b));
    },
    // 어근 줄은 첫 콜론 앞이 어근 정보, 뒤가 어휘 목록이다.
    _parseExplanationRow(content, tag) {
        let root = '';
        let rest = content;
        if (tag === '어근') {
            const [head, tail] = this._splitOutsideParens(content, ':', 1);
            if (tail !== undefined) {
                root = head;
                rest = tail;
            }
        }
        if (!rest) return { root, text: '', items: [] };
        return { root, text: rest, items: this._parseLabeledItems(rest) || this._parseListItems(rest) };
    },
    _parseListItems(text) {
        const items = this._splitOutsideParens(text, ',')
            .filter(Boolean)
            .map(part => this._parseExplanationItem(part));
        // 한 부분이라도 "영어 (뜻)" 모양이 아니면 설명 문장으로 보고 그대로 둔다.
        if (items.length === 0 || !items.every(Boolean)) return null;
        // 같은 줄에서 뜻 없는 어휘 뒤에 뜻이 오면("blast, detonation, eruption (폭발)") 그 뜻을 함께 쓴다.
        // 시트의 줄바꿈은 묶음의 경계라서 이 묶기는 한 줄 안에서만 한다. 마지막 뜻 뒤에 남은 어휘는 따로 선다.
        const grouped = [];
        let pending = [];
        items.forEach(({ english, gloss }) => {
            if (!gloss) {
                pending.push(english);
                return;
            }
            grouped.push({ english: [...pending, english].join(', '), gloss });
            pending = [];
        });
        pending.forEach(english => grouped.push({ english, gloss: '' }));
        return grouped;
    },
    // 예전 형식 "종속적인: subordinate / 열성의: recessive"는 한글 뜻을 앞에 적고 '/'로 어휘를 나눈다.
    // 뜻 하나에 어휘가 하나씩이면 보통 목록처럼 잇고, 여러 어휘가 한 뜻을 함께 쓰면 쉼표로 이어
    // 한 덩어리로 둔다. "calculate, judge, reckon / 추정치: …"처럼 뜻 없는 여러 어휘 묶음이 있을 때만
    // 뒤 묶음의 뜻이 앞 어휘에도 붙는 것처럼 보이지 않도록 '/'마다 줄을 바꾼다.
    // '/'는 한글 뜻 머리가 있을 때만 구분자로 보므로 "and/or" 같은 표현은 그대로 남는다.
    _parseLabeledItems(text) {
        const segments = this._splitOutsideParens(text, '/').filter(Boolean).map(segment => {
            const match = segment.match(/^([^:]*[가-힣][^:]*):\s*(.+)$/);
            return match ? { gloss: match[1].trim(), words: match[2] } : { gloss: '', words: segment };
        });
        if (!segments.some(segment => segment.gloss)) return null;
        const groups = segments.map(({ gloss, words }) => ({
            gloss,
            list: this._splitOutsideParens(words, ',').filter(Boolean)
        }));
        if (groups.some(group => group.list.some(word => !/[A-Za-z]/.test(word) || /[가-힣]/.test(word)))) return null;
        const lines = [];
        groups.forEach(({ gloss, list }) => {
            const previous = lines[lines.length - 1];
            // "liquid / 유동적인: flexible, …"처럼 뜻 없는 어휘 하나 바로 뒤에 뜻 머리가 오면
            // 그 뜻은 앞 어휘의 뜻이고, 뒤 어휘들은 뜻 없이 같은 줄에 잇는다.
            if (gloss && previous?.single) {
                previous.items[0].gloss = gloss;
                previous.items.push(...list.map(english => ({ english, gloss: '' })));
                previous.single = false;
                return;
            }
            if (gloss && list.length > 1) {
                lines.push({ items: [{ english: list.join(', '), gloss }] });
            } else {
                lines.push({
                    plainList: list.length > 1,
                    single: list.length === 1 && !gloss,
                    items: list.map(english => ({ english, gloss }))
                });
            }
        });
        const breakLines = lines.some(line => line.plainList);
        return lines.flatMap((line, lineIndex) => line.items.map((item, index) => ({
            ...item,
            breakBefore: breakLines && lineIndex > 0 && index === 0
        })));
    },
    // 괄호 밖의 구분자에서만 나눈다. 뜻 괄호 속 쉼표나 콜론은 건드리지 않는다.
    _splitOutsideParens(text, separator, limit = Infinity) {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '(') depth++;
            else if (char === ')') depth = Math.max(0, depth - 1);
            else if (char === separator && depth === 0 && parts.length < limit) {
                parts.push(text.slice(start, i));
                start = i + 1;
            }
        }
        parts.push(text.slice(start));
        return parts.map(part => part.trim());
    },
    // "room temperature (실온)"을 영어와 한글 뜻으로 나눈다. 괄호 없이 "illustrate 설명하다"처럼
    // 띄어 쓰고 뒤에 붙인 뜻도 같게 본다. 영어 쪽에 한글이 섞이면 목록 항목이 아니다.
    _parseExplanationItem(text) {
        const match = text.match(/^(.*?)\s*\(([^()]*[가-힣~][^()]*)\)$/)
            || text.match(/^([^가-힣]*?[A-Za-z][^가-힣]*?)\s+(~?[가-힣].*)$/);
        const english = (match ? match[1] : text).trim();
        if (!/[A-Za-z]/.test(english) || /[가-힣]/.test(english)) return null;
        return { english, gloss: match ? match[2].trim() : '' };
    },
    renderExplanation(targetElement, text) {
        if (!targetElement) return;
        targetElement.innerHTML = '';
        this.parseExplanation(text).forEach(block => {
            const blockEl = document.createElement('div');
            // 태그 없는 글은 기호 칸 없이 왼쪽 끝에서 시작한다.
            blockEl.className = block.tag ? 'ex-block' : 'ex-block ex-block-plain';
            const badge = document.createElement('span');
            if (block.tag) {
                const theme = this.getExplanationTheme(block.tag) || { symbol: block.tag.charAt(0), tone: 'gray' };
                badge.className = 'ex-badge';
                badge.dataset.tone = theme.tone;
                badge.textContent = theme.symbol;
                badge.title = block.tag;
                badge.setAttribute('aria-label', block.tag);
            }
            const body = document.createElement('div');
            block.rows.forEach(row => {
                if (row.root) {
                    const header = document.createElement('div');
                    header.appendChild(this._createRootChip(row.root));
                    body.appendChild(header);
                }
                const line = document.createElement('div');
                if (row.items) {
                    // "영어 + 뜻" 한 쌍을 한 덩어리로 묶고, 구분점은 앞 덩어리 끝에 붙인다.
                    row.items.forEach(({ english, gloss, breakBefore }, index) => {
                        if (breakBefore) line.appendChild(document.createElement('br'));
                        const item = this._createSpan('ex-item', '');
                        this._appendInteractiveLine(item, english);
                        if (gloss) item.appendChild(this._createSpan('ex-gloss', gloss));
                        const next = row.items[index + 1];
                        if (next && !next.breakBefore) item.appendChild(this._createSpan('ex-sep', '·'));
                        line.appendChild(item);
                    });
                } else {
                    this._appendInteractiveLine(line, row.text);
                }
                if (line.childNodes.length > 0) body.appendChild(line);
            });
            if (block.tag) blockEl.appendChild(badge);
            blockEl.appendChild(body);
            targetElement.appendChild(blockEl);
        });
    },
    // 뜻 앞의 품사 표시(n. v. a. …)를 색 알약으로 바꾼다. adj.는 a로, ad.는 adv로 같게 본다.
    meaningPosThemes: {
        n: { label: 'n', name: '명사', tone: 'blue' },
        v: { label: 'v', name: '동사', tone: 'coral' },
        a: { label: 'a', name: '형용사', tone: 'green' },
        adj: { label: 'a', name: '형용사', tone: 'green' },
        ad: { label: 'adv', name: '부사', tone: 'purple' },
        adv: { label: 'adv', name: '부사', tone: 'purple' },
        prep: { label: 'prep', name: '전치사', tone: 'teal' },
        conj: { label: 'conj', name: '접속사', tone: 'pink' }
    },
    // 품사로 시작하는 뜻만 품사별로 나눈다. 품사가 없으면 null을 돌려 지금처럼 줄 그대로 보인다.
    // 같은 품사는 시트의 줄바꿈과 상관없이 한 줄에 잇는다. ①②… 번호가 있으면 "번호 + 뜻"이,
    // 없으면 시트의 한 줄이 한 덩어리다. "a.m."처럼 점 뒤에 글자가 바로 붙으면 품사로 보지 않는다.
    parseMeaning(text) {
        const source = String(text || '').trim();
        const markerPattern = /(^|\s)(n|v|a|adj|ad|adv|prep|conj)\.(?=\s|[①-⑳가-힣~(\[]|$)/gi;
        const markers = [...source.matchAll(markerPattern)];
        if (markers.length === 0 || markers[0].index !== 0) return null;
        const blocks = [];
        markers.forEach((marker, index) => {
            const start = marker.index + marker[0].length;
            const end = index + 1 < markers.length ? markers[index + 1].index : source.length;
            const body = source.slice(start, end);
            const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
            const items = /[①-⑳]/.test(body)
                ? lines.join(' ').split(/(?=[①-⑳])/).map(item => item.trim()).filter(Boolean)
                : lines;
            const theme = this.meaningPosThemes[marker[2].toLowerCase()];
            const previous = blocks[blocks.length - 1];
            if (previous && previous.label === theme.label) previous.items.push(...items);
            else blocks.push({ label: theme.label, name: theme.name, tone: theme.tone, items });
        });
        return blocks.filter(block => block.items.length > 0);
    },
    renderMeaning(targetElement, text) {
        if (!targetElement) return;
        const blocks = this.parseMeaning(text);
        targetElement.classList.toggle('mn-list', !!blocks);
        if (!blocks) {
            targetElement.innerHTML = '';
            String(text || '').split('\n').forEach((line, index) => {
                if (index > 0) targetElement.appendChild(document.createElement('br'));
                this._appendMeaningText(targetElement, line);
            });
            return;
        }
        targetElement.innerHTML = '';
        // 알약과 뜻 칸이 한 격자에 놓여, 넘친 줄은 알약 폭만큼 들여 쓰고 품사끼리 뜻의 시작이 맞는다.
        blocks.forEach(({ label, name, tone, items }) => {
            const badge = this._createSpan('mn-pos', label);
            badge.dataset.tone = tone;
            badge.title = name;
            badge.setAttribute('aria-label', name);
            const body = this._createSpan('mn-items', '');
            items.forEach(item => {
                const unit = this._createSpan('mn-item', '');
                this._appendMeaningText(unit, item);
                body.appendChild(unit);
            });
            targetElement.appendChild(badge);
            targetElement.appendChild(body);
        });
    },
    // ①②… 번호는 작은 호박색 동그라미 숫자로 바꿔 글자 위쪽에 붙이고, 나머지는 글자 그대로 둔다.
    _appendMeaningText(targetElement, text) {
        String(text).split(/([①-⑳])\s*/).forEach(part => {
            if (!part) return;
            const code = part.charCodeAt(0);
            if (part.length === 1 && code >= 0x2460 && code <= 0x2473) {
                const number = this._createSpan('mn-num', String(code - 0x2460 + 1));
                number.setAttribute('aria-label', part);
                targetElement.appendChild(number);
            } else {
                targetElement.appendChild(document.createTextNode(part));
            }
        });
    },
    _createSpan(className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    },
    // "-tend-, -tens- (뻗다)"에서 어근 형태는 고정폭으로, 괄호 속 뜻은 따로, 쉼표는 '/'로 보인다.
    _createRootChip(root) {
        const chip = this._createSpan('ex-root', '');
        root.split(/(\([^()]*\))/).forEach(part => {
            if (!part.trim()) return;
            if (part.startsWith('(')) {
                chip.appendChild(this._createSpan('ex-root-meaning', part.slice(1, -1).trim()));
                return;
            }
            part.split(/\s*([,+])\s*/).forEach(token => {
                const value = token.trim();
                if (!value) return;
                if (value === ',') chip.appendChild(this._createSpan('ex-sep', '/'));
                else if (value === '+') chip.appendChild(this._createSpan('ex-sep', '+'));
                else chip.appendChild(this._createSpan('ex-root-form', value));
            });
        });
        return chip;
    },
    // 영어 표현은 눌러서 발음을 듣고 길게 눌러 사전을 열 수 있게, 나머지는 글자 그대로 붙인다.
    _appendInteractiveLine(targetElement, line) {
        const regex = /(\[.*?\]|\bS\+V\b)|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(line))) {
            if (match.index > lastIndex) targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
            const [_, nonClickable, englishPhrase] = match;
            if (englishPhrase) {
                const span = document.createElement('span');
                span.textContent = englishPhrase;
                if (!this.nonInteractiveWords.has(englishPhrase.toLowerCase())) {
                    span.className = 'interactive-word';
                    span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(englishPhrase); };
                    span.oncontextmenu = e => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); };
                    let touchMove = false;
                    span.addEventListener('touchstart', e => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700); }, { passive: true });
                    span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                    span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                }
                targetElement.appendChild(span);
            } else if (nonClickable) {
                targetElement.appendChild(document.createTextNode(nonClickable));
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < line.length) targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
    },
    handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.translateDebounceTimeout);
        app.state.translateDebounceTimeout = setTimeout(async () => {
            const tooltip = app.elements.translationTooltip;
            const targetRect = event.target.getBoundingClientRect();
            Object.assign(tooltip.style, { left: `${targetRect.left + window.scrollX}px`, top: `${targetRect.bottom + window.scrollY + 5}px` });
            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            this._keepTooltipInView(tooltip);
            tooltip.textContent = await api.translateText(sentence);
            this._keepTooltipInView(tooltip);
        }, 1000);
    },
    // 번역 말풍선이 화면 오른쪽 밖으로 나가면 안쪽으로 당긴다(휴대폰 오른쪽 끝 문장).
    _keepTooltipInView(tooltip) {
        const margin = 10;
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth - margin) {
            tooltip.style.left = `${Math.max(margin, window.innerWidth - rect.width - margin) + window.scrollX}px`;
        } else if (rect.left < margin) {
            tooltip.style.left = `${margin + window.scrollX}px`;
        }
    },
    handleSentenceMouseOut() {
        clearTimeout(app.state.translateDebounceTimeout);
        app.elements.translationTooltip.classList.add('hidden');
    },
    createInteractiveFragment(text, isForSampleSentence = false) {
        const fragment = document.createDocumentFragment();
        if (!text || !text.trim()) return fragment;
        const parts = text.split(/([a-zA-Z0-9'-]+)/g);
        parts.forEach(part => {
            if (/([a-zA-Z0-9'-]+)/.test(part) && !this.nonInteractiveWords.has(part.toLowerCase())) {
                const span = document.createElement('span');
                span.textContent = part;
                span.className = 'interactive-word';
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
            } else {
                const span = document.createElement('span');
                span.textContent = part;
                span.onclick = (e) => e.stopPropagation();
                fragment.appendChild(span);
            }
        });
        return fragment;
    },
    displaySentences(sentences, containerElement) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        sentences.filter(s => s && s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors sample-sentence';
            p.onclick = (e) => {
                if (e.target.closest('.sentence-content-area .interactive-word')) return;
                api.speak(p.textContent);
                this.handleSentenceMouseOver(e, p.textContent);
            };
            p.addEventListener('mouseover', (e) => {
                if (!e.target.closest('.sentence-content-area')) {
                     this.handleSentenceMouseOver(e, p.textContent);
                }
            });
            p.addEventListener('mouseout', this.handleSentenceMouseOut);
            const sentenceContent = document.createElement('span');
            sentenceContent.className = 'sentence-content-area';
             sentenceContent.addEventListener('mouseenter', () => {
                clearTimeout(app.state.translateDebounceTimeout);
                this.handleSentenceMouseOut();
            });
            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    strong.appendChild(this.createInteractiveFragment(part.slice(1, -1), true));
                    sentenceContent.appendChild(strong);
                } else if (part) {
                    sentenceContent.appendChild(this.createInteractiveFragment(part, true));
                }
            });
            p.appendChild(sentenceContent);
            containerElement.appendChild(p);
        });
    },
    escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    },
    // Part 선택 목록은 맨 위가 '전체'(값 '')이고 그 아래로 Part가 시트 순서대로 온다.
    fillPartSelect(select, partNames) {
        select.innerHTML = '';
        ['', ...partNames].forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name || '전체';
            select.appendChild(option);
        });
    },
    showWordContextMenu(event, word) {
        event.preventDefault();
        const menu = app.elements.wordContextMenu;
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;
        this._positionMenu(menu, x, y);
        const encodedWord = encodeURIComponent(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, 'daum-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, 'naver-dictionary'); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, 'longman-dictionary'); this.hideWordContextMenu(); };
    },
    // 메뉴를 누른 곳에 띄우되 화면 밖으로 나가면 안쪽으로 당긴다(메뉴는 position: fixed라 화면 좌표를 쓴다).
    _positionMenu(menu, x, y) {
        const margin = 10;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');
        const rect = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))}px`;
        menu.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))}px`;
    },
    hideWordContextMenu() {
        if (app.elements.wordContextMenu) app.elements.wordContextMenu.classList.add('hidden');
    }
};
// utils, dashboard, quizMode, learningMode 객체들은 변경사항 없이 기존 코드를 유지합니다.
// 불규칙 동사 데이터 정의
