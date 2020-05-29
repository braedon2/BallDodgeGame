import {runLevel} from "./BallDodge.js";

let numBalls = 13;

async function nextLevel() {
    document.getElementById("levelDisplay").innerHTML = "Current level: " + numBalls + " balls"
    let winElements = document.getElementsByClassName("win");
    for (let e of winElements) 
        e.style.display = "none"
    let status = await runLevel(document.getElementById("game"), numBalls)
    numBalls += 1;
    winMenu();
}

function winMenu() {
    let winElements = document.getElementsByClassName("win")
    for (let e of winElements) {
        e.style.display = "block";
    }
}

let button = document.getElementsByTagName("button")[0];
button.addEventListener("click", nextLevel);
nextLevel();