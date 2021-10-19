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
  console.log('got an IPC message', message.command, message.text);

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
  var htmlstring = 'data:text/html;charset=utf-8,<HTML/><body style="background-color:white;"><div style="font-size: 48px">XYZXYZ</div></body></HTML>'
  await win.loadURL(htmlstring.replace('XYZXYZ', message.text));
  // win.loadFile(path.join(__dirname, "../redact_template.html"))
  // win.webContents.send("")

  const image = await win.capturePage();
  console.log(image);
  console.log(image.getSize());

  const imageData = image ? image.toPNG() : Buffer.from('');
  console.log(imageData.length);
  console.log(imageData);

  Jimp.read(imageData)
  .then(image => {
    // Do stuff with the image.
    image.writeAsync("blaaaaaaaah1.png");
    image.pixelate(6).writeAsync("blaaaaaaaah2.png");
  });


  // var i = 0;
  // while (i < imageData.length) {
  //   console.log(imageData[i]);
  //   i++;
  // }

  // nativeImage.createFromBuffer(buffer[, options])​

  // fs.writeFile("blahblah.png", imageData, {mode: 0o600, encoding: null}, (err: Error) => {
  //   err ? console.error(err) : null;
  // });

});
