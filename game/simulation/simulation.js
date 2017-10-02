'use strict';
const Speech = require('ssml-builder');
const _ = require('lodash');
const common = require('../common');

const Court = require('./court');
const Paddle = require('./paddle');
const Ball = require('./ball');

class Simulation {
    constructor(mode) {
        // create a new court
        this.court = new Court();
        this.left = new Paddle(this.court, 'left');
        this.right = new Paddle(this.court, 'right');

        this.ball = new Ball(this.court);

        this.speech = null;

        this.mode = mode;

        this.scores = {
            ai: 0,
            player: 0
        };
    }

    parse(data) {
        this.left.width = data.left.width;
        this.left.height = data.left.height;
        this.left.x = data.left.x;
        this.left.y = data.left.y;

        this.right.width = data.right.width;
        this.right.height = data.right.height;
        this.right.x = data.right.x;
        this.right.y = data.right.y;

        this.ball.width = data.ball.width;
        this.ball.height = data.ball.height;
        this.ball.x = data.ball.x;
        this.ball.y = data.ball.y;
        this.ball.hSpeed = data.ball.hSpeed;
        this.ball.vSpeed = data.ball.vSpeed;

        this.scores = data.scores;
        this.mode = data.mode;
    }

    serialize() {
        return {
            left: this.left,
            right: this.right,
            ball: this.ball,
            court: this.court,
            mode: this.mode,
            scores: this.scores
        };
    }

    start() {
        const narration = `With a buzz, a black and white screen flickers on. It is ${this.court.width} pixels wide and ${this.court.height} pixels tall. A dotted vertical line spans the middle of the screen. There are paddles on the left and right sides, ${this.left.width} pixels wide and ${this.left.height} pixels tall.`;

        this.speech = new Speech();
        this.speech.say(`Starting Virtual Tennis in ${this.mode} mode.`);
        this.speech.pause('500ms');
        this.speech.audio('https://s3.amazonaws.com/grumblus-static/pong/bootup.mp3');
        this.speech.say(narration);
        this.speech.pause('500ms');
        this.speech.say('You are the player on the right.');
        this.speech.pause('500ms');
        this.speech.say(`A ${this.ball.width} pixel by ${this.ball.height} pixel ball appears in the center of the screen.`);
        this.speech.pause('500ms');

        this.serveBall();

        let prompt = 'The ball is approaching you. Indicate where you would like to move your paddle. Do you want to move it to the top of the screen, the middle, or the bottom?';
        if (this.mode === 'hard') {
            prompt = `The ball is approaching you. How many pixels from the top of the screen would you like to position the top of your paddle at? Remember, your paddle is ${this.right.height} pixels tall. As such, you can position your paddle between 0 and ${this.court.height - this.right.height} pixels from the top.`;
        }
        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/chime_bell_confirm.mp3');
        this.speech.say(prompt);

        return this.speech.ssml(true);
    }

    serveBall(forceDirection = 0) {
        let narration = '';
        // pick a random direction for the ball
        let hDirection = _.random(0, 1);
        if (forceDirection !== 0) {
            hDirection = forceDirection;
        }
        if (hDirection < 1) {
            // served to AI
            hDirection = -1;
            narration += 'It moves to the left toward the AI\'s side ';
        }
        else {
            // served to player
            narration += 'It moves to the right toward your side ';
        }

        let vDirection = _.random(0, 1);
        let vString = 'up';
        if (vDirection < 1) {
            vDirection = -1;
            vString = 'down';
        }

        // pick a speed
        const hSeconds = _.random(2, 5);
        const vSeconds = _.random(2, 5);
        const hSpeed = Math.round(this.court.width / hSeconds) * hDirection;
        const vSpeed = Math.round(this.court.height / vSeconds) * vDirection;

        const speed = this.calculateCombinedSpeed(hSpeed, vSpeed);
        const angle = this.calculateAngleFromSpeed(hSpeed, vSpeed);

        narration += `at ${Math.round(speed)} pixels per second. It travels ${vString} at a ${angle} degree angle from the center.`;

        this.speech.audio('https://s3.amazonaws.com/grumblus-static/pong/digi_blip_up_hi.mp3');
        this.speech.say(narration);

        // calculate the impact
        this.calculateImpact(hSpeed, vSpeed);
    }

