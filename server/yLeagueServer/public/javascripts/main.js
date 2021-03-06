const data = {};
const socket = io();
let audioContext = null;
const sounds = {};

function loadSound(name) {
    sounds[name] = null;
    fetch(`/sounds/${name}.wav`).then(response => response.arrayBuffer()).then(buffer => {
        audioContext.decodeAudioData(buffer, decodedBuffer => {
            sounds[name] = decodedBuffer;
        });
    });
}

function loadSounds() {
    if (audioContext === null) return;
    loadSound("nothing");
    loadSound("win");
    loadSound("lose");
    loadSound("yams");
    loadSound("dice");
    loadSound("play");
}

function playSound(name) {
    if (audioContext === null) return;
    if (sounds[name] === null || sounds[name] === undefined) return;
    const source = audioContext.createBufferSource();
    source.buffer = sounds[name];
    source.connect(audioContext.destination);
    source.start(0);
}

function playDiceAudio() {
    playSound("dice");
}

function playPlayAudio() {
    playSound("play");
}

function playWinAudio() {
    playSound("win");
}

function playLoseAudio() {
    playSound("lose");
}

function playYamsAudio() {
    playSound("yams");
}

function initSounds() {
    playSound("nothing");
}

startErrorLogging();

function startErrorLogging() {
    uncaught.start();
    uncaught.addListener((err, event) => {
        post('/api/v1/error', {
            data: {
                message: err.message,
                stack: err.stack,
                evt_location: `${event.filename}:${event.lineno}:${event.colno}`,
                evt_message: event.message,
                evt_timestamp: event.timeStamp,
                evt_type: event.type,
            }, browser: navigator.userAgent, player: localStorage.name
        })
    });
}

// socket.io events
socket.on('players_changed', function (players) {
    data.currentGame.players = players;
    data.currentGame.players.sort((p1, p2) => [p1.order - p2.order]);
    markYourself();
    if (data.currentGame.game.status === 'waiting') buildLobby();
});
socket.on('game_status_changed', function (id, status) {
    if (!data.currentGame || id != data.currentGame.game._id) return;
    if (status === 'started') {
        data.currentGame.game.status = status;
        buildGame();
    } else if (status === 'ended') {
        data.currentGame.game.status = status;
        renderTurnData();
    }
});
socket.on('ranks_set', function (ranks) {
    data.currentGame.game.ranks = ranks;
});
socket.on('move', function (move) {
    cancelNextMoveTimer();
    registerMove(move);
    let currentMove = move.order;
    let startMove = currentMove;
    while (!isMoveSet(startMove - 1) && startMove > 1) startMove--;
    if (currentMove > startMove) forceLoadMoves(startMove, currentMove - 1);
    if (nextPlayer().yourself) setNextMoveTimer(move.order + 1, move.order + 1, 60000);
});
socket.on('hold_selection', function (move, index, held) {
    if (move !== data.currentGame.board.getData().current.move) return;
    data.currentGame.hold[index] = held;
    drawHold(index);
});
socket.on('disconnect', function () {
    showLoadingPage();
});
socket.on('reconnect', function () {
    if (data.currentGame != null && data.currentGame.game != null && data.currentGame.game._id != null) {
        loadGame(data.currentGame.game._id);
    } else {
        showHomePage();
    }
});

function registerMove(move) {
    if (isMoveSet(move.order)) return;
    data.currentGame.moves.push(move);
    data.currentGame.maxMove = Math.max(data.currentGame.maxMove, move.order);
    data.currentGame.indexedMoves[move.order] = move;
}

function isMoveSet(order) {
    return data.currentGame.indexedMoves[order] !== undefined && data.currentGame.indexedMoves[order] !== null;
}

function init() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        loadSounds();
    } catch (e) {
        // audio not supported on browser
    }
    if (localStorage.getItem('secret') === null) {
        localStorage.secret = uuidv4();
    }
    if (localStorage.getItem('name') === null) {
        showSettingsPage();
    } else {
        showHomePage();
    }
}

