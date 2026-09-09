(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.2,.7,.2,1)';

  function setPlatformMapLinks() {
    const isAppleMobile = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    document.querySelectorAll('[data-map-address]').forEach((link) => {
      const address = link.getAttribute('data-map-address');
      if (!address) return;
      const query = encodeURIComponent(address);
      link.href = isAppleMobile
        ? `https://maps.apple.com/?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`;
      link.setAttribute('aria-label', `${link.textContent.trim()} — open in ${isAppleMobile ? 'Apple Maps' : 'Google Maps'}`);
    });
  }

  function animateFaqs() {
    document.querySelectorAll('.faq details').forEach((details) => {
      const summary = details.querySelector(':scope > summary');
      if (!summary || details.dataset.enhancedFaq === 'true') return;
      details.dataset.enhancedFaq = 'true';

      const answer = document.createElement('div');
      answer.className = 'faq-answer';
      let node = summary.nextSibling;
      while (node) {
        const next = node.nextSibling;
        answer.appendChild(node);
        node = next;
      }
      details.appendChild(answer);

      if (details.open) {
        answer.style.height = 'auto';
        answer.style.opacity = '1';
      } else {
        answer.style.height = '0px';
        answer.style.opacity = '0';
      }

      summary.addEventListener('click', (event) => {
        event.preventDefault();
        if (details.dataset.animating === 'true') return;

        if (reducedMotion.matches) {
          details.open = !details.open;
          answer.style.height = details.open ? 'auto' : '0px';
          answer.style.opacity = details.open ? '1' : '0';
          return;
        }

        details.dataset.animating = 'true';
        const opening = !details.open;

        if (opening) {
          details.open = true;
          answer.style.height = '0px';
          answer.style.opacity = '0';
          const endHeight = answer.scrollHeight;
          const animation = answer.animate(
            [
              { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
              { height: `${endHeight}px`, opacity: 1, transform: 'translateY(0)' }
            ],
            { duration: 333, easing: EASE, fill: 'forwards' }
          );
          animation.onfinish = () => {
            answer.style.height = 'auto';
            answer.style.opacity = '1';
            answer.style.transform = '';
            details.dataset.animating = 'false';
          };
          animation.oncancel = () => { details.dataset.animating = 'false'; };
        } else {
          const startHeight = answer.scrollHeight;
          answer.style.height = `${startHeight}px`;
          const animation = answer.animate(
            [
              { height: `${startHeight}px`, opacity: 1, transform: 'translateY(0)' },
              { height: '0px', opacity: 0, transform: 'translateY(-4px)' }
            ],
            { duration: 333, easing: EASE, fill: 'forwards' }
          );
          animation.onfinish = () => {
            details.open = false;
            answer.style.height = '0px';
            answer.style.opacity = '0';
            answer.style.transform = '';
            details.dataset.animating = 'false';
          };
          animation.oncancel = () => { details.dataset.animating = 'false'; };
        }
      });
    });
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setupCountyCardOverflow() {
    document.querySelectorAll('.county-hub-grid .location-card').forEach((card) => {
      const text = card.querySelector(':scope > p');
      if (!text || card.dataset.scrollEnhanced === 'true') return;
      card.dataset.scrollEnhanced = 'true';

      const overflow = Math.max(0, text.scrollHeight - text.clientHeight);
      if (overflow < 2) return;
      card.classList.add('is-scrollable');
      let raf = 0;

      const animateTo = (target, duration) => {
        cancelAnimationFrame(raf);
        if (reducedMotion.matches) {
          text.scrollTop = target;
          return;
        }
        const start = text.scrollTop;
        const delta = target - start;
        const begin = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - begin) / duration);
          text.scrollTop = start + delta * easeInOutCubic(p);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      };

      const downDuration = Math.min(5600, Math.max(1800, overflow * 15));
      card.addEventListener('mouseenter', () => animateTo(text.scrollHeight - text.clientHeight, downDuration));
      card.addEventListener('mouseleave', () => animateTo(0, 560));
      card.addEventListener('focusin', () => animateTo(text.scrollHeight - text.clientHeight, downDuration));
      card.addEventListener('focusout', () => animateTo(0, 560));
    });
  }

  function initialize() {
    setPlatformMapLinks();
    animateFaqs();
    setupCountyCardOverflow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
