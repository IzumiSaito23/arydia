/* Browser-only integration. Campaign state stays in the existing local save format. */
(() => {
  'use strict';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const AUDIO_CACHE = 'arydia-audio-v1';
  let registration, installPrompt, downloading = false, musicCount = 0, musicProgress = '', offlineReady = false, offlineError = '', reloadRequested = false, updateAvailable = false, checkingUpdate = false, preparingUpdate = false, updateStatus = '', lastUpdateCheck = 0, updateFailed = false;
  const pageBuild=window.ARYDIA_BUILD||'';
  const tracks = () => window.Music?.tracks || [];
  const audioURL = track => new URL('music/' + track.file, document.baseURI).href;
  function status(message) { window.nativeStatus?.(message); }
  function dialog(title, html) {
    let d = document.getElementById('web-dialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'web-dialog'; d.className = 'web-dialog'; document.body.append(d); }
    d.innerHTML = `<div class="web-dialog-head"><h2 id="web-dialog-title">${title}</h2><button type="button" aria-label="关闭" class="icon-button">×</button></div><div class="web-dialog-content">${html}</div>`;
    d.setAttribute('aria-labelledby', 'web-dialog-title');
    d.querySelector('button').onclick = () => d.close();
    d.showModal();
  }
  async function install() {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; } catch (_) {}
      return;
    }
    dialog('添加到主屏幕', ios
      ? '<ol><li>用 Safari 打开当前网址。</li><li>打开分享菜单，选择“添加到主屏幕”。如有“作为网页 App 打开”，请保持开启。</li><li>点击“添加”，以后从桌面图标进入。</li></ol><p>建议先添加，再创建角色。如果浏览器里已经有记录，请先导出备份，再到桌面版导入。</p><p class="muted">微信、QQ 内置浏览器请先选择“在 Safari 中打开”。</p>'
      : '<p>在浏览器菜单中选择“安装应用”或“添加到主屏幕”。iPhone 请使用 Safari 的分享菜单。</p><p>记录保存在当前设备。换设备、清理浏览器数据前，请先导出备份。</p>');
  }
  function refresh() {
    document.querySelectorAll('[data-web-offline]').forEach(el => { el.textContent = offlineReady ? '角色与检索已可离线使用' : offlineError || '正在准备离线页面…'; });
    document.querySelectorAll('[data-web-music-status]').forEach(el => { el.textContent = musicProgress || (musicCount === tracks().length && musicCount ? '音乐已全部下载，可离线播放。' : `已下载 ${musicCount}/${tracks().length} 首；全部约 25 MB。`); });
    document.querySelectorAll('[data-web-action="downloadMusic"]').forEach(el => { el.disabled = downloading || (musicCount === tracks().length && musicCount > 0); el.textContent = downloading ? '正在下载…' : musicCount === tracks().length && musicCount ? '音乐已下载' : '下载离线音乐'; });
    document.querySelectorAll('[data-web-action="update"]').forEach(el => { el.hidden=false;el.disabled=checkingUpdate;el.textContent=checkingUpdate?'正在检查…':updateAvailable||registration?.waiting?'更新并刷新':'检查网页版更新'; });
    document.querySelectorAll('[data-web-update-status]').forEach(el=>{el.textContent=updateStatus;});
    let banner=document.getElementById('web-update-banner');
    if(!banner){banner=document.createElement('aside');banner.id='web-update-banner';banner.className='web-update-banner';banner.setAttribute('role','status');banner.innerHTML='<span>新版网页已准备好</span><button type="button" data-web-action="update">更新并刷新</button>';document.body.append(banner);}
    banner.hidden=!updateAvailable&&!registration?.waiting;
  }
  const musicControls = () => '<div class="web-music-tools"><button class="btn" data-web-action="downloadMusic">下载离线音乐</button><p class="muted" data-web-music-status role="status"></p></div>';
  function mount(page) {
    if (page === 'settings') {
      const section = document.createElement('section'); section.className = 'panel web-settings';
      section.innerHTML = `<h2>网页版与离线</h2><p class="web-offline" data-web-offline role="status"></p><div class="web-actions">${!standalone() ? '<button class="btn primary" data-web-action="install">添加到主屏幕</button>' : ''}<button class="btn" data-web-action="help">使用说明</button><button class="btn" data-web-action="update">检查网页版更新</button></div><p class="muted" data-web-update-status role="status"></p>${musicControls()}<p class="muted">记录保存在当前设备，不会自动同步。清理网站数据或更换设备前，请导出备份。</p>`;
      document.querySelector('#main')?.append(section);
    } else if (page === 'music') {
      document.querySelector('.music-detail')?.insertAdjacentHTML('beforeend', musicControls());
      if (ios) {
        const volume = document.querySelector('.volume-line');
        if (volume) { volume.hidden = true; volume.insertAdjacentHTML('afterend', '<p class="muted web-volume">音量请使用 iPhone / iPad 的音量键调节。</p>'); }
      }
    } else if (document.body.dataset.view === 'welcome' && !standalone()) {
      document.querySelector('.welcome')?.insertAdjacentHTML('beforeend', '<button class="quiet web-install" data-web-action="install">添加到主屏幕</button>');
    }
    refresh();
  }
  async function checkMusic() {
    try {
      if (!('caches' in window)) return;
      const cache = await caches.open(AUDIO_CACHE);
      const saved = await Promise.all(tracks().map(track => cache.match(audioURL(track))));
      musicCount = saved.filter(r => r && r.status === 200).length; refresh();
    } catch (_) { musicProgress = '当前浏览器无法保存离线音乐，可联网播放。'; refresh(); }
  }
  async function downloadMusic() {
    if (downloading) return;
    if (!('caches' in window) || !offlineReady) { status('离线页面尚未准备完成，请联网稍后重试。'); return; }
    downloading = true; musicProgress = ''; refresh();
    try {
      const cache = await caches.open(AUDIO_CACHE);
      for (const [index, track] of tracks().entries()) {
        if (await cache.match(audioURL(track))) continue;
        musicProgress = `正在下载 ${index + 1}/${tracks().length}：${track.name}`; refresh();
        const response = await fetch(audioURL(track));
        if (!response.ok || response.status !== 200 || !/audio\//i.test(response.headers.get('Content-Type') || '')) throw new Error('下载未完成，请联网重试');
        await cache.put(audioURL(track), response);
      }
      musicProgress = ''; await checkMusic(); status('离线音乐已下载');
    } catch (error) { musicProgress = error.name === 'QuotaExceededError' ? '设备存储空间不足。已下载的曲目会保留。' : '下载中断，已下载的曲目会保留；联网后可继续。'; }
    finally { downloading = false; await checkMusic(); refresh(); }
  }
  async function exportBackup(contents) {
    const name = 'Arydia-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([contents || ''], name, {type: 'application/json'});
    try {
      if (ios && navigator.canShare?.({files: [file]})) {
        await navigator.share({files: [file], title: '阿瑞迪亚旅伴备份'});
        status('请确认备份已保存到“文件”');
      } else {
        const url = URL.createObjectURL(file), a = document.createElement('a');
        a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000); status('备份已生成，请在下载文件中确认');
      }
    } catch (e) { if (e.name !== 'AbortError') status('导出未完成：请在 Safari 中重试'); }
  }
  window.WebApp = {mount, exportBackup};
  function requestBuild(){navigator.serviceWorker.controller?.postMessage({type:'GET_BUILD'});}
  async function checkUpdate(manual=false){
    if(!registration){if(manual)status('网页更新尚未就绪，请联网稍后再试。');return;}
    if(checkingUpdate)return;
    if(manual&&(updateAvailable||registration.waiting)){
      reloadRequested=true;
      if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});else location.reload();
      return;
    }
    if(!manual&&Date.now()-lastUpdateCheck<60000)return;
    lastUpdateCheck=Date.now();updateFailed=false;checkingUpdate=true;updateStatus='正在检查网页版更新…';refresh();
    try{await registration.update();requestBuild();updateStatus=preparingUpdate?'正在准备新版页面，完成后会提示刷新。':updateAvailable||registration.waiting?'新版已准备好，点击“更新并刷新”。':'当前已是最新网页版。';}
    catch(_){updateFailed=true;updateStatus='暂时无法检查更新，已保存的记录和离线页面会保留。';}
    finally{checkingUpdate=false;refresh();}
  }
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-web-action]')?.dataset.webAction;
    if (action === 'install') install();
    if (action === 'downloadMusic') downloadMusic();
    if (action === 'update') checkUpdate(true);
    if (action === 'help') dialog('网页版使用说明', '<p>建议在 iPhone 的 Safari 中添加到主屏幕，再从桌面图标创建角色。</p><p>页面准备完成后，角色记录和编号检索可离线使用；音乐需单独下载。</p><p>记录仅保存在当前设备。安卓版导出的 JSON 备份，可以在“存档与备份”中导入。导入前可预览并确认，不会直接覆盖。</p><p>在 iPhone 导出时，请在分享菜单中选择“存储到文件”。不要把浏览器缓存当作唯一备份。</p><p>锁屏音乐受浏览器及系统限制。若播放暂停，请回到页面点播放。</p>');
  });
  document.addEventListener('click', () => { navigator.storage?.persist?.().catch(() => {}); }, {once: true});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='ARYDIA_BUILD'&&pageBuild){updateAvailable=e.data.build!==pageBuild;if(updateAvailable)updateStatus='新版已准备好，点击“更新并刷新”。';else if(!updateFailed)updateStatus='当前已是最新网页版。';refresh();}});
    navigator.serviceWorker.addEventListener('controllerchange', () => {preparingUpdate=false;if(reloadRequested)location.reload();else requestBuild();});
    navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).then(reg => {
      registration = reg;
      const observe = worker => {if(!worker)return;preparingUpdate=true;worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant') {preparingUpdate=false;if(!reg.active)offlineError='离线页面准备失败，请联网刷新重试。';else updateStatus='新版准备未完成，原有记录和页面会保留；请稍后重试。';refresh();}
        if (worker.state === 'installed') {preparingUpdate=false;updateStatus='新版页面已准备好。';refresh();}
      });};
      observe(reg.installing); reg.addEventListener('updatefound', () => observe(reg.installing));
      refresh();checkUpdate();return navigator.serviceWorker.ready;
    }).then(() => { offlineReady = true; refresh();requestBuild();checkMusic(); }).catch(() => { offlineError = '当前浏览器未能启用离线使用，请使用 Safari 并联网刷新。'; refresh(); });
  } else { offlineError = '当前打开方式不支持离线使用，请从 HTTPS 网址访问。'; }
  window.addEventListener('online',()=>{refresh();checkUpdate();});window.addEventListener('offline',refresh);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate();});
})();
