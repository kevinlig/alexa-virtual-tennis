'use strict';
const Alexa = require('alexa-sdk');
const appStates = require('./appStates');
const common = require('./common');

const Simulation = require('./simulation/simulation');

const hardHandlers = Alexa.CreateStateHandler(appStates.HARD, {
    'HardMove': function() {
        if (common.validateSlot(this.event.request, 'Position')) {
            // load the game from attributes
            const game = new Simulation('hard');
            const data = this.attributes.game;
            game.parse(data);

            const maxHeight = data.court.height - data.right.height;
            const position = validatePosition(this.event.request.intent.slots.Position.value, maxHeight);
            if (position) {
                const output = game.validateHard(position);

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
        const message = 'To move your paddle in hard mode, say how many pixels from the top of the screen you would like position your paddle at. This will be the position of the top of your paddle. If the ball hit anywhere along the surface of your paddle, you will successfully serve it back toward the AI.';
        this.emit(':ask', message, message);
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', 'Goodbye! Thanks for playing.');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', 'Goodbye! Thanks for playing.');
    },
    'Unhandled': function() {
        const message = 'To move your paddle in hard mode, say how many pixels from the top of the screen you would like position your paddle at.';
        this.emit(':ask', message, message);
    }
});

const validatePosition = (position, maxHeight) => {
    const parsedValue = parseInt(position, 10);
    if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > maxHeight) {
        // not a valid position
        return false;
    }
    return parsedValue;
};

module.exports = hardHandlers;