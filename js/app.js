/**
 * CRM Casamento Perfeito - App JavaScript
 * Conecta ao Supabase, gerencia dados e interface
 */

// ==================== INICIALIZAÇÃO ====================
const { createClient } = window.supabase;
const supabase = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

// Estado global
let services = [];
let suppliers = [];
let payments = [];
let settings = { id: 1 };
let currentEdit = { type: null, id: null };

// ==================== UTILITÁRIOS ====================
const formatBRL = (value) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDate = (dateStr) => 
  dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const getDaysLeft = (dateStr) => {
  if (!dateStr) return '—';
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const showMessage = (text, type = 'success') => {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = text;
  el.className = `status-message status-${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
};

// ==================== NAVEGAÇÃO ====================
function initNavigation() {
  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      
      // Atualizar abas
      document.querySelectorAll('.section-box').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
      
      document.getElementById(target)?.classList.add('active');
      link.classList.add('active');
    });
  });
}

// ==================== CARREGAMENTO DE DADOS ====================
async function loadData() {
  try {
    console.log('📡 Carregando dados do Supabase...');
    
    const [resSvc, resSup, resPay, resSet] = await Promise.all([
      supabase.from('services').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('wedding_settings').select('*').limit(1).single()
    ]);

    if (resSvc.error) throw new Error('Serviços: ' + resSvc.error.message);
    if (resSup.error) throw new Error('Fornecedores: ' + resSup.error.message);
    if (resPay.error) throw new Error('Pagamentos: ' + resPay.error.message);

    services = resSvc.data || [];
    suppliers = resSup.data || [];
    payments = resPay.data || [];
    settings = resSet.data || { id: 1 };

    console.log('✅ Dados carregados:', { 
      serviços: services.length, 
      fornecedores: suppliers.length, 
      pagamentos: payments.length 
    });

    renderAll();
  } catch (err) {
    console.error('❌ Erro ao carregar:', err);
    showMessage('Erro ao conectar com o banco de dados', 'error');
  }
}

// ==================== RENDERIZAÇÃO ====================
function renderAll() {
  renderDashboard();
  renderServicesTable();
  renderSuppliersGrid();
  renderPaymentsTable();
  renderSettingsForm();
}

function renderDashboard() {
  // 🔥 CÁLCULO CORRETO DO ORÇAMENTO TOTAL
  const budgetConfig = settings.budget_total || 0;
  const totalServices = services.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const totalSuppliers = suppliers.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  
  // Se houver orçamento configurado, usa ele; senão, soma automática
  const totalBudget = budgetConfig > 0 ? budgetConfig : (totalServices + totalSuppliers);
  
  const totalPaid = services.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0) + 
                   suppliers.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0);
  const pending = Math.max(totalBudget - totalPaid, 0);

  // Atualizar cards
  document.getElementById('dash-budget-total').textContent = formatBRL(totalBudget);
  document.getElementById('dash-paid-total').textContent = formatBRL(totalPaid);
  document.getElementById('dash-pending-total').textContent = formatBRL(pending);
  document.getElementById('dash-days-left').textContent = getDaysLeft(settings.wedding_date);

  // Próximos vencimentos
  const upcoming = services
    .filter(s => s.due_date && (parseFloat(s.value) - parseFloat(s.paid || 0)) > 0)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);
  
  const upList = document.getElementById('dash-upcoming');
  if (upcoming.length === 0) {
    upList.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum vencimento próximo</li>';
  } else {
    upList.innerHTML = upcoming.map(s => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div><strong>${s.name}</strong><br><small class="text-muted">${formatDate(s.due_date)}</small></div>
        <span class="badge bg-danger">${formatBRL((s.value || 0) - (s.paid || 0))}</span>
      </li>
    `).join('');
  }

  // Progresso do orçamento
  const progress = totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0;
  document.getElementById('dash-progress').innerHTML = `
    <div class="progress" style="height: 10px;">
      <div class="progress-bar bg-success" style="width: ${progress}%"></div>
    </div>
    <small class="text-muted d-block mt-1">${formatBRL(totalPaid)} de ${formatBRL(totalBudget)} (${progress.toFixed(0)}%)</small>
  `;

  // Atividade recente
  const actList = document.getElementById('dash-activity');
  if (payments.length === 0) {
    actList.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum pagamento registrado</li>';
  } else {
    actList.innerHTML = payments.slice(0, 5).map(p => {
      const entity = p.entity_type === 'service' 
        ? services.find(s => s.id === p.entity_id)?.name || 'Serviço' 
        : suppliers.find(s => s.id === p.entity_id)?.name || 'Fornecedor';
      return `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div><strong>${p.description || entity}</strong><br><small class="text-muted">${formatDate(p.payment_date)} • ${p.payment_method?.toUpperCase()}</small></div>
          <span class="badge bg-success">${formatBRL(p.amount)}</span>
        </li>
      `;
    }).join('');
  }
}

