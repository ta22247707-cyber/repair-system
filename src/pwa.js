'use strict';

(() => {
  const installButton = document.querySelector('#install-button');
  const status = document.querySelector('#connection-status');
  let installPrompt;

  function connectionStatus() {
    status.hidden = navigator.onLine;
    status.textContent = navigator.onLine ? ''
      : '目前離線：可開啟報修畫面，但無法載入或送出報修。請連線後重新整理頁面；尚未送出的內容不會自動登記。';
  }
  connectionStatus();
  window.addEventListener('online', connectionStatus);
  window.addEventListener('offline', connectionStatus);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.warn('安裝提示無法開啟', error);
    }
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
        .catch(error => console.warn('離線功能未能啟用，連線使用不受影響。', error));
    });
  }
})();