function buildGame() {
    let html = buildHeader(data.currentGame.game.ranks);
    for (let i = 1; i <= 6; i++) {
        html += buildRow(i, `n${i}`);
    }
    html += buildRow('T', 'lt');
    html += buildRow('sum', 'ss');
    html += buildRow('SUM', 'ls');
    html += buildRow('FH', 'f');
    html += buildRow('FOK', 'k');
    html += buildRow('STR', 'q');
    html += buildRow('8', '8');
    html += buildRow('Y', 'y');
    html += buildRow('T', 'tt');
    html += buildRow('PTS', 'pts');
    html += buildFooter();
    $("#game-table").html(html);

    // init board
    data.currentGame.board = new board();
    data.currentGame.board.setRanks(data.currentGame.game.ranks);
    data.currentGame.lastMove = 0;

    // players tag
    data.currentGame.tags = [];
    let pOrder = playerOrder();
    if (pOrder < 0) pOrder = 0;
    data.currentGame.tags[pOrder] = 'p';
    data.currentGame.tags[(pOrder + 1) % 4] = 'op1';
    data.currentGame.tags[(pOrder + 2) % 4] = 'tm';
    data.currentGame.tags[(pOrder + 3) % 4] = 'op2';

    // fast draw
    while (movesLeft() > 100) {
        const move = nextMove();
        if (move.data.type === 'roll') data.currentGame.board.recordRoll(move.data.dice);
        else if (move.data.type === 'put') data.currentGame.board.recordPut(move.data.column, move.data.cell);
        data.currentGame.lastMove = move.order;
    }

    // start game display
    renderStartGame();
    if (movesLeft() == 0) renderTurnData();

    // start event renderer
    mainRenderer();
    showPage('game');
}

