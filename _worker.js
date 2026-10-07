function slugifyProductSeo(item) {
  const parts = [item?.Brand, item?.Model, item?.Color, item?.RAM_Storage].filter(Boolean).join('-');
  return String(parts || item?.id || 'product').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
}
function productSlugMatches(item, slug) {
  const target = String(slug || '').trim().toLowerCase();
  const exact = slugifyProductSeo(item).toLowerCase();
  if (exact === target) return true;
  const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'');
  return compact(exact) === compact(target);
}
function schemaCondition(item) {
  const c=String(item?.Condition||'').toLowerCase();
  if(c.includes('refurb')) return 'https://schema.org/RefurbishedCondition';
  if(c.includes('open')) return 'https://schema.org/UsedCondition';
  return 'https://schema.org/NewCondition';
}
function productSeoHtml(item, requestUrl, html) {
  const origin=new URL(requestUrl).origin;
  const slug=slugifyProductSeo(item);
  const url=origin+'/product/'+slug;
  const brand=cleanText(item?.Brand);
  const model=cleanText(item?.Model);
  const storage=cleanText(item?.RAM_Storage);
  const colour=cleanText(item?.Color);
  const condition=cleanText(item?.Condition).toLowerCase();
  const grade=cleanText(item?.Grade);
  const warranty=cleanText(item?.Warranty);
  const isRefurb=condition.includes('refurb');
  const isUsed=condition.includes('used') || condition.includes('second') || condition.includes('open box') || condition.includes('open');
    const nameParts=[brand,model,storage].filter(Boolean);
  const coreName=nameParts.join(' ').trim() || 'MKG GLOBAL Product';
  const titlePrefix=isRefurb ? 'Refurbished by MKG GLOBAL' : isUsed ? 'Used / Second Hand' : '';
  const title=[titlePrefix,coreName,colour,grade ? grade+' Condition' : ''].filter(Boolean).join(' - ');
  const safeTitle=(title+' | MKG GLOBAL').slice(0,150);
  const descriptionParts=[
    isRefurb ? 'Certified refurbished' : isUsed ? 'Second-hand pre-owned' : 'Brand new',
    coreName,
    colour,
    grade ? grade+' condition' : '',
    warranty ? warranty+' warranty' : '',
    item?.BoxAndAcc ? item.BoxAndAcc : '',
    item?.Specs ? item.Specs : ''
  ].filter(Boolean);
  const desc=descriptionParts.join(' • ').slice(0,500);
  const images=String(item?.ImageUrl||'').split('|').map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('http')?x:origin+'/'+x.replace(/^\//,''));
  const data={
    '@context':'https://schema.org',
    '@type':'Product',
    name:coreName,
    image:images,
    description:desc,
    sku:item?.id||slug,
    brand:brand?{'@type':'Brand',name:brand}:undefined,
    category:item?.Category||undefined,
    color:colour||undefined,
    offers:{
      '@type':'Offer',
      url,
      priceCurrency:'INR',
      price:Number(item?.SuperDealPrice||0),
      availability:Number(item?.Qty||0)>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',
      itemCondition:schemaCondition(item)
    }
  };
  if(item?.Video_URL) data.video={'@type':'VideoObject','contentUrl':item.Video_URL,'name':coreName+' product video'};
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const head='<link rel="canonical" href="'+url+'">\n<meta name="description" content="'+esc(desc)+'">\n<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">\n<meta property="og:type" content="product">\n<meta property="og:title" content="'+esc(safeTitle)+'">\n<meta property="og:description" content="'+esc(desc)+'">\n<meta property="og:url" content="'+url+'">'+(images[0]?'\n<meta property="og:image" content="'+images[0]+'">':'')+'\n<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';
  const directProductScript='<script>window.__MKG_DIRECT_PRODUCT__='+JSON.stringify(item).replace(/</g,'\\u003c')+';</script>';
  const seoBody='<section id="mkg-product-seo" aria-label="Product information" style="max-width:1100px;margin:18px auto 40px;padding:16px 20px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;font-family:Arial,sans-serif"><h1 style="font-size:18px;line-height:1.35;margin:0 0 6px;color:#0f172a">'+esc(safeTitle)+'</h1><p style="font-size:13px;line-height:1.6;color:#475569;margin:0">'+esc(desc)+'</p></section>';
  return html.replace(/<title>[^<]*<\/title>/i,'<title>'+esc(safeTitle)+'</title>').replace('</head>',head+'\n'+directProductScript+'\n</head>').replace('</body>',seoBody+'\n</body>');
}
function googleProductCondition(item) {
  const c=String(item?.Condition||'').toLowerCase();
  if (c.includes('refurb')) return 'refurbished';
  if (c.includes('used') || c.includes('second') || c.includes('open')) return 'used';
  return 'new';
}
function googleProductTitle(item) {
  const brand=cleanText(item?.Brand), model=cleanText(item?.Model);
  const storage=cleanText(item?.RAM_Storage), colour=cleanText(item?.Color);
  const condition=googleProductCondition(item);
  const conditionText=condition==='refurbished' ? 'Refurbished' : condition==='used' ? 'Used / Second Hand' : '';
  return [conditionText, [brand,model,storage].filter(Boolean).join(' '), colour].filter(Boolean).join(' - ').slice(0,150);
}
function googleProductDescription(item) {
  const condition=googleProductCondition(item);
  const conditionText=condition==='refurbished' ? 'Certified refurbished' : condition==='used' ? 'Second-hand / pre-owned' : 'Brand new';
  return [conditionText,
    [item?.Brand,item?.Model,item?.RAM_Storage].filter(Boolean).join(' '),
    item?.Color,
    item?.Grade ? item.Grade+' condition' : '',
    item?.Warranty ? item.Warranty+' warranty' : '',
    item?.BoxAndAcc,
    item?.Specs
  ].filter(Boolean).join(' • ').slice(0,5000);
}
function googleProductXml(items,origin) {
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const rows=items.filter(x=>Number(x?.Qty||0)>0).map(item=>{
    const slug=slugifyProductSeo(item);
    const link=origin+'/product/'+slug;
    const images=String(item?.ImageUrl||'').split('|').map(x=>x.trim()).filter(Boolean);
    const image=images[0] ? (images[0].startsWith('http') ? images[0] : origin+'/'+images[0].replace(/^\//,'')) : '';
    const condition=googleProductCondition(item);
    const price=Number(item?.SuperDealPrice||0);
    if(!image || !price) return '';
    const gtin=cleanText(item?.GTIN||item?.GTIN13||item?.EAN||item?.UPC||item?.Barcode);
    const mpn=cleanText(item?.MPN||item?.ModelNumber);
    const googleCategory=String(item?.Category||'').toLowerCase().includes('laptop')
      ? 'Electronics > Computers > Laptops'
      : 'Electronics > Communications > Telephony > Mobile Phones';
    return '<item>'+
      '<g:id>'+esc(item?.id||slug)+'</g:id>'+
      '<g:title>'+esc(googleProductTitle(item))+'</g:title>'+
      '<g:description>'+esc(googleProductDescription(item))+'</g:description>'+
      '<g:link>'+esc(link)+'</g:link>'+
      '<g:image_link>'+esc(image)+'</g:image_link>'+
      '<g:availability>in_stock</g:availability>'+
      '<g:price>'+esc(price.toFixed(2))+' INR</g:price>'+
      '<g:condition>'+condition+'</g:condition>'+
      (item?.Brand?'<g:brand>'+esc(item.Brand)+'</g:brand>':'')+
      (gtin?'<g:gtin>'+esc(gtin)+'</g:gtin>':'')+
      (mpn?'<g:mpn>'+esc(mpn)+'</g:mpn>':'')+
      '<g:google_product_category>'+esc(googleCategory)+'</g:google_product_category>'+
      '<g:product_type>'+esc([item?.Category,item?.SubCategory].filter(Boolean).join(' > '))+'</g:product_type>'+
      '<g:custom_label_0>'+esc(condition)+'</g:custom_label_0>'+
      '</item>';
  }).filter(Boolean).join('');
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>MKG GLOBAL Product Feed</title><link>'+esc(origin)+'</link><description>MKG GLOBAL mobile phones, laptops and electronics</description>'+rows+'</channel></rss>';
}
function sitemapXml(items,origin) {
  const urls=[origin+'/'].concat(items.map(x=>origin+'/product/'+slugifyProductSeo(x)));
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...new Set(urls)].map(u=>'<url><loc>'+u.replace(/&/g,'&amp;')+'</loc></url>').join('')+'</urlset>';
}

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
    deal: find('super deal price','superdealprice','deal price'), image: find('imageurl','image url','image_url'),
    remarks: find('special remarks','specialremarks','remarks','remark'), video: find('video_url','video url','video'), gtin: find('gtin','gtin13','ean','upc','barcode'), mpn: find('mpn','model number','model no')
  };
  return rows.slice(1).map((r, i) => ({
    Category: cleanText(r[idx.category]), SubCategory: cleanText(r[idx.sub]), Condition: cleanText(r[idx.condition]),
    Brand: cleanText(r[idx.brand]), Model: cleanText(r[idx.model]), Color: cleanText(r[idx.color]),
    RAM_Storage: cleanText(r[idx.ram]), Specs: cleanText(r[idx.specs]), BoxAndAcc: cleanText(r[idx.box]),
    Grade: cleanText(r[idx.grade]), Qty: num(r[idx.qty]), Warranty: cleanText(r[idx.warranty]),
    MRP: num(r[idx.mrp]), SuperDealPrice: num(r[idx.deal]), ImageUrl: cleanText(r[idx.image]),
    SpecialRemarks: cleanText(r[idx.remarks]), Video_URL: cleanText(r[idx.video]), GTIN: cleanText(r[idx.gtin]), MPN: cleanText(r[idx.mpn]), id: `item_${i + 1}`
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
  // The storefront must remain usable even if the KV binding is temporarily
  // missing from a deployment. In that case use the bundled seed catalog.
  // When KV is available, saved inventory remains the storefront source of truth.
  if (!env.MKG_IMAGES) return await getSeed(env, request);

  const saved = await env.MKG_IMAGES.get('inventory');
  let items = [];
  if (saved) { try { items = JSON.parse(saved); } catch { items = []; } }
  if (!Array.isArray(items) || !items.length) items = await getSeed(env, request);

  // The uploaded CSV is the source of truth. Accessories are allowed when
  // they are present in the fresh inventory upload.
  let imageIndex = {};
  const imageIndexRaw = await env.MKG_IMAGES.get('image-index');
  if (imageIndexRaw) { try { imageIndex = JSON.parse(imageIndexRaw) || {}; } catch {} }

  // Manual product uploads are explicit overrides and must always win over
  // the historical phone-sequence repair.
  let imageOverrides = {};
  const overrideRaw = await env.MKG_IMAGES.get('image-overrides');
  if (overrideRaw) { try { imageOverrides = JSON.parse(overrideRaw) || {}; } catch {} }
  // No cross-product image remapping.
  // Each product keeps its own uploaded image-index entry.

  return items.map(item => {
    const record = { ...item };
    let imgs = Array.isArray(imageIndex[item.id]) ? imageIndex[item.id] : [];

    // Explicit manual upload always wins for that exact product.
    if (Array.isArray(imageOverrides[item.id]) && imageOverrides[item.id].length) {
      imgs = imageOverrides[item.id];
    }

    // item_11 is the known missing 10th-phone creative. Do not display the
    // duplicated 9th-phone image; leave it blank until its correct creative
    // is uploaded manually.
    if (item.id === 'item_11' && !(Array.isArray(imageOverrides[item.id]) && imageOverrides[item.id].length)) {
      imgs = [];
    }

    record.ImageUrl = imgs.map(x => x?.url).filter(Boolean).join(' | ');
    return record;
  });}

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

  // Mark this product as manually overridden so future sequence repairs can
  // never redirect its newly uploaded image to another product.
  let overrides = {};
  const overrideRaw = await env.MKG_IMAGES.get('image-overrides');
  if (overrideRaw) { try { overrides = JSON.parse(overrideRaw) || {}; } catch {} }
  overrides[productId] = imageIndex[productId];
  await env.MKG_IMAGES.put('image-overrides', JSON.stringify(overrides));

  return json({ ok: true, urls: added.map(x => x.url), count: imageIndex[productId].length });
}

function inventoryMatchKey(item) {
  // MRP is product-level, so condition/grade changes should not break the match.
  return [
    item?.Category, item?.SubCategory, item?.Brand, item?.Model,
    item?.Color, item?.RAM_Storage
  ].map(v => cleanText(v).toLowerCase()).join('||');
}

function isPlaceholderMrp(value) {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return true;
  if (/example.*replace.*actual.*mrp/.test(raw)) return true;
  return num(value) <= 0;
}

async function handleClearAllImages(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized. Please sign in to the private admin first.' }, 401);
  if (!env.MKG_IMAGES) return json({ error: 'KV binding MKG_IMAGES is not configured.' }, 500);
  let cursor;
  let deleted = 0;
  do {
    const page = await env.MKG_IMAGES.list({ prefix: 'media/', limit: 1000, cursor });
    for (const key of page.keys || []) {
      await env.MKG_IMAGES.delete(key.name);
      deleted++;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  await env.MKG_IMAGES.put('image-index', '{}');
  await env.MKG_IMAGES.put('image-overrides', '{}');
  return json({ ok: true, deleted, message: 'All product images removed successfully (' + deleted + ' files).' });
}


async function handlePriceMergeUpload(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized. Please sign in to the private admin first.' }, 401);
  if (!env.MKG_IMAGES) return json({ error: 'KV binding MKG_IMAGES is not configured.' }, 500);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file.text !== 'function') return json({ error: 'CSV file is required.' }, 400);

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return json({ error: 'No product rows found in the CSV.' }, 400);
  const h = rows[0].map(x => cleanText(x).toLowerCase());
  const find = (...names) => names.map(n => h.indexOf(n.toLowerCase())).find(i => i >= 0) ?? -1;
  const idx = {
    id: find('product id','productid','id'),
    brand: find('brand'), model: find('model'), color: find('color'),
    ram: find('ram/storage','ram_storage','ram storage'),
    mrp: find('mrp'), deal: find('super deal price','superdealprice','deal price'),
    remarks: find('special remarks','specialremarks','remarks','remark'),
    specs: find('specs/description','specs','description'),
    category: find('category'), sub: find('sub-category','subcategory','sub category'),
    condition: find('condition'), box: find('box and accessories','box & accessories','boxandacc'),
    grade: find('grade'), qty: find('qty.','qty','quantity'), warranty: find('warranty')
  };
  if (idx.id < 0) return json({ error: 'Product ID column is required.' }, 400);

  const saved = await env.MKG_IMAGES.get('inventory');
  let current = [];
  if (saved) { try { current = JSON.parse(saved); } catch {} }
  if (!Array.isArray(current)) current = [];
  const byId = new Map(current.map(item => [cleanText(item.id), item]));
  let updated = 0, added = 0;

  for (const row of rows.slice(1)) {
    const id = cleanText(row[idx.id]);
    if (!id) continue;
    const existing = byId.get(id);
    const mrp = idx.mrp >= 0 ? num(row[idx.mrp]) : 0;
    const deal = idx.deal >= 0 ? num(row[idx.deal]) : 0;

    if (existing) {
      // Existing products: update only the fields explicitly supplied by the safe CSV.
      // ImageUrl is intentionally never changed, so existing image mappings remain untouched.
      const copy = { ...existing };
      if (idx.brand >= 0 && cleanText(row[idx.brand])) copy.Brand = cleanText(row[idx.brand]);
      if (idx.model >= 0 && cleanText(row[idx.model])) copy.Model = cleanText(row[idx.model]);
      if (idx.color >= 0 && cleanText(row[idx.color])) copy.Color = cleanText(row[idx.color]);
      if (idx.ram >= 0 && cleanText(row[idx.ram])) copy.RAM_Storage = cleanText(row[idx.ram]);
      if (idx.category >= 0 && cleanText(row[idx.category])) copy.Category = cleanText(row[idx.category]);
      if (idx.sub >= 0 && cleanText(row[idx.sub])) copy.SubCategory = cleanText(row[idx.sub]);
      if (idx.condition >= 0 && cleanText(row[idx.condition])) copy.Condition = cleanText(row[idx.condition]);
      if (idx.box >= 0 && cleanText(row[idx.box])) copy.BoxAndAcc = cleanText(row[idx.box]);
      if (idx.grade >= 0 && cleanText(row[idx.grade])) copy.Grade = cleanText(row[idx.grade]);
      if (idx.qty >= 0 && num(row[idx.qty]) > 0) copy.Qty = num(row[idx.qty]);
      if (idx.warranty >= 0 && cleanText(row[idx.warranty])) copy.Warranty = cleanText(row[idx.warranty]);
      if (idx.specs >= 0 && cleanText(row[idx.specs])) copy.Specs = cleanText(row[idx.specs]);
      if (idx.remarks >= 0 && cleanText(row[idx.remarks])) copy.SpecialRemarks = cleanText(row[idx.remarks]);
      if (mrp > 0) copy.MRP = mrp;
      if (deal > 0) copy.SuperDealPrice = deal;
      byId.set(id, copy);
      updated++;
      continue;
    }

    const brand = cleanText(row[idx.brand]);
    const model = cleanText(row[idx.model]);
    if (!brand && !model) continue;

    // New products use the agreed Open Box defaults and do not touch existing products/images.
    const item = {
      Category: 'Phone',
      SubCategory: 'Smartphone',
      Condition: 'Open Box',
      Brand: brand,
      Model: model,
      Color: idx.color >= 0 ? cleanText(row[idx.color]) : '',
      RAM_Storage: idx.ram >= 0 ? cleanText(row[idx.ram]) : '',
      Specs: idx.specs >= 0 ? cleanText(row[idx.specs]) : '',
      BoxAndAcc: 'Brand Box and Original Accessories',
      Grade: 'A+',
      Qty: 1,
      Warranty: '15 Days QC',
      MRP: mrp,
      SuperDealPrice: deal,
      ImageUrl: '',
      SpecialRemarks: idx.remarks >= 0 ? cleanText(row[idx.remarks]) : '',
      Video_URL: '',
      id
    };
    byId.set(id, item);
    added++;
  }

  const merged = [...byId.values()];
  await env.MKG_IMAGES.put('inventory', JSON.stringify(merged));
  await env.MKG_IMAGES.put('catalog-ready', '1');

  return json({
    ok: true,
    message: `Safe update completed: ${updated} existing product prices updated and ${added} new products added. Existing product images were preserved.`
  });
}

async function handleCsvUpload(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized. Please sign in to the private admin first.' }, 401);
  if (!env.MKG_IMAGES) return json({ error: 'KV binding MKG_IMAGES is not configured.' }, 500);
  const form = await request.formData(); const file = form.get('file');
  if (!file || typeof file.text !== 'function') return json({ error: 'CSV file is required.' }, 400);

  const items = normalizeInventory(await file.text());
  if (!items.length) return json({ error: 'No valid products found in the CSV.' }, 400);

  // Preserve existing live MRP whenever the uploaded CSV contains a blank, zero,
  // or template placeholder such as "Example - replace with actual MRP".
  // A real numeric MRP in the new CSV always takes precedence.
  let previous = [];
  const previousRaw = await env.MKG_IMAGES.get('inventory');
  if (previousRaw) {
    try {
      const parsed = JSON.parse(previousRaw);
      if (Array.isArray(parsed)) previous = parsed;
    } catch {}
  }

  const previousMrp = new Map();
  for (const item of previous) {
    const key = inventoryMatchKey(item);
    const mrp = num(item?.MRP);
    if (key && mrp > 0 && !previousMrp.has(key)) previousMrp.set(key, mrp);
  }

  let preservedMrpCount = 0;
  const merged = items.map(item => {
    const copy = { ...item };
    if (isPlaceholderMrp(copy.MRP)) {
      const oldMrp = previousMrp.get(inventoryMatchKey(copy));
      if (oldMrp) {
        copy.MRP = oldMrp;
        preservedMrpCount++;
      }
    }
    return copy;
  });

  await env.MKG_IMAGES.put('inventory', JSON.stringify(merged));
  // A successful fresh upload re-enables the storefront catalog.
  await env.MKG_IMAGES.put('catalog-ready', '1');

  // Fresh inventory upload starts with a clean product-image mapping.
  // Old image assignments must never carry over to the new product list.
  await env.MKG_IMAGES.put('image-index', '{}');
  await env.MKG_IMAGES.put('image-overrides', '{}');

  return json({
    ok: true,
    message: `Fresh inventory uploaded successfully: ${merged.length} products. Existing MRP preserved for ${preservedMrpCount} matching products. Product images have been reset and the catalog is live.`
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((url.pathname === '/admin' || url.pathname === '/admin/') && request.method === 'GET') return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url), request));
    if (url.pathname === '/api/admin/login' && request.method === 'POST') return login(request, env);
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return logout(request, env);
    if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: await isAdmin(request, env) });
    if (url.pathname === '/api/inventory' && request.method === 'GET') return json(await getInventory(env, request), 200, { 'cache-control': 'no-store' });
    if (url.pathname === '/api/product' && request.method === 'GET') {
      const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();
      if (!slug) return json({ error: 'Product slug is required.' }, 400, { 'cache-control': 'no-store' });
      const items = await getInventory(env, request);
      const item = items.find(x => productSlugMatches(x, slug));
      if (!item) return json({ error: 'Product not found.' }, 404, { 'cache-control': 'no-store' });
      return json(item, 200, { 'cache-control': 'no-store' });
    }
    if (url.pathname === '/api/admin/image' && request.method === 'POST') return handleImageUpload(request, env);
    if (url.pathname === '/api/admin/clear-images' && request.method === 'POST') return handleClearAllImages(request, env);
    if (url.pathname === '/api/admin/csv' && request.method === 'POST') return handleCsvUpload(request, env);
    if (url.pathname === '/api/admin/price-merge' && request.method === 'POST') return handlePriceMergeUpload(request, env);
    if (url.pathname.startsWith('/media/')) {
      const key = `media/${url.pathname.slice('/media/'.length)}`;
      const value = await env.MKG_IMAGES.getWithMetadata(key, 'arrayBuffer');
      if (!value?.value) return new Response('Not found', { status: 404 });
      const type = value.metadata?.contentType || 'application/octet-stream';
      return new Response(value.value, { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' } });
    }
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\\nAllow: /\\nSitemap: ' + new URL('/sitemap.xml', request.url).toString() + '\\n', { headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'public, max-age=3600' } });
    }
    if (url.pathname === '/google-product-feed.xml') {
      const items=await getInventory(env,request);
      return new Response(googleProductXml(items,new URL(request.url).origin), {
        headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}
      });
    }
    if (url.pathname === '/sitemap.xml') {
      const items=await getInventory(env,request);
      return new Response(sitemapXml(items,new URL(request.url).origin), { headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'} });
    }
    if (url.pathname.startsWith('/product/')) {
      const slug=decodeURIComponent(url.pathname.split('/')[2]||'').toLowerCase();
      const items=await getInventory(env,request);
      const item=items.find(x=>productSlugMatches(x,slug));
      const asset=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));
      if(!asset.ok) return asset;
      const html=await asset.text();
      if(!item) {
        // Always return the storefront shell. The frontend will resolve the
        // exact slug through /api/product, so a stale/partial KV catalog
        // cannot turn a direct product URL into a plain homepage.
        return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
      }
      return new Response(productSeoHtml(item,request.url,html),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    }
    return env.ASSETS.fetch(request);
  }
};
