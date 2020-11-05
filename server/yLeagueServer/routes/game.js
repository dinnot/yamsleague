'use strict';
const express = require('express');
const router = express.Router();
const GameModel = require('../models/game');
const GameMoveModel = require('../models/game_move');
const GamePlayerModel = require('../models/game_player');
const board = require('../models/board');

/** create game */
router.post('/', function (req, res) {
    const io = req.app.get('socketio');
    const game = new GameModel({
        status: 'waiting',
        type: 'friendly',
        creator_secret: req.body.secret,
        name: req.body.name,
    });
    game.save(function (err) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
        const player = new GamePlayerModel({
            game: game._id,
            name: req.body.name,
            secret: req.body.secret,
            status: 'ready',
            team: 1,
        });
        player.save(function (err) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            res.send({
                id: game._id,
                name: game.name,
            });
        });
    });
});

/** get all waiting games */
router.get('/', function (req, res) {
    GameModel.find().where('type').equals('friendly').select('_id status name').exec().then(result => {
        res.send({ games: result });
    }).catch(err => {
        res.send({ error: 'something went wrong :(' });
    });
});

/** get game data */
router.get('/:id/:secret', function (req, res) {
    const io = req.app.get('socketio');
    GameMoveModel.find({ game: req.params.id }).exec(function (err, moves) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
        GamePlayerModel.find({ game: req.params.id }).select('_id name team secret order').exec(function (err, players) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            GameModel.findById(req.params.id).select('status type creator_secret _id ranks').exec(function (err, game) {
                if (err) {
                    res.send({ error: 'something went wrong :(' });
                    return;
                }
                res.send({
                    players: findRequesterInPlayers(players, req.params.secret),
                    moves: moves,
                    game: {
                        status: game.status,
                        type: game.type,
                        _id: game._id,
                        ranks: game.ranks,
                    },
                    isCreator: req.params.secret == game.creator_secret,
                });
            });
        });
    });
});

function findRequesterInPlayers(players, secret) {
    let playersData = [];
    for (const idx in players) {
        const player = players[idx];
        const isRequester = secret === player.secret;
        playersData.push({
            _id: player._id,
            name: player.name,
            team: player.team,
            order: player.order,
            yourself: isRequester,
        });
    }
    return playersData;
}

/** start game */
router.put('/:id/start', function (req, res) {
    const io = req.app.get('socketio');
    GameModel.findById(req.params.id).exec(function (err, game) {
        if (err) {
            res.send({ code: 'game_not_found' });
            return;
        }
        // check creator
        if (game.creator_secret !== req.body.secret) {
            res.send({ error: 'nope1' });
            return;
        }
        // check game status
        if (game.status !== 'waiting') {
            res.send({ error: 'nope2' });
            return;
        }
        // change status to starting
        game.status = 'starting';
        game.save(function (err) {
            if (err) {
                res.send({ code: 'game_not_found' });
                return;
            }
            // check players
            GamePlayerModel.find({ game: game._id }).select("_id name team order secret").exec(function (err, players) {
                if (err) {
                    res.send({ error: 'something went wrong :(' });
                    return;
                }
                if (!playersReady(players)) {
                    game.status = 'waiting';
                    game.save(function (err) {
                        if (err) {
                            res.send({ error: 'something went wrong :(' });
                            return;
                        }
                        res.send({ code: 'players_not_ready' });
                        return;
                    });
                    return;
                }
                // change status to started
                game.status = 'started';
                game.save(function (err) {
                    if (err) {
                        res.send({ error: 'something went wrong :(' });
                        return;
                    }
                    // build players order
                    shuffle(players, false);
                    players[0].order = 1;
                    if (players[1].team == players[0].team) {
                        players[1].order = 3;
                        players[2].order = 2;
                        players[3].order = 4;
                    } else {
                        players[1].order = 2;
                        if (players[2].team == players[0].team) {
                            players[2].order = 3;
                            players[3].order = 4;
                        } else {
                            players[2].order = 4;
                            players[3].order = 3;
                        }
                    }

                    Promise.all([players[0].save(), players[1].save(), players[2].save(), players[3].save()]).then(results => {
                        // build game board, next_move, next_turn_secret
                        game.next_move = 1;
                        game.next_turn_secret = players[0].secret;
                        game.ranks = buildRanks();
                        game.name = `${getPlayerNameByOrder(players,1)} & ${getPlayerNameByOrder(players,3)} vs ${getPlayerNameByOrder(players,2)} & ${getPlayerNameByOrder(players,4)}`;
                        const gameBoard = new board();
                        gameBoard.setRanks(game.ranks);
                        game.board = gameBoard.getData();
                        for (let i = 0; i < 4; i++) players[i].secret = undefined;

                        game.save(function (err) {
                            if (err) {
                                res.send({ error: 'something went wrong :(' });
                                return;
                            }
                            io.to(`game-${game._id}`).emit('ranks_set', game.ranks);
                            io.to(`game-${game._id}`).emit('players_changed', players);
                            io.emit('game_status_changed', game._id, game.status);
                            res.send({ code: 'ok' });
                        });
                    }).catch(err => {
                        res.send({ error: 'something went wrong :(' });
                    });
                });
            });

        });
    });

});

