async function loadLanguages() {
    if (window.LANG_RESOURCES) return window.LANG_RESOURCES;
    const response = await fetch('leng.json');
    window.LANG_RESOURCES = await response.json();
    return window.LANG_RESOURCES;
}

function formatText(template, params = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}

// Global flag to prevent language exploits mid-game
window.gameStarted = false;

// FIX 1: Si el juego está en curso, simplemente no hacer nada (sin mensaje invasivo)
window.changeLanguage = async function (lang) {
    if (window.gameStarted) return;
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

            window.gameStarted = false;

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
        
        window.gameStarted = false;
        if (this.currentGame && typeof this.currentGame.destroy === 'function') {
            this.currentGame.destroy();
        }
        this.currentGame = null;
    }
}

class GuessTheWord {
    constructor(container) {
        this.container = container; 
        this.currentLang = window.hub?.langData || { games: { guessword: { title: "WORDLE" } } };
        this.keyElements = {}; 
        this.keydownListener = null;
        // FIX 2: Estado de fin de partida a nivel de instancia
        this.gameOver = false;

        this.initGuessWord(this.currentLang);
    }

    updateLanguage() {
        // FIX 2: Si la partida terminó, no reiniciar el juego al cambiar idioma
        if (this.gameOver) return;
        this.currentLang = window.hub?.langData || this.currentLang;
        this.initGuessWord(this.currentLang);
    }

    destroy() {
        if (this.keydownListener) {
            window.removeEventListener('keydown', this.keydownListener);
        }
    }