function renderTurnData() {
    const mLeft = movesLeft();
    if (data.currentGame.game.status === 'ended' && mLeft == 0) {
        return renderEndGame();
    }
    const cPlayer = currentPlayer();
    const player = data.currentGame.board.getData().current.player;
    const playerTag = data.currentGame.tags[player];
    $("#top-bar").removeClass('p');
    $("#top-bar").removeClass('tm');
    $("#top-bar").removeClass('op1');
    $("#top-bar").removeClass('op2');
    const noRolls = data.currentGame.board.getData().current.noRolls;
    $("#top-bar").html(`${cPlayer.name}'s turn | ${(3 - noRolls) || 'no'} rolls left`);
    $("#top-bar").addClass(playerTag);
    $(".dice").removeClass('p');
    $(".dice").removeClass('tm');
    $(".dice").removeClass('op1');
    $(".dice").removeClass('op2');
    $(".dice").addClass(playerTag);
    for (let i = 0; i < 5; i++) {
        $("body").off("click", `#dice-${i}`);
        $(`#dice-${i}`).removeClass('clickable');
        drawHold(i);
    }
    if (mLeft > 10) return;
    if (noRolls == 1) {
        const lastSelection = data.currentGame.selectedCells[player];
        if (lastSelection !== null) {
            $(`#${lastSelection.column}_${lastSelection.cell}_${playerTag}`).removeClass('cell-selected');
        }
    }
    if (cPlayer.yourself && mLeft === 0) {
        if (noRolls === 0) {
            vibrate(250);
        }
        if (data.currentGame.board.getData().current.noRolls !== 0) {
            for (let i = 0; i < 5; i++) {
                $("body").on("click", `#dice-${i}`, () => toggleHold(i));
                $(`#dice-${i}`).addClass('clickable');
            }
        }
        if (data.currentGame.board.canRoll()) {
            $("#rollbtn").prop('disabled', false);
        } else {
            $("#rollbtn").prop('disabled', true);
        }
        if (data.currentGame.board.getData().current.noRolls !== 0 && hasSelected()) {
            $("#playbtn").prop('disabled', false);
        } else {
            $("#playbtn").prop('disabled', true);
        }
    } else {
        $("#rollbtn").prop('disabled', true);
        $("#playbtn").prop('disabled', true);
    }
    //mark playable cells
    //put temp scores
    const columns = data.currentGame.board.getColumns();
    const cells = data.currentGame.board.getCells();
    for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];
            const val = data.currentGame.board.getData().values[column][cell][player];
            const element = $(`#${column}_${cell}_${playerTag}`);
            $("body").off("click", `#${column}_${cell}_${playerTag}`);
            element.html("&nbsp;");
            element.removeClass('temp');
            element.removeClass('available');
            element.removeClass('clickable');
            if (val !== null) {
                element.html(scoreVal(val));
                element.addClass('available');
            } else if (data.currentGame.board.canPut(column, cell)) {
                element.addClass('available');
                if (data.currentGame.board.getData().current.noRolls > 0) {
                    if (cPlayer.yourself && mLeft === 0) {
                        $("body").on("click", `#${column}_${cell}_${playerTag}`, () => toggleSelect(column, cell));
                        element.addClass('clickable');
                    }
                    element.addClass('temp');
                    element.html(getScoreFromScores(column, cell, data.currentGame.board.getScore(column, cell, data.currentGame.board.getData().current.dice)));
                }
            }

            // cleanup temp values
            for (let p = 0; p < 4; p++) {
                if (p === player) continue;
                const val = data.currentGame.board.getData().values[column][cell][p];
                const playerTag = data.currentGame.tags[p];
                const element = $(`#${column}_${cell}_${playerTag}`);
                $("body").off("click", `#${column}_${cell}_${playerTag}`);
                element.removeClass('clickable');
                if (val !== null) {
                    element.html(scoreVal(val));
                    element.addClass('available');
                } else {
                    element.html('&nbsp;');
                }
                element.removeClass('temp');
            }
        }
    }
    // clear dices
    if (data.currentGame.board.getData().current.noRolls === 0) {
        for (let i = 0; i < 5; i++) {
            $(`#dice-${i}`).html('#');
        }
    }
    const showTotals = showScores();
    for (let p = 0; p < 4; p++) {
        const playerTag = data.currentGame.tags[p];
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const ltElement = $(`#${column}_lt_${playerTag}`);
            const ttElement = $(`#${column}_tt_${playerTag}`);
            const ptsElement = $(`#${column}_pts_${playerTag}`);
            ltElement.html(data.currentGame.board.getPlayerUpperColumnScore(column, p));
            if (showTotals) {
                ttElement.html(data.currentGame.board.getScoreWithBonus(data.currentGame.board.getPlayerColumnScore(column, p)));
                let finalScore = data.currentGame.board.getPlayerFinalColumnScore(column, p);
                if (playerTag !== 'p') finalScore = prettyPoints(finalScore);
                ptsElement.html(finalScore);
            } else {
                ttElement.html(playerTag === "p" ? data.currentGame.board.getScoreWithBonus(data.currentGame.board.getPlayerColumnScore(column, p)) : "?");
                ptsElement.html("?");
            }
        }
        if (showTotals) {
            $(`#result_${playerTag}`).html(data.currentGame.board.getPlayerFinalScore(p));
        } else {
            $(`#result_${playerTag}`).html("?");
        }
    }
    const t1Names = `<span class='player ${data.currentGame.tags[0]}'>${data.currentGame.players[0].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[2]}'>${data.currentGame.players[2].name}</span>`;
    const t2Names = `<span class='player ${data.currentGame.tags[1]}'>${data.currentGame.players[1].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[3]}'>${data.currentGame.players[3].name}</span>`;
    $('#t1_t').html(t1Names);
    $('#t2_t').html(t2Names);

    if (showTotals) {
        $('#t1_p').html(data.currentGame.board.getTeamFinalScore(1));
        $('#t2_p').html(data.currentGame.board.getTeamFinalScore(2));
    } else {
        $('#t1_p').html("?");
        $('#t2_p').html("?");
    }
}

function showScores() {
    return data.currentGame.board.getData().current.noPuts >= 104 && data.currentGame.board.getData().current.noPuts <= 260;
}

function vibrate(pattern) {
    try {
        window.navigator.vibrate(pattern);
    } catch (e) {
        // do nothing
    }
}

