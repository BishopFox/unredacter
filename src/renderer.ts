// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

var best_guess = "";
var best_score = 1;

window.addEventListener("message", (event) => {
  // console.log("LISTENER: ", event.data.guess, event.data.score, event.data.imageData);
  if (event) {
    gatherResults(event.data.guess, event.data.score, event.data.imageData);
  }
});

async function gatherResults(guess: string, score: number, imageData: string) {

  if ((score < best_score) && (guess.length >= best_guess.length)) {
    best_score = score;
    best_guess = guess;

    var imageElement = <HTMLImageElement>document.getElementById("best-preview-image");
    imageElement.src = imageData;

    var labelElement = <HTMLInputElement>document.getElementById("best-guess");
    labelElement.value = guess;
  } else {
    var imageElement = <HTMLImageElement>document.getElementById("current-preview-image");
    imageElement.src = imageData;
    var labelElement = <HTMLInputElement>document.getElementById("current-guess");
    labelElement.value = guess;
  }
}

document.getElementById('start-button').addEventListener('click', () => {
  window.postMessage({
    command: 'start-redacting',
  }, "*");
})


// "this is super secret"
// "xxxxxxxxxxxxxxxxxxxx"
