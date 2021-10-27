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

ipcRenderer.on('gatherResults', (event, ...args) => {
  // console.log("preload: ", ...args);
  // console.log("preload: ", args[0]);
  window.postMessage(args[0], "file://");
});

process.once('loaded', () => {
  window.addEventListener('message', event => {
    // do something with custom event
    const message = event.data;

    if (message.command === 'redact') {
      ipcRenderer.invoke('redact', message).then((result) => {
        console.log("invoked redaction on : ", message.text, result);
      });
    }
  });
});