function renderServicesTable() {
  const tbody = document.getElementById('services-table-body');
  if (!services.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum serviço cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = services.map(s => {
    const value = parseFloat(s.value) || 0;
    const paid = parseFloat(s.paid) || 0;
    const remaining = value - paid;
    const status = remaining <= 0 ? 'Pago' : remaining === value ? 'Pendente' : 'Parcial';
    const badge = status === 'Pago' ? 'bg-success' : status === 'Parcial' ? 'bg-warning text-dark' : 'bg-danger';
    
    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.category || '—'}</td>
        <td class="text-end">${formatBRL(value)}</td>
        <td class="text-end text-success">${formatBRL(paid)}</td>
        <td class="text-end text-danger">${formatBRL(remaining)}</td>
        <td>${formatDate(s.due_date)}</td>
        <td><span class="badge ${badge} badge-status">${status}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${s.id}" data-type="service"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${s.id}" data-type="service"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSuppliersGrid() {
  const container = document.getElementById('suppliers-container');
  if (!suppliers.length) {
    container.innerHTML = '<p class="text-center text-muted w-100">Nenhum fornecedor cadastrado</p>';
    return;
  }

  container.innerHTML = suppliers.map(s => {
    const paid = parseFloat(s.paid) || 0;
    const price = parseFloat(s.price) || 0;
    return `
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${s.name}</h5>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-light btn-edit" data-id="${s.id}" data-type="supplier"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-light btn-delete text-danger" data-id="${s.id}" data-type="supplier"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            <p class="text-muted mb-1">${s.category} • ${formatBRL(price)}</p>
            ${s.description ? `<small class="d-block text-secondary mb-2">${s.description.substring(0, 80)}${s.description.length > 80 ? '...' : ''}</small>` : ''}
            <small class="d-block"><i class="bi bi-check-circle text-success me-1"></i> Pago: <strong>${formatBRL(paid)}</strong></small>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPaymentsTable() {
  const tbody = document.getElementById('payments-table-body');
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum pagamento registrado</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map(p => {
    const entity = p.entity_type === 'service' 
      ? services.find(s => s.id === p.entity_id)?.name || 'Serviço' 
      : suppliers.find(s => s.id === p.entity_id)?.name || 'Fornecedor';
    
    return `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.description || entity}<br><small class="text-muted">${p.entity_type}</small></td>
        <td class="text-end fw-bold text-success">${formatBRL(p.amount)}</td>
        <td><span class="badge bg-secondary">${(p.payment_method || '').toUpperCase()}</span></td>
        <td><span class="badge bg-success">${p.status}</span></td>
        <td>${p.receipt_number || '—'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${p.id}" data-type="payment"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSettingsForm() {
  if (!settings) settings = { id: 1 };
  document.getElementById('set-couple-name').value = settings.couple_name || '';
  document.getElementById('set-wedding-date').value = settings.wedding_date || '';
  document.getElementById('set-guest-count').value = settings.guest_count || '';
  document.getElementById('set-budget-total').value = settings.budget_total || '';
  document.getElementById('set-theme').value = settings.theme || '';
  document.getElementById('set-location').value = settings.location || '';
}

// ==================== MODAIS ====================
function initModals() {
  // Abrir modais via botões com data-action
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = btn.dataset.action;
      if (action === 'new-service') openModal('service');
      if (action === 'new-supplier') openModal('supplier');
      if (action === 'new-payment') { openModal('payment'); populatePaymentSelects(); }
    });
  });

  // Fechar modais
  document.querySelectorAll('.modal-close, [data-bs-dismiss="modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => {
        const modal = bootstrap.Modal.getInstance(m);
        if (modal) modal.hide();
      });
      resetForms();
    });
  });

  // Fechar ao clicar fora
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        const instance = bootstrap.Modal.getInstance(modal);
        if (instance) instance.hide();
        resetForms();
      }
    });
  });
}

