(() => {
  let current = null;
  const node = (tag, value) => { const el = document.createElement(tag); if (value) el.textContent = value; return el; };
  const stop = stream => stream?.getTracks().forEach(track => track.stop());
  function clear() { current?.close(); }
  function modal(title, done) {
    clear(); const dialog = node('dialog'); dialog.className = 'document-camera';
    const heading = node('h2', title); heading.id = 'document-camera-title'; dialog.setAttribute('aria-labelledby', heading.id);
    const close = node('button', 'Close'); close.type = 'button'; close.className = 'btn-secondary';
    const state = { dialog, stream: null, url: null, close() {
      if (current !== state) return;
      current = null; stop(state.stream); if (state.url) URL.revokeObjectURL(state.url);
      dialog.close(); dialog.remove(); done?.(null);
    } };
    current = state; dialog.append(heading); close.onclick = state.close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); state.close(); });
    dialog.addEventListener('close', state.close); document.body.append(dialog); dialog.showModal();
    return { state, close };
  }
  window.WorkforceCamera = {
    clear,
    capture(title) {
      return new Promise(resolve => {
        const { state, close } = modal(title, resolve), dialog = state.dialog;
        const video = node('video'); video.autoplay = true; video.muted = true; video.playsInline = true;
        const status = node('p', 'Allow camera access to take a photo.'); status.setAttribute('role', 'status');
        const capture = node('button', 'Capture photo'); capture.type = 'button'; capture.className = 'btn-primary'; capture.disabled = true;
        dialog.append(video, status, capture, close);
        video.onloadeddata = () => { if (current === state) { capture.disabled = !video.videoWidth; status.textContent = 'Fit the whole document inside the picture.'; } };
        capture.onclick = () => {
          if (current !== state || !video.videoWidth || !video.videoHeight) return;
          capture.disabled = true; const canvas = node('canvas'), scale = Math.min(1, 2400 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (current !== state) return;
            if (!blob) { status.textContent = 'Unable to capture. Please try again.'; capture.disabled = false; return; }
            resolve(new File([blob], 'document-photo.jpg', { type: 'image/jpeg' })); state.close();
          }, 'image/jpeg', .9);
        };
        (async () => {
          try {
            if (!navigator.mediaDevices?.getUserMedia) throw Error('unsupported');
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            if (current !== state) { stop(stream); return; }
            state.stream = stream; video.srcObject = stream; await video.play();
          } catch (error) {
            if (current !== state) return;
            stop(state.stream); video.hidden = true;
            status.textContent = error.name === 'NotAllowedError' ? 'Camera access was blocked. Allow camera access in your browser and try again, or use Upload file.' : 'Camera unavailable. Connect a camera and try again, or use Upload file.';
          }
        })();
      });
    },
    view(blob, title) {
      const { state, close } = modal(title); state.url = URL.createObjectURL(blob);
      const image = node('img'); image.alt = title; image.src = state.url; state.dialog.append(image, close);
    }
  };
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
})();
