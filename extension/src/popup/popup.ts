import './popup.css';
import { ApiError, lookup, reclue, reveal } from '../lib/api';
import type { Candidate } from '../lib/types';

const form = document.getElementById('lookup-form') as HTMLFormElement;
const clueInput = document.getElementById('clue-input') as HTMLInputElement;
const lengthInput = document.getElementById('length-input') as HTMLInputElement;
const lookupBtn = document.getElementById('lookup-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const resultsEl = document.getElementById('results') as HTMLElement;

const GHOST_BTN =
  'flex-1 cursor-pointer rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50';

const setStatus = (message: string, isError = false): void => {
  statusEl.textContent = message;
  statusEl.classList.toggle('text-red-400', isError);
  statusEl.classList.toggle('text-slate-400', !isError);
};

const clearResults = (): void => {
  resultsEl.replaceChildren();
};

const escapeHtml = (value: string): string => {
  const el = document.createElement('div');
  el.textContent = value;
  return el.innerHTML;
};

const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

/**
 * Renders one candidate as an anonymous slot. No answer or clue text is present
 * until the user asks for it (no-spoiler flow).
 */
const renderCandidate = (candidate: Candidate, index: number): HTMLElement => {
  const card = document.createElement('div');
  card.className = 'rounded-md border border-slate-700 bg-slate-800 p-2.5';

  const head = document.createElement('div');
  head.className = 'mb-2 flex items-baseline justify-between';
  head.innerHTML = `
    <span class="font-semibold">Answer ${index + 1}</span>
    <span class="text-[11px] text-slate-400">${candidate.length} letters · seen ${candidate.occurrences}×</span>
  `;
  card.append(head);

  const actions = document.createElement('div');
  actions.className = 'flex gap-1.5';

  const reclueBtn = document.createElement('button');
  reclueBtn.type = 'button';
  reclueBtn.className = GHOST_BTN;
  reclueBtn.textContent = 'Give me another clue';
  reclueBtn.disabled = !candidate.hasReclue;

  const revealBtn = document.createElement('button');
  revealBtn.type = 'button';
  revealBtn.className = GHOST_BTN;
  revealBtn.textContent = 'Reveal answer';

  actions.append(reclueBtn, revealBtn);
  card.append(actions);

  const output = document.createElement('div');
  card.append(output);

  if (!candidate.hasReclue) {
    const note = document.createElement('p');
    note.className = 'mt-2 text-[11px] italic text-slate-500';
    note.textContent = 'No alternative clue available for this one.';
    output.append(note);
  }

  reclueBtn.addEventListener('click', async () => {
    reclueBtn.disabled = true;
    reclueBtn.textContent = 'Loading…';
    try {
      const { clue } = await reclue(candidate.id);
      const box = document.createElement('div');
      box.className = 'mt-2 rounded-md bg-slate-700 p-2 text-sm';
      box.innerHTML = `<span class="text-[11px] text-slate-400">Alternative clue</span><p class="mt-0.5">${escapeHtml(clue)}</p>`;
      output.append(box);
      reclueBtn.textContent = 'Another clue';
      reclueBtn.disabled = false;
    } catch (err) {
      reclueBtn.textContent = 'Give me another clue';
      reclueBtn.disabled = false;
      setStatus(errorMessage(err), true);
    }
  });

  revealBtn.addEventListener('click', async () => {
    revealBtn.disabled = true;
    revealBtn.textContent = 'Loading…';
    try {
      const { answer } = await reveal(candidate.id);
      reclueBtn.disabled = true;
      const box = document.createElement('div');
      box.className = 'mt-2 rounded-md bg-slate-700 p-2';
      box.innerHTML = `<span class="text-[11px] text-slate-400">Answer</span><p class="text-lg font-bold tracking-[0.2em]">${escapeHtml(answer.toUpperCase())}</p>`;
      output.append(box);
      revealBtn.textContent = 'Revealed';
    } catch (err) {
      revealBtn.textContent = 'Reveal answer';
      revealBtn.disabled = false;
      setStatus(errorMessage(err), true);
    }
  });

  return card;
};

const renderCandidates = (candidates: Candidate[]): void => {
  clearResults();

  const summary = document.createElement('p');
  summary.className = 'text-sm text-slate-400';
  const lengths = candidates.map((c) => c.length).join(', ');
  summary.textContent =
    candidates.length === 1
      ? 'Found 1 possible answer.'
      : `Found ${candidates.length} possible answers — lengths ${lengths}. Add a letter count to narrow it down.`;
  resultsEl.append(summary);

  candidates.forEach((candidate, i) => resultsEl.append(renderCandidate(candidate, i)));
};

const onSubmit = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();
  const clue = clueInput.value.trim();
  if (!clue) return;

  const lengthRaw = lengthInput.value.trim();
  const length = lengthRaw ? Number(lengthRaw) : undefined;

  lookupBtn.disabled = true;
  lookupBtn.textContent = 'Looking up…';
  clearResults();
  setStatus('');

  try {
    const { candidates } = await lookup({ clue, length });
    if (candidates.length === 0) {
      setStatus('No match found in the clue database. Try rephrasing the clue.');
    } else {
      renderCandidates(candidates);
    }
  } catch (err) {
    setStatus(errorMessage(err), true);
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = 'Look up';
  }
};

form.addEventListener('submit', onSubmit);
clueInput.focus();
