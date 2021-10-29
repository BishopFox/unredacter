// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

const guessable_characters = 'abcdefghijklmnopqrstuvwxyz ';
// TODO HARDCODED TOTAL LENGTH
const max_length = 20;

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };
});

// ipcRenderer.on('gatherResults', (event, ...args) => {
//   // console.log("preload: ", ...args);
//   // console.log("preload: ", args[0]);
//   window.postMessage(args[0], "file://");
// });

process.once('loaded', () => {
  window.addEventListener('message', async (event) => {
    // do something with custom event
    const message = event.data;

    if (message.command === 'start-redacting') {

      var guess = "t";
      // Initial call to the recursive function
      var score = await guessRecursive(guess, 0);
    }
  });
});

async function guessRecursive(guess: string, score: number) {

  // First, make a direct guess for all characters appended on
  if (guess.length === max_length) {
    return;
  }
  var scores = new Map();

  for (let i = 0; i < guessable_characters.length; i++) {
    const nextGuess = guess + guessable_characters[i];
    var result = await makeGuess(nextGuess);
    // How much worse did the score get?
    console.log("score: ", nextGuess, result.score - score);

    // Discard bad guess scores
    if (result.score - score < 0.4) {
      scores.set(result.score, nextGuess);
    }
  }

  // Now sort the results by score
  var mapAsc = new Map([...scores.entries()].sort());

  // Do the whole thing again for each of these new guesses
  for (const entry of mapAsc.entries()) {
    const newScore = entry[0];
    const newGuess = entry[1];
    await guessRecursive(newGuess, newScore);
  }
}

async function makeGuess(guess: string) {
  // TODO HARDCODED TOTAL LENGTH
  const request = {command: "start-redacting", totalLength: max_length, text: guess}
  const result = await ipcRenderer.invoke('redact', request);
  // Send back to DOM to display results on page
  window.postMessage(result, "file://");
  return result;
}
