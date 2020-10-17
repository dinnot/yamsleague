'use strict';
const express = require('express');
const router = express.Router();
const GameModel = require('../models/game');
const GameMoveModel = require('../models/game_move');
const GamePlayerModel = require('../models/game_player');

/** create game */
router.post('/', function (req, res) {

});

/** get game metadata */
router.get('/:id/metadata', function (req, res) {

});

/** get game events */
router.get('/:id/events', function (req, res) {

});

/** start game */
router.put('/:id/start', function (req, res) {

});

/** make move */
router.post('/:id/move', function (req, res) {

});

/** join game */
router.put('/:id/join', function (req, res) {

});

/** leave game */
router.put('/:id/leave', function (req, res) {

});

/** kick player */
router.put('/:id/kick/:player', function (req, res) {

});


module.exports = router;
