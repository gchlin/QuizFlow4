const Game = (function () {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // 語錄庫
    const MSG_WIN = ["你是駐波大師", "諧音泛音如數家珍", "不是泛泛之輩卻是泛音小天才", "諧音耿大師"];
    const MSG_DRAW = ["那還不再一局?", "還是見好就收!"];
    const MSG_LOSE = [
        "老師在講你有在聽嗎~",
        "是不是該看點書了",
        "失敗為成功之母，再來一次！",
        "差一點點就開竅了！",
        "加油，物理之神在等你覺醒"
    ];

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'count') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'go') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        }
        osc.connect(gain);
        gain.connect(audioCtx.destination);
    }

    function renderContentTo(element, dataObj, isOption = false, isSp = false) {
        element.innerHTML = '';
        if (!dataObj) return;
        let type, content;
        if (isOption) {
            const ansData = AnswerBank[dataObj];
            if (!ansData) { element.textContent = "Err"; return; }
            type = ansData.type; content = ansData.content;
        } else {
            type = dataObj.qType; content = dataObj.qContent;
        }
        if (type === 'image') {
            const img = document.createElement('img');
            img.src = content;
            img.className = isSp ? 'img-content sp-img-content' : 'img-content';
            element.appendChild(img);
        } else if (type === 'text') {
            const span = document.createElement('span');
            if (isOption) span.className = 'text-answer';
            span.textContent = content;
            element.appendChild(span);
        }
    }

    let state = {
        mode: 'versus',
        targetScore: 0,
        scores: { p1: 0, p2: 0 },
        combo: { p1: 0, p2: 0 },
        wrongStreak: { p1: 0, p2: 0 },
        wrongHistory: [],
        wrongHistoryP1: [],
        wrongHistoryP2: [],
        deck: { p1: [], p2: [] },
        questions: { p1: null, p2: null },
        status: { p1: false, p2: false },
        firstSolver: null,
        timerVal: 0,
        timerInterval: null,
        currentList: [],
        locked: { p1: false, p2: false },
        questionCount: 0,
        maxQuestions: 20
    };

    window.addEventListener('load', () => {
        const imgs = getAllImages();
        const div = document.getElementById('preload-container');
        imgs.forEach(src => { const img = document.createElement('img'); img.src = src; div.appendChild(img); });
    });

    function init(mode, target = 0, levelKey = 'level3') {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        state.mode = mode;
        state.targetScore = target;
        state.scores = { p1: 0, p2: 0 };
        state.combo = { p1: 0, p2: 0 };
        state.wrongStreak = { p1: 0, p2: 0 };
        state.status = { p1: false, p2: false };
        state.firstSolver = null;
        state.locked = { p1: false, p2: false };
        state.currentList = QuestionSets[levelKey] || QuestionSets['level3'];
        state.deck.p1 = [...state.currentList]; state.deck.p2 = [...state.currentList];
        shuffleArray(state.deck.p1); shuffleArray(state.deck.p2);
        state.questionCount = 0;
        state.maxQuestions = 20;
        state.wrongHistory = [];
        state.wrongHistoryP1 = [];
        state.wrongHistoryP2 = [];

        const vsContainer = document.getElementById('versus-container');
        const spArea = document.getElementById('single-player-area');

        // UI Elements for Time Bars
        const barTop = document.getElementById('time-bar-top');
        const barBot = document.getElementById('time-bar-bot');
        const fillTop = document.getElementById('time-fill-top');
        const fillBot = document.getElementById('time-fill-bot');
        const warnLayer = document.getElementById('warning-layer');

        // Reset Timer UI
        barTop.classList.add('hidden');
        barBot.classList.add('hidden');
        warnLayer.classList.add('hidden');
        fillTop.style.width = '100%';
        fillBot.style.width = '100%';

        if (mode === 'practice') {
            vsContainer.style.display = 'none';
            spArea.classList.remove('hidden');
            document.getElementById('sp-score').innerText = '0';
            const counter = document.getElementById('sp-counter');
            if (counter) counter.innerText = `1 / ${state.maxQuestions}`;
            document.getElementById('sp-combo-box').classList.add('hidden');
            document.getElementById('feedback-sp').classList.add('hidden');
        } else {
            vsContainer.style.display = 'flex';
            spArea.classList.add('hidden');
            updateScoreUI();
            document.getElementById('combo-p1').style.opacity = '0';
            document.getElementById('combo-p2').style.opacity = '0';
            document.getElementById('feedback-p1').classList.add('hidden');
            document.getElementById('feedback-p2').classList.add('hidden');

            if (mode === 'speed') {
                barTop.classList.remove('hidden');
                barBot.classList.remove('hidden');
            }
        }

        document.getElementById('main-menu').classList.add('hidden');
        startCountdown(() => { realStartGame(); });
    }

    function startCountdown(cb) {
        const overlay = document.getElementById('countdown-overlay');
        const topNum = document.getElementById('cd-num-top'), botNum = document.getElementById('cd-num-bot');
        overlay.classList.remove('hidden');
        let count = 3;
        const run = () => {
            const txt = count === 0 ? "GO" : count;
            topNum.innerText = txt; botNum.innerText = txt;
            topNum.style.animation = 'none'; botNum.style.animation = 'none';
            topNum.offsetHeight;
            topNum.style.animation = 'countPop 0.8s ease-out'; botNum.style.animation = 'countPop 0.8s ease-out';
            const color = count === 0 ? '#e74c3c' : '#2c3e50';
            topNum.style.color = color; botNum.style.color = color;

            if (count === 0) playSound('go'); else playSound('count');

            if (count < 0) { overlay.classList.add('hidden'); cb(); return; }
            count--; setTimeout(run, 1000);
        }; run();
    }

    function realStartGame() {
        const timerCenter = document.getElementById('timer-display-center');
        if (state.mode === 'speed') {
            state.timerVal = 30;
            timerCenter.innerText = "30";
            timerCenter.classList.remove('hidden');
            startTimer();
        } else {
            timerCenter.innerText = "";
            timerCenter.classList.add('hidden');
        }

        if (state.mode === 'practice') generateIndependentQuestion('sp');
        else if (state.mode === 'versus') generateVersusQuestion();
        else { generateIndependentQuestion('p1'); generateIndependentQuestion('p2'); }
    }

    function startTimer() {
        clearInterval(state.timerInterval);
        const maxTime = 30;

        state.timerInterval = setInterval(() => {
            state.timerVal--;
            document.getElementById('timer-display-center').innerText = state.timerVal;

            // Update Time Bars
            const pct = (state.timerVal / maxTime) * 100;
            document.getElementById('time-fill-top').style.width = pct + '%';
            document.getElementById('time-fill-bot').style.width = pct + '%';

            // Last 5 seconds warning
            if (state.timerVal === 5) {
                document.getElementById('warning-layer').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('warning-layer').classList.add('hidden');
                }, 2000); // Show for 2 seconds
            }

            // Last 3 seconds sound (3, 2, 1)
            if (state.timerVal <= 3 && state.timerVal > 0) {
                playSound('count');
            }

            // Time Up (0)
            if (state.timerVal <= 0) {
                playSound('go'); // Final sound
                clearInterval(state.timerInterval);
                determineWinner();
            }
        }, 1000);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function getNextQuestion(player) {
        if (state.mode !== 'practice') {
            const deckKey = (state.mode === 'versus') ? 'p1' : player;
            if (state.deck[deckKey].length === 0) {
                state.deck[deckKey] = [...state.currentList];
                shuffleArray(state.deck[deckKey]);
            }
            return state.deck[deckKey].pop();
        } else {
            if (state.wrongHistory.length > 0 && Math.random() < 0.5) {
                const idx = Math.floor(Math.random() * state.wrongHistory.length);
                return state.wrongHistory[idx];
            }
            const list = state.currentList;
            return list[Math.floor(Math.random() * list.length)];
        }
    }

    function generateVersusQuestion() {
        state.status.p1 = false; state.status.p2 = false; state.firstSolver = null;
        document.getElementById('feedback-p1').classList.add('hidden');
        document.getElementById('feedback-p2').classList.add('hidden');
        const q = getNextQuestion('p1');
        state.questions.p1 = q; state.questions.p2 = q;
        renderSide('p1', q); renderSide('p2', q);
    }

    function generateIndependentQuestion(player) {
        if (player !== 'sp') {
            state.status[player] = false;
            document.getElementById(`feedback-${player}`).classList.add('hidden');
        } else {
            document.getElementById('feedback-sp').classList.add('hidden');
        }
        const q = getNextQuestion(player === 'sp' ? 'p1' : player);
        if (player === 'sp') state.questions.p1 = q;
        else state.questions[player] = q;
        renderSide(player, q);
    }

    function renderSide(player, qObj) {
        const isSp = (player === 'sp');
        const qEl = document.getElementById(`q-${player}`);
        const grid = document.getElementById(`opts-${player}`);
        renderContentTo(qEl, qObj, false, isSp);
        grid.innerHTML = '';
        const correctAnsData = AnswerBank[qObj.aKey];
        if (!correctAnsData) return;
        const targetCategory = correctAnsData.category;
        const allKeys = Object.keys(AnswerBank);
        const validDistractors = allKeys.filter(key => (AnswerBank[key].category === targetCategory) && (key !== qObj.aKey));
        shuffleArray(validDistractors);
        let options = [qObj.aKey].concat(validDistractors.slice(0, 3));
        shuffleArray(options);
        options.forEach(optKey => {
            const btn = document.createElement('div');
            btn.className = 'option-btn';
            renderContentTo(btn, optKey, true);
            const handleInput = (e) => {
                if (e.cancelable) e.preventDefault();
                handleAnswer(player, optKey, btn, e);
            };
            btn.addEventListener('touchstart', handleInput, { passive: false });
            btn.addEventListener('mousedown', handleInput);
            grid.appendChild(btn);
        });
    }

    function showFloatingText(x, y, text, color, parent, isBroken = false) {
        const el = document.createElement('div');
        el.className = 'float-score';
        if (isBroken) el.classList.add('broken-voice');
        el.textContent = text;
        el.style.color = color;
        const rect = parent.getBoundingClientRect();
        el.style.left = (x - rect.left) + 'px';
        el.style.top = (y - rect.top) + 'px';
        parent.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    function shootCombo(fromPlayer, toPlayer) {
        const projectile = document.createElement('div');
        projectile.className = `combo-shot shot-${fromPlayer}`;
        projectile.innerText = "COMBO!";
        projectile.style.left = "50%";
        document.body.appendChild(projectile);
        setTimeout(() => projectile.remove(), 1200);
    }

    function handleAnswer(player, answerKey, btnElement, event) {
        const realPlayer = (player === 'sp') ? 'p1' : player;
        if (state.status[realPlayer]) return;
        if (state.locked[realPlayer]) return;
        if (state.timerVal <= 0 && state.mode === 'speed') return;

        const currentQ = state.questions[realPlayer];
        let cx, cy;
        if (event.type.includes('touch')) { cx = event.changedTouches[0].clientX; cy = event.changedTouches[0].clientY; }
        else { cx = event.clientX; cy = event.clientY; }

        if (answerKey === currentQ.aKey) {
            playSound('correct');
            btnElement.classList.add('correct-mark');
            state.combo[realPlayer]++;
            state.wrongStreak[realPlayer] = 0;
            updateComboUI(player, state.combo[realPlayer]);

            if (state.combo[realPlayer] >= 2 && player !== 'sp') {
                const target = (realPlayer === 'p1') ? 'p2' : 'p1';
                shootCombo(realPlayer, target);
            }

            let scoreAdd = 0;
            if (player === 'sp') {
                state.scores.p1 += 1; scoreAdd = 1;
                state.questionCount++;
                document.getElementById('feedback-sp').classList.remove('hidden');
                updateScoreUI();
                if (state.questionCount >= state.maxQuestions) {
                    setTimeout(endPracticeGame, 500);
                } else {
                    setTimeout(() => generateIndependentQuestion('sp'), 500);
                }
            } else if (state.mode === 'versus') {
                state.status[realPlayer] = true;
                document.getElementById(`feedback-${player}`).classList.remove('hidden');
                document.getElementById(`wait-text-${player}`).style.display = 'block';
                if (state.firstSolver === null) {
                    state.firstSolver = realPlayer;
                    state.scores[realPlayer] += 2; scoreAdd = 2;
                } else {
                    state.scores[realPlayer] += 1; scoreAdd = 1;
                }
                if (state.scores[realPlayer] >= state.targetScore) setTimeout(determineWinner, 500);
                else if (state.status.p1 && state.status.p2) setTimeout(generateVersusQuestion, 1000);
            } else {
                state.status[realPlayer] = true;
                state.scores[realPlayer]++; scoreAdd = 1;
                document.getElementById(`feedback-${player}`).classList.remove('hidden');
                setTimeout(() => generateIndependentQuestion(player), 500);
            }

            updateScoreUI();
            const areaId = (player === 'sp') ? 'single-player-area' : `${player}-area`;
            showFloatingText(cx, cy, "+" + scoreAdd, "#2ecc71", document.getElementById(areaId));

        } else {
            playSound('wrong');
            btnElement.classList.add('shake');
            setTimeout(() => { btnElement.classList.remove('shake'); }, 400);

            state.combo[realPlayer] = 0;
            updateComboUI(player, 0);

            state.wrongStreak[realPlayer]++;
            let isBroken = false;
            let scoreDed = -1;
            if (state.wrongStreak[realPlayer] >= 2) { isBroken = true; scoreDed = -2; }

            if (state.scores[realPlayer] > 0) {
                state.scores[realPlayer] += scoreDed;
                if (state.scores[realPlayer] < 0) state.scores[realPlayer] = 0;
            }

            updateScoreUI();
            const areaId = (player === 'sp') ? 'single-player-area' : `${player}-area`;
            const txt = isBroken ? "-2 破音啦" : "-1";
            showFloatingText(cx, cy, txt, "#e74c3c", document.getElementById(areaId), isBroken);

            if (player === 'sp' && !state.wrongHistory.includes(currentQ)) state.wrongHistory.push(currentQ);
            if (realPlayer === 'p1' && !state.wrongHistoryP1.includes(currentQ)) state.wrongHistoryP1.push(currentQ);
            if (realPlayer === 'p2' && !state.wrongHistoryP2.includes(currentQ)) state.wrongHistoryP2.push(currentQ);

            if (player === 'sp') {
                state.questionCount++;
                updateScoreUI();
                if (state.questionCount >= state.maxQuestions) {
                    let penaltyTime = 800 * Math.pow(1.5, state.wrongStreak[realPlayer] - 1);
                    if (penaltyTime > 3000) penaltyTime = 3000;
                    setTimeout(endPracticeGame, penaltyTime + 500);
                    return;
                }
            }

            let penaltyTime = 800 * Math.pow(1.5, state.wrongStreak[realPlayer] - 1);
            if (penaltyTime > 3000) penaltyTime = 3000;
            state.locked[realPlayer] = true;
            const grid = document.getElementById(`opts-${player}`);
            grid.style.opacity = "0.4"; grid.style.pointerEvents = "none";
            setTimeout(() => {
                state.locked[realPlayer] = false;
                grid.style.opacity = "1"; grid.style.pointerEvents = "auto";
            }, penaltyTime);
        }
    }

    function updateComboUI(player, val) {
        if (player === 'sp') {
            const box = document.getElementById('sp-combo-box');
            const num = document.getElementById('sp-combo-val');
            num.innerText = val;
            if (val >= 2) {
                box.classList.remove('hidden');
                box.style.animation = 'none'; box.offsetHeight; box.style.animation = 'comboPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            } else { box.classList.add('hidden'); }
        } else {
            const el = document.getElementById(`combo-${player}`);
            el.innerText = `Combo x${val}`;
            el.style.opacity = (val >= 2) ? '1' : '0';
            if (val >= 2) { el.style.transform = 'scale(1.2)'; setTimeout(() => el.style.transform = 'scale(1)', 150); }
        }
    }

    function updateScoreUI() {
        if (state.mode === 'practice') {
            document.getElementById('sp-score').innerText = state.scores.p1;
            const counter = document.getElementById('sp-counter');
            if (counter) counter.innerText = `${Math.min(state.questionCount + 1, state.maxQuestions)} / ${state.maxQuestions}`;
            return;
        }
        document.getElementById('score-p1').innerText = state.scores.p1;
        document.getElementById('score-p2').innerText = state.scores.p2;
        const bar1 = document.getElementById('bar-p1');
        const bar2 = document.getElementById('bar-p2');
        let max = state.targetScore > 0 ? state.targetScore : 30;
        if (state.mode === 'speed') max = 20;
        const p1Pct = Math.min((state.scores.p1 / max) * 100, 100);
        const p2Pct = Math.min((state.scores.p2 / max) * 100, 100);
        bar1.style.width = p1Pct + '%';
        bar2.style.width = p2Pct + '%';
    }

    function determineWinner() {
        let winner = null;
        if (state.scores.p1 > state.scores.p2) winner = 'p1';
        else if (state.scores.p2 > state.scores.p1) winner = 'p2';
        else winner = 'draw';
        endGame(winner);
    }

    function getRandomMsg(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function endGame(result) {
        clearInterval(state.timerInterval);
        document.getElementById('game-over').classList.remove('hidden');

        // Reset visibility
        ['res-title-p1', 'res-score-p1', 'res-msg-p1'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        ['res-title-p2', 'res-score-p2', 'res-msg-p2'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        document.getElementById('review-list-p1').classList.add('hidden');
        document.getElementById('review-list-p2').classList.add('hidden');

        const t1 = document.getElementById('res-title-p1'), t2 = document.getElementById('res-title-p2');
        const m1 = document.getElementById('res-msg-p1'), m2 = document.getElementById('res-msg-p2');

        document.getElementById('res-score-p1').innerText = `Score: ${state.scores.p1}`;
        document.getElementById('res-score-p2').innerText = `Score: ${state.scores.p2}`;
        t1.className = "result-title"; t2.className = "result-title";

        if (result === 'p1') {
            t1.innerText = "WINNER!"; t1.classList.add('win-msg'); m1.innerText = getRandomMsg(MSG_WIN);
            t2.innerText = "LOSE..."; t2.classList.add('lose-msg'); m2.innerText = getRandomMsg(MSG_LOSE);
        }
        else if (result === 'p2') {
            t2.innerText = "WINNER!"; t2.classList.add('win-msg'); m2.innerText = getRandomMsg(MSG_WIN);
            t1.innerText = "LOSE..."; t1.classList.add('lose-msg'); m1.innerText = getRandomMsg(MSG_LOSE);
        }
        else {
            t1.innerText = "DRAW"; m1.innerText = getRandomMsg(MSG_DRAW);
            t2.innerText = "DRAW"; m2.innerText = getRandomMsg(MSG_DRAW);
        }

        const reviewBtn = document.getElementById('btn-review-dual');
        if (reviewBtn) {
            if (state.wrongHistoryP1.length > 0 || state.wrongHistoryP2.length > 0) {
                reviewBtn.classList.remove('hidden');
            } else {
                reviewBtn.classList.add('hidden');
            }
        }
    }

    function showDualReview() {
        // Hide result elements
        ['res-title-p1', 'res-score-p1', 'res-msg-p1'].forEach(id => document.getElementById(id).classList.add('hidden'));
        ['res-title-p2', 'res-score-p2', 'res-msg-p2'].forEach(id => document.getElementById(id).classList.add('hidden'));

        // Show review lists
        const list1 = document.getElementById('review-list-p1');
        const list2 = document.getElementById('review-list-p2');
        list1.classList.remove('hidden');
        list2.classList.remove('hidden');

        // Hide review button
        document.getElementById('btn-review-dual').classList.add('hidden');

        // Populate lists
        const renderList = (container, list, titleText) => {
            container.innerHTML = '';
            const title = document.createElement('h3');
            title.innerText = titleText;
            title.style.textAlign = 'center';
            title.style.borderBottom = '2px solid #333';
            title.style.marginBottom = '10px';
            container.appendChild(title);

            if (list.length === 0) {
                const p = document.createElement('p');
                p.innerText = "無錯題！";
                p.style.textAlign = 'center';
                p.style.color = '#2ecc71';
                container.appendChild(p);
            } else {
                list.forEach((q, idx) => {
                    const item = document.createElement('div');
                    item.style.borderBottom = '1px solid #eee';
                    item.style.padding = '5px 0';
                    item.style.textAlign = 'left';

                    let qText = q.qType === 'text' ? q.qContent : "[圖片題]";
                    const ansData = AnswerBank[q.aKey];
                    const ansText = ansData ? (ansData.type === 'text' ? ansData.content : "[圖片答案]") : "Unknown";

                    item.innerHTML = `
                        <div style="font-weight:bold; color:#e74c3c; font-size:0.9rem;">${idx + 1}. ${qText}</div>
                        <div style="color:#2ecc71; font-size:0.8rem;">正解: ${ansText}</div>
                    `;
                    container.appendChild(item);
                });
            }
        };

        renderList(list1, state.wrongHistoryP1, "P1 錯題");
        renderList(list2, state.wrongHistoryP2, "P2 錯題");
    }

    function endPracticeGame() {
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('single-player-area').classList.add('hidden'); // Hide SP area

        // Reuse P1/P2 slots for title and wrong list
        const t1 = document.getElementById('res-title-p1');
        const m1 = document.getElementById('res-msg-p1');
        const s1 = document.getElementById('res-score-p1');

        // Hide P2 bottom part or use it for list
        const bottomPart = document.querySelector('.go-bottom');
        bottomPart.innerHTML = ''; // Clear P2 area for custom list

        t1.innerText = "練習結束";
        t1.className = "result-title";
        s1.innerText = `最終分數: ${state.scores.p1}`;
        m1.innerText = state.wrongHistory.length === 0 ? "太強了！全對！" : "再接再厲，複習一下錯題吧";

        // Render Wrong List
        if (state.wrongHistory.length > 0) {
            const listContainer = document.createElement('div');
            listContainer.style.width = '90%';
            listContainer.style.maxWidth = '500px';
            listContainer.style.maxHeight = '300px';
            listContainer.style.overflowY = 'auto';
            listContainer.style.background = '#f9f9f9';
            listContainer.style.padding = '10px';
            listContainer.style.borderRadius = '8px';
            listContainer.style.marginTop = '10px';

            state.wrongHistory.forEach((q, idx) => {
                const item = document.createElement('div');
                item.style.borderBottom = '1px solid #eee';
                item.style.padding = '8px 0';
                item.style.textAlign = 'left';

                let qText = "";
                if (q.qType === 'text') qText = q.qContent;
                else qText = "[圖片題]";

                const ansData = AnswerBank[q.aKey];
                const ansText = ansData ? (ansData.type === 'text' ? ansData.content : "[圖片答案]") : "Unknown";

                item.innerHTML = `
                    <div style="font-weight:bold; color:#e74c3c;">${idx + 1}. ${qText}</div>
                    <div style="color:#2ecc71; font-size:0.9rem;">正解: ${ansText}</div>
                `;
                listContainer.appendChild(item);
            });
            bottomPart.appendChild(listContainer);
        } else {
            const perfectMsg = document.createElement('div');
            perfectMsg.innerText = "完美通關！沒有錯題！";
            perfectMsg.style.fontSize = "1.5rem";
            perfectMsg.style.color = "#2ecc71";
            perfectMsg.style.fontWeight = "bold";
            bottomPart.appendChild(perfectMsg);
        }
    }

    function showMenu() {
        clearInterval(state.timerInterval);
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('countdown-overlay').classList.add('hidden');
        document.getElementById('single-player-area').classList.add('hidden');
        document.getElementById('versus-container').style.display = 'flex';
        document.getElementById('warning-layer').classList.add('hidden'); // Reset warning
    }

    function toggleTable(show) {
        const el = document.getElementById('ref-table-overlay');
        const tbody = document.getElementById('math-table-body');
        if (show) {
            tbody.innerHTML = '';
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th style="width:35%">圖</th><th style="width:15%">代號</th><th style="width:25%">泛音</th><th style="width:25%">諧音</th>';
            tbody.appendChild(headerRow);
            if (typeof ReferenceTable !== 'undefined') {
                ReferenceTable.forEach(item => {
                    const tr = document.createElement('tr');
                    if (item.type === "header") {
                        tr.style.background = "#eee";
                        const td = document.createElement('td'); td.colSpan = 4; td.style.fontWeight = "bold"; td.style.padding = "10px"; td.style.color = "#333"; td.textContent = item.title; tr.appendChild(td);
                    } else {
                        const tdImg = document.createElement('td');
                        const img = document.createElement('img'); img.src = item.img; img.style.maxHeight = "50px"; img.style.maxWidth = "100%"; img.style.display = "block"; img.style.margin = "0 auto";
                        tdImg.appendChild(img); tr.appendChild(tdImg);
                        const tdVal = document.createElement('td'); tdVal.textContent = item.val; tdVal.style.fontWeight = "bold"; tdVal.style.color = "#e67e22"; tr.appendChild(tdVal);
                        const tdO = document.createElement('td'); tdO.textContent = item.o; tr.appendChild(tdO);
                        const tdH = document.createElement('td'); tdH.textContent = item.h; tr.appendChild(tdH);
                    }
                    tbody.appendChild(tr);
                });
            } el.classList.remove('hidden');
        } else { el.classList.add('hidden'); }
    }

    return { init, showMenu, toggleTable, showDualReview };
})();