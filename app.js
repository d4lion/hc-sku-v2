const state = {
    products: [],
    selectedSkus: new Set(),
    user: null
};

// Login Elements
const loginWall = document.getElementById('login-wall');
const appWrapper = document.getElementById('app-wrapper');
const empIdInput = document.getElementById('emp-id-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const welcomeMessage = document.getElementById('welcome-message');

// DOM Elements
const skuInput = document.getElementById('sku-input');
const addBtn = document.getElementById('add-btn');
const openAddBtn = document.getElementById('open-add-btn');
const deleteBtn = document.getElementById('delete-btn');
const exportBtn = document.getElementById('export-btn');
const productTable = document.getElementById('product-table');
const productList = document.getElementById('product-list');
const selectAll = document.getElementById('select-all');
const emptyState = document.getElementById('empty-state');
const statTotal = document.getElementById('stat-total');
const statAvgValue = document.getElementById('stat-avg-value');
const statStock = document.getElementById('stat-stock');
const statService = document.getElementById('stat-service');
const productCount = document.getElementById('product-count');

// Modals
const productModal = document.getElementById('product-modal');
const modalBody = document.getElementById('modal-body');

const addModal = document.getElementById('add-modal');
const bulkSkusInput = document.getElementById('bulk-skus');
const submitAddBtn = document.getElementById('submit-add-btn');

const importStatusModal = document.getElementById('import-status-modal');
const importStatusList = document.getElementById('import-status-list');
const closeImportBtn = document.getElementById('close-import-btn');

const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

// Create Loading Overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = '<i class="ph ph-spinner-gap size-48 spinner"></i><p>Procesando...</p>';
document.body.appendChild(loadingOverlay);

// Authentication Logic
async function handleLogin() {
    const empId = empIdInput.value.trim();
    if (!empId) return;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="ph ph-spinner-gap spin-anim"></i> Validando...';
    loginError.classList.add('hidden');

    try {
        // Simulando delay de red
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Bypass API por problemas de CORS en navegador
        state.user = { 
            nombres: 'Asesor', 
            apellidos: empId, 
            nombreCargo: 'VENDEDOR' 
        };
        
        welcomeMessage.textContent = `Hola, ${state.user.nombres} ID: ${state.user.apellidos}`;
        
        loginWall.classList.add('hidden');
        appWrapper.classList.remove('hidden');
    } catch (error) {
        console.error('Login Error:', error);
        loginError.textContent = `Error: ${error.message}`;
        loginError.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Ingresar <i class="ph ph-sign-in"></i>';
    }
}

loginBtn.addEventListener('click', handleLogin);
empIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
});

// Event Listeners for Adding
openAddBtn.addEventListener('click', () => {
    bulkSkusInput.value = '';
    addModal.classList.add('show');
    bulkSkusInput.focus();
});

document.querySelectorAll('.add-close').forEach(btn => {
    btn.addEventListener('click', () => addModal.classList.remove('show'));
});

closeImportBtn.addEventListener('click', () => {
    importStatusModal.classList.remove('show');
});

addBtn.addEventListener('click', () => {
    const term = skuInput.value.trim();
    if (term) handleSingleAdd(term);
});

skuInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const term = skuInput.value.trim();
        if (term) handleSingleAdd(term);
    }
});

submitAddBtn.addEventListener('click', () => {
    const term = bulkSkusInput.value.trim();
    if (term) {
        const skus = [...new Set(term.split(/[\s,]+/).filter(Boolean))]; // Remove array duplicates to avoid double fetching in same list
        if (skus.length > 0) handleBulkAdd(skus);
    }
});

// Global close for modals via background click or close buttons
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
        this.closest('.modal').classList.remove('show');
    });
});

window.addEventListener('click', (e) => {
    // Only close specific modals by clicking outside (don't close import status modal during load)
    if (e.target.classList.contains('modal') && e.target.id !== 'import-status-modal') {
        e.target.classList.remove('show');
    }
});