function getPlayerNameByOrder(players,wantedOrder){
    for (const player in players){
        if(players[player].order === wantedOrder) return players[player].name;
    }
}

function shuffleArray(array) {
    let rnd = {};
    for (let i = 0; i < array.length; i++) {
        rnd[array[i]] = Math.random();
    }
    array.sort((a, b) => rnd[a] - rnd[b]);
    return array;
}

function shuffle(array, shouldCopy) {
    if (shouldCopy) return shuffleArray(Array.from(array));
    else return shuffleArray(array);
}

function buildRanks() {
    const ranks = [];
    while (ranks.length < 5) {
        const val = randomDice() * 2 + 6;
        if (ranks.indexOf(val) < 0) ranks.push(val);
    }
    for (let i = 8; i <= 18; i += 2) {
        if (ranks.indexOf(i) < 0) ranks.push(i);
    }
    return ranks;
}

function playersReady(players) {
    if (players.length !== 4) return false;
    let team1 = 0;
    let team2 = 0;
    for (const idx in players) {
        let player = players[idx];
        if (player.team === 1) team1++;
        else team2++;
    }
    return team1 === team2;
}

/** join game */
router.put('/:id/join', function (req, res) {
    const io = req.app.get('socketio');
    GameModel.findById(req.params.id).exec((err, game) => {
        if (err) {
            res.send({ code: 'game_not_found' });
            return;
        }
        if (game.status !== 'waiting') {
            res.send({ code: 'game_already_started' });
            return;
        }
        const player = new GamePlayerModel({
            game: game._id,
            name: req.body.name,
            secret: req.body.secret,
            status: 'ready',
            team: req.body.team,
        });
        player.save(function (err) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            GamePlayerModel.find({ game: game._id }).select('_id name team order').exec(function (err, players) {
                if (err) {
                    res.send({ error: 'something went wrong :(' });
                    return;
                }
                io.to(`game-${game._id}`).emit('players_changed', players);
                res.send({ code: 'ok', id: player._id });
            });
        });
    });
});

/** leave game */
router.put('/:id/leave', function (req, res) {
    const io = req.app.get('socketio');
    GamePlayerModel.findOneAndDelete({ game: req.params.id, secret: req.body.secret, _id: req.body.id }).exec(function (err) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
        GamePlayerModel.find({ game: req.params.id }).select('_id name team order').exec(function (err, players) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            io.to(`game-${req.params.id}`).emit('players_changed', players);
            res.send({ code: 'ok' });
        });
    });
});

