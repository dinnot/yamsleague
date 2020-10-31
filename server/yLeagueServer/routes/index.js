'use strict';
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
    res.send('homepage');
});

router.get('/javascripts/board.js', function (req, res) {
    const file = `${__dirname}/../models/board.js`;
    res.download(file); // Set disposition and send it.
});

router.get('/javascripts/board1v1.js', function (req, res) {
    const file = `${__dirname}/../models/board1v1.js`;
    res.download(file); // Set disposition and send it.
});

module.exports = router;