function renderStartGame() {
    $("#rollbtn").prop('disabled', true);
    $("#playbtn").prop('disabled', true);
    $("#top-bar").html(`starting game`);

    const columns = data.currentGame.board.getColumns();
    const cells = data.currentGame.board.getCells();
    for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];
            for (let p = 0; p < 4; p++) {
                const val = data.currentGame.board.getData().values[column][cell][p];
                const playerTag = data.currentGame.tags[p];
                const element = $(`#${column}_${cell}_${playerTag}`);
                $("body").off("click", `#${column}_${cell}_${playerTag}`);
                element.removeClass('temp');
                element.removeClass('available');
                if (val !== null) {
                    element.html(scoreVal(val));
                    element.addClass('available');
                } else if (data.currentGame.board.canPutPlayer(column, cell, p)) {
                    element.addClass('available');
                }
            }
        }
    }
    // clear dices
    if (data.currentGame.board.getData().current.noRolls === 0) {
        for (let i = 0; i < 5; i++) {
            $(`#dice-${i}`).html('#');
        }
    }
    for (let p = 0; p < 4; p++) {
        const playerTag = data.currentGame.tags[p];
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const ltElement = $(`#${column}_lt_${playerTag}`);
            ltElement.html(data.currentGame.board.getPlayerUpperColumnScore(column, p));
            const ttElement = $(`#${column}_tt_${playerTag}`);
            ttElement.html(data.currentGame.board.getScoreWithBonus(data.currentGame.board.getPlayerColumnScore(column, p)));
            const ptsElement = $(`#${column}_pts_${playerTag}`);
            let finalScore = data.currentGame.board.getPlayerFinalColumnScore(column, p);
            if (playerTag !== 'p') finalScore = prettyPoints(finalScore);
            ptsElement.html(finalScore);
        }
        $(`#result_${playerTag}`).html(data.currentGame.board.getPlayerFinalScore(p));
    }
    const t1Names = `<span class='player ${data.currentGame.tags[0]}'>${data.currentGame.players[0].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[2]}'>${data.currentGame.players[2].name}</span>`;
    const t2Names = `<span class='player ${data.currentGame.tags[1]}'>${data.currentGame.players[1].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[3]}'>${data.currentGame.players[3].name}</span>`;
    $('#t1_t').html(t1Names);
    $('#t2_t').html(t2Names);
    $('#t1_p').html(data.currentGame.board.getTeamFinalScore(1));
    $('#t2_p').html(data.currentGame.board.getTeamFinalScore(2));
}

function renderEndGame() {
    const columns = data.currentGame.board.getColumns();
    const cells = data.currentGame.board.getCells();
    data.currentGame.hold = [false, false, false, false, false];
    for (let i = 0; i < 5; i++) {
        $("body").off("click", `#dice-${i}`);
        drawHold(i);
    }
    $("#rollbtn").prop('disabled', true);
    $("#playbtn").prop('disabled', true);
    // clear dices
    if (data.currentGame.board.getData().current.noRolls === 0) {
        for (let i = 0; i < 5; i++) {
            $(`#dice-${i}`).html('#');
        }
    }
    for (let p = 0; p < 4; p++) {
        const playerTag = data.currentGame.tags[p];
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const ltElement = $(`#${column}_lt_${playerTag}`);
            ltElement.html(data.currentGame.board.getPlayerUpperColumnScore(column, p));
            const ttElement = $(`#${column}_tt_${playerTag}`);
            ttElement.html(data.currentGame.board.getScoreWithBonus(data.currentGame.board.getPlayerColumnScore(column, p)));
            const ptsElement = $(`#${column}_pts_${playerTag}`);
            let finalScore = data.currentGame.board.getPlayerFinalColumnScore(column, p);
            if (playerTag !== 'p') finalScore = prettyPoints(finalScore);
            ptsElement.html(finalScore);
        }
        $(`#result_${playerTag}`).html(data.currentGame.board.getPlayerFinalScore(p));
    }
    for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];

            // cleanup temp values
            for (let p = 0; p < 4; p++) {
                const val = data.currentGame.board.getData().values[column][cell][p];
                const playerTag = data.currentGame.tags[p];
                const element = $(`#${column}_${cell}_${playerTag}`);
                $("body").off("click", `#${column}_${cell}_${playerTag}`);
                element.html(scoreVal(val));
                element.addClass('available');
                element.removeClass('temp');
            }
        }
    }
    const t1Score = data.currentGame.board.getTeamFinalScore(1);
    const t2Score = data.currentGame.board.getTeamFinalScore(2);
    const t1Names = `<span class='player ${data.currentGame.tags[0]}'>${data.currentGame.players[0].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[2]}'>${data.currentGame.players[2].name}</span>`;
    const t2Names = `<span class='player ${data.currentGame.tags[1]}'>${data.currentGame.players[1].name}</span>&nbsp;&&nbsp;<span class='player ${data.currentGame.tags[3]}'>${data.currentGame.players[3].name}</span>`;
    $('#t1_t').html(t1Names);
    $('#t2_t').html(t2Names);
    $('#t1_p').html(t1Score);
    $('#t2_p').html(t2Score);
    let result = 'draw';
    if (movesLeft()) result = 'calculating winner';
    else if (t1Score > t2Score) result = `${t1Names}&nbsp;won`;
    else if (t1Score < t2Score) result = `${t2Names}&nbsp;won`;
    $("#top-bar").removeClass('p');
    $("#top-bar").removeClass('tm');
    $("#top-bar").removeClass('op1');
    $("#top-bar").removeClass('op2');
    $(".dice").removeClass('p');
    $(".dice").removeClass('tm');
    $(".dice").removeClass('op1');
    $(".dice").removeClass('op2');
    $(".dice").addClass('p');
    $("#top-bar").html(`game ended -&nbsp;${result}`);
    const winnerFinal = ['W', '1', '1', '1', 'N'];
    const loserFinal = ['L', '0', '5', '3', 'R'];
    const drawFinal = ['D', '2', '4', 'W', '?'];
    let final = drawFinal;
    let pOrder = playerOrder();
    if (pOrder < 0) pOrder = 0;
    if (t1Score > t2Score) {
        if (pOrder === 0 || pOrder === 2) {
            final = winnerFinal;
            playWinAudio();
        }
        else {
            final = loserFinal;
            playLoseAudio();
        }
    } else if (t2Score > t1Score) {
        if (pOrder === 0 || pOrder === 2) {
            final = loserFinal;
            playLoseAudio();
        }
        else{
             final = winnerFinal;
             playWinAudio();
            }
    }
    for (let i = 0; i < 5; i++) animateDice(i, final[i], 10000);
    $('.action-buttons').hide();
}

