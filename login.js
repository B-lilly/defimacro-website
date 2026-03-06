// Simple client-side password gate
// Must be the FIRST script loaded in <head>, before stylesheets
(function () {
  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      h = ((h << 13) ^ h) | 0;
      h = (h * 0x5bd1e995) | 0;
    }
    return (h >>> 0).toString(36);
  }

  var PASS_HASH = '1fmelts';
  var stored = sessionStorage.getItem('dm_auth');
  if (stored === PASS_HASH) return;

  // Replace the entire document — stops all further parsing/loading
  document.open();
  document.write([
    '<!DOCTYPE html>',
    '<html><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<title>defimacro</title>',
    '<style>',
    'body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;}',
    '.box{text-align:center;padding:40px;}',
    'h1{color:#fff;font-size:28px;margin-bottom:24px;font-weight:700;}',
    '.defi{color:#000;background:#fff;padding:2px 8px;border-radius:5px;}',
    'input{display:block;width:280px;padding:12px 16px;border:2px solid #3a3a3a;background:#1a1a1a;color:#fff;font-size:14px;border-radius:6px;outline:none;font-family:inherit;margin:0 auto 12px;box-sizing:border-box;}',
    'button{padding:10px 32px;background:#99D9D9;color:#000;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}',
    '#err{color:#E9072B;font-size:13px;margin-top:12px;min-height:20px;}',
    '</style>',
    '</head><body>',
    '<div class="box">',
    '<h1><span class="defi">defi</span>macro</h1>',
    '<input id="pw" type="password" placeholder="Enter password" autocomplete="off">',
    '<button id="btn">Enter</button>',
    '<div id="err"></div>',
    '</div>',
    '<script>',
    'function simpleHash(s){var h=0;for(var i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;h=((h<<13)^h)|0;h=(h*0x5bd1e995)|0;}return(h>>>0).toString(36);}',
    'function tryLogin(){var v=document.getElementById("pw").value;if(simpleHash(v)==="1fmelts"){sessionStorage.setItem("dm_auth","1fmelts");location.reload();}else{document.getElementById("err").textContent="Incorrect password";document.getElementById("pw").value="";document.getElementById("pw").focus();}}',
    'document.getElementById("btn").addEventListener("click",tryLogin);',
    'document.getElementById("pw").addEventListener("keydown",function(e){if(e.key==="Enter")tryLogin();});',
    'document.getElementById("pw").focus();',
    '<\/script>',
    '</body></html>',
  ].join('\n'));
  document.close();
})();
