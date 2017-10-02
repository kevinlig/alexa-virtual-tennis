'use strict';
const Alexa = require('alexa-sdk');
const appStates = require('./appStates');
const common = require('./common');

const Simulation = require('./simulation/simulation');

const easyHandlers = Alexa.CreateStateHandler(appStates.EASY, {
    'EasyMove': function() {
        if (common.validateSlot(this.event.request, 'Direction')) {
            const movement = validateMovement(this.event.request.intent.slots.Direction.value);
            if (movement) {
                // load the game from attributes
                const game = new Simulation('easy');
                const data = this.attributes.game;
                game.parse(data);
                const output = game.validateEasy(movement);

                if (game.scores.ai === common.winningScore || game.scores.player === common.winningScore) {
                    // game is over
                    this.emit(':tell', output);
                    return;
                }

                // serialize the game state
                const state = game.serialize();
                // save it to the session
                this.attributes['game'] = state;

                this.emit(':ask', output, 'Make your next move.');
                return;
            }
        }
        const prompt = 'Where would you like to move your paddle?';
        this.emit(':ask', prompt, prompt);

    },
    'AMAZON.HelpIntent': function() {
        const message = 'To move your paddle in easy mode, say "move to the top", "move to the middle", or "move to the bottom". If the ball reaches that general area, your paddle will automatically hit it back toward the AI player.';
        this.emit(':ask', message, message);
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', 'Goodbye! Thanks for playing.');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', 'Goodbye! Thanks for playing.');
    },
    'Unhandled': function() {
        const message = 'To move your paddle in easy mode, say "move to the top", "move to the middle", or "move to the bottom".';
        this.emit(':ask', message, message);
    }
});

const validateMovement = (movement) => {
    if (movement === 'center') {
        return 'middle';
    }
    else if (movement !== 'top' && movement !== 'middle' && movement !== 'bottom') {
        // not a valid movement
        return false;
    }
    return movement;
};

module.exports = easyHandlers;