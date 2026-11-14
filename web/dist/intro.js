(function () {
  'use strict';
  // Kept separate from campaign saves: importing a backup never resets this choice.
  function createGate(native, storage) {
    const key = 'arydia-intro-accepted-v1';
    return {
      accepted() {
        try { return native ? native.introAccepted() === true : storage.getItem(key) === 'yes'; }
        catch (_) { return false; }
      },
      accept() {
        try {
          if (native) return native.acceptIntro() === true;
          storage.setItem(key, 'yes');
          return storage.getItem(key) === 'yes';
        } catch (_) { return false; }
      },
      leave() { if (native) { native.exitApp(); return true; } return false; }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = createGate; return; }
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = null; }
  const gate = createGate(window.Android || null, storage);
  window.Intro = {show,accepted:()=>gate.accepted()};
  function show() {
  if (document.querySelector('.intro-overlay')) return;
  const returnFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'intro-overlay';
  root.innerHTML = `<section class="intro-dialog" role="dialog" aria-modal="true" aria-label="公会领袖撒迪斯" aria-describedby="intro-story" tabindex="-1">
    <div class="intro-card">
      <img class="intro-art" src="intro/${UI.get().language==='en'?'thades-front-en.png':'thades-front.png'}" width="1635" height="2275" alt="" draggable="false">
      <div id="intro-story" class="intro-story sr-only">
        <h1>公会领袖撒迪斯</h1><p>人类 · 男性。神态：焦躁。举动：踱步、拨弄胡须。特征：急促、带着催促。</p>
        <p>撒迪斯已经在这里等了很久。他来回踱步，拨弄着胡须。终于看见你们出现，猛地停下，朝你们连招了几下手。</p>
        <p>“流放者们！你们总算回来了！快过来，我还有东西要交给你们！〈将手里的东西往前一递〉我花了重金，委托了一个叫什么 IzumiSaito 的人做了这个东西。说是什么可以记录成长、查找线索、整理行囊……我也不知道他有没有骗我，反正我就想为了让你们在冒险路上能够方便些。行了，赶快拿去试试！我已经在这儿等得够久了！”</p>
        <p>其他任何话题：〈指节在桌上急促地敲了两下〉“怎么还站着？东西就在这儿，倒是拿起来看看啊！我花了钱的啊”</p>
      </div>
      <button class="intro-choice intro-enter" type="button" aria-label="接过这奇怪的东西，进入 APP"><span class="sr-only">接过这奇怪的东西</span></button>
      <button class="intro-choice intro-leave" type="button" aria-label="转身离开，退出 APP"><span class="sr-only">转身离开</span></button>
    </div>
    <p class="intro-error" role="alert" hidden></p>
  </section>`;
  if(UI.get().language==='en'){
    root.querySelector('.intro-dialog').setAttribute('aria-label','Guildmaster Thades');
    root.querySelector('#intro-story').innerHTML='<h1>Guildmaster Thades</h1><p>Thades has been waiting, pacing and fiddling with his beard. As you arrive, he beckons impatiently.</p><p>“Exiles! At last! Come here, I have something for you. I paid someone called IzumiSaito to make this. They say it can track your growth, look up clues, and organize your belongings. I thought it might make your adventures a little easier. Go on, try it!”</p><p>Any other topic: “Why are you still standing there? Pick it up and have a look!”</p>';
    for(const [selector,label] of [['.intro-enter','Take the strange device'],['.intro-leave','Turn and leave']]){const b=root.querySelector(selector);b.setAttribute('aria-label',label);b.querySelector('span').textContent=label;}
  }
  const background = [...document.body.children].filter(el => el.tagName !== 'SCRIPT');
  const previousInert = background.map(el => el.inert);
  background.forEach(el => { el.inert = true; });
  document.body.classList.add('intro-open');
  document.documentElement.classList.add('intro-open');
  document.body.appendChild(root);
  let open = true, entering = false;
  const dialog = root.querySelector('.intro-dialog');
  const enter = root.querySelector('.intro-enter');
  const leave = root.querySelector('.intro-leave');
  const error = root.querySelector('.intro-error');
  dialog.focus({preventScroll:true});
  const previousBack = window.appBack;
  function exit() {
    if (entering) return;
    if (!gate.leave()) {
      window.Music?.command('stop');
      root.classList.add('intro-browser-left');
      error.hidden = false;
      error.textContent = UI.get().language==='en'?'You may close this page or return to your home screen. Take the card to continue.':'已离开。请关闭当前页面，或返回手机主屏幕。接过卡牌可继续使用。';
    }
  }
  window.appBack = function () { if (open) { exit(); return true; } return previousBack ? previousBack() : false; };
  enter.addEventListener('click', () => {
    if (entering) return;
    if (!gate.accept()) { error.hidden = false; error.textContent = '暂时无法保存。请使用 Safari 的普通浏览窗口，并确认设备有可用存储空间。'; return; }
    entering = true;
    root.classList.add('intro-closing');
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      open = false;
      root.remove();
      document.body.classList.remove('intro-open');
      document.documentElement.classList.remove('intro-open');
      background.forEach((el, i) => { el.inert = previousInert[i]; });
      window.appBack = previousBack;
      document.removeEventListener('keydown', trap, true);
      const target = returnFocus && returnFocus !== document.body && returnFocus.isConnected ? returnFocus : document.querySelector('#main button, .masthead button');
      target?.focus({preventScroll:true});
      window.dispatchEvent(new Event('arydia-intro-accepted'));
    }
    root.addEventListener('animationend', e => { if (e.animationName === 'intro-card-receive') finish(); });
    setTimeout(finish, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480);
  });
  leave.addEventListener('click', exit);
  function trap(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); exit(); }
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      (document.activeElement === enter ? leave : document.activeElement === leave ? enter : e.shiftKey ? leave : enter).focus();
    }
  }
  document.addEventListener('keydown', trap, true);
  const art = root.querySelector('.intro-art');
  enter.disabled = leave.disabled = true;
  function ready() {
    if (!open || !root.isConnected) return;
    root.classList.add('intro-ready');
    enter.disabled = leave.disabled = false;
  }
  function imageFailed() {
    root.classList.add('intro-fallback');
    root.querySelector('.intro-story').classList.remove('sr-only');
    root.querySelectorAll('.intro-choice span').forEach(el => el.classList.remove('sr-only'));
    ready();
  }
  art.addEventListener('error', imageFailed);
  if (art.decode) art.decode().then(ready, imageFailed);
  else if (art.complete) { if (art.naturalWidth) ready(); else imageFailed(); }
  else art.addEventListener('load', ready, {once:true});
  }
  window.AppUI.startWelcome();
})();
