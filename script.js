/* =========================================
   1. CONFIGURACIÓN Y ESTADO
   ========================================= */
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTrrs0j4fJFdjqFL4RPFr4O6YYupoTEgxKwuw8rMMqm2aP1AHJizeCzOzVV4Nt5jXZAuniHlBgbN4I/pub?gid=0&single=true&output=csv';
let cart = JSON.parse(localStorage.getItem('cart')) || [];

/* =========================================
   2. FUNCIONES DE DATOS (CSV)
   ========================================= */
function parseCSV(csvText) {
    csvText = csvText.replace(/^\uFEFF/, '');
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const splitCSVLine = (line) => {
        const result = [];
        let start = 0, inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) {
                result.push(line.substring(start, i).replace(/^"|"$/g, '').trim());
                start = i + 1;
            }
        }
        result.push(line.substring(start).replace(/^"|"$/g, '').trim());
        return result;
    };

    const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase());
    
    return lines.slice(1).map(line => {
        const values = splitCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });

        const getVal = (keywords) => {
            const key = headers.find(h => keywords.some(k => h.includes(k)));
            return key ? obj[key] : '';
        };

        const dispRaw = getVal(['disponibilidad']).toString().toLowerCase();
        const disponible = !(dispRaw === 'no' || dispRaw === 'agotado' || dispRaw === '0' || dispRaw === 'false' || dispRaw === '');

        return {
            id: getVal(['id']) || Math.random().toString(36).substr(2, 9),
            nombre: getVal(['nombre']) || 'Producto sin nombre',
            categoria: getVal(['categoria']) || 'General',
            imagen: getVal(['imagen', 'link']),
            precio: parseFloat(getVal(['precio']).replace(/[^0-9.-]+/g, '')) || 0,
            disponible: disponible,
            informacion: getVal(['informacion', 'descripcion']) || 'Sin información detallada.'
        };
    });
}

async function loadProducts() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error('Error en la red');
        const products = parseCSV(await response.text());
        renderCategories(products);
        renderProducts(products);
    } catch (error) {
        console.error('Error cargando productos:', error);
        document.getElementById('products-grid').innerHTML = '<p class="loading">Error al cargar los productos.</p>';
    }
}

/* =========================================
   3. RENDERIZADO
   ========================================= */
function renderCategories(products) {
    const categories = [...new Set(products.map(p => p.categoria))].filter(c => c);
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = `<li class="active" data-category="all">Todos</li>` + 
        categories.map(cat => `<li data-category="${cat}">${cat}</li>`).join('');

    categoryList.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', () => {
            categoryList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            renderProducts(products, item.dataset.category);
        });
    });
}

function renderProducts(products, filter = 'all') {
    const grid = document.getElementById('products-grid');
    const filtered = filter === 'all' ? products : products.filter(p => p.categoria === filter);
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="loading">No hay productos en esta categoría.</p>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const stockClass = product.disponible ? '' : 'out-of-stock';
        const btnText = product.disponible ? 'Agregar' : 'No Disponible';
        const btnDisabled = product.disponible ? '' : 'disabled';
        const imgSrc = product.imagen || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23333"/><text x="50%" y="50%" fill="%23999" text-anchor="middle" dy=".3em">Sin imagen</text></svg>';

        return `
        <article class="product-card glass ${stockClass}" data-id="${product.id}">
            <button class="info-toggle-btn" aria-label="Ver información">!</button>
            <img src="${imgSrc}" alt="${product.nombre}" class="product-image">
            
            <div class="product-basic-info">
                <h4>${product.nombre}</h4>
                <div class="price">$${product.precio.toFixed(2)}</div>
                <button class="btn-primary add-to-cart-btn" ${btnDisabled} data-name="${product.nombre}" data-price="${product.precio}">
                    ${btnText}
                </button>
            </div>

            <div class="product-expanded-info">
                <p>${product.informacion}</p>
            </div>
        </article>
        `;
    }).join('');

    grid.querySelectorAll('.info-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.product-card');
            if (!card.classList.contains('out-of-stock')) {
                card.classList.add('is-active');
            }
        });
    });

    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (card.classList.contains('is-active') && !e.target.classList.contains('add-to-cart-btn')) {
                card.classList.remove('is-active');
            }
        });
    });

    grid.querySelectorAll('.add-to-cart-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Animación de confirmación
            btn.classList.add('btn-added');
            btn.textContent = '✓ Agregado';
            setTimeout(() => {
                btn.classList.remove('btn-added');
                btn.textContent = 'Agregar';
            }, 500);

            addToCart(
                e.target.closest('.product-card').dataset.id,
                btn.dataset.name,
                parseFloat(btn.dataset.price)
            );
        });
    });
}

/* =========================================
   4. LÓGICA DEL CARRITO
   ========================================= */
function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
    saveCart();
}

function increaseQuantity(id) {
    const item = cart.find(item => item.id === id);
    if (item) {
        item.quantity += 1;
        updateCartUI();
        saveCart();
    }
}

function decreaseQuantity(id) {
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) {
            cart[itemIndex].quantity -= 1;
        } else {
            cart.splice(itemIndex, 1);
        }
        updateCartUI();
        saveCart();
    }
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
    saveCart();
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total-amount');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    cartCount.textContent = totalItems;
    cartTotal.textContent = `$${totalPrice.toFixed(2)}`;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-msg" style="text-align:center; padding: 20px; color: var(--text-muted);">El carrito está vacío.</p>';
        return;
    }

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-top">
                <div class="cart-item-info">
                    <h5>${item.name}</h5>
                    <p>$${item.price.toFixed(2)} c/u</p>
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}')">Eliminar</button>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="decreaseQuantity('${item.id}')">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="increaseQuantity('${item.id}')">+</button>
            </div>
        </div>
    `).join('');
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

/* =========================================
   5. INTERACCIÓN UI
   ========================================= */
const cartModal = document.getElementById('cart-modal');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart');

function openCart() { cartModal.classList.remove('hidden'); }
function closeCart() { cartModal.classList.add('hidden'); }

cartBtn.addEventListener('click', openCart);
closeCartBtn.addEventListener('click', closeCart);
cartModal.addEventListener('click', (e) => { if (e.target === cartModal) closeCart(); });

const carouselTrack = document.getElementById('carousel-track');
if (carouselTrack) carouselTrack.innerHTML += carouselTrack.innerHTML;

/* =========================================
   6. INICIALIZACIÓN
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    loadProducts();
});