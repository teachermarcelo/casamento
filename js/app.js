/**
 * CRM Casamento Perfeito - Sistema Completo
 * Conecta ao Supabase e gerencia todos os dados
 */

// ==================== INICIALIZAÇÃO ====================
const { createClient } = window.supabase;
const supabase = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

// Estado Global
let appState = {
  services: [],
  suppliers: [],
  payments: [],
  settings: {}
};

// ==================== UTILITÁRIOS ====================
const formatCurrency = (val) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatDate = (dateStr) => 
  dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const getDaysLeft = (dateStr) => {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Toast notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
  toast.style.zIndex = '9999';
  toast.style.minWidth = '300px';
  toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== NAVEGAÇÃO ====================
function showSection(sectionId) {
  // Esconder todas as seções
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  
  // Mostrar seção alvo
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // Atualizar navegação
  const navLink = document.querySelector(`[data-tab="${sectionId}"]`);
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

    if (resSvc.error) throw new Error('Serviços: ' + resSvc.error.message);
    if (resSup.error) throw new Error('Fornecedores: ' + resSup.error.message);
    if (resPay.error) throw new Error('Pagamentos: ' + resPay.error.message);

    // Atualizar estado global
    appState.services = resSvc.data || [];
    appState.suppliers = resSup.data || [];
    appState.payments = resPay.data || [];
    appState.settings = resSet.data || {};

    console.log('✅ Dados carregados:', {
      serviços: appState.services.length,
      fornecedores: appState.suppliers.length,
      pagamentos: appState.payments.length
    });

    // Renderizar tudo
    renderDashboard();
    renderServices();
    renderSuppliers();
    renderPayments();
    renderBudget();
    renderSettings();

  } catch (error) {
    console.error('❌ Erro ao carregar:', error);
    showToast('Erro ao conectar com banco de dados', 'danger');
  }
}

// ==================== RENDERIZAÇÃO ====================
function renderDashboard() {
  // Cálculos financeiros
  const totalServices = appState.services.reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
  const totalSuppliers = appState.suppliers.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const totalBudget = parseFloat(appState.settings.budget_total || 0) || (totalServices + totalSuppliers);
  
  const totalPaid = appState.services.reduce((sum, s) => sum + parseFloat(s.paid || 0), 0) + 
                   appState.suppliers.reduce((sum, s) => sum + parseFloat(s.paid || 0), 0);
  
  const pending = Math.max(totalBudget - totalPaid, 0);

  // Atualizar cards
  document.getElementById('total-budget').textContent = formatCurrency(totalBudget);
  document.getElementById('total-paid').textContent = formatCurrency(totalPaid);
  document.getElementById('total-pending').textContent = formatCurrency(pending);
  document.getElementById('days-until-wedding').textContent = getDaysLeft(appState.settings.wedding_date);

  // Último pagamento
  const lastPayment = appState.payments[0];
  if (lastPayment) {
    document.getElementById('last-payment-amount').textContent = formatCurrency(lastPayment.amount);
    document.getElementById('last-payment-meta').innerHTML = `
      <i class="bi bi-check-circle-fill me-1"></i> 
      ${lastPayment.description || 'Pagamento'} • ${formatDate(lastPayment.payment_date)}
    `;
  } else {
    document.getElementById('last-payment-amount').textContent = 'R$ 0,00';
    document.getElementById('last-payment-meta').textContent = 'Nenhum pagamento registrado';
  }

  // Próximos vencimentos
  const upcoming = appState.services
    .filter(s => s.due_date && (parseFloat(s.value || 0) > parseFloat(s.paid || 0)))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  const upList = document.getElementById('upcoming-due');
  if (upcoming.length === 0) {
    upList.innerHTML = '<p class="text-muted">Nenhum vencimento próximo</p>';
  } else {
    upList.innerHTML = upcoming.map(s => {
      const remaining = parseFloat(s.value || 0) - parseFloat(s.paid || 0);
      return `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div>
            <strong>${s.name}</strong><br>
            <small class="text-muted">${formatDate(s.due_date)}</small>
          </div>
          <span class="badge bg-danger">${formatCurrency(remaining)}</span>
        </div>
      `;
    }).join('');
  }

  // Atividade recente
  const recent = appState.payments.slice(0, 5);
  const actList = document.getElementById('recent-activity');
  if (recent.length === 0) {
    actList.innerHTML = '<p class="text-muted">Nenhuma atividade recente</p>';
  } else {
    actList.innerHTML = recent.map(p => {
      let entityName = 'Item removido';
      if (p.entity_type === 'service') {
        const svc = appState.services.find(s => s.id === p.entity_id);
        if (svc) entityName = svc.name;
      } else {
        const sup = appState.suppliers.find(s => s.id === p.entity_id);
        if (sup) entityName = sup.name;
      }
      
      return `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div>
            <strong>${p.description || entityName}</strong><br>
            <small class="text-muted">${formatDate(p.payment_date)} • ${(p.payment_method || '').toUpperCase()}</small>
          </div>
          <span class="badge bg-success">${formatCurrency(p.amount)}</span>
        </div>
      `;
    }).join('');
  }

  // Progresso do orçamento
  const progress = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  document.getElementById('budget-progress').innerHTML = `
    <div class="progress mb-2" style="height: 10px;">
      <div class="progress-bar bg-success" style="width: ${progress}%"></div>
    </div>
    <small class="text-muted">${formatCurrency(totalPaid)} de ${formatCurrency(totalBudget)} (${progress.toFixed(0)}%)</small>
  `;
}

