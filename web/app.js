'use strict';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  paper: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h5"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3-.3 6-1.5 6-6.5a5 5 0 0 0-1.4-3.5A5 5 0 0 0 18.5 2S17.3 1.7 15 3a13 13 0 0 0-6 0C6.7 1.7 5.5 2 5.5 2a5 5 0 0 0-.1 3.3A5 5 0 0 0 4 8.8c0 5 3 6.2 6 6.5A3.5 3.5 0 0 0 9 18v4"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  bookmark: '<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',
  chart: '<path d="M4 19V5M4 19h17M8 14l4-5 4 2 5-7"/>',
  settings: '<path d="m9.5 3-.7 2.2-2 .9-2.2-.5-2.1 3.6L4 11v2l-1.5 1.8 2.1 3.6 2.2-.5 2 .9.7 2.2h5l.7-2.2 2-.9 2.2.5 2.1-3.6L20 13v-2l1.5-1.8-2.1-3.6-2.2.5-2-.9L14.5 3Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5M4 17a9 9 0 0 0 15 2l2-3m0 5v-5h-5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  link: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
};
const icon = (name, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : '#'; } catch { return '#'; } };
const logo = (item, extra = '') => `<span class="resource-logo ${extra}" style="--logo-color:${/^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#438e7a'}">${esc(item.icon)}</span>`;
const labels = {overview:'学习概览',library:'资源库',updates:'订阅更新',papers:'论文研究',github:'GitHub 动态',favorites:'我的收藏',progress:'学习进度',settings:'订阅与设置',search:'搜索结果'};
const kindLabels = {news:'技术资讯',papers:'论文研究',github:'GitHub 动态'};
let data = {resources:[],sources:[],items:[],syncing:false,auto_refresh:true};
let view = 'overview', category = '全部', typeFilter = '全部类型', sort = 'default', query = '', feedFilter = 'all', sourceFilter = null, feedLimit = 30;
let toastTimeout, searchTimeout, pollTimer, pollBusy = false, pendingRender = false;

