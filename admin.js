import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL } from './supabase-config.js';

const $ = (selector) => document.querySelector(selector);
const configured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

let entries = [];

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  })[char]);

function setError(message = '') {
  $('#error').textContent = message;
}

function showLogin() {
  $('#login').hidden = false;
  $('#dashboard').hidden = true;
}

function showDashboard(user) {
  $('#login').hidden = true;
  $('#dashboard').hidden = false;
  $('#signedInAs').textContent = `Conectat ca ${user.email}`;
}

async function loadEntries() {
  $('#rows').innerHTML = '<tr><td colspan="7">Se încarcă…</td></tr>';
  $('#empty').style.display = 'none';

  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    $('#rows').innerHTML = '';
    $('#empty').style.display = 'block';
    $('#empty').textContent = `Datele nu au putut fi încărcate: ${error.message}`;
    return;
  }

  entries = data || [];
  render();
}

async function openDashboard(user) {
  showDashboard(user);
  await loadEntries();
}

$('#email').value = ADMIN_EMAIL;
$('#email').readOnly = true;

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setError();

  if (!configured) {
    setError('Configurația Supabase lipsește din supabase-config.js.');
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Se verifică…';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('#email').value.trim(),
      password: $('#password').value
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Parola nu corespunde contului din Supabase. Schimb-o din Authentication → Users.');
      }
      throw error;
    }

    const user = data.user;
    if (!user || (user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await supabase.auth.signOut();
      throw new Error('Acest cont nu este autorizat pentru administrare.');
    }

    $('#password').value = '';
    await openDashboard(user);
  } catch (error) {
    console.error(error);
    setError(error.message || 'Autentificarea nu a reușit.');
  } finally {
    button.disabled = false;
    button.textContent = 'Intră în panou';
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

$('#refreshBtn').addEventListener('click', loadEntries);

function render() {
  const query = $('#search').value.trim().toLowerCase();
  const filter = $('#filter').value;

  const filtered = entries.filter((entry) =>
    (filter === 'all' || entry.status === filter) &&
    `${entry.family || ''} ${entry.phone || ''}`.toLowerCase().includes(query)
  );

  $('#rows').innerHTML = filtered.map((entry) => `
    <tr>
      <td>
        <strong>${escapeHtml(entry.family)}</strong>
        <small>${new Date(entry.created_at).toLocaleString('ro-RO')}</small>
      </td>
      <td>
        <select class="status-select" data-status="${entry.id}">
          ${['Confirmat', 'Refuzat', 'În așteptare'].map((status) =>
            `<option value="${status}" ${entry.status === status ? 'selected' : ''}>${status}</option>`
          ).join('')}
        </select>
      </td>
      <td>${entry.adults || 0}</td>
      <td>${entry.children || 0}</td>
      <td><a href="tel:${escapeHtml(entry.phone || '')}">${escapeHtml(entry.phone || '—')}</a></td>
      <td><input data-note="${entry.id}" value="${escapeHtml(entry.accommodation || '')}" placeholder="Notiță privată"></td>
      <td><button class="row-btn" data-delete="${entry.id}" title="Șterge">🗑️</button></td>
    </tr>
  `).join('');

  $('#empty').style.display = filtered.length ? 'none' : 'block';
  $('#empty').textContent = entries.length
    ? 'Nu există răspunsuri pentru filtrul ales.'
    : 'Nu există încă răspunsuri RSVP.';

  $('#confirmed').textContent = entries.filter((x) => x.status === 'Confirmat').length;
  $('#declined').textContent = entries.filter((x) => x.status === 'Refuzat').length;
  $('#pending').textContent = entries.filter((x) => x.status === 'În așteptare').length;
  $('#adults').textContent = entries
    .filter((x) => x.status === 'Confirmat')
    .reduce((sum, x) => sum + Number(x.adults || 0), 0);
  $('#children').textContent = entries
    .filter((x) => x.status === 'Confirmat')
    .reduce((sum, x) => sum + Number(x.children || 0), 0);

  document.querySelectorAll('[data-note]').forEach((input) => {
    input.addEventListener('change', async () => {
      const { error } = await supabase
        .from('rsvps')
        .update({ accommodation: input.value })
        .eq('id', input.dataset.note);

      if (error) {
        alert(`Notița nu a putut fi salvată: ${error.message}`);
      } else {
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
        alert(`Statusul nu a putut fi schimbat: ${error.message}`);
        await loadEntries();
      } else {
        const item = entries.find((x) => x.id === select.dataset.status);
        if (item) item.status = select.value;
        render();
      }
    });
  });

  document.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Ștergi această înregistrare?')) return;

      const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('id', button.dataset.delete);

      if (error) {
        alert(`Înregistrarea nu a putut fi ștearsă: ${error.message}`);
      } else {
        entries = entries.filter((x) => x.id !== button.dataset.delete);
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

  if (error) {
    alert(`Familia nu a putut fi adăugată: ${error.message}`);
  } else {
    await loadEntries();
  }
});

$('#exportBtn').addEventListener('click', () => {
  const exportRows = entries.map((entry) => ({
    Familie: entry.family,
    Status: entry.status,
    Adulți: entry.adults,
    Copii: entry.children,
    Telefon: entry.phone,
    'Notițe private': entry.accommodation,
    'Data răspunsului': new Date(entry.created_at).toLocaleString('ro-RO')
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 18 }, { wch: 35 }, { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invitați');
  XLSX.writeFile(workbook, `confirmari_Iulian_Maria_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

async function init() {
  if (!configured) {
    showLogin();
    setError('Baza de date nu este configurată.');
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) console.error(error);

  const user = data.session?.user;
  if (user && (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await openDashboard(user);
  } else {
    if (user) await supabase.auth.signOut();
    showLogin();
  }
}

init();
