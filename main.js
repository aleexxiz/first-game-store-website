async function loadLanguages() {
    if (window.LANG_RESOURCES) return window.LANG_RESOURCES;
    const response = await fetch('leng.json');
    window.LANG_RESOURCES = await response.json();
    return window.LANG_RESOURCES;
}

function formatText(template, params = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}

window.cambiarIdioma = async function (lang) {
    if (window.hub) await window.hub.setLanguage(lang);
};

window.setLanguageButtons = function (lang) {
    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.classList.toggle('btn-active', btn.id === `btn-${lang}`);
    });
};

class ArcadeHub {
    constructor() {
        this.hubView = document.getElementById('arc-hub-portal');
        this.gameView = document.getElementById('arc-simulation-chamber');
        this.renderArea = document.getElementById('arc-render-zone');
        this.backBtn = document.getElementById('arc-abort-signal');
        this.overlay = document.getElementById('arc-dialog-veil');
        this.modalStartBtn = document.getElementById('arc-mission-trigger');
        this.modalCloseBtn = document.getElementById('arc-dialog-close');
        this.currentGame = null;
        this.pendingGameType = null;
        this.lang = 'en';
        this.langData = null;

        this.init();
    }

    init() {
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                this.pendingGameType = card.getAttribute('data-game');
                this.showInstructions(this.pendingGameType);
            });
        });
        this.backBtn.addEventListener('click', () => this.showHub());
        this.modalStartBtn.onclick = () => this.startGame();
        this.modalCloseBtn.onclick = () => this.overlay.style.display = 'none';
    }

    async setLanguage(lang) {
        const resources = await loadLanguages();
        this.lang = lang;
        this.langData = resources[lang] || resources.en;
        this.applyLanguage();
    }

    applyLanguage() {
        window.setLanguageButtons(this.lang);

        const ui = this.langData.ui;
        const games = this.langData.games;

        const backSpan = document.querySelector('#arc-abort-signal .back-msg');
        if (backSpan) backSpan.innerText = ui.back || ui.exit || backSpan.innerText;

        if (this.modalStartBtn) this.modalStartBtn.innerText = ui.instructions_trigger || this.modalStartBtn.innerText;

        document.querySelectorAll('.game-card').forEach(card => {
            const type = card.getAttribute('data-game');
            const gameInfo = games[type];
            if (!gameInfo) return;
            const title = card.querySelector('h3');
            if (title) title.innerText = gameInfo.title;
        });

        if (this.currentGame && typeof this.currentGame.updateLanguage === 'function') {
            this.currentGame.updateLanguage();
        }
    }

    showInstructions(type) {
        const title = document.getElementById('arc-dialog-header');
        const text = document.getElementById('arc-dialog-content');
        const icon = document.getElementById('arc-dialog-glyph');

        const info = this.langData?.games?.[type] || {};
        title.innerText = info.title || title.innerText;
        icon.innerText = info.icon || icon.innerText;
        text.innerText = info.instructions || text.innerText;

        this.overlay.style.display = 'flex';
    }

    startGame() {
        this.overlay.style.display = 'none';
        this.hubView.classList.remove('active');
        setTimeout(() => {
            this.hubView.style.display = 'none';
            this.gameView.style.display = 'block';
            setTimeout(() => this.gameView.classList.add('active'), 50);
            this.renderArea.innerHTML = '';

            switch (this.pendingGameType) {
                case 'guessword': this.currentGame = new GuessTheWord(this.renderArea); break;
                case 'battlegame': this.currentGame = new BattleGame(this.renderArea); break;
                case 'rps': this.currentGame = new RPS(this.renderArea); break;
                case 'tictactoe': this.currentGame = new TicTacToe(this.renderArea); break;
            }
        }, 300);
    }

    showHub() {
        this.gameView.classList.remove('active');
        setTimeout(() => {
            this.gameView.style.display = 'none';
            this.hubView.style.display = 'block';
            setTimeout(() => this.hubView.classList.add('active'), 50);
        }, 300);
        this.currentGame = null;
    }
}

