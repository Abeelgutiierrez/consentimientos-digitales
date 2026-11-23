/* Panel de firma sin dependencias: guarda trazos vectoriales {w, h, strokes}. */
(function () {
  'use strict';

  function SignaturePad(container, onChange) {
    this.box = container;
    this.canvas = container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.strokes = [];
    this.current = null;
    this.w = 0;
    this.h = 0;
    this.onChange = onChange || function () {};
    this._bind();
    this.resize();
  }

  SignaturePad.prototype._bind = function () {
    var self = this;
    var c = this.canvas;
    function pos(e) {
      var r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    c.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignorar */ }
      self.current = [pos(e)];
      self.strokes.push(self.current);
      self.redraw();
    });
    c.addEventListener('pointermove', function (e) {
      if (!self.current) return;
      e.preventDefault();
      var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (var i = 0; i < events.length; i++) {
        var p = pos(events[i]);
        var last = self.current[self.current.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.2) self.current.push(p);
      }
      self.redraw();
    });
    function end() {
      if (!self.current) return;
      self.current = null;
      self.box.classList.toggle('signed', !self.isEmpty());
      self.onChange();
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', end);
    window.addEventListener('resize', function () { self.resize(); });
  };

  SignaturePad.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = window.devicePixelRatio || 1;
    // Reescalar los trazos existentes al nuevo tamaño
    if (this.w && this.h && (this.w !== r.width || this.h !== r.height)) {
      var sx = r.width / this.w;
      var sy = r.height / this.h;
      this.strokes = this.strokes.map(function (s) { return s.map(function (p) { return [p[0] * sx, p[1] * sy]; }); });
    }
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  };

  SignaturePad.prototype.redraw = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.strokeStyle = '#1b1f3b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < this.strokes.length; i++) {
      var s = this.strokes[i];
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      if (s.length === 1) ctx.lineTo(s[0][0] + 0.5, s[0][1] + 0.5);
      for (var j = 1; j < s.length - 1; j++) {
        var mx = (s[j][0] + s[j + 1][0]) / 2;
        var my = (s[j][1] + s[j + 1][1]) / 2;
        ctx.quadraticCurveTo(s[j][0], s[j][1], mx, my);
      }
      if (s.length > 1) ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]);
      ctx.stroke();
    }
  };

  SignaturePad.prototype.clear = function () {
    this.strokes = [];
    this.current = null;
    this.box.classList.remove('signed');
    this.redraw();
    this.onChange();
  };

  SignaturePad.prototype.isEmpty = function () {
    return !this.strokes.some(function (s) { return s.length > 1; });
  };

  SignaturePad.prototype.toData = function () {
    return { w: this.w, h: this.h, strokes: this.strokes.filter(function (s) { return s.length > 0; }) };
  };

  window.SignaturePad = SignaturePad;
})();
