(() => {
  'use strict';
  if (parent === window || !parent.Combat95Web) return;
  const host = parent.Combat95Web;
  window.AndroidCombat = { load: host.load, save: host.save, close: host.close };
  document.getElementById('session').hidden = true;
})();
