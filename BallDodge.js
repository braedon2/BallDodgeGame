
const NUM_COLLECTIBLES = 3;

const BALL_RADIUS = 16;
const BALL_SPEED = 60;
const BALL_COLOR = "black"
const COLLECTIBLE_COLOR = "gold"

const PLAYER_RADIUS = 12;
const PLAYER_SPEED = 150;
const PLAYER_COLOR = "blue"

// boundaries of the playing area
let boundaries = {
    width: 400, // global width
    height: 600, // global height
    zoneHeight: 50 // the height of the start and end zones
}

const statuses = {
    WON: "won",
    PLAYING: "playing",
    LOST: "lost"
}

const zones = {
    START: "start",
    MIDDLE: "middle",
    FINISH: "finish"
}

const actorTypes = {
    PLAYER: "player",
    BALL: "ball",
    COLLECTIBLE: "collectible"
}

// global bindind that keeps track of which arrow keys are being pressed
const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

function trackKeys(keys) {
    let down = Object.create(null);
    function track(event) {
        if (keys.includes(event.key)) {
            down[event.key] = event.type == "keydown";
            event.preventDefault();
        }
    }
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    return down;
}
  
function touchesBoundary(pos, radius) {
    let touches = false;
    let side = [];

    let x = pos.x;
    let y = pos.y;

    if ((Math.ceil(x) + radius) > boundaries.width) 
        side.push("right")
    if (Math.floor(x) - radius < 0) 
        side.push("left");
    if (Math.ceil(y) + radius > boundaries.height) 
        side.push("bottom");
    if (Math.floor(y) - radius < 0) 
        side.push("top");

    if (side.length > 0) touches = true; 
    
    return {touches, side};
}

function touchesZone(pos, radius) {
    let zone = [];
    let y = pos.y; // zones span the entire width so we only care about y

    // check if completely or partially in start zone
    if ((y + radius) > (boundaries.height - boundaries.zoneHeight)) {
        zone.push(zones.START)
        if (y - radius < (boundaries.height - boundaries.zoneHeight))
            zone.push(zones.MIDDLE)
    }
    // check if completely in middle zone
    else if (
        (y + radius) < (boundaries.height - boundaries.zoneHeight) &&
        (y - radius) > boundaries.zoneHeigh
    ) {
        zone.push(zones.MIDDLE);
    }
    // check if completely or partially in finish zone
    else if ((y - radius) < boundaries.zoneHeight) {
        zone.push(zones.FINISH)
        if ((y + radius) > boundaries.zoneHeight)
            zone.push(zones.MIDDLE)
    }

    return zone;
}

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    plus(vec) {
        return new Vector(this.x + vec.x, this.y + vec.y);
    }

    minus(vec) {
        return new Vector(this.x - vec.x, this.y - vec.y);
    }

    times(factor) {
        return new Vector(this.x * factor, this.y * factor);
    }

    distanceFrom(vec) {
        return Math.sqrt(
            Math.abs(
                Math.pow(this.x - vec.x, 2) + Math.pow(this.y - vec.y, 2)
            )
        );
    }

    magnitude() { // pop pop !
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }

    dotProduct(vec) {
        return (this.x * vec.x) + (this.y * vec.y)
    }

    normalize() {
        return new Vector(this.x / this.magnitude(), this.y / this.magnitude());
    }

    rotate(angle) {
        let newX = (Math.cos(angle) * this.x) - (Math.sin(angle) * this.y);
        let newY = (Math.sin(angle) * this.x) + (Math.cos(angle) * this.y);
        return new Vector(newX, newY);
    }

    invertX() { return new Vector(-this.x, this.y); }

    invertY() { return new Vector(this.x, -this.y); }
}


class State {
    constructor(actors, status) {
        this.actors = actors;
        this.status = status;
    }

    get player() { 
        return this.actors.find(actor => actor.type == actorTypes.PLAYER);
    }

    get nonPlayers() {
        return this.actors.filter(actor => actor.type != actorTypes.PLAYER);
    }

    isWon() {
        let player = this.player;
        let playerZone = touchesZone(player.pos, player.radius);

        return playerZone.length == 1 &&
            playerZone.includes(zones.FINISH) &&
            !this.actors.some(actor => actor.type == actorTypes.COLLECTIBLE);
    }

    update(time, keys) {

        let newState = this.updateNonPlayers(time);
        newState = newState.updatePlayer(time, keys);

        if (newState.isWon())
            return new State(newState.actors, statuses.WON);
        else
            return newState;
    }

    updateNonPlayers(time) {
        let newBalls = this.nonPlayers;
        for (let i = 0; i < newBalls.length; i += 1) {
            let tmpBall = newBalls[i].update(time);
            let colliderIndex = newBalls.findIndex(b => b != newBalls[i] && overlap(b, tmpBall));
            if (colliderIndex != -1)
                Ball.handleCollision(tmpBall, newBalls[colliderIndex])
            newBalls[i] = tmpBall;
        }

        return new State(newBalls.concat(this.player), this.status);
    }

