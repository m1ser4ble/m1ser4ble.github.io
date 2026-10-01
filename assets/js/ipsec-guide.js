// Restrict iframe sizing messages to the explainer owned by this article.
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data) return;
  const selector = data.type === 'ipsec-explainer-height' ? 'iframe.ipsec-explainer-frame'
    : data.type === 'ipsec-demo-height' ? 'iframe.ipsec-handshake-frame' : null;
  if (!selector) return;
  if (typeof data.height !== 'number' || !Number.isFinite(data.height)) return;
  if (data.height < 350 || data.height > 2000) return;
  for (const frame of document.querySelectorAll(selector)) {
    if (frame.contentWindow === event.source) {
      frame.style.height = `${Math.ceil(data.height)}px`;
      break;
    }
  }
});