function renderServices() {
  const tbody = document.getElementById('services-table').querySelector('tbody');
  
  if (appState.services.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum serviço cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = appState.services.map(s => {
    const value = parseFloat(s.value || 0);
    const paid = parseFloat(s.paid || 0);
    const remaining = value - paid;
    const percent = value > 0 ? (paid / value) * 100 : 0;
    
    let statusClass = 'bg-warning text-dark';
    let statusText = 'Pendente';
    if (remaining <= 0) {
      statusClass = 'bg-success';
      statusText = 'Pago';
    } else if (paid > 0) {
      statusClass = 'bg-info';
      statusText = 'Parcial';
    }

    return `
      <tr onclick="showServiceDetail(${s.id})" style="cursor: pointer;">
        <td><strong>${s.name}</strong></td>
        <td><span class="badge bg-secondary">${s.category || '—'}</span></td>
        <td class="text-end">${formatCurrency(value)}</td>
        <td class="text-end text-success">${formatCurrency(paid)}</td>
        <td class="text-end text-danger">${formatCurrency(remaining)}</td>
        <td>${formatDate(s.due_date)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-success me-1" onclick="event.stopPropagation(); openPaymentForService(${s.id})" title="Pagar">
            <i class="bi bi-currency-dollar"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="event.stopPropagation(); editService(${s.id})" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteService(${s.id})" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSuppliers() {
  const container = document.getElementById('suppliers-container');
  
  if (appState.suppliers.length === 0) {
    container.innerHTML = '<div class="card"><div class="card-body text-center text-muted">Nenhum fornecedor cadastrado</div></div>';
    return;
  }

  container.innerHTML = appState.suppliers.map(s => {
    const price = parseFloat(s.price || 0);
    const paid = parseFloat(s.paid || 0);
    const remaining = price - paid;
    
    return `
      <div class="col-md-6 col-lg-4">
        <div class="supplier-card card h-100" onclick="showSupplierDetail(${s.id})" style="cursor: pointer;">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${s.name}</h5>
              <div class="btn-group">
                <button class="btn btn-sm btn-light" onclick="event.stopPropagation(); editSupplier(${s.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-light text-danger" onclick="event.stopPropagation(); deleteSupplier(${s.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <p class="text-muted mb-1">${s.category}</p>
            <h4 class="text-primary mb-2">${formatCurrency(price)}</h4>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small>Pago: <strong class="text-success">${formatCurrency(paid)}</strong></small>
              ${s.rating ? `<small>${'⭐'.repeat(parseInt(s.rating) || 0)}</small>` : ''}
            </div>
            ${remaining > 0 ? `<small class="text-danger">Restante: ${formatCurrency(remaining)}</small>` : '<small class="text-success">✓ Quitado</small>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPayments() {
  const tbody = document.getElementById('payments-table').querySelector('tbody');
  
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
        <td>
          <strong>${p.description || entityName}</strong><br>
          <small class="text-muted">${entityName}</small>
        </td>
        <td class="text-end fw-bold text-success">${formatCurrency(p.amount)}</td>
        <td><span class="badge bg-secondary">${(p.payment_method || '').toUpperCase()}</span></td>
        <td><span class="badge bg-success">${p.status}</span></td>
        <td>${p.receipt_number || '—'}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deletePayment(${p.id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBudget() {
  // Resumo financeiro
  const totalBudget = parseFloat(appState.settings.budget_total || 0);
  const totalSpent = appState.services.reduce((s, v) => s + parseFloat(v.value || 0), 0) + 
                     appState.suppliers.reduce((s, v) => s + parseFloat(v.price || 0), 0);
  const totalPaid = appState.services.reduce((s, v) => s + parseFloat(v.paid || 0), 0) +
                    appState.suppliers.reduce((s, v) => s + parseFloat(v.paid || 0), 0);

  document.getElementById('budget-summary').innerHTML = `
    <ul class="list-group list-group-flush">
      <li class="list-group-item d-flex justify-content-between">
        <span>Orçamento Definido</span>
        <strong>${formatCurrency(totalBudget || totalSpent)}</strong>
      </li>
      <li class="list-group-item d-flex justify-content-between">
        <span>Total Estimado</span>
        <span>${formatCurrency(totalSpent)}</span>
      </li>
      <li class="list-group-item d-flex justify-content-between text-success">
        <span>Total Pago</span>
        <strong>${formatCurrency(totalPaid)}</strong>
      </li>
      <li class="list-group-item d-flex justify-content-between text-danger">
        <span>Restante</span>
        <strong>${formatCurrency(totalSpent - totalPaid)}</strong>
      </li>
    </ul>
  `;

  // Por categoria
  const categories = {};
  appState.services.forEach(s => {
    if (!categories[s.category]) categories[s.category] = { total: 0, paid: 0 };
    categories[s.category].total += parseFloat(s.value || 0);
    categories[s.category].paid += parseFloat(s.paid || 0);
  });

  document.getElementById('budget-breakdown').innerHTML = Object.keys(categories).map(cat => {
    const info = categories[cat];
    const pct = info.total > 0 ? (info.paid / info.total) * 100 : 0;
    return `
      <div class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <span class="fw-bold text-capitalize">${cat}</span>
          <span>${formatCurrency(info.paid)} / ${formatCurrency(info.total)}</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar bg-primary" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-muted text-center">Sem categorias</p>';
}

function renderSettings() {
  document.getElementById('couple-name').value = appState.settings.couple_name || '';
  document.getElementById('wedding-date').value = appState.settings.wedding_date || '';
  document.getElementById('guest-count').value = appState.settings.guest_count || '';
  document.getElementById('budget-total').value = appState.settings.budget_total || '';
  document.getElementById('wedding-theme').value = appState.settings.theme || '';
  document.getElementById('wedding-location').value = appState.settings.location || '';
}

// ==================== MODAIS ====================
function openModal(type, id = null) {
  let modalId, titleId;
  
  if (type === 'service') {
    modalId = 'service-modal';
    titleId = 'service-modal-title';
  } else if (type === 'supplier') {
    modalId = 'supplier-modal';
    titleId = 'supplier-modal-title';
  } else if (type === 'payment') {
    modalId = 'payment-modal';
  }

  if (titleId) {
    const titleEl = document.getElementById(titleId);
    if (titleEl) {
      titleEl.textContent = id ? `Editar ${type === 'service' ? 'Serviço' : 'Fornecedor'}` : 
                                     `Adicionar ${type === 'service' ? 'Serviço' : 'Fornecedor'}`;
    }
  }

  const modal = new bootstrap.Modal(document.getElementById(modalId));
  modal.show();

  if (id) fillForm(type, id);
  if (type === 'payment') populatePaymentSelects();
}

function closeModal(modalId) {
  const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
  if (modal) {
    modal.hide();
    // Resetar formulários
    const form = document.getElementById(modalId.replace('-modal', '-form'));
    if (form) form.reset();
  }
}

function populatePaymentSelects() {
  const type = document.getElementById('payment-entity-type').value;
  const select = document.getElementById('payment-entity-id');
  const infoBox = document.getElementById('payment-info-box');
  
  select.innerHTML = '<option value="">Selecione um item</option>';
  
  if (!type) {
    if (infoBox) infoBox.style.display = 'none';
    return;
  }

  let items = [];
  if (type === 'service') {
    items = appState.services.filter(s => (parseFloat(s.value || 0) - parseFloat(s.paid || 0)) > 0);
    items.forEach(item => {
      const remaining = parseFloat(item.value || 0) - parseFloat(item.paid || 0);
      select.innerHTML += `<option value="service-${item.id}" data-remaining="${remaining}">${item.name} (${item.category}) - Restante: ${formatCurrency(remaining)}</option>`;
    });
  } else if (type === 'supplier') {
    items = appState.suppliers.filter(s => (parseFloat(s.price || 0) - parseFloat(s.paid || 0)) > 0);
    items.forEach(item => {
      const remaining = parseFloat(item.price || 0) - parseFloat(item.paid || 0);
      select.innerHTML += `<option value="supplier-${item.id}" data-remaining="${remaining}">${item.name} (${item.category}) - Restante: ${formatCurrency(remaining)}</option>`;
    });
  }

  if (items.length === 0) {
    select.innerHTML = '<option value="">Nenhum item pendente</option>';
  }

  // Adicionar listener para atualizar informações
  select.onchange = updatePaymentInfo;
}

function updatePaymentInfo() {
  const select = document.getElementById('payment-entity-id');
  const infoBox = document.getElementById('payment-info-box');
  const amountInput = document.getElementById('payment-amount');
  
  if (!select || !select.value || select.value.includes('Nenhum')) {
    if (infoBox) infoBox.style.display = 'none';
    return;
  }

  const [type, idStr] = select.value.split('-');
  const id = parseInt(idStr);
  
  let item = null;
  let total = 0;
  let paid = 0;
  let remaining = 0;

  if (type === 'service') {
    item = appState.services.find(s => s.id === id);
    if (item) {
      total = parseFloat(item.value || 0);
      paid = parseFloat(item.paid || 0);
      remaining = total - paid;
    }
  } else if (type === 'supplier') {
    item = appState.suppliers.find(s => s.id === id);
    if (item) {
      total = parseFloat(item.price || 0);
      paid = parseFloat(item.paid || 0);
      remaining = total - paid;
    }
  }

  if (item && infoBox) {
    infoBox.style.display = 'block';
    document.getElementById('info-total').textContent = formatCurrency(total);
    document.getElementById('info-paid').textContent = formatCurrency(paid);
    document.getElementById('info-remaining').textContent = formatCurrency(remaining);
    
    // Atualizar barra de progresso
    const pct = total > 0 ? (paid / total) * 100 : 0;
    const progressBar = infoBox.querySelector('.progress-bar');
    if (progressBar) progressBar.style.width = `${pct}%`;
    
    // Limitar valor máximo
    if (amountInput) {
      amountInput.max = remaining;
      amountInput.placeholder = `Máx: ${formatCurrency(remaining)}`;
    }
  }
}

function openPaymentForService(serviceId) {
  openModal('payment');
  
  setTimeout(() => {
    document.getElementById('payment-entity-type').value = 'service';
    populatePaymentSelects();
    
    setTimeout(() => {
      const select = document.getElementById('payment-entity-id');
      const option = select.querySelector(`option[value="service-${serviceId}"]`);
      if (option) {
        select.value = `service-${serviceId}`;
        updatePaymentInfo();
      }
    }, 100);
  }, 300);
}

function fillForm(type, id) {
  if (type === 'service') {
    const item = appState.services.find(s => s.id == id);
    if (item) {
      document.getElementById('service-id').value = item.id;
      document.getElementById('service-name').value = item.name;
      document.getElementById('service-category').value = item.category;
      document.getElementById('service-value').value = item.value;
      document.getElementById('service-due-date').value = item.due_date || '';
      document.getElementById('service-notes').value = item.notes || '';
    }
  } else if (type === 'supplier') {
    const item = appState.suppliers.find(s => s.id == id);
    if (item) {
      document.getElementById('supplier-id').value = item.id;
      document.getElementById('supplier-name').value = item.name;
      document.getElementById('supplier-category').value = item.category;
      document.getElementById('supplier-price').value = item.price;
      document.getElementById('supplier-rating').value = item.rating || 0;
      document.getElementById('supplier-phone').value = item.contact_phone || '';
      document.getElementById('supplier-email').value = item.contact_email || '';
      document.getElementById('supplier-description').value = item.description || '';
      document.getElementById('supplier-notes').value = item.notes || '';
    }
  }
}

// ==================== DETALHES ====================
function showServiceDetail(id) {
  const s = appState.services.find(x => x.id === id);
  if (!s) return;

  document.getElementById('detailModalTitle').textContent = s.name;
  document.getElementById('detailContent').innerHTML = `
    <span class="detail-label">Categoria:</span><span class="detail-value">${s.category}</span>
    <span class="detail-label">Valor Total:</span><span class="detail-value text-primary">${formatCurrency(s.value)}</span>
    <span class="detail-label">Total Pago:</span><span class="detail-value text-success">${formatCurrency(s.paid)}</span>
    <span class="detail-label">Restante:</span><span class="detail-value text-danger fw-bold">${formatCurrency(s.value - s.paid)}</span>
    <span class="detail-label">Vencimento:</span><span class="detail-value">${formatDate(s.due_date)}</span>
    <span class="detail-label">Observações:</span><span class="detail-value">${s.notes || '—'}</span>
  `;
  
  document.getElementById('detailEditBtn').onclick = () => {
    closeModal('detail-modal');
    editService(id);
  };
  document.getElementById('detailDeleteBtn').onclick = () => {
    if (confirm('Excluir este serviço?')) deleteService(id);
    closeModal('detail-modal');
  };

  new bootstrap.Modal(document.getElementById('detail-modal')).show();
}

function showSupplierDetail(id) {
  const s = appState.suppliers.find(x => x.id === id);
  if (!s) return;

  document.getElementById('detailModalTitle').textContent = s.name;
  document.getElementById('detailContent').innerHTML = `
    <span class="detail-label">Categoria:</span><span class="detail-value">${s.category}</span>
    <span class="detail-label">Preço:</span><span class="detail-value text-primary">${formatCurrency(s.price)}</span>
    <span class="detail-label">Pago:</span><span class="detail-value text-success">${formatCurrency(s.paid)}</span>
    <span class="detail-label">Telefone:</span><span class="detail-value">${s.contact_phone || '—'}</span>
    <span class="detail-label">Email:</span><span class="detail-value">${s.contact_email || '—'}</span>
    <span class="detail-label">Descrição:</span><span class="detail-value">${s.description || '—'}</span>
  `;

  document.getElementById('detailEditBtn').onclick = () => {
    closeModal('detail-modal');
    editSupplier(id);
  };
  document.getElementById('detailDeleteBtn').onclick = () => {
    if (confirm('Excluir este fornecedor?')) deleteSupplier(id);
    closeModal('detail-modal');
  };

  new bootstrap.Modal(document.getElementById('detail-modal')).show();
}

function showPaymentDetail(id) {
  const p = appState.payments.find(x => x.id === id);
  if (!p) return;

  let entityName = 'Item removido';
  if (p.entity_type === 'service') {
    const svc = appState.services.find(s => s.id === p.entity_id);
    if (svc) entityName = svc.name;
  } else {
    const sup = appState.suppliers.find(s => s.id === p.entity_id);
    if (sup) entityName = sup.name;
  }

  document.getElementById('detailModalTitle').textContent = 'Detalhes do Pagamento';
  document.getElementById('detailContent').innerHTML = `
    <span class="detail-label">Data:</span><span class="detail-value">${formatDate(p.payment_date)}</span>
    <span class="detail-label">Item:</span><span class="detail-value">${entityName}</span>
    <span class="detail-label">Descrição:</span><span class="detail-value">${p.description || '—'}</span>
    <span class="detail-label">Valor:</span><span class="detail-value text-success fw-bold">${formatCurrency(p.amount)}</span>
    <span class="detail-label">Método:</span><span class="detail-value">${(p.payment_method || '').toUpperCase()}</span>
    <span class="detail-label">Comprovante:</span><span class="detail-value">${p.receipt_number || '—'}</span>
    <span class="detail-label">Status:</span><span class="detail-value"><span class="badge bg-success">${p.status}</span></span>
  `;

  document.getElementById('detailEditBtn').style.display = 'none';
  document.getElementById('detailDeleteBtn').onclick = () => {
    if (confirm('Excluir este pagamento?')) deletePayment(id);
    closeModal('detail-modal');
  };

  new bootstrap.Modal(document.getElementById('detail-modal')).show();
}

// ==================== CRUD ====================
async function saveService(e) {
  e.preventDefault();
  
  const id = document.getElementById('service-id').value;
  const data = {
    name: document.getElementById('service-name').value,
    category: document.getElementById('service-category').value,
    value: parseFloat(document.getElementById('service-value').value),
    due_date: document.getElementById('service-due-date').value || null,
    notes: document.getElementById('service-notes').value || ''
  };

  try {
    let error;
    if (id) {
      ({ error } = await supabase.from('services').update(data).eq('id', id));
    } else {
      ({ error } = await supabase.from('services').insert([data]));
    }

    if (error) throw error;
    
    closeModal('service-modal');
    showToast('Serviço salvo com sucesso!');
    loadData();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'danger');
  }
}

function editService(id) {
  openModal('service', id);
}

async function deleteService(id) {
  if (!confirm('Tem certeza? Isso apagará todos os pagamentos associados.')) return;
  
  try {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw error;
    
    showToast('Serviço excluído!');
    loadData();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, 'danger');
  }
}

async function saveSupplier(e) {
  e.preventDefault();
  
  const id = document.getElementById('supplier-id').value;
  const data = {
    name: document.getElementById('supplier-name').value,
    category: document.getElementById('supplier-category').value,
    price: parseFloat(document.getElementById('supplier-price').value),
    rating: parseInt(document.getElementById('supplier-rating').value) || 0,
    contact_phone: document.getElementById('supplier-phone').value || '',
    contact_email: document.getElementById('supplier-email').value || '',
    description: document.getElementById('supplier-description').value || '',
    notes: document.getElementById('supplier-notes').value || ''
  };

  try {
    let error;
    if (id) {
      ({ error } = await supabase.from('suppliers').update(data).eq('id', id));
    } else {
      ({ error } = await supabase.from('suppliers').insert([data]));
    }

    if (error) throw error;
    
    closeModal('supplier-modal');
    showToast('Fornecedor salvo!');
    loadData();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'danger');
  }
}

function editSupplier(id) {
  openModal('supplier', id);
}

async function deleteSupplier(id) {
  if (!confirm('Excluir fornecedor?')) return;
  
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    
    showToast('Fornecedor excluído!');
    loadData();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, 'danger');
  }
}

async function registerPayment(e) {
  e.preventDefault();
  
  const rawItem = document.getElementById('payment-entity-id').value;
  if (!rawItem || rawItem.includes('Nenhum')) {
    showToast('Selecione um item para pagar', 'warning');
    return;
  }

  const [type, idStr] = rawItem.split('-');
  const id = parseInt(idStr);
  const amount = parseFloat(document.getElementById('payment-amount').value);

  // Validar valor
  const remainingText = document.getElementById('info-remaining')?.textContent || '0';
  const remaining = parseFloat(remainingText.replace(/[^\d,.-]/g, '').replace(',', '.'));
  
  if (amount > remaining) {
    showToast(`Valor excede o restante de ${formatCurrency(remaining)}`, 'danger');
    return;
  }

  const data = {
    entity_type: type,
    entity_id: id,
    amount: amount,
    payment_date: document.getElementById('payment-date').value,
    payment_method: document.getElementById('payment-method').value,
    description: document.getElementById('payment-description').value || '',
    receipt_number: document.getElementById('payment-receipt').value || '',
    status: 'completed'
  };

  try {
    const { error } = await supabase.from('payments').insert([data]);
    if (error) throw error;
    
    closeModal('payment-modal');
    showToast('✅ Pagamento registrado com sucesso!');
    loadData();
  } catch (err) {
    showToast('Erro ao registrar: ' + err.message, 'danger');
  }
}

async function deletePayment(id) {
  if (!confirm('Excluir pagamento? O saldo será recalculado.')) return;
  
  try {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    
    showToast('Pagamento excluído!');
    loadData();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, 'danger');
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const data = {
    couple_name: document.getElementById('couple-name').value,
    wedding_date: document.getElementById('wedding-date').value || null,
    guest_count: parseInt(document.getElementById('guest-count').value) || 0,
    budget_total: parseFloat(document.getElementById('budget-total').value) || 0,
    theme: document.getElementById('wedding-theme').value || '',
    location: document.getElementById('wedding-location').value || ''
  };

  try {
    const { count } = await supabase.from('wedding_settings').select('id').limit(1);
    
    let error;
    if (count > 0) {
      ({ error } = await supabase.from('wedding_settings').update(data).eq('id', 1));
    } else {
      ({ error } = await supabase.from('wedding_settings').insert([{ id: 1, ...data }]));
    }

    if (error) throw error;
    
    showToast('Configurações salvas!');
    loadData();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'danger');
  }
}

// ==================== EXPORTAR ====================
function exportData() {
  const dataStr = JSON.stringify(appState, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `casamento_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Dados exportados!');
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('💍 CRM Casamento Perfeito - Iniciando...');
  
  // Navegação
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(tab.dataset.tab);
    });
  });

  // Formulários
  document.getElementById('service-form')?.addEventListener('submit', saveService);
  document.getElementById('supplier-form')?.addEventListener('submit', saveSupplier);
  document.getElementById('payment-form')?.addEventListener('submit', registerPayment);
  document.getElementById('wedding-settings-form')?.addEventListener('submit', saveSettings);

  // Listener para tipo de pagamento
  document.getElementById('payment-entity-type')?.addEventListener('change', populatePaymentSelects);

  // Botões de ação rápida
  document.getElementById('btn-new-service')?.addEventListener('click', () => openModal('service'));
  document.getElementById('btn-new-supplier')?.addEventListener('click', () => openModal('supplier'));
  document.getElementById('btn-new-payment')?.addEventListener('click', () => openModal('payment'));
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadData);

  // Carregar dados iniciais
  loadData();
});