    calculateAngleFromSpeed(hSpeed, vSpeed) {
        // determine what angle this is moving at by determining the X and Y positions after 1 second
        const x = hSpeed;
        const y = vSpeed;
        if (y === 0 && x > 0) {
            // moving right horizontally
            return 0;
        }
        else if (y === 0 && x < 0) {
            // moving left horizontally
            return 180;
        }

        // the tangent of the ball's angle is opposite (Y change) over adjacent (X change)
        const ratio = y / x;
        let rad = Math.atan(ratio);

        if (x < 0) {
            // when moving left, add 180 degrees to the angle
            rad += Math.PI;
        }

        // convert the radians to degrees
        let degrees = rad * (180 / Math.PI);
        if (degrees > 180) {
            // max of 180 degrees, after that use negatives
            degrees = degrees - 360;
        }

        // round to 1 decimal place
        degrees = Math.round(degrees * 10) / 10;

        return degrees;
    }

    calculateVerticalSpeedFromAngle(hSpeed, angle) {
        // this is basically the reverse from the above angle calculation
        const x = hSpeed;

        // make all degrees positive
        let degrees = angle;
        if (degrees < 0) {
            degrees = degrees + 360;
        }

        // convert to radians
        let rad = degrees * (Math.PI / 180);

        if (x < 0) {
            // subtract 180 degrees for angles heading left
            rad -= Math.PI;
        }

        // take the tangent of the angle
        const ratio = Math.tan(rad);
        const y = ratio * x;
        return y;
    }

    calculateCombinedSpeed(hSpeed, vSpeed) {
        const speed = Math.round(Math.sqrt(Math.pow(hSpeed, 2) + Math.pow(vSpeed, 2)));
        return speed;
    }

    calculateImpact(hSpeed, vSpeed) {
        // save the speeds
        this.ball.hSpeed = hSpeed;
        this.ball.vSpeed = vSpeed;

        // determine the X position impact points of the paddles
        const aiPaddleX = this.left.width;
        const playerPaddleX = this.court.width - this.right.width;

        // extend the current trajectory until the the ball hits either a paddle X position or a
        // Y edge of the screen
        const currentBallTop = this.ball.y;
        const currentBallBottom = this.ball.y + this.ball.height; // the bottom of the ball hits the bottom of the screen

        let yImpactTime;
        let yImpactLocation = 'top';
        if (vSpeed > 0) {
            // moving upward, determine how long until the top of the ball hits the top of the screen
            yImpactTime = currentBallTop / Math.abs(vSpeed);
        }
        else {
            // moving downward, determine how long until the bottom of the ball hits the bottom of the screen
            yImpactTime = (this.court.height - currentBallBottom) / Math.abs(vSpeed);
            yImpactLocation = 'bottom';
        }

        const currentBallLeft = this.ball.x;
        const currentBallRight = this.ball.x + this.ball.width;
        let xImpactTime;
        let xImpactLocation = 'left';
        if (hSpeed < 0) {
            // ball is moving left toward the AI, determine how long until the left side of the ball
            // hits the paddle
            xImpactTime = (currentBallLeft - aiPaddleX) / Math.abs(hSpeed);
        }
        else {
            // ball is moving right toward player, determine how long until the right side of the ball
            // hits the paddle
            xImpactTime = (playerPaddleX - currentBallRight) / Math.abs(hSpeed);
            xImpactLocation = 'right';
        }

        // determine which impact will happen first
        if (xImpactTime <= yImpactTime) {
            // the ball needs to be returned by a paddle
            // if both are equal, the paddle will still need to bounce it back
            // remember that negative vertical speed is going down, positive vertical speed is going up
            // so we need to reverse the speed
            const adjustedVerticalSpeed = vSpeed * -1;
            if (hSpeed < 1) {
                // the AI needs to return the ball
                // calculate where the ball will impact
                const position = {
                    x: aiPaddleX,
                    y: (xImpactTime * adjustedVerticalSpeed) + this.ball.y
                };

                this.aiReturnBall(hSpeed, vSpeed, position);
            }
            else {
                // the player needs to return the ball
                const position = {
                    x: playerPaddleX,
                    y: (xImpactTime * adjustedVerticalSpeed) + this.ball.y
                };

                this.ball.x = position.x;
                this.ball.y = position.y;
            }
            
        }
        else {
            // the ball will bounce off the top or bottom of the screen
            const position = {
                x: (yImpactTime * hSpeed) + this.ball.x,
                y: this.ball.y - (yImpactTime * vSpeed)
            };
            this.bounceEdge(hSpeed, vSpeed, position);
        }
    }

    bounceEdge(hSpeed, vSpeed, ballPosition) {
        // update the ball position
        this.ball.x = ballPosition.x;
        this.ball.y = ballPosition.y;

        this.speech.pause('500ms');

        // bounce the ball back
        const angle = this.calculateAngleFromSpeed(hSpeed, vSpeed);
        let reflectedAngle;
        let directionString;
        let bounceDirection;
        if (ballPosition.y === 0) {
            // this is the top of the screen
            this.speech.say(`The ball hits the top of the screen, ${Math.round(ballPosition.x)} pixels from the left edge.`);
            // this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_beep.mp3');

            bounceDirection = 'downward';

            // determine the bounce angle
            if (hSpeed > 0) {
                // the ball is reflected 90 degrees but still heading right and also down
                reflectedAngle = angle - 90;
                directionString = 'right toward your side';
            }
            else {
                // the ball is reflected 90 degrees but still heading left
                // create a right triangle and determine how many degrees are below the angle to the X axis
                const innerAngle = 180 - angle;
                // determine how many degrees are on the other side of the 90 degree right triangle
                const opposingAngle = 90 - innerAngle;
                // this is an angle that is going down and heading left
                reflectedAngle = -180 + opposingAngle;
                directionString = 'left';
            }            
        }
        else {
            // this is the bottom of the screen
            this.speech.say(`The ball hits the bottom of the screen, ${Math.round(ballPosition.x)} pixels from the left edge.`);
            // this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_beep.mp3');

            bounceDirection = 'upward';

             // determine the bounce angle
            if (hSpeed > 0) {
                // the ball is reflected 90 degrees but still heading right and also up
                reflectedAngle = 90 + angle;
                directionString = 'right toward your side';
            }
            else {
                // the ball is reflected 90 degrees but still heading left
                // determine how many degrees are within the right triangle formed by the X axis and the reflected bounce
                const internalAngle = 180 - Math.abs(angle);
                // determine what the remaining angle is (this is the angle of the reflected bounce trajectory as it intersects the X axis)
                const remainingAngle = 90 - internalAngle;
                // rotating this angle across the X axis results in an equal angle. Subtracting 180 gets us the leftside angle between the 
                // bounce trajectory and the X axis
                reflectedAngle = 180 - remainingAngle;
                // this is an angle that is going up and heading left
                directionString = 'left';
            }
        }
        // assume the horizontal speed remains the same but adjust the vertical speed to match the new angle
        const newVSpeed = this.calculateVerticalSpeedFromAngle(hSpeed, reflectedAngle);
        const newCombinedSpeed = this.calculateCombinedSpeed(hSpeed, newVSpeed);

        this.speech.say(`The ball bounces ${bounceDirection}, continuing ${directionString} at ${Math.round(reflectedAngle * 10) / 10} degrees. It moves at ${Math.round(newCombinedSpeed)} pixels per second.`);

        this.calculateImpact(hSpeed, newVSpeed);
    }

    aiReturnBall(hSpeed, vSpeed, ballPosition) {
        // determine if the AI should hit the ball
        const returnBall = _.random(1, 100);
        let threshold = 65;
        if (this.mode === 'hard') {
            threshold = 75;
        }
        if (returnBall > threshold) {
            // the AI misses
            this.aiMissBall();
            return;
        }

        // update the ball position
        this.ball.x = ballPosition.x;
        this.ball.y = ballPosition.y;

        // otherwise the AI returns the ball
        // bounce the ball back at 90 degrees
        const angle = this.calculateAngleFromSpeed(hSpeed, vSpeed);
        let reflectedAngle;
        let directionString;
        if (vSpeed > 0) {
            // ball is heading up, on bounce it should continue up but right
            // form a right triangle from the Y axis and a horizontal line extending out from the impact point
            // determine the angle formed where the Y axis and trajectory hypotenuse meet inside the triangle
            // this is just the angle - 90 bc an upward leftward angle is between 90 and 180 degrees
            const internalAngle = angle - 90;
            // determine how many degrees are between the trajectory hypotenuse and the horizontal line inside the right triangle
            const remainingAngle = 90 - internalAngle;
            // determine how many more degrees we need to get a 90 degree bounce
            reflectedAngle = 90 - remainingAngle;
            directionString = 'upward';
        }
        else {
            // ball is heading down, on bounce it should continue down but right
            // form a right triangle from the Y axis and a horizontal line extending out from the impact point
            // determine the angle formed where the Y axis and trajectory line meet inside the triangle
            // this is just the absolute value of the angle - 90 bc a downward leftward angle is between -90 and -180 degrees
            const internalAngle = Math.abs(angle) - 90;
            // determine how many degrees are between the trajectory hypotenuse and the horizontal line inside the right triangle
            const remainingAngle = 90 - internalAngle;
            // since this is a downward path, determine how many additional degrees we need to head down to have bounced 90 degrees
            const difference = 90 - remainingAngle;
            // finally, this angle is negative because it is downward and heading right
            reflectedAngle = -1 * difference;
            directionString = 'downward';
        }

        // assume the horizontal speed remains the same (but reversed) but adjust the vertical speed to match the new angle
        const newHSpeed = -1 * hSpeed;
        const newVSpeed = this.calculateVerticalSpeedFromAngle(newHSpeed, reflectedAngle);
        const newCombinedSpeed = this.calculateCombinedSpeed(newHSpeed, newVSpeed);

        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_beep.mp3');
        this.speech.say(`The AI successfully hits the ball back at you ${Math.round(ballPosition.y)} pixels from the top of the screen. It bounces off the paddle, moving ${directionString} at ${Math.round(reflectedAngle * 10) / 10} degrees and a speed of ${Math.round(newCombinedSpeed)} pixels per second.`);

        this.calculateImpact(newHSpeed, newVSpeed);

    }

    playerReturnBall(hSpeed, vSpeed, ballPosition) {
        // bounce the ball back at 90 degrees
        const angle = this.calculateAngleFromSpeed(hSpeed, vSpeed);
        let reflectedAngle;
        let directionString;
        if (vSpeed > 0) {
            // ball is heading up, on bounce it should continue up but left
            // just add 90 degrees
            reflectedAngle = angle + 90;
            directionString = 'upward';
        }
        else {
            // ball is heading down, on bounce it should continue down but left
            // just subtract 90 degrees
            reflectedAngle = angle - 90;
            directionString = 'downward';
        }

        // assume the horizontal speed remains the same (but reversed) but adjust the vertical speed to match the new angle
        const newHSpeed = -1 * hSpeed;
        const newVSpeed = this.calculateVerticalSpeedFromAngle(newHSpeed, reflectedAngle);
        const newCombinedSpeed = this.calculateCombinedSpeed(newHSpeed, newVSpeed);

        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_beep.mp3');
        if (this.mode === 'easy') {
            this.speech.say(`You successfully hit the ball with your paddle ${Math.round(this.ball.y)} pixels from the top of the screen. It moves ${directionString} at ${Math.round(reflectedAngle * 10) / 10} degrees and a speed of ${Math.round(newCombinedSpeed)} pixels per second.`);
        }
        else {
            this.speech.say(`You successfully hit the ball with your paddle. It moves ${directionString} at ${Math.round(reflectedAngle * 10) / 10} degrees and a speed of ${Math.round(newCombinedSpeed)} pixels per second.`);
        }

        this.calculateImpact(newHSpeed, newVSpeed);
    }

