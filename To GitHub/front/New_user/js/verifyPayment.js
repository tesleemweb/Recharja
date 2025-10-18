(async function(){
  const params = new URLSearchParams(location.search);
  const ref = params.get('reference');
  const statusEl = document.getElementById('status');

  if (!ref) return statusEl.textContent = 'No reference found.';

  try {
    const res = await fetch(`${BASE_URL}/api/wallet/verify/${ref}`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      location.href = 'success';
    } else {
      location.href = 'fail';
    }
  } catch {
    location.href = 'fail';
  }
})();
