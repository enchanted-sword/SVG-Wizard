const refresh = () => {
  browser.menus.refresh();
  browser.menus.onShown.removeListener(refresh);
};

browser.runtime.onInstalled.addListener(async () => {
  let { format, scaleFactor } = await browser.storage.local.get();
  if (!format || !scaleFactor) {
    format ??= 'png';
    scaleFactor ??= 4;
    browser.storage.local.set({ format, scaleFactor });
  }

  browser.menus.onShown.addListener(refresh);

  browser.menus.create({
    id: 'copyAsImg',
    title: `&Copy SVG Image as ${format.toUpperCase()}`,
    contexts: ['all'],
    icons: { 16: 'icons/copy.svg' }
  });
  browser.menus.create({
    id: 'saveAsImg',
    title: `&Save SVG Image as ${format.toUpperCase()}`,
    contexts: ['all'],
    icons: { 16: 'icons/save.svg' }
  });
  browser.menus.create({
    id: 'copyAsSvg',
    title: 'Copy SVG Image as &XML',
    contexts: ['all'],
    icons: { 16: 'icons/copySVG.svg' }
  });
  browser.menus.create({
    id: 'saveAsSvg',
    title: 'Save SVG Image as S&VG',
    contexts: ['all'],
    icons: { 16: 'icons/saveSVG.svg' }
  });
});

browser.storage.onChanged.addListener(changes => {
  const { format } = changes;
  if (!format) return;

  if (format.oldValue) {
    console.log(format)
    browser.menus.update('copyAsImg', {
      title: `&Copy SVG Image as ${format.newValue.toUpperCase()}`
    });
    browser.menus.update('saveAsImg', {
      title: `&Save SVG Image as ${format.newValue.toUpperCase()}`,
    });
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  const { format, scaleFactor } = await browser.storage.local.get();
  if (['copyAsImg', 'saveAsImg', 'copyAsSvg', 'saveAsSvg'].includes(info.menuItemId)) browser.tabs.executeScript(tab.id, {
    code: `
      __svgFunc = ${inject.toString()};
      __svgFunc(${info.targetElementId}, '${format}', ${scaleFactor}, '${info.menuItemId}');
    `
  }).then(([data]) => {
    if (typeof data === 'string') {
      if (info.menuItemId === 'copyAsImg') {
        fetch(data).then(response => response.arrayBuffer()).then(arrayBuffer => browser.clipboard.setImageData(arrayBuffer, format));
      } else if (info.menuItemId === 'copyAsSvg') {
        navigator.clipboard.writeText(data);
      }
    }
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
    const data = (new XMLSerializer()).serializeToString(svg);
    if (type === 'copyAsSvg') return data;
    else if (type === 'saveAsSvg') {
      const dataURI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
      downloadLink(dataURI, 'svg');
      return void 0;
    }
    let { clientWidth, clientHeight } = svg;
    clientWidth *= scaleFactor;
    clientHeight *= scaleFactor;
    const canvas = Object.assign(document.createElement('canvas'), { width: clientWidth, height: clientHeight });
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, clientWidth, clientHeight);
    const DOMURL = window.URL || window.webkitURL || window;
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = DOMURL.createObjectURL(svgBlob);
    const img = Object.assign(document.createElement('img'), { src: blobUrl });
    return await new Promise((resolve) => {
      img.onload = function () {
        ctx.drawImage(img, 0, 0, clientWidth, clientHeight);
        DOMURL.revokeObjectURL(blobUrl);
        const imgURI = canvas.toDataURL(`image/${format}`);
        if (type === 'copyAsImg') {
          resolve(imgURI);
        } else {
          downloadLink(imgURI);
          resolve(void 0);
        }
        canvas.remove();
      };
    })
  };

  const downloadLink = url => {
    const link = Object.assign(document.createElement('a'), { href: url, download: '' });
    link.click();
    link.remove();
  };

  return svgToData(svg);
};
