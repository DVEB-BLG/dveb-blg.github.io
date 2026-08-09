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

  const steps = quiz.querySelectorAll('.quiz-step:not(.quiz-success)');
  const dots = document.querySelectorAll('.quiz-dot');
  let current = 0;
  const totalSteps = steps.length; // 4 steps: 0,1,2,3

  // Track which steps have been completed/validated
  let maxReached = 0;

  function showStep(i) {
    steps.forEach(function(s, idx) {
      s.classList.toggle('active', idx === i);
    });
    dots.forEach(function(d, idx) {
      d.classList.toggle('active', idx === i);
      d.classList.toggle('done', idx < i);
    });
  }

  // Validate step before proceeding
  function validateStep(stepIdx) {
    var step = steps[stepIdx];
    var errorEl = step.querySelector('.quiz-error');
    if (errorEl) errorEl.style.display = 'none';

    if (stepIdx === 0) {
      // Тип инспекции — must select at least one
      var checked = step.querySelectorAll('input[name="inspectionType"]:checked');
      if (checked.length === 0) {
        if (errorEl) errorEl.style.display = 'block';
        return false;
      }
    }

    if (stepIdx === 1) {
      // Тип объекта — must select exactly one (single select)
      var checkedObj = step.querySelectorAll('input[name="objectType"]:checked');
      if (checkedObj.length === 0) {
        if (errorEl) errorEl.style.display = 'block';
        return false;
      }
      // If "Другое" selected, text field must be filled
      var otherChecked = step.querySelector('#otherOption');
      if (otherChecked && otherChecked.checked) {
        var otherText = document.getElementById('otherInput');
        if (otherText && !otherText.value.trim()) {
          if (errorEl) {
            errorEl.textContent = 'Пожалуйста, укажите свой вариант';
            errorEl.style.display = 'block';
          }
          return false;
        }
      }
    }

    if (stepIdx === 2) {
      // Контакты — name and phone required
      var name = step.querySelector('input[name="name"]');
      var phone = step.querySelector('input[name="phone"]');
      if ((name && !name.value.trim()) || (phone && !phone.value.trim())) {
        if (errorEl) errorEl.style.display = 'block';
        return false;
      }
    }

    return true;
  }

  // Next button handler
  quiz.querySelectorAll('.quiz-next').forEach(function(btn) {
    btn.addEventListener('click', function() {
      // Find the step this button belongs to
      var step = this.closest('.quiz-step');
      var stepIdx = Array.prototype.indexOf.call(steps, step);

      if (!validateStep(stepIdx)) return;

      if (stepIdx < totalSteps - 1) {
        stepIdx++;
        current = stepIdx;
        if (current > maxReached) maxReached = current;
        showStep(current);
      }
    });
  });

  // Prev button handler
  quiz.querySelectorAll('.quiz-prev').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var step = this.closest('.quiz-step');
      var stepIdx = Array.prototype.indexOf.call(steps, step);
      if (stepIdx > 0) {
        stepIdx--;
        current = stepIdx;
        showStep(current);
      }
    });
  });

  // Option selection — handle single-select steps AND multi-select steps
  document.querySelectorAll('.quiz-option').forEach(function(opt) {
    opt.addEventListener('click', function(e) {
      // Prevent the label from toggling twice
      e.preventDefault();
      var input = this.querySelector('input');
      if (!input) return;

      var step = this.closest('.quiz-step');
      var isSingle = step && step.dataset.single === 'true';

      if (isSingle) {
        // Deselect all others in this step
        step.querySelectorAll('.quiz-option').forEach(function(o) {
          o.classList.remove('selected');
          var inp = o.querySelector('input');
          if (inp) inp.checked = false;
        });
        input.checked = true;
        this.classList.add('selected');
      } else {
        input.checked = !input.checked;
        this.classList.toggle('selected', input.checked);
      }

      // Handle "Другое" — show/hide text input
      if (input.id === 'otherOption') {
        var otherInput = document.getElementById('otherInput');
        if (otherInput) {
          otherInput.style.display = input.checked ? 'block' : 'none';
          if (!input.checked) otherInput.value = '';
        }
      }

      // Hide error when something is selected
      var errorEl = step.querySelector('.quiz-error');
      if (errorEl) errorEl.style.display = 'none';
    });
  });

  // Hide contact step errors on input
  steps.forEach(function(step, idx) {
    if (idx === 2) {
      step.querySelectorAll('input').forEach(function(inp) {
        inp.addEventListener('input', function() {
          var errorEl = step.querySelector('.quiz-error');
          if (errorEl) errorEl.style.display = 'none';
        });
      });
    }
  });

  // ===== SUBMIT =====
  quiz.addEventListener('submit', function(e) {
    e.preventDefault();

    // Validate all steps up to the last
    for (var i = 0; i < totalSteps - 1; i++) {
      if (!validateStep(i)) {
        current = i;
        showStep(i);
        return;
      }
    }

    // Check consent
    var consent = document.getElementById('consentCheck');
    var consentError = document.getElementById('error-consent');
    if (consent && !consent.checked) {
      if (consentError) consentError.style.display = 'block';
      consent.closest('.consent-checkbox').style.borderColor = '#e53935';
      return;
    }

    // Check files for size
    var files = window.DVEB_getSelectedFiles ? window.DVEB_getSelectedFiles() : [];
    var sizeOk = true;
    files.forEach(function(f) { if (f.size > 30 * 1024 * 1024) sizeOk = false; });
    if (!sizeOk) {
      alert('Один или несколько файлов превышают 30 МБ. Уберите их.');
      return;
    }

    var data = new FormData(quiz);
    var payload = { formType: 'Заявление на инспекцию' };
    for (var key of data.keys()) {
      var values = data.getAll(key);
      payload[key] = values.length > 1 ? values.join(', ') : values[0];
    }

    // If "Другое" selected, append custom text
    var otherOpt = document.getElementById('otherOption');
    if (otherOpt && otherOpt.checked) {
      var otherText = document.getElementById('otherInput');
      if (otherText && otherText.value.trim()) {
        payload['objectType'] = 'Другое: ' + otherText.value.trim();
      }
    }

    var submitBtn = quiz.querySelector('.quiz-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    submitForm(payload);

    if (files.length > 0) {
      var uploaded = 0;
      files.forEach(function(f) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var base64 = ev.target.result.split(',')[1];
          fetch(window.DVEB_FORM_BACKEND, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadFile: true,
              fileName: f.name,
              mimeType: f.type || 'application/octet-stream',
              fileData: base64,
              clientName: payload.name || 'Без_имени'
            })
          }).then(function() {
            uploaded++;
            if (submitBtn) submitBtn.textContent = 'Загрузка файлов... (' + uploaded + '/' + files.length + ')';
            if (uploaded === files.length) showSuccess();
          }).catch(function() {
            uploaded++;
            if (uploaded === files.length) showSuccess();
          });
        };
        reader.readAsDataURL(f);
      });
    } else {
      showSuccess();
    }

    function showSuccess() {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Отправить →'; }

      // Hide ALL steps including consent
      steps.forEach(function(s) { s.classList.remove('active'); });

      // Hide consent section
      var consentSection = document.getElementById('consentSection');
      if (consentSection) consentSection.style.display = 'none';

      // Hide progress dots
      var progress = document.getElementById('quizProgress');
      if (progress) progress.style.display = 'none';

      // Show success
      var success = document.getElementById('quizSuccess');
      if (success) success.classList.add('active');

      setTimeout(function() {
        var mailLink = document.getElementById('mailLink');
        if (mailLink) {
          var body = Object.keys(payload).map(function(k) {
            return k + ': ' + (payload[k] || '—');
          }).join('\n');
          mailLink.href = 'mailto:office@двэб.рф?subject=Заявление на инспекцию&body=' + encodeURIComponent(body);
        }
      }, 500);
    }
  });

  showStep(0);
})();

