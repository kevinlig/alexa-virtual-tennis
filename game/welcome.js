'use strict';
const Alexa = require('alexa-sdk');
const appStates = require('./appStates');
const common = require('./common');

const Simulation = require('./simulation/simulation');

const welcomeHandlers = Alexa.CreateStateHandler(appStates.WELCOME, {
    'SetDifficultyIntent': function() {
        let prompt = 'Would you like to play in easy or hard mode?';
        const reprompt = 'In easy mode, you only need to state the general position of your paddle and its relative speed of movement. In hard mode, you\'ll need to provide precise numerical values. Would you like to play in easy or hard mode?';
        // check if the difficulty mode is provided
        if (common.validateSlot(this.event.request, 'Difficulty')) {
            const slots = this.event.request.intent.slots;
            const difficulty = slots.Difficulty.value;
            if (validateDifficulty(difficulty)) {
                // we have the difficulty level
                if (difficulty === 'easy') {
                    this.handler.state = appStates.EASY;
                }
                else {
                    this.handler.state = appStates.HARD;
                }
                const game = startGame(difficulty);
                const output = game.start();

                // serialize the game state
                const state = game.serialize();
                // save it to the session
                this.attributes['game'] = state;

                this.emit(':ask', output, 'Make your first move.');
                return;
            }
            else {
                prompt = 'Say "easy mode" to play in easy mode or "hard mode" to play in hard mode.';
            }
        }
        this.emit(':ask', prompt, reprompt);
    },
    'AMAZON.HelpIntent': function() {
        const message = 'In easy mode, you only need to state the general position of your paddle. In hard mode, you\'ll need to provide precise numerical values. Would you like to play in easy or hard mode?';
        this.emit(':ask', message, message);
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', 'Goodbye!');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', 'Goodbye!');
    },
    'Unhandled': function() {
        const difficultyGuide = 'Say "easy mode" to play in easy mode or "hard mode" to play in hard mode.';
        this.emit(':ask', difficultyGuide, difficultyGuide);
    }
});


const validateDifficulty = (difficulty) => {
    if (difficulty !== 'hard' && difficulty !== 'easy') {
        // not a valid difficulty
        return false;
    }
    return true;
};

const startGame = (mode) => {
    const game = new Simulation(mode);
    return game;
};

module.exports = welcomeHandlers;