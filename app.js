'use strict';

(() => {
  const form = document.querySelector('#repair-form');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#repair-list');
  const filterButtons = [...document.querySelectorAll('#urgency-filters button')];
  const filterMessage = document.querySelector('#filter-message');
  const columns = 'id,created_at,reporter_name,location,category,description,urgency,status';
  let client;
  let submitting = false;
  let cachedRequests = [];
  let selectedUrgency = '全部';

  function message(element, text, kind = '') {
    element.textContent = text;
    element.dataset.kind = kind;
  }

  // 所有資料庫文字均以 textContent 顯示，避免將報修內容當作 HTML 執行。
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function render(rows) {
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const article = node('article', 'request', '');
      const top = node('div', 'request-top', '');
      top.append(node('span', 'badge', row.category),
        node('span', row.urgency === '高' ? 'badge urgent' : 'badge', `緊急程度：${row.urgency}`),
        node('span', 'badge', row.status));
      const date = new Date(row.created_at);
      const time = Number.isNaN(date.getTime()) ? '時間不明' : date.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei', hour12: false
      });
      article.append(top, node('p', 'description', row.description),
        node('p', 'metadata', `${row.reporter_name} · ${row.location}`),
        node('p', 'metadata', `${time}（臺北時間）`));
      fragment.append(article);
    }
    list.replaceChildren(fragment);
  }

  // 篩選只使用記憶體內已載入的資料，不重新查詢資料庫。
  function renderFiltered() {
    const rows = selectedUrgency === '全部' ? cachedRequests
      : cachedRequests.filter((row) => row.urgency === selectedUrgency);
    render(rows);
    for (const button of filterButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.urgency === selectedUrgency));
    }
    message(filterMessage, cachedRequests.length
      ? rows.length ? `顯示 ${rows.length} 筆（${selectedUrgency}）` : `最近 20 筆中沒有緊急程度為「${selectedUrgency}」的報修。`
      : '');
  }

  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      selectedUrgency = button.dataset.urgency;
      renderFiltered();
    });
  }

  async function loadRequests() {
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入清單…');
    try {
      const { data, error } = await client.from('repair_requests').select(columns)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (error) throw error;
      cachedRequests = data || [];
      renderFiltered();
      message(listMessage, data?.length ? '' : '目前還沒有報修紀錄。');
    } catch (error) {
      message(listMessage, `清單載入失敗，請按「重新整理」重試。${cachedRequests.length ? '下方保留上次載入的清單。' : ''} ${error.message || '請檢查網路連線。'}`, 'error');
    } finally {
      refreshButton.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !client || !form.reportValidity()) return;
    if (!navigator.onLine) {
      message(formMessage, '目前離線，尚未送出報修。請恢復連線後再送出；表單已保留。', 'error');
      return;
    }
    const values = new FormData(form);
    // 僅送出資料庫允許新增的五個欄位，不送 status、id 或 created_at。
    const payload = Object.fromEntries(['reporter_name', 'location', 'category', 'description', 'urgency']
      .map((key) => [key, String(values.get(key) || '').trim()]));
    if (Object.values(payload).some((value) => !value)) {
      message(formMessage, '請完整填寫所有欄位，不能只輸入空白。', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = '送出中…';
    form.setAttribute('aria-busy', 'true');
    const controls = [...form.elements].filter((control) => control !== submitButton);
    controls.forEach((control) => { control.disabled = true; });
    message(formMessage, '正在送出報修…');
    try {
      const { error } = await client.from('repair_requests').insert(payload);
      if (error) throw error;
      form.reset();
      message(formMessage, '報修已成功登記，初始狀態為「待處理」。', 'success');
      await loadRequests();
    } catch (error) {
      message(formMessage, `送出未能確認成功，請先重新整理清單確認是否已登記，再決定是否重試；表單已保留。 ${error.message || '請檢查網路連線。'}`, 'error');
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = '送出報修';
      controls.forEach((control) => { control.disabled = false; });
      form.setAttribute('aria-busy', 'false');
    }
  });

  refreshButton.addEventListener('click', loadRequests);
  try {
    const config = window.REPAIR_CONFIG;
    if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabasePublishableKey) {
      throw new Error('連線元件或設定未載入，請檢查網路後重新載入頁面。');
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    submitButton.disabled = false;
    loadRequests();
  } catch (error) {
    message(formMessage, error.message, 'error');
    message(listMessage, '目前無法連線載入清單，請重新載入頁面。', 'error');
    list.setAttribute('aria-busy', 'false');
  }
})();
