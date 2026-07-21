import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const configured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('INLOCUIESTE') &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes('INLOCUIESTE');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

window.addEventListener('load', () => setTimeout(() => $('#loader')?.classList.add('hide'), 350));
window.addEventListener('scroll', () => $('.site-header')?.classList.toggle('scrolled', scrollY > 40));
$('#menuBtn')?.addEventListener('click', () => {
  const n = $('#nav');
  n.classList.toggle('open');
  $('#menuBtn').setAttribute('aria-expanded', n.classList.contains('open'));
});
$$('#nav a').forEach((a) => a.addEventListener('click', () => $('#nav').classList.remove('open')));

const observer = new IntersectionObserver(
  (entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }),
  { threshold: 0.12 }
);
$$('.reveal').forEach((el) => observer.observe(el));

function tick() {
  const target = new Date('2026-11-07T14:00:00+02:00').getTime();
  const distance = Math.max(0, target - Date.now());
  $('#days').textContent = String(Math.floor(distance / 86400000)).padStart(3, '0');
  $('#hours').textContent = String(Math.floor(distance / 3600000) % 24).padStart(2, '0');
  $('#minutes').textContent = String(Math.floor(distance / 60000) % 60).padStart(2, '0');
  $('#seconds').textContent = String(Math.floor(distance / 1000) % 60).padStart(2, '0');
}
tick();
setInterval(tick, 1000);

function showModal(message) {
  $('#successText').textContent = message;
  $('#successModal').classList.add('open');
  $('#successModal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
  $('#successModal').classList.remove('open');
  $('#successModal').setAttribute('aria-hidden', 'true');
}
$('#closeModal')?.addEventListener('click', closeModal);
$('#successModal')?.addEventListener('click', (event) => {
  if (event.target.id === 'successModal') closeModal();
});

$('#rsvpForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const fd = new FormData(form);
  const entry = {
    family: String(fd.get('family') || '').trim(),
    status: String(fd.get('status') || ''),
    adults: Number(fd.get('adults') || 0),
    children: Number(fd.get('children') || 0),
    phone: String(fd.get('phone') || '').trim()
  };

  if (!configured) {
    showModal('Formularul nu este încă legat la baza de date. Proprietarul site-ului trebuie să completeze fișierul supabase-config.js.');
    return;
  }

  submit.disabled = true;
  const originalText = submit.textContent;
  submit.textContent = 'Se trimite…';

  try {
    const { error } = await supabase.from('rsvps').insert(entry);
    if (error) throw error;

    showModal(
      entry.status === 'Confirmat'
        ? `Dragă ${entry.family}, confirmarea voastră a fost înregistrată. Abia așteptăm să sărbătorim împreună!`
        : `Dragă ${entry.family}, vă mulțumim că ne-ați răspuns. Ne pare rău că nu puteți fi alături de noi.`
    );
    form.reset();
  } catch (error) {
    console.error(error);
    showModal('Răspunsul nu a putut fi trimis. Verificați conexiunea și încercați din nou sau sunați mirii.');
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
});
