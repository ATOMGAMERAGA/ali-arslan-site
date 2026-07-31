/**
 * Tema secimi. <head> icinde SENKRON calisir (defer/async yok): sayfa
 * boyanmadan once <html> uzerindeki data-aa-theme ayarlanir, boylece koyu
 * temada acilista beyaz parlama olmaz.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var mode = null;
  try { mode = localStorage.getItem('aa_theme'); } catch (e) { /* gizli sekme */ }
  if (mode !== 'sistem' && mode !== 'acik' && mode !== 'koyu') {
    mode = root.getAttribute('data-aa-mode') || 'sistem';
  }
  root.setAttribute('data-aa-mode', mode);
  var koyu = mode === 'koyu' || (mode === 'sistem'
    && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-aa-theme', koyu ? 'dark' : 'light');
})();
