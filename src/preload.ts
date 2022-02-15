// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');
import Jimp from 'jimp';
import * as path from "path";

// Some hardcoded constants here.
const guessable_characters = 'abcdefghijklmnopqrstuvwxyz ';
const max_length = 20;
const blocksize = 8;
const threshold = 0.25;

const redact_command = "redact-text";
const guess_command = "guess-text";
var redacted_image = "";

process.once('loaded', () => {

  Jimp.read(path.join(__dirname, "../secret.png")).then(image => {
    image.getBase64Async(Jimp.MIME_PNG).then((image_string) => {
      redacted_image = image_string;
    });
  });

  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (message !== undefined && message.score === undefined) {

      if (message.command === redact_command) {
        var parent_guess_result = await makeGuess(redact_command, message.text, "", parseInt(message.offset_x), parseInt(message.offset_y));
        redacted_image = parent_guess_result.imageData;
      }
      if (message.command === guess_command) {

        // First, auto-discover some likely offsets
        var offset_scores = [];
        for (let x = 0; x < blocksize; x++) {
          for (let y = 0; y < blocksize; y++) {
            var bestScore = 1;
            for (let i = 0; i < guessable_characters.length; i++) {
              var guess_result = await makeGuess(guess_command, guessable_characters[i], "", x, y);
              if (guess_result.score < bestScore) {
                bestScore = guess_result.score;
              }
            }
            window.postMessage(
              {
                command: "offsetDiscovery",
                offset_x: x,
                offset_y: y,
                success: bestScore < threshold,
              }, "file://"
            );
            if (bestScore < threshold) {
              offset_scores.push([bestScore, x, y]);
            }
          }
        }

        offset_scores.sort();

        // Try each offset with a good guess
        for (let j = 0; j < offset_scores.length; j++) {
          // Initial seeds to the recursive function
          var initial_scores = [];
          for (let i = 0; i < guessable_characters.length; i++) {
            var parent_guess_result = await makeGuess(guess_command, guessable_characters[i], "", offset_scores[j][1], offset_scores[j][2]);
            if (parent_guess_result.score < threshold) {
              initial_scores.push([parent_guess_result.score, guessable_characters[i]]);
            }
          }
          initial_scores.sort();
          for (let i = 0; i < initial_scores.length; i++) {
            const newScore = initial_scores[i][0];
            const newGuess = initial_scores[i][1];
            var score = await guessRecursive(newGuess, 0, offset_scores[j][1], offset_scores[j][2]);
          }
        }
      }
    }
  });
});

async function guessRecursive(guess: string, score: number, offset_x: number, offset_y: number) {

  // First, make a direct guess for all characters appended on
  if (guess.length === max_length) {
    return;
  }
  var scores = [];

  var parent_guess_result = await makeGuess(guess_command, guess, "", offset_x, offset_y);

  // If the parent guess is already bigger than the answer image, then stop guessing
  if (!parent_guess_result.tooBig) {

    for (let i = 0; i < guessable_characters.length; i++) {
      const nextGuess = guess + guessable_characters[i];
      var result = await makeGuess(guess_command, nextGuess, parent_guess_result.imageData, offset_x, offset_y);
      var usedThreshold = threshold;
      if (guessable_characters[i] === " "){
        usedThreshold = 0.5;
      }
      if (result.score < usedThreshold) {
        scores.push([result.score, nextGuess]);
      }
    }

    // Now sort the results by score
    scores.sort();
    // Do the whole thing again for each of these new guesses
    for (let i = 0; i < scores.length; i++) {
      const newScore = scores[i][0];
      const newGuess = scores[i][1];
      await guessRecursive(newGuess, newScore, offset_x, offset_y);
    }
  }
}

async function makeGuess(command: string, guess: string, previousimage: string, offset_x: number, offset_y: number) {
  const request = {
                  command: command,
                  redacted_image: redacted_image,
                  totalLength: max_length,
                  text: guess,
                  previousimage: previousimage,
                  charset: guessable_characters,
                  offset_x: offset_x,
                  offset_y: offset_y,
                }
  const result = await ipcRenderer.invoke('redact', request);
  // Send back to DOM to display results on page
  window.postMessage(result, "file://");
  return result;
}
