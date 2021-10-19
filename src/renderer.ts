// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

window.addEventListener("message", (event) => {
  playClip(event.data.toString());
});

async function playClip(clip: string) {
  console.log(clip)
}

document.getElementById('start-button').addEventListener('click', () => {
  window.postMessage({
    command: 'redact',
    text: "This is super secret",
  }, "*");
})
