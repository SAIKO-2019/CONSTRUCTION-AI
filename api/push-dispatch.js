import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlulyhactxjpjmmvddlj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VAPID_PUBLIC = process.env.PUSH_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.PUSH_VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.PUSH_VAPID_SUBJECT || 'mailto:admin@example.com';

const b64u = b => Buffer.from(b).toString('base64url');
const fromB64u = s => Buffer.from(String(s || ''), 'base64url');

function serviceHeaders(extra={}) {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    'content-type': 'application/json',
    ...extra
  };
}

async function rest(path, options={}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {})
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0,500)}`);
  return text ? JSON.parse(text) : null;
}

function vapidPrivateKey() {
  const rawPub = fromB64u(VAPID_PUBLIC);
  const rawPriv = fromB64u(VAPID_PRIVATE);
  if (rawPub.length !== 65 || rawPub[0] !== 4 || rawPriv.length !== 32)
    throw new Error('Invalid VAPID key configuration.');
  return crypto.createPrivateKey({
    key: {
      kty:'EC', crv:'P-256',
      x:b64u(rawPub.subarray(1,33)),
      y:b64u(rawPub.subarray(33,65)),
      d:b64u(rawPriv)
    },
    format:'jwk'
  });
}

function makeVapid(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ:'JWT', alg:'ES256' }));
  const payload = b64u(JSON.stringify({
    aud,
    exp: Math.floor(Date.now()/1000) + 12*60*60,
    sub: VAPID_SUBJECT
  }));
  const unsigned = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(unsigned), {
    key:vapidPrivateKey(),
    dsaEncoding:'ieee-p1363'
  });
  return `${unsigned}.${b64u(sig)}`;
}

function hkdfExtract(salt, ikm) {
  return crypto.createHmac('sha256', salt).update(ikm).digest();
}
function hkdfExpand(prk, info, length) {
  let out = Buffer.alloc(0), prev = Buffer.alloc(0), i = 0;
  while (out.length < length) {
    i++;
    prev = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([prev, info, Buffer.from([i])])).digest();
    out = Buffer.concat([out, prev]);
  }
  return out.subarray(0, length);
}

function encryptPayload(subscription, payload) {
  const clientPub = fromB64u(subscription.p256dh);
  const authSecret = fromB64u(subscription.auth);
  if (clientPub.length !== 65 || authSecret.length < 16) throw new Error('Invalid subscription keys.');

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(clientPub);

  const prkKey = hkdfExtract(authSecret, shared);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0','utf8'),
    clientPub,
    serverPub
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0','utf8'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0','utf8'), 12);

  const plain = Buffer.concat([Buffer.from(JSON.stringify(payload),'utf8'), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([serverPub.length]), serverPub, encrypted, tag]);
}

async function sendPush(sub, payload) {
  const body = encryptPayload(sub, payload);
  const jwt = makeVapid(sub.endpoint);
  const r = await fetch(sub.endpoint, {
    method:'POST',
    headers:{
      TTL:'86400',
      Urgency:'normal',
      'Content-Encoding':'aes128gcm',
      Authorization:`vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      'Content-Type':'application/octet-stream'
    },
    body
  });
  if (r.status === 404 || r.status === 410) return { expired:true, status:r.status };
  if (!r.ok) throw new Error(`Push ${r.status}: ${(await r.text()).slice(0,250)}`);
  return { ok:true, status:r.status };
}

function phNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Manila',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'
  }).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
  return {
    key:`${parts.year}-${parts.month}-${parts.day}`,
    weekday:parts.weekday,
    hour:Number(parts.hour),
    minute:Number(parts.minute)
  };
}

async function existingDelivered(key) {
  const rows = await rest(`push_delivery_log?notification_key=eq.${encodeURIComponent(key)}&select=user_id`);
  return new Set((rows || []).map(x => String(x.user_id)));
}
async function markDelivered(key, userIds) {
  if (!userIds.length) return;
  const rows = [...new Set(userIds)].map(user_id => ({ user_id, notification_key:key }));
  await rest('push_delivery_log?on_conflict=user_id,notification_key', {
    method:'POST',
    headers:{ Prefer:'resolution=merge-duplicates,return=minimal' },
    body:JSON.stringify(rows)
  });
}

