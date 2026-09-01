let currentTabId = null;
let meta = null;
let texNames = [];
let downloading = false;

async function readFromPageIDB(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => new Promise(resolve => {
      const r = indexedDB.open('meshy_dl', 2);
      r.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('files', 'readonly');
        const s = tx.objectStore('files');
        const out = {};
        s.get('meta').onsuccess = ev => { out.meta = ev.target.result; };
        s.get('texNames').onsuccess = ev => { out.texNames = ev.target.result || []; };
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => resolve({});
      };
      r.onerror = () => resolve({});
    })
  });
  return results?.[0]?.result || {};
}

function setStatus(type, text) {
  document.getElementById('dot').className = 'dot dot-' + type;
  document.getElementById('statusText').textContent = text;
}

function addFileRow(list, label, badgeText, badgeClass, extra) {
  const row = document.createElement('div');
  row.className = 'file-row';

  const left = document.createElement('span');
  left.appendChild(document.createTextNode(label + ' '));
  const badge = document.createElement('span');
  badge.className = 'badge ' + badgeClass;
  badge.textContent = badgeText;
  left.appendChild(badge);
  row.appendChild(left);

  if (extra) {
    const right = document.createElement('span');
    right.style.color = '#8b949e';
    right.textContent = extra;
    row.appendChild(right);
  }

  list.appendChild(row);
}

function render(m, tNames) {
  const list = document.getElementById('fileList');
  list.replaceChildren();
  if (!m || m.glbSize === 0) return;

  addFileRow(
    list,
    `📄 ${m.modelName || 'model'}.glb`,
    'GLB',
    'badge-glb',
    `${(m.glbSize / 1024 / 1024).toFixed(1)} MB`
  );

  (tNames || []).forEach(name => {
    addFileRow(list, `🖼️ ${name}`, 'PNG', 'badge-tex');
  });

  if (!downloading) document.getElementById('btnDl').disabled = false;
}

function resetFileList() {
  document.getElementById('fileList').replaceChildren();
  if (!downloading) document.getElementById('btnDl').disabled = true;
}

async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('meshy.ai')) {
      setStatus('idle', 'Not on a Meshy page');
      resetFileList();
      return;
    }
    currentTabId = tab.id;

    const data = await readFromPageIDB(tab.id);
    meta = data.meta;
    texNames = data.texNames || [];

    if (meta?.status === 'ready' && meta.glbSize > 0) {
      setStatus('ready', 'Model intercepted ✅');
      render(meta, texNames);
      document.getElementById('hint').textContent = `${texNames.length} texture(s) intercepted.`;
    } else {
      setStatus('waiting', 'Waiting for model...');
      resetFileList();
      document.getElementById('hint').textContent =
        '💡 Let the 3D viewer fully load the model.';
    }
  } catch (e) {
    setStatus('error', 'Error: ' + e.message.slice(0, 40));
  }
}

async function downloadAll() {
  if (downloading || !currentTabId || !meta) return;
  downloading = true;
  const btn = document.getElementById('btnDl');
  btn.disabled = true;
  btn.textContent = '⏳ ...';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      world: 'MAIN',
      func: async (modelName, tNames) => {
        function dl(buf, name, mime) {
          const url = URL.createObjectURL(new Blob([buf], { type: mime }));
          const a = Object.assign(document.createElement('a'), {
            href: url,
            download: name
          });
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        function idbGet(store, key) {
          return new Promise((res, rej) => {
            const req = store.get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
        }

        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('meshy_dl', 2);
          r.onsuccess = e => res(e.target.result);
          r.onerror = rej;
        });
        const tx = db.transaction('files', 'readonly');
        const s = tx.objectStore('files');
        const glb = await idbGet(s, 'glb');
        const textures = await Promise.all(
          tNames.map(async name => ({ name, buf: await idbGet(s, 'tex_' + name) }))
        );

        if (glb) dl(glb, modelName + '.glb', 'model/gltf-binary');
        await Promise.all(textures.map((t, i) => new Promise(resolve => {
          setTimeout(() => {
            if (t.buf) dl(t.buf, t.name, 'image/png');
            resolve();
          }, 400 * (i + 1));
        })));
      },
      args: [meta.modelName || 'model', texNames]
    });
    btn.textContent = '✅ Downloaded!';
  } catch (e) {
    setStatus('error', 'Error: ' + e.message.slice(0, 40));
    btn.textContent = '⬇️ Download all';
  } finally {
    setTimeout(() => {
      downloading = false;
      btn.disabled = false;
      btn.textContent = '⬇️ Download all';
    }, 2000);
  }
}

document.getElementById('btnDl').addEventListener('click', downloadAll);
refresh();
setInterval(refresh, 2500);