    validateEasy(position) {
        // check if the player moved the ball to the correct position
        const topMax = Math.round(this.court.height / 3);
        const midMax = topMax + Math.round(this.court.height / 3);

        let pickedCorrectly = false;
        if (position === 'top' && this.ball.y <= topMax) {
            pickedCorrectly = true;
        }
        else if (position === 'middle' && this.ball.y > topMax && this.ball.y <= midMax) {
            pickedCorrectly = true;
        }
        else if (position === 'bottom' && this.ball.y > midMax) {
            pickedCorrectly = true;
        }

        this.speech = new Speech();
        this.speech.say(`You move your paddle to the ${position} of the screen.`);

        if (pickedCorrectly) {
            this.playerReturnBall(this.ball.hSpeed, this.ball.vSpeed, {
                x: this.ball.x,
                y: this.ball.y
            });
        }
        else {
            let numericalChoice = this.court.height;
            if (position === 'top') {
                numericalChoice = 0;
            }
            else if (position === 'middle') {
                numericalChoice = midMax;
            }

            let relative = 'over';
            if (this.ball.y > numericalChoice) {
                relative = 'below';
            }
            const relativeMessage = `It passes ${relative} you at ${Math.round(this.ball.y)} pixels from the top of the screen.`;
            this.playerMissBall(relativeMessage);
        }

        if (this.scores.ai !== common.winningScore && this.scores.player !== common.winningScore) {
            let prompt = 'The ball is approaching you again. Where would you like to move your paddle to?';
            if (this.mode === 'hard') {
                prompt = `The ball is approaching you again. What pixel position between 0 and ${this.court.height - this.right.height} pixels would you like to move your paddle to?`;
            }
            this.speech.pause('500ms');
            this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/chime_bell_confirm.mp3');
            this.speech.say(prompt);
        }

        return this.speech.ssml(true);
    }

    validateHard(position) {
        // check if the player moved the ball to the correct position
        let pickedCorrectly = false;
        const paddleTop = position;
        const paddleBottom = position + this.right.height;
        if (paddleTop <= this.ball.y && paddleBottom >= (this.ball.y + this.ball.height)) {
            // the ball hit the paddle!
            pickedCorrectly = true;
        }

        this.speech = new Speech();
        this.speech.say(`You move your paddle ${position} pixels from the top of the screen.`);

        if (pickedCorrectly) {
            this.playerReturnBall(this.ball.hSpeed, this.ball.vSpeed, {
                x: this.ball.x,
                y: this.ball.y
            });
        }
        else {
            let relative = 'over';
            if (this.ball.y > position) {
                relative = 'below';
            }
            const relativeMessage = `It passes ${relative} you at ${Math.round(this.ball.y)} pixels from the top of the screen.`;
            this.playerMissBall(relativeMessage);
        }

        if (this.scores.ai !== common.winningScore && this.scores.player !== common.winningScore) {
            let prompt = 'The ball is approaching you again. Where would you like to move your paddle to?';
            if (this.mode === 'hard') {
                prompt = `The ball is approaching you again. What pixel position between 0 and ${this.court.height - this.right.height} pixels would you like to move your paddle to?`;
            }
            this.speech.pause('500ms');
            this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/chime_bell_confirm.mp3');
            this.speech.say(prompt);
        }

        return this.speech.ssml(true);
    }

    aiMissBall() {
        this.scores.player += 1;
        // reset the ball
        this.ball.resetPosition();

        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_warn.mp3');
        this.speech.say('The AI misses the ball.')
        this.speech.pause('500ms');
        this.speech.say(`AI now has ${this.pluralPoints(this.scores.ai)} and you have ${this.pluralPoints(this.scores.player)}.`);

        if (this.scores.player === common.winningScore) {
            this.winGame();
            return;
        }

        this.speech.pause('500ms');
        this.speech.say('The ball is returned to the center of the screen.');
        this.speech.pause('500ms');

        // serve to player
        this.serveBall(1);
    }

    playerMissBall(relative) {
        this.scores.ai += 1;

        // reset the ball
        this.ball.resetPosition();

        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/digi_warn.mp3');
        this.speech.say(`You miss the ball. ${relative}`)
        this.speech.pause('500ms');
        this.speech.say(`AI now has ${this.pluralPoints(this.scores.ai)} and you have ${this.pluralPoints(this.scores.player)}.`);

        if (this.scores.ai === common.winningScore) {
            this.loseGame();
            return;
        }

        this.speech.pause('500ms');
        this.speech.say('The ball is returned to the center of the screen.');
        this.speech.pause('500ms');

        // serve to AI
        this.serveBall(-1);
    }

    pluralPoints(points) {
        if (points !== 1) {
            return `${points} points`;
        }
        return `${points} point`;
    }

    winGame() {
        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/win.mp3');
        this.speech.say('Congratulations! You have won the game! Repoen this skill if you want to play again.');
    }

    loseGame() {
        this.speech.pause('500ms');
        this.speech.audio('https://grumblus-static.s3.amazonaws.com/pong/lose.mp3');
        this.speech.say('That\'s too bad. You lost the game. Reopen this skill if you want to play again. Hopefully you will have better luck next time.');
    }
};

module.exports = Simulation;
