// Inicialização do Supabase
const { createClient } = window.supabase;
const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

// Estado Global
let services = [];
let suppliers = [];
let payments = [];
let settings = { id: 1 };

// Utilitários
const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data';
const getDaysLeft = (dateStr) => {
  if (!dateStr) return 'N/A';
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Navegação por Abas
document.querySelectorAll('[data-section]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = link.getAttribute('data-section');
    document.querySelectorAll('.section-box').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById(target)?.classList.add('active');
    link.classList.add('active');
  });
});

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
  initModals();
  initForms();
  await loadData();
  setupEventDelegation();
});

// --- CARREGAMENTO DE DADOS ---
async function loadData() {
  try {
    const [resSvc, resSup, resPay, resSet] = await Promise.all([
      supabase.from('services').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('wedding_settings').select('*').limit(1).single()
    ]);

    services = resSvc.data || [];
    suppliers = resSup.data || [];
    payments = resPay.data || [];
    settings = resSet.data || { id: 1 };

    renderAll();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    alert('Não foi possível conectar ao Supabase. Verifique suas chaves ou se as tabelas foram criadas.');
  }
}

// --- RENDERIZAÇÃO ---
function renderAll() {
  renderDashboard();
  renderServicesTable();
  renderSuppliersGrid();
  renderPaymentsTable();
  renderSettingsForm();
}

function renderDashboard() {
  const budget = settings.budget_total || 0;
  const totalPaid = services.reduce((a, b) => a + (b.paid || 0), 0) + suppliers.reduce((a, b) => a + (b.paid || 0), 0);
  const totalServices = services.reduce((a, b) => a + (b.value || 0), 0) + suppliers.reduce((a, b) => a + (b.price || 0), 0);
  const pending = Math.max(totalServices - totalPaid, 0);

  document.getElementById('dash-budget-total').textContent = formatBRL(budget);
  document.getElementById('dash-paid-total').textContent = formatBRL(totalPaid);
  document.getElementById('dash-pending-total').textContent = formatBRL(pending);
  document.getElementById('dash-days-left').textContent = getDaysLeft(settings.wedding_date);

  // Próximos Vencimentos
  const upcoming = services.filter(s => s.due_date && (s.value - (s.paid || 0)) > 0)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);
  const upList = document.getElementById('dash-upcoming');
  upList.innerHTML = upcoming.length ? upcoming.map(s => `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <div><strong>${s.name}</strong><br><small class="text-muted">${formatDate(s.due_date)}</small></div>
      <span class="badge bg-danger">${formatBRL(s.value - (s.paid || 0))}</span>
    </li>`).join('') : '<li class="list-group-item text-center text-muted">Nenhum vencimento próximo</li>';

  // Progresso
  const progress = totalServices > 0 ? Math.min((totalPaid / totalServices) * 100, 100) : 0;
  document.getElementById('dash-progress').innerHTML = `
    <div class="progress mt-2">
      <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%">${progress.toFixed(0)}%</div>
    </div>
    <small class="text-muted mt-1 d-block">${formatBRL(totalPaid)} de ${formatBRL(totalServices)}</small>`;

  // Atividade Recente (Últimos 5 pagamentos)
  const actList = document.getElementById('dash-activity');
  actList.innerHTML = payments.slice(0, 5).map(p => `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <strong>${p.description || 'Pagamento registrado'}</strong><br>
        <small class="text-muted">${formatDate(p.payment_date)} • ${p.payment_method.toUpperCase()}</small>
      </div>
      <span class="badge bg-success">${formatBRL(p.amount)}</span>
    </li>`).join('') || '<li class="list-group-item text-center text-muted">Nenhum pagamento registrado</li>';
}