function openModal(type, id = null) {
  currentEdit = { type, id };
  const modalId = type === 'service' ? 'serviceModal' : type === 'supplier' ? 'supplierModal' : 'paymentModal';
  const titleId = type === 'service' ? 'serviceModalTitle' : 'supplierModalTitle';
  
  if (titleId && document.getElementById(titleId)) {
    document.getElementById(titleId).textContent = id ? `Editar ${type === 'service' ? 'Serviço' : 'Fornecedor'}` : `Adicionar ${type === 'service' ? 'Serviço' : 'Fornecedor'}`;
  }
  
  const modal = new bootstrap.Modal(document.getElementById(modalId));
  modal.show();
  
  if (id && type !== 'payment') fillEditForm(type, id);
}

function resetForms() {
  document.getElementById('service-form')?.reset();
  document.getElementById('supplier-form')?.reset();
  document.getElementById('payment-form')?.reset();
  document.getElementById('svc-id') && (document.getElementById('svc-id').value = '');
  document.getElementById('sup-id') && (document.getElementById('sup-id').value = '');
  currentEdit = { type: null, id: null };
}

function fillEditForm(type, id) {
  if (type === 'service') {
    const item = services.find(s => s.id == id);
    if (item) {
      document.getElementById('svc-id').value = item.id;
      document.getElementById('svc-name').value = item.name;
      document.getElementById('svc-category').value = item.category;
      document.getElementById('svc-value').value = item.value;
      document.getElementById('svc-due-date').value = item.due_date || '';
      document.getElementById('svc-notes').value = item.notes || '';
    }
  } else if (type === 'supplier') {
    const item = suppliers.find(s => s.id == id);
    if (item) {
      document.getElementById('sup-id').value = item.id;
      document.getElementById('sup-name').value = item.name;
      document.getElementById('sup-category').value = item.category;
      document.getElementById('sup-price').value = item.price;
      document.getElementById('sup-rating').value = item.rating || 0;
      document.getElementById('sup-description').value = item.description || '';
      document.getElementById('sup-notes').value = item.notes || '';
      document.getElementById('sup-phone').value = item.contact_phone || '';
      document.getElementById('sup-email').value = item.contact_email || '';
    }
  }
}