/** kick player */
router.put('/:id/kick/:player', function (req, res) {
    const io = req.app.get('socketio');
    GameModel.findById(req.params.id).exec(function (err, game) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
        if (game.creator_secret !== req.body.secret) {
            res.send({ error: 'nope' });
            return;
        }
        GamePlayerModel.findOneAndDelete({ game: req.params.id, _id: req.params.player }).exec(function (err) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            GamePlayerModel.find({ game: game._id }).select('_id name team order').exec(function (err, players) {
                if (err) {
                    res.send({ error: 'something went wrong :(' });
                    return;
                }
                io.to(`game-${game._id}`).emit('players_changed', players);
                res.send({ code: 'ok' });
            });
        });
    });
});

router.get('/:id/moves/:start/:end', function (req, res) {
    GameMoveModel.find({ $and: [{ order: { $gte: req.params.start } }, { order: { $lte: req.params.end } }, { game: req.params.id }] }).then(moves => {
        res.send({ moves: moves });
    }).catch(err => {
        res.send({ error: 'something went wrong :(' });
    });
});

/** make move */
router.post('/:id/move', function (req, res) {
    const io = req.app.get('socketio');
    GameModel.findById(req.params.id).exec(function (err, game) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
        if (game.next_turn_secret !== req.body.secret) {
            res.send({ error: 'nope' });
            return;
        }
        if (game.next_move !== req.body.move.order) {
            res.send({ error: 'nope' });
            return;
        }
        const gameBoard = new board(game.board);
        const boardPlayer = gameBoard.getData().current.player;
        let moveData = {};
        // check move on board
        if (req.body.move.type === 'roll') {
            if (!gameBoard.canRoll()) {
                res.send({ error: 'nope' });
                return;
            }
            let hold = [false, false, false, false, false];
            let dice = [0, 0, 0, 0, 0];
            if (gameBoard.getData().current.noRolls !== 0) {
                hold = req.body.move.hold;
                dice = gameBoard.getData().current.dice;
            }
            const roll = rollDice(dice, hold);
            req.body.move.roll = roll;
            gameBoard.recordRoll(roll);
            gameBoard.setHold(hold);
            moveData = {
                dice: roll,
                hold: hold,
                type: 'roll',
            };
        } else if (req.body.move.type === 'put') {
            if (!gameBoard.canPut(req.body.move.column, req.body.move.cell)) {
                res.send({ error: 'nope' });
                return;
            }
            gameBoard.recordPut(req.body.move.column, req.body.move.cell);
            moveData = req.body.move;
        }
        // save move in db
        let move = new GameMoveModel({
            game: game._id,
            order: req.body.move.order,
            data: moveData,
            player: boardPlayer,
        });
        move.save(function (err) {
            if (err) {
                res.send({ error: 'something went wrong :(' });
                return;
            }
            const nextPlayer = gameBoard.getData().current.player + 1;
            GamePlayerModel.findOne({ game: game._id, order: nextPlayer }).exec(function (err, nextPlayerData) {
                if (err) {
                    res.send({ error: 'something went wrong :(' });
                    return;
                }
                // change game next_move next_turn_secret board
                game.next_move = game.next_move + 1;
                game.next_turn_secret = nextPlayerData.secret;
                game.board = gameBoard.getData();
                game.markModified('board');
                game.save(function (err) {
                    if (err) {
                        res.send({ error: 'something went wrong :(' });
                        return;
                    }
                    // send move to players
                    io.to(`game-${game._id}`).emit('move', move);
                    // check end game
                    if (gameBoard.isDone()) {
                        game.status = 'ended';
                        game.save(function (err) {
                            if (err) {
                                res.send({ error: 'something went wrong :(' });
                                return;
                            }
                            io.emit('game_status_changed', game._id, game.status);
                            res.send({ code: 'ok' });
                        });
                    } else {
                        res.send({ code: 'ok' });
                    }
                });
            });
        });
    });
});

function rollDice(dice, hold) {
    let result = [];
    for (let i = 0; i < 5; i++) {
        if (hold[i]) result[i] = dice[i];
        else result[i] = randomDice();
    }
    return result;
}

function randomDice() {
    return parseInt(1 + Math.random() * 6);
}

module.exports = router;