function renderServicesTable() {
  const tbody = document.getElementById('services-table-body');
  if (!services.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum serviço cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = services.map(s => {
    const remaining = (s.value || 0) - (s.paid || 0);
    const status = remaining <= 0 ? 'Pago' : remaining === (s.value || 0) ? 'Pendente' : 'Parcial';
    const badgeClass = status === 'Pago' ? 'bg-success' : status === 'Parcial' ? 'bg-warning text-dark' : 'bg-danger';
    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.category || '-'}</td>
        <td class="text-end">${formatBRL(s.value)}</td>
        <td class="text-end text-success">${formatBRL(s.paid || 0)}</td>
        <td class="text-end text-danger">${formatBRL(remaining)}</td>
        <td>${formatDate(s.due_date)}</td>
        <td><span class="badge ${badgeClass} badge-status">${status}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${s.id}" data-type="service"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${s.id}" data-type="service"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function renderSuppliersGrid() {
  const container = document.getElementById('suppliers-container');
  if (!suppliers.length) {
    container.innerHTML = '<p class="text-center text-muted w-100">Nenhum fornecedor cadastrado</p>';
    return;
  }
  container.innerHTML = suppliers.map(s => `
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
          <p class="text-muted mb-1">${s.category} • ${formatBRL(s.price)}</p>
          ${s.description ? `<small class="d-block text-secondary mb-2">${s.description.substring(0, 80)}${s.description.length > 80 ? '...' : ''}</small>` : ''}
          <small class="d-block"><i class="bi bi-credit-card me-1"></i> Pago: <strong class="text-success">${formatBRL(s.paid || 0)}</strong></small>
        </div>
      </div>
    </div>`).join('');
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
        <td>${p.description || entity} <br><small class="text-muted">${p.entity_type}</small></td>
        <td class="text-end fw-bold text-success">${formatBRL(p.amount)}</td>
        <td><span class="badge bg-secondary">${p.payment_method.toUpperCase()}</span></td>
        <td><span class="badge bg-success">${p.status}</span></td>
        <td>${p.receipt_number || '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${p.id}" data-type="payment"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function renderSettingsForm() {
  if (!settings.id) settings.id = 1;
  document.getElementById('set-couple-name').value = settings.couple_name || '';
  document.getElementById('set-wedding-date').value = settings.wedding_date || '';
  document.getElementById('set-guest-count').value = settings.guest_count || '';
  document.getElementById('set-budget-total').value = settings.budget_total || '';
  document.getElementById('set-theme').value = settings.theme || '';
  document.getElementById('set-location').value = settings.location || '';
}

// --- MODAIS & FORMULÁRIOS ---
let currentEditId = null;
let currentEditType = null;

function initModals() {
  const svcModal = new bootstrap.Modal(document.getElementById('serviceModal'));
  const supModal = new bootstrap.Modal(document.getElementById('supplierModal'));
  const payModal = new bootstrap.Modal(document.getElementById('paymentModal'));

  window.openModal = (type, id = null) => {
    if (type === 'service') {
      document.getElementById('serviceModalTitle').textContent = id ? 'Editar Serviço' : 'Adicionar Serviço';
      svcModal.show();
    } else if (type === 'supplier') {
      document.getElementById('supplierModalTitle').textContent = id ? 'Editar Fornecedor' : 'Adicionar Fornecedor';
      supModal.show();
    } else if (type === 'payment') {
      payModal.show();
      populatePaymentSelects();
    }
    currentEditId = id;
    currentEditType = type;
  };

  window.closeAllModals = () => {
    svcModal.hide(); supModal.hide(); payModal.hide();
    resetForms();
  };
}

function resetForms() {
  document.getElementById('service-form').reset();
  document.getElementById('supplier-form').reset();
  document.getElementById('payment-form').reset();
  document.getElementById('svc-id').value = '';
  document.getElementById('sup-id').value = '';
}

function initForms() {
  // Serviço
  document.getElementById('service-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('svc-name').value,
      category: document.getElementById('svc-category').value,
      value: parseFloat(document.getElementById('svc-value').value) || 0,
      due_date: document.getElementById('svc-due-date').value || null,
      notes: document.getElementById('svc-notes').value
    };
    if (!currentEditId) {
      await supabase.from('services').insert([data]);
    } else {
      await supabase.from('services').update(data).eq('id', currentEditId);
    }
    closeAllModals(); await loadData();
  });

  // Fornecedor
  document.getElementById('supplier-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('sup-name').value,
      category: document.getElementById('sup-category').value,
      price: parseFloat(document.getElementById('sup-price').value) || 0,
      rating: parseInt(document.getElementById('sup-rating').value) || 0,
      description: document.getElementById('sup-description').value,
      notes: document.getElementById('sup-notes').value,
      contact_phone: document.getElementById('sup-phone').value,
      contact_email: document.getElementById('sup-email').value
    };
    if (!currentEditId) {
      await supabase.from('suppliers').insert([data]);
    } else {
      await supabase.from('suppliers').update(data).eq('id', currentEditId);
    }
    closeAllModals(); await loadData();
  });

  // Pagamento
  document.getElementById('payment-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      entity_type: document.getElementById('pay-type').value,
      entity_id: parseInt(document.getElementById('pay-item').value),
      amount: parseFloat(document.getElementById('pay-amount').value) || 0,
      payment_date: document.getElementById('pay-date').value,
      payment_method: document.getElementById('pay-method').value,
      description: document.getElementById('pay-description').value,
      receipt_number: document.getElementById('pay-receipt').value,
      status: 'completed'
    };
    await supabase.from('payments').insert([data]);
    closeAllModals(); await loadData();
  });

  // Configurações
  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      couple_name: document.getElementById('set-couple-name').value,
      wedding_date: document.getElementById('set-wedding-date').value || null,
      guest_count: parseInt(document.getElementById('set-guest-count').value) || 0,
      budget_total: parseFloat(document.getElementById('set-budget-total').value) || 0,
      theme: document.getElementById('set-theme').value,
      location: document.getElementById('set-location').value
    };
    const { count } = await supabase.from('wedding_settings').select('id').limit(1);
    if (count > 0) {
      await supabase.from('wedding_settings').update(data).eq('id', 1);
    } else {
      data.id = 1;
      await supabase.from('wedding_settings').insert([data]);
    }
    alert('Configurações salvas com sucesso!');
    await loadData();
  });
}

// --- DELEÇÃO ---
function setupEventDelegation() {
  document.body.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.action === 'new-service') window.openModal('service');
    else if (btn.dataset.action === 'new-supplier') window.openModal('supplier');
    else if (btn.dataset.action === 'new-payment') window.openModal('payment');
    else if (btn.classList.contains('btn-edit')) {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      currentEditId = id;
      currentEditType = type;
      fillEditForm(type, id);
      window.openModal(type, id);
    } 
    else if (btn.classList.contains('btn-delete')) {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      if (confirm(`Tem certeza que deseja excluir este ${type === 'payment' ? 'pagamento' : 'registro'}?`)) {
        await supabase.from(type === 'payment' ? 'payments' : type === 'service' ? 'services' : 'suppliers').delete().eq('id', id);
        await loadData();
      }
    }
  });

  document.getElementById('pay-type').addEventListener('change', populatePaymentSelects);
}

function populatePaymentSelects() {
  const type = document.getElementById('pay-type').value;
  const select = document.getElementById('pay-item');
  select.innerHTML = '<option value="">Selecione um item</option>';
  if (type === 'service') services.forEach(s => select.innerHTML += `<option value="${s.id}">${s.name}</option>`);
  if (type === 'supplier') suppliers.forEach(s => select.innerHTML += `<option value="${s.id}">${s.name}</option>`);
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