// ==================== FORMULÁRIOS ====================
function initForms() {
  // Serviço
  document.getElementById('service-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('svc-name').value,
      category: document.getElementById('svc-category').value,
      value: parseFloat(document.getElementById('svc-value').value) || 0,
      due_date: document.getElementById('svc-due-date').value || null,
      notes: document.getElementById('svc-notes').value || ''
    };

    try {
      if (currentEdit.id) {
        await supabase.from('services').update(data).eq('id', currentEdit.id);
      } else {
        await supabase.from('services').insert([data]);
      }
      bootstrap.Modal.getInstance(document.getElementById('serviceModal'))?.hide();
      resetForms();
      await loadData();
      showMessage('Serviço salvo com sucesso!');
    } catch (err) {
      showMessage('Erro ao salvar: ' + err.message, 'error');
    }
  });

  // Fornecedor
  document.getElementById('supplier-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('sup-name').value,
      category: document.getElementById('sup-category').value,
      price: parseFloat(document.getElementById('sup-price').value) || 0,
      rating: parseInt(document.getElementById('sup-rating').value) || 0,
      description: document.getElementById('sup-description').value || '',
      notes: document.getElementById('sup-notes').value || '',
      contact_phone: document.getElementById('sup-phone').value || '',
      contact_email: document.getElementById('sup-email').value || ''
    };

    try {
      if (currentEdit.id) {
        await supabase.from('suppliers').update(data).eq('id', currentEdit.id);
      } else {
        await supabase.from('suppliers').insert([data]);
      }
      bootstrap.Modal.getInstance(document.getElementById('supplierModal'))?.hide();
      resetForms();
      await loadData();
      showMessage('Fornecedor salvo com sucesso!');
    } catch (err) {
      showMessage('Erro ao salvar: ' + err.message, 'error');
    }
  });

  // Pagamento
  document.getElementById('payment-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      entity_type: document.getElementById('pay-type').value,
      entity_id: parseInt(document.getElementById('pay-item').value),
      amount: parseFloat(document.getElementById('pay-amount').value) || 0,
      payment_method: document.getElementById('pay-method').value,
      payment_date: document.getElementById('pay-date').value,
      description: document.getElementById('pay-description').value || '',
      receipt_number: document.getElementById('pay-receipt').value || '',
      status: 'completed'
    };

    try {
      await supabase.from('payments').insert([data]);
      bootstrap.Modal.getInstance(document.getElementById('paymentModal'))?.hide();
      document.getElementById('payment-form').reset();
      await loadData();
      showMessage('Pagamento registrado!');
    } catch (err) {
      showMessage('Erro ao registrar: ' + err.message, 'error');
    }
  });

  // Configurações
  document.getElementById('settings-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      couple_name: document.getElementById('set-couple-name').value,
      wedding_date: document.getElementById('set-wedding-date').value || null,
      guest_count: parseInt(document.getElementById('set-guest-count').value) || 0,
      budget_total: parseFloat(document.getElementById('set-budget-total').value) || 0,
      theme: document.getElementById('set-theme').value || '',
      location: document.getElementById('set-location').value || ''
    };

    try {
      const { count } = await supabase.from('wedding_settings').select('id').limit(1);
      if (count > 0) {
        await supabase.from('wedding_settings').update(data).eq('id', 1);
      } else {
        await supabase.from('wedding_settings').insert([{ ...data, id: 1 }]);
      }
      settings = { ...settings, ...data };
      await loadData();
      showMessage('Configurações salvas!');
    } catch (err) {
      showMessage('Erro ao salvar: ' + err.message, 'error');
    }
  });
}

// ==================== EVENTOS ====================
function setupEvents() {
  // Edição e exclusão
  document.body.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Editar
    if (btn.classList.contains('btn-edit')) {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      currentEdit = { type, id };
      fillEditForm(type, id);
      openModal(type, id);
    }
    
    // Excluir
    if (btn.classList.contains('btn-delete')) {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      const label = type === 'payment' ? 'pagamento' : type === 'service' ? 'serviço' : 'fornecedor';
      
      if (confirm(`Tem certeza que deseja excluir este ${label}?`)) {
        try {
          const table = type === 'payment' ? 'payments' : type === 'service' ? 'services' : 'suppliers';
          await supabase.from(table).delete().eq('id', id);
          await loadData();
          showMessage(`${label} excluído!`);
        } catch (err) {
          showMessage('Erro ao excluir: ' + err.message, 'error');
        }
      }
    }
  });

  // Select dinâmico de pagamentos
  document.getElementById('pay-type')?.addEventListener('change', populatePaymentSelects);

  // Botão de atualizar dashboard
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadData);
}

function populatePaymentSelects() {
  const type = document.getElementById('pay-type')?.value;
  const select = document.getElementById('pay-item');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione um item</option>';
  
  if (type === 'service') {
    services.forEach(s => {
      select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
  } else if (type === 'supplier') {
    suppliers.forEach(s => {
      select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
  }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 CRM Casamento - Iniciando...');
  
  initNavigation();
  initModals();
  initForms();
  setupEvents();
  loadData();
});