async function api(path, body) {
  const response = await fetch(path, body === undefined ? {cache:'no-store'} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败，请稍后重试');
  return result;
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 3400);
}
async function reload(renderPage = true) {
  data = await api('/api/state');
  renderNav();
  if (renderPage) render();
}
function relativeTime(value) {
  if (!value) return '等待同步';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(diff)) return '';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(value).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});
}
function renderNav() {
  const unread = data.items.filter(i => !i.read).length;
  const nav = [['overview','grid'],['library','book'],['updates','rss'],['papers','paper'],['github','github'],['favorites','star'],['progress','chart']];
  document.getElementById('primary-nav').innerHTML = nav.map(([v,i]) => `<button class="nav-item ${view === v && !sourceFilter ? 'active' : ''}" data-view="${v}" ${view===v?'aria-current="page"':''}>${icon(i)}<span>${labels[v]}</span>${v==='updates' && unread ? `<span class="count">${unread}</span>`:''}${v==='favorites' ? `<span class="count">${data.resources.filter(r=>r.favorite).length+data.items.filter(i=>i.favorite).length}</span>`:''}</button>`).join('');
  document.getElementById('source-nav').innerHTML = data.sources.slice(0,6).map(s => `<button class="source-nav-item ${sourceFilter === s.id ? 'active':''}" data-source-view="${s.id}" title="${esc(s.name)}"><span class="source-tiny" style="color:${/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#438e7a'}">${esc(s.icon)}</span><span>${esc(s.name)}</span><span class="source-indicator ${s.error?'error':''}"></span></button>`).join('') + '<button class="source-nav-item" data-view="settings">'+icon('plus',14)+'<span>管理全部订阅</span></button>';
  const settings = document.getElementById('settings-nav');
  settings.innerHTML = `${icon('settings')}<span>订阅与设置</span>`;
  settings.classList.toggle('active', view==='settings');
  document.getElementById('breadcrumb-title').textContent = sourceFilter ? data.sources.find(s=>s.id===sourceFilter)?.name || labels[view] : labels[view];
  document.getElementById('search-icon').innerHTML = icon('search',15);
  document.getElementById('inbox-button').innerHTML = icon('bell',18);
  document.title = `${labels[view]} · LearnNest`;
}
function pageHeading(title, subtitle, options={}) {
  return `<div class="page-title-row"><div><span class="eyebrow">${options.eyebrow || 'YOUR PERSONAL LEARNING SPACE'}</span><h1>${title}</h1><p>${subtitle}</p></div><div class="title-actions">${options.feed ? `<button class="button secondary" data-action="mark-all">${icon('check',14)}<span class="button-label">全部已读</span></button><button class="button primary ${data.syncing?'spinning':''}" data-action="refresh" ${data.syncing?'disabled':''}>${icon('refresh',14)}${data.syncing?'同步中':'同步更新'}</button>` : `<button class="button secondary" data-action="add-source">${icon('link',14)}<span class="button-label">连接订阅</span></button><button class="button primary" data-action="add-resource">${icon('plus',14)}添加资源</button>`}</div></div>`;
}
function stat(label, value, unit, ico) {
  return `<div class="stat"><span class="stat-icon">${icon(ico,20)}</span><div><div class="stat-label">${label}</div><div class="stat-value">${value}<small>${unit}</small></div></div></div>`;
}
function resourceCard(r, showProgress=false) {
  return `<article class="resource-card"><div class="card-top">${logo(r)}<button class="star-button ${r.favorite?'saved':''}" data-action="resource-star" data-id="${r.id}" aria-label="${r.favorite?'取消收藏':'收藏'} ${esc(r.title)}" aria-pressed="${!!r.favorite}">${icon('star',17)}</button></div><h3><a href="${safeURL(r.url)}" target="_blank" rel="noopener noreferrer" data-resource-open="${r.id}">${esc(r.title)}</a></h3><p class="description">${esc(r.description || '为下一次探索，留一个入口。')}</p><div class="tags"><span class="tag ${r.category==='Agent'?'agent':r.category==='深度学习'?'deep':''}">${esc(r.category)}</span><span class="tag neutral">${esc(r.type)}</span><span class="tag neutral">${esc(r.level)}</span></div>${showProgress?`<div class="card-progress"><input type="range" min="0" max="100" step="5" value="${r.progress}" data-progress="${r.id}" aria-label="${esc(r.title)} 学习进度"><span data-progress-label="${r.id}">${r.progress}%</span></div>`:''}<div class="card-bottom"><span class="provider">${icon('link',11)}${esc(r.provider)}</span><a class="open-link" href="${safeURL(r.url)}" target="_blank" rel="noopener noreferrer" data-resource-open="${r.id}">${r.progress>=100?'再次学习':r.progress?'继续学习':'开始学习'}${icon('external',11)}</a>${showProgress?`<button class="icon-button" data-action="resource-delete" data-id="${r.id}" aria-label="删除 ${esc(r.title)}">${icon('trash',12)}</button>`:''}</div></article>`;
}
function empty(title, description, action='', compact=false) {
  return `<div class="empty-state ${compact?'compact':''}">${icon('book',29)}<h3>${title}</h3><p>${description}</p>${action}</div>`;
}
function libraryControls() {
  const cats = ['全部','深度学习','Agent','大模型','机器学习','开发工具'];
  return `<div class="library-controls"><div class="tabs" role="group" aria-label="学习方向筛选">${cats.map(c=>`<button class="tab ${category===c?'active':''}" data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('')}</div><div class="filter-actions">${icon('filter',13)}<select class="select-plain" id="type-filter" aria-label="资源类型">${['全部类型','课程','文档','实战','工具','项目'].map(t=>`<option ${typeFilter===t?'selected':''}>${t}</option>`).join('')}</select><select class="select-plain" id="sort-filter" aria-label="排列顺序"><option value="default" ${sort==='default'?'selected':''}>推荐排序</option><option value="newest" ${sort==='newest'?'selected':''}>最近添加</option><option value="progress" ${sort==='progress'?'selected':''}>学习进度</option></select></div></div>`;
}
function matches(r) { return !query || [r.title,r.description,r.category,r.provider,r.source_name].join(' ').toLowerCase().includes(query.toLowerCase()); }
function filteredResources(resources=data.resources) {
  let list = resources.filter(r=>(category==='全部'||r.category===category)&&(typeFilter==='全部类型'||r.type===typeFilter)&&matches(r));
  if (sort==='newest') list.sort((a,b)=>b.id-a.id);
  if (sort==='progress') list.sort((a,b)=>b.progress-a.progress);
  return list;
}
function continueSection() {
  const ongoing = data.resources.filter(r=>r.progress>0&&r.progress<100).sort((a,b)=>b.progress-a.progress).slice(0,2);
  const starters = data.resources.filter(r=>r.progress===0&&(r.id===1||r.id===2)).slice(0,2-ongoing.length);
  return `<div class="section-heading"><h2>接着上次，继续探索 <small>一步一步，积少成多</small></h2><button class="button text" data-view="progress">学习进度 ${icon('arrow',13)}</button></div><div class="continue-grid">${[...ongoing,...starters].map(r=>`<a class="continue-card" href="${safeURL(r.url)}" target="_blank" rel="noopener noreferrer" data-resource-open="${r.id}">${logo(r)}<div class="continue-content"><h3>${esc(r.title)}</h3><p>${r.progress?`已完成 ${r.progress}% · 继续你的学习之旅`:'为你推荐 · 从第一章开始探索'}</p><div class="progress-line"><span style="width:${r.progress}%"></span></div></div><span class="continue-go">${icon('arrow',13)}</span></a>`).join('')}</div>`;
}
function syncCaption() {
  const latest = data.sources.filter(s=>s.last_attempt).map(s=>s.last_attempt).sort().at(-1);
  return `<span class="sync-caption"><span class="pulse ${data.syncing?'busy':''}"></span>${data.syncing?'正在获取最新内容':latest?`最近同步 · ${relativeTime(latest)}`:'首次同步准备中'}</span>`;
}
function recentUpdates() {
  const list = data.items.slice(0,4);
  return `<section class="updates-panel"><div class="section-heading"><h2>${icon('rss',16)} 关注的世界，正在更新</h2>${syncCaption()}</div>${list.length?list.map(i=>`<div class="activity-row">${logo(i)}<div class="activity-content"><button class="activity-title" data-action="read-item" data-id="${i.id}">${esc(i.title)}</button><div class="activity-meta">${esc(i.source_name)} <span class="footer-dot">·</span> ${kindLabels[i.kind]}</div></div><span class="activity-time">${relativeTime(i.published||i.fetched)}</span>${!i.read?'<span class="unread-dot"></span>':''}</div>`).join(''):empty(data.syncing?'正在为你获取第一批更新':'等待新的灵感抵达',data.syncing?'正在连接技术博客、论文和开源项目，获取后会出现在这里。':data.sources.some(s=>s.error)?'有些订阅暂时无法连接。可以在订阅设置里查看原因，检查网络后重新同步。':'点击同步，获取你关注的文章、论文与项目版本。',`<button class="button secondary" data-action="${data.sources.some(s=>s.error)?'open-settings':'refresh'}">${data.sources.some(s=>s.error)?'查看订阅状态':'获取更新'}</button>`,true)}<div style="text-align:center;margin-top:10px"><button class="button text" data-view="updates">查看全部动态 ${icon('arrow',13)}</button></div></section>`;
}
function overview() {
  const now = new Date(), hour = now.getHours(), greeting = hour<6?'夜深了':hour<12?'上午好':hour<18?'下午好':'晚上好';
  const unread = data.items.filter(i=>!i.read).length;
  return pageHeading(`${greeting}，学习者 <span style="font-size:20px">☀</span>`,'把零散的信息，变成有方向的成长。')+`<section class="hero"><div class="hero-copy"><div class="hero-kicker">${icon('spark',12)} A LITTLE CURIOUS, EVERY DAY</div><h2>你的下一次突破，从这里开始。</h2><p>深度学习、Agent 与开源世界，在这里连接。<br>收藏值得探索的方向，让每一次学习都有迹可循。</p><button class="button text hero-link" data-view="library">发现你的学习方向 ${icon('arrow',14)}</button></div><div class="hero-art" aria-hidden="true"><div class="art-card one">${icon('code',35)}</div><div class="art-card two">${icon('book',35)}</div><div class="art-card three">${icon('spark',35)}</div><span class="art-spark">✧</span></div></section><section class="stats" aria-label="学习统计">${stat('我的学习资源',data.resources.length,'个精选入口','book')}${stat('正在学习',data.resources.filter(r=>r.progress>0&&r.progress<100).length,'个学习方向','chart')}${stat('已收藏',data.resources.filter(r=>r.favorite).length+data.items.filter(i=>i.favorite).length,'份灵感','bookmark')}${stat('待探索动态',unread,'篇未读内容','rss')}</section>${continueSection()}<section class="library-section"><div class="section-heading"><h2>为好奇心，找一个入口 <small>精选学习资源</small></h2><button class="button text" data-view="library">全部资源 ${icon('arrow',13)}</button></div>${libraryControls()}<div class="resource-grid">${filteredResources().slice(0,6).map(r=>resourceCard(r)).join('')||`<div class="search-empty">${empty('这个方向，等待你的发现','换个筛选条件，或添加你喜欢的资源。')}</div>`}</div></section>${recentUpdates()}`;
}
function library() {
  const resources = filteredResources();
  return pageHeading('为你的学习，留一扇门','课程、文档与实战项目，建立属于你的知识入口。',{eyebrow:'YOUR KNOWLEDGE STARTS HERE'})+libraryControls()+`<p class="result-caption">共 ${resources.length} 个资源 · 在学习进度页可以调整完成度</p><div class="resource-grid">${resources.map(r=>resourceCard(r)).join('')||`<div class="search-empty">${empty('暂时没有匹配的资源','试试其他分类，或亲手添加一个新的学习入口。', '<button class="button primary" data-action="add-resource">添加资源</button>')}</div>`}</div>`;
}
function feedCard(item) {
  return `<article class="feed-card ${item.read?'is-read':''}"><div class="feed-card-head">${logo(item)}<span>${esc(item.source_name)}</span><span class="tag neutral">${kindLabels[item.kind]}</span><time datetime="${esc(item.published||item.fetched)}">${relativeTime(item.published||item.fetched)}</time></div><h3><button data-action="read-item" data-id="${item.id}">${esc(item.title)}</button></h3><p>${esc(item.description||'这个信息源没有提供摘要，点击查看原文了解更多。')}</p><div class="feed-card-footer"><div class="feed-tools"><button class="${item.favorite?'saved':''}" data-action="item-star" data-id="${item.id}" aria-pressed="${!!item.favorite}">${icon('star',14)}${item.favorite?'已收藏':'收藏'}</button><button data-action="item-read" data-id="${item.id}">${icon(item.read?'check':'clock',14)}${item.read?'已读':'标为已读'}</button></div><a class="open-link" href="${safeURL(item.url)}" target="_blank" rel="noopener noreferrer" data-item-open="${item.id}">查看原文 ${icon('external',11)}</a></div></article>`;
}
function feedAside(kind) {
  const sources = data.sources.filter(s=>!kind||s.kind===kind);
  return `<aside class="aside-panel"><h3>你的信息雷达</h3>${syncCaption()}<p>关注值得关注的事。开启自动更新后，工作台运行期间每 ${data.refresh_minutes||30} 分钟检查一次。</p>${sources.map(s=>`<div class="aside-source">${logo(s)}<div>${esc(s.name)}<small>${!s.enabled?'已暂停':s.error?'连接失败 · 可到设置重试':s.last_success?relativeTime(s.last_success)+'已同步':'等待第一次更新'}</small></div></div>`).join('')}<button class="button secondary" style="width:100%;margin-top:17px" data-action="add-source">${icon('plus',13)}添加订阅源</button></aside>`;
}
function feed() {
  const kind = view==='papers'?'papers':view==='github'?'github':null;
  const selected = sourceFilter?data.sources.find(s=>s.id===sourceFilter):null;
  const title = selected?esc(selected.name):view==='papers'?'让研究，成为新的灵感':view==='github'?'与开源世界，一起进化':'你关注的世界，正在更新';
  const description = selected?'这个订阅源的文章与更新，集中在这里。':view==='papers'?'来自 arXiv 的研究动态，收藏值得深入阅读的论文。':view==='github'?'关注项目的版本发布，了解你常用工具的变化。':'技术资讯、论文与项目动态，汇聚到一个收件箱。';
  let items = data.items.filter(i=>(!kind||i.kind===kind)&&(!sourceFilter||i.source_id===sourceFilter)&&matches(i));
  if (feedFilter==='unread') items=items.filter(i=>!i.read);
  if (feedFilter==='saved') items=items.filter(i=>i.favorite);
  return pageHeading(title,description,{feed:true,eyebrow:'A SIGNAL, NOT THE NOISE'})+`<div class="library-controls"><div class="tabs">${[['all','全部动态'],['unread','未读内容'],['saved','已收藏']].map(([v,t])=>`<button class="tab ${feedFilter===v?'active':''}" data-feed-filter="${v}">${t}</button>`).join('')}</div><span class="hint" style="font-size:10px;color:#98a59b">${items.length} 条内容</span></div><div class="feed-layout"><div>${items.length?items.slice(0,feedLimit).map(feedCard).join(''):empty(data.syncing?'正在连接你关注的信息源':'这里还没有内容',query?'试试换一个关键词。':feedFilter!=='all'?'阅读和收藏文章后，可以在这里找到它们。':data.sources.some(s=>s.error)?'部分订阅连接失败。请在订阅设置查看具体原因，之后可重新同步。':'添加 RSS、Atom 或 GitHub 仓库订阅，再点击同步获取更新。',`<button class="button secondary" data-action="${data.sources.some(s=>s.error)?'open-settings':'refresh'}">${data.sources.some(s=>s.error)?'查看订阅状态':'同步更新'}</button>`)}${items.length>feedLimit?'<div class="pagination"><button class="button secondary" data-action="load-more">加载更多内容</button></div>':''}</div>${feedAside(kind)}</div>`;
}
function favorites() {
  const resources=data.resources.filter(r=>r.favorite&&matches(r)), items=data.items.filter(i=>i.favorite&&matches(i));
  return pageHeading('给值得的内容，留一个位置','你收藏的学习资源、研究论文和技术文章。',{eyebrow:'KEEP THE GOOD FINDS'})+(!resources.length&&!items.length?empty('你的灵感收藏夹，准备好了','点击资源或文章旁边的星标，就能把值得深入探索的内容留在这里。','<button class="button primary" data-view="library">发现学习资源</button>'):`${resources.length?`<section class="library-section"><div class="section-heading"><h2>学习资源 <small>${resources.length} 个收藏</small></h2></div><div class="resource-grid">${resources.map(r=>resourceCard(r)).join('')}</div></section>`:''}${items.length?`<div class="section-heading"><h2>文章与动态 <small>${items.length} 条收藏</small></h2></div>${items.slice(0,feedLimit).map(feedCard).join('')}${items.length>feedLimit?'<div class="pagination"><button class="button secondary" data-action="load-more">加载更多</button></div>':''}`:''}`);
}
function progress() {
  const started=data.resources.filter(r=>r.progress>0), completed=started.filter(r=>r.progress>=100);
  const average=started.length?Math.round(started.reduce((sum,r)=>sum+r.progress,0)/started.length):0;
  return pageHeading('每一小步，都算数','打开资源会记录学习起点；拖动进度条，记录自己真实的完成度。',{eyebrow:'PROGRESS OVER PERFECTION'})+`<section class="stats">${stat('已开始学习',started.length,'个资源','book')}${stat('进行中',started.length-completed.length,'个资源','chart')}${stat('已完成',completed.length,'个资源','check')}${stat('平均完成度',average+'%','已开始的资源','spark')}</section><div class="section-heading"><h2>我的学习路径 <small>拖动进度条更新</small></h2></div>${libraryControls()}<div class="resource-grid">${filteredResources().sort((a,b)=>(b.progress>0)-(a.progress>0)).map(r=>resourceCard(r,true)).join('')||`<div class="search-empty">${empty('暂无匹配资源','可以换一个分类，或添加新的资源。')}</div>`}</div>`;
}
function settings() {
  return pageHeading('让信息，主动来找你','管理订阅与更新偏好，让你的学习空间持续生长。',{eyebrow:'A WORKSPACE THAT GROWS WITH YOU'})+`<div class="settings-grid"><section class="settings-panel"><div class="settings-title"><div><h2>已连接的信息源 <span class="badge">${data.sources.length} 个</span></h2><p style="font-size:10px;color:#9aa69b;margin-bottom:0">RSS / Atom 与 GitHub Releases · 不需要 API Key</p></div><button class="button secondary ${data.syncing?'spinning':''}" data-action="refresh" ${data.syncing?'disabled':''}>${icon('refresh',13)}${data.syncing?'同步中':'立即同步'}</button></div>${data.sources.length?data.sources.map(s=>`<div class="source-row">${logo(s)}<div class="source-details"><strong>${esc(s.name)}</strong><div class="source-url">${esc(s.url)}</div><div class="source-status ${s.error?'error':''}">${!s.enabled?'已暂停自动获取':s.error?esc(s.error)+(s.last_success?' · 保留上次成功同步内容':''):s.last_success?'已同步 · '+relativeTime(s.last_success):data.syncing?'正在连接信息源…':'等待第一次同步'}</div></div><label class="switch" title="${s.enabled?'暂停':'启用'}订阅"><input type="checkbox" data-source-enabled="${s.id}" ${s.enabled?'checked':''} aria-label="启用 ${esc(s.name)}"><span></span></label><button class="icon-button" data-action="source-delete" data-id="${s.id}" aria-label="删除 ${esc(s.name)}">${icon('trash',15)}</button></div>`).join(''):empty('还没有信息源','添加你的第一个 RSS 或 GitHub 订阅。','',true)}<button class="button secondary" style="margin-top:18px" data-action="add-source">${icon('plus',13)}连接新的信息源</button></section><section class="settings-panel"><h2>更新与数据</h2><div class="setting-row"><div><strong>自动获取订阅更新</strong><p>本地服务运行期间，每 ${data.refresh_minutes||30} 分钟获取一次。停止服务后暂停获取，重新启动时继续。</p></div><label class="switch"><input type="checkbox" id="auto-refresh" ${data.auto_refresh?'checked':''} aria-label="自动获取订阅更新"><span></span></label></div><div class="setting-row"><div><strong>导出我的学习空间</strong><p>导出资源、订阅、文章、收藏和学习进度为 JSON 文件。数据保存在本机 data 文件夹。</p></div><button class="button secondary" data-action="export">${icon('download',13)}导出数据</button></div></section><section class="settings-panel"><h2>关于 LearnNest</h2><p>一个属于你自己的学习工作台。当前版本支持 RSS / Atom 信息聚合、GitHub 版本订阅、资源管理、收藏和手动学习进度。外部网站需要网络连接，文章内容为来源提供的摘要。</p><p>工作台本身无需付费或注册。当前没有接入邮箱、AI 摘要或 GitHub 趋势榜；新增的 GitHub 仓库订阅跟踪其正式版本发布。</p><span class="badge">v1.0 · 本地运行</span></section></div>`;
}
function search() {
  const resources=data.resources.filter(matches),items=data.items.filter(matches);
  return pageHeading('找到你的下一份灵感',`搜索「${esc(query)}」 · ${resources.length+items.length} 个结果`,{eyebrow:'FIND SOMETHING WORTH LEARNING'})+(!resources.length&&!items.length?empty('还没找到这份灵感','试试更短的关键词，或先同步订阅更新。'):`${resources.length?`<section class="library-section"><div class="section-heading"><h2>学习资源 <small>${resources.length} 个</small></h2></div><div class="resource-grid">${resources.map(r=>resourceCard(r)).join('')}</div></section>`:''}${items.length?`<div class="section-heading"><h2>文章与动态 <small>${items.length} 条</small></h2></div>${items.slice(0,feedLimit).map(feedCard).join('')}${items.length>feedLimit?'<div class="pagination"><button class="button secondary" data-action="load-more">加载更多</button></div>':''}`:''}`);
}
function render() {
  const functions = {overview,library,updates:feed,papers:feed,github:feed,favorites,progress,settings,search};
  document.getElementById('main').innerHTML = (functions[view]||overview)();
  renderNav();
}
function navigate(next, options={}) {
  if (!labels[next]) next='overview';
  view=next;category='全部';typeFilter='全部类型';feedFilter='all';feedLimit=30;sourceFilter=options.source||null;
  if (view!=='search') {query='';document.getElementById('global-search').value='';}
  if (location.hash!=='#'+view) history.replaceState(null,'','#'+view);
  render();
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'instant'});
}
function showDialog(id) {
  const dialog=document.getElementById(id);
  const form=dialog.querySelector('form');
  if(form){form.reset();form.querySelector('.form-error').textContent='';}
  dialog.showModal();
}
async function updateResource(id, fields, renderPage=true) {
  await api('/api/resource/update',{id,...fields});
  const resource=data.resources.find(r=>r.id===Number(id));
  if(resource) Object.assign(resource,fields);
  renderNav();
  if(renderPage) render();
}
async function updateItem(id, fields, renderPage=true) {
  await api('/api/item/update',{id,...fields});
  const item=data.items.find(i=>i.id===id);
  if(item) Object.assign(item,fields);
  renderNav();
  if(renderPage) render();
}
async function refresh() {
  await api('/api/refresh',{});
  data.syncing=true;
  render();
  toast('正在同步订阅，获取后会自动显示');
  clearTimeout(pollTimer);
  pollTimer=setTimeout(poll,1600);
}
async function readItem(id) {
  const item=data.items.find(i=>i.id===id);
  if(!item)return;
  document.getElementById('reader-content').innerHTML=`<button class="icon-button close-dialog reader-close" aria-label="关闭">×</button><div class="reader-source">${logo(item)}${esc(item.source_name)} <span>· ${relativeTime(item.published||item.fetched)}</span></div><h2>${esc(item.title)}</h2><div class="reader-description">${esc(item.description||'来源未提供摘要。你可以打开原文继续阅读。')}</div><div class="reader-note">此处展示订阅源提供的摘要。完整文章、论文或版本说明请前往原网站阅读。</div><div class="modal-actions"><button class="button secondary" data-action="reader-star" data-id="${id}">${icon('star',14)}${item.favorite?'取消收藏':'收藏文章'}</button><a class="button primary" href="${safeURL(item.url)}" target="_blank" rel="noopener noreferrer">阅读原文 ${icon('external',13)}</a></div>`;
  document.getElementById('reader-dialog').showModal();
  await updateItem(id,{read:1});
}
async function exportData() {
  const snapshot=await api('/api/export');
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`learnnest-${new Date().toLocaleDateString('en-CA')}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习空间已导出');
}

