'use strict';
const debug = require('debug');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const routes = require('./routes/index');
const game = require('./routes/game');
const game1v1 = require('./routes/game1v1');

const app = express();

//Set up mongoose connection
const mongoose = require('mongoose');
const mongoDB = 'mongodb://127.0.0.1:27017/yleague';
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/api/v1/game', game);
app.use('/api/v1/game1v1', game1v1);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 3000);

const server = app.listen(app.get('port'), function () {
    debug('Express server listening on port ' + server.address().port);
});

const io = require('socket.io')(server);
app.set('socketio', io);

io.on('connection', socket => {
    socket.on('join_game', (gameId, name) => {
        socket.join(`game-${gameId}`);
        socket.to(`game-${gameId}`).emit('player_joined', name)
    });
    socket.on('leave_game', (gameId, name) => {
        socket.leave(`game-${gameId}`);
        socket.to(`game-${gameId}`).emit('player_away', name)
    });
    socket.on('hold_selection', (gameId, move, index, held) => {
        socket.to(`game-${gameId}`).emit('hold_selection', move, index, held);
    });
    socket.join('games');
});