// Classic, dependency-free script: visible before Three.js/module downloads.
(() => {
  const splash = document.querySelector('#startupSplash');
  const status = document.querySelector('#startupSplashStatus');
  const progress = document.querySelector('#startupSplashProgress');
  const dismiss = document.querySelector('#startupSplashDismiss');
  const stages = [...splash.querySelectorAll('[data-startup-stage]')];
  const completed = new Set();
  let closed = false, failed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    window.removeEventListener('ahs-startup-stage', update);
    window.removeEventListener('ahs-startup-failed', fail);
    window.removeEventListener('error', onError, true);
    document.querySelector('.studio-shell')?.removeAttribute('inert');
    splash.remove();
  };
  const update = event => {
    if (closed) return;
    completed.add(event.detail);
    stages.forEach(row => {
      const done = completed.has(row.dataset.startupStage);
      row.classList.toggle('complete', done);
      row.querySelector('.startup-stage-state').textContent = done ? 'Ready' : 'Waiting';
    });
    const count = stages.filter(row => completed.has(row.dataset.startupStage)).length;
    progress.value = count;
    const next = stages.find(row => !completed.has(row.dataset.startupStage));
    if (!failed) status.textContent = next ? next.dataset.loadingLabel : 'Ready to create.';
    if (!next && !failed) close();
  };
  const fail = event => {
    if (closed) return;
    failed = true;
    status.textContent = event.detail || 'Startup could not finish. Check your connection and try reopening the app.';
    splash.classList.add('startup-failed');
    dismiss.hidden = false;
  };
  const onError = event => {
    if (event.target?.id === 'ahsMainModule' || event.error) fail({detail: 'Startup encountered an error. The editor may be incomplete. Dismiss this screen to inspect it.'});
  };
  const timer = setTimeout(() => {
    if (closed || failed) return;
    status.textContent = 'Still loading. First-time setup or a slow connection may take longer. You can wait or dismiss this screen.';
    dismiss.hidden = false;
  }, 20000);
  dismiss.addEventListener('click', close);
  window.addEventListener('ahs-startup-stage', update);
  window.addEventListener('ahs-startup-failed', fail);
  window.addEventListener('error', onError, true);
})();
