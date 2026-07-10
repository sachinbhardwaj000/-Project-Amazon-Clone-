const cartCount = document.getElementById('cart-count');
const cartContainer = document.getElementById('cart-container');

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
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
}

async function loadCart() {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3001/api/cart', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    cartContainer.innerHTML = '<div class="empty-state"><h2>Please log in to view your cart</h2><p><a href="auth.html">Sign in</a> to continue.</p></div>';
    return;
  }

  const cart = await response.json();

  if (!cart.length) {
    cartContainer.innerHTML = '<div class="empty-state"><h2>Your cart is empty</h2><p>Add some items to get started.</p></div>';
    return;
  }

  cartContainer.innerHTML = `
    <div class="summary-card">
      <h2>Your Cart</h2>
      <div class="cart-list">
        ${cart
          .map(
            (item) => `
              <div class="cart-item">
                <div>
                  <strong>${item.name}</strong>
                  <p>Qty: ${item.quantity}</p>
                </div>
                <div>
                  <p>$${(item.price * item.quantity).toFixed(2)}</p>
                  <button class="btn-secondary remove-btn" data-id="${item.id}">Remove</button>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
      <div class="detail-actions">
        <button class="add-btn" id="clear-cart">Clear Cart</button>
        <a class="btn-secondary" href="checkout.html">Proceed to Checkout</a>
      </div>
    </div>
  `;

  document.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await fetch(`http://localhost:3001/api/cart/${button.dataset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadCart();
      await loadCartCount();
    });
  });

  document.getElementById('clear-cart').addEventListener('click', async () => {
    await fetch('http://localhost:3001/api/cart', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadCart();
    await loadCartCount();
  });
}

loadCart();
loadCartCount();
