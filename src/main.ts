import { app, BrowserWindow } from "electron";
import * as path from "path";
import { ipcMain } from 'electron';
import Jimp from 'jimp';

// Hardcoded constants
const blockSize = 8;

var mainWindow: any = null
var redacted_image: any = null
var blank_background: any = null

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

  Jimp.read(path.join(__dirname, "../secret.png")).then(gimp_image => {
    redacted_image = gimp_image;
    blank_background = new Jimp(redacted_image.bitmap.width, redacted_image.bitmap.height, 'white', (err: any, image: any)  => {
    if (err) throw err
    })
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

// Given an image, where is the blue line indicating the end of text?
async function getBlueMargin(image: any) {
  const rowsize = image.bitmap.width * 4;

  var margin = 0;
  var center = 0;
  var found = false;
  // Scan a single row, in the middle so we're sure to hit the blue box
  image.scan(0, image.bitmap.height/2, image.bitmap.width, 1, function(x: number, y: number, idx: number) {
    const red = image.bitmap.data[(x * 4) + (y * rowsize) + 0];
    const green = image.bitmap.data[(x * 4) + (y * rowsize) + 1];
    const blue = image.bitmap.data[(x * 4) + (y * rowsize) + 2];

    if (found === false && blue === 255 && green !== 255 && red !== 255){
      found = true;
      margin = x;
      return x;
    }
  });

  // Now find the vertical center point of the blue box
  found = false;
  var topBlue = 0;
  var botBlue = 0;
  image.scan(margin + 5, 0, 1, image.bitmap.height, function(x: number, y: number, idx: number) {
    const red = image.bitmap.data[(x * 4) + (y * rowsize) + 0];
    const green = image.bitmap.data[(x * 4) + (y * rowsize) + 1];
    const blue = image.bitmap.data[(x * 4) + (y * rowsize) + 2];

    if (found === false && blue === 255 && green !== 255 && red !== 255){
      found = true;
      topBlue = y;
    }
    if (found === true && blue === 255 && green === 255 && red === 255){
      found = false;
      botBlue = y;
    }
  });

  center = (topBlue + botBlue) / 2;

  return [margin, center];
};

// Given an image, how many blank pixels are there on the right and left of it?
async function getMargins(image: any) {
  const rowsize = image.bitmap.width * 4;

  // Scan a single row, in the middle
  var hitRed = false;
  var left_edge = 0;
  image.scan(0, image.bitmap.height/2, image.bitmap.width, 1, function(x: number, y: number, idx: number) {
    const red = image.bitmap.data[(x * 4) + (y * rowsize) + 0];
    const green = image.bitmap.data[(x * 4) + (y * rowsize) + 1];
    const blue = image.bitmap.data[(x * 4) + (y * rowsize) + 2];

    // Left edge
    if (hitRed === false && (green !== 255 && red === 255 && blue !== 255)) {
      hitRed = true;
      left_edge = x;
    }
  });

  return left_edge;
};

// Given a redacted image, what where is the left edge of where the text actually starts?
async function getLeftEdge(image: any) {
  const rowsize = image.bitmap.width * 4;
  var left_edge = image.bitmap.width;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x: number, y: number, idx: number) {
    const red = image.bitmap.data[(x * 4) + (y * rowsize) + 0];
    const green = image.bitmap.data[(x * 4) + (y * rowsize) + 1];
    const blue = image.bitmap.data[(x * 4) + (y * rowsize) + 2];
    // Left edge
    if (x < left_edge && green !== 255 && red !== 255 && blue !== 255) {
      left_edge = x;
    }
  });

  if (left_edge === image.bitmap.width) {
    return 0;
  }

  return left_edge;
}

