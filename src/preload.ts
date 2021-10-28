// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

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

      // Do a depth-first search
      var guess = "t";
      var guessable_characters = 'abcdefghijklmnopqrstuvwxyz ';

      // Depth first search
      for (let i = 0; i < guessable_characters.length; i++) {
        var score = await makeGuess(guess + guessable_characters[i]);
        console.log(guess + guessable_characters[i], score);
      }
    }
  });
});

async function makeGuess(guess: string) {
  // TODO HARDCODED TOTAL LENGTH
  const request = {command: "start-redacting", totalLength: 20, text: guess}
  const result = await ipcRenderer.invoke('redact', request);
  // Send back to DOM to display results on page
  window.postMessage(result, "file://");
  return result;
}
