const cartCount = document.getElementById('cart-count');
const productDetail = document.getElementById('product-detail');

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
}

async function loadProduct() {
  const id = getProductId();
  if (!id) {
    productDetail.innerHTML = '<p>Product not found.</p>';
    return;
  }

  const response = await fetch(`http://localhost:3001/api/products/${id}`);
  const product = await response.json();

  if (!product || product.message) {
    productDetail.innerHTML = '<p>Product not found.</p>';
    return;
  }

  productDetail.innerHTML = `
    <div class="detail-image">${product.image}</div>
    <div>
      <h1>${product.name}</h1>
      <p>${product.description}</p>
      <p style="font-size: 28px; font-weight: 700; color: #b12704; margin-top: 12px;">$${product.price.toFixed(2)}</p>
      <div class="detail-actions">
        <button class="add-btn" data-id="${product.id}" data-name="${product.name}">Add to Cart</button>
        <a class="btn-secondary" href="cart.html">Go to Cart</a>
      </div>
    </div>
  `;

  productDetail.querySelector('.add-btn').addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3001/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
    });
    await loadCartCount();
  });
}

loadProduct();
loadCartCount();
