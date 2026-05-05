/**
 * CRM Casamento Perfeito - Core Logic (Versão Precisa)
 * Correção de precisão de moeda e integração direta com Supabase
 */

const { createClient } = window.supabase;
const supabase = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

// Estado Global
let appState = { services: [], suppliers: [], payments: [], settings: {} };

// ==================== UTILITÁRIOS FINANCEIROS ====================

// Formata moeda (R$ 1.234,56)
const formatCurrency = (val) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

// Garante precisão de 2 casas decimais (Evita o erro de 49.9999)
function preciseRound(num) {
  return Math.round(num * 100) / 100;
}

const formatDate = (dateStr) => 
  dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const getDaysLeft = (dateStr) => {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3 shadow`;
  toast.style.zIndex = '9999';
  toast.style.minWidth = '300px';
  toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'} me-2"></i>${message}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ==================== NAVEGAÇÃO ====================
function showSection(sectionId) {
  document.querySelectorAll('.section-box, .tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link, .nav-tab').forEach(el => el.classList.remove('active'));
  
  const target = document.getElementById(sectionId);
  if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  
  const navLink = document.querySelector(`[data-section="${sectionId}"], [data-tab="${sectionId}"]`);
  if (navLink) navLink.classList.add('active');
}

// ==================== CARREGAMENTO DE DADOS ====================
async function loadData() {
  try {
    console.log('🚀 Carregando dados do Supabase...');
    const [resSvc, resSup, resPay, resSet] = await Promise.all([
      supabase.from('services').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('wedding_settings').select('*').limit(1).single()
    ]);

    if (resSvc.error && resSvc.error.code !== 'PGRST116') throw new Error('Serviços: ' + resSvc.error.message);
    if (resPay.error && resPay.error.code !== 'PGRST116') throw new Error('Pagamentos: ' + resPay.error.message);

    appState.services = resSvc.data || [];
    appState.suppliers = resSup.data || [];
    appState.payments = resPay.data || [];
    appState.settings = resSet.data || {};

    console.log('✅ Dados carregados.');
    renderAll();
  } catch (error) {
    console.error('❌ Erro:', error);
    showToast('Erro ao conectar com banco: ' + error.message, 'danger');
  }
}

function renderAll() {
  renderDashboard();
  renderServices();
  renderSuppliers();
  renderPayments();
  renderBudget();
  renderSettings();
}

// ==================== RENDERIZAÇÃO ====================
function renderDashboard() {
  // Precisão total nos cálculos
  const totalServices = appState.services.reduce((sum, s) => preciseRound(sum + (parseFloat(s.value) || 0)), 0);
  const totalSuppliers = appState.suppliers.reduce((sum, s) => preciseRound(sum + (parseFloat(s.price) || 0)), 0);
  const totalBudget = preciseRound(parseFloat(appState.settings.budget_total || 0)) || preciseRound(totalServices + totalSuppliers);
  
  const totalPaid = preciseRound(
    appState.services.reduce((sum, s) => preciseRound(sum + (parseFloat(s.paid) || 0)), 0) + 
    appState.suppliers.reduce((sum, s) => preciseRound(sum + (parseFloat(s.paid) || 0)), 0)
  );
  
  const pending = preciseRound(totalBudget - totalPaid);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  
  setEl('dash-budget-total', formatCurrency(totalBudget));
  setEl('total-budget', formatCurrency(totalBudget));
  setEl('dash-paid-total', formatCurrency(totalPaid));
  setEl('total-paid', formatCurrency(totalPaid));
  setEl('dash-pending-total', formatCurrency(pending));
  setEl('total-pending', formatCurrency(pending));
  setEl('dash-days-left', getDaysLeft(appState.settings.wedding_date));
  
  if (appState.settings.wedding_date) {
    const dateEl = document.getElementById('wedding-date-display');
    if (dateEl) dateEl.textContent = `Até ${formatDate(appState.settings.wedding_date)}`;
  }

  // Último pagamento
  const lastPayment = appState.payments[0];
  if (lastPayment) {
    setEl('last-payment-amount', formatCurrency(lastPayment.amount));
    let entityName = 'Pagamento';
    if (lastPayment.entity_type === 'service') {
      const svc = appState.services.find(s => s.id === lastPayment.entity_id);
      if (svc) entityName = svc.name;
    } else {
      const sup = appState.suppliers.find(s => s.id === lastPayment.entity_id);
      if (sup) entityName = sup.name;
    }
    const metaEl = document.getElementById('last-payment-meta');
    if (metaEl) metaEl.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> ${lastPayment.description || entityName} • ${formatDate(lastPayment.payment_date)}`;
  }

  // Vencimentos
  const upcoming = appState.services
    .filter(s => s.due_date && (preciseRound(s.value || 0) > preciseRound(s.paid || 0)))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  const upList = document.getElementById('dash-upcoming');
  if (upList) {
    if (upcoming.length === 0) {
      upList.innerHTML = '<li class="list-group-item text-center text-muted py-3">Nenhum vencimento próximo</li>';
    } else {
      upList.innerHTML = upcoming.map(s => {
        const remaining = preciseRound((s.value || 0) - (s.paid || 0));
        return `<li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer" onclick="showSection('servicos')">
          <div><strong>${s.name}</strong><br><small class="text-muted">${formatDate(s.due_date)}</small></div>
          <span class="badge bg-danger">${formatCurrency(remaining)}</span>
        </li>`;
      }).join('');
    }
  }

  // Atividade
  const recent = appState.payments.slice(0, 5);
  const actList = document.getElementById('dash-activity');
  if (actList) {
    actList.innerHTML = recent.length ? recent.map(p => {
      let entityName = 'Item';
      if (p.entity_type === 'service') {
        const svc = appState.services.find(s => s.id === p.entity_id);
        if (svc) entityName = svc.name;
      } else {
        const sup = appState.suppliers.find(s => s.id === p.entity_id);
        if (sup) entityName = sup.name;
      }
      return `<li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer" onclick="showSection('pagamentos')">
        <div><strong>${p.description || entityName}</strong><br><small class="text-muted">${formatDate(p.payment_date)}</small></div>
        <span class="badge bg-success">${formatCurrency(p.amount)}</span>
      </li>`;
    }).join('') : '<li class="list-group-item text-center text-muted py-3">Nenhuma atividade recente</li>';
  }

  // Progresso
  const progress = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  const progEl = document.getElementById('dash-progress');
  if (progEl) {
    progEl.innerHTML = `
      <div class="progress mb-2" style="height: 10px;"><div class="progress-bar bg-success" style="width: ${progress}%"></div></div>
      <small class="text-muted">${formatCurrency(totalPaid)} de ${formatCurrency(totalBudget)} (${progress.toFixed(0)}%)</small>
    `;
  }
}

