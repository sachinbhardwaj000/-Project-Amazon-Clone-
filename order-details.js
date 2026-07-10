const cartCount = document.getElementById('cart-count');
const orderDetails = document.getElementById('order-details');
let currentUser = null;

function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadCartCount() {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3001/api/cart', {
    headers: { Authorization: `Bearer ${token}` },
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
  if (response.ok) {
    currentUser = await response.json();
  }
}

async function loadOrder() {
  const token = localStorage.getItem('token');
  const id = getOrderId();

  if (!token || !id) {
    orderDetails.innerHTML = '<div class="empty-state"><h2>Order not found</h2></div>';
    return;
  }

  await loadCurrentUser(token);
  const response = await fetch(`http://localhost:3001/api/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    orderDetails.innerHTML = '<div class="empty-state"><h2>Order not found</h2></div>';
    return;
  }

  const order = await response.json();
  const statusClass = order.status === 'Delivered' ? 'delivered' : order.status === 'Shipped' ? 'shipped' : 'processing';
  const returnLabel = order.returnStatus ? `${order.returnStatus}` : 'No return requested';
  const refundLabel = order.refundStatus || 'Pending';
  const isAdmin = currentUser?.role === 'admin';
  const historyEntries = Array.isArray(order.returnHistory) ? order.returnHistory : [];
  const adminHighlight = isAdmin ? '<div class="admin-highlight">Support admin view · review and manage this return.</div>' : '';
  const refundConfirmation = order.refundStatus === 'Completed'
    ? '<div class="refund-confirmation">Refund completed and confirmed.</div>'
    : '';
  const historyMarkup = historyEntries.length
    ? `<ul class="history-list">${historyEntries.map((entry) => `<li><strong>${entry.action}</strong> — ${entry.note || 'No note'}<br><span>${new Date(entry.createdAt).toLocaleString()}</span></li>`).join('')}</ul>`
    : '<p>No return history yet.</p>';

  orderDetails.innerHTML = `
    ${adminHighlight}
    <div class="status-card ${statusClass}">
      <h2>Order #${order.id}</h2>
      <p><strong>Status:</strong> ${order.status || 'Processing'}</p>
      <p><strong>Placed:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
      <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
      <p><strong>Return:</strong> ${returnLabel}</p>
      <p><strong>Refund:</strong> ${refundLabel}</p>
      ${refundConfirmation}
    </div>

    <div class="cart-list">
      ${order.items.map((item) => `<div class="cart-item"><div><strong>${item.name}</strong></div><div>Qty: ${item.quantity}</div></div>`).join('')}
    </div>

    <div class="summary-card" style="margin-top: 16px;">
      <h3>Shipping</h3>
      <p>${order.shippingAddress?.line || ''}</p>
      <p>${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zip || ''}</p>
    </div>

    <div class="detail-actions">
      <button class="add-btn" id="status-btn">Advance Status</button>
      <button class="btn-secondary" id="return-btn">Request Return</button>
      ${isAdmin ? '<button class="btn-secondary" id="approve-btn">Approve Return</button><button class="btn-secondary" id="reject-btn">Reject Return</button><button class="btn-secondary" id="refund-btn">Issue Refund</button>' : ''}
    </div>

    <div class="summary-card" style="margin-top: 16px;">
      <h3>Return reason</h3>
      <textarea id="return-reason" rows="3" placeholder="Tell us why you want to return this order"></textarea>
    </div>

    <div class="summary-card" style="margin-top: 16px;">
      <h3>Return history</h3>
      ${historyMarkup}
    </div>
  `;

  document.getElementById('status-btn').addEventListener('click', async () => {
    const nextStatus = order.status === 'Processing' ? 'Shipped' : order.status === 'Shipped' ? 'Delivered' : 'Delivered';
    const response = await fetch(`http://localhost:3001/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const updatedOrder = await response.json();
    const updatedStatusClass = updatedOrder.status === 'Delivered' ? 'delivered' : updatedOrder.status === 'Shipped' ? 'shipped' : 'processing';
    orderDetails.querySelector('.status-card').className = `status-card ${updatedStatusClass}`;
    orderDetails.querySelector('.status-card').innerHTML = `
      <h2>Order #${updatedOrder.id}</h2>
      <p><strong>Status:</strong> ${updatedOrder.status || 'Processing'}</p>
      <p><strong>Placed:</strong> ${new Date(updatedOrder.createdAt).toLocaleString()}</p>
      <p><strong>Total:</strong> $${updatedOrder.total.toFixed(2)}</p>
      <p><strong>Return:</strong> ${updatedOrder.returnStatus ? `Return: ${updatedOrder.returnStatus}` : 'No return requested'}</p>
    `;
  });

  document.getElementById('return-btn').addEventListener('click', async () => {
    const reason = document.getElementById('return-reason').value.trim() || 'Customer requested a return';
    const response = await fetch(`http://localhost:3001/api/orders/${id}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (response.ok) {
      const updatedOrder = await response.json();
      updateOrderCard(updatedOrder);
    }
  });

  if (isAdmin) {
    document.getElementById('approve-btn').addEventListener('click', async () => {
      const response = await fetch(`http://localhost:3001/api/orders/${id}/return`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        updateOrderCard(updatedOrder);
      }
    });

    document.getElementById('reject-btn').addEventListener('click', async () => {
      const response = await fetch(`http://localhost:3001/api/orders/${id}/return`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        updateOrderCard(updatedOrder);
      }
    });

    document.getElementById('refund-btn').addEventListener('click', async () => {
      const response = await fetch(`http://localhost:3001/api/orders/${id}/return`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'refund' }),
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        updateOrderCard(updatedOrder);
      }
    });
  }
}

function updateOrderCard(updatedOrder) {
  const statusClass = updatedOrder.status === 'Delivered' ? 'delivered' : updatedOrder.status === 'Shipped' ? 'shipped' : 'processing';
  const refundConfirmation = updatedOrder.refundStatus === 'Completed'
    ? '<div class="refund-confirmation">Refund completed and confirmed.</div>'
    : '';
  const historyEntries = Array.isArray(updatedOrder.returnHistory) ? updatedOrder.returnHistory : [];
  const historyMarkup = historyEntries.length
    ? `<ul class="history-list">${historyEntries.map((entry) => `<li><strong>${entry.action}</strong> — ${entry.note || 'No note'}<br><span>${new Date(entry.createdAt).toLocaleString()}</span></li>`).join('')}</ul>`
    : '<p>No return history yet.</p>';

  orderDetails.querySelector('.status-card').className = `status-card ${statusClass}`;
  orderDetails.querySelector('.status-card').innerHTML = `
    <h2>Order #${updatedOrder.id}</h2>
    <p><strong>Status:</strong> ${updatedOrder.status || 'Processing'}</p>
    <p><strong>Placed:</strong> ${new Date(updatedOrder.createdAt).toLocaleString()}</p>
    <p><strong>Total:</strong> $${updatedOrder.total.toFixed(2)}</p>
    <p><strong>Return:</strong> ${updatedOrder.returnStatus || 'No return requested'}</p>
    <p><strong>Refund:</strong> ${updatedOrder.refundStatus || 'Pending'}</p>
    ${refundConfirmation}
  `;
  const historyContainer = orderDetails.querySelectorAll('.summary-card')[1];
  if (historyContainer) {
    historyContainer.innerHTML = `<h3>Return history</h3>${historyMarkup}`;
  }
}

loadCartCount();
loadOrder();
