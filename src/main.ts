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

// Main process
ipcMain.handle('redact', async (event, message) => {
  const result = await redact(message);
  return result
})

async function redact(message: any) {
  var result: any;

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
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
  win.destroy();
  const imageData = image ? image.toPNG() : Buffer.from('');
  const blockSize = 8;

  var gimp_width = 0;
  var gimp_height = 0;
  await Jimp.read(path.join(__dirname, "../redacted_gimp_8x8.png")).then(gimp_image => {
    gimp_width = gimp_image.bitmap.width;
    gimp_height = gimp_image.bitmap.height;
  });

  await Jimp.read(imageData).then(async (image) => {
    // TODO HARDCODED
    image.crop(8, 8, gimp_width, gimp_height);

    // Do stuff with the image.
    var original = image.clone();
    original.scan(0, 0, original.bitmap.width, original.bitmap.height, function(x, y, idx) {
      // x, y is the position of this pixel on the image
      // idx is the position start position of this rgba tuple in the bitmap Buffer
      // this is the image

      // Only do this calculation if the image and original are identical for this pixel
      //  If they're different, then we've already modified this pixel. Move on
      if ((original.bitmap.data[idx] === image.bitmap.data[idx]) && (original.bitmap.data[idx+1] === image.bitmap.data[idx+1]) &&
         (original.bitmap.data[idx+2] === image.bitmap.data[idx+2]) && (original.bitmap.data[idx+3] === image.bitmap.data[idx+3]))
      {

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

        // Now fill in the pixels for the whole block
        for (var i = 0; i < blockSize; i ++) {
          for (var j = 0; j < blockSize; j ++) {
            if ((upper_left_x + i) < original.bitmap.width && (upper_left_y + j) < original.bitmap.height){
              image.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 0] = red   / pixelCount;
              image.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 1] = green / pixelCount;
              image.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 2] = blue  / pixelCount;
              image.bitmap.data[((upper_left_x + i) * 4) + ((upper_left_y + j) * rowsize) + 3] = alpha / pixelCount;
            }
          }
        }
      }
    }
    );

    await Jimp.read(path.join(__dirname, "../redacted_gimp_8x8.png")).then(async (gimp_image) => {
      const threshold = 0.02;
      const percent_tried = message.text.length / message.totalLength

      // Crop both images and adjust brightness
      image.crop(0, 0, image.bitmap.width * percent_tried, 40);
      gimp_image.crop(0, 0, image.bitmap.width, image.bitmap.height);
      image.brightness(0.4);    // TODO HARDCODED

      const diff = await Jimp.diff(gimp_image, image, threshold).percent;
      // console.log(message.text, diff);

      const dataURI = await image.getBase64Async(Jimp.MIME_PNG);

      // mainWindow.webContents.send('gatherResults', {guess: message.text, score: diff, imageData: dataURI});

      gimp_image.writeAsync("gimp_original.png");
      image.writeAsync("redacted.png");
      result = {guess: message.text, score: diff, imageData: dataURI};
    });
  });
  await result;
  return result;
};
