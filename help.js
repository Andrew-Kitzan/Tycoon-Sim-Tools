// Help widget — a "?" button next to Feedback that opens a per-tool reference
// dialog explaining how to use whichever tool is currently active. Self-
// contained IIFE, plain script, same pattern as feedback.js/
// capgrader-generator.js. Only wired up for Capgrader Generator and Luck
// Simulator so far — the button stays hidden on Base Builder until that
// tool gets its own help content.
(function () {
  const toggleButton = document.querySelector('#help-toggle');
  const dialog = document.querySelector('#help-dialog');
  if (!toggleButton || !dialog) return;

  const contentByTool = {
    capgrader: document.querySelector('#help-content-capgrader'),
    luck: document.querySelector('#help-content-luck'),
  };

  function currentTool() {
    return globalThis.TycoonActiveTool ?? 'builder';
  }

  function applyToolVisibility() {
    const tool = currentTool();
    const hasHelp = Boolean(contentByTool[tool]);
    toggleButton.hidden = !hasHelp;
    if (!hasHelp && dialog.open) dialog.close();
    Object.entries(contentByTool).forEach(([name, el]) => {
      if (el) el.hidden = name !== tool;
    });
  }

  function openDialog() {
    applyToolVisibility();
    if (!contentByTool[currentTool()]) return;
    dialog.showModal();
  }
  function closeDialog() {
    dialog.close();
  }

  toggleButton.addEventListener('click', openDialog);
  dialog.querySelectorAll('[data-help-action="close"]').forEach((button) => {
    button.addEventListener('click', closeDialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(); // click on the backdrop
  });

  document.addEventListener('active-tool:changed', applyToolVisibility);
  applyToolVisibility();
})();