function scoreVal(score) {
    return score === 0 ? "/" : score;
}

function prettyPoints(val) {
    return `${parseInt(Math.round(val/1000))}k`;
}

function toggleSelect(column, cell) {
    const player = data.currentGame.board.getData().current.player;
    const playerTag = data.currentGame.tags[player];
    if (hasSelected()) {
        const prevElement = $(`#${data.currentGame.selected.column}_${data.currentGame.selected.cell}_${playerTag}`);
        prevElement.removeClass('selected');
    }
    const element = $(`#${column}_${cell}_${playerTag}`);
    element.addClass('selected');
    data.currentGame.selected = { column: column, cell: cell };
    $("#playbtn").prop('disabled', false);
}

function hasSelected() {
    return data.currentGame.selected !== undefined && data.currentGame.selected.column !== null && data.currentGame.selected.cell !== null;
}

function getScoreFromScores(column, cell, scores) {
    for (let i = 0; i < scores.length; i++) {
        const score = scores[i];
        if (score.column === column && score.cell === cell) return score.score;
    }
    return '-';
}

function mainRenderer() {
    const next = nextMove();
    let nextWait = 10;
    if (next !== undefined) {
        data.currentGame.lastMove = next.order;
        const mleft = movesLeft();
        let animate = false;
        if (mleft == 0) {
            animate = true;
        }
        nextWait = renderMove(next, animate);
    }
    setTimeout(mainRenderer, nextWait);
}

function nextMove() {
    const wantedMove = data.currentGame.lastMove + 1;
    return data.currentGame.indexedMoves[wantedMove];
}

function movesLeft() {
    const currentMove = data.currentGame.lastMove;
    return data.currentGame.maxMove - currentMove;
}

function isYams(dice) {
    for (let i = 0; i<dice.length-1; i++){
       if(dice[i] !== dice[i+1]){
           return false;
       }
   }
   return true;
}

function renderMove(move, animate) {
    if (move.data.type === 'put') {
        const tag = data.currentGame.tags[move.player];
        data.currentGame.board.recordPut(move.data.column, move.data.cell);
        const element = $(`#${move.data.column}_${move.data.cell}_${tag}`);
        element.html(data.currentGame.board.getData().values[move.data.column][move.data.cell][move.player]);
        data.currentGame.hold = [false, false, false, false, false];
        data.currentGame.selected = undefined;
        // animate
        if (animate) {
            playPlayAudio();
            const indicators = $(`.${tag}-${move.data.cell}, .${tag}-${move.data.column}`);
            indicators.addClass('indicator-selected');
            indicators.animate({
                opacity: '1',
            }, 700).promise().then(() => {
                indicators.removeClass('indicator-selected');
                element.addClass('cell-selected');
                data.currentGame.selectedCells[move.player] = move.data;
                element.animate({
                    opacity: '1',
                }, 300).promise().then(() => {
                    if (tag === 'p') {
                        setTimeout(() => element.removeClass('cell-selected'), 1000);
                    }
                    renderTurnData();
                });
            });
            return 1050;
        } else {
            renderTurnData();
            return 10;
        }
    } else if (move.data.type === 'roll') {
        data.currentGame.board.recordRoll(move.data.dice);
        if (movesLeft() > 10) return 10;
        data.currentGame.hold = move.data.hold;
        for (let i = 0; i < move.data.dice.length; i++) {
            if (animate && !move.data.hold[i]) {
                animateDice(i, move.data.dice[i], 600 - (4 - i) * 50);
            } else {
                $(`#dice-${i}`).html(move.data.dice[i]);
            }
        }
        if (animate) {
            if(isYams(move.data.dice)) setTimeout(playYamsAudio, 610);
            playDiceAudio(); 
            setTimeout(renderTurnData, 610);
        } else {
            renderTurnData();
        }
        return animate ? 650 : 10;
    }
}

