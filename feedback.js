// Feedback / bug report / suggestion widget — a small standalone tool
// available from both Base Builder and Capgrader Generator (this file is
// always loaded, regardless of which tool is active). Self-contained IIFE,
// plain script, same pattern as app.js/capgrader-generator.js.
//
// The site is a static GitHub Pages deploy with no backend of its own, so
// submissions are relayed through FormSubmit (https://formsubmit.co) — a
// free service built for exactly this: it takes a form POST and emails the
// contents to a configured address, no server code required on this end.
//
// Activated and live. FEEDBACK_ENDPOINT is the plain destination email for
// now, at the site owner's explicit request to get this working immediately
// for players — but FormSubmit issues a random alias string (emailed at
// confirmation time) that can replace it here with zero other code changes,
// which hides the address from the public page source. Swap it in the
// moment it's available; until then this address is visible to anyone who
// views this file's source (and will remain in git history even after a
// later swap, since a public repo's history isn't erasable in the normal
// course of things).
//
// Submits as a REAL multipart/form-data <form> POST (not FormSubmit's JSON
// /ajax/ endpoint) so image/video attachments work — FormSubmit's AJAX
// endpoint doesn't support file uploads at all, only the plain form-POST
// endpoint does. The form still targets a hidden <iframe> instead of
// navigating the page, so the player never leaves the site. The real
// tradeoff: a cross-origin iframe's response can't be read by this script,
// so unlike the old fetch()-based version there's no way to distinguish a
// real delivery failure from success once the request goes out — the
// "Thanks" message here is optimistic (shown once the iframe finishes
// loading), not a confirmed receipt. If reports go missing again, this is
// the first place to suspect.
(function () {
  const FEEDBACK_ENDPOINT = 'andrewkitzanburner@gmail.com';
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // FormSubmit's stated total-size cap

  const toggleButton = document.querySelector('#feedback-toggle');
  const dialog = document.querySelector('#feedback-dialog');
  const form = document.querySelector('#feedback-form');
  const statusEl = document.querySelector('#feedback-status');
  const submitButton = document.querySelector('#feedback-submit');
  const attachmentsInput = document.querySelector('#feedback-attachments');
  const targetFrame = document.querySelector('iframe[name="feedback-target-frame"]');
  if (!toggleButton || !dialog || !form) return;

  form.action = `https://formsubmit.co/${FEEDBACK_ENDPOINT}`;

  function openDialog() {
    statusEl.hidden = true;
    statusEl.className = 'feedback-status';
    dialog.showModal();
  }
  function closeDialog() {
    dialog.close();
  }

  toggleButton.addEventListener('click', openDialog);
  dialog.querySelectorAll('[data-feedback-action="close"]').forEach((button) => {
    button.addEventListener('click', closeDialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(); // click on the backdrop
  });

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = `feedback-status feedback-status-${kind}`;
    statusEl.hidden = false;
  }

  function totalAttachmentBytes() {
    return [...(attachmentsInput?.files ?? [])].reduce((sum, file) => sum + file.size, 0);
  }

  form.addEventListener('submit', (event) => {
    const type = document.querySelector('#feedback-type').value;
    const title = document.querySelector('#feedback-title').value.trim();
    const message = document.querySelector('#feedback-message').value.trim();
    if (!title || !message) {
      event.preventDefault();
      return;
    }

    if (FEEDBACK_ENDPOINT === 'REPLACE_WITH_YOUR_EMAIL_OR_FORMSUBMIT_ID') {
      event.preventDefault();
      setStatus('Feedback delivery isn’t configured yet — tell the developer to finish setting up feedback.js.', 'error');
      return;
    }

    if (totalAttachmentBytes() > MAX_ATTACHMENT_BYTES) {
      event.preventDefault();
      setStatus('Those attachments add up to more than 10MB total — remove or shrink one and try again.', 'error');
      return;
    }

    // Kept as a fixed, unique prefix (not varying by type) so a single
    // Gmail filter on the subject text reliably catches every report
    // regardless of which dropdown option was picked — see
    // AI_HANDOFF.md for the exact filter setup.
    document.querySelector('#feedback-subject-field').value = `[Tycoon Sim Report] ${type}: ${title}`;
    document.querySelector('#feedback-page-field').value = window.location.href;

    submitButton.disabled = true;
    setStatus('Sending…', 'pending');
    // The actual network request now happens via the browser's native form
    // submission (into the hidden iframe) — this handler doesn't call
    // preventDefault() past this point, so the submit proceeds normally.
  });

  // The iframe's `load` event fires once for the initial blank frame and
  // again after every real submission's response comes back — only treat it
  // as a completed submission once the form has actually been submitted at
  // least once, otherwise the very first (blank) load would show "Thanks"
  // before the player has done anything.
  let submitted = false;
  form.addEventListener('submit', () => {
    submitted = true;
  });
  targetFrame?.addEventListener('load', () => {
    if (!submitted) return;
    submitted = false;
    setStatus('Thanks — your report was sent!', 'success');
    form.reset();
    submitButton.disabled = false;
    setTimeout(closeDialog, 4500);
  });
})();
