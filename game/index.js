'use strict';
const Alexa = require('alexa-sdk');

const appStates = require('./appStates');
const welcomeHandlers = require('./welcome');
const easyHandlers = require('./easy');
const hardHandlers = require('./hard');

const alexaHandler = (event, context, callback) => {
    const alexa = Alexa.handler(event, context);
    alexa.appId = process.env.ALEXA_APP_ID;
    alexa.registerHandlers(commonHandlers, welcomeHandlers, easyHandlers, hardHandlers);
    alexa.execute();
};


const commonHandlers = {
    'NewSession': function() {
        this.handler.state = appStates.WELCOME;
        // check if the uesr is pre-requesting a difficulty level
        if (this.event.request.intent && this.event.request.intent.name === 'SetDifficultyIntent') {
            this.emitWithState('SetDifficultyIntent');
            return;
        }

        const welcome = 'Welcome to Virtual Tennis! Would you like to play in easy or hard mode?';
        this.response.speak(welcome).listen(welcome);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', 'Goodbye!');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', 'Goodbye!');
    }
};

module.exports.alexaHandler = alexaHandler;