'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ErrorSchema = new Schema({
    player: String,
    browser: String,
    date: Date,
    data: Schema.Types.Mixed,
});

module.exports = mongoose.model('error', ErrorSchema);