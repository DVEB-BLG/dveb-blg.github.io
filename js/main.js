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
    var data = new FormData(quiz);
    var payload = {};
    for (var key of data.keys()) {
      var values = data.getAll(key);
      payload[key] = values.length > 1 ? values.join(', ') : values[0];
    }

    var inspectionType = payload.inspectionType || '';
    var objectType = payload.objectType || '';
    var org = payload.organization || '';
    var name = payload.name || '';
    var phone = payload.phone || '';
    var email = payload.email || '';
    var message = payload.message || '';

    var text = 'Новое заявление с сайта ДВЭБ%0A%0A' +
      'Тип: ' + encodeURIComponent(inspectionType) + '%0A' +
      'Объект: ' + encodeURIComponent(objectType) + '%0A' +
      'Организация: ' + encodeURIComponent(org) + '%0A' +
      'Имя: ' + encodeURIComponent(name) + '%0A' +
      'Телефон: ' + encodeURIComponent(phone) + '%0A' +
      'Email: ' + encodeURIComponent(email) + '%0A' +
      'Комментарий: ' + encodeURIComponent(message);

    steps.forEach(function(s) { s.classList.remove('active'); });
    var success = document.getElementById('quizSuccess');
    if (success) success.classList.add('active');

    setTimeout(function() {
      var mailLink = document.getElementById('mailLink');
      if (mailLink) {
        mailLink.href = 'mailto:office@двэб.рф?subject=Заявление на инспекцию&body=' + text.replace(/%0A/g, '%0D%0A');
      }
    }, 500);
  });

  showStep(0);
})();
