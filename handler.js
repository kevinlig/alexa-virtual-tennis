'use strict';

const Game = require('./game/index');

module.exports.game = (event, context, callback) => Game.alexaHandler(event, context, callback);
