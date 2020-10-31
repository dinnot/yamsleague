'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GamePlayerSchema = new Schema({
    game: { type: Schema.Types.ObjectId, ref: 'game' },
    name: String,
    secret: String,
    order: Number,
    status: String,
    team: Number,
});

module.exports = mongoose.model('game_player', GamePlayerSchema);