function animateDice(idx, final, left) {
    if (left <= 0) {
        $(`#dice-${idx}`).html(final);
    } else {
        $(`#dice-${idx}`).html(randomDice());
        const wait = Math.min(left, 70);
        const newLeft = left - wait;
        setTimeout(() => animateDice(idx, final, newLeft), wait);
    }
}

function randomDice() {
    return parseInt(1 + Math.random() * 6);
}

function toggleHold(id) {
    data.currentGame.hold[id] = !data.currentGame.hold[id];
    socket.emit('hold_selection', data.currentGame.game._id, data.currentGame.board.getData().current.move, id, data.currentGame.hold[id]);
    drawHold(id);
}

function drawHold(id) {
    if (data.currentGame.hold === undefined) return;
    if (data.currentGame.hold[id]) {
        $(`#dice-${id}`).addClass('hold');
    } else {
        $(`#dice-${id}`).removeClass('hold');
    }
}

function setNextMoveTimer(start, end, ms) {
    if (data.currentGame.nextMoveTimer !== null) cancelNextMoveTimer();
    data.currentGame.nextMoveTimer = setTimeout(() => forceLoadMoves(start, end), ms);
}

function cancelNextMoveTimer() {
    clearTimeout(data.currentGame.nextMoveTimer);
    data.currentGame.nextMoveTimer = null;
}

function forceLoadMoves(start, end) {
    get(`/api/v1/game/${data.currentGame.game._id}/moves/${start}/${end}`).then(response => response.json()).then(result => {
        if (result.moves === undefined) return;
        for (let i = 0; i < result.moves.length; i++) {
            registerMove(result.moves[i]);
        }
    });
}

function roll() {
    $("#rollbtn").prop('disabled', true);
    $("#playbtn").prop('disabled', true);
    for (let i = 0; i < 5; i++) {
        $("body").off("click", `#dice-${i}`);
    }
    vibrate(50);
    post(`/api/v1/game/${data.currentGame.game._id}/move`, {
        move: {
            type: 'roll',
            hold: data.currentGame.hold,
            order: data.currentGame.board.getData().current.move,
        },
    }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
        setNextMoveTimer(data.currentGame.board.getData().current.move, data.currentGame.board.getData().current.move, 3000);
    }));
}

function play() {
    if (!hasSelected()) return;
    $("#rollbtn").prop('disabled', true);
    $("#playbtn").prop('disabled', true);
    const player = data.currentGame.board.getData().current.player;
    const playerTag = data.currentGame.tags[player];
    const prevElement = $(`#${data.currentGame.selected.column}_${data.currentGame.selected.cell}_${playerTag}`);
    prevElement.removeClass('selected');
    post(`/api/v1/game/${data.currentGame.game._id}/move`, {
        move: {
            type: 'put',
            column: data.currentGame.selected.column,
            cell: data.currentGame.selected.cell,
            order: data.currentGame.board.getData().current.move,
        },
    }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
        setNextMoveTimer(data.currentGame.board.getData().current.move, data.currentGame.board.getData().current.move, 3000);
    }));
}

function playerOrder() {
    for (let i = 0; i < data.currentGame.players.length; i++) {
        const player = data.currentGame.players[i];
        if (player.yourself) {
            return player.order - 1;
        }
    }
    return -1;
}

function currentPlayer() {
    for (let i = 0; i < data.currentGame.players.length; i++) {
        const player = data.currentGame.players[i];
        if (player.order == data.currentGame.board.getData().current.player + 1) {
            return player
        }
    }
    return null;
}

