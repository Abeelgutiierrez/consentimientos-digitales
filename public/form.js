/* Formulario de consentimiento por pasos (móvil primero). */
(function () {
  'use strict';
  var CFG = window.CONSENT_CONFIG;
  var form = document.getElementById('consent-form');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var bars = form.querySelectorAll('.progress i');
  var btnNext = document.getElementById('next');
  var btnPrev = document.getElementById('prev');
  var current = 0;
  var pads = {};

  var STEP_OF = function (field) {
    if (/^(firstName|lastName|dni|birthDate|phone|email|address|minor\.)/.test(field)) return 0;
    if (/^(service|artist|zone|description)$/.test(field)) return 1;
    if (/^(health\.|healthNotes)/.test(field)) return 2;
    if (/^checks\./.test(field)) return 3;
    return 4;
  };

  function $(name) { return form.elements[name]; }
  function val(name) { var el = $(name); return el ? String(el.value || '').trim() : ''; }

  function age() {
    var v = val('birthDate');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    var b = new Date(v + 'T00:00:00');
    var t = new Date();
    var a = t.getFullYear() - b.getFullYear();
    var m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }
  function isMinor() { var a = age(); return a !== null && a >= 0 && a < 18; }

  function setError(field, msg) {
    var box = form.querySelector('[data-field="' + field + '"]');
    if (!box) return;
    box.classList.toggle('has-error', !!msg);
    var e = box.querySelector('.err');
    if (e) e.textContent = msg || '';
  }
  function clearErrors(stepIdx) {
    var scope = stepIdx === undefined ? form : steps[stepIdx];
    Array.prototype.forEach.call(scope.querySelectorAll('.has-error'), function (el) { el.classList.remove('has-error'); });
  }

  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function anyYes() {
    return CFG.questions.some(function (k) { return radio('h_' + k) === 'si'; });
  }

  // ---------- Validación por paso ----------
  function validateStep(i) {
    clearErrors(i);
    var errs = {};
    if (i === 0) {
      if (!val('firstName')) errs.firstName = 'Indica tu nombre';
      if (!val('lastName')) errs.lastName = 'Indica tus apellidos';
      if (val('dni').replace(/[\s-]/g, '').length < 6) errs.dni = 'Documento no válido';
      var a = age();
      if (a === null || a < 0 || a > 110) errs.birthDate = 'Fecha de nacimiento no válida';
      if (val('phone').replace(/\D/g, '').length < 9) errs.phone = 'Teléfono no válido';
      if (val('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errs.email = 'Correo no válido';
      if (isMinor()) {
        if (!val('tutorName')) errs['minor.tutorName'] = 'Indica el nombre del representante legal';
        if (val('tutorDni').replace(/[\s-]/g, '').length < 6) errs['minor.tutorDni'] = 'Documento no válido';
        if (!val('relation')) errs['minor.relation'] = 'Indica la relación';
        if (a < 16 && !$('maturityCert').checked) errs['minor.maturityCert'] = 'Los menores de 16 años deben aportar el certificado de madurez';
      }
    }
    if (i === 1) {
      if (!radio('service')) errs.service = 'Elige un servicio';
      if (!val('artist')) errs.artist = 'Elige el aplicador';
      if (!val('zone')) errs.zone = 'Indica la zona del cuerpo';
    }
    if (i === 2) {
      CFG.questions.forEach(function (k) { if (!radio('h_' + k)) errs['health.' + k] = 'Responde a esta pregunta'; });
      if (anyYes() && !val('healthNotes')) errs.healthNotes = 'Explica brevemente los detalles';
    }
    if (i === 3) {
      if (!$('c_read').checked) errs['checks.read'] = 'Debes confirmar que has leído la información';
      if (!$('c_privacy').checked) errs['checks.privacy'] = 'Necesitamos tu aceptación para continuar';
      if ($('c_marketing').checked && !val('email')) {
        errs['checks.marketing'] = 'Para enviarte el regalo necesitamos tu correo: vuelve al paso 1 para añadirlo o desmarca esta casilla.';
      }
    }
    if (i === 4) {
      if (pads.main.isEmpty()) errs.signature = 'Falta tu firma';
      if (isMinor() && pads.tutor.isEmpty()) errs.tutorSignature = 'Falta la firma del representante legal';
    }
    Object.keys(errs).forEach(function (k) { if (k[0] !== '_') setError(k, errs[k]); });
    var first = steps[i].querySelector('.has-error');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return Object.keys(errs).length === 0;
  }

  // ---------- Contenido dinámico ----------
  function renderInfo() {
    var svc = radio('service') || Object.keys(CFG.info)[0];
    var doc = document.getElementById('info-doc');
    doc.innerHTML = '';
    CFG.info[svc].forEach(function (s) {
      var h = document.createElement('h3'); h.textContent = s.title;
      var p = document.createElement('p'); p.textContent = s.text;
      doc.appendChild(h); doc.appendChild(p);
    });
    var decl = document.getElementById('decl-text');
    decl.innerHTML = '';
    CFG.decl[svc].forEach(function (d, i) {
      var div = document.createElement('div');
      div.textContent = d;
      if (i) div.style.marginTop = '6px';
      decl.appendChild(div);
    });
  }

  function syncMinor() {
    var minor = isMinor();
    var a = age();
    document.getElementById('minor-box').classList.toggle('hidden', !minor);
    document.getElementById('maturity-box').classList.toggle('hidden', !(minor && a < 16));
    document.getElementById('tutor-sig').classList.toggle('hidden', !minor);
    var name = (val('firstName') + ' ' + val('lastName')).trim();
    document.getElementById('sig-label').textContent = name ? 'Firma de ' + name : 'Tu firma';
    document.getElementById('sign-lead').textContent = minor
      ? 'Firma con el dedo y pide a tu padre, madre o tutor que firme debajo.'
      : 'Firma con el dedo dentro del recuadro.';
  }

  function show(i) {
    steps[current].classList.add('hidden');
    current = i;
    steps[i].classList.remove('hidden');
    Array.prototype.forEach.call(bars, function (b, j) { b.classList.toggle('on', j <= i); });
    btnPrev.classList.toggle('hidden', i === 0);
    btnNext.textContent = i === steps.length - 1 ? 'Firmar y enviar' : 'Continuar';
    if (i === 3) renderInfo();
    if (i === 4) {
      syncMinor();
      document.getElementById('sig-date').textContent = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
      if (!pads.main) {
        pads.main = new window.SignaturePad(document.getElementById('pad-main'), function () { setError('signature', ''); });
        pads.tutor = new window.SignaturePad(document.getElementById('pad-tutor'), function () { setError('tutorSignature', ''); });
      }
      pads.main.resize();
      pads.tutor.resize();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Envío ----------
  function payload() {
    var health = {};
    CFG.questions.forEach(function (k) { health[k] = radio('h_' + k) === 'si'; });
    var data = {
      firstName: val('firstName'), lastName: val('lastName'), dni: val('dni'), birthDate: val('birthDate'),
      phone: val('phone'), email: val('email'), address: val('address'),
      service: radio('service'), artist: val('artist'), zone: val('zone'), description: val('description'),
      health: health, healthNotes: anyYes() ? val('healthNotes') : '',
      checks: { read: $('c_read').checked, privacy: $('c_privacy').checked, marketing: $('c_marketing').checked, images: $('c_images').checked },
      signature: pads.main.toData(),
    };
    if (isMinor()) {
      data.minor = { tutorName: val('tutorName'), tutorDni: val('tutorDni'), relation: val('relation'), maturityCert: $('maturityCert').checked };
      data.tutorSignature = pads.tutor.toData();
    }
    return data;
  }

  function submit() {
    var errBox = document.getElementById('submit-error');
    errBox.classList.add('hidden');
    btnNext.disabled = true;
    btnNext.textContent = 'Generando tu consentimiento…';
    fetch('/api/s/' + encodeURIComponent(CFG.slug) + '/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (r) {
      if (r.ok && r.body.redirect) {
        window.location.href = r.body.redirect;
        return;
      }
      var errors = (r.body && r.body.errors) || {};
      var keys = Object.keys(errors);
      if (keys.length) {
        clearErrors();
        keys.forEach(function (k) { setError(k, errors[k]); });
        var target = Math.min.apply(null, keys.map(STEP_OF));
        if (target !== current) show(target);
      } else {
        errBox.textContent = (r.body && r.body.error) || 'No se ha podido enviar. Inténtalo de nuevo.';
        errBox.classList.remove('hidden');
      }
      btnNext.disabled = false;
      btnNext.textContent = current === steps.length - 1 ? 'Firmar y enviar' : 'Continuar';
    }).catch(function () {
      errBox.textContent = 'Sin conexión con el estudio. Comprueba la Wi‑Fi e inténtalo de nuevo.';
      errBox.classList.remove('hidden');
      btnNext.disabled = false;
      btnNext.textContent = 'Firmar y enviar';
    });
  }

  // ---------- Eventos ----------
  btnNext.addEventListener('click', function () {
    if (!validateStep(current)) return;
    if (current === steps.length - 1) submit();
    else show(current + 1);
  });
  btnPrev.addEventListener('click', function () { if (current > 0) show(current - 1); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.addEventListener('input', function (e) {
    var box = e.target.closest('[data-field]');
    if (box) box.classList.remove('has-error');
    if (e.target.name === 'birthDate' || e.target.name === 'firstName' || e.target.name === 'lastName') syncMinor();
  });
  form.addEventListener('change', function (e) {
    if (/^h_/.test(e.target.name)) {
      document.getElementById('notes-box').classList.toggle('hidden', !anyYes());
      var box = e.target.closest('[data-field]');
      if (box) box.classList.remove('has-error');
    }
    if (e.target.name === 'birthDate') syncMinor();
  });
  Array.prototype.forEach.call(form.querySelectorAll('[data-clear]'), function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-clear') === 'pad-main' ? 'main' : 'tutor';
      if (pads[key]) pads[key].clear();
    });
  });
  // Evita que Enter en un campo envíe el formulario por accidente
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); btnNext.click(); }
  });

  show(0);
})();
