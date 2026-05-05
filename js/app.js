/**
 *  CRM Casamento Perfeito - Core Logic
 * Versão Profissional e Completa
 */

// ==================== INICIALIZAÇÃO ====================
const { createClient } = window.supabase;
const supabase = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

// Estado Global da Aplicação
let appState = {
  services: [],
  suppliers: [],
  payments: [],
  settings: {}
};

// ==================== UTILITÁRIOS ====================
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const getDaysLeft = (dateStr) => {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Navegação
function showSection(sectionId) {
  document.querySelectorAll('.section-box').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  
  const navLink = document.querySelector(`[data-section="${sectionId}"]`);
  if (navLink) navLink.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Mensagens Toast (simulado com alert simples para leveza, pode ser expandido)
function showToast(msg, type = 'success') {
  // Criar elemento toast dinamicamente
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
  toast.style.zIndex = '9999';
  toast.innerHTML = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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

    // Atualizar Estado
    appState.services = resSvc.data || [];
    appState.suppliers = resSup.data || [];
    appState.payments = resPay.data || [];
    appState.settings = resSet.data || {};

    console.log('✅ Dados carregados com sucesso:', appState);

    // Renderizar Tudo
    renderDashboard();
    renderServices();
    renderSuppliers();
    renderPayments();
    renderBudget();
    renderSettings();

  } catch (error) {
    console.error('❌ Erro ao carregar:', error);
    showToast('Erro ao conectar com o banco de dados', 'danger');
  }
}

// ==================== RENDERIZAÇÃO ====================
function renderDashboard() {
  // Cálculos
  const totalServices = appState.services.reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
  const totalSuppliers = appState.suppliers.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const totalBudget = parseFloat(appState.settings.budget_total || 0) || (totalServices + totalSuppliers);
  
  const totalPaidServices = appState.services.reduce((sum, s) => sum + parseFloat(s.paid || 0), 0);
  const totalPaidSuppliers = appState.suppliers.reduce((sum, s) => sum + parseFloat(s.paid || 0), 0);
  const totalPaid = totalPaidServices + totalPaidSuppliers;
  
  const pending = Math.max(totalBudget - totalPaid, 0);

  // Atualizar DOM
  document.getElementById('dash-budget-total').textContent = formatCurrency(totalBudget);
  document.getElementById('dash-paid-total').textContent = formatCurrency(totalPaid);
  document.getElementById('dash-pending-total').textContent = formatCurrency(pending);
  document.getElementById('dash-days-left').textContent = getDaysLeft(appState.settings.wedding_date);
  document.getElementById('wedding-date-display').textContent = appState.settings.wedding_date ? `Até ${formatDate(appState.settings.wedding_date)}` : '—';

  // Último Pagamento
  const lastPayment = appState.payments[0];
  if (lastPayment) {
    document.getElementById('last-payment-amount').textContent = formatCurrency(lastPayment.amount);
    document.getElementById('last-payment-meta').innerHTML = `
      <i class="bi bi-check-circle-fill me-1"></i> ${lastPayment.description || 'Pagamento registrado'} • ${formatDate(lastPayment.payment_date)}
    `;
  }

  // Próximos Vencimentos
  const upcoming = appState.services
    .filter(s => s.due_date && (parseFloat(s.value || 0) > parseFloat(s.paid || 0)))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  const upList = document.getElementById('dash-upcoming');
  upList.innerHTML = upcoming.length ? upcoming.map(s => `
    <li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer" onclick="showSection('servicos')">
      <div><strong>${s.name}</strong><br><small class="text-muted">${formatDate(s.due_date)}</small></div>
      <span class="badge bg-danger">${formatCurrency((s.value || 0) - (s.paid || 0))}</span>
    </li>
  `).join('') : '<li class="list-group-item text-center text-muted">Nenhum vencimento próximo</li>';

  // Atividade Recente
  const actList = document.getElementById('dash-activity');
  const recent = appState.payments.slice(0, 5);
  actList.innerHTML = recent.length ? recent.map(p => `
    <li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer" onclick="showSection('pagamentos')">
      <div><strong>${p.description || p.entity_type}</strong><br><small class="text-muted">${formatDate(p.payment_date)}</small></div>
      <span class="badge bg-success">${formatCurrency(p.amount)}</span>
    </li>
  `).join('') : '<li class="list-group-item text-center text-muted">Nenhum pagamento registrado</li>';

  // Progresso
  const progress = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  document.getElementById('dash-progress').innerHTML = `
    <div class="d-flex justify-content-between mb-1">
      <span class="small fw-bold">${formatCurrency(totalPaid)} pagos</span>
      <span class="small text-muted">${progress.toFixed(0)}%</span>
    </div>
    <div class="progress" style="height: 10px;">
      <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%"></div>
    </div>
  `;
}

function renderServices() {
  const tbody = document.getElementById('services-table-body');
  if (!appState.services.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Nenhum serviço cadastrado</td></tr>';
    document.getElementById('services-count').textContent = '0 registros';
    return;
  }

  tbody.innerHTML = appState.services.map(s => {
    const val = parseFloat(s.value || 0);
    const paid = parseFloat(s.paid || 0);
    const rem = val - paid;
    const pct = val > 0 ? (paid / val) * 100 : 0;
    const statusClass = rem <= 0 ? 'badge-paid' : rem === val ? 'badge-pending' : 'badge-partial';
    const statusText = rem <= 0 ? 'Pago' : rem === val ? 'Pendente' : 'Parcial';
    const progressClass = pct === 100 ? 'progress-paid' : pct > 0 ? 'progress-partial' : 'progress-pending';

    return `
      <tr onclick="showServiceDetail(${s.id})">
        <td class="fw-bold">${s.name}</td>
        <td><span class="badge bg-secondary">${s.category || '—'}</span></td>
        <td class="text-end">${formatCurrency(val)}</td>
        <td class="text-end text-success fw-bold">${formatCurrency(paid)}</td>
        <td>
          <div class="progress-container">
            <div class="progress">
              <div class="progress-bar ${progressClass}" style="width: ${pct}%"></div>
            </div>
            <small class="text-muted">${pct.toFixed(0)}%</small>
          </div>
        </td>
        <td class="text-end fw-bold ${rem > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(rem)}</td>
        <td>${formatDate(s.due_date)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td class="text-end" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-success me-1" onclick="openPaymentForService(${s.id})" title="Pagar">
            <i class="bi bi-currency-dollar"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editService(${s.id})" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteService(${s.id})" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('services-count').textContent = `${appState.services.length} registros`;
}

function renderSuppliers() {
  const container = document.getElementById('suppliers-container');
  if (!appState.suppliers.length) {
    container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-hourglass-split fs-1 d-block mb-2"></i>Nenhum fornecedor cadastrado</div>';
    document.getElementById('suppliers-count').textContent = '0 registros';
    return;
  }

  container.innerHTML = appState.suppliers.map(s => {
    const price = parseFloat(s.price || 0);
    const paid = parseFloat(s.paid || 0);
    return `
      <div class="col-lg-4 col-md-6">
        <div class="card h-100 cursor-pointer" onclick="showSupplierDetail(${s.id})">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title fw-bold">${s.name}</h5>
              <div class="btn-group">
                <button class="btn btn-sm btn-light" onclick="event.stopPropagation(); editSupplier(${s.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-light text-danger" onclick="event.stopPropagation(); deleteSupplier(${s.id})"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            <p class="text-muted mb-1">${s.category}</p>
            <h4 class="text-primary fw-bold mb-3">${formatCurrency(price)}</h4>
            <div class="d-flex justify-content-between align-items-center">
              <small>Pago: <strong class="text-success">${formatCurrency(paid)}</strong></small>
              ${s.rating ? `<small>${'⭐'.repeat(parseInt(s.rating))}</small>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('suppliers-count').textContent = `${appState.suppliers.length} registros`;
}

function renderPayments() {
  const tbody = document.getElementById('payments-table-body');
  if (!appState.payments.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum pagamento registrado</td></tr>';
    document.getElementById('payments-count').textContent = '0 registros';
    return;
  }

  tbody.innerHTML = appState.payments.map(p => {
    // Tentar achar nome do item
    let itemName = 'Item removido';
    if (p.entity_type === 'service') {
      const svc = appState.services.find(s => s.id === p.entity_id);
      if (svc) itemName = svc.name;
    } else {
      const sup = appState.suppliers.find(s => s.id === p.entity_id);
      if (sup) itemName = sup.name;
    }

    return `
      <tr onclick="showPaymentDetail(${p.id})">
        <td>${formatDate(p.payment_date)}</td>
        <td><strong>${p.description || itemName}</strong><br><small class="text-muted">${itemName}</small></td>
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

  document.getElementById('payments-count').textContent = `${appState.payments.length} registros`;
}

function renderBudget() {
  // Resumo
  const totalBudget = parseFloat(appState.settings.budget_total || 0);
  const totalSpent = appState.services.reduce((s, v) => s + parseFloat(v.value || 0), 0) + 
                     appState.suppliers.reduce((s, v) => s + parseFloat(v.price || 0), 0);
  const totalPaid = appState.services.reduce((s, v) => s + parseFloat(v.paid || 0), 0) +
                    appState.suppliers.reduce((s, v) => s + parseFloat(v.paid || 0), 0);
  
  document.getElementById('budget-summary').innerHTML = `
    <ul class="list-group list-group-flush">
      <li class="list-group-item d-flex justify-content-between fw-bold">
        <span>Orçamento Definido</span> <span>${formatCurrency(totalBudget || totalSpent)}</span>
      </li>
      <li class="list-group-item d-flex justify-content-between">
        <span>Estimado Total</span> <span>${formatCurrency(totalSpent)}</span>
      </li>
      <li class="list-group-item d-flex justify-content-between text-success">
        <span>Total Pago</span> <span>${formatCurrency(totalPaid)}</span>
      </li>
      <li class="list-group-item d-flex justify-content-between text-danger fw-bold">
        <span>Restante a Pagar</span> <span>${formatCurrency(totalSpent - totalPaid)}</span>
      </li>
    </ul>
  `;

  // Categorias
  const cats = {};
  appState.services.forEach(s => {
    if (!cats[s.category]) cats[s.category] = { total: 0, paid: 0 };
    cats[s.category].total += parseFloat(s.value || 0);
    cats[s.category].paid += parseFloat(s.paid || 0);
  });

  document.getElementById('budget-categories').innerHTML = Object.keys(cats).map(cat => {
    const info = cats[cat];
    const pct = info.total > 0 ? (info.paid / info.total) * 100 : 0;
    return `
      <div class="mb-3">
        <div class="d-flex justify-content-between small mb-1">
          <span class="fw-bold text-capitalize">${cat}</span>
          <span>${formatCurrency(info.paid)} / ${formatCurrency(info.total)}</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar bg-primary" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-center text-muted">Sem categorias</p>';

  // All Entries
  const allEntries = [
    ...appState.services.map(s => ({...s, type: 'Serviço'})),
    ...appState.suppliers.map(s => ({...s, type: 'Fornecedor', value: s.price}))
  ];

  document.getElementById('all-entries-body').innerHTML = allEntries.map(item => {
    const val = parseFloat(item.value || 0);
    const paid = parseFloat(item.paid || 0);
    const rem = val - paid;
    return `
      <tr>
        <td><span class="badge bg-secondary">${item.type}</span></td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td class="text-end">${formatCurrency(val)}</td>
        <td class="text-end text-success">${formatCurrency(paid)}</td>
        <td><span class="badge ${rem <= 0 ? 'bg-success' : 'bg-warning text-dark'}">${rem <= 0 ? 'Pago' : 'Pendente'}</span></td>
      </tr>
    `;
  }).join('');
}

function renderSettings() {
  document.getElementById('set-couple-name').value = appState.settings.couple_name || '';
  document.getElementById('set-wedding-date').value = appState.settings.wedding_date || '';
  document.getElementById('set-guest-count').value = appState.settings.guest_count || '';
  document.getElementById('set-budget-total').value = appState.settings.budget_total || '';
  document.getElementById('set-theme').value = appState.settings.theme || '';
  document.getElementById('set-location').value = appState.settings.location || '';
}

// ==================== MODAIS & INTERAÇÕES ====================
function initModals() {
  // Configurar Modais do Bootstrap
  const serviceModalEl = document.getElementById('serviceModal');
  const supplierModalEl = document.getElementById('supplierModal');
  const paymentModalEl = document.getElementById('paymentModal');

  // Resetar formulários ao fechar
  [serviceModalEl, supplierModalEl, paymentModalEl].forEach(el => {
    el.addEventListener('hidden.bs.modal', () => {
      const form = el.querySelector('form');
      if (form) form.reset();
      document.querySelectorAll('input[type="hidden"]').forEach(i => i.value = '');
    });
  });
}

function openModal(type, id = null) {
  let modalId, titleId;
  
  if (type === 'service') { modalId = 'serviceModal'; titleId = 'serviceModalTitle'; }
  else if (type === 'supplier') { modalId = 'supplierModal'; titleId = 'supplierModalTitle'; }
  else if (type === 'payment') { modalId = 'paymentModal'; titleId = 'paymentModal'; } // Sem título dinâmico no HTML

  const titleEl = document.getElementById(titleId);
  if (titleEl) titleEl.textContent = id ? `Editar ${type === 'service' ? 'Serviço' : 'Fornecedor'}` : `Novo ${type === 'service' ? 'Serviço' : 'Fornecedor'}`;

  const modal = new bootstrap.Modal(document.getElementById(modalId));
  modal.show();
  
  if (id) fillForm(type, id);
  if (type === 'payment') populatePaymentSelects();
}

function populatePaymentSelects() {
  const select = document.getElementById('pay-item');
  select.innerHTML = '<option value="">Selecione...</option>';
  
  appState.services.forEach(s => {
    select.innerHTML += `<option value="service-${s.id}">${s.name} (${s.category})</option>`;
  });
  appState.suppliers.forEach(s => {
    select.innerHTML += `<option value="supplier-${s.id}">${s.name} (${s.category})</option>`;
  });
}

// Helper para preencher formulários de edição
function fillForm(type, id) {
  if (type === 'service') {
    const item = appState.services.find(s => s.id == id);
    if (item) {
      document.getElementById('svc-id').value = item.id;
      document.getElementById('svc-name').value = item.name;
      document.getElementById('svc-category').value = item.category;
      document.getElementById('svc-value').value = item.value;
      document.getElementById('svc-due-date').value = item.due_date;
      document.getElementById('svc-notes').value = item.notes;
    }
  } else if (type === 'supplier') {
    const item = appState.suppliers.find(s => s.id == id);
    if (item) {
      document.getElementById('sup-id').value = item.id;
      document.getElementById('sup-name').value = item.name;
      document.getElementById('sup-category').value = item.category;
      document.getElementById('sup-price').value = item.price;
      document.getElementById('sup-rating').value = item.rating || 0;
      document.getElementById('sup-phone').value = item.contact_phone;
      document.getElementById('sup-email').value = item.contact_email;
      document.getElementById('sup-description').value = item.description;
      document.getElementById('sup-notes').value = item.notes;
    }
  }
}

// ==================== DETALHES (Modal Genérico) ====================
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
  
  // Configurar botões do modal
  document.getElementById('detailEditBtn').onclick = () => {
    bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
    editService(id);
  };
  document.getElementById('detailDeleteBtn').onclick = () => {
    if(confirm('Excluir este serviço?')) deleteService(id);
    bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
  };

  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function showSupplierDetail(id) {
  const s = appState.suppliers.find(x => x.id === id);
  if (!s) return;

  document.getElementById('detailModalTitle').textContent = s.name;
  document.getElementById('detailContent').innerHTML = `
    <span class="detail-label">Categoria:</span><span class="detail-value">${s.category}</span>
    <span class="detail-label">Preço do Pacote:</span><span class="detail-value text-primary">${formatCurrency(s.price)}</span>
    <span class="detail-label">Total Pago:</span><span class="detail-value text-success">${formatCurrency(s.paid)}</span>
    <span class="detail-label">Telefone:</span><span class="detail-value">${s.contact_phone || '—'}</span>
    <span class="detail-label">Email:</span><span class="detail-value">${s.contact_email || '—'}</span>
    <span class="detail-label">Descrição:</span><span class="detail-value">${s.description || '—'}</span>
  `;

  document.getElementById('detailEditBtn').onclick = () => {
    bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
    editSupplier(id);
  };
  document.getElementById('detailDeleteBtn').onclick = () => {
    if(confirm('Excluir este fornecedor?')) deleteSupplier(id);
    bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
  };

  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// ==================== LÓGICA DE CRUD ====================

// --- SERVIÇOS ---
async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('svc-id').value;
  const data = {
    name: document.getElementById('svc-name').value,
    category: document.getElementById('svc-category').value,
    value: parseFloat(document.getElementById('svc-value').value),
    due_date: document.getElementById('svc-due-date').value,
    notes: document.getElementById('svc-notes').value
  };

  let error;
  if (id) {
    ({ error } = await supabase.from('services').update(data).eq('id', id));
  } else {
    ({ error } = await supabase.from('services').insert([data]));
  }

  if (error) return showToast('Erro ao salvar serviço', 'danger');
  
  bootstrap.Modal.getInstance(document.getElementById('serviceModal')).hide();
  showToast('Serviço salvo com sucesso!');
  loadData();
}

function editService(id) { openModal('service', id); }

async function deleteService(id) {
  if (!confirm('Tem certeza? Isso apagará todos os pagamentos associados.')) return;
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return showToast('Erro ao excluir', 'danger');
  showToast('Serviço excluído!');
  loadData();
}

// --- FORNECEDORES ---
async function saveSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('sup-id').value;
  const data = {
    name: document.getElementById('sup-name').value,
    category: document.getElementById('sup-category').value,
    price: parseFloat(document.getElementById('sup-price').value),
    rating: parseInt(document.getElementById('sup-rating').value),
    contact_phone: document.getElementById('sup-phone').value,
    contact_email: document.getElementById('sup-email').value,
    description: document.getElementById('sup-description').value,
    notes: document.getElementById('sup-notes').value
  };

  let error;
  if (id) {
    ({ error } = await supabase.from('suppliers').update(data).eq('id', id));
  } else {
    ({ error } = await supabase.from('suppliers').insert([data]));
  }

  if (error) return showToast('Erro ao salvar fornecedor', 'danger');
  
  bootstrap.Modal.getInstance(document.getElementById('supplierModal')).hide();
  showToast('Fornecedor salvo!');
  loadData();
}

function editSupplier(id) { openModal('supplier', id); }

async function deleteSupplier(id) {
  if (!confirm('Excluir fornecedor?')) return;
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) return showToast('Erro ao excluir', 'danger');
  showToast('Fornecedor excluído!');
  loadData();
}

// --- PAGAMENTOS ---
function openPaymentForService(serviceId) {
  // Abre o modal e seleciona o serviço automaticamente
  openModal('payment');
  setTimeout(() => {
    const select = document.getElementById('pay-item');
    select.value = `service-${serviceId}`;
  }, 100); // Pequeno delay para garantir que o select está populado
}

async function registerPayment(e) {
  e.preventDefault();
  
  const rawItem = document.getElementById('pay-item').value;
  if (!rawItem) return showToast('Selecione um item para pagar', 'warning');

  const [type, idStr] = rawItem.split('-');
  const id = parseInt(idStr);

  const data = {
    entity_type: type,
    entity_id: id,
    amount: parseFloat(document.getElementById('pay-amount').value),
    payment_date: document.getElementById('pay-date').value,
    payment_method: document.getElementById('pay-method').value,
    description: document.getElementById('pay-description').value,
    receipt_number: document.getElementById('pay-receipt').value,
    status: 'completed'
  };

  // Inserir pagamento -> A Trigger do Supabase vai atualizar o campo 'paid' automaticamente!
  const { error } = await supabase.from('payments').insert([data]);

  if (error) return showToast('Erro ao registrar: ' + error.message, 'danger');

  bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
  showToast('Pagamento registrado com sucesso!');
  loadData();
}

async function deletePayment(id) {
  if (!confirm('Excluir pagamento? O saldo pago será recalculado.')) return;
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) return showToast('Erro ao excluir', 'danger');
  showToast('Pagamento excluído!');
  loadData();
}

// --- CONFIGURAÇÕES ---
async function saveSettings(e) {
  e.preventDefault();
  const data = {
    couple_name: document.getElementById('set-couple-name').value,
    wedding_date: document.getElementById('set-wedding-date').value,
    guest_count: parseInt(document.getElementById('set-guest-count').value),
    budget_total: parseFloat(document.getElementById('set-budget-total').value),
    theme: document.getElementById('set-theme').value,
    location: document.getElementById('set-location').value
  };

  const { error } = await supabase.from('wedding_settings').upsert([{ id: 1, ...data }], { onConflict: 'id' });
  
  if (error) return showToast('Erro ao salvar configurações', 'danger');
  showToast('Configurações salvas!');
  loadData();
}

// ==================== BUSCA (SEARCH) ====================
function initSearch() {
  document.getElementById('search-services')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#services-table-body tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });

  document.getElementById('search-payments')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#payments-table-body tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

// ==================== EXPORTAR ====================
function exportData() {
  const dataStr = JSON.stringify(appState, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "casamento_backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==================== INICIALIZAÇÃO FINAL ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('💍 CRM Casamento Iniciando...');
  
  // Listeners de Navegação
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showSection(el.dataset.section);
    });
  });

  // Listeners de Formulários
  document.getElementById('service-form')?.addEventListener('submit', saveService);
  document.getElementById('supplier-form')?.addEventListener('submit', saveSupplier);
  document.getElementById('payment-form')?.addEventListener('submit', registerPayment);
  document.getElementById('settings-form')?.addEventListener('submit', saveSettings);

  // Inicializações
  initModals();
  initSearch();
  
  // Carregar Dados Iniciais
  loadData();
});