function nextPlayer() {
    const nextOrder = ((data.currentGame.board.getData().current.player + 1) % 4) + 1;
    for (let i = 0; i < data.currentGame.players.length; i++) {
        const player = data.currentGame.players[i];
        if (player.order == nextOrder) {
            return player
        }
    }
    return null;
}

function buildHeader(ranks) {
    return `<div class="row flex-fill">
                <div class="col game-title"></div>
                <div class="col game-header">down</div>
                <div class="col game-header">free</div>
                <div class="col game-header">up</div>
                <div class="col game-header">mid</div>
                <div class="col game-header">2 rolls</div>
                <div class="col game-header">up & down</div>
            </div>
            <div class="row flex-fill row-coef">
                <div class="col game-coef-title"></div>
                <div class="col game-coef">${ranks[0]}</div>
                <div class="col game-coef">${ranks[1]}</div>
                <div class="col game-coef">${ranks[2]}</div>
                <div class="col game-coef">${ranks[3]}</div>
                <div class="col game-coef">${ranks[4]}</div>
                <div class="col game-coef">${ranks[5]}</div>
            </div>`;
}

function buildFooter() {
    return `<div class="row flex-fill">
                <div class="col game-title"></div>
                <div class="col flex-column d-flex game-footer">
                    <div class="row flex-fill others">
                        <div class="col op1-cell" id="result_op1">&nbsp;</div>
                        <div class="col tm-cell" id="result_tm">&nbsp;</div>
                        <div class="col op2-cell" id="result_op2">&nbsp;</div>
                    </div>
                    <div class="col p-cell" id="result_p">&nbsp;</div>
                </div>
                <div class="col flex-column d-flex game-footer">
                    <div class="row flex-fill total-row">
                        <div class="col" id="t1_t">Team 1</div>
                        <div class="col" id="t1_p">&nbsp;</div>
                    </div>
                    <div class="row flex-fill total-row">
                        <div class="col" id="t2_t">Team 2</div>
                        <div class="col" id="t2_p">&nbsp;</div>
                    </div>
                </div>
            </div>`;
}

function buildRow(title, cell) {
    return `<div class="row flex-fill row-${cell}">
                <div class="col game-title title-${cell}">${title}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('down', cell)}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('free', cell)}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('up', cell)}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('mid', cell)}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('x2', cell)}</div>
                <div class="col game-cell flex-column d-flex">${buildCell('updown', cell)}</div>
            </div>`;
}

function buildCell(column, cell) {
    return `<div class="row flex-fill overall-${cell} others">
                <div class="col op1-cell op1-${cell} op1-${column}" id="${column}_${cell}_op1">&nbsp;</div>
                <div class="col tm-cell tm-${cell} tm-${column}" id="${column}_${cell}_tm">&nbsp;</div>
                <div class="col op2-cell op2-${cell} op2-${column}" id="${column}_${cell}_op2">&nbsp;</div>
            </div>
            <div class="flex-fill p-cell p-${cell} p-${column}" id="${column}_${cell}_p">&nbsp;</div>`;
}

function showSettingsPage() {
    let name = localStorage.name || "";
    $("#settings input").val(name);
    showPage('settings');
}

function showHomePage() {
    showLoadingPage();
    get('/api/v1/game/').then(response => {
        response.json().then(result => {
            data.games = result.games;
            showGames();
            showPage('home');
        });
    });
}

function updateName(value) {
    localStorage.name = value;
    showHomePage();
}

function createGame() {
    showLoadingPage();
    post('/api/v1/game/', { name: localStorage.name }).then(response => {
        response.json().then(result => {
            loadGame(result.id);
        });
    });
}

function showGames() {
    let htmlWaiting = "";
    let htmlStarted = "";
    let htmlEnded = "";
    let endedCount = 0;
    for (const idx in data.games) {
        let game = data.games[idx];
        if (game.name === undefined) game.name = game._id;
        if (game.status === 'waiting') htmlWaiting += `<div class='row game-button'><button type="button" class="btn btn-primary" onclick='loadGame("${game._id}")'>join ${game.name}'s game</button></div>`;
        else if (game.status === 'started') htmlStarted += `<div class='row game-button'><button type="button" class="btn btn-warning" onclick='loadGame("${game._id}")'>join ${game.name}</button></div>`;
        else if (game.status === 'ended') {
            endedCount++;
            htmlEnded += `<div class='row game-button'><button type="button" class="btn btn-danger" onclick='loadGame("${game._id}")'>see ${endedCount}.${game.name}</button></div>`;
        }
    }
    $("#rooms-waiting").html(`<div class='title'>Games waiting to start</div>${htmlWaiting || '-'}`);
    $("#rooms-started").html(`<div class='title'>Games in progress</div>${htmlStarted || '-'}`);
    $("#rooms-ended").html(`<div class='title'>Finished games</div>${htmlEnded || '-'}`);
}

