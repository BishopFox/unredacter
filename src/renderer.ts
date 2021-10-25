// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

window.addEventListener("message", (event) => {
  if (event) {
    gatherResults(event.data.guess, event.data.score);
  }
});

async function gatherResults(guess: string, score: number) {
  console.log(guess, score)
}

document.getElementById('start-button').addEventListener('click', () => {
  var guessable_characters = 'abcdefghijklmnopqrstuvwxyz ';

  for (let i = 0; i < guessable_characters.length; i++) {
    makeGuess("" + guessable_characters[i]);
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
