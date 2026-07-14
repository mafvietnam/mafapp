/**
 * MAF Running Club — Main JS
 * Mobile menu, nav scroll shadow, scroll animations.
 * Optimized to avoid forced reflows.
 */
document.addEventListener('DOMContentLoaded', function () {
  // --- Mobile Menu ---
  var toggle = document.getElementById('mobile-menu-toggle');
  var menu = document.getElementById('mobile-menu');
  var overlay = document.getElementById('mobile-menu-overlay');
  var closeBtn = document.getElementById('mobile-menu-close');
  var panel = document.getElementById('mobile-menu-panel');

  function openMenu() {
    menu.classList.remove('hidden');
    requestAnimationFrame(function () {
      panel.classList.remove('translate-x-full');
    });
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    panel.classList.add('translate-x-full');
    document.body.style.overflow = '';
    setTimeout(function () {
      menu.classList.add('hidden');
    }, 300);
  }

  if (toggle && menu) {
    toggle.addEventListener('click', openMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    var links = panel ? panel.querySelectorAll('a') : [];
    links.forEach(function (link) {
      // Skip login triggers — they handle menu close via openLoginModal
      if (!link.hasAttribute('data-open-login')) {
        link.addEventListener('click', closeMenu);
      }
    });
  }

  // --- Nav Scroll Shadow (passive, no reflow) ---
  var nav = document.getElementById('site-nav');
  if (nav) {
    var lastScrolled = false;
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY > 50;
      if (scrolled !== lastScrolled) {
        lastScrolled = scrolled;
        nav.classList.toggle('shadow-lg', scrolled);
      }
    }, { passive: true });
  }

  // --- Hero Banner Slider ---
  var slider = document.querySelector('.hero-slider');
  if (slider) {
    var bgs = slider.querySelectorAll('.hero-slide-bg');
    var contents = slider.querySelectorAll('.hero-slide-content');
    var dots = slider.querySelectorAll('.hero-dot');
    var prevBtn = slider.querySelector('.hero-arrow-prev');
    var nextBtn = slider.querySelector('.hero-arrow-next');
    var slideCount = bgs.length;
    var currentSlide = 0;
    var autoplayMs = parseInt(slider.dataset.autoplay, 10) || 0;
    var autoplayTimer = null;

    function goToSlide(index) {
      if (index === currentSlide || slideCount <= 1) return;

      bgs[currentSlide].classList.remove('opacity-100');
      bgs[currentSlide].classList.add('opacity-0', 'pointer-events-none');
      contents[currentSlide].classList.remove('opacity-100', 'translate-y-0');
      contents[currentSlide].classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');

      bgs[index].classList.remove('opacity-0', 'pointer-events-none');
      bgs[index].classList.add('opacity-100');
      contents[index].classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
      contents[index].classList.add('opacity-100', 'translate-y-0');

      if (dots.length > 0) {
        dots[currentSlide].classList.remove('bg-primary', 'border-primary', 'scale-110');
        dots[currentSlide].classList.add('bg-white/20');
        dots[index].classList.remove('bg-white/20');
        dots[index].classList.add('bg-primary', 'border-primary', 'scale-110');
      }

      currentSlide = index;
    }

    function nextSlide() { goToSlide((currentSlide + 1) % slideCount); }
    function prevSlide() { goToSlide((currentSlide - 1 + slideCount) % slideCount); }
    function startAutoplay() {
      if (autoplayMs > 0 && slideCount > 1) {
        autoplayTimer = setInterval(nextSlide, autoplayMs);
      }
    }
    function resetAutoplay() {
      clearInterval(autoplayTimer);
      startAutoplay();
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goToSlide(parseInt(this.dataset.slide, 10));
        resetAutoplay();
      });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { prevSlide(); resetAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { nextSlide(); resetAutoplay(); });

    slider.addEventListener('mouseenter', function () { clearInterval(autoplayTimer); });
    slider.addEventListener('mouseleave', function () { startAutoplay(); });

    var touchStartX = 0;
    slider.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
      clearInterval(autoplayTimer);
    }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 50) { diff < 0 ? nextSlide() : prevSlide(); }
      startAutoplay();
    }, { passive: true });

    startAutoplay();
  }

  // --- Login Modal ---
  var loginModal = document.getElementById('login-modal');
  if (loginModal) {
    var loginOverlay = document.getElementById('login-modal-overlay');
    var loginCloseBtn = document.getElementById('login-modal-close');

    function openLoginModal() {
      // Close mobile menu first if open, then show modal after animation
      if (menu && !menu.classList.contains('hidden')) {
        closeMenu();
        setTimeout(function () {
          loginModal.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
        }, 320);
        return;
      }
      loginModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeLoginModal() {
      loginModal.classList.add('hidden');
      document.body.style.overflow = '';
    }

    // Open triggers — all elements with data-open-login attribute
    document.querySelectorAll('[data-open-login]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openLoginModal();
      });
    });

    if (loginCloseBtn) loginCloseBtn.addEventListener('click', closeLoginModal);
    if (loginOverlay) loginOverlay.addEventListener('click', closeLoginModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !loginModal.classList.contains('hidden')) {
        closeLoginModal();
      }
    });

    // Password visibility toggle
    var togglePass = document.getElementById('maf-toggle-pass');
    var passInput = document.getElementById('maf-login-pass');
    if (togglePass && passInput) {
      togglePass.addEventListener('click', function () {
        var isHidden = passInput.type === 'password';
        passInput.type = isHidden ? 'text' : 'password';
        togglePass.querySelector('.material-symbols-outlined').textContent = isHidden ? 'visibility_off' : 'visibility';
      });
    }

    // AJAX Login Form with reCAPTCHA v3
    var loginForm = document.getElementById('maf-login-form');
    var loginError = document.getElementById('maf-login-error');
    var loginSubmit = document.getElementById('maf-login-submit');
    if (loginForm && typeof mafLogin !== 'undefined') {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        loginError.classList.add('hidden');
        loginSubmit.disabled = true;
        loginSubmit.textContent = 'Đang xác minh...';

        // Submit the login form, with or without a reCAPTCHA token.
        // Server keeps nonce + honeypot + IP rate limiting as backstops.
        function submitLogin(token) {
          loginSubmit.textContent = 'Đang đăng nhập...';

          var formData = new FormData(loginForm);
          formData.append('action', 'maf_ajax_login');
          formData.append('recaptcha_token', token || '');

          fetch(mafLogin.ajaxUrl, { method: 'POST', body: formData, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
              if (res.success) {
                // Honor server-provided redirect URL (e.g. SSO callback to app.maf.run).
                // Fall back to reload so the WP SSO gateway can still kick in for legacy paths.
                var dest = res.data && res.data.redirect;
                if (dest) {
                  window.location.href = dest;
                } else {
                  window.location.reload();
                }
              } else {
                loginError.textContent = res.data.message || 'Đăng nhập thất bại.';
                loginError.classList.remove('hidden');
                loginSubmit.disabled = false;
                loginSubmit.textContent = 'Đăng nhập';
              }
            })
            .catch(function () {
              loginError.textContent = 'Lỗi kết nối. Vui lòng thử lại.';
              loginError.classList.remove('hidden');
              loginSubmit.disabled = false;
              loginSubmit.textContent = 'Đăng nhập';
            });
        }

        // reCAPTCHA v3 is best-effort: an invalid site key or blocked script must
        // not lock users out. Fall back to a token-less submit on failure/timeout.
        if (typeof grecaptcha === 'undefined' || !mafLogin.recaptchaSite) {
          submitLogin('');
          return;
        }

        var tokenTimeout = setTimeout(function () {
          tokenTimeout = null;
          submitLogin('');
        }, 5000);

        function submitOnce(token) {
          if (tokenTimeout === null) return; // timeout fallback already submitted
          clearTimeout(tokenTimeout);
          tokenTimeout = null;
          submitLogin(token);
        }

        try {
          grecaptcha.ready(function () {
            grecaptcha
              .execute(mafLogin.recaptchaSite, { action: 'login' })
              .then(function (token) { submitOnce(token); })
              .catch(function () { submitOnce(''); });
          });
        } catch (err) {
          submitOnce('');
        }
      });
    }
  }

  // --- Scroll Animations (no forced reflow) ---
  // Use CSS classes only — never read geometry then write inline styles.
  var animatedEls = document.querySelectorAll('.animate-fade-in-up');
  if (animatedEls.length > 0 && 'IntersectionObserver' in window) {
    // Add a class that hides elements via CSS (no JS style reads)
    animatedEls.forEach(function (el) {
      el.classList.add('scroll-hidden');
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('scroll-hidden');
          entry.target.classList.add('scroll-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    animatedEls.forEach(function (el) { observer.observe(el); });
  }
});