function loadGame(id) {
    showLoadingPage();
    get(`/api/v1/game/${id}/${localStorage.secret}`).then(response => response.json().then(result => {
        data.currentGame = result;
        data.currentGame.nextMoveTimer = null;
        for (const idx in data.currentGame.players) {
            const player = data.currentGame.players[idx];
            if (player.yourself) data.currentGame.myId = player._id;
        }
        let maxMove = 0;
        data.currentGame.indexedMoves = [];
        for (let i = 0; i < data.currentGame.moves.length; i++) {
            const move = data.currentGame.moves[i];
            maxMove = Math.max(maxMove, move.order);
            data.currentGame.indexedMoves[move.order] = move;
        }
        data.currentGame.selectedCells = [null, null, null, null];
        data.currentGame.indexedPlayers = [];
        data.currentGame.players.sort((p1, p2) => [p1.order - p2.order]);
        data.currentGame.maxMove = maxMove;
        socket.emit('join_game', id, localStorage.name);

        if (result.game.status === 'waiting') {
            buildLobby();
        } else if (result.game.status === 'started' || result.game.status === 'ended') {
            buildGame();
        }
    }));
}

function buildLobby() {
    showLoadingPage();
    let team1Html = "";
    let team2Html = "";
    const isCreator = data.currentGame.isCreator;
    let myTeam = 0;
    const teamCount = [0,0,0];
    for (const idx in data.currentGame.players) {
        const player = data.currentGame.players[idx];
        teamCount[player.team]++;
        if (player.yourself) myTeam = player.team;
        let html = "<div class='row'>";
        html += player.name;
        if (isCreator && !player.yourself) html += `<button type="button" class="btn btn-warning" onclick="kickPlayer('${player._id}')">kick out</button>`;
        html += "</div>";
        if (player.team === 1) team1Html += html;
        else team2Html += html;
    }
    $("#team1").html(team1Html);
    $("#team2").html(team2Html);
    if (isCreator && teamCount[1] === 2 && teamCount[2] === 2) $("#startgame").show();
    else $("#startgame").hide();
    if (myTeam === 0) {
        $("#jointeam1").show();
        $("#jointeam2").show();
        $("#leaveteam1").hide();
        $("#leaveteam2").hide();
    } else {
        $("#jointeam1").hide();
        $("#jointeam2").hide();
        if (myTeam === 1 && !isCreator) $("#leaveteam1").show();
        else $("#leaveteam1").hide();
        if (myTeam === 2 && !isCreator) $("#leaveteam2").show();
        else $("#leaveteam2").hide();
    }
    showPage('lobby');
}

function kickPlayer(id) {
    put(`/api/v1/game/${data.currentGame.game._id}/kick/${id}`, { }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
    }));
}

function joinGame(team) {
    put(`/api/v1/game/${data.currentGame.game._id}/join`, { team: team, name: localStorage.name }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
        data.currentGame.myId = result.id;
        markYourself();
        buildLobby();
    }));
}

function leaveGame() {
    let playerId = "";
    for (const idx in data.currentGame.players) {
        const player = data.currentGame.players[idx];
        if (player.yourself) playerId = player._id;
    }
    put(`/api/v1/game/${data.currentGame.game._id}/leave`, { id: playerId }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
    }));
}

function startGame() {
    put(`/api/v1/game/${data.currentGame.game._id}/start`, { }).then(response => response.json().then(result => {
        if (result.code !== "ok") alert('something went wrong');
    }));
}

function markYourself() {
    for (const idx in data.currentGame.players) {
        const player = data.currentGame.players[idx];
        if (player._id == data.currentGame.myId) player.yourself = true;
    }
}

function get(url) {
    return fetch(url);
}

function post(url, data) {
    data.secret = localStorage.secret;
    return fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

function put(url, data) {
    data.secret = localStorage.secret;
    return fetch(url, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

function showLoadingPage() {
    showPage('loading');
}

function showPage(id) {
    $('.page').hide();
    $(`#${id}.page`).show();
}

window.addEventListener('load', init, false);