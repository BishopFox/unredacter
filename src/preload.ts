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
      var score = await guessRecursive(guess);
    }
  });
});

async function guessRecursive(guess: string) {

  // First, make a direct guess for all characters appended on
  if (guess.length === max_length) {
    return;
  }
  var scores = new Map();

  for (let i = 0; i < guessable_characters.length; i++) {
    var result = await makeGuess(guess + guessable_characters[i]);
    console.log("score: ", result);
    // Discard bad scores
    if (result.score < 0.5) {
      scores.set(result.score, guess + guessable_characters[i]);
    }
  }

  // Now sort the results by score
  var mapAsc = new Map([...scores.entries()].sort());

  // Do the whole thing again for each of these new guesses
  for (const entry of mapAsc.entries()) {
    const score = entry[0];
    const guess = entry[1];
    await guessRecursive(guess);
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
