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
(function () {
  const FEEDBACK_ENDPOINT = 'andrewkitzanburner@gmail.com';

  const toggleButton = document.querySelector('#feedback-toggle');
  const dialog = document.querySelector('#feedback-dialog');
  const form = document.querySelector('#feedback-form');
  const statusEl = document.querySelector('#feedback-status');
  const submitButton = document.querySelector('#feedback-submit');
  if (!toggleButton || !dialog || !form) return;

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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const type = document.querySelector('#feedback-type').value;
    const title = document.querySelector('#feedback-title').value.trim();
    const message = document.querySelector('#feedback-message').value.trim();
    const contact = document.querySelector('#feedback-contact').value.trim();
    if (!title || !message) return;

    if (FEEDBACK_ENDPOINT === 'REPLACE_WITH_YOUR_EMAIL_OR_FORMSUBMIT_ID') {
      setStatus('Feedback delivery isn’t configured yet — tell the developer to finish setting up feedback.js.', 'error');
      return;
    }

    submitButton.disabled = true;
    setStatus('Sending…', 'pending');
    try {
      const response = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          // Kept as a fixed, unique prefix (not varying by type) so a single
          // Gmail filter on the subject text reliably catches every report
          // regardless of which dropdown option was picked — see
          // AI_HANDOFF.md for the exact filter setup.
          _subject: `[Tycoon Sim Report] ${type}: ${title}`,
          Type: type,
          Title: title,
          Details: message,
          Contact: contact || '(not provided)',
          Page: window.location.href,
          _template: 'table',
        }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setStatus('Thanks — your report was sent!', 'success');
      form.reset();
      setTimeout(closeDialog, 1600);
    } catch (error) {
      setStatus('Couldn’t send that — check your connection and try again.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
})();
