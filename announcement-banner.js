/**
 * ════════════════════════════════════════════════════════════
 *  announcement-banner.js  —  Google Sheets Edition
 *  IT Service Desk  |  Login Page Announcement Banner
 * ════════════════════════════════════════════════════════════
 *
 *  วิธีใช้ — เพิ่ม 2 บรรทัดนี้ใน index.html ก่อน </body>:
 *
 *    <script>var SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';</script>
 *    <script src="announcement-banner.js"></script>
 *
 *  ไม่กระทบโค้ดเดิมใดๆ  |  อัปเดตอัตโนมัติทุก 60 วินาที
 * ════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────── */
  var SHEET_ID      = window.SHEET_ID      || '';
  var SHEET_NAME    = window.SHEET_NAME    || 'Sheet1';
  var POLL_INTERVAL = 60 * 1000; // ดึงข้อมูลใหม่ทุก 60 วินาที
  var DISMISSED_KEY = 'itsd_ann_dismissed_v2';

  /* ─── STYLE ──────────────────────────────────── */
  function injectStyle() {
    if (document.getElementById('ann-style')) return;
    var s = document.createElement('style');
    s.id  = 'ann-style';
    s.textContent =
      '#ann-zone{width:100%;display:flex;flex-direction:column;gap:8px;margin-bottom:14px}' +
      '.ann{border-radius:10px;padding:11px 14px;font-size:13px;font-family:\'Sarabun\',sans-serif;display:flex;gap:10px;align-items:flex-start;animation:annIn .35s cubic-bezier(.21,1.02,.73,1) both}' +
      '@keyframes annIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}' +
      '.ann.critical{background:rgba(220,38,38,.18);border:1px solid rgba(220,38,38,.55);color:#fca5a5}' +
      '.ann.maintenance{background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.50);color:#fcd34d}' +
      '.ann-ico{width:17px;height:17px;flex-shrink:0;margin-top:2px}' +
      '.ann-body{flex:1;min-width:0}' +
      '.ann-ttl{font-weight:700;margin-bottom:2px}' +
      '.ann-ttl.critical{color:#ff6b6b}' +
      '.ann-ttl.maintenance{color:#fbbf24}' +
      '.ann-txt{font-size:12px;opacity:.9;line-height:1.55}' +
      '.ann-ref{font-size:11px;opacity:.5;margin-top:3px;font-family:monospace}' +
      '.ann-end{font-size:11px;opacity:.5;margin-top:2px}' +
      '.ann-dis{display:inline-flex;align-items:center;gap:5px;margin-top:6px;background:none;border:1px solid currentColor;border-radius:5px;color:inherit;font-size:11px;padding:2px 9px;cursor:pointer;opacity:.6;font-family:\'Sarabun\',sans-serif;transition:opacity .15s}' +
      '.ann-dis:hover{opacity:1}' +
      '.ann-block{width:100%;border-radius:10px;padding:13px 16px;text-align:center;background:rgba(180,10,10,.28);border:1.5px solid rgba(220,38,38,.7);color:#fca5a5;font-family:\'Sarabun\',sans-serif;animation:annIn .35s cubic-bezier(.21,1.02,.73,1) both}' +
      '.ann-block strong{display:block;font-size:14px;color:#ff6b6b;margin-bottom:4px}' +
      '.ann-block span{font-size:12px;opacity:.85}';
    document.head.appendChild(s);
  }

  /* ─── ICONS ──────────────────────────────────── */
  var ICO = {
    critical:    '<svg class="ann-ico" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    maintenance: '<svg class="ann-ico" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  /* ─── DISMISSED ──────────────────────────────── */
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch(e) { return []; }
  }
  function dismiss(id) {
    var d = getDismissed();
    if (d.indexOf(id) === -1) { d.push(id); localStorage.setItem(DISMISSED_KEY, JSON.stringify(d)); }
    render(_lastData);
  }
  window._annDismiss = dismiss;

  /* ─── FETCH ──────────────────────────────────── */
  var _lastData = [];

  function fetchSheet() {
    if (!SHEET_ID) { console.warn('[ann-banner] ยังไม่ได้ตั้งค่า SHEET_ID'); return; }

    /* ใช้ gviz/tq endpoint — ไม่ต้อง API key, ดึง CSV ได้จาก public sheet */
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
              '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(SHEET_NAME) +
              '&t=' + Date.now();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 10000;
    xhr.onload = function () {
      if (xhr.status === 200) {
        var rows = parseCSV(xhr.responseText);
        _lastData = filterActive(rows);
        render(_lastData);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      /* เน็ตมีปัญหา: ไม่แสดงอะไร ไม่ block login */
      console.warn('[ann-banner] ดึงข้อมูลไม่ได้ — ข้ามไป');
    };
    xhr.send();
  }

  /* ─── CSV PARSER ─────────────────────────────── */
  function parseCSV(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    var headers = splitRow(lines[0]).map(function(h){ return h.toLowerCase().replace(/[^a-z_]/g,''); });
    return lines.slice(1).map(function(line) {
      var vals = splitRow(line), obj = {};
      headers.forEach(function(h,i){ obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
  }

  function splitRow(row) {
    var res = [], cur = '', inQ = false;
    for (var i = 0; i < row.length; i++) {
      var c = row[i];
      if (c === '"' && row[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
      else { cur += c; }
    }
    res.push(cur);
    return res;
  }

  /* ─── FILTER ─────────────────────────────────── */
  function isTrue(v) { return /^(true|yes|1|y)$/i.test(String(v).trim()); }

  function filterActive(rows) {
    var now = Date.now();
    return rows.filter(function(r) {
      if (!isTrue(r.is_active)) return false;
      var sev = (r.severity||'').toLowerCase();
      if (sev !== 'critical' && sev !== 'maintenance') return false;
      if (r.start_at) { try{ if(new Date(r.start_at).getTime() > now) return false; }catch(e){} }
      if (r.end_at)   { try{ if(new Date(r.end_at).getTime()   < now) return false; }catch(e){} }
      return true;
    }).sort(function(a,b){
      if (a.severity==='critical' && b.severity!=='critical') return -1;
      if (b.severity==='critical' && a.severity!=='critical') return  1;
      return 0;
    });
  }

  /* ─── RENDER ─────────────────────────────────── */
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    } catch(e){ return iso; }
  }

  function render(data) {
    var zone     = document.getElementById('ann-zone');
    var loginBox = document.getElementById('user-login-box');
    if (!zone || !loginBox) return;

    zone.innerHTML = '';
    var dismissed = getDismissed();

    /* blocks_login */
    var blocked = data.filter(function(r){ return isTrue(r.blocks_login); });
    if (blocked.length) {
      var b = blocked[0];
      loginBox.style.display = 'none';
      zone.innerHTML =
        '<div class="ann-block">' +
          '<strong>ระบบไม่พร้อมให้บริการในขณะนี้</strong>' +
          (b.body       ? '<span>'+esc(b.body)+'</span>'                          : '') +
          (b.ticket_ref ? '<div class="ann-ref">Ticket: '+esc(b.ticket_ref)+'</div>' : '') +
        '</div>';
      return;
    }
    loginBox.style.display = '';

    /* filter dismissed */
    var visible = data.filter(function(r){
      var id = r.id || r.ticket_ref || r.title;
      return !(r.severity==='maintenance' && dismissed.indexOf(id)!==-1);
    });

    visible.forEach(function(r) {
      var sev = r.severity.toLowerCase();
      var id  = r.id || r.ticket_ref || r.title;
      var div = document.createElement('div');
      div.className = 'ann '+sev;
      div.innerHTML =
        ICO[sev] +
        '<div class="ann-body">' +
          '<div class="ann-ttl '+sev+'">'+esc(r.title)+'</div>' +
          (r.body       ? '<div class="ann-txt">'+esc(r.body)+'</div>'              : '') +
          (r.ticket_ref ? '<div class="ann-ref">Ticket: '+esc(r.ticket_ref)+'</div>': '') +
          (r.end_at     ? '<div class="ann-end">สิ้นสุด '+fmtDate(r.end_at)+'</div>': '') +
          (sev==='maintenance' ? '<button class="ann-dis" onclick="window._annDismiss(\''+esc(id)+'\')">รับทราบ ✕</button>' : '') +
        '</div>';
      zone.appendChild(div);
    });
  }

  /* ─── MOUNT ──────────────────────────────────── */
  function mount() {
    injectStyle();
    var loginBox = document.getElementById('user-login-box');
    if (!loginBox) return;

    /* สร้าง zone เหนือ login box (ครั้งเดียว) */
    if (!document.getElementById('ann-zone')) {
      var zone = document.createElement('div');
      zone.id  = 'ann-zone';
      loginBox.parentNode.insertBefore(zone, loginBox);
    }

    fetchSheet();
    setInterval(fetchSheet, POLL_INTERVAL);

    /* คอย login-overlay เปิด → fetch ใหม่ทุกครั้ง */
    var ol = document.getElementById('login-overlay');
    if (ol) {
      new MutationObserver(function(){
        if (ol.classList.contains('visible')) fetchSheet();
      }).observe(ol, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ─── INIT ───────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
