(() => {
  const frames = document.querySelectorAll('iframe.dds-animation');
  const resize = (frame, height) => {
    if (typeof height === 'number' && Number.isFinite(height) && height > 0 && height <= 2000) {
      frame.style.height = `${Math.ceil(height)}px`;
    }
  };
  const measure = (frame) => {
    // A lazy child can finish before this deferred script installs its listener.
    const body = frame.contentDocument?.body;
    if (body) resize(frame, body.getBoundingClientRect().height);
  };
  for (const frame of frames) {
    frame.addEventListener('load', () => measure(frame));
    measure(frame);
  }
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    const message = event.data;
    if (!message || message.type !== 'dds-animation-height' ||
        typeof message.height !== 'number' || !Number.isFinite(message.height) ||
        message.height <= 0 || message.height > 2000) return;

    for (const frame of frames) {
      if (frame.contentWindow === event.source) {
        resize(frame, message.height);
        break;
      }
    }
  });
})();
