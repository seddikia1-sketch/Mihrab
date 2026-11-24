// Loads full app logic from split parts
(async function loadApp() {
  try {
    const [p1, p2] = await Promise.all([
      fetch('./app.part1.js').then(r => { if (!r.ok) throw new Error('part1'); return r.text(); }),
      fetch('./app.part2.js').then(r => { if (!r.ok) throw new Error('part2'); return r.text(); })
    ]);
    const s = document.createElement('script');
    s.textContent = p1 + '\n' + p2;
    document.body.appendChild(s);
  } catch (e) {
    console.error('Failed to load app.js parts', e);
    const t = document.getElementById('toast');
    if (t) { t.textContent = 'تعذر تحميل منطق التطبيق'; t.classList.add('show'); }
  }
})();
