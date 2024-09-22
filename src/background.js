browser.runtime.onInstalled.addListener(async () => {
  let { format, scaleFactor } = await browser.storage.local.get();
  if (!format || !scaleFactor) {
    format ??= 'png';
    scaleFactor ??= 4;
    browser.storage.local.set({ format, scaleFactor });
  }

  browser.menus.create({
    id: 'copySvg',
    title: '&Copy SVG Image',
    contexts: ['all'],
    icons: { 16: 'icons/copy.svg ' }
  });
  browser.menus.create({
    id: 'saveSvg',
    title: '&Save SVG Image',
    contexts: ['all'],
    icons: { 16: 'icons/save.svg ' }
  });
});

browser.menus.onClicked.addListener(async (info, tab) => {
  const { format, scaleFactor } = await browser.storage.local.get();
  if (['copySvg', 'saveSvg'].includes(info.menuItemId)) browser.tabs.executeScript(tab.id, {
    code: `
      __svgFunc = ${inject.toString()};
      __svgFunc(${info.targetElementId}, '${format}', ${scaleFactor}, '${info.menuItemId}');
    `
  }).then(([data]) => {
    if (typeof data === 'string') fetch(data).then(response => response.arrayBuffer()).then(arrayBuffer => browser.clipboard.setImageData(arrayBuffer, format));
  });
});

const inject = async (id, format, scaleFactor, type) => {
  const el = browser.menus.getTargetElement(id);
  if (el === null) return;
  const svg = el.tagName === 'svg' ? el : el.closest('svg');
  if (!svg) return;

  const containerElements = ['svg', 'g'];
  const inlineStyles = svg => {
    svg.childNodes.forEach(child => {
      if (containerElements.indexOf(child.tagName) !== -1) {
        inlineStyles(child);
        return;
      }
      const style = child.currentStyle || window.getComputedStyle(child);
      if (!style) return;
      Array.from(style).forEach(prop => {
        child.style.setProperty(prop, style.getPropertyValue(prop));
      });
    });
  };

  const svgToData = async svg => {
    inlineStyles(svg);
    let { clientWidth, clientHeight } = svg;
    clientWidth *= scaleFactor;
    clientHeight *= scaleFactor;
    const canvas = Object.assign(document.createElement('canvas'), { width: clientWidth, height: clientHeight });
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, clientWidth, clientHeight);
    const data = (new XMLSerializer()).serializeToString(svg);
    const DOMURL = window.URL || window.webkitURL || window;
    const img = new Image();
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = DOMURL.createObjectURL(svgBlob);
    img.src = url;
    return await new Promise((resolve) => {
      img.onload = function () {
        ctx.drawImage(img, 0, 0, clientWidth, clientHeight);
        DOMURL.revokeObjectURL(url);
        const imgURI = canvas.toDataURL(`image/${format}`);
        if (type === 'copySvg') {
          resolve(imgURI);
        } else {
          const link = Object.assign(document.createElement('a'), { href: imgURI, download: '' });
          link.click();
          link.remove();
          resolve(void 0);
        }
        canvas.remove();
      };
    })
  };

  return svgToData(svg);
};
