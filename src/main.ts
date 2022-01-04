import { app, BrowserWindow } from "electron";
import * as path from "path";
const { ipcMain } = require('electron');
import * as fs from 'fs';
import Jimp from 'jimp';

var mainWindow: any = null
var redacted_image: any = null

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

  Jimp.read(path.join(__dirname, "../redacted_gimp_8x8.png")).then(gimp_image => {
    redacted_image = gimp_image;
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

// Given an image, how many blank pixels are there on the right and left of it?
async function getMargins(image: any) {
  const rowsize = image.bitmap.width * 4;

  // Scan a single row, in the middle
  var hitRed = false;
  var left_edge = 0;
  var right_edge = 0;
  image.scan(0, image.bitmap.height/2, image.bitmap.width, 1, function(x: number, y: number, idx: number) {
    const red = image.bitmap.data[(x * 4) + (y * rowsize) + 0];
    const green = image.bitmap.data[(x * 4) + (y * rowsize) + 1];
    const blue = image.bitmap.data[(x * 4) + (y * rowsize) + 2];

    // Left edge
    if (hitRed === false && green !== 255){
      hitRed = true;
      left_edge = x;
    }
    if (green !== 255) {
      right_edge = x;
    }
    // console.log(x, y, red, green, blue);
  });

  return [left_edge, right_edge];
};

async function redact(message: any) {
  var result: any;

  const win = new BrowserWindow({
    width: 300,
    height: 80,
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
  var hits = 0

  await Jimp.read(imageData).then(async (image) => {
    // TODO HARDCODED
    image.crop(8, 8, redacted_image.bitmap.width, redacted_image.bitmap.height);

    // Make a 2D array for the new averaged pixels
    var averagePixels = new Array(redacted_image.bitmap.width / blockSize);
    for (var i = 0; i < averagePixels.length; i++) {
      averagePixels[i] = new Array(redacted_image.bitmap.height / blockSize);
      for (var j = 0; j < redacted_image.bitmap.height / blockSize; j++) {
        averagePixels[i][j] = new Array(4).fill(-1);
      }
    }

    // Do stuff with the image.
    var original = image.clone();
    original.scan(0, 0, original.bitmap.width, original.bitmap.height, function(x, y, idx) {
      // x, y is the position of this pixel on the image
      // idx is the position start position of this rgba tuple in the bitmap Buffer
      // this is the image
      var upper_left_x = ~~(x / blockSize) * blockSize;
      var upper_left_y = ~~(y / blockSize) * blockSize;
      const rowsize = original.bitmap.width * 4;

      const conv_x = upper_left_x/blockSize;
      const conv_y = upper_left_y/blockSize;

      // Only do this calculation if we haven't already
      if (averagePixels[conv_x][conv_y][0] === -1)
      {
        // Get the running RGBA totals for the relevant NxN block
        var red = 0;
        var green = 0;
        var blue = 0;
        var alpha = 0;
        var pixelCount = 0;
        for (var i = 0; i < blockSize; i ++) {
          for (var j = 0; j < blockSize; j ++) {
            hits ++;
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

        // Fill in the values to the average array
        averagePixels[conv_x][conv_y][0] = red / pixelCount;
        averagePixels[conv_x][conv_y][1] = green / pixelCount;
        averagePixels[conv_x][conv_y][2] = blue / pixelCount;
        averagePixels[conv_x][conv_y][3] = alpha / pixelCount;
      }

      // Set the pixel equal to the known average
      image.bitmap.data[(x * 4) + (y * rowsize) + 0] = averagePixels[conv_x][conv_y][0];
      image.bitmap.data[(x * 4) + (y * rowsize) + 1] = averagePixels[conv_x][conv_y][1];
      image.bitmap.data[(x * 4) + (y * rowsize) + 2] = averagePixels[conv_x][conv_y][2];
      image.bitmap.data[(x * 4) + (y * rowsize) + 3] = averagePixels[conv_x][conv_y][3];
    }
    );

    // Step 1) Crop image to the same size as the original and adjust brightness to be identical
    const threshold = 0.02;
    const percent_tried = message.text.length / message.totalLength
    image.crop(0, 0, image.bitmap.width, 40);
    const cropped_redacted_image = redacted_image.clone().crop(0, 0, image.bitmap.width, image.bitmap.height); //TODO Remove crop?
    image.brightness(0.4);    // TODO HARDCODED
    const guess_image = image.clone();

    // Step 2) Find the area where our new image changed (compared to the previous guess)
    var left_boundary: number = 0;
    var right_boundary: number = 0;
    if (message.previousimage === "") {
      right_boundary = image.bitmap.width;
    } else {
      // console.log("previous image buffer:");

      var replaced_imagedata = message.previousimage.replace(/^data:image\/png;base64,/, "");
      // console.log(message.previousimage);
      // console.log(replaced_imagedata);

      var prev_img_buffer = Buffer.from(replaced_imagedata, 'base64');

      // console.log(prev_img_buffer);

      var prev_image = await Jimp.read(prev_img_buffer);
      // This is the changed area. The diff image is red where it was different
      const diff = await Jimp.diff(image, prev_image, threshold);
      [left_boundary, right_boundary] = await getMargins(diff.image);
      diff.image.writeAsync(path.join(__dirname, "../test_diff_total.png"));
      prev_image.writeAsync(path.join(__dirname, "../test_prev.png"));
      // image.writeAsync(path.join(__dirname, "../test_new.png"));
      // console.log(left_boundary, right_boundary);
    }

    //TODO Special case for whitespace

    // Step 3) Crop our image down to just the area that changed
    // console.log(left_boundary, right_boundary, width);
    image.crop(left_boundary, 0, right_boundary-left_boundary, image.bitmap.height);
    cropped_redacted_image.crop(left_boundary, 0, right_boundary-left_boundary, image.bitmap.height);

    // Step 4) Report the similarity score for just that area
    const diff_bounded = await Jimp.diff(image, cropped_redacted_image, threshold);
    redacted_image.writeAsync(path.join(__dirname, "../test_redacted_uncropped.png"));
    guess_image.writeAsync(path.join(__dirname, "../test_guess_uncropped.png"));
    image.writeAsync(path.join(__dirname, "../test_guess.png"));
    cropped_redacted_image.writeAsync(path.join(__dirname, "../test_redacted.png"));
    diff_bounded.image.writeAsync(path.join(__dirname, "../test_diff.png"));
    console.log(message.text, diff_bounded.percent);
    const dataURI = await guess_image.getBase64Async(Jimp.MIME_PNG);
    result = {guess: message.text, score: diff_bounded.percent, imageData: dataURI};

    // if (message.text === "t "){
    //   await new Promise(resolve => setTimeout(resolve, 5000));
    // }

  });
  await result;
  return result;
};
