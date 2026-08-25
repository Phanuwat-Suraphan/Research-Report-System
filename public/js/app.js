// Confirmation prompts for destructive forms.
document.addEventListener('submit', function (e) {
  var form = e.target;
  if (form.matches('[data-confirm]') && !window.confirm(form.getAttribute('data-confirm'))) {
    e.preventDefault();
  }
});

// Repeatable link rows on the submission form. Each section keeps a <template>
// of one empty row next to it; "add" clones it, "remove" drops the row (or
// clears it when it is the last one, so the section never disappears).
document.addEventListener('click', function (e) {
  var addBtn = e.target.closest('[data-add-row]');
  if (addBtn) {
    e.preventDefault();
    var container = document.getElementById(addBtn.getAttribute('data-add-row'));
    var template = document.getElementById(addBtn.getAttribute('data-add-row') + '-tpl');
    if (!container || !template) return;
    container.appendChild(template.content.cloneNode(true));
    var added = container.lastElementChild;
    var firstInput = added && added.querySelector('input[type=text]');
    if (firstInput) firstInput.focus();
    return;
  }

  var removeBtn = e.target.closest('[data-remove-row]');
  if (removeBtn) {
    e.preventDefault();
    var row = removeBtn.closest('.linkrow');
    if (!row) return;
    var rows = row.parentElement.querySelectorAll('.linkrow');
    if (rows.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll('input').forEach(function (input) {
        input.value = '';
      });
      var err = row.querySelector('.row-error');
      if (err) err.remove();
    }
  }
});

// Images pulled from Google Drive only load when their owner shared them with
// "anyone with the link". Rather than showing every visitor a broken image,
// swap in the plain cover (gallery) or a short explanation (work page).
// Error events do not bubble, hence the capture-phase listener.
document.addEventListener(
  'error',
  function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';

    var cover = img.closest('.card-cover');
    if (cover) {
      cover.classList.add('card-cover-blank');
      cover.textContent = '';
      var span = document.createElement('span');
      span.textContent = cover.dataset.emoji || '📘';
      cover.appendChild(span);
      return;
    }

    var figure = img.closest('.infographic');
    if (figure) {
      var note = document.createElement('p');
      note.className = 'hint';
      note.textContent = img.dataset.fallback || 'เปิดรูปนี้ไม่ได้';
      img.replaceWith(note);
    }
  },
  true
);
