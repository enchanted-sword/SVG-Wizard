const init = async () => {
  const { format, scaleFactor } = await browser.storage.local.get();

  const formatInput = document.getElementById('format');
  formatInput.value = format;
  formatInput.addEventListener('change', ({ target }) => {
    browser.storage.local.set({ format: target.value });
  });

  const scaleInput = document.getElementById('scale');
  scaleInput.value = scaleFactor;
  scaleInput.addEventListener('change', ({ target }) => {
    browser.storage.local.set({ scaleFactor: target.value });
  });

  const d = new Date();
  document.getElementById(
    'footer'
  ).textContent = `Starlight System © ${d.getUTCFullYear()}`;
};

init()