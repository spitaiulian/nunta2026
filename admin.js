import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL } from './supabase-config.js';

const $ = (s) => document.querySelector(s);
const configured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('INLOCUIESTE') &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes('INLOCUIESTE');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
let entries = [];

const esc = (value = '') =>
  String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

function setError(message = '') {
  $('#error').textContent = message;
}

function showLogin() {
  $('#login').hidden = false;
  $('#dashboard').hidden = true;
}

function showDashboard() {
  $('#login').hidden = true;
  $('#dashboard').hidden = false;
}

async function loadEntries() {
  $('#rows').innerHTML = '<tr><td colspan="7">Se încarcă…</td></tr>';
  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    $('#rows').innerHTML = '';
    $('#empty').style.display = 'block';
    $('#empty').textContent = 'Datele nu au putut fi încărcate. Verifică politicile Supabase.';
    return;
  }

  entries = data || [];
  render();
}

async function openDashboard() {
  showDashboard();
  await loadEntries();
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setError();

  if (!configured) {
    setError('Completează mai întâi supabase-config.js.');
    return;
  }

  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Se verifică…';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: $('#password').value
  });

  button.disabled = false;
  button.textContent = 'Intră în panou';

  if (error || !data.user) {
    setError('Parolă incorectă sau contul de administrator nu este configurat.');
    return;
  }

  if ((data.user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await supabase.auth.signOut();
    setError('Acest cont nu are acces la panou.');
    return;
  }

  $('#password').value = '';
  await openDashboard();
});

$('#logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

function render() {
  const query = $('#search').value.toLowerCase();
  const filter = $('#filter').value;
  const filtered = entries.filter((entry) =>
    (filter === 'all' || entry.status === filter) &&
    `${entry.family} ${entry.phone}`.toLowerCase().includes(query)
  );

  $('#rows').innerHTML = filtered.map((entry) => `
    <tr>
      <td><strong>${esc(entry.family)}</strong><small>${new Date(entry.created_at).toLocaleString('ro-RO')}</small></td>
      <td>
        <select class="status-select" data-status="${entry.id}">
          ${['Confirmat', 'Refuzat', 'În așteptare'].map((status) =>
            `<option value="${status}" ${entry.status === status ? 'selected' : ''}>${status}</option>`
          ).join('')}
        </select>
      </td>
      <td>${entry.adults || 0}</td>
      <td>${entry.children || 0}</td>
      <td><a href="tel:${esc(entry.phone || '')}">${esc(entry.phone || '—')}</a></td>
      <td><input data-note="${entry.id}" value="${esc(entry.accommodation || '')}" placeholder="Notiță privată"></td>
      <td><button class="row-btn" data-del="${entry.id}" title="Șterge">🗑️</button></td>
    </tr>
  `).join('');

  $('#empty').style.display = filtered.length ? 'none' : 'block';
  $('#empty').textContent = 'Nu există răspunsuri pentru filtrul ales.';
  $('#confirmed').textContent = entries.filter((x) => x.status === 'Confirmat').length;
  $('#declined').textContent = entries.filter((x) => x.status === 'Refuzat').length;
  $('#pending').textContent = entries.filter((x) => x.status === 'În așteptare').length;
  $('#adults').textContent = entries
    .filter((x) => x.status === 'Confirmat')
    .reduce((sum, x) => sum + (x.adults || 0), 0);
  $('#children').textContent = entries
    .filter((x) => x.status === 'Confirmat')
    .reduce((sum, x) => sum + (x.children || 0), 0);

  document.querySelectorAll('[data-note]').forEach((input) => {
    input.addEventListener('change', async () => {
      const { error } = await supabase
        .from('rsvps')
        .update({ accommodation: input.value })
        .eq('id', input.dataset.note);
      if (error) alert('Notița nu a putut fi salvată.');
      else {
        const item = entries.find((x) => x.id === input.dataset.note);
        if (item) item.accommodation = input.value;
      }
    });
  });

  document.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      const { error } = await supabase
        .from('rsvps')
        .update({ status: select.value })
        .eq('id', select.dataset.status);
      if (error) {
        alert('Statusul nu a putut fi schimbat.');
        await loadEntries();
      } else {
        const item = entries.find((x) => x.id === select.dataset.status);
        if (item) item.status = select.value;
        render();
      }
    });
  });

  document.querySelectorAll('[data-del]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Ștergi această înregistrare?')) return;
      const { error } = await supabase.from('rsvps').delete().eq('id', button.dataset.del);
      if (error) alert('Înregistrarea nu a putut fi ștearsă.');
      else {
        entries = entries.filter((x) => x.id !== button.dataset.del);
        render();
      }
    });
  });
}

$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);

$('#addPending').addEventListener('click', async () => {
  const family = prompt('Numele familiei:');
  if (!family?.trim()) return;
  const phone = prompt('Telefon (opțional):') || '';
  const { error } = await supabase.from('rsvps').insert({
    family: family.trim(),
    status: 'În așteptare',
    adults: 0,
    children: 0,
    phone: phone.trim()
  });
  if (error) alert('Familia nu a putut fi adăugată.');
  else await loadEntries();
});

$('#exportBtn').addEventListener('click', () => {
  const rows = [
    ['Familie', 'Status', 'Adulți', 'Copii', 'Telefon', 'Notițe cazare', 'Data'],
    ...entries.map((x) => [
      x.family, x.status, x.adults, x.children, x.phone, x.accommodation,
      new Date(x.created_at).toLocaleString('ro-RO')
    ])
  ];
  const csv = '\ufeff' + rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `confirmari_iulian_maria_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

async function init() {
  if (!configured) {
    showLogin();
    setError('Baza de date nu este încă configurată. Vezi GHID-CONFIGURARE.txt.');
    return;
  }

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user && (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await openDashboard();
  } else {
    if (user) await supabase.auth.signOut();
    showLogin();
  }
}

init();
