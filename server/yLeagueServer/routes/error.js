'use strict';
const express = require('express');
const router = express.Router();
const ErrorModel = require('../models/error');

/** log error */
router.post('/', function (req, res) {
    const err = new ErrorModel({
        date: new Date(),
        browser: req.body.browser,
        data: req.body.data,
        player: req.body.player,
    });
    err.save(function (err) {
        if (err) {
            res.send({ error: 'something went wrong :(' });
            return;
        }
    });
});

module.exports = router;
