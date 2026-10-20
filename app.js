const state = { docs: [], query: '' };
const $ = selector => document.querySelector(selector);
const groupNames = { Overview: 'Overview', outreach: 'Outreach', research: 'Research' };
const groupIcons = { Overview: '◫', outreach: '↗', research: '◇' };
const groupOrder = ['Overview', 'outreach', 'research'];
const displayGroup = group => groupNames[group] || group.replaceAll('-', ' ');
const docUrl = doc => `#doc=${encodeURIComponent(doc.path)}`;

function currentDoc() {
  if (!location.hash.startsWith('#doc=')) return null;
  let path;
  try { path = decodeURIComponent(location.hash.slice(5)); } catch { return null; }
  return state.docs.find(doc => doc.path === path) || null;
}

function matchingDocs() {
  const words = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return state.docs.filter(doc => words.every(word => `${doc.title} ${doc.path} ${doc.searchText}`.toLowerCase().includes(word)));
}

function item(doc, className = 'nav-link') {
  const a = document.createElement('a');
  a.className = className;
  a.href = docUrl(doc);
  a.textContent = doc.title;
  a.title = doc.path;
  if (currentDoc()?.path === doc.path) a.setAttribute('aria-current', 'page');
  return a;
}

function renderNav(docs) {
  const nav = $('#doc-nav');
  nav.replaceChildren();
  for (const group of [...new Set(docs.map(doc => doc.group))].sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))) {
    const section = document.createElement('div');
    section.className = 'nav-group';
    const heading = document.createElement('div');
    heading.className = 'nav-group-title';
    heading.textContent = displayGroup(group);
    section.append(heading);
    for (const doc of docs.filter(doc => doc.group === group)) section.append(item(doc));
    nav.append(section);
  }
  $('#doc-count').textContent = docs.length;
}

function renderHome(docs) {
  $('#browse-count').textContent = `${docs.length} ${docs.length === 1 ? 'document' : 'documents'}`;
  const cards = $('#cards');
  cards.replaceChildren();
  for (const doc of [...docs].sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || a.path.localeCompare(b.path))) {
    const card = item(doc, 'doc-card');
    const icon = document.createElement('span'); icon.className = 'card-icon'; icon.textContent = groupIcons[doc.group] || '□';
    const category = document.createElement('span'); category.className = 'card-category'; category.textContent = displayGroup(doc.group);
    const title = document.createElement('strong'); title.textContent = doc.title;
    const path = document.createElement('span'); path.className = 'card-path'; path.textContent = doc.path;
    const arrow = document.createElement('span'); arrow.className = 'card-arrow'; arrow.textContent = '↗';
    card.textContent = '';
    card.append(icon, category, title, path, arrow);
    cards.append(card);
  }
}

function render() {
  const doc = currentDoc();
  const docs = matchingDocs();
  renderNav(docs);
  renderHome(docs);
  $('#home-view').hidden = !!doc || (state.query && docs.length === 0);
  $('#reader-view').hidden = !doc;
  $('#empty-view').hidden = !!doc || !state.query || docs.length > 0;
  $('#topbar-count').textContent = `${state.docs.length} files`;
  if (doc) {
    $('#reader-group').textContent = displayGroup(doc.group).toUpperCase();
    $('#article').innerHTML = doc.html;
    $('#reader-path').textContent = doc.path;
    document.title = `${doc.title} · Side income`;
  } else document.title = 'Side income · Documents';
  $('#sidebar').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
}

$('#search').addEventListener('input', event => { state.query = event.target.value; if (location.hash) location.hash = ''; render(); });
$('#menu-toggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
try { document.documentElement.dataset.theme = localStorage.getItem('theme') || ''; } catch {}
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && colorScheme.matches);
  $('#theme-toggle').textContent = dark ? '☀ Light' : '☾ Dark';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#151b24' : '#f6f7f9';
}
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && colorScheme.matches);
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', document.documentElement.dataset.theme); } catch {}
  updateThemeButton();
});
colorScheme.addEventListener('change', updateThemeButton);
updateThemeButton();
window.addEventListener('hashchange', render);
window.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
  if (event.key === 'Escape') { $('#search').blur(); $('#sidebar').classList.remove('open'); }
});

const decoder = new TextDecoder();
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const username = $('#username').value.trim();
  const password = $('#password').value;
  const button = $('#login-button');
  $('#login-error').hidden = true;
  button.disabled = true;
  button.textContent = 'Opening…';
  try {
    if (username !== 'dtchen') throw new Error('Invalid username');
    const payload = window.ENCRYPTED_DOCS;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(payload.salt), iterations: payload.iterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
    const docs = JSON.parse(decoder.decode(plain));
    if (!Array.isArray(docs)) throw new Error('Invalid documents');
    state.docs = docs;
    $('#password').value = '';
    $('#login-view').hidden = true;
    $('#app-shell').hidden = false;
    render();
  } catch {
    $('#login-error').hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});