    async initGuessWord(lang) {
        this.destroy();
        // FIX 2: Resetear el estado de fin de partida al iniciar una nueva
        this.gameOver = false;

        const t = lang.games?.guessword || {};    
        const activeLangCode = window.hub?.lang || 'en';
        const dictionaryFile = activeLangCode === 'es' ? 'palabras.txt' : 'words.txt';
        let secret = "TIZAS"; 

        try {
            const response = await fetch(dictionaryFile);
            if (response.ok) {
                const textData = await response.text();
                const parsedWords = textData
                    .split('\n')
                    .map(w => w.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) 
                    .filter(w => w.length === 5);

                if (parsedWords.length > 0) {
                    secret = parsedWords[Math.floor(Math.random() * parsedWords.length)];
                }
            }
        } catch (error) {
            console.error("Could not fetch explicit word file, fallback initialized.", error);
        }

        const maxAttempts = 6;
        let currentAttempt = 0;
        let currentLetterIndex = 0;
        let guesses = Array(maxAttempts).fill("").map(() => Array(5).fill(""));
        let gameOver = false;

        const zone = document.getElementById('arc-render-zone') || this.container;
        zone.innerHTML = '';                                      

        // ----- TITLE -----
        const title = document.createElement('h2');
        title.style.color = '#0ff'; 
        title.textContent = t.title || (activeLangCode === 'es' ? 'LA PALABRA DEL DÍA' : 'WORD OF THE DAY');
        zone.appendChild(title);

        // ----- GAME MATRIX GRID -----
        const gridContainer = document.createElement('div');
        gridContainer.className = 'gw-grid-container';
        gridContainer.style.cssText = 'display:grid; grid-template-rows:repeat(6, 1fr); gap:5px; margin:20px auto; width:max-content;';
        
        const cellMatrix = [];
        for (let r = 0; r < maxAttempts; r++) {
            const rowEl = document.createElement('div');
            rowEl.style.cssText = 'display:grid; grid-template-columns:repeat(5, 1fr); gap:5px;';
            const rowCells = [];
            for (let c = 0; c < 5; c++) {
                const cell = document.createElement('div');
                cell.className = 'gw-letter-box';
                cell.style.cssText = 'width:50px; height:50px; border:2px solid #333; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; color:#fff; text-transform:uppercase; transition: background-color 0.3s;';
                rowEl.appendChild(cell);
                rowCells.push(cell);
            }
            gridContainer.appendChild(rowEl);
            cellMatrix.push(rowCells);
        }
        zone.appendChild(gridContainer);
        cellMatrix[0][0].style.borderColor = '#0071e3';

        // ----- MESSAGE CONTAINER -----
        const messageContainer = document.createElement('div');
        messageContainer.className = 'gw-message-container';
        messageContainer.style.cssText = 'min-height: 28px; font-weight: bold; font-family: "Press Start 2P", monospace; font-size: 0.75rem; margin: 15px 0; text-align: center; transition: all 0.3s; line-height: 1.4;';
        zone.appendChild(messageContainer);

        // ----- ACTIONS AREA (Play Again Button) -----
        const actionArea = document.createElement('div');
        actionArea.style.cssText = 'display:flex; justify-content:center; min-height:40px; margin-bottom:10px;';
        zone.appendChild(actionArea);

        // ----- VISUAL MONITOR KEYBOARD -----
        const baseRows = [
            ['Q','W','E','R','T','Y','U','I','O','P'],
            ['A','S','D','F','G','H','J','K','L']
        ];
        
        if (activeLangCode === 'es') {
            baseRows[1].push('Ñ');
        }
        
        baseRows.push(['Z','X','C','V','B','N','M']);

        const keyboard = document.createElement('div');
        keyboard.className = 'gw-keyboard';
        keyboard.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:10px; align-items:center; pointer-events: none;';
        
        this.keyElements = {};
        baseRows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'gw-keyboard-row';
            rowEl.style.cssText = 'display:flex; gap:6px;';
            row.forEach(letter => {
                const key = document.createElement('button');
                key.className = 'gw-key';
                key.textContent = letter;
                key.style.cssText = 'background-color:#2d3748; color:#fff; border:none; padding:10px 12px; font-weight:bold; border-radius:4px; min-width:32px; font-size:0.9rem;';
                rowEl.appendChild(key);
                this.keyElements[letter] = key;
            });
            keyboard.appendChild(rowEl);
        });
        zone.appendChild(keyboard);

        const updateGridDisplay = () => {
            for (let r = 0; r < maxAttempts; r++) {
                for (let c = 0; c < 5; c++) {
                    cellMatrix[r][c].textContent = guesses[r][c];
                    if (!gameOver && r === currentAttempt && c === currentLetterIndex) {
                        cellMatrix[r][c].style.borderColor = '#0071e3';
                    } else if (r === currentAttempt && !gameOver) {
                        cellMatrix[r][c].style.borderColor = '#555';
                    }
                }
            }
        };

        const showResetButton = () => {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'btn-play';
            resetBtn.textContent = activeLangCode === 'es' ? 'JUGAR DE NUEVO' : 'PLAY AGAIN';
            resetBtn.style.padding = '10px 20px';
            resetBtn.onclick = () => {
                // FIX 2: Resetear el flag de instancia antes de reiniciar
                this.gameOver = false;
                this.initGuessWord(this.currentLang);
            };
            actionArea.appendChild(resetBtn);
        };

        // ----- ATTEMPT SUBMISSION -----
        const submitGuess = () => {
            if (currentLetterIndex < 5) return; 

            const currentWord = guesses[currentAttempt].join("");
            let tempSecret = secret.split("");
            let rowStatuses = Array(5).fill('absent'); 

            for (let i = 0; i < 5; i++) {
                if (currentWord[i] === secret[i]) {
                    rowStatuses[i] = 'correct';
                    tempSecret[i] = null; 
                }
            }

            for (let i = 0; i < 5; i++) {
                if (rowStatuses[i] === 'correct') continue;
                
                const indexInSecret = tempSecret.indexOf(currentWord[i]);
                if (indexInSecret !== -1) {
                    rowStatuses[i] = 'present';
                    tempSecret[indexInSecret] = null;
                }
            }

            for (let i = 0; i < 5; i++) {
                const letter = currentWord[i];
                const cell = cellMatrix[currentAttempt][i];
                const keyBtn = this.keyElements[letter];

                if (rowStatuses[i] === 'correct') {
                    cell.style.backgroundColor = '#2f855a'; 
                    cell.style.borderColor = '#2f855a';
                    if (keyBtn) keyBtn.style.backgroundColor = '#2f855a';
                } else if (rowStatuses[i] === 'present') {
                    cell.style.backgroundColor = '#dd6b20'; 
                    cell.style.borderColor = '#dd6b20';
                    if (keyBtn && keyBtn.style.backgroundColor !== 'rgb(47, 133, 90)') {
                        keyBtn.style.backgroundColor = '#dd6b20';
                    }
                } else {
                    cell.style.backgroundColor = '#4a5568'; 
                    cell.style.borderColor = '#4a5568';
                    if (keyBtn && !keyBtn.style.backgroundColor) {
                        keyBtn.style.backgroundColor = '#1a202c'; 
                    }
                }
            }

            if (currentWord === secret) {
                // FIX 2: Marcar fin de partida en la instancia Y en la variable local
                gameOver = true;
                this.gameOver = true;
                messageContainer.style.color = '#48bb78'; // Green
                messageContainer.textContent = activeLangCode === 'es' 
                    ? `🎉 ¡GANASTE! LA PALABRA ERA: ${secret}` 
                    : `🎉 YOU WIN! THE WORD WAS: ${secret}`;
                this.destroy();
                window.gameStarted = false;
                showResetButton();
                return;
            }

            currentAttempt++;
            currentLetterIndex = 0;

            if (currentAttempt >= maxAttempts) {
                // FIX 2: Marcar fin de partida en la instancia Y en la variable local
                gameOver = true;
                this.gameOver = true;
                messageContainer.style.color = '#f56565'; // Red
                messageContainer.textContent = activeLangCode === 'es' 
                    ? `😞 ¡PERDISTE! LA PALABRA ERA: ${secret}` 
                    : `😞 GAME OVER. THE WORD WAS: ${secret}`;
                this.destroy();
                window.gameStarted = false;
                showResetButton();
                return;
            }

            updateGridDisplay();
        };

        // ----- HARDWARE INPUT INITIALIZATION -----
        this.keydownListener = (e) => {
            if (gameOver) return;

            const key = e.key.toUpperCase();

            if (key === 'ENTER') {
                submitGuess();
            } else if (key === 'BACKSPACE') {
                if (currentLetterIndex > 0) {
                    currentLetterIndex--;
                    guesses[currentAttempt][currentLetterIndex] = "";
                    updateGridDisplay();
                }
            } else if (/^[A-ZÑ]$/.test(key)) {
                if (!window.gameStarted) {
                    window.gameStarted = true;
                }

                if (key === 'Ñ' && activeLangCode === 'en') return;

                if (currentLetterIndex < 5) {
                    guesses[currentAttempt][currentLetterIndex] = key;
                    currentLetterIndex++;
                    updateGridDisplay();
                }
            }
        };

        window.addEventListener('keydown', this.keydownListener);
    }
}

class BattleGame {
    constructor(container) {
        this.container = container;
        this.afterHp = 140;
        this.tryCount = 5;
        this.render();
    }
    updateLanguage() {
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
    updateLanguage() {
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
    updateLanguage() {
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