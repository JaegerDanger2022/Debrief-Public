navigator.mediaDevices.getUserMedia({ audio: true })
  .then((stream) => {
    stream.getTracks().forEach((t) => t.stop());
    chrome.runtime.sendMessage({ action: "MIC_PERMISSION_GRANTED" });
    window.close();
  })
  .catch((err) => {
    chrome.runtime.sendMessage({ action: "MIC_PERMISSION_DENIED", message: err.message });
    window.close();
  });