// Table actions
deleteBtn.addEventListener('click', deleteSelected);
exportBtn.addEventListener('click', exportToCSV);
selectAll.addEventListener('change', (e) => {
    if (e.target.checked) {
        state.products.forEach(p => state.selectedSkus.add(p.sku));
    } else {
        state.selectedSkus.clear();
    }
    renderDashboard();
});

// Reusable Custom Alert & Confirm Modals
function customAlert(msg) {
    return new Promise(resolve => {
        alertMessage.textContent = msg;
        alertModal.classList.add('show');
        const onOk = () => {
            alertModal.classList.remove('show');
            alertOkBtn.removeEventListener('click', onOk);
            resolve();
        };
        alertOkBtn.addEventListener('click', onOk);
    });
}

function customConfirm(msg) {
    return new Promise(resolve => {
        confirmMessage.textContent = msg;
        confirmModal.classList.add('show');
        const cleanup = (val) => {
            confirmModal.classList.remove('show');
            confirmOkBtn.removeEventListener('click', onOk);
            confirmCancelBtn.removeEventListener('click', onCancel);
            resolve(val);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        
        confirmOkBtn.addEventListener('click', onOk);
        confirmCancelBtn.addEventListener('click', onCancel);
    });
}

// Helper formatting functions
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
};

const parsePriceToNumber = (priceString) => {
    if (!priceString) return 0;
    const cleanStr = priceString.replace(/\./g, '').split(',')[0];
    return parseInt(cleanStr, 10) || 0;
};

// Abstracted Product Fetcher
async function fetchProduct(sku) {
    if (state.products.find(p => p.sku === sku)) return { error: 'Ya existe en la lista' };
    try {
        const [infoRes, imagesRes, stockRes] = await Promise.all([
            fetch(`https://www.homecenter.com.co/s/products/v1/soco?productId=${sku}&variantId=${sku}&zoneId=166&priceGroup=1`),
            fetch(`https://sellercenter.falabella-marketplace.services/media-service/v1/reference/cached/${sku}?businessUnit=sodimac&country=CO`),
            fetch(`https://www.homecenter.com.co/s/products/v1/soco/zone-facility?variantId=${sku}&zoneId=2`)
        ]);
        
        if (!infoRes.ok) return { error: 'El SKU no existe' };
        
        const infoData = await infoRes.json();
        
        // Validation check to avoid crashing and prevent non-existent products
        if (!infoData || !infoData.result || !infoData.result.name) {
            return { error: 'Producto no encontrado en la base de datos' };
        }

        const imagesData = imagesRes.ok ? await imagesRes.json() : { result: [] };
        const stockData = stockRes.ok ? await stockRes.json() : { result: [] };
        
        const productInfo = processProductData(sku, infoData, imagesData, stockData);
        if (!productInfo) return { error: 'Datos incompletos' };
        
        return { success: true, data: productInfo };
    } catch (error) {
        console.error(`Error fetching product ${sku}:`, error);
        return { error: 'Error de red / API' };
    }
}

// Adds a single product with an overlay and alert
async function handleSingleAdd(sku) {
    skuInput.value = '';
    loadingOverlay.classList.add('show');
    
    const result = await fetchProduct(sku);
    
    loadingOverlay.classList.remove('show');
    
    if (result.success) {
        state.products.push(result.data);
        renderDashboard();
    } else {
        await customAlert(`No se pudo agregar el producto ${sku}: ${result.error}`);
    }
}

