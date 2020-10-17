'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameMoveSchema = new Schema({
    game: { type: Schema.Types.ObjectId, ref: 'game' },
    type: String,
    order: Number,
    data: Schema.Types.Mixed,
    player: String,
    auto_generated: Boolean,
});

module.exports = mongoose.model('game_move', GameMoveSchema);