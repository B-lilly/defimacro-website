// Simple client-side password gate
// Not cryptographically secure — just keeps casual visitors out
(function () {
  const PASS_HASH = 'a5acee4e028f3f3510c0621d01b0b3d15b683215b823cc37a6bf6fd040605773';

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const stored = sessionStorage.getItem('dm_auth');
  if (stored === PASS_HASH) return; // already authenticated this session

  // Block page content
  document.documentElement.style.visibility = 'hidden';

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.visibility = 'hidden';
    document.body.innerHTML = '';
    document.body.style.cssText = 'background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'text-align:center;padding:40px;';

    const title = document.createElement('h1');
    title.style.cssText = 'color:#fff;font-size:28px;margin-bottom:24px;font-weight:700;';
    title.innerHTML = '<span style="color:#000;background:#fff;padding:2px 8px;border-radius:5px;">defi</span>macro';

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Enter password';
    input.autocomplete = 'off';
    input.style.cssText = 'display:block;width:280px;padding:12px 16px;border:2px solid #3a3a3a;background:#1a1a1a;color:#fff;font-size:14px;border-radius:6px;outline:none;font-family:inherit;margin:0 auto 12px;';

    const btn = document.createElement('button');
    btn.textContent = 'Enter';
    btn.style.cssText = 'padding:10px 32px;background:#99D9D9;color:#000;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;';

    const err = document.createElement('div');
    err.style.cssText = 'color:#E9072B;font-size:13px;margin-top:12px;min-height:20px;';

    async function tryLogin() {
      const hash = await sha256(input.value);
      if (hash === PASS_HASH) {
        sessionStorage.setItem('dm_auth', PASS_HASH);
        location.reload();
      } else {
        err.textContent = 'Incorrect password';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btn);
    box.appendChild(err);
    document.body.appendChild(box);
    document.documentElement.style.visibility = 'visible';
    input.focus();
  });
})();