// Adds multiple products with a detailed modal
async function handleBulkAdd(skus) {
    addModal.classList.remove('show');
    importStatusList.innerHTML = '';
    closeImportBtn.disabled = true;
    closeImportBtn.textContent = 'Procesando...';
    importStatusModal.classList.add('show');
    
    // Render initial list
    skus.forEach(sku => {
        const div = document.createElement('div');
        div.className = 'import-item';
        div.id = `import-${sku}`;
        div.innerHTML = `
            <span class="sku">Código ${sku}</span>
            <span class="status pending"><i class="ph ph-clock"></i> Pendiente</span>
        `;
        importStatusList.appendChild(div);
    });

    let addedCount = 0;
    
    // Process the fetch requests in parallel
    await Promise.all(skus.map(async (sku) => {
        const itemDom = document.getElementById(`import-${sku}`);
        const statusEl = itemDom.querySelector('.status');
        
        statusEl.className = 'status loading';
        statusEl.innerHTML = '<i class="ph ph-spinner-gap spin-anim"></i> Cargando...';
        
        const result = await fetchProduct(sku);
        
        if (result.success) {
            state.products.push(result.data);
            addedCount++;
            statusEl.className = 'status success';
            statusEl.innerHTML = '<i class="ph ph-check-circle"></i> Agregado';
        } else {
            statusEl.className = 'status error';
            statusEl.innerHTML = `<i class="ph ph-x-circle"></i> ${result.error}`;
        }
    }));

    if (addedCount > 0) renderDashboard();
    
    closeImportBtn.disabled = false;
    closeImportBtn.textContent = 'Cerrar ventana';
}

function processProductData(sku, info, images, stock) {
    if (!info || !info.result) return null;
    const pInfo = info.result;
    
    let priceItem = null;
    if (pInfo.variants && pInfo.variants[0] && pInfo.variants[0].price) {
        priceItem = pInfo.variants[0].price.find(p => p.type === 'INTERNET') || pInfo.variants[0].price[0];
    }
    const priceStr = priceItem ? priceItem.price : '0';
    const numPrice = parsePriceToNumber(priceStr);

    let category = 'General';
    if (pInfo.breadcrumbs && pInfo.breadcrumbs.length > 0) {
        const nonRoot = pInfo.breadcrumbs.filter(b => !b.isRootCategory);
        if (nonRoot.length > 0) category = nonRoot[0].name;
        else category = pInfo.breadcrumbs[0].name;
    }

    const imageUrls = [];
    if (images.result && images.result.length > 0) {
        images.result.forEach(img => imageUrls.push(img.media_url));
    } else if (pInfo.variants && pInfo.variants[0] && pInfo.variants[0].images) {
         pInfo.variants[0].images.forEach(img => imageUrls.push(img.url));
    }

    let totalStock = 0;
    const stores = [];
    let maxStoreStock = 0;
    if (stock.result && Array.isArray(stock.result)) {
        stock.result.forEach(s => {
             totalStock += (s.quantity || 0);
             if (s.quantity > maxStoreStock) maxStoreStock = s.quantity;
             stores.push({ name: s.storeName, qty: s.quantity });
        });
    }

    let hasService = false;
    let services = [];
    
    if (pInfo.serviceDetails && Array.isArray(pInfo.serviceDetails) && pInfo.serviceDetails.length > 0) {
        hasService = true;
        pInfo.serviceDetails.forEach(svc => {
            let sPrice = "No disponible";
            let sName = "Servicio";
            const sId = svc.id || '';
            
            if (svc.price && svc.price.length > 0) {
                const normPrice = svc.price.find(p => p.type === 'NORMAL') || svc.price[0];
                if (normPrice) sPrice = `${normPrice.symbol} ${normPrice.price}`;
            }

            if (svc.variants && svc.variants.length > 0 && svc.variants[0].attributes) {
                const nameAttr = svc.variants[0].attributes.find(a => a.name === "installation_service_name" || a.name === "installation_service_description");
                if (nameAttr && nameAttr.values && nameAttr.values.length > 0) {
                    sName = nameAttr.values[0];
                } else {
                    sName = `Servicio`;
                }
            }
            
            services.push({ name: sName, price: sPrice, id: sId });
        });
    }

    let displayAttributes = [];
    const attrSource = (pInfo.variants && pInfo.variants[0] && pInfo.variants[0].attributes) 
                        ? pInfo.variants[0].attributes 
                        : (pInfo.attributes || []);
    
    attrSource.forEach(attr => {
        if (attr.name && attr.values && attr.values.length > 0 && 
            !attr.name.includes('_') && attr.name !== "Garantía" && attr.group !== "BackendInfo" && attr.group !== "BUCore") {
            displayAttributes.push({
                name: attr.name,
                value: attr.values[0]
            });
        }
    });

    return { 
        sku, 
        name: pInfo.name, 
        category, 
        priceStr, 
        numPrice, 
        stock: totalStock, 
        stores, 
        maxStoreStock: maxStoreStock || 100,
        images: imageUrls, 
        hasService, 
        services, 
        attributes: displayAttributes,
        rawInfo: pInfo 
    };
}

