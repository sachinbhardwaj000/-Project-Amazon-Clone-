const cartCount = document.getElementById('cart-count');
const toast = document.getElementById('toast');
const productGrid = document.getElementById('product-grid');
const adminBadge = document.getElementById('admin-badge');
const supportLink = document.getElementById('support-link');
const categoryButtons = document.querySelectorAll('.category-btn');
const searchInput = document.getElementById('header-search');
const featuredBanner = document.getElementById('category-featured-banner');
let count = 0;
let allProducts = [];
let currentCategory = 'all';
let currentSearch = '';
let visibleCount = 4;

function getCategoryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category') || 'all';
}

function setCategoryInUrl(category) {
  const params = new URLSearchParams(window.location.search);
  if (category === 'all') {
    params.delete('category');
  } else {
    params.set('category', category);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

const categoryMeta = {
  all: {
    title: 'All Products',
    message: 'Discover our most-loved picks across every category.',
  },
  Electronics: {
    title: 'Featured for Electronics',
    message: 'Smart tech, audio, and everyday essentials for modern living.',
  },
  Home: {
    title: 'Featured for Home',
    message: 'Comfort, style, and practical upgrades for your space.',
  },
  Fashion: {
    title: 'Featured for Fashion',
    message: 'Fresh staples and statement pieces for every day.',
  },
  Beauty: {
    title: 'Featured for Beauty',
    message: 'Skincare, fragrance, and wellness picks to refresh your routine.',
  },
};

function renderFeaturedBanner(category) {
  const meta = categoryMeta[category] || categoryMeta.all;
  featuredBanner.innerHTML = `
    <p class="eyebrow">Featured for this category</p>
    <h3>${meta.title}</h3>
    <p>${meta.message}</p>
  `;
}

function renderProducts(products) {
  const visibleProducts = products.slice(0, visibleCount);
  productGrid.innerHTML = `
    ${visibleProducts.map((product) => `
      <article class="product-card">
        <div class="product-image">
          <img class="product-card-image" src="${product.imageUrl || product.image}" alt="${product.name}" />
        </div>
        <h3>${product.name}</h3>
        <p>$${product.price.toFixed(2)}</p>
        <div class="card-actions">
          <a class="view-link" href="product.html?id=${product.id}">View details</a>
          <button class="add-btn" data-id="${product.id}" data-name="${product.name}">Add to Cart</button>
        </div>
      </article>
    `).join('')}
    ${products.length > visibleCount ? `<button class="show-more-btn" id="show-more-btn">Show more</button>` : ''}
  `;

  document.querySelectorAll('.add-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = button.dataset.id;
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const cart = await response.json();
      count = cart.reduce((sum, item) => sum + item.quantity, 0);
      cartCount.textContent = count;
      showToast(`${button.dataset.name} added to cart`);
    });
  });

  const showMoreButton = document.getElementById('show-more-btn');
  if (showMoreButton) {
    showMoreButton.addEventListener('click', () => {
      visibleCount += 4;
      renderProducts(products);
    });
  }
}

function filterProducts(category = currentCategory, searchTerm = currentSearch) {
  currentCategory = category;
  currentSearch = searchTerm;
  visibleCount = 4;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory = category === 'all' || product.category === category;
    const matchesSearch = !normalizedSearch || [product.name, product.description, product.category].some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesCategory && matchesSearch;
  });

  renderFeaturedBanner(category);

  if (!filteredProducts.length) {
    productGrid.innerHTML = '<div class="empty-state"><h3>No matches found</h3><p>Try another category or search term.</p></div>';
    return;
  }

  renderProducts(filteredProducts);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

async function loadProducts() {
  const response = await fetch('http://localhost:3001/api/products');
  allProducts = await response.json();
  filterProducts('all');
}

async function updateAdminBadge() {
  const token = localStorage.getItem('token');
  if (!token) {
    adminBadge.style.display = 'none';
    return;
  }

  const response = await fetch('http://localhost:3001/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    const user = await response.json();
    adminBadge.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    if (supportLink) {
      supportLink.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    }
  } else {
    adminBadge.style.display = 'none';
    if (supportLink) {
      supportLink.style.display = 'none';
    }
  }
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
  count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
}

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedCategory = button.dataset.category;
    categoryButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    setCategoryInUrl(selectedCategory);
    filterProducts(selectedCategory, currentSearch);
  });
});

const categoryTitle = document.querySelector('.categories h2');
if (categoryTitle) {
  categoryTitle.addEventListener('click', () => {
    categoryButtons.forEach((item) => item.classList.remove('active'));
    document.querySelector('.category-btn[data-category="all"]').classList.add('active');
    setCategoryInUrl('all');
    filterProducts('all', currentSearch);
  });
}

searchInput.addEventListener('input', (event) => {
  filterProducts(currentCategory, event.target.value);
});

const initialCategory = getCategoryFromUrl();
if (initialCategory !== 'all') {
  const activeButton = document.querySelector(`.category-btn[data-category="${initialCategory}"]`);
  if (activeButton) {
    categoryButtons.forEach((item) => item.classList.remove('active'));
    activeButton.classList.add('active');
  }
}

loadProducts();
loadCartCount();
updateAdminBadge();
