'use strict';
const ipc = require('ipc');
const remote = require('remote');

function loadNextPage(count){
  if (typeof count !== 'number') {
    count = 0;
  }
  if (skip_update_page_contents && count < 20) {
    return setTimeout(loadNextPage, 100, ++count);
  }
  if (window.displayList.page_next) {
    return insert_next_page(loadNextPage);
  }
  window.history.replaceState(null, null, '/popular');
  document.body.offsetHeight;
}

ipc.on('playpause', function () {
  window.togglePlay();
});

ipc.on('next-track', function () {
  window.nextTrack();
});

ipc.on('previous-track', function () {
  window.prevTrack();
});

ipc.on('favorite', function () {
  let notification;
  let args;
  let meta;
  meta = getTrackMetaThunk(displayList)(currentTrack);
  if (meta.favStatus) {
    args = ['./1f494.png', 'Unfavorited on Hype Machine'];
  } else {
    args = ['./2764.png', 'Favorited on Hype Machine'];
  }
  meta.favStatus = !meta.favStatus;
  args.push(`${meta.artist} - ${meta.song}`);
  notification = window.webkitNotifications.createNotification.apply(webkitNotifications, args);
  notification.show();
  setTimeout(() => notification.cancel(), 7500);
  ipc.send('track-change', meta);
  window.toggleFavoriteItem();
});

// do some polyfilling ...
Object.defineProperty(document, 'webkitHidden', {
  get() {
    //return document.hidden;
    return !remote.getCurrentWindow().isVisible();
  }
});

window.webkitNotifications = {
  checkPermission() {
    let possibilities = [ 'granted', 'default', 'denied' ];
    return possibilities.indexOf(window.Notification.permission);
  },
  requestPermission(callback) {
    return window.Notification.requestPermission(callback);
  },
  createNotification(image, title, body) {
    if (/now playing/i.test(title)) {
      image = getIcon(window.currentTrack);
    }
    return {
      set onclick(handler) {
        if (this.notification) {
          this.notification.onclick(handler);
        }
      },
      show() {
        this.notification = new Notification(title, {
          icon: image,
          body
        });
      },
      cancel() {
        if (this.notification && this.notification.close) {
          this.notification.close();
          delete this.notification;
        }
      }
    };
  }
};

var observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    let node, clone;
    if ((node = mutation.removedNodes[0]) && node.id === 'displayList-data') {

      // stop observing
      observer.disconnect();

      // remove event listeners from header
      node = document.getElementById('header');
      clone = node.cloneNode(true);
      node.parentNode.replaceChild(clone, node);

      // disable default action on logo click
      $('#logo-txt').on('click', function (e) {
        return false;
      });

      // kick off loading the next pages
      loadNextPage();
    }
  });
});

function getIcon(idx) {
  var regExp = /.*(https?:\/\/[^)]*)\);/i;
  var meta = displayList.tracks[idx];
  var selector = `#section-track-${meta.id} a.thumb`;
  return document.querySelector(selector).getAttribute('style').match(regExp)[1];
}

function getFavStatus(idx) {
  var meta = displayList.tracks[idx];
  var selector = `#section-track-${meta.id} a.haarp-fav-ctrl`;
  return document.querySelector(selector).classList.contains('fav-on');
}

function getTrackMetaThunk(displayList) {
  if (!(displayList && displayList.tracks)) { return; }
  return function (idx) {
    var meta = displayList.tracks[idx];
    return Object.assign({
      icon: getIcon(idx),
      favStatus: getFavStatus(idx)
    }, meta);
  }
}

(function () {
  var currentTrack = null;
  var playerStatus = null;
  Object.defineProperty(window, 'playerStatus', {
    get() { return playerStatus; },
    set(string) {
      var old = playerStatus;
      playerStatus = string;
      if (playerStatus !== old) { ipc.send('status-change', string); }
    }
  });
  Object.defineProperty(window, 'currentTrack', {
    get() { return currentTrack; },
    set(number) {
      var getTrackMeta = getTrackMetaThunk(window.displayList);
      var old = currentTrack;
      if (getTrackMeta && number !== old) {
        currentTrack = number;
        ipc.send('track-change', getTrackMeta(number));
      }
    }
  });
})();

document.addEventListener('DOMContentLoaded', function () {
  observer.observe(document.getElementById('content'), {childList: true});
}, false);