function toggleSelection(sku) {
    if (state.selectedSkus.has(sku)) {
        state.selectedSkus.delete(sku);
        selectAll.checked = false;
    } else {
        state.selectedSkus.add(sku);
        if (state.selectedSkus.size === state.products.length && state.products.length > 0) {
            selectAll.checked = true;
        }
    }
    renderDashboard();
}

async function deleteSelected() {
    if (state.selectedSkus.size === 0) return;
    
    const isConfirmed = await customConfirm(`¿Estás seguro de que deseas eliminar ${state.selectedSkus.size} productos seleccionados?`);
    if (isConfirmed) {
        state.products = state.products.filter(p => !state.selectedSkus.has(p.sku));
        state.selectedSkus.clear();
        selectAll.checked = false;
        renderDashboard();
    }
}

window.deleteProduct = async (sku) => {
    const isConfirmed = await customConfirm(`¿Eliminar de la lista el producto ${sku}?`);
    if (isConfirmed) {
        state.products = state.products.filter(p => p.sku !== sku);
        state.selectedSkus.delete(sku);
        renderDashboard();
    }
};

async function exportToCSV() {
    if (state.products.length === 0) {
        await customAlert('No hay productos para exportar.');
        return;
    }
    
    const headers = ['SKU', 'Nombre', 'Categoria', 'Precio', 'Stock', 'Tiene Servicio'];
    const rows = state.products.map(p => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.numPrice,
        p.stock,
        p.hasService ? 'Si' : 'No'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_homecenter_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderDashboard() {
    productCount.textContent = state.products.length;
    statTotal.textContent = state.products.length;
    
    let sumPrice = 0;
    let sumStock = 0;
    let sumService = 0;
    
    state.products.forEach(p => {
        sumPrice += p.numPrice;
        sumStock += p.stock;
        if (p.hasService) sumService++;
    });

    const avgPrice = state.products.length > 0 ? sumPrice / state.products.length : 0;
    statAvgValue.textContent = formatCurrency(avgPrice);
    statStock.textContent = sumStock.toLocaleString();
    statService.textContent = sumService;

    deleteBtn.style.display = state.selectedSkus.size > 0 ? 'inline-flex' : 'none';
    
    if (state.products.length === 0) selectAll.checked = false;

    if (state.products.length === 0) {
        emptyState.classList.remove('hidden');
        productTable.style.display = 'none';
    } else {
        emptyState.classList.add('hidden');
        productTable.style.display = 'table';
        
        productList.innerHTML = '';
        state.products.forEach(product => {
            const tr = document.createElement('tr');
            const isChecked = state.selectedSkus.has(product.sku);
            
            let stockBadge = '';
            if (product.stock > 50) stockBadge = '<span class="badge badge-green"><span class="dot dot-green"></span> En stock</span>';
            else if (product.stock > 0) stockBadge = '<span class="badge badge-yellow"><span class="dot dot-yellow"></span> Stock medio</span>';
            else stockBadge = '<span class="badge badge-gray">Agotado</span>';

            const serviceBadge = product.hasService ? '<span class="badge badge-green">Con servicio</span>' : '<span class="badge badge-outline">Sin servicio</span>';

            tr.innerHTML = `
                <td><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelection('${product.sku}')"></td>
                <td class="code-cell">${product.sku}</td>
                <td class="product-cell">${product.name}</td>
                <td><span class="badge badge-outline">${product.category}</span></td>
                <td class="price-cell">$ ${product.priceStr}</td>
                <td>${stockBadge}</td>
                <td>${serviceBadge}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="viewProduct('${product.sku}')" title="Ver detalle">
                            <i class="ph ph-eye"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteProduct('${product.sku}')" title="Eliminar">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            productList.appendChild(tr);
        });
    }
}

window.toggleSelection = toggleSelection;

window.viewProduct = (sku) => {
    const product = state.products.find(p => p.sku === sku);
    if (!product) return;

    let imagesHtml = '';
    if (product.images.length > 0) {
        const fallBackImage = product.images[0];
        imagesHtml = `
            <div class="modal-images">
                <img src="${fallBackImage}" alt="${product.name}" class="main-image" id="modal-main-img">
                <div class="thumbnail-grid">
                    ${product.images.map((url, i) => `
                        <img src="${url}" class="thumbnail ${i === 0 ? 'active' : ''}" onclick="document.getElementById('modal-main-img').src='${url}'; document.querySelectorAll('.thumbnail').forEach(t=>t.classList.remove('active')); this.classList.add('active');">
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        imagesHtml = `<div class="modal-images"><div class="main-image" style="display:flex; align-items:center; justify-content:center; color:#666;"><i class="ph ph-image size-48"></i></div></div>`;
    }

    let attributesHtml = '';
    if (product.attributes && product.attributes.length > 0) {
        attributesHtml = `
            <h3 class="modal-section-title">Ficha Técnica</h3>
            <div class="attributes-grid">
                ${product.attributes.map(attr => `
                    <div class="attr-item">
                        <span class="attr-name">${attr.name}</span>
                        <span class="attr-value">${attr.value}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    let storesHtml = '<p style="color:var(--text-secondary)">No hay datos de inventario por tienda.</p>';
    if (product.stores.length > 0) {
        const sortedStores = [...product.stores].sort((a,b) => b.qty - a.qty);
        
        storesHtml = `
            <h3 class="modal-section-title">Inventario por Tienda (Zona 2)</h3>
            <div class="store-list">
                ${sortedStores.map(s => {
                    const pct = Math.min(100, Math.max(2, (s.qty / product.maxStoreStock) * 100));
                    
                    let barClass = 'stock-med';
                    if (s.qty === 0) barClass = 'stock-low';
                    else if (s.qty > 50) barClass = 'stock-high';
                    else if (s.qty < 10) barClass = 'stock-low';

                    return `
                    <div class="store-item">
                        <div class="store-info-row">
                            <span class="store-name">${s.name}</span>
                            <span class="store-qty">${s.qty} und</span>
                        </div>
                        <div class="stock-bar-bg">
                            <div class="stock-bar-fill ${barClass}" style="width: ${s.qty === 0 ? 0 : pct}%;"></div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    let servicesHtml = '';
    if (product.hasService && product.services.length > 0) {
        servicesHtml = `
            <h3 class="modal-section-title">Servicios Asociados</h3>
            <div>
                ${product.services.map(s => `
                    <div class="service-item">
                        <div style="display: flex; flex-direction: column;">
                            <span class="service-name">${s.name}</span>
                            ${s.id ? `<span style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.8; margin-top: 2px;">Código Srv: ${s.id}</span>` : ''}
                        </div>
                        <span class="service-price">${s.price}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="modal-grid">
            ${imagesHtml}
            <div class="modal-info">
                <h2>${product.name}</h2>
                <span class="modal-sku">Código: ${product.sku}</span>
                <div class="modal-price">$ ${product.priceStr}</div>
                
                <div class="modal-stats">
                    <span class="badge badge-outline">${product.category}</span>
                    <span class="badge badge-green"><span class="dot dot-green"></span> ${product.stock} disponibles</span>
                </div>
                
                ${attributesHtml}
                ${servicesHtml}
                ${storesHtml}
            </div>
        </div>
    `;

    productModal.classList.add('show');
};

renderDashboard();
