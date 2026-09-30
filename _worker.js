function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra }
  });
}

function cleanText(v) { return v == null ? '' : String(v).trim(); }

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => cleanText(v) !== ''));
}

function num(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeInventory(csvText) {
  const rows = parseCsv(csvText); if (!rows.length) return [];
  const h = rows[0].map(x => cleanText(x).toLowerCase());
  const find = (...names) => names.map(n => h.indexOf(n.toLowerCase())).find(i => i >= 0) ?? -1;
  const idx = {
    category: find('category'), sub: find('sub-category','subcategory','sub category'), condition: find('condition'),
    brand: find('brand'), model: find('model'), color: find('color'), ram: find('ram/storage','ram_storage','ram storage'),
    specs: find('specs/description','specs','description'), box: find('box and accessories','box & accessories','boxandacc'),
    grade: find('grade'), qty: find('qty.','qty','quantity'), warranty: find('warranty'), mrp: find('mrp'),
    deal: find('super deal price','superdealprice','deal price'), image: find('imageurl','image url','image_url')
  };
  return rows.slice(1).map((r, i) => ({
    Category: cleanText(r[idx.category]), SubCategory: cleanText(r[idx.sub]), Condition: cleanText(r[idx.condition]),
    Brand: cleanText(r[idx.brand]), Model: cleanText(r[idx.model]), Color: cleanText(r[idx.color]),
    RAM_Storage: cleanText(r[idx.ram]), Specs: cleanText(r[idx.specs]), BoxAndAcc: cleanText(r[idx.box]),
    Grade: cleanText(r[idx.grade]), Qty: num(r[idx.qty]), Warranty: cleanText(r[idx.warranty]),
    MRP: num(r[idx.mrp]), SuperDealPrice: num(r[idx.deal]), ImageUrl: cleanText(r[idx.image]), id: `item_${i + 1}`
  })).filter(x => x.Brand || x.Model || x.Category);
}

function extension(type, name) {
  const map = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
  return map[type] || (String(name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

async function isAdmin(request, env) {
  if (!env.MKG_IMAGES) return false;
  const token = cookieValue(request, 'mkg_admin_session');
  if (!token) return false;
  const session = await env.MKG_IMAGES.get(`admin-session:${token}`);
  return session === '1';
}

async function login(request, env) {
  if (!env.MKG_IMAGES || !cleanText(env.ADMIN_KEY)) return json({ error: 'Admin access is not configured. Add an ADMIN_KEY secret to the Pages project.' }, 500);
  let body = {};
  try { body = await request.json(); } catch {}
  const key = cleanText(body.key);
  if (!key || key !== cleanText(env.ADMIN_KEY)) return json({ error: 'Invalid admin access key.' }, 401);
  const token = crypto.randomUUID();
  await env.MKG_IMAGES.put(`admin-session:${token}`, '1', { expirationTtl: 86400 });
  return json({ ok: true }, 200, {
    'set-cookie': `mkg_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
  });
}

async function logout(request, env) {
  const token = cookieValue(request, 'mkg_admin_session');
  if (token && env.MKG_IMAGES) await env.MKG_IMAGES.delete(`admin-session:${token}`);
  return json({ ok: true }, 200, { 'set-cookie': 'mkg_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
}

async function getSeed(env, request) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/inventory.seed.json', request.url)));
  if (!asset.ok) return [];
  try { return await asset.json(); } catch { return []; }
}

async function getInventory(env, request) {
  const saved = await env.MKG_IMAGES.get('inventory');
  let items;
  if (saved) { try { items = JSON.parse(saved); } catch { items = []; } }
  if (!Array.isArray(items) || !items.length) items = await getSeed(env, request);
  let imageIndex = {};
  const imageIndexRaw = await env.MKG_IMAGES.get('image-index');
  if (imageIndexRaw) { try { imageIndex = JSON.parse(imageIndexRaw) || {}; } catch {} }
  return items.map(item => {
    const record = { ...item };
    const imgs = Array.isArray(imageIndex[item.id]) ? imageIndex[item.id] : [];
    if (imgs.length) {
      const old = String(record.ImageUrl || '').split(/[|;]/).map(s => s.trim()).filter(Boolean);
      record.ImageUrl = [...imgs.map(x => x.url).filter(Boolean), ...old].join(' | ');
    }
    return record;
  });
}

async function handleImageUpload(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized. Please sign in to the private admin first.' }, 401);
  if (!env.MKG_IMAGES) return json({ error: 'KV binding MKG_IMAGES is not configured.' }, 500);
  const form = await request.formData();
  const productId = cleanText(form.get('productId'));
  const replace = cleanText(form.get('replace')).toLowerCase() === 'true';
  if (!productId) return json({ error: 'Product ID is required.' }, 400);
  const files = form.getAll('files').filter(v => v && typeof v.arrayBuffer === 'function');
  if (!files.length) return json({ error: 'No image files received.' }, 400);
  const allowed = new Set(['image/jpeg','image/png','image/webp']); const MAX = 8 * 1024 * 1024;
  const indexRaw = await env.MKG_IMAGES.get('image-index'); let imageIndex = {};
  if (indexRaw) { try { imageIndex = JSON.parse(indexRaw) || {}; } catch {} }
  const current = Array.isArray(imageIndex[productId]) ? imageIndex[productId] : [];
  const added = [];
  for (const file of files) {
    if (!allowed.has(file.type)) return json({ error: `${file.name || 'File'} must be JPG, PNG or WEBP.` }, 400);
    if (file.size > MAX) return json({ error: `${file.name || 'File'} is larger than 8MB.` }, 400);
    const ext = extension(file.type, file.name);
    const key = `media/${productId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    await env.MKG_IMAGES.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type, originalName: file.name || '' } });
    added.push({ key, url: `/media/${key.slice('media/'.length)}`, name: file.name || key, type: file.type });
  }
  if (replace) { for (const old of current) if (old?.key) await env.MKG_IMAGES.delete(old.key); imageIndex[productId] = added; }
  else imageIndex[productId] = [...added, ...current];
  await env.MKG_IMAGES.put('image-index', JSON.stringify(imageIndex));
  return json({ ok: true, urls: added.map(x => x.url), count: imageIndex[productId].length });
}

async function handleCsvUpload(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized. Please sign in to the private admin first.' }, 401);
  if (!env.MKG_IMAGES) return json({ error: 'KV binding MKG_IMAGES is not configured.' }, 500);
  const form = await request.formData(); const file = form.get('file');
  if (!file || typeof file.text !== 'function') return json({ error: 'CSV file is required.' }, 400);
  const items = normalizeInventory(await file.text());
  if (!items.length) return json({ error: 'No valid products found in the CSV.' }, 400);
  await env.MKG_IMAGES.put('inventory', JSON.stringify(items));
  return json({ ok: true, message: `Inventory uploaded successfully: ${items.length} products.` });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((url.pathname === '/admin' || url.pathname === '/admin/') && request.method === 'GET') return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url), request));
    if (url.pathname === '/api/admin/login' && request.method === 'POST') return login(request, env);
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return logout(request, env);
    if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: await isAdmin(request, env) });
    if (url.pathname === '/api/inventory' && request.method === 'GET') return json(await getInventory(env, request), 200, { 'cache-control': 'no-store' });
    if (url.pathname === '/api/admin/image' && request.method === 'POST') return handleImageUpload(request, env);
    if (url.pathname === '/api/admin/csv' && request.method === 'POST') return handleCsvUpload(request, env);
    if (url.pathname.startsWith('/media/')) {
      const key = `media/${url.pathname.slice('/media/'.length)}`;
      const value = await env.MKG_IMAGES.getWithMetadata(key, 'arrayBuffer');
      if (!value?.value) return new Response('Not found', { status: 404 });
      const type = value.metadata?.contentType || 'application/octet-stream';
      return new Response(value.value, { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' } });
    }
    if (url.pathname.startsWith('/product/')) return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    return env.ASSETS.fetch(request);
  }
};
