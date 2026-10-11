(() => {
  const key = 'gopi-playground-picks';
  const buttons = [...document.querySelectorAll('[data-game]')];
  let picks = [];
  try { const saved = JSON.parse(localStorage.getItem(key)); if (Array.isArray(saved)) picks = saved.filter(name => buttons.some(b => b.dataset.game === name)); } catch {}
  function render() {
    buttons.forEach(button => { const active = picks.includes(button.dataset.game); button.setAttribute('aria-pressed', String(active)); button.textContent = active ? '♥' : '♡'; });
    document.getElementById('shortlist-list').textContent = picks.length ? picks.join(' + ') : 'Your next favorite is one play away.';
    document.getElementById('copy-picks').disabled = !picks.length;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.game;
    picks = picks.includes(name) ? picks.filter(p => p !== name) : [...picks, name];
    try { localStorage.setItem(key, JSON.stringify(picks)); } catch { document.getElementById('saved-note').textContent = 'Your shortlist is available for this visit. Copy it before leaving.'; }
    render();
  }));
  document.getElementById('copy-picks').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`My gopi.playground picks: ${picks.join(', ')}.`); document.getElementById('saved-note').textContent = 'Copied! Paste your picks into our chat.'; }
    catch { document.getElementById('saved-note').textContent = `Tell me in chat: My picks are ${picks.join(' and ')}.`; }
  });
  render();
})();