function renderServices() {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;
  
  if (appState.services.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Nenhum serviço cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = appState.services.map(s => {
    const value = preciseRound(s.value || 0);
    const paid = preciseRound(s.paid || 0);
    const remaining = preciseRound(value - paid);
    const percent = value > 0 ? preciseRound((paid / value) * 100) : 0;
    
    let statusClass = 'badge-pending', statusText = 'Pendente';
    if (remaining <= 0) { statusClass = 'badge-paid'; statusText = 'Pago'; }
    else if (paid > 0) { statusClass = 'badge-partial'; statusText = 'Parcial'; }

    const progressClass = percent === 100 ? 'progress-paid' : percent > 0 ? 'progress-partial' : 'progress-pending';

    return `
      <tr onclick="showServiceDetail(${s.id})" style="cursor: pointer;">
        <td class="fw-bold">${s.name}</td>
        <td><span class="badge bg-secondary">${s.category || '—'}</span></td>
        <td class="text-end">${formatCurrency(value)}</td>
        <td class="text-end text-success">${formatCurrency(paid)}</td>
        <td>
          <div class="progress" style="height: 6px;"><div class="progress-bar ${progressClass}" style="width: ${percent}%"></div></div>
          <small class="text-muted">${percent.toFixed(0)}%</small>
        </td>
        <td class="text-end fw-bold ${remaining > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(remaining)}</td>
        <td>${formatDate(s.due_date)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td class="text-end" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-success me-1" onclick="openPaymentForService(${s.id})" title="Pagar"><i class="bi bi-currency-dollar"></i></button>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="event.stopPropagation(); editService(${s.id})" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteService(${s.id})" title="Excluir"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSuppliers() {
  const container = document.getElementById('suppliers-container');
  if (!container) return;
  
  if (appState.suppliers.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-hourglass-split fs-1 d-block mb-2"></i>Nenhum fornecedor cadastrado</div>';
    return;
  }

  container.innerHTML = appState.suppliers.map(s => {
    const price = preciseRound(s.price || 0);
    const paid = preciseRound(s.paid || 0);
    const remaining = preciseRound(price - paid);
    
    return `
      <div class="col-lg-4 col-md-6">
        <div class="card h-100 cursor-pointer" onclick="showSupplierDetail(${s.id})">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${s.name}</h5>
              <div class="btn-group">
                <button class="btn btn-sm btn-light" onclick="event.stopPropagation(); editSupplier(${s.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-light text-danger" onclick="event.stopPropagation(); deleteSupplier(${s.id})"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            <p class="text-muted mb-1">${s.category}</p>
            <h4 class="text-primary mb-2">${formatCurrency(price)}</h4>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small>Pago: <strong class="text-success">${formatCurrency(paid)}</strong></small>
              ${s.rating ? `<small>${'⭐'.repeat(parseInt(s.rating) || 0)}</small>` : ''}
            </div>
            ${remaining > 0 ? `<small class="text-danger">Restante: ${formatCurrency(remaining)}</small>` : '<small class="text-success"><i class="bi bi-check-circle me-1"></i>Quitado</small>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPayments() {
  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;
  
  if (appState.payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum pagamento registrado</td></tr>';
    return;
  }

  tbody.innerHTML = appState.payments.map(p => {
    let entityName = 'Item removido';
    if (p.entity_type === 'service') {
      const svc = appState.services.find(s => s.id === p.entity_id);
      if (svc) entityName = svc.name;
    } else {
      const sup = appState.suppliers.find(s => s.id === p.entity_id);
      if (sup) entityName = sup.name;
    }

    return `
      <tr onclick="showPaymentDetail(${p.id})" style="cursor: pointer;">
        <td>${formatDate(p.payment_date)}</td>
        <td><strong>${p.description || entityName}</strong><br><small class="text-muted">${entityName}</small></td>
        <td class="text-end fw-bold text-success">${formatCurrency(p.amount)}</td>
        <td><span class="badge bg-secondary">${(p.payment_method || '').toUpperCase()}</span></td>
        <td><span class="badge bg-success">${p.status}</span></td>
        <td>${p.receipt_number || '—'}</td>
        <td class="text-end" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-outline-danger" onclick="deletePayment(${p.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBudget() {
  const totalBudget = preciseRound(parseFloat(appState.settings.budget_total || 0));
  const totalSpent = preciseRound(
    appState.services.reduce((s, v) => preciseRound(s + (parseFloat(v.value) || 0)), 0) + 
    appState.suppliers.reduce((s, v) => preciseRound(s + (parseFloat(v.price) || 0)), 0)
  );
  const totalPaid = preciseRound(
    appState.services.reduce((s, v) => preciseRound(s + (parseFloat(v.paid) || 0)), 0) +
    appState.suppliers.reduce((s, v) => preciseRound(s + (parseFloat(v.paid) || 0)), 0)
  );

  const summaryEl = document.getElementById('budget-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <ul class="list-group list-group-flush">
        <li class="list-group-item d-flex justify-content-between"><span>Orçamento Definido</span><strong>${formatCurrency(totalBudget || totalSpent)}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Total Estimado</span><span>${formatCurrency(totalSpent)}</span></li>
        <li class="list-group-item d-flex justify-content-between text-success"><span>Total Pago</span><strong>${formatCurrency(totalPaid)}</strong></li>
        <li class="list-group-item d-flex justify-content-between text-danger"><span>Restante</span><strong>${formatCurrency(preciseRound(totalSpent - totalPaid))}</strong></li>
      </ul>
    `;
  }

  const categories = {};
  appState.services.forEach(s => {
    if (!categories[s.category]) categories[s.category] = { total: 0, paid: 0 };
    categories[s.category].total = preciseRound(categories[s.category].total + (parseFloat(s.value) || 0));
    categories[s.category].paid = preciseRound(categories[s.category].paid + (parseFloat(s.paid) || 0));
  });

  const catsEl = document.getElementById('budget-categories');
  if (catsEl) {
    catsEl.innerHTML = Object.keys(categories).map(cat => {
      const info = categories[cat];
      const pct = info.total > 0 ? (info.paid / info.total) * 100 : 0;
      return `<div class="mb-3">
        <div class="d-flex justify-content-between mb-1"><span class="fw-bold text-capitalize">${cat}</span><span>${formatCurrency(info.paid)} / ${formatCurrency(info.total)}</span></div>
        <div class="progress" style="height: 6px;"><div class="progress-bar bg-primary" style="width: ${pct}%"></div></div>
      </div>`;
    }).join('') || '<p class="text-muted text-center">Sem categorias</p>';
  }
}

function renderSettings() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('set-couple-name', appState.settings.couple_name);
  setVal('couple-name', appState.settings.couple_name);
  setVal('set-wedding-date', appState.settings.wedding_date);
  setVal('wedding-date', appState.settings.wedding_date);
  setVal('set-guest-count', appState.settings.guest_count);
  setVal('guest-count', appState.settings.guest_count);
  setVal('set-budget-total', appState.settings.budget_total);
  setVal('budget-total', appState.settings.budget_total);
  setVal('set-theme', appState.settings.theme);
  setVal('wedding-theme', appState.settings.theme);
  setVal('set-location', appState.settings.location);
  setVal('wedding-location', appState.settings.location);
}

// ==================== MODAIS & LÓGICA DE PAGAMENTO PRECISA ====================
function openModal(type, id = null) {
  let modalId, titleId;
  if (type === 'service') { modalId = 'serviceModal'; titleId = 'serviceModalTitle'; }
  else if (type === 'supplier') { modalId = 'supplierModal'; titleId = 'supplierModalTitle'; }
  else if (type === 'payment') { modalId = 'paymentModal'; }

  if (titleId) {
    const titleEl = document.getElementById(titleId);
    if (titleEl) titleEl.textContent = id ? `Editar ${type === 'service' ? 'Serviço' : 'Fornecedor'}` : `Adicionar ${type === 'service' ? 'Serviço' : 'Fornecedor'}`;
  }

  const modal = new bootstrap.Modal(document.getElementById(modalId));
  modal.show();

  if (id) fillForm(type, id);
  if (type === 'payment') populatePaymentSelects();
}

function closeModal(modalId) {
  const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
  if (modal) { modal.hide(); const form = document.getElementById(modalId.replace('Modal', '-form')); if (form) form.reset(); }
}

function populatePaymentSelects() {
  const type = document.getElementById('pay-type')?.value;
  const select = document.getElementById('pay-item');
  const infoBox = document.getElementById('payment-info-box');
  
  if (!select) return;
  select.innerHTML = '<option value="">Selecione um item</option>';
  if (!type) { if (infoBox) infoBox.style.display = 'none'; return; }

  let items = [];
  if (type === 'service') {
    items = appState.services.filter(s => preciseRound(s.value || 0) > preciseRound(s.paid || 0));
    items.forEach(item => {
      const remaining = preciseRound(item.value - item.paid);
      select.innerHTML += `<option value="service-${item.id}" data-remaining="${remaining}">${item.name} (${item.category}) - Restante: ${formatCurrency(remaining)}</option>`;
    });
  } else if (type === 'supplier') {
    items = appState.suppliers.filter(s => preciseRound(s.price || 0) > preciseRound(s.paid || 0));
    items.forEach(item => {
      const remaining = preciseRound(item.price - item.paid);
      select.innerHTML += `<option value="supplier-${item.id}" data-remaining="${remaining}">${item.name} (${item.category}) - Restante: ${formatCurrency(remaining)}</option>`;
    });
  }

  if (items.length === 0) select.innerHTML = '<option value="">Nenhum item pendente</option>';
  select.onchange = updatePaymentInfo;
}

function updatePaymentInfo() {
  const select = document.getElementById('pay-item');
  const infoBox = document.getElementById('payment-info-box');
  const amountInput = document.getElementById('pay-amount');
  const amountHint = document.getElementById('pay-amount-hint');
  
  if (!select || !select.value || select.value.includes('Nenhum')) {
    if (infoBox) infoBox.style.display = 'none';
    if (amountInput) { amountInput.disabled = true; if (amountHint) amountHint.textContent = ''; }
    return;
  }

  const [type, idStr] = select.value.split('-');
  const id = parseInt(idStr);
  
  let item = null, total = 0, paid = 0, remaining = 0;

  if (type === 'service') {
    item = appState.services.find(s => s.id === id);
    if (item) { total = preciseRound(item.value || 0); paid = preciseRound(item.paid || 0); remaining = preciseRound(total - paid); }
  } else if (type === 'supplier') {
    item = appState.suppliers.find(s => s.id === id);
    if (item) { total = preciseRound(item.price || 0); paid = preciseRound(item.paid || 0); remaining = preciseRound(total - paid); }
  }

  if (item && infoBox) {
    infoBox.style.display = 'block';
    
    const setInfo = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(preciseRound(val)); };
    setInfo('info-total', total);
    setInfo('info-paid', paid);
    setInfo('info-remaining', remaining);
    
    // ⚠️ CRUCIAL: Salvar valor numérico limpo no data attribute
    infoBox.dataset.remaining = remaining;
    
    const pct = total > 0 ? (paid / total) * 100 : 0;
    const progBar = document.getElementById('info-progress');
    if (progBar) progBar.style.width = `${pct}%`;
    
    if (amountInput) {
      amountInput.max = remaining;
      amountInput.placeholder = `Máx: ${formatCurrency(remaining)}`;
      if (amountHint) amountHint.textContent = `Máximo permitido: ${formatCurrency(remaining)}`;
      if (remaining <= 0) { amountInput.disabled = true; if (amountHint) amountHint.textContent = 'Item já está quitado'; }
      else { amountInput.disabled = false; }
    }
  }
}

function openPaymentForService(serviceId) {
  openModal('payment');
  setTimeout(() => {
    const typeSelect = document.getElementById('pay-type');
    if (typeSelect) {
      typeSelect.value = 'service';
      populatePaymentSelects();
      setTimeout(() => {
        const select = document.getElementById('pay-item');
        if (select) {
          const option = select.querySelector(`option[value="service-${serviceId}"]`);
          if (option) { select.value = `service-${serviceId}`; updatePaymentInfo(); }
        }
      }, 100);
    }
  }, 300);
}

function fillForm(type, id) {
  if (type === 'service') {
    const item = appState.services.find(s => s.id == id);
    if (item) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('svc-id', item.id); set('service-id', item.id);
      set('svc-name', item.name); set('service-name', item.name);
      set('svc-category', item.category); set('service-category', item.category);
      set('svc-value', item.value); set('service-value', item.value);
      set('svc-due-date', item.due_date); set('service-due-date', item.due_date);
      set('svc-notes', item.notes); set('service-notes', item.notes);
    }
  } else if (type === 'supplier') {
    const item = appState.suppliers.find(s => s.id == id);
    if (item) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('sup-id', item.id); set('supplier-id', item.id);
      set('sup-name', item.name); set('supplier-name', item.name);
      set('sup-category', item.category); set('supplier-category', item.category);
      set('sup-price', item.price); set('supplier-price', item.price);
      set('sup-rating', item.rating || 0); set('supplier-rating', item.rating || 0);
      set('sup-phone', item.contact_phone); set('supplier-phone', item.contact_phone);
      set('sup-email', item.contact_email); set('supplier-email', item.contact_email);
      set('sup-description', item.description); set('supplier-description', item.description);
      set('sup-notes', item.notes); set('supplier-notes', item.notes);
    }
  }
}

// ==================== DETALHES ====================
function showServiceDetail(id) {
  const s = appState.services.find(x => x.id === id);
  if (!s) return;
  const title = document.getElementById('detailModalTitle');
  if (title) title.textContent = s.name;
  const content = document.getElementById('detailContent');
  if (content) {
    content.innerHTML = `
      <span class="detail-label">Categoria:</span><span class="detail-value">${s.category}</span>
      <span class="detail-label">Valor Total:</span><span class="detail-value text-primary">${formatCurrency(preciseRound(s.value))}</span>
      <span class="detail-label">Total Pago:</span><span class="detail-value text-success">${formatCurrency(preciseRound(s.paid))}</span>
      <span class="detail-label">Restante:</span><span class="detail-value text-danger fw-bold">${formatCurrency(preciseRound(s.value - s.paid))}</span>
      <span class="detail-label">Vencimento:</span><span class="detail-value">${formatDate(s.due_date)}</span>
      <span class="detail-label">Observações:</span><span class="detail-value">${s.notes || '—'}</span>
    `;
  }
  const editBtn = document.getElementById('detailEditBtn');
  const delBtn = document.getElementById('detailDeleteBtn');
  if (editBtn) editBtn.onclick = () => { closeModal('detailModal'); editService(id); };
  if (delBtn) delBtn.onclick = () => { if (confirm('Excluir este serviço?')) deleteService(id); closeModal('detailModal'); };
  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function showSupplierDetail(id) {
  const s = appState.suppliers.find(x => x.id === id);
  if (!s) return;
  const title = document.getElementById('detailModalTitle');
  if (title) title.textContent = s.name;
  const content = document.getElementById('detailContent');
  if (content) {
    content.innerHTML = `
      <span class="detail-label">Categoria:</span><span class="detail-value">${s.category}</span>
      <span class="detail-label">Preço:</span><span class="detail-value text-primary">${formatCurrency(preciseRound(s.price))}</span>
      <span class="detail-label">Pago:</span><span class="detail-value text-success">${formatCurrency(preciseRound(s.paid))}</span>
      <span class="detail-label">Telefone:</span><span class="detail-value">${s.contact_phone || '—'}</span>
      <span class="detail-label">Email:</span><span class="detail-value">${s.contact_email || '—'}</span>
    `;
  }
  const editBtn = document.getElementById('detailEditBtn');
  const delBtn = document.getElementById('detailDeleteBtn');
  if (editBtn) editBtn.onclick = () => { closeModal('detailModal'); editSupplier(id); };
  if (delBtn) delBtn.onclick = () => { if (confirm('Excluir este fornecedor?')) deleteSupplier(id); closeModal('detailModal'); };
  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function showPaymentDetail(id) {
  const p = appState.payments.find(x => x.id === id);
  if (!p) return;
  let entityName = 'Item removido';
  if (p.entity_type === 'service') { const svc = appState.services.find(s => s.id === p.entity_id); if (svc) entityName = svc.name; } 
  else { const sup = appState.suppliers.find(s => s.id === p.entity_id); if (sup) entityName = sup.name; }
  const title = document.getElementById('detailModalTitle');
  if (title) title.textContent = 'Detalhes do Pagamento';
  const content = document.getElementById('detailContent');
  if (content) {
    content.innerHTML = `
      <span class="detail-label">Data:</span><span class="detail-value">${formatDate(p.payment_date)}</span>
      <span class="detail-label">Item:</span><span class="detail-value">${entityName}</span>
      <span class="detail-label">Valor:</span><span class="detail-value text-success fw-bold">${formatCurrency(p.amount)}</span>
      <span class="detail-label">Método:</span><span class="detail-value">${(p.payment_method || '').toUpperCase()}</span>
      <span class="detail-label">Comprovante:</span><span class="detail-value">${p.receipt_number || '—'}</span>
    `;
  }
  const editBtn = document.getElementById('detailEditBtn');
  const delBtn = document.getElementById('detailDeleteBtn');
  if (editBtn) editBtn.style.display = 'none';
  if (delBtn) delBtn.onclick = () => { if (confirm('Excluir este pagamento?')) deletePayment(id); closeModal('detailModal'); };
  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// ==================== CRUD ====================
async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('svc-id')?.value || document.getElementById('service-id')?.value;
  const data = {
    name: document.getElementById('svc-name')?.value || document.getElementById('service-name')?.value,
    category: document.getElementById('svc-category')?.value || document.getElementById('service-category')?.value,
    value: preciseRound(parseFloat((document.getElementById('svc-value')?.value || document.getElementById('service-value')?.value) || 0)),
    due_date: (document.getElementById('svc-due-date')?.value || document.getElementById('service-due-date')?.value) || null,
    notes: (document.getElementById('svc-notes')?.value || document.getElementById('service-notes')?.value) || ''
  };
  try {
    let error;
    if (id) ({ error } = await supabase.from('services').update(data).eq('id', id));
    else ({ error } = await supabase.from('services').insert([data]));
    if (error) throw error;
    closeModal('serviceModal'); showToast('Serviço salvo!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

function editService(id) { openModal('service', id); }

async function deleteService(id) {
  if (!confirm('Tem certeza?')) return;
  try {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw error;
    showToast('Serviço excluído!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

async function saveSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('sup-id')?.value || document.getElementById('supplier-id')?.value;
  const data = {
    name: document.getElementById('sup-name')?.value || document.getElementById('supplier-name')?.value,
    category: document.getElementById('sup-category')?.value || document.getElementById('supplier-category')?.value,
    price: preciseRound(parseFloat((document.getElementById('sup-price')?.value || document.getElementById('supplier-price')?.value) || 0)),
    rating: parseInt((document.getElementById('sup-rating')?.value || document.getElementById('supplier-rating')?.value) || 0),
    contact_phone: (document.getElementById('sup-phone')?.value || document.getElementById('supplier-phone')?.value) || '',
    contact_email: (document.getElementById('sup-email')?.value || document.getElementById('supplier-email')?.value) || '',
    description: (document.getElementById('sup-description')?.value || document.getElementById('supplier-description')?.value) || '',
    notes: (document.getElementById('sup-notes')?.value || document.getElementById('supplier-notes')?.value) || ''
  };
  try {
    let error;
    if (id) ({ error } = await supabase.from('suppliers').update(data).eq('id', id));
    else ({ error } = await supabase.from('suppliers').insert([data]));
    if (error) throw error;
    closeModal('supplierModal'); showToast('Fornecedor salvo!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

function editSupplier(id) { openModal('supplier', id); }

async function deleteSupplier(id) {
  if (!confirm('Excluir fornecedor?')) return;
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    showToast('Fornecedor excluído!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

// =============================================
// 💰 REGISTRO DE PAGAMENTO COM PRECISÃO MÁXIMA
// =============================================
async function registerPayment(e) {
  e.preventDefault();
  
  const rawItem = document.getElementById('pay-item')?.value;
  if (!rawItem || rawItem.includes('Nenhum')) { showToast('Selecione um item', 'warning'); return; }

  const [type, idStr] = rawItem.split('-');
  const id = parseInt(idStr);
  
  const amountInput = document.getElementById('pay-amount');
  const amountStr = (amountInput?.value || '').replace(',', '.');
  // Arredonda para 2 casas para garantir 50.00 e não 49.99999
  const amount = preciseRound(parseFloat(amountStr));

  const infoBox = document.getElementById('payment-info-box');
  const remaining = parseFloat(infoBox?.dataset?.remaining || 0);
  
  if (isNaN(amount) || amount <= 0) { showToast('Valor inválido', 'danger'); return; }
  if (amount > remaining) { showToast(`Valor excede o restante de ${formatCurrency(remaining)}`, 'danger'); return; }

  const data = {
    entity_type: type,
    entity_id: id,
    amount: amount, // Já vem arredondado corretamente
    payment_date: document.getElementById('pay-date')?.value,
    payment_method: document.getElementById('pay-method')?.value,
    description: (document.getElementById('pay-description')?.value) || '',
    receipt_number: (document.getElementById('pay-receipt')?.value) || '',
    status: 'completed'
  };

  try {
    const { error } = await supabase.from('payments').insert([data]);
    if (error) throw error;
    closeModal('paymentModal');
    showToast('✅ Pagamento registrado!');
    loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

async function deletePayment(id) {
  if (!confirm('Excluir pagamento?')) return;
  try {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    showToast('Pagamento excluído!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

async function saveSettings(e) {
  e.preventDefault();
  const data = {
    couple_name: (document.getElementById('set-couple-name')?.value || document.getElementById('couple-name')?.value) || '',
    wedding_date: (document.getElementById('set-wedding-date')?.value || document.getElementById('wedding-date')?.value) || null,
    guest_count: parseInt((document.getElementById('set-guest-count')?.value || document.getElementById('guest-count')?.value) || 0),
    budget_total: preciseRound(parseFloat((document.getElementById('set-budget-total')?.value || document.getElementById('budget-total')?.value) || 0)),
    theme: (document.getElementById('set-theme')?.value || document.getElementById('wedding-theme')?.value) || '',
    location: (document.getElementById('set-location')?.value || document.getElementById('wedding-location')?.value) || ''
  };
  try {
    const { count } = await supabase.from('wedding_settings').select('id').limit(1);
    let error;
    if (count > 0) ({ error } = await supabase.from('wedding_settings').update(data).eq('id', 1));
    else ({ error } = await supabase.from('wedding_settings').insert([{ id: 1, ...data }]));
    if (error) throw error;
    showToast('Configurações salvas!'); loadData();
  } catch (err) { showToast('Erro: ' + err.message, 'danger'); }
}

// ==================== BUSCA ====================
function initSearch() {
  document.getElementById('search-services')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#services-table-body tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
  document.getElementById('search-payments')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#payments-table-body tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('💍 CRM Casamento Perfeito - Iniciando...');
  document.querySelectorAll('[data-section], [data-tab]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); showSection(el.dataset.section || el.dataset.tab); });
  });
  document.getElementById('service-form')?.addEventListener('submit', saveService);
  document.getElementById('supplier-form')?.addEventListener('submit', saveSupplier);
  document.getElementById('payment-form')?.addEventListener('submit', registerPayment);
  document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
  document.getElementById('pay-type')?.addEventListener('change', populatePaymentSelects);
  document.getElementById('btn-new-service')?.addEventListener('click', () => openModal('service'));
  document.getElementById('btn-new-supplier')?.addEventListener('click', () => openModal('supplier'));
  document.getElementById('btn-new-payment')?.addEventListener('click', () => openModal('payment'));
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadData);
  initSearch();
  loadData();
});
