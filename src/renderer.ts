// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

var best_guess = "";
var best_score = 1;

window.addEventListener("message", (event) => {
  if (event.data.command === "offsetDiscovery") {
    var labelElement = <HTMLInputElement>document.getElementById("offset_x");
    labelElement.value = event.data.offset_x.toString();
    labelElement = <HTMLInputElement>document.getElementById("offset_y");
    labelElement.value = event.data.offset_y.toString();

    labelElement = <HTMLInputElement>document.getElementById("offsets_to_try");
    if (event.data.success) {
      labelElement.value += "[" + [event.data.offset_x, event.data.offset_y].toString() + "], ";
    }
  }

  if (event.data.command === "guess-text") {
    gatherResults(event.data.guess, event.data.totalScore, event.data.score, event.data.imageData, event.data.offset_x, event.data.offset_y);
  }

  if (event.data.command === "redact-text" && event.data.imageData !== undefined) {
    var imageElement = <HTMLImageElement>document.getElementById("original-image");
    imageElement.src = event.data.imageData;
    var downloadLink = <HTMLLinkElement>document.getElementById("download_link");
    downloadLink.href = event.data.imageData;
  }
});

async function gatherResults(guess: string, totalScore: number, score: number, imageData: string, offset_x: number, offset_y: number) {

  if (totalScore < best_score) {
    best_score = totalScore;
    best_guess = guess;

    var imageElement = <HTMLImageElement>document.getElementById("best-preview-image");
    imageElement.src = imageData;

    var labelElement = <HTMLInputElement>document.getElementById("best-guess");
    labelElement.value = guess;
    labelElement = <HTMLInputElement>document.getElementById("best-score");
    labelElement.value = best_score.toString();
    labelElement = <HTMLInputElement>document.getElementById("offset_x");
    labelElement.value = offset_x.toString();
    labelElement = <HTMLInputElement>document.getElementById("offset_y");
    labelElement.value = offset_y.toString();
  }
  var imageElement = <HTMLImageElement>document.getElementById("current-preview-image");
  imageElement.src = imageData;
  var labelElement = <HTMLInputElement>document.getElementById("current-guess");
  labelElement.value = guess;
}

document.getElementById('start-button').addEventListener('click', () => {
  window.postMessage({
    command: "guess-text",
  }, "*");
})

document.getElementById('redact-button').addEventListener('click', () => {
  var text_to_redact = <HTMLInputElement>document.getElementById("text_to_redact");
  var offset_x = <HTMLInputElement>document.getElementById("redacted_offset_x");
  var offset_y = <HTMLInputElement>document.getElementById("redacted_offset_y");

  window.postMessage({
    command: "redact-text",
    text: text_to_redact.value.toString(),
    offset_x: offset_x.value.toString(),
    offset_y: offset_y.value.toString(),
  }, "*");
})
