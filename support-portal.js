const cartCount = document.getElementById('cart-count');
const adminBadge = document.getElementById('admin-badge');
const statsContainer = document.getElementById('portal-stats');
const toast = document.getElementById('toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

async function loadCartCount() {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3001/api/cart', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    cartCount.textContent = '0';
    return;
  }
  const cart = await response.json();
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

async function loadCurrentUser(token) {
  const response = await fetch('http://localhost:3001/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    window.location.href = 'auth.html';
    return null;
  }

  const user = await response.json();
  if (adminBadge) {
    adminBadge.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
  }
  return user;
}

async function loadPortalStats() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const user = await loadCurrentUser(token);
  if (!user || user.role !== 'admin') {
    statsContainer.innerHTML = '<div class="empty-state"><h3>Access restricted</h3><p>Only support admins can view this portal.</p></div>';
    return;
  }

  const response = await fetch('http://localhost:3001/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    statsContainer.innerHTML = '<div class="empty-state"><h3>Unable to load support data</h3></p></div>';
    return;
  }

  const orders = await response.json();
  const returns = orders.filter((order) => order.returnStatus);
  const pendingReturns = returns.filter((order) => ['Requested', 'Approved'].includes(order.returnStatus)).length;
  const completedReturns = returns.filter((order) => ['Rejected', 'Refunded'].includes(order.returnStatus)).length;
  const refundsCompleted = returns.filter((order) => order.refundStatus === 'Completed').length;

  statsContainer.innerHTML = `
    <div class="stat-card">
      <h3>${returns.length}</h3>
      <p>Total return requests</p>
    </div>
    <div class="stat-card">
      <h3>${pendingReturns}</h3>
      <p>Pending</p>
    </div>
    <div class="stat-card">
      <h3>${completedReturns}</h3>
      <p>Completed</p>
    </div>
    <div class="stat-card">
      <h3>${refundsCompleted}</h3>
      <p>Refunds completed</p>
    </div>
  `;
  showToast('Support portal ready');
}

loadCartCount();
loadPortalStats();
