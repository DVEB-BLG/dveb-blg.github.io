// ===== MOBILE MENU =====
document.getElementById('burger')?.addEventListener('click', function() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
});

// ===== SCROLL REVEAL =====
(function() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function(el) { observer.observe(el); });
  } else {
    reveals.forEach(function(el) { el.classList.add('visible'); });
  }
})();

// ===== FORM SUBMIT HELPER =====
function submitForm(payload) {
  var backend = window.DVEB_FORM_BACKEND;
  if (backend) {
    return fetch(backend, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function() {});
  }
  // Фолбэк: открываем mailto с данными
  var body = Object.keys(payload).map(function(k) {
    return k + ': ' + (payload[k] || '—');
  }).join('\n');
  window.location.href = 'mailto:office@двэб.рф?subject=Заявка с сайта ДВЭБ&body=' + encodeURIComponent(body);
  return Promise.resolve();
}

// ===== QUIZ LOGIC =====
(function() {
  const quiz = document.getElementById('quizForm');
  if (!quiz) return;

  const steps = quiz.querySelectorAll('.quiz-step');
  const dots = document.querySelectorAll('.quiz-dot');
  let current = 0;

  function showStep(i) {
    steps.forEach(function(s, idx) {
      s.classList.toggle('active', idx === i);
    });
    dots.forEach(function(d, idx) {
      d.classList.toggle('active', idx === i);
      d.classList.toggle('done', idx < i);
    });
    var prevBtn = quiz.querySelector('.quiz-prev');
    var nextBtn = quiz.querySelector('.quiz-next');
    var submitBtn = quiz.querySelector('.quiz-submit');
    if (prevBtn) prevBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.style.display = i === steps.length - 2 ? 'none' : 'inline-flex';
    if (submitBtn) submitBtn.style.display = i === steps.length - 2 ? 'inline-flex' : 'none';
  }

  quiz.querySelector('.quiz-next')?.addEventListener('click', function() {
    if (current < steps.length - 2) { current++; showStep(current); }
  });

  quiz.querySelector('.quiz-prev')?.addEventListener('click', function() {
    if (current > 0) { current--; showStep(current); }
  });

  // Option selection
  document.querySelectorAll('.quiz-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      var input = this.querySelector('input');
      if (input) {
        var step = this.closest('.quiz-step');
        if (step && step.dataset.single === 'true') {
          step.querySelectorAll('.quiz-option').forEach(function(o) {
            o.classList.remove('selected');
            var inp = o.querySelector('input');
            if (inp) inp.checked = false;
          });
        }
        input.checked = !input.checked;
        this.classList.toggle('selected', input.checked);
      }
    });
  });

  // Submit
  quiz.addEventListener('submit', function(e) {
    e.preventDefault();

    // Проверка чекбокса согласия
    var consent = document.getElementById('consentCheck');
    if (consent && !consent.checked) {
      consent.closest('.consent-checkbox').style.borderColor = '#e53935';
      return;
    }

    var data = new FormData(quiz);
    var payload = { formType: 'Заявление на инспекцию' };
    for (var key of data.keys()) {
      var values = data.getAll(key);
      payload[key] = values.length > 1 ? values.join(', ') : values[0];
    }

    // Отправляем на бэкенд
    submitForm(payload);

    // Показываем успех
    steps.forEach(function(s) { s.classList.remove('active'); });
    var success = document.getElementById('quizSuccess');
    if (success) success.classList.add('active');

    // Запасной mailto-линк
    setTimeout(function() {
      var mailLink = document.getElementById('mailLink');
      if (mailLink) {
        var body = Object.keys(payload).map(function(k) {
          return k + ': ' + (payload[k] || '—');
        }).join('\n');
        mailLink.href = 'mailto:office@двэб.рф?subject=Заявление на инспекцию&body=' + encodeURIComponent(body);
      }
    }, 500);
  });

  showStep(0);
})();
