(() => {
  const get = id => document.getElementById(id);
  const dialog = get('staff-training');
  const video = get('staff-training-video');
  const enter = get('staff-training-enter');
  const close = get('staff-training-close');
  const signOut = get('staff-training-signout');
  const feedback = get('staff-training-feedback');
  let required = false, reached = 0, attempt = 0, continueToWorkspace;

  function open(onComplete) {
    const current = ++attempt;
    required = typeof onComplete === 'function';
    continueToWorkspace = onComplete;
    reached = 0;
    get('staff-training-intro').textContent = required
      ? 'Watch this 49-second video through the end to open your workspace.'
      : 'Review caregiver lookup, applications, and opportunity drafts.';
    enter.hidden = signOut.hidden = !required;
    close.hidden = required;
    enter.disabled = true;
    feedback.textContent = '';
    video.src = video.dataset.src;
    dialog.showModal();
    if (required) workforceApi('/staff/training', {action:'start'}).catch(error => {
      if (current === attempt) feedback.textContent = error.message;
    });
  }

  function dismiss() {
    ++attempt;
    required = false;
    continueToWorkspace = undefined;
    if (dialog.open) dialog.close();
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  document.addEventListener('workforce-session-cleared', dismiss);
  get('staff-training-replay').onclick = () => open();
  close.onclick = dismiss;
  signOut.onclick = () => get('workforce-signout').click();
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (!required) dismiss();
  });

  video.addEventListener('ratechange', () => {
    if (required && video.playbackRate !== 1) video.playbackRate = 1;
  });
  video.addEventListener('seeking', () => {
    if (required && video.currentTime > reached + 0.25) video.currentTime = reached;
  });
  video.addEventListener('timeupdate', () => {
    if (!video.seeking) reached = Math.max(reached, video.currentTime);
  });
  video.addEventListener('ended', () => {
    if (!required) return;
    const played = video.played;
    enter.disabled = played.length !== 1 || played.start(0) > 0.15 || played.end(0) < video.duration - 0.15;
    if (enter.disabled) {
      reached = 0;
      video.load();
      feedback.textContent = 'Play the full video from the beginning to continue.';
    } else {
      feedback.textContent = 'Training complete. You can now enter the workspace.';
    }
  });
  video.addEventListener('error', () => {
    if (dialog.open) feedback.textContent = 'The video could not load. Reload the page and try again.';
  });
  enter.onclick = async () => {
    const current = attempt;
    enter.disabled = true;
    try {
      const result = await workforceApi('/staff/training', {action:'complete'});
      if (current !== attempt) return;
      if (!result.complete) throw Error('Training progress could not be saved. Try again.');
      const resume = continueToWorkspace;
      dismiss();
      resume?.();
    } catch (error) {
      if (current === attempt) {
        feedback.textContent = error.message;
        enter.disabled = false;
      }
    }
  };
  window.WorkforceTraining = {require: open};
})();
