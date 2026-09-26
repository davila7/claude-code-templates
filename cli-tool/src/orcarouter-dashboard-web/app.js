'use strict';

/**
 * OrcaRouter provider dashboard client.
 *
 * Two authentication choices, one credential summary, one capability-filtered
 * model selector. The API key never reaches this file: it is POSTed once to the
 * server, which stores it and answers with a masked form.
 *
 * Login lifecycle: `attemptId` is the generation. Every poll and every response
 * handler checks that its attempt is still the current one before touching the
 * UI, and `pagehide` clears the busy state synchronously before asking the
 * server to release the lock — a generation guard alone would leave a
 * back-forward-cache restore permanently busy.
 */

(() => {
  const state = {
    attemptId: null,
    busy: false,
    credential: null,
    models: [],
    selectedModel: null,
    pollTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  function setStatus(element, message, kind) {
    element.textContent = message || '';
    element.className = `status${kind ? ` ${kind}` : ''}`;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = {};
    try {
      body = await response.json();
    } catch (_) {
      body = {};
    }
    if (!response.ok) {
      const error = new Error(body.error || `Request failed (${response.status})`);
      error.code = body.code;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function describeCredential(credential) {
    if (!credential || !credential.configured) return 'not configured';
    const method = credential.method === 'pkce' ? 'OrcaRouter - Auth' : 'OrcaRouter - API';
    const reauth = credential.needsReauth ? ' — needs reauthorization' : '';
    return `${method} · ${credential.maskedKey} · ${credential.account}${reauth}`;
  }

  async function refreshProvider() {
    const query = state.attemptId ? `?attemptId=${encodeURIComponent(state.attemptId)}` : '';
    const data = await api(`/api/provider${query}`);
    state.credential = data.credential;

    $('inference-base').textContent = data.apiBaseUrl;
    $('auth-base').textContent = data.authBaseUrl;
    $('console-keys-link').href = data.consoleKeysUrl;
    $('credential-detail').textContent = describeCredential(data.credential);
    $('credential-detail').className = data.credential.needsReauth ? 'warn' : '';

    // Both methods stay visible and enabled regardless of what is stored: the
    // user can always replace an API key with a login, or the reverse.
    $('api-key-save').disabled = state.busy;
    $('connect-start').disabled = state.busy;
  }

  function currentModalities() {
    return ['image', 'audio', 'video'].filter((modality) => $(`modality-${modality}`).checked);
  }

  /**
   * Recompute the model dropdown for the current capability. Changing the
   * provider keeps the capability; changing capability or attachment types
   * recomputes the options.
   */
  async function refreshModels() {
    const capability = $('capability-select').value;
    const modalities = capability === 'chat' ? currentModalities() : [];
    const params = new URLSearchParams({ capability });
    if (modalities.length) params.set('modalities', modalities.join(','));

    const catalogState = $('catalog-state');
    const trigger = $('model-trigger');
    const listbox = $('model-listbox');
    trigger.disabled = true;
    $('model-trigger-label').textContent = 'Loading…';
    listbox.innerHTML = '';
    catalogState.className = 'catalog-state';
    catalogState.textContent = 'Loading models from the live catalog…';

    let data;
    try {
      data = await api(`/api/models?${params.toString()}`);
    } catch (error) {
      state.models = [];
      trigger.disabled = true;
      $('model-trigger-label').textContent = 'No compatible model';
      catalogState.className = 'catalog-state empty';
      catalogState.textContent = `Model catalog unavailable: ${error.message}`;
      return;
    }

    state.models = data.models;

    if (data.degraded) {
      catalogState.className = 'catalog-state degraded';
      catalogState.textContent =
        `Live catalog unavailable — showing ${data.count} verified fallback model(s) from ` +
        `${data.catalogUrl}. ${data.message || ''}`.trim();
    } else if (data.count === 0) {
      catalogState.className = 'catalog-state empty';
      catalogState.textContent =
        `This catalog advertises no model for "${capability}"` +
        (modalities.length ? ` with ${modalities.join(' + ')} input` : '') +
        '. Nothing is offered rather than showing a model that cannot serve this input.';
    } else {
      catalogState.textContent =
        `${data.count} model(s) from ${data.source} catalog · ${data.catalogUrl}`;
    }

    if (data.count === 0) {
      trigger.disabled = true;
      $('model-trigger-label').textContent = 'No compatible model';
      state.selectedModel = null;
      state.options = [];
      return;
    }

    const previous = state.selectedModel;
    state.options = data.models;
    const stillValid = previous && data.models.some((model) => model.id === previous);
    state.selectedModel = stillValid ? previous : data.models[0].id;
    $('model-trigger-label').textContent = state.selectedModel;
    trigger.disabled = false;
    renderModelList('');

    // An incompatible previous selection is cleared and reported, never kept.
    if (previous && !stillValid) {
      $('model-notes').textContent =
        `The previously selected model (${previous}) is not available for this capability and was cleared.`;
      $('model-notes').className = 'status warn';
    } else {
      $('model-notes').textContent = '';
      $('model-notes').className = 'status';
    }
  }

  function renderModelList(filter) {
    const listbox = $('model-listbox');
    const needle = filter.trim().toLowerCase();
    const matching = (state.options || []).filter(
      (model) =>
        !needle ||
        model.id.toLowerCase().includes(needle) ||
        (model.label || '').toLowerCase().includes(needle)
    );
    listbox.innerHTML = '';
    $('model-empty').hidden = matching.length > 0;
    for (const model of matching) {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.dataset.modelId = model.id;
      item.setAttribute('aria-selected', String(model.id === state.selectedModel));
      const id = document.createElement('span');
      id.className = 'model-id';
      id.textContent = model.id;
      const meta = document.createElement('span');
      meta.className = 'model-meta';
      const bits = [];
      if (model.label && model.label !== model.id) bits.push(model.label);
      if (model.context_length) bits.push(`${Math.round(model.context_length / 1000)}k ctx`);
      bits.push(`input: ${(model.input_modalities || []).join(', ') || 'text'}`);
      if (model.verified) bits.push('verified fallback');
      meta.textContent = bits.join(' · ');
      item.append(id, meta);
      item.addEventListener('click', () => selectModel(model.id));
      listbox.appendChild(item);
    }
  }

  function selectModel(modelId) {
    state.selectedModel = modelId;
    $('model-trigger-label').textContent = modelId;
    renderModelList($('model-search').value);
    closePanel();
  }

  function openPanel() {
    if ($('model-trigger').disabled) return;
    $('model-panel').hidden = false;
    $('model-trigger').setAttribute('aria-expanded', 'true');
    $('model-search').value = '';
    renderModelList('');
    $('model-search').focus();
  }

  function closePanel() {
    $('model-panel').hidden = true;
    $('model-trigger').setAttribute('aria-expanded', 'false');
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function pollAttempt(attemptId) {
    if (state.attemptId !== attemptId) return; // a newer attempt owns the UI
    let data;
    try {
      data = await api(`/api/credential/connect/${attemptId}`);
    } catch (error) {
      setBusy(false);
      setStatus($('pkce-status'), `Could not read the authorization status: ${error.message}`, 'error');
      return;
    }
    if (state.attemptId !== attemptId) return;

    if (data.status === 'connected') {
      setBusy(false);
      setStatus(
        $('pkce-status'),
        `Connected as ${data.account}. Stored key ${data.maskedKey}.` +
          (data.scopeWarning ? ` ${data.scopeWarning}` : ''),
        'ok'
      );
      $('connect-panel').hidden = true;
      await refreshProvider();
      await refreshModels();
      state.attemptId = null;
      return;
    }
    if (data.status === 'error' || data.status === 'cancelled') {
      setBusy(false);
      setStatus($('pkce-status'), data.error || 'Authorization did not complete.', 'error');
      state.attemptId = null;
      return;
    }
    if (data.status === 'stale') {
      setBusy(false);
      state.attemptId = null;
      return;
    }
    state.pollTimer = setTimeout(() => pollAttempt(attemptId), 1000);
  }

  function setBusy(busy) {
    state.busy = busy;
    // The busy flag clears synchronously on every terminal path, including
    // pagehide, so the controls are never left permanently disabled.
    $('connect-start').disabled = busy;
    $('connect-cancel').disabled = !busy;
    $('api-key-save').disabled = busy;
    $('api-key-input').disabled = busy;
  }

  async function startConnect(flow) {
    stopPolling();
    setBusy(true);
    $('connect-panel').hidden = false;
    $('connect-url').removeAttribute('href');
    $('connect-oob').hidden = flow !== 'oob';
    setStatus($('pkce-status'), 'Starting authorization…');

    let data;
    try {
      data = await api('/api/credential/connect', {
        method: 'POST',
        body: JSON.stringify({ flow }),
      });
    } catch (error) {
      setBusy(false);
      setStatus($('pkce-status'), `Could not start authorization: ${error.message}`, 'error');
      return;
    }

    state.attemptId = data.attemptId;
    $('connect-url').href = data.authorizeUrl;
    $('connect-hint').textContent =
      flow === 'oob'
        ? 'Open the authorization page, approve, then paste the code it shows you.'
        : 'A browser tab opened for you. Approve there and this page will update by itself.';
    setStatus($('pkce-status'), 'Waiting for approval…');
    pollAttempt(data.attemptId);
  }

  async function cancelConnect() {
    const attemptId = state.attemptId;
    // Clear locally first: the server call must never be able to leave the UI
    // stuck in a busy state.
    stopPolling();
    state.attemptId = null;
    setBusy(false);
    $('connect-panel').hidden = true;
    setStatus($('pkce-status'), 'Authorization cancelled.');
    if (attemptId) {
      try {
        await api('/api/credential/connect/cancel', {
          method: 'POST',
          body: JSON.stringify({ attemptId }),
        });
      } catch (_) {
        /* the local state is already correct */
      }
    }
  }

  function wireUi() {
    $('api-key-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = $('api-key-input').value;
      setStatus($('api-key-status'), 'Saving…');
      try {
        const result = await api('/api/credential/api-key', {
          method: 'POST',
          body: JSON.stringify({ key: value }),
        });
        // Clear the field immediately: the key lives on the server, not here.
        $('api-key-input').value = '';
        setStatus($('api-key-status'), `Stored ${result.maskedKey}.`, 'ok');
        await refreshProvider();
        await refreshModels();
      } catch (error) {
        setStatus($('api-key-status'), error.message, 'error');
      }
    });

    $('api-key-clear').addEventListener('click', async () => {
      try {
        await api('/api/credential', { method: 'DELETE' });
        $('api-key-input').value = '';
        setStatus($('api-key-status'), 'Credential cleared.', 'ok');
        await refreshProvider();
        await refreshModels();
      } catch (error) {
        setStatus($('api-key-status'), error.message, 'error');
      }
    });

    $('credential-clear').addEventListener('click', async () => {
      await api('/api/credential', { method: 'DELETE' });
      await refreshProvider();
    });

    $('connect-start').addEventListener('click', async () => {
      // Switching authentication method always releases the previous lock.
      await cancelConnect();
      await startConnect('loopback');
    });

    $('connect-cancel').addEventListener('click', cancelConnect);

    $('connect-submit-code').addEventListener('click', async () => {
      const attemptId = state.attemptId;
      const code = $('connect-code').value.trim();
      if (!attemptId || !code) return;
      try {
        await api(`/api/credential/connect/${attemptId}/code`, {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        $('connect-code').value = '';
        setStatus($('pkce-status'), 'Exchanging the code for a key…');
        pollAttempt(attemptId);
      } catch (error) {
        setStatus($('pkce-status'), error.message, 'error');
      }
    });

    $('capability-select').addEventListener('change', () => {
      const isChat = $('capability-select').value === 'chat';
      for (const modality of ['image', 'audio', 'video']) {
        $(`modality-${modality}`).disabled = !isChat;
      }
      refreshModels();
    });

    for (const modality of ['image', 'audio', 'video']) {
      $(`modality-${modality}`).addEventListener('change', refreshModels);
    }

    $('model-trigger').addEventListener('click', () => {
      if ($('model-panel').hidden) openPanel();
      else closePanel();
    });

    $('model-search').addEventListener('input', (event) => renderModelList(event.target.value));

    $('model-search').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
      if (event.key === 'Enter') {
        const first = $('model-listbox').querySelector('li');
        if (first) selectModel(first.dataset.modelId);
      }
    });

    document.addEventListener('click', (event) => {
      if (!$('model-combo').contains(event.target)) closePanel();
    });

    // Back-forward cache: the page may be restored without any React-style
    // remount, so the busy state and the authorization hint are cleared here,
    // synchronously, and the server cancellation is sent with keepalive.
    window.addEventListener('pagehide', () => {
      const attemptId = state.attemptId;
      stopPolling();
      state.attemptId = null;
      setBusy(false);
      $('connect-panel').hidden = true;
      setStatus($('pkce-status'), 'Page closed — authorization released.');
      if (attemptId) {
        try {
          fetch('/api/credential/connect/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attemptId }),
            keepalive: true,
          }).catch(() => {});
        } catch (_) {
          /* nothing more can be done while the page is going away */
        }
      }
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Restored from the back-forward cache: prove the lock is free.
        setBusy(false);
        $('connect-panel').hidden = true;
      }
    });
  }

  async function boot() {
    wireUi();
    setBusy(false);
    try {
      await refreshProvider();
    } catch (error) {
      setStatus($('pkce-status'), `Could not load provider status: ${error.message}`, 'error');
      return;
    }
    await refreshModels();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // Exposed for the screenshot/automation harness.
  window.__orca = { state, refreshModels, refreshProvider, startConnect };
})();
