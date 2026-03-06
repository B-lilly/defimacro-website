// Redirect to login page if not authenticated
(function () {
  if (sessionStorage.getItem('dm_auth') !== '1fmelts') {
    var dest = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('login.html?r=' + dest);
  }
})();
