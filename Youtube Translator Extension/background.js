chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const word = request.word;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=en&dt=t&q=${encodeURIComponent(word)}`;
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          sendResponse({ translation: data[0][0][0] });
        } else {
          sendResponse({ error: 'No translation found in response' });
        }
      })
      .catch(error => {
        console.error('Translation fetch failed:', error);
        sendResponse({ error: error.message || 'Failed to fetch translation' });
      });
      
    return true; // Keep message channel open for async response
  }
});
