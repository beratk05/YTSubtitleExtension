let activeTooltip = null;

// Escape HTML utility
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
}

function processSubtitles() {
  const player = document.getElementById('movie_player') || document.body;
  const selectors = ['.ytp-caption-segment', '.caption-visual-line', '.ytp-captions-player'];
  let subtitleSegments = [];

  selectors.forEach(selector => {
    const found = player.querySelectorAll(selector);
    if (found.length > 0) {
      subtitleSegments = [...subtitleSegments, ...found];
    }
  });
  
  subtitleSegments.forEach(segment => {
    // If the segment contains clickable words, it means we already processed it
    if (segment.querySelector('.clickable-word')) return;

    const originalText = segment.innerText;
    if (!originalText.trim()) return;

    // Use a Unicode-aware regex to split text:
    // Captures words containing letters (including German umlauts/ß), hyphens (like U-Bahn), and apostrophes (like geht's)
    const wordRegex = /^[\p{L}]+(?:[-'][\p{L}]+)*$/u;
    const parts = originalText.split(/([\p{L}]+(?:[-'][\p{L}]+)*)/gu);

    segment.innerHTML = '';
    parts.forEach(part => {
      if (!part) return;

      if (wordRegex.test(part)) {
        const span = document.createElement('span');
        span.innerText = part;
        span.className = 'clickable-word';
        
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          handleWordClick(span, part);
        });
        
        segment.appendChild(span);
      } else {
        segment.appendChild(document.createTextNode(part));
      }
    });
  });
}

async function handleWordClick(span, word) {
  // Pause the video when user clicks on a word
  const video = document.querySelector('video');
  if (video && !video.paused) {
    video.pause();
  }

  // Clear any existing active tooltip
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }

  // Get optimal container (supports Fullscreen mode when appended to #movie_player)
  const container = document.querySelector('#movie_player') || 
                    document.querySelector('.html5-video-player') || 
                    document.querySelector('.video-container') || 
                    document.body;

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'translation-tooltip';
  tooltip._targetSpan = span; // Track target span to dismiss if removed from DOM
  
  tooltip.innerHTML = `
    <div class="tooltip-content">
      <div class="tooltip-header">
        <span class="tooltip-german-word">${escapeHtml(word)}</span>
      </div>
      <div class="tooltip-loading">
        <div class="tooltip-spinner"></div>
        <span>Translating...</span>
      </div>
    </div>
    <div class="tooltip-arrow"></div>
  `;

  container.appendChild(tooltip);
  activeTooltip = tooltip;

  // Position tooltip initially (with loading height)
  positionTooltip(tooltip, span, container);

  try {
    const translation = await translateWord(word);
    updateTooltipContent(tooltip, word, translation);
    // Reposition as contents/size changed
    positionTooltip(tooltip, span, container);
  } catch (error) {
    console.error("Translation lookup failed:", error);
    updateTooltipError(tooltip, word, `Error: ${error.message}`);
    positionTooltip(tooltip, span, container);
  }
}

function positionTooltip(tooltip, span, container) {
  const containerRect = container.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const containerWidth = containerRect.width;
  
  // Center of clicked word relative to the container
  const spanCenter = spanRect.left + (spanRect.width / 2);
  let leftPos = spanCenter - containerRect.left - (tooltipWidth / 2);
  
  // Clamp left position to stay inside the container boundaries with 10px margin
  leftPos = Math.max(10, Math.min(containerWidth - tooltipWidth - 10, leftPos));
  
  // Position above the word with a 10px spacing
  const topPos = spanRect.top - containerRect.top - tooltipHeight - 10;
  
  tooltip.style.left = `${leftPos}px`;
  tooltip.style.top = `${topPos}px`;
  
  // Position arrow dynamically to point exactly at the word center
  const arrow = tooltip.querySelector('.tooltip-arrow');
  if (arrow) {
    let arrowLeft = spanCenter - containerRect.left - leftPos;
    // Keep arrow within tooltip boundaries
    arrowLeft = Math.max(10, Math.min(tooltipWidth - 10, arrowLeft));
    arrow.style.left = `${arrowLeft}px`;
  }
}

const translationCache = new Map();

async function translateWord(word) {
  const cleanWord = word.trim();
  
  // Return cached translation if available
  if (translationCache.has(cleanWord)) {
    return translationCache.get(cleanWord);
  }

  // Use sl=auto to detect and translate from any language to English
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(cleanWord)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  if (data && data[0] && data[0][0] && data[0][0][0]) {
    const translation = data[0][0][0];
    translationCache.set(cleanWord, translation); // Cache the successful result
    return translation;
  }
  throw new Error("No translation found in response");
}

function updateTooltipContent(tooltip, originalWord, translation) {
  const contentDiv = tooltip.querySelector('.tooltip-content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-german-word">${escapeHtml(originalWord)}</span>
      <div class="tooltip-actions">
        <button class="tooltip-btn speak-btn" title="Pronounce German word">
          <svg viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>
        <button class="tooltip-btn copy-btn" title="Copy English translation">
          <svg viewBox="0 0 24 24">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="tooltip-translation-row">
      <span class="tooltip-translation">${escapeHtml(translation)}</span>
    </div>
  `;
  
  // Attach Event Listeners
  const speakBtn = contentDiv.querySelector('.speak-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakGermanWord(originalWord);
    });
  }
  
  const copyBtn = contentDiv.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(translation, copyBtn);
    });
  }
}

function updateTooltipError(tooltip, originalWord, errorMessage) {
  const contentDiv = tooltip.querySelector('.tooltip-content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-german-word">${escapeHtml(originalWord)}</span>
    </div>
    <div style="font-size: 13px; color: #f87171; padding: 4px 0;">
      ${escapeHtml(errorMessage)}
    </div>
  `;
}

function speakGermanWord(word) {
  // Auto-pause video when playing pronunciation
  const video = document.querySelector('video');
  if (video && !video.paused) {
    video.pause();
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'de-DE';
    
    // Choose German voice if available
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find(voice => voice.lang.startsWith('de'));
    if (deVoice) {
      utterance.voice = deVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btn.innerHTML;
    // Temporary checkmark icon
    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    btn.style.color = '#4ade80';
    
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.color = '';
    }, 1500);
  }).catch(err => {
    console.error('Could not copy translation: ', err);
  });
}

// Global cleanup handlers
document.addEventListener('click', (e) => {
  if (activeTooltip && !activeTooltip.contains(e.target) && !e.target.classList.contains('clickable-word')) {
    activeTooltip.remove();
    activeTooltip = null;
  }
});

window.addEventListener('resize', () => {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
});

let subtitleObserver = null;
let observedContainer = null;

function setupOptimizedObserver() {
  // Find the exact caption container. This ensures we ONLY observe subtitles.
  const captionContainer = document.querySelector('.ytp-caption-window-container') || 
                           document.querySelector('#ytp-caption-window-container');
                           
  if (captionContainer && captionContainer !== observedContainer) {
    if (subtitleObserver) {
      subtitleObserver.disconnect();
    }
    
    observedContainer = captionContainer;
    
    // This observer will fire INSTANTLY when a subtitle appears (0ms delay), 
    // and because it's localized to the caption container, it avoids crashing the app.
    subtitleObserver = new MutationObserver(() => {
      processSubtitles();
      
      if (activeTooltip && activeTooltip._targetSpan && !document.body.contains(activeTooltip._targetSpan)) {
        activeTooltip.remove();
        activeTooltip = null;
      }
    });
    
    subtitleObserver.observe(captionContainer, { childList: true, subtree: true, characterData: true });
    
    // Process immediately in case subtitles are already present
    processSubtitles();
  }
}

// We use a lightweight interval just to find the caption container if the user navigates
// to a new video, which guarantees we always attach our instant observer successfully.
setInterval(setupOptimizedObserver, 500);