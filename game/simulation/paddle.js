'use strict';

class Paddle {
    constructor(court, side) {
        this.width = Math.round(court.width * 0.01);
        this.height = Math.round(court.height * 0.05);
        this.x = 0;
        if (side === 'right') {
            this.x = court.width - this.width;
        }
        this.y = (court.width / 2) - (this.height / 2);
    }
}

module.exports = Paddle;
