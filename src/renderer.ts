// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

var best_guess = "";
var best_score = 1;

window.addEventListener("message", (event) => {
  if (event) {
    gatherResults(event.data.guess, event.data.score, event.data.imageData);
  }
});

async function gatherResults(guess: string, score: number, imageData: string) {
  console.log(guess, score);

  if ((score < best_score) && (guess.length >= best_guess.length)) {
    best_score = score;
    best_guess = guess;

    var imageElement = <HTMLImageElement>document.getElementById("preview-image");
    imageElement.src = imageData;

    var labelElement = <HTMLInputElement>document.getElementById("best-guess");
    labelElement.value = guess;
  }
}

document.getElementById('start-button').addEventListener('click', () => {
  var guessable_characters = 'abcdefghijklmnopqrstuvwxyz ';

  // Depth first search
  for (let i = 0; i < guessable_characters.length; i++) {
    makeGuess("thi" + guessable_characters[i]);
  }
})

async function makeGuess(guess: string) {
  window.postMessage({
    command: 'redact',
    text: guess,
    totalLength: 20,
  }, "*");
}

// "this is super secret"
// "xxxxxxxxxxxxxxxxxxxx"
