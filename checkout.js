const cartCount = document.getElementById('cart-count');
const checkoutContainer = document.getElementById('checkout-container');

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

async function loadCheckout() {
  const token = localStorage.getItem('token');
  if (!token) {
    checkoutContainer.innerHTML = '<div class="empty-state"><h2>Please log in to checkout</h2><p><a href="auth.html">Sign in</a> to continue.</p></div>';
    return;
  }

  const response = await fetch('http://localhost:3001/api/cart', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    checkoutContainer.innerHTML = '<div class="empty-state"><h2>Please log in to checkout</h2><p><a href="auth.html">Sign in</a> to continue.</p></div>';
    return;
  }

  const cart = await response.json();
  if (!cart.length) {
    checkoutContainer.innerHTML = '<div class="empty-state"><h2>Your cart is empty</h2><p>Add some items before checkout.</p></div>';
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  checkoutContainer.innerHTML = `
    <h2>Checkout</h2>
    <div class="cart-list">
      ${cart.map((item) => `<div class="cart-item"><div><strong>${item.name}</strong><p>Qty: ${item.quantity}</p></div><div>$${(item.price * item.quantity).toFixed(2)}</div></div>`).join('')}
    </div>
    <p style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">Total: $${total.toFixed(2)}</p>

    <form id="payment-form" class="summary-card" style="margin-top: 16px;">
      <h3>Shipping Address</h3>
      <input type="text" id="address-line" placeholder="Street address" required />
      <input type="text" id="city" placeholder="City" required />
      <input type="text" id="state" placeholder="State" required />
      <input type="text" id="zip" placeholder="ZIP code" required maxlength="6" />

      <h3 style="margin-top: 16px;">Payment Details</h3>
      <input type="text" id="card-name" placeholder="Name on card" required />
      <div class="card-preview">
        <div class="card-chip"></div>
        <div id="card-display">•••• •••• •••• ••••</div>
      </div>
      <input type="text" id="card-number" placeholder="Card number" required maxlength="19" />
      <div class="detail-actions">
        <input type="text" id="card-expiry" placeholder="MM/YY" required maxlength="5" />
        <input type="text" id="card-cvc" placeholder="CVC" required maxlength="4" />
      </div>
      <button class="add-btn" type="submit">Place Order</button>
    </form>
  `;

  const paymentForm = document.getElementById('payment-form');
  const cardNumberInput = document.getElementById('card-number');
  const cardDisplay = document.getElementById('card-display');

  cardNumberInput.addEventListener('input', (event) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = value.replace(/(.{4})/g, '$1 ').trim();
    event.target.value = formatted;
    cardDisplay.textContent = formatted || '•••• •••• •••• ••••';
  });

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const addressLine = document.getElementById('address-line').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();
    const zip = document.getElementById('zip').value.trim();
    const cardName = document.getElementById('card-name').value.trim();
    const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('card-expiry').value.trim();
    const cardCvc = document.getElementById('card-cvc').value.trim();

    if (!addressLine || !city || !state || !zip || !cardName || cardNumber.length < 12 || cardCvc.length < 3 || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      checkoutContainer.querySelector('#payment-form').insertAdjacentHTML('beforeend', '<p style="color:#b12704; margin-top:8px;">Please enter valid payment details.</p>');
      return;
    }

    const orderResponse = await fetch('http://localhost:3001/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        address: {
          line: addressLine,
          city,
          state,
          zip,
        },
        payment: {
          name: cardName,
          last4: cardNumber.slice(-4),
        },
      }),
    });

    const result = await orderResponse.json();
    if (!orderResponse.ok) {
      checkoutContainer.innerHTML = `<div class="empty-state"><h2>${result.message}</h2></div>`;
      return;
    }

    checkoutContainer.innerHTML = `
      <div class="empty-state" style="background: linear-gradient(135deg, #fef3c7, #fff);">
        <h2>✅ Order placed successfully!</h2>
        <p>Thank you for shopping with Amazon Clone.</p>
        <p>Order ID: ${result.id}</p>
        <p>Your items will arrive at ${addressLine}, ${city}, ${state} ${zip}.</p>
        <a class="add-btn" href="orders.html" style="display: inline-block; margin-top: 12px; text-decoration: none;">View Order History</a>
      </div>
    `;
    loadCartCount();
  });
}

loadCartCount();
loadCheckout();
