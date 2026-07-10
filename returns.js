const cartCount = document.getElementById('cart-count');
const returnsContainer = document.getElementById('returns-container');
const filterButtons = document.querySelectorAll('.filter-btn');
const adminBadge = document.getElementById('admin-badge');
const supportLink = document.getElementById('support-link');
let allReturns = [];
let activeFilter = 'all';
let currentUser = null;

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

function getBadgeClass(status) {
  if (status === 'Approved' || status === 'Refunded') return 'badge success';
  if (status === 'Rejected') return 'badge danger';
  return 'badge pending';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderReturns() {
  const token = localStorage.getItem('token');
  const isAdmin = currentUser?.role === 'admin';
  const filteredReturns = allReturns.filter((order) => {
    if (activeFilter === 'pending') return ['Requested', 'Approved'].includes(order.returnStatus);
    if (activeFilter === 'completed') return ['Rejected', 'Refunded'].includes(order.returnStatus);
    return true;
  });

  const pendingCount = allReturns.filter((order) => ['Requested', 'Approved'].includes(order.returnStatus)).length;
  const completedCount = allReturns.filter((order) => ['Rejected', 'Refunded'].includes(order.returnStatus)).length;
  const refundCompletedCount = allReturns.filter((order) => order.refundStatus === 'Completed').length;

  if (!filteredReturns.length) {
    returnsContainer.innerHTML = `
      <div class="stats-grid" style="margin-bottom: 12px;">
        <div class="stat-card">
          <h3>${pendingCount}</h3>
          <p>Pending returns</p>
        </div>
        <div class="stat-card">
          <h3>${completedCount}</h3>
          <p>Completed returns</p>
        </div>
        <div class="stat-card">
          <h3>${refundCompletedCount}</h3>
          <p>Refunds completed</p>
        </div>
      </div>
      <div class="empty-state"><h2>No return requests found</h2><p>Try another filter or check back later.</p></div>
    `;
    return;
  }

  if (isAdmin) {
    returnsContainer.innerHTML = `
      <div class="summary-card admin-dashboard">
        <h3>Support admin dashboard</h3>
        <p>Review, approve, reject, and confirm refunds for return requests.</p>
      </div>
      <div class="stats-grid" style="margin-bottom: 12px;">
        <div class="stat-card">
          <h3>${pendingCount}</h3>
          <p>Pending returns</p>
        </div>
        <div class="stat-card">
          <h3>${completedCount}</h3>
          <p>Completed returns</p>
        </div>
        <div class="stat-card">
          <h3>${refundCompletedCount}</h3>
          <p>Refunds completed</p>
        </div>
      </div>
    `;
  } else {
    returnsContainer.innerHTML = `
      <div class="stats-grid" style="margin-bottom: 12px;">
        <div class="stat-card">
          <h3>${pendingCount}</h3>
          <p>Pending returns</p>
        </div>
        <div class="stat-card">
          <h3>${completedCount}</h3>
          <p>Completed returns</p>
        </div>
        <div class="stat-card">
          <h3>${refundCompletedCount}</h3>
          <p>Refunds completed</p>
        </div>
      </div>
    `;
  }

  returnsContainer.innerHTML += `
    <div class="cart-list">
      ${filteredReturns.map((order) => `
        <div class="cart-item">
          <div>
            <strong>Order #${order.id}</strong>
            <p>${new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>Reason:</strong> ${order.returnReason || 'No reason provided'}</p>
          </div>
          <div>
            <p><span class="${getBadgeClass(order.returnStatus)}">${order.returnStatus}</span></p>
            <p><strong>Refund:</strong> ${order.refundStatus || 'Pending'}</p>
            <p><strong>Latest note:</strong> ${(order.returnHistory && order.returnHistory.length ? order.returnHistory[order.returnHistory.length - 1].note : order.returnReason || 'No note yet')}</p>
            ${isAdmin ? `<div class="detail-actions" style="margin-top: 8px;">
              <button class="btn-secondary action-btn" data-action="approve" data-id="${order.id}">Approve</button>
              <button class="btn-secondary action-btn" data-action="reject" data-id="${order.id}">Reject</button>
              <button class="btn-secondary action-btn" data-action="refund" data-id="${order.id}">Refund</button>
            </div>` : ''}
            <a class="view-link" href="order-details.html?id=${order.id}">View order</a>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  if (isAdmin) {
    document.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const response = await fetch(`http://localhost:3001/api/orders/${button.dataset.id}/return`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: button.dataset.action }),
        });
        if (response.ok) {
          if (button.dataset.action === 'refund') {
            showToast('Refund completed');
          }
          loadReturns();
        }
      });
    });
  }
}

async function loadCurrentUser(token) {
  const response = await fetch('http://localhost:3001/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    currentUser = await response.json();
    if (adminBadge) {
      adminBadge.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
    }
    if (supportLink) {
      supportLink.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
    }
  }
}

async function loadReturns() {
  const token = localStorage.getItem('token');
  if (!token) {
    returnsContainer.innerHTML = '<div class="empty-state"><h2>Please log in to manage returns</h2></div>';
    return;
  }

  await loadCurrentUser(token);
  const response = await fetch('http://localhost:3001/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    returnsContainer.innerHTML = '<div class="empty-state"><h2>Unable to load returns</h2></div>';
    return;
  }

  const orders = await response.json();
  allReturns = orders.filter((order) => order.returnStatus);
  renderReturns();
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    activeFilter = button.dataset.filter;
    renderReturns();
  });
});

loadCartCount();
loadReturns();
