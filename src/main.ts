import { app, BrowserWindow } from "electron";
import * as path from "path";
const { ipcMain } = require('electron');
import * as fs from 'fs';
import Jimp from 'jimp';

var mainWindow: any = null

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      worldSafeExecuteJavaScript: true,
      contextIsolation: true,
    },
    width: 800,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.once('dom-ready', () => {
    // Make the disconnected label appear first
    mainWindow.webContents.send('disconnected-event', 'disconnected');
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('ipc', (event, arg) => {
  if (arg === "start") {
    console.log("got it!")
  }
})

ipcMain.on('redact', async (event, message) => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      sandbox: true,
      webSecurity: true,
      contextIsolation: true,
      webviewTag: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      nativeWindowOpen: false,
      safeDialogs: true,
    }
  })

  //TODO Do this less janky
  var htmlstring = 'data:text/html;charset=utf-8,<HTML/><body style="background-color:white;"><div style="font-size: 32px; font-family:\'Liberation Serif\'">XYZXYZ</div></body></HTML>'
  await win.loadURL(htmlstring.replace('XYZXYZ', message.text));
  // win.loadFile(path.join(__dirname, "../redact_template.html"))
  // win.webContents.send("")

  const image = await win.capturePage();
  const imageData = image ? image.toPNG() : Buffer.from('');
  const blockSize = 8;

  Jimp.read(imageData).then(image => {
    // Do stuff with the image.
    var original = image.clone();
    original.scan(0, 0, original.bitmap.width, original.bitmap.height, function(x, y, idx) {
      // x, y is the position of this pixel on the image
      // idx is the position start position of this rgba tuple in the bitmap Buffer
      // this is the image

      // Get the running RGBA totals for the relevant NxN block
      var upper_left_x = ~~(x / blockSize) * blockSize;
      var upper_left_y = ~~(y / blockSize) * blockSize;
      var red = 0;
      var green = 0;
      var blue = 0;
      var alpha = 0;
      const rowsize = original.bitmap.width * 4;
      var pixelCount = 0;
      for (var i = 0; i < blockSize; i ++) {
        for (var j = 0; j < blockSize; j ++) {
          // Red
          const redIndex = ((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0;
          if (redIndex < this.bitmap.data.length) {
            red += this.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0];
            pixelCount += 1;
          }

          // Green
          const greenIndex = ((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0;
          if (greenIndex < this.bitmap.data.length) {
            green += this.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 1];
          }

          // Blue
          const blueIndex = ((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0;
          if (blueIndex < this.bitmap.data.length) {
            blue += this.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 2];
          }

          // Alpha
          const alphaIndex = ((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0;
          if (alphaIndex < this.bitmap.data.length) {
            alpha += this.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 3];
          }
        }
      }

      image.bitmap.data[idx + 0] = red   / pixelCount;
      image.bitmap.data[idx + 1] = green / pixelCount;
      image.bitmap.data[idx + 2] = blue  / pixelCount;
      image.bitmap.data[idx + 3] = alpha / pixelCount;
    });

    image.writeAsync("redacted.png");
    original.writeAsync("original.png");
    console.log(Jimp.distance(image, original));
  });
});
