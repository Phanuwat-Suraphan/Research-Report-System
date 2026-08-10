document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.matches('[data-confirm]')) {
    const msg = form.getAttribute('data-confirm');
    if (!window.confirm(msg)) {
      e.preventDefault();
    }
  }
});