document.addEventListener('click', async event=>{
  const close=event.target.closest('.close-dialog');
  if(close){close.closest('dialog').close();return;}
  const viewButton=event.target.closest('[data-view]');
  if(viewButton){navigate(viewButton.dataset.view);return;}
  const sourceButton=event.target.closest('[data-source-view]');
  if(sourceButton){navigate('updates',{source:Number(sourceButton.dataset.sourceView)});return;}
  const categoryButton=event.target.closest('[data-category]');
  if(categoryButton){category=categoryButton.dataset.category;render();return;}
  const feedButton=event.target.closest('[data-feed-filter]');
  if(feedButton){feedFilter=feedButton.dataset.feedFilter;feedLimit=30;render();return;}
  const resourceLink=event.target.closest('[data-resource-open]');
  if(resourceLink){const r=data.resources.find(r=>r.id===Number(resourceLink.dataset.resourceOpen));if(r&&r.progress===0)updateResource(r.id,{progress:5},false).catch(e=>toast(e.message));return;}
  const itemLink=event.target.closest('[data-item-open]');
  if(itemLink){updateItem(itemLink.dataset.itemOpen,{read:1},false).catch(e=>toast(e.message));return;}
  const actionButton=event.target.closest('[data-action]');
  if(!actionButton)return;
  const action=actionButton.dataset.action,id=actionButton.dataset.id;
  try{
    if(action==='add-resource')showDialog('resource-dialog');
    else if(action==='add-source')showDialog('source-dialog');
    else if(action==='menu')document.getElementById('sidebar').classList.toggle('open');
    else if(action==='resource-star'){const r=data.resources.find(r=>r.id===Number(id));await updateResource(id,{favorite:r.favorite?0:1});toast(r.favorite?'已加入收藏':'已取消收藏');}
    else if(action==='item-star'){const i=data.items.find(i=>i.id===id);await updateItem(id,{favorite:i.favorite?0:1});toast(i.favorite?'已收藏文章':'已取消收藏');}
    else if(action==='item-read'){const i=data.items.find(i=>i.id===id);await updateItem(id,{read:i.read?0:1});}
    else if(action==='read-item')await readItem(id);
    else if(action==='reader-star'){const i=data.items.find(i=>i.id===id);await updateItem(id,{favorite:i.favorite?0:1});actionButton.innerHTML=icon('star',14)+(i.favorite?'取消收藏':'收藏文章');toast(i.favorite?'已收藏文章':'已取消收藏');}
    else if(action==='refresh')await refresh();
    else if(action==='mark-all'){await api('/api/items/read',{});data.items.forEach(i=>i.read=1);render();toast('全部动态已标为已读');}
    else if(action==='open-settings')navigate('settings');
    else if(action==='load-more'){const y=window.scrollY;feedLimit+=30;render();window.scrollTo(0,y);}
    else if(action==='resource-delete'){const r=data.resources.find(r=>r.id===Number(id));if(confirm(`删除「${r.title}」及其学习进度？`)){await api('/api/resource/delete',{id});await reload();toast('资源已删除');}}
    else if(action==='source-delete'){const s=data.sources.find(s=>s.id===Number(id));if(confirm(`删除「${s.name}」及其缓存文章和文章收藏？`)){await api('/api/source/delete',{id});await reload();toast('订阅已删除');}}
    else if(action==='export')await exportData();
  }catch(error){toast(error.message);}
});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-progress]'))document.querySelector(`[data-progress-label="${event.target.dataset.progress}"]`).textContent=event.target.value+'%';
});
document.addEventListener('change',async event=>{
  const target=event.target;
  try{
    if(target.id==='type-filter'){typeFilter=target.value;render();}
    else if(target.id==='sort-filter'){sort=target.value;render();}
    else if(target.matches('[data-progress]')){const y=window.scrollY;await updateResource(target.dataset.progress,{progress:Number(target.value)});window.scrollTo(0,y);toast('学习进度已保存');}
    else if(target.matches('[data-source-enabled]')){await api('/api/source/update',{id:target.dataset.sourceEnabled,enabled:target.checked});await reload();toast(target.checked?'已启用订阅':'已暂停订阅');}
    else if(target.id==='auto-refresh'){await api('/api/settings',{auto_refresh:target.checked});data.auto_refresh=target.checked;toast(target.checked?'已开启自动更新':'已暂停自动更新');}
  }catch(error){toast(error.message);await reload();}
});
for(const [formId,path,dialogId,message] of [['resource-form','/api/resource/add','resource-dialog','已添加到资源库'],['source-form','/api/source/add','source-dialog','订阅源已连接，正在获取内容']]){
  document.getElementById(formId).addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
    try{
      await api(path,Object.fromEntries(new FormData(form)));
      document.getElementById(dialogId).close();await reload();toast(message);
      if(formId==='source-form')await refresh();
    }catch(error){form.querySelector('.form-error').textContent=error.message;}
    finally{button.disabled=false;}
  });
}
document.getElementById('global-search').addEventListener('input',event=>{
  clearTimeout(searchTimeout);const value=event.target.value.trim();
  searchTimeout=setTimeout(()=>{query=value;if(value){view='search';sourceFilter=null;feedLimit=30;render();}else navigate('overview');},200);
});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();document.getElementById('global-search').focus();}
  if(event.key==='Escape')document.getElementById('sidebar').classList.remove('open');
});
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
async function poll(){
  clearTimeout(pollTimer);
  if(pollBusy){pollTimer=setTimeout(poll,2000);return;}
  pollBusy=true;
  try{
    const next=await api('/api/state');
    const changed=JSON.stringify(next)!==JSON.stringify(data);
    const wasSyncing=data.syncing;
    data=next;
    const editing=document.activeElement?.matches('input,textarea,select')||document.querySelector('dialog[open]');
    if(changed&&editing)pendingRender=true;
    if((changed||pendingRender)&&!editing){pendingRender=false;render();if(wasSyncing&&!data.syncing)toast(data.sources.some(s=>s.error)?'同步完成，部分信息源连接失败，可在设置中查看':'订阅已更新');}
  }catch{/* Retain the current UI during a temporary server interruption. */}
  finally{pollBusy=false;pollTimer=setTimeout(poll,data.syncing?2200:15000);}
}
async function boot(){
  try{await reload(false);const initial=location.hash.slice(1);navigate(labels[initial]&&initial!=='search'?initial:'overview');pollTimer=setTimeout(poll,data.syncing?1600:5000);}
  catch(error){document.getElementById('main').innerHTML=empty('暂时无法连接本地服务','请先启动 LearnNest 服务，再刷新此页面。');}
}
boot();
