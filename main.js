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

    showInstructions(type) {
        const title = document.getElementById('arc-dialog-header');
        const text = document.getElementById('arc-dialog-content');
        const icon = document.getElementById('arc-dialog-glyph');

        const info = {
            guessword: { title: "GUESS WORD", icon: "🧐", text: "Find the secret word! The system will tell you if your letters match. Type 'HINT' if you get stuck." },
            battlegame: { title: "BATTLE QUEST", icon: "⚔️", text: "The enemy HP is HIDDEN! You have 5 tries to deal EXACTLY enough damage to bring them to zero. Can you hit the bullseye?" },
            rps: { title: "ROSHAMBO", icon: "✂️", text: "Classic Rock-Paper-Scissors. Best of 5 rounds wins the prize. Choose wisely!" },
            tictactoe: { title: "NEON DUEL", icon: "⭕", text: "Connect 3 symbols in a row. A game of pure strategy and light." }
        };

        const config = info[type];
        title.innerText = config.title;
        icon.innerText = config.icon;
        text.innerText = config.text;

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
        this.wordList = ["ARCADE", "LEVEL", "GAMER", "COINS", "QUEST", "SCORE", "BATTLE", "LEGEND", "RETRO", "SYSTEM", "PACMAN", "PIXEL", "CODING", "MATRIX", "WIZARD", "GALAXY", "NEON", "CYBER", "VICTORY"];
        this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
        this.render();
    }
    checkGuess() {
        const input = document.getElementById('word-input');
        const user = input.value.trim().toUpperCase();
        const feedback = document.getElementById('word-feedback');
        if (!user) return;

        if (user === "EXIT") {
            window.hub.showHub();
            return;
        }

        if (user === "HINT") {
            feedback.innerHTML = `Secret Word is ${this.secretWord.length} letters`;
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
        this.container.innerHTML = `
            <h2 style="margin-bottom:20px; color:#0ff">GUESS WORD</h2>
            <p style="font-size:12px; margin-bottom:10px; opacity:0.8">Find the secret word! 🔑</p>
            <div id="word-feedback" class="output-msg" style="min-height:50px">AWAITING INPUT...</div>
            <input type="text" id="word-input" class="word-input" style="font-family:'Press Start 2P'; background:transparent; border:2px solid #0ff; outline:none; color:#0ff; padding:15px; margin:20px 0; width: 80%; max-width: 300px" placeholder="KEYWORD_" autocomplete="off">
            <button id="btn-guess" class="btn-play">SUBMIT</button>
            <p style="font-size:10px; margin-top:20px; opacity:0.6">TYPE 'HINT' FOR CLUE | TYPE 'EXIT' TO QUIT</p>
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
        const log = document.getElementById('battle-log');
        const tries = document.getElementById('battle-tries');

        tries.innerText = `REMAINING TRIES: ${this.tryCount}`;

        if (this.afterHp === 0) {
            log.innerHTML = `<span style="color:#10b981">🎉 CHAMPION! ENEMY DEFEATED 🎉</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else if (this.afterHp < 0) {
            log.innerHTML = `<span style="color:#f43f5e">OH NO! OVERKILL! ❌</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else if (this.tryCount === 0) {
            log.innerHTML = `<span style="color:#f43f5e">GAME OVER! ENEMY SURVIVED WITH SOME HP... 😔</span>`;
            document.querySelectorAll('.battle-btn').forEach(b => b.disabled = true);
        } else {
            // Hint messages without revealing HP
            const currentMessage = this.afterHp > 70 ? "SENSORS: TARGET IS STILL STANDING STRONG." : (this.afterHp === 70 ? "SENSORS: HALFWAY POINT REACHED." : "SENSORS: TARGET CRITICAL. DO NOT OVERKILL.");
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
        this.container.innerHTML = `
            <h2 style="color:#ff00ff">BATTLE QUEST</h2>
            <div id="battle-tries" style="font-family:'Press Start 2P'; font-size:10px; margin:20px 0">REMAINING TRIES: 5</div>
            <div class="hp-container" style="margin:20px 0"><div id="battle-hp-bar" class="hp-bar"></div></div>
            <div id="battle-log" class="output-msg" style="min-height:60px">TARGET HP IS HIDDEN. NEUTRALIZE THE TARGET PRECISELY.</div>
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
        const cpu = ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)];
        const log = document.getElementById('rps-log');
        if (choice === cpu) log.innerText = `CPU CHOSE ${cpu}. TIE!`;
        else if ((choice === "Rock" && cpu === "Scissors") || (choice === "Paper" && cpu === "Rock") || (choice === "Scissors" && cpu === "Paper")) {
            log.innerText = `CPU CHOSE ${cpu}. PLAYER WINS!`;
            this.scores.user++;
        } else {
            log.innerText = `CPU CHOSE ${cpu}. CPU WINS!`;
            this.scores.cpu++;
        }
        this.scores.round++;
        document.getElementById('rps-score').innerText = `P1: ${this.scores.user} | CPU: ${this.scores.cpu}`;
        if (this.scores.round > 5) {
            log.innerText = this.scores.user > this.scores.cpu ? "GAME OVER: PLAYER WINS" : (this.scores.user < this.scores.cpu ? "GAME OVER: CPU WINS" : "GAME OVER: DRAW");
        }
    }
    render() {
        this.container.innerHTML = `
            <h2 style="color:#0ff">ROSHAMBO</h2>
            <div id="rps-score" style="margin:20px 0; font-family:'Press Start 2P'; font-size:12px">P1: 0 | CPU: 0</div>
            <div id="rps-log" class="output-msg">SELECT WEAPON</div>
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
        if (this.check()) { document.getElementById('ttt-log').innerText = `${this.p} WINS!`; this.isOver = 1; return; }
        if (this.board.every(b => b)) { document.getElementById('ttt-log').innerText = "DRAW!"; return; }
        this.p = this.p === "X" ? "O" : "X";
        document.getElementById('ttt-log').innerText = `PLAYER ${this.p} TURN`;
    }
    check() {
        const w = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        return w.some(c => c.every(i => this.board[i] === this.p));
    }
    render() {
        this.container.innerHTML = `
            <h2 style="color:#ff00ff">NEON DUEL</h2>
            <div id="ttt-log" class="output-msg">PLAYER X TURN</div>
            <div class="ttt-grid">
                ${this.board.map((v, i) => `<div class="ttt-cell ${v ? v.toLowerCase() : ''}" onclick="window.game.move(${i})">${v ? v : ''}</div>`).join('')}
            </div>
            <button class="btn-play" style="margin-top:20px" onclick="window.game.reset()">RESET</button>
        `;
        window.game = this;
    }
    reset() { this.board = Array(9).fill(null); this.p = "X"; this.isOver = 0; this.render(); }
}

window.hub = new ArcadeHub();