    updatePlayer(time, keys) {
        let newPlayer = this.player.update(time, keys);

        // check for collision with ball
        let loseCondition = this.actors.some(a => {
            return overlap(newPlayer, a) && a.type == actorTypes.BALL;
        });

        // check for collisions with collectible balls and remove them
        let newActors = this.nonPlayers.filter(a => {
            return !(overlap(newPlayer, a) && a.type == actorTypes.COLLECTIBLE);
        })
        
        return new State(
            newActors.concat(newPlayer),
            loseCondition ? statuses.LOST : this.status
        );
    }

    static random(numBalls) {
        let actors = [];
        let width = boundaries.width - (BALL_RADIUS * 2);
        let height = boundaries.height - ((BALL_RADIUS + boundaries.zoneHeight) * 2);
        let xMargin = BALL_RADIUS;
        let yMargin = BALL_RADIUS + boundaries.zoneHeight;
        let id = 0;

        // add random balls and collectibles in the middle zone
        while (actors.length < numBalls + NUM_COLLECTIBLES) {
            let pos = new Vector(
                Math.random() * width,
                Math.random() * height
            );
            // pad the position so that the balls are placed within the middle zone
            pos = pos.plus(new Vector(xMargin, yMargin));
            let ball = new Ball(
                pos,
                new Vector(0, BALL_SPEED),
                actors.length < numBalls ? BALL_COLOR : COLLECTIBLE_COLOR,
                id
            );
            if (actors.some(b => overlap(b, ball)))
                continue;
            ball.speed = ball.speed.rotate(2 * Math.PI * Math.random());
            actors.push(ball);
            id += 1;
        }

        actors.push(new Player(
            new Vector(
                boundaries.width / 2,
                boundaries.height - (PLAYER_RADIUS * 2)
            )
        ));

        return new State(actors, "playing");
    }
}

class CanvasDisplay {
    constructor(parent, state) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = boundaries.width;
        this.canvas.height = boundaries.height;
        parent.appendChild(this.canvas);
        this.cx = this.canvas.getContext("2d");

        this.drawState(state);
    }

    drawState(state) {
        this.clearDisplay(state);
        this.drawZones();
        this.drawActors(state.actors);
    }

    drawZones() {
        // draw end zone
        this.cx.fillStyle = "red";
        this.cx.fillRect(0, 0, boundaries.width, boundaries.zoneHeight);

        // draw start zone
        this.cx.fillStyle = "green";
        this.cx.fillRect(
            0,
            boundaries.height - boundaries.zoneHeight, 
            boundaries.width,
            boundaries.zoneHeight
        );

        //draw global playing area
        this.cx.strokeStyle = "black";
        this.cx.lineWidth = 4;
        this.cx.strokeRect(0, 0, boundaries.width, boundaries.height);
    }

    drawActors(actors) {
        for (let actor of actors) {
            this.cx.beginPath();
            this.cx.fillStyle = actor.color;
            this.cx.arc(actor.pos.x, actor.pos.y, actor.radius, 0, 7);
            this.cx.fill();
        }
    }

    clearDisplay() {
        this.cx.fillStyle = "white";
        this.cx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    clear() { this.canvas.remove(); }
}

class Ball {
    constructor(pos, speed, color, id) {
        this.pos = pos;
        this.speed = speed;
        this.color = color;
        this.id = id;
    }

    get type() { 
        if (this.color == "black") return actorTypes.BALL;
        else if (this.color == "gold") return actorTypes.COLLECTIBLE;
    }

    update(time) {
        let newPos = this.pos.plus(this.speed.times(time));
        let newSpeed = this.speed;
        let boundaryInfo = touchesBoundary(newPos, this.radius);
        let zone = touchesZone(newPos, this.radius);

        if (boundaryInfo.touches) {
            newPos = this.pos; 
            // we only need to check the left and right of the global boundaries
            if (boundaryInfo.side.includes("left") || boundaryInfo.side.includes("right"))
                newSpeed = newSpeed.invertX();
        }
        if (zone.length > 1) {
            newPos = this.pos;
            // balls cant enter the start and finish zones
            if (zone.includes(zones.START) || zone.includes(zones.FINISH))
                newSpeed = newSpeed.invertY();
        }

        return new Ball(newPos, newSpeed, this.color, this.id);
    }

    static handleCollision(ball1, ball2) { 
        let { ball1: adjustedBall1, ball2: adjustedBall2} = adjustPositions({ ball1, ball2 });
        ball1.pos = adjustedBall1.pos;
        ball2.pos = adjustedBall2.pos;

        // [ball1.speed, ball2.speed] = elasticCollision(
        //     adjustedBall1.pos, ball1.speed, adjustedBall2.pos, ball2.speed
        // );
        let { ball1: newBall1, ball2: newBall2 } = elasticCollision({ 
            ball1: adjustedBall1, 
            ball2: adjustedBall2 
        })
        ball1.speed = newBall1.speed;
        ball2.speed = newBall2.speed;
    }
}

Ball.prototype.radius = BALL_RADIUS;

class Player {
    constructor(pos) {
        this.pos = pos;
    }

    get type() { return actorTypes.PLAYER; }

    update(time, keys) {
        let xSpeed = 0;
        if (keys.ArrowLeft) xSpeed -= PLAYER_SPEED;
        if (keys.ArrowRight) xSpeed += PLAYER_SPEED;

        let ySpeed = 0;
        if (keys.ArrowUp) ySpeed -= PLAYER_SPEED;
        if (keys.ArrowDown) ySpeed += PLAYER_SPEED;

        let speed = new Vector(xSpeed, ySpeed);
        let newPos = this.pos.plus(speed.times(time));

        if (touchesBoundary(newPos, PLAYER_RADIUS).touches)
            return new Player(this.pos);
        else
            return new Player(newPos);
    }
}

Player.prototype.radius = PLAYER_RADIUS;
Player.prototype.color = PLAYER_COLOR;

function overlap(actor1, actor2) {
    let distance = actor1.pos.distanceFrom(actor2.pos);
    if (distance < actor1.radius + actor2.radius)
        return true;
    return false;    
}

function elasticCollision({ ball1, ball2 }) {
    let { pos: pos1, speed: speed1 } = ball1;
    let { pos: pos2, speed: speed2 } = ball2;

    let n = pos2.minus(pos1); // normal vector
    let un = n.normalize(); // unit normal
    let ut = new Vector(-un.y, un.x); // unit tangent

    let v1n = un.dotProduct(speed1); // scalar velocity of first object in normal direction
    let v1t = ut.dotProduct(speed1); // scalar velocity of first object in tangent direction
    let v2n = un.dotProduct(speed2);
    let v2t = ut.dotProduct(speed2);

    // new normal and tangential velocities (scalar)
    let new_v1n = v2n;
    let new_v1t = v1t;
    let new_v2n = v1n;
    let new_v2t = v2t;

    // convert the scalar and normal velocities to vectors
    new_v1n = un.times(new_v1n);
    new_v1t = ut.times(new_v1t);
    new_v2n = un.times(new_v2n);
    new_v2t = ut.times(new_v2t);

    let newSpeed1 = new_v1n.plus(new_v1t);
    let newSpeed2 = new_v2n.plus(new_v2t);

    return {
        ball1: new Ball(pos1, newSpeed1),
        ball2: new Ball(pos2, newSpeed2)
    }
}

function adjustPositions({ ball1, ball2 }) {
    let overlapDistance = (ball1.radius + ball2.radius) - (ball1.pos.distanceFrom(ball2.pos));
    let step = 0.001;
    let balls = [ball1, ball2];
    let positions = [ball1.pos, ball2.pos];
    let i = 0;
    
    while (overlapDistance > 0.01) {
        i += 1;
        if (i > 100) {
            console.log('sumthins fucked')
        }

        // it makes sense to adjust both balls incrementally but this seems to 
        // cause problems where the balls "teleport"
        for (let i = 0; i < 1; i++) { 
            let newPos = positions[i].plus(balls[i].speed.times(-step))
            if (!touchesBoundary(newPos, balls[i].radius).touches)
                positions[i] = newPos;
        }
        overlapDistance = ball1.radius + ball2.radius 
            - (positions[0].distanceFrom(positions[1]));
    }
    
    return {
        ball1: new Ball(positions[0], ball1.speed, ball1.color),
        ball2: new Ball(positions[1], ball2.speed, ball2.color)
    }
}

function runAnimation(frameFunc) {
    let lastTime = null;
    function frame(time) {
      if (lastTime != null) {
        let timeStep = Math.min(time - lastTime, 100) / 1000;
        if (frameFunc(timeStep) === false) return;
      }
      lastTime = time;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

export function runLevel(parent, numBalls) {
    for (let c of parent.childNodes)
        c.remove();
    
    let state = State.random(numBalls)
    let display = new CanvasDisplay(parent, state);
    return new Promise(resolve => {
      runAnimation(time => {
        state = state.update(time, arrowKeys);
        display.drawState(state);
        if (state.status == statuses.PLAYING)
            return true;
        else if (state.status == statuses.LOST)
            state = State.random(numBalls);
        else if (state.status == statuses.WON) {
            //display.clear();
            resolve(state.status);
            return false;
        }
      });
    });
}

