'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameSchema = new Schema({
    status: String,
    type: String,
    creator_secret: String,
    next_turn_secret: String,
    next_move: Number,
    board: Schema.Types.Mixed,
    name: String,
    ranks: [],
});

module.exports = mongoose.model('game', GameSchema);