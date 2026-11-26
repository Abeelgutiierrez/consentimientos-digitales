/* Demo guiada: sigue al formulario del iframe y avanza los pasos de la guía. */
(function () {
  'use strict';
  var CFG = window.DEMO_CONFIG || {};
  var frame = document.getElementById('dm-frame');
  var status = document.getElementById('dm-status');
  var panelBtn = document.getElementById('dm-panel');
  var restart = document.getElementById('dm-restart');
  var s1 = document.getElementById('dm-s1');
  var s2 = document.getElementById('dm-s2');
  var s3 = document.getElementById('dm-s3');
  var baseHref = panelBtn.getAttribute('href');

  function setState(el, state) { el.setAttribute('data-state', state); }

  function onFrameLoad() {
    var path = '';
    try { path = frame.contentWindow.location.pathname; } catch (e) { return; }
    var m = /\/gracias\/(\w+)$/.exec(path);
    if (m) {
      setState(s1, 'done');
      setState(s2, 'active');
      setState(s3, '');
      status.textContent = '¡Firmado! Ya está en el panel del estudio.';
      if (CFG.open) {
        panelBtn.setAttribute('href', '/demo/entrar?estudio=' + encodeURIComponent(CFG.slug) + '&ir=' + encodeURIComponent('/panel/consentimientos/' + m[1]));
        panelBtn.firstChild.textContent = 'Ver tu consentimiento en el panel ';
      }
      panelBtn.classList.add('pulse');
    } else {
      setState(s1, 'active');
      setState(s2, '');
      status.textContent = 'Esperando tu firma…';
      panelBtn.classList.remove('pulse');
    }
  }

  frame.addEventListener('load', onFrameLoad);
  panelBtn.addEventListener('click', function () {
    if (s1.getAttribute('data-state') === 'done') { setState(s2, 'done'); setState(s3, 'active'); }
  });
  restart.addEventListener('click', function () {
    frame.src = '/s/' + encodeURIComponent(CFG.slug) + '?demo=1';
    panelBtn.setAttribute('href', baseHref);
    panelBtn.firstChild.textContent = 'Abrir el panel del estudio ';
  });
})();
