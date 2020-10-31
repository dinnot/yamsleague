'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameMoveSchema = new Schema({
    game: { type: Schema.Types.ObjectId, ref: 'game' },
    order: Number,
    data: Schema.Types.Mixed,
    player: Number,
});

module.exports = mongoose.model('game_move', GameMoveSchema);