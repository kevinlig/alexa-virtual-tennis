'use strict';

class Ball {
    constructor(court) {
        this.width = Math.round(court.width * 0.01);
        this.height = this.width;

        this.court = court;

        this.x = Math.round(court.width / 2) - Math.round(this.width / 2);
        this.y = Math.round(court.height / 2) - Math.round(this.height / 2);

        this.hSpeed = 0;
        this.vSpeed = 0;
    }

    resetPosition() {
        this.x = Math.round(this.court.width / 2) - Math.round(this.width / 2);
        this.y = Math.round(this.court.height / 2) - Math.round(this.height / 2);
    }
}

module.exports = Ball;
