'use strict';

let globalShortcut = require('global-shortcut');
let BrowserWindow = require('browser-window');
let dialog = require('dialog');
let shell = require('shell');
let path = require('path');
let menu = require('menu');
let app = require('app');
let ipc = require('ipc');
let fs = require('fs');

let menubar = require('menubar');

const mb = menubar({
  width: 600,
  height: 400,
  preloadWindow: true,
  index: 'http://hypem.com/popular',
  icon: path.join(__dirname, 'assets', 'pauseTemplate.png'),
  'min-width': 400,
  'min-height': 300,
  'web-preferences': {
    preload: path.join(__dirname, 'assets', 'inject.js')
  }
});

mb.on('ready', function () {
  let _meta;
  let _status;
	let contextMenu = menu.buildFromTemplate([
    { label: 'Next Track', acceletator: 'MediaNextTrack', click: function() { mb.window.webContents.send('next-track'); } },
    { label: 'Play/Pause', acceletator: 'MediaPlayPause', click: function() { mb.window.webContents.send('playpause'); } },
    { label: 'Previous Track', acceletator: 'MediaPreviousTrack', click: function() { mb.window.webContents.send('previous-track'); } },
		{ type: 'separator' },
		{ label: 'Favorite', accelerator: 'Ctrl+Alt+Cmd+F', click: function() { mb.window.webContents.send('favorite'); } },
		{ type: 'separator' },
		{ label: 'Quit', accelerator: 'Command+Q', click: function () {
			dialog.showMessageBox(null, {
				type: 'question',
				buttons: ['Don\'t Quit', 'Quit'],
				message: 'Are you sure you want to quit?'
			}, function (idx) {
				if (idx === 1) {
					mb.app.quit();
				}
			});
		}}
	]);
  function setImage() {
    if (_status === undefined || _meta === undefined) { return; }
    let status = (_status === 'PLAYING') ? 'play' : 'pause';
    let favorite = _meta.favStatus ? 'favorite' : '';
    let filename = `${status}${favorite}Template.png`;
    mb.tray.setImage(path.join(__dirname, 'assets', filename));
  }
  ipc.on('track-change', (e, meta) => {
    _meta = meta;
    mb.tray.setToolTip(`${meta.artist} - ${meta.song}`)
    setImage();
  });
  ipc.on('status-change', (e, status) => {
    _status = status;
    setImage();
  });
  mb.tray.on('right-clicked', function () {
		mb.tray.popUpContextMenu(contextMenu);
  });
});


mb.on('after-create-window', function () {
  const page = mb.window.webContents;
  globalShortcut.register('MediaPlayPause', function () {
    page.send('playpause');
  });
  globalShortcut.register('Ctrl+Alt+Cmd+F', function () {
    page.send('favorite');
  });
  globalShortcut.register('MediaNextTrack', function () {
    page.send('next-track');
  });
  globalShortcut.register('MediaPreviousTrack', function () {
    page.send('previous-track');
  });
  mb.window.on('closed', function () {
    globalShortcut.unregister('MediaPlayPause');
  });
  page.on('dom-ready', function () {
    page.insertCSS(fs.readFileSync(path.join(__dirname, 'assets', 'inject.css'), 'utf8'));
  });

  page.on('new-window', function (e, url) {
    e.preventDefault();
    shell.openExternal(url);
  });
});

mb.app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    mb.app.quit();
  }
});
