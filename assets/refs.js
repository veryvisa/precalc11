/* Reference rows: a video loads only after a tap (youtube-nocookie, starts where the idea is explained); copy button for Desmos lines. No tracking before a tap. */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var y = e.target.closest && e.target.closest('.ytb[data-yt]');
    if (y) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(y.getAttribute('data-yt')) + '?rel=0&autoplay=1&start=' + (parseInt(y.getAttribute('data-start'), 10) || 0);
      f.title = 'YouTube video'; f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen'; f.setAttribute('allowfullscreen', ''); f.className = 'yt-frame'; f.loading = 'lazy';
      var holder = document.createElement('div'); holder.className = 'ytb-frame'; holder.appendChild(f); y.replaceWith(holder); return;
    }
    var c = e.target.closest && e.target.closest('.cp[data-copy]');
    if (c) {
      var t = c.getAttribute('data-copy'), done = function () { var o = c.textContent; c.textContent = '✓'; setTimeout(function () { c.textContent = o; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () {});
      else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (er) {} ta.remove(); }
    }
  });
})();