async function redact(message: any) {
  var result: any;

  if (message.redacted_image !== undefined) {
    // Pull out the redacted image we'll be using
    redacted_image = await Jimp.read(Buffer.from(message.redacted_image.replace(/^data:image\/png;base64,/, ""), 'base64'));
  }

  const win = new BrowserWindow({
    width: 400,
    height: 120,
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
  var htmlstring = "\
  data:text/html;charset=utf-8, \
  <HTML/> \
  <body style=\"padding: 8px 0px 0px 8px; background-color:white;\"> \
  <span style=\"padding 0px 0px 0px 0px; font-weight: normal; line-spacing: 0px; word-spacing: 0px; white-space: pre; margin: 0; font-size: 32px; font-family:'Arial'\">XYZXYZ</span><span style=\"padding 0px 0px 0px 0px; margin: 0; color: blue; font-size: 32px; font-family:'Arial'\">█</span> \
  </body> \
  </HTML> \
  "
  await win.loadURL(htmlstring.replace('XYZXYZ', message.text));
  const image = await win.capturePage();
  win.destroy();
  const imageData = image ? image.toPNG() : Buffer.from('');
  const offset_x = message.offset_x;
  const offset_y = message.offset_y;

  await Jimp.read(imageData).then(async (image) => {
    // Find the blue line that demarks the end of the guess string
    var margins = await getBlueMargin(image)
    var blueMargin = margins[0];
    var imageCenter = margins[1];

    // Crop the image down according to the given offset.
    image.crop(offset_x, offset_y, blueMargin-offset_x, image.bitmap.height-offset_y);
    imageCenter -= offset_y; // New center of image

    // Make a 2D array for the new averaged pixels
    var averagePixels = new Array(Math.ceil(image.bitmap.width / blockSize));
    for (var i = 0; i < averagePixels.length; i++) {
      averagePixels[i] = new Array(Math.ceil(image.bitmap.height / blockSize));
      for (var j = 0; j < image.bitmap.height / blockSize; j++) {
        averagePixels[i][j] = new Array(4).fill(-1);
      }
    }

    // Scale up the image so that it's a multiple of blockSize pixels
    // Expand the redacted image with whitespace because it's too small
    const remainder = blockSize - (image.bitmap.width % blockSize);
    if (remainder < blockSize){
      var blank_canvass = new Jimp(image.bitmap.width + remainder, image.bitmap.height, 'white', (err: any, image: any)  => {
      if (err) throw err
      })
      blank_canvass.composite(image, 0, 0, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
      })
      image = blank_canvass;
    }

    // Pixelate the image
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
    const freshly_pixelated = image.clone();
    var left_edge = await getLeftEdge(image);

    // Step 1) Crop image to the same size as the original and adjust brightness to be identical
    const threshold = 0.02;
    const percent_tried = message.text.length / message.totalLength
    //    We need to vertically crop the guess image down to the size of the answer
    //      but also keep the cropping along blocksize boundaries
    var adjustedCenter = imageCenter - (imageCenter % blockSize) + 4;
    image.crop(left_edge, (adjustedCenter) - (redacted_image.bitmap.height / 2), image.bitmap.width - left_edge, redacted_image.bitmap.height); // TODO NEEDED? INTENDED?
    var cropped_redacted_image = redacted_image.clone();
    const guess_image = image.clone();

    // Step 2) Find the area where our new image changed (compared to the previous guess)
    var left_boundary: number = 0;
    var right_boundary: number = 0;
    if (message.previousimage === "") {
      right_boundary = image.bitmap.width;
    } else {
      var replaced_imagedata = message.previousimage.replace(/^data:image\/png;base64,/, "");
      var prev_img_buffer = Buffer.from(replaced_imagedata, 'base64');
      var prev_image = await Jimp.read(prev_img_buffer);

      // Scale up the previous image to make it the same size as our new guess
      var prev_image_scaled = blank_background.clone();
      prev_image_scaled.composite(prev_image, 0, 0, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
      })

      if (image.bitmap.width <= prev_image_scaled.bitmap.width){
        prev_image_scaled.crop(0, 0, image.bitmap.width, prev_image_scaled.bitmap.height);
      }

      // This is the changed area. The diff image is red where it was different
      const diff = await Jimp.diff(image, prev_image_scaled, threshold);
      left_boundary = await getMargins(diff.image);
      //    If the images are identical, then use just the size of the image that changed
      //      This can happen when we guess a bunch of spaces in a row and nothing has changed
      if (left_boundary === 0) {
        left_boundary = prev_image.bitmap.width;
      }
    }

    // Step 3) Crop our image down to just the area that changed
    image.crop(left_boundary, 0, (image.bitmap.width - left_boundary), image.bitmap.height);
    if (blueMargin > cropped_redacted_image.bitmap.width) {
      // Expand the redacted image with whitespace because it's too small
      var blank_canvass = new Jimp(cropped_redacted_image.bitmap.width * 2, cropped_redacted_image.bitmap.height, 'white', (err: any, image: any)  => {
      if (err) throw err
      })
      blank_canvass.composite(cropped_redacted_image, 0, 0, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
      })
      cropped_redacted_image = blank_canvass;
    }
    // Crop the answer image down to the same size as the guess image
    cropped_redacted_image.crop(left_boundary, 0, image.bitmap.width, cropped_redacted_image.bitmap.height);

    // Step 4) Crop the right-most edge off both the guess and answer
    //  This is because there's a large error on that last block due to the next letter bleeding over.
    // Adjust the blue margin over because we cropped a bunch since the last measurement
    const adjustedBlueMargin = ((blueMargin-left_boundary)-left_edge)-offset_x;
    if (image.bitmap.width > adjustedBlueMargin){
      image.crop(0, 0, adjustedBlueMargin, image.bitmap.height);
      cropped_redacted_image.crop(0, 0, adjustedBlueMargin, cropped_redacted_image.bitmap.height);
    }

    // Step 5) Report the similarity score for just that area
    const diff_bounded = await Jimp.diff(image, cropped_redacted_image, threshold);

    // Step 6) Report the similarity score for the whole image
    //    Match up the sizes of the images so we can diff them
    var scaled_guess_image = guess_image.clone();
    if (guess_image.bitmap.width < redacted_image.bitmap.width) {
      var blank_canvass = new Jimp(redacted_image.bitmap.width, redacted_image.bitmap.height, 'white', (err: any, image: any)  => {
      if (err) throw err
      })
      blank_canvass.composite(scaled_guess_image, 0, 0, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
      })
      scaled_guess_image = blank_canvass;
    }

    const diff_final = await Jimp.diff(scaled_guess_image, redacted_image, threshold);
    const dataURI = await guess_image.getBase64Async(Jimp.MIME_PNG);
    result = {
              command: message.command,
              guess: message.text,
              totalScore: diff_final.percent,
              score: diff_bounded.percent,
              imageData: dataURI,
              offset_x: offset_x,
              offset_y: offset_y,
              tooBig: redacted_image.bitmap.width < scaled_guess_image.bitmap.width,
            };

  });
  await result;
  return result;
};