async function sendToSubscriptions(subscriptions, payload, key, targetUser=null, excludeUser=null) {
  const delivered = await existingDelivered(key);
  const candidates = subscriptions.filter(s =>
    s.enabled !== false &&
    (!targetUser || String(s.user_id) === String(targetUser)) &&
    (!excludeUser || String(s.user_id) !== String(excludeUser)) &&
    !delivered.has(String(s.user_id))
  );
  const doneUsers = [];
  for (const s of candidates) {
    try {
      const out = await sendPush(s, payload);
      if (out.expired) {
        await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
          method:'PATCH',
          headers:{ Prefer:'return=minimal' },
          body:JSON.stringify({ enabled:false, updated_at:new Date().toISOString() })
        });
      } else doneUsers.push(String(s.user_id));
    } catch (err) {
      console.warn('[push]', s.user_id, err.message);
    }
  }
  await markDelivered(key, doneUsers);
  return doneUsers.length;
}

async function dispatchQueued(subscriptions) {
  const now = new Date().toISOString();
  const queue = await rest(
    `push_notifications?sent_at=is.null&deliver_after=lte.${encodeURIComponent(now)}&select=*&order=created_at.asc&limit=30`
  ) || [];
  let sent = 0;
  for (const n of queue) {
    const key = n.notification_key || `queue-${n.id}`;
    sent += await sendToSubscriptions(subscriptions, {
      title:n.title || 'Construction Monitoring',
      body:n.body || 'You have a new update.',
      url:n.url || '/',
      tag:n.tag || key,
      data:n.data || {}
    }, key, n.user_id, n.exclude_user_id);

    await rest(`push_notifications?id=eq.${n.id}`, {
      method:'PATCH',
      headers:{ Prefer:'return=minimal' },
      body:JSON.stringify({ sent_at:new Date().toISOString() })
    });
  }
  return sent;
}

async function quotationReminder(subscriptions) {
  const now = phNow();
  if (now.weekday === 'Sun' || now.minute > 6 || now.hour < 8 || now.hour > 17) return 0;

  const rows = await rest(
    `quotation_projects?target_submission=not.is.null&select=id,project_name,client_name,target_submission,status&order=target_submission.asc&limit=50`
  ) || [];
  const pending = rows.filter(q => !/complete|awarded|not awarded|declined/i.test(String(q.status || '')));
  if (!pending.length) return 0;

  const key = `quotation-reminder-${now.key}-${String(now.hour).padStart(2,'0')}`;
  const today = new Date(`${now.key}T00:00:00+08:00`);
  const focus = pending.slice(0,3).map(q => {
    const d = new Date(`${q.target_submission}T00:00:00+08:00`);
    const days = Math.round((d - today)/86400000);
    const due = days < 0 ? `${Math.abs(days)} day(s) overdue` : days === 0 ? 'due today' : `due in ${days} day(s)`;
    return `${q.project_name || 'Quotation'} — ${due}`;
  });
  const extra = pending.length > 3 ? ` • +${pending.length-3} more` : '';
  return sendToSubscriptions(subscriptions, {
    title:'For Quotation Reminder',
    body:focus.join(' • ') + extra,
    url:'/?view=quotation',
    tag:key
  }, key);
}

async function specialWorkdayReminder(subscriptions) {
  const now = phNow();
  if (now.weekday === 'Sun') return 0;
  const slots = [
    {h:9,m:0,title:'Morning break',body:'Quick break reminder.'},
    {h:12,m:0,title:'Lunch',body:'Lunch break reminder.'},
    {h:15,m:0,title:'Afternoon break',body:'Quick afternoon break reminder.'},
    {h:16,m:45,title:'Wrap up',body:'15 minutes before 5:00 PM — wrap up pending site and office items.'}
  ];
  const slot = slots.find(s => s.h === now.hour && now.minute >= s.m && now.minute <= s.m + 6);
  if (!slot) return 0;
  const key = `workday-${now.key}-${slot.h}-${slot.m}`;
  return sendToSubscriptions(subscriptions, {
    title:slot.title,
    body:slot.body,
    url:'/',
    tag:key
  }, key);
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE)
    return res.status(503).json({ ok:false, error:'Push server environment variables are not configured.' });

  try {
    const subscriptions = await rest(
      'push_subscriptions?enabled=eq.true&select=user_id,endpoint,p256dh,auth,enabled'
    ) || [];
    const queued = await dispatchQueued(subscriptions);
    const quotation = await quotationReminder(subscriptions);
    const workday = await specialWorkdayReminder(subscriptions);
    return res.status(200).json({
      ok:true,
      activeSubscriptions:subscriptions.length,
      sent:queued + quotation + workday,
      checkedAt:new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:err?.message || String(err) });
  }
}