class GuessTheWord {
    constructor(container) {
        this.container = container;
        const langGame = window.hub?.langData?.games?.guessword || {};
        this.wordList = langGame.words || ["ARCADE", "LEVEL", "GAMER", "COINS", "QUEST", "SCORE", "BATTLE", "LEGEND", "RETRO", "SYSTEM", "PACMAN", "PIXEL", "CODING", "MATRIX", "WIZARD", "GALAXY", "NEON", "CYBER", "VICTORY"];
        this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
        this.render();
    }
    checkGuess() {
        const langGame = window.hub?.langData?.games?.guessword || {};
        const input = document.getElementById('word-input');
        const user = input.value.trim().toUpperCase();
        const feedback = document.getElementById('word-feedback');
        if (!user) return;

        if (user === "EXIT") {
            window.hub.showHub();
            return;
        }

        if (user === "HINT") {
            feedback.innerHTML = `${langGame.title || 'Secret Word'} is ${this.secretWord.length} letters`;
            input.value = "";
            return;
        }

        if (user === this.secretWord) {
            feedback.innerHTML = "🎉 You WON! Great job! 🎉";
            input.disabled = true;
            document.getElementById('btn-guess').style.display = 'none';
        } else {
            let total_char = 0;
            const userChars = new Set(user);
            userChars.forEach(char => {
                if (this.secretWord.includes(char)) total_char++;
            });

            if (total_char === 0) {
                feedback.innerText = "No matching characters";
            } else if (total_char === 1) {
                feedback.innerText = "CLOSE! 1 character is correct";
            } else if (total_char === 2) {
                feedback.innerText = "CLOSER! 2 characters correct";
            } else {
                feedback.innerText = "VERY CLOSE! 3+ characters correct";
            }
        }
        input.value = "";
    }
    render() {
        const langGame = window.hub?.langData?.games?.guessword || {};
        const ui = window.hub?.langData?.ui || {};
        this.container.innerHTML = `
            <h2 style="margin-bottom:20px; color:#0ff">${langGame.title || 'GUESS WORD'}</h2>
            <p style="font-size:12px; margin-bottom:10px; opacity:0.8">${langGame.instructions || 'Find the secret word! 🔑'}</p>
            <div id="word-feedback" class="output-msg" style="min-height:50px">AWAITING INPUT...</div>
            <input type="text" id="word-input" class="word-input" style="font-family:'Press Start 2P'; background:transparent; border:2px solid #0ff; outline:none; color:#0ff; padding:15px; margin:20px 0; width: 80%; max-width: 300px" placeholder="${langGame.placeholder || 'KEYWORD_'}" autocomplete="off">
            <button id="btn-guess" class="btn-play">${ui.submit || 'SUBMIT'}</button>
            <p style="font-size:10px; margin-top:20px; opacity:0.6">${langGame.footer_hint || "TYPE 'HINT' FOR CLUE | TYPE 'EXIT' TO QUIT"}</p>
        `;
        document.getElementById('btn-guess').onclick = () => this.checkGuess();
        document.getElementById('word-input').onkeypress = (e) => { if (e.key === 'Enter') this.checkGuess(); };
    }
}

class BattleGame {
    constructor(container) {
        this.container = container;
        this.afterHp = 140;
        this.tryCount = 5;
        this.render();
    }
    attack(val) {
        if (this.tryCount <= 0 || this.afterHp <= 0) return;
        this.afterHp -= val;
        this.tryCount--;
        this.updateUI();
    }
    updateUI() {
        const langBattle = window.hub?.langData?.games?.battlegame || {};
        const log = document.getElementById('battle-log');
        const tries = document.getElementById('battle-tries');

        tries.innerText = `${langBattle.tries || 'REMAINING TRIES'}: ${this.tryCount}`;

        if (this.afterHp === 0) {
            log.innerHTML = `<span style="color:#10b981">${langBattle.victory || '🎉 CHAMPION! ENEMY DEFEATED 🎉'}</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else if (this.afterHp < 0) {
            log.innerHTML = `<span style="color:#f43f5e">${langBattle.overkill || 'OH NO! OVERKILL! ❌'}</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else if (this.tryCount === 0) {
            log.innerHTML = `<span style="color:#f43f5e">${langBattle.gameover || 'GAME OVER! ENEMY SURVIVED WITH SOME HP... 😔'}</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else {
            const currentMessage = this.afterHp > 70 ? langBattle.sensors_strong || 'SENSORS: TARGET IS STILL STANDING STRONG.' : (this.afterHp === 70 ? langBattle.sensors_half || 'SENSORS: HALFWAY POINT REACHED.' : langBattle.sensors_critical || 'SENSORS: TARGET CRITICAL. DO NOT OVERKILL.');
            this.typeMsg(log, currentMessage);
        }
    }

    typeMsg(element, text) {
        element.innerText = "";
        let i = 0;
        const interval = setInterval(() => {
            element.innerText += text[i];
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 30);
    }

    render() {
        const langBattle = window.hub?.langData?.games?.battlegame || {};
        this.container.innerHTML = `
            <h2 style="color:#ff00ff">${langBattle.title || 'BATTLE QUEST'}</h2>
            <div id="battle-tries" style="font-family:'Press Start 2P'; font-size:10px; margin:20px 0">${langBattle.tries || 'REMAINING TRIES'}: 5</div>
            <div class="hp-container" style="margin:20px 0"><div id="battle-hp-bar" class="hp-bar"></div></div>
            <div id="battle-log" class="output-msg" style="min-height:60px">${langBattle.instructions || 'TARGET HP IS HIDDEN. NEUTRALIZE THE TARGET PRECISELY.'}</div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:20px">
                ${[10, 20, 30, 40, 50].map(v => `<button class="btn-play battle-btn" onclick="window.game.attack(${v})">${v}</button>`).join('')}
            </div>
        `;
        window.game = this;
    }
}

class RPS {
    constructor(container) {
        this.container = container;
        this.scores = { user: 0, cpu: 0, round: 1 };
        this.render();
    }
    play(choice) {
        if (this.scores.round > 5) return;
        const langRPS = window.hub?.langData?.games?.rps || {};
        const cpu = ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)];
        const log = document.getElementById('rps-log');
        if (choice === cpu) log.innerText = formatText(langRPS.tie || `CPU CHOSE {cpu}. TIE!`, { cpu });
        else if ((choice === "Rock" && cpu === "Scissors") || (choice === "Paper" && cpu === "Rock") || (choice === "Scissors" && cpu === "Paper")) {
            log.innerText = formatText(langRPS.win || `CPU CHOSE {cpu}. PLAYER WINS!`, { cpu });
            this.scores.user++;
        } else {
            log.innerText = formatText(langRPS.lose || `CPU CHOSE {cpu}. CPU WINS!`, { cpu });
            this.scores.cpu++;
        }
        this.scores.round++;
        document.getElementById('rps-score').innerText = formatText(langRPS.score_label || `P1: {user} | CPU: {cpu}`, { user: this.scores.user, cpu: this.scores.cpu });
        if (this.scores.round > 5) {
            log.innerText = this.scores.user > this.scores.cpu ? (langRPS.game_over_win || "GAME OVER: PLAYER WINS") : (this.scores.user < this.scores.cpu ? (langRPS.game_over_lose || "GAME OVER: CPU WINS") : (langRPS.game_over_draw || "GAME OVER: DRAW"));
        }
    }
    render() {
        const langRPS = window.hub?.langData?.games?.rps || {};
        this.container.innerHTML = `
            <h2 style="color:#0ff">${langRPS.title || 'ROSHAMBO'}</h2>
            <div id="rps-score" style="margin:20px 0; font-family:'Press Start 2P'; font-size:12px">${formatText(langRPS.score_label || 'P1: {user} | CPU: {cpu}', { user: 0, cpu: 0 })}</div>
            <div id="rps-log" class="output-msg">${langRPS.select_weapon || 'SELECT WEAPON'}</div>
            <div style="display:flex; gap:20px; font-size: 3rem">
                <span class="rps-hand" style="cursor:pointer" onclick="window.game.play('Rock')">🪨</span>
                <span class="rps-hand" style="cursor:pointer" onclick="window.game.play('Paper')">📄</span>
                <span class="rps-hand" style="cursor:pointer" onclick="window.game.play('Scissors')">✂️</span>
            </div>
        `;
        window.game = this;
    }
}

class TicTacToe {
    constructor(container) {
        this.container = container;
        this.board = Array(9).fill(null);
        this.p = "X";
        this.isOver = false;
        this.render();
    }
    move(i) {
        if (this.board[i] || this.isOver) return;
        this.board[i] = this.p;
        this.render();
        const langTTT = window.hub?.langData?.games?.tictactoe || {};
        if (this.check()) {
            document.getElementById('ttt-log').innerText = formatText(langTTT.win || '{player} WINS!', { player: this.p });
            this.isOver = 1;
            return;
        }
        if (this.board.every(b => b)) {
            document.getElementById('ttt-log').innerText = langTTT.draw || 'DRAW!';
            return;
        }
        this.p = this.p === "X" ? "O" : "X";
        document.getElementById('ttt-log').innerText = formatText(langTTT.turn || 'PLAYER {player} TURN', { player: this.p });
    }
    check() {
        const w = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        return w.some(c => c.every(i => this.board[i] === this.p));
    }
    render() {
        const langTTT = window.hub?.langData?.games?.tictactoe || {};
        const ui = window.hub?.langData?.ui || {};
        this.container.innerHTML = `
            <h2 style="color:#ff00ff">${langTTT.title || 'NEON DUEL'}</h2>
            <div id="ttt-log" class="output-msg">${formatText(langTTT.turn || 'PLAYER {player} TURN', { player: 'X' })}</div>
            <div class="ttt-grid">
                ${this.board.map((v, i) => `<div class="ttt-cell ${v ? v.toLowerCase() : ''}" onclick="window.game.move(${i})">${v ? v : ''}</div>`).join('')}
            </div>
            <button class="btn-play" style="margin-top:20px" onclick="window.game.reset()">${ui.reset || 'RESET'}</button>
        `;
        window.game = this;
    }
    reset() { this.board = Array(9).fill(null); this.p = "X"; this.isOver = 0; this.render(); }
}

window.hub = new ArcadeHub();
window.hub.setLanguage('en');
