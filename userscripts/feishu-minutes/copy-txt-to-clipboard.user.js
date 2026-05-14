// ==UserScript==
// @name         Feishu Minutes: Copy TXT to Clipboard
// @namespace    https://github.com/lennondotw/userscripts
// @version      2026.05.14.0609
// @description  Adds a "Copy TXT to clipboard" item to the Minutes transcript menu, right under 导出文字记录. Calls /minutes/api/export with format=2 and copies the TXT response.
// @author       reeky
// @match        https://*.feishu.cn/minutes/*
// @match        https://*.larksuite.com/minutes/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @homepageURL  https://github.com/lennondotw/userscripts
// @supportURL   https://github.com/lennondotw/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/feishu-minutes/copy-txt-to-clipboard.user.js
// @downloadURL  https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/feishu-minutes/copy-txt-to-clipboard.user.js
// @license      MIT
// ==/UserScript==

// @ts-check
// Global `GM_setClipboard` is declared by `@types/tampermonkey`.
// @see https://www.tampermonkey.net/documentation.php#api:GM_setClipboard

;(function () {
  'use strict'

  /** Display label for the injected menu item. */
  const NEW_LABEL = 'Copy TXT to clipboard'

  /**
   * Localized labels of the source menu item we anchor to. We match against
   * either the rendered text or the trailing segment of `data-menu-id`
   * (which Lark builds as `rc-menu-uuid-<n>-<n>-<label>`).
   *
   * @type {readonly string[]}
   */
  const EXPORT_LABELS = ['导出文字记录', 'Export transcript', '匯出文字記錄']

  /** Marker attribute set on the cloned LI so we don't reinject repeatedly. */
  const INJECTED_FLAG = 'data-copy-txt-injected'

  /**
   * Pull the Minutes object token out of the current URL.
   * Returns `null` if the path doesn't look like `/minutes/<token>`.
   *
   * @returns {string | null}
   */
  function getObjectToken() {
    const m = location.pathname.match(/\/minutes\/([^/?#]+)/)
    return m ? m[1] : null
  }

  /**
   * Call the same API the in-page "导出文字记录 → TXT" flow uses and return
   * the plain-text transcript. Mirrors the request body captured in the HAR.
   *
   * @returns {Promise<string>}
   * @throws {Error} when the URL has no object token or the server is non-2xx.
   */
  async function fetchTranscriptText() {
    const objectToken = getObjectToken()
    if (!objectToken) throw new Error('No object_token in URL')

    const body = new URLSearchParams({
      add_speaker: 'true',
      add_timestamp: 'true',
      format: '2', // 2 = TXT (3 = SRT, 1 = Feishu Doc)
      is_fluent: 'false',
      language: 'zh_cn',
      object_token: objectToken,
      translate_lang: 'default',
    })

    const res = await fetch('/minutes/api/export', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
      },
      body: body.toString(),
    })
    if (!res.ok) throw new Error(`export ${res.status}`)
    return await res.text()
  }

  /**
   * Best-effort clipboard write. Prefers `GM_setClipboard` (works even when
   * the document isn't focused, e.g. right after the dropdown closes), then
   * `navigator.clipboard.writeText`, then a hidden `<textarea>` + `execCommand`.
   *
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function writeClipboard(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, { type: 'text', mimetype: 'text/plain' })
      return
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch (_) {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px;'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
  }

  /**
   * Show a small transient toast at the top of the viewport.
   *
   * @param {string} msg
   * @param {boolean} [isError]
   * @returns {void}
   */
  function toast(msg, isError) {
    const t = document.createElement('div')
    t.textContent = msg
    t.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:72px',
      'transform:translateX(-50%)',
      `background:${isError ? '#f53f3f' : '#1f2329'}`,
      'color:#fff',
      'padding:8px 14px',
      'border-radius:8px',
      'font-size:13px',
      'line-height:1.4',
      'z-index:2147483647',
      'box-shadow:0 6px 24px rgba(0,0,0,.2)',
      'pointer-events:none',
      'max-width:80vw',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';')
    document.body.appendChild(t)
    setTimeout(() => {
      t.style.transition = 'opacity .2s'
      t.style.opacity = '0'
    }, 1400)
    setTimeout(() => t.remove(), 1700)
  }

  /**
   * Click handler for the injected menu item.
   *
   * @param {MouseEvent} e
   * @returns {Promise<void>}
   */
  async function onClickCopy(e) {
    e.preventDefault()
    e.stopPropagation()
    // Close the dropdown by dispatching a click outside.
    document.body.click()
    try {
      const text = await fetchTranscriptText()
      if (!text || !text.trim()) throw new Error('empty response')
      await writeClipboard(text)
      toast(`Copied transcript (${text.length} chars)`)
    } catch (err) {
      console.error('[Copy TXT to Clipboard]', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast('Copy failed: ' + msg, true)
    }
  }

  /**
   * Whether the given LI is the "导出文字记录" entry in any supported locale.
   *
   * @param {HTMLLIElement} li
   * @returns {boolean}
   */
  function isExportItem(li) {
    const id = li.getAttribute('data-menu-id') || ''
    const text = (li.textContent || '').trim()
    return EXPORT_LABELS.some((lbl) => id.endsWith(lbl) || text === lbl || text.startsWith(lbl))
  }

  /**
   * Build a new LI by cloning the export item so we inherit Lark's styling,
   * then swap the label, icon, attributes, and click handler.
   *
   * @param {HTMLLIElement} template
   * @returns {HTMLLIElement}
   */
  function buildCopyItem(template) {
    const clone = /** @type {HTMLLIElement} */ (template.cloneNode(true))
    clone.setAttribute(INJECTED_FLAG, '1')
    clone.setAttribute('data-menu-id', 'copy-txt-to-clipboard')
    clone.removeAttribute('aria-disabled')
    clone.classList.remove('ud__menu-normal-item-active')

    // Replace the label text. The original wraps text in a span with class .ud__text.
    const title = clone.querySelector('.ud__menu-normal-item-title-content, .ud__text')
    if (title) {
      // Remove any tooltip icon (e.g. info icon) that may be nested.
      title.querySelectorAll('.universe-icon').forEach((el) => el.remove())
      title.textContent = NEW_LABEL
    } else {
      clone.textContent = NEW_LABEL
    }

    // Swap the leading icon for a clipboard glyph.
    const iconWrap = clone.querySelector('.ud__menu-normal-icon-wrap')
    if (iconWrap) {
      iconWrap.innerHTML =
        '<span class="universe-icon">' +
        '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="currentColor" d="M9 2a3 3 0 0 0-2.83 2H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2h1a2 2 0 0 0 2-2V7.83a2 2 0 0 0-.59-1.42l-3.82-3.82A2 2 0 0 0 15.17 2H9Zm0 2h5v3a2 2 0 0 0 2 2h3v8h-1V8.83a2 2 0 0 0-.59-1.42l-3.82-3.82A2 2 0 0 0 12.17 3H9a1 1 0 0 1 0-1Zm-4 4h6v3a2 2 0 0 0 2 2h3v8H5V8Z"/>' +
        '</svg></span>'
    }

    // Hook our handler. Use mousedown stop to keep the menu alive long enough
    // for the click to be received before React's outside-click handler fires.
    clone.addEventListener('mousedown', (ev) => ev.stopPropagation(), true)
    clone.addEventListener('click', (ev) => onClickCopy(/** @type {MouseEvent} */ (ev)), true)
    return clone
  }

  /**
   * Scan all currently-mounted Lark dropdown menus and inject our item into
   * each one that has the export entry but not yet our entry.
   *
   * @param {Document | Element} root
   * @returns {void}
   */
  function tryInject(root) {
    /** @type {Document | Element} */
    const scope = root && 'querySelectorAll' in root ? root : document
    const lists = scope.querySelectorAll('ul.ud__menu-normal')
    lists.forEach((ul) => {
      // Skip if our item is already present in this dropdown.
      if (ul.querySelector(`li[${INJECTED_FLAG}]`)) return
      const items = /** @type {NodeListOf<HTMLLIElement>} */ (
        ul.querySelectorAll('li.ud__menu-normal-item')
      )
      for (const li of items) {
        if (isExportItem(li) && li.parentNode) {
          const ours = buildCopyItem(li)
          li.parentNode.insertBefore(ours, li.nextSibling)
          break
        }
      }
    })
  }

  // Initial sweep + observe future mutations (dropdowns mount/unmount on demand).
  tryInject(document)

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.addedNodes.length) {
        tryInject(document)
        return
      }
    }
  })
  obs.observe(document.body, { childList: true, subtree: true })
})()
