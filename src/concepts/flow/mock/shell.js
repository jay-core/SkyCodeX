// The app's chrome around a mock-up: header pivot, status, the flow pane, the preview pane, the app bar.
function shell(o) {
  const gear = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="6.6"/></svg>';
  document.getElementById('root').innerHTML = `
  <div class="app">
    <div class="hdr"><div class="pivot">${o.tabs.map(([t, on]) => `<button class="${on ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="status"><span>clangd ready</span></div></div>
    <div class="body" style="flex:1;min-height:0;display:flex">
      <div class="pane" style="flex:1">
        <div class="ph" style="padding:0 22px"><span>${o.ph}</span><span class="grow"></span>${o.chips || '<button class="chip">group by folder</button><button class="chip">refresh</button><button class="chip">fit</button>'}</div>
        <div class="flow" id="canvas" style="top:36px">${o.overlay || ''}</div>
      </div>
      ${o.preview === null ? '' : `<div class="pane prev" style="width:${o.previewW || 440}px;flex:none">${o.preview || '<div class="empty">click a box to see what’s inside</div>'}</div>`}
    </div>
    <div class="appsep"></div>
    <div class="appbar"><button class="barbtn">options</button><button class="gear">${gear}</button><button class="barbtn">compiler</button><button class="barbtn ${o.preview === null ? '' : 'on'}">${o.preview === null ? 'preview' : 'hide preview'}</button></div>
  </div>`;
  return document.getElementById('canvas');
}