// ===== FILE UPLOAD =====
(function() {
  var dropZone = document.getElementById('fileDropZone');
  var fileInput = document.getElementById('fileInput');
  var fileList = document.getElementById('fileList');
  var fileTotal = document.getElementById('fileTotal');
  if (!dropZone || !fileInput) return;

  var MAX_SIZE = 30 * 1024 * 1024;
  var selectedFiles = [];
  var allowedExt = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.dwg','.rtf','.odt','.ods','.txt','.csv'];

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1048576).toFixed(1) + ' МБ';
  }

  function updateFileList() {
    fileList.innerHTML = '';
    var totalSize = 0;
    var hasError = false;

    selectedFiles.forEach(function(f, idx) {
      totalSize += f.size;
      var item = document.createElement('div');
      item.className = 'file-item';
      var ext = '.' + f.name.split('.').pop().toLowerCase();
      var sizeError = f.size > MAX_SIZE;
      if (sizeError) hasError = true;
      item.innerHTML = '<span class="file-item-icon">📄</span>' +
        '<span class="file-item-name">' + f.name + (sizeError ? ' ⚠️ слишком большой' : '') + '</span>' +
        '<span class="file-item-size">' + formatSize(f.size) + '</span>' +
        '<span class="file-item-remove" data-idx="' + idx + '">✕</span>';
      fileList.appendChild(item);
    });

    if (selectedFiles.length > 0) {
      fileTotal.style.display = 'block';
      fileTotal.className = hasError ? 'file-total error' : 'file-total';
      fileTotal.textContent = 'Всего файлов: ' + selectedFiles.length + ', размер: ' + formatSize(totalSize) +
        (hasError ? ' — уберите файлы больше 30 МБ' : '');
    } else {
      fileTotal.style.display = 'none';
    }
  }

  function addFiles(files) {
    Array.prototype.forEach.call(files, function(f) {
      var ext = '.' + f.name.split('.').pop().toLowerCase();
      if (allowedExt.indexOf(ext) === -1) {
        alert('Формат "' + ext + '" не поддерживается: ' + f.name);
        return;
      }
      selectedFiles.push(f);
    });
    updateFileList();
  }

  dropZone.addEventListener('click', function() { fileInput.click(); });
  fileInput.addEventListener('change', function() { addFiles(this.files); this.value = ''; });

  dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  fileList.addEventListener('click', function(e) {
    if (e.target.classList.contains('file-item-remove')) {
      var idx = parseInt(e.target.dataset.idx);
      selectedFiles.splice(idx, 1);
      updateFileList();
    }
  });

  window.DVEB_getSelectedFiles = function() { return selectedFiles; };
})();
