// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

const guessable_characters = 'abcdefghijklmnopqrstuvwxyz';
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
  var scores = [];

  var parent_guess_result = await makeGuess(guess, "");

  for (let i = 0; i < guessable_characters.length; i++) {
    const nextGuess = guess + guessable_characters[i];
    var result = await makeGuess(nextGuess, parent_guess_result.imageData);
    // How much worse did the score get?
    console.log("score: ", nextGuess, result.score - score);

    // Discard bad guess scores
    // if (result.score - score < 0.4) {
    scores.push([result.score, nextGuess]);
    // }
  }

  // Now sort the results by score
  // var mapAsc = new Map([...scores.entries()].sort());
  scores.sort();
  console.log(scores);

  // This is a bad guess if all the sub-guesses have the same score.
  //  At least one of the guesses should matter. They can't all be good.
  //  but they can definitely all be bad.
  // Grab the worst guess, and then discard everything within a threshold of that.

  // I can't figure out how to sort this in reverse order, so fuck it
  var worst_score = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i][0] > worst_score){
      worst_score = scores[i][0];
    }
  }
  console.log("worst score: ", worst_score);

  const threshold = 0.3;
  // Do the whole thing again for each of these new guesses
  for (let i = 0; i < scores.length; i++) {
    const newScore = scores[i][0];
    const newGuess = scores[i][1];

    if (newScore < worst_score - threshold) {
      await guessRecursive(newGuess, newScore);
    }
  }
}

async function makeGuess(guess: string, previousimage: string) {
  // TODO HARDCODED TOTAL LENGTH
  const request = {command: "start-redacting", totalLength: max_length, text: guess, previousimage: previousimage}
  const result = await ipcRenderer.invoke('redact', request);
  // Send back to DOM to display results on page
  window.postMessage(result, "file://");
  return result;
}
