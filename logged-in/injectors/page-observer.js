(function () {
  const channel = new BroadcastChannel('VANA_DATA_CHANNEL');

  function snapshot() {
    const elements = [...document.querySelectorAll(
      "button, a, input, textarea, select"
    )].map(el => ({
      tag: el.tagName,
      text: el.innerText?.slice(0, 200) || "",
      value: el.value || "",
      href: el.href || "",
      disabled: el.disabled || false
    }));

    const text = document.body.innerText.slice(0, 8000);

    const payload = {
        url: location.href,
        title: document.title,
        text,
        elements
    };

    // Send to BroadcastChannel (Cross-tab/iframe)
    channel.postMessage({
      type: "VANA_PAGE_DATA",
      payload: payload
    });
    
    // Also send to window (if Vana is an overlay)
    window.postMessage({
      type: "VANA_PAGE_DATA",
      payload: payload
    }, "*");
  }

  // Initial snapshot
  setTimeout(snapshot, 2000);
  
  // Periodic snapshot (every 10s)
  setInterval(snapshot, 10000);
  
  // Snapshot on interaction
  document.addEventListener('click', () => setTimeout(snapshot, 1000));
  document.addEventListener('input', () => setTimeout(snapshot, 1000));
})();