'use strict';

const validateSlot = (request, slot) => {
    if (request.intent && request.intent.slots && request.intent.slots[slot]
        && request.intent.slots[slot].value) {
        return true;
    }
    return false;
};

const winningScore = 6;

module.exports = {
    validateSlot: validateSlot,
    winningScore: winningScore
};
