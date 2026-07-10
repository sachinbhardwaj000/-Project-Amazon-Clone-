const cartCount = document.getElementById('cart-count');
const ordersContainer = document.getElementById('orders-container');

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

async function loadOrders() {
  const token = localStorage.getItem('token');
  if (!token) {
    ordersContainer.innerHTML = '<div class="empty-state"><h2>Please log in to view order history</h2><p><a href="auth.html">Sign in</a> to continue.</p></div>';
    return;
  }

  const response = await fetch('http://localhost:3001/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    ordersContainer.innerHTML = '<div class="empty-state"><h2>Unable to load orders</h2></div>';
    return;
  }

  const orders = await response.json();
  if (!orders.length) {
    ordersContainer.innerHTML = '<div class="empty-state"><h2>No orders yet</h2><p>Your purchased items will appear here.</p></div>';
    return;
  }

  ordersContainer.innerHTML = `
    <h2>Your Orders</h2>
    <div class="cart-list">
      ${orders
        .map(
          (order) => `
            <div class="cart-item">
              <div>
                <strong>Order #${order.id}</strong>
                <p>${new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p>Total: $${order.total.toFixed(2)}</p>
                <p>${order.items.length} item(s)</p>
                <p>Status: <strong>${order.status || 'Processing'}</strong></p>
                <p>${order.shippingAddress?.line || ''} ${order.shippingAddress?.city || ''}</p>
                <a class="view-link" href="order-details.html?id=${order.id}">View details</a>
              </div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

loadCartCount();
loadOrders();
