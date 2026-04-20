import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const config = window.SUPABASE_CONFIG || {};
const hasValidConfig =
    config.url &&
    config.anonKey &&
    !String(config.url).includes('COLE') &&
    !String(config.anonKey).includes('COLE');

const supabase = hasValidConfig
    ? createClient(config.url, config.anonKey, {
          auth: {
              persistSession: false,
              autoRefreshToken: false
          }
      })
    : null;

// Sistema principal
        class WeddingCRM {
            constructor() {
                this.supabase = supabase;
                this.data = {
                    services: [],
                    suppliers: [],
                    selectedSuppliers: {},
                    recentPayments: [],
                    weddingSettings: {}
                };
                this.init();
            }

            async init() {
                this.setupEventListeners();
                await this.loadData();
                this.showStatus('Sistema carregado com sucesso!', 'success');
            }

            setupEventListeners() {
                // Navegação por abas
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const tabId = tab.getAttribute('data-tab');
                        this.switchTab(tabId);
                    });
                });

                // Formulários
                document.getElementById('service-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveService();
                });

                document.getElementById('supplier-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveSupplier();
                });

                document.getElementById('payment-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.registerPayment();
                });

                document.getElementById('wedding-settings-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveWeddingSettings();
                });

                // Atualizar opções de pagamento quando o tipo mudar
                document.getElementById('payment-entity-type').addEventListener('change', () => {
                    this.updatePaymentOptions();
                });

                // Fechar modais ao clicar fora
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            modal.style.display = 'none';
                        }
                    });
                });
            }

            async loadData() {
                try {
                    console.log("Iniciando carregamento de dados...");
                    const response = await this.apiCall('load_data');
                    
                    if (response.success) {
                        console.log("Dados carregados:", response.data);
                        this.data = response.data;
                        this.updateAllViews();
                        this.showStatus('Dados carregados com sucesso!', 'success');
                    } else {
                        throw new Error(response.error);
                    }
                } catch (error) {
                    console.error('Erro ao carregar dados:', error);
                    this.showStatus('Erro ao carregar dados: ' + error.message, 'error');
                }
            }

            switchTab(tabId) {
                // Esconder todas as abas
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.classList.remove('active');
                });

                // Mostrar aba selecionada
                document.getElementById(tabId).classList.add('active');
                document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');

                // Atualizar views específicas da aba
                if (tabId === 'dashboard') this.updateDashboard();
                if (tabId === 'services') this.updateServicesTab();
                if (tabId === 'suppliers') this.updateSuppliersTab();
                if (tabId === 'budget') this.updateBudgetTab();
                if (tabId === 'payments') this.updatePaymentsTab();
                if (tabId === 'settings') this.updateSettingsTab();
            }

            updateAllViews() {
                console.log("Atualizando todas as views...");
                console.log("Serviços:", this.data.services);
                console.log("Fornecedores:", this.data.suppliers);
                
                this.updateDashboard();
                this.updateServicesTab();
                this.updateSuppliersTab();
                this.updateBudgetTab();
                this.updatePaymentsTab();
                this.updateSettingsTab();
                this.updateSidebar();
            }

            updateDashboard() {
                // Calcular totais
                const servicesTotal = this.data.services.reduce((sum, s) => sum + parseFloat(s.value), 0);
                const selectedSuppliersTotal = Object.values(this.data.selectedSuppliers).reduce((sum, s) => sum + parseFloat(s.price), 0);
                const totalBudget = servicesTotal + selectedSuppliersTotal;
                
                const totalPaid = this.data.services.reduce((sum, s) => sum + parseFloat(s.paid), 0) +
                                this.data.suppliers.reduce((sum, s) => sum + parseFloat(s.paid), 0);

                // Atualizar estatísticas
                document.getElementById('total-budget').textContent = `R$ ${totalBudget.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                document.getElementById('total-paid').textContent = `R$ ${totalPaid.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                document.getElementById('total-pending').textContent = `R$ ${(totalBudget - totalPaid).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

                // Dias até o casamento
                if (this.data.weddingSettings.wedding_date) {
                    const weddingDate = new Date(this.data.weddingSettings.wedding_date);
                    const today = new Date();
                    const diffTime = weddingDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    document.getElementById('days-until-wedding').textContent = diffDays;
                }

                // Atividade recente
                this.updateRecentActivity();
            }

            updateRecentActivity() {
                const container = document.getElementById('recent-activity');
                const recentItems = [
                    ...this.data.services.slice(0, 3).map(s => ({
                        type: 'service',
                        name: s.name,
                        date: s.created_at,
                        value: s.value
                    })),
                    ...this.data.recentPayments.slice(0, 3).map(p => ({
                        type: 'payment',
                        name: p.entity_name,
                        date: p.payment_date,
                        value: p.amount
                    }))
                ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

                if (recentItems.length === 0) {
                    container.innerHTML = '<p class="text-muted">Nenhuma atividade recente</p>';
                    return;
                }

                container.innerHTML = recentItems.map(item => `
                    <div class="d-flex justify-between align-center mb-15">
                        <div>
                            <div class="d-flex align-center gap-10">
                                <i class="fas fa-${item.type === 'service' ? 'concierge-bell' : 'money-bill'} text-primary"></i>
                                <div>
                                    <div class="font-weight-600">${item.name}</div>
                                    <small class="text-muted">${new Date(item.date).toLocaleDateString('pt-BR')}</small>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-weight-600">R$ ${parseFloat(item.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                            <span class="badge ${item.type === 'service' ? 'badge-info' : 'badge-success'}">
                                ${item.type === 'service' ? 'Serviço' : 'Pagamento'}
                            </span>
                        </div>
                    </div>
                `).join('');
            }

            updateServicesTab() {
                const tbody = document.querySelector('#services-table tbody');
                
                if (this.data.services.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhum serviço cadastrado</td></tr>';
                    return;
                }

                tbody.innerHTML = this.data.services.map(service => {
                    const remaining = parseFloat(service.value) - parseFloat(service.paid);
                    const progress = parseFloat(service.value) > 0 ? (parseFloat(service.paid) / parseFloat(service.value)) * 100 : 0;
                    const status = remaining === 0 ? 'Pago' : (parseFloat(service.paid) > 0 ? 'Parcial' : 'Pendente');
                    const statusClass = remaining === 0 ? 'badge-success' : (parseFloat(service.paid) > 0 ? 'badge-warning' : 'badge-danger');

                    return `
                        <tr>
                            <td>
                                <div class="font-weight-600">${service.name}</div>
                                ${service.notes ? `<small class="text-muted">${service.notes}</small>` : ''}
                            </td>
                            <td>${this.getCategoryName(service.category)}</td>
                            <td class="font-weight-600">R$ ${parseFloat(service.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td class="text-success">R$ ${parseFloat(service.paid).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td class="text-danger">R$ ${remaining.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td>${service.due_date && service.due_date !== '0000-00-00' ? new Date(service.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                            <td><span class="badge ${statusClass}">${status}</span></td>
                            <td>
                                <div class="d-flex gap-10">
                                    <button class="btn btn-outline btn-sm" onclick="weddingCRM.openServiceModal(${service.id})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="weddingCRM.deleteService(${service.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            updateSuppliersTab() {
                const container = document.getElementById('suppliers-container');
                
                if (this.data.suppliers.length === 0) {
                    container.innerHTML = '<div class="card"><p class="text-center text-muted">Nenhum fornecedor cadastrado</p></div>';
                    return;
                }

                container.innerHTML = this.data.suppliers.map(supplier => {
                    const isSelected = this.data.selectedSuppliers[supplier.category]?.supplier_id === supplier.id;
                    const remaining = parseFloat(supplier.price) - parseFloat(supplier.paid);
                    const progress = parseFloat(supplier.price) > 0 ? (parseFloat(supplier.paid) / parseFloat(supplier.price)) * 100 : 0;

                    return `
                        <div class="supplier-card ${isSelected ? 'selected' : ''}">
                            <div class="supplier-header">
                                <h4 class="supplier-name">${supplier.name}</h4>
                                <div class="supplier-price">R$ ${parseFloat(supplier.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                            </div>
                            
                            <div class="mb-15">
                                <span class="badge badge-info">${this.getCategoryName(supplier.category)}</span>
                                ${isSelected ? '<span class="badge badge-success ml-5">Selecionado</span>' : ''}
                            </div>

                            ${supplier.description ? `<p class="mb-15">${supplier.description}</p>` : ''}

                            <div class="mb-15">
                                <div class="d-flex justify-between text-sm mb-5">
                                    <span>Progresso do Pagamento:</span>
                                    <span>${progress.toFixed(1)}%</span>
                                </div>
                                <div class="progress">
                                    <div class="progress-bar" style="width: ${progress}%"></div>
                                </div>
                                <div class="d-flex justify-between text-sm mt-5">
                                    <span class="text-success">Pago: R$ ${parseFloat(supplier.paid).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                    <span class="text-danger">Restante: R$ ${remaining.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>

                            <div class="d-flex gap-10 flex-wrap">
                                ${!isSelected ? `
                                    <button class="btn btn-success btn-sm" onclick="weddingCRM.selectSupplier('${supplier.category}', ${supplier.id})">
                                        <i class="fas fa-check"></i> Selecionar
                                    </button>
                                ` : ''}
                                <button class="btn btn-outline btn-sm" onclick="weddingCRM.openSupplierModal(${supplier.id})">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="weddingCRM.deleteSupplier(${supplier.id})">
                                    <i class="fas fa-trash"></i> Excluir
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="weddingCRM.openPaymentModal('supplier', ${supplier.id})">
                                    <i class="fas fa-money-bill"></i> Pagar
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            updateBudgetTab() {
                const summary = document.getElementById('budget-summary');
                const breakdown = document.getElementById('budget-breakdown');
                
                // Resumo
                const servicesTotal = this.data.services.reduce((sum, s) => sum + parseFloat(s.value), 0);
                const selectedSuppliersTotal = Object.values(this.data.selectedSuppliers).reduce((sum, s) => sum + parseFloat(s.price), 0);
                const total = servicesTotal + selectedSuppliersTotal;
                const totalPaid = this.data.services.reduce((sum, s) => sum + parseFloat(s.paid), 0) +
                                this.data.suppliers.reduce((sum, s) => sum + parseFloat(s.paid), 0);

                summary.innerHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Serviços Gerais</label>
                            <div class="font-weight-600 text-lg">R$ ${servicesTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fornecedores Selecionados</label>
                            <div class="font-weight-600 text-lg">R$ ${selectedSuppliersTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Total Contratado</label>
                            <div class="font-weight-600 text-lg text-primary">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Total Pago</label>
                            <div class="font-weight-600 text-lg text-success">R$ ${totalPaid.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>
                `;

                // Breakdown por categoria
                const categories = {};
                this.data.services.forEach(service => {
                    if (!categories[service.category]) categories[service.category] = 0;
                    categories[service.category] += parseFloat(service.value);
                });
                Object.values(this.data.selectedSuppliers).forEach(supplier => {
                    const category = Object.keys(this.data.selectedSuppliers).find(cat => 
                        this.data.selectedSuppliers[cat].supplier_id === supplier.supplier_id
                    );
                    if (category && !categories[category]) categories[category] = 0;
                    if (category) categories[category] += parseFloat(supplier.price);
                });

                breakdown.innerHTML = Object.entries(categories).map(([category, total]) => `
                    <div class="d-flex justify-between align-center mb-10">
                        <span>${this.getCategoryName(category)}</span>
                        <span class="font-weight-600">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                `).join('');
            }

            updatePaymentsTab() {
                const tbody = document.querySelector('#payments-table tbody');
                const payments = this.data.recentPayments;

                if (payments.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum pagamento registrado</td></tr>';
                    return;
                }

                tbody.innerHTML = payments.map(payment => `
                    <tr>
                        <td>${new Date(payment.payment_date).toLocaleDateString('pt-BR')}</td>
                        <td>
                            <div class="font-weight-600">${payment.entity_name}</div>
                            <small class="text-muted">${payment.description || 'Sem descrição'}</small>
                        </td>
                        <td class="font-weight-600 text-success">R$ ${parseFloat(payment.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        <td>
                            <span class="badge badge-info">${this.getPaymentMethodName(payment.payment_method)}</span>
                        </td>
                        <td>
                            <span class="badge badge-success">${payment.status === 'completed' ? 'Concluído' : payment.status}</span>
                        </td>
                        <td>
                            ${payment.receipt_number ? `
                                <small class="text-muted">Comprovante: ${payment.receipt_number}</small>
                            ` : ''}
                        </td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="weddingCRM.deletePayment(${payment.id})">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            updateSettingsTab() {
                if (this.data.weddingSettings) {
                    document.getElementById('couple-name').value = this.data.weddingSettings.couple_name || '';
                    document.getElementById('wedding-date').value = this.data.weddingSettings.wedding_date || '';
                    document.getElementById('guest-count').value = this.data.weddingSettings.guest_count || '';
                    document.getElementById('budget-total').value = this.data.weddingSettings.budget_total || '';
                    document.getElementById('wedding-theme').value = this.data.weddingSettings.theme || '';
                    document.getElementById('wedding-location').value = this.data.weddingSettings.location || '';
                }
            }

            updateSidebar() {
                // Próximos vencimentos
                const upcomingDue = document.getElementById('upcoming-due');
                const dueServices = this.data.services
                    .filter(s => s.due_date && s.due_date !== '0000-00-00' && new Date(s.due_date) >= new Date())
                    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                    .slice(0, 5);

                if (dueServices.length === 0) {
                    upcomingDue.innerHTML = '<p class="text-muted">Nenhum vencimento próximo</p>';
                } else {
                    upcomingDue.innerHTML = dueServices.map(service => `
                        <div class="d-flex justify-between align-center mb-10">
                            <div>
                                <div class="font-weight-600 text-sm">${service.name}</div>
                                <small class="text-muted">${new Date(service.due_date).toLocaleDateString('pt-BR')}</small>
                            </div>
                            <div class="text-right">
                                <div class="font-weight-600 text-sm">R$ ${parseFloat(service.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                                <span class="badge ${parseFloat(service.value) - parseFloat(service.paid) === 0 ? 'badge-success' : 'badge-warning'}">
                                    ${parseFloat(service.value) - parseFloat(service.paid) === 0 ? 'Pago' : 'Pendente'}
                                </span>
                            </div>
                        </div>
                    `).join('');
                }

                // Fornecedores selecionados
                const selectedContainer = document.getElementById('selected-suppliers');
                const selected = Object.entries(this.data.selectedSuppliers);

                if (selected.length === 0) {
                    selectedContainer.innerHTML = '<p class="text-muted">Nenhum fornecedor selecionado</p>';
                } else {
                    selectedContainer.innerHTML = selected.map(([category, supplier]) => `
                        <div class="d-flex justify-between align-center mb-10">
                            <div>
                                <div class="font-weight-600 text-sm">${supplier.supplier_name}</div>
                                <small class="text-muted">${this.getCategoryName(category)}</small>
                            </div>
                            <div class="text-success font-weight-600">R$ ${parseFloat(supplier.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                    `).join('');
                }

                // Progresso do orçamento
                const progressContainer = document.getElementById('budget-progress');
                const servicesTotal = this.data.services.reduce((sum, s) => sum + parseFloat(s.value), 0);
                const selectedSuppliersTotal = Object.values(this.data.selectedSuppliers).reduce((sum, s) => sum + parseFloat(s.price), 0);
                const total = servicesTotal + selectedSuppliersTotal;
                const totalPaid = this.data.services.reduce((sum, s) => sum + parseFloat(s.paid), 0) +
                                this.data.suppliers.reduce((sum, s) => sum + parseFloat(s.paid), 0);
                const progress = total > 0 ? (totalPaid / total) * 100 : 0;

                progressContainer.innerHTML = `
                    <div class="text-center mb-15">
                        <div class="stat-value">${progress.toFixed(1)}%</div>
                        <div class="stat-label">do orçamento pago</div>
                    </div>
                    <div class="progress" style="height: 12px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="d-flex justify-between text-sm mt-10">
                        <span>R$ ${totalPaid.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        <span>R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                `;
            }

            // Modal functions
            openServiceModal(serviceId = null) {
                const modal = document.getElementById('service-modal');
                const title = document.getElementById('service-modal-title');
                const form = document.getElementById('service-form');

                if (serviceId) {
                    title.textContent = 'Editar Serviço';
                    const service = this.data.services.find(s => s.id === serviceId);
                    if (service) {
                        document.getElementById('service-id').value = service.id;
                        document.getElementById('service-name').value = service.name;
                        document.getElementById('service-category').value = service.category;
                        document.getElementById('service-value').value = service.value;
                        document.getElementById('service-due-date').value = service.due_date || '';
                        document.getElementById('service-notes').value = service.notes || '';
                    }
                } else {
                    title.textContent = 'Adicionar Serviço';
                    form.reset();
                    document.getElementById('service-id').value = '';
                }
                modal.style.display = 'flex';
            }

            openSupplierModal(supplierId = null) {
                const modal = document.getElementById('supplier-modal');
                const title = document.getElementById('supplier-modal-title');
                const form = document.getElementById('supplier-form');

                if (supplierId) {
                    title.textContent = 'Editar Fornecedor';
                    const supplier = this.data.suppliers.find(s => s.id === supplierId);
                    if (supplier) {
                        document.getElementById('supplier-id').value = supplier.id;
                        document.getElementById('supplier-category').value = supplier.category;
                        document.getElementById('supplier-name').value = supplier.name;
                        document.getElementById('supplier-price').value = supplier.price;
                        document.getElementById('supplier-rating').value = supplier.rating || 0;
                        document.getElementById('supplier-phone').value = supplier.contact_phone || '';
                        document.getElementById('supplier-email').value = supplier.contact_email || '';
                        document.getElementById('supplier-description').value = supplier.description || '';
                        document.getElementById('supplier-notes').value = supplier.notes || '';
                    }
                } else {
                    title.textContent = 'Adicionar Fornecedor';
                    form.reset();
                    document.getElementById('supplier-id').value = '';
                    document.getElementById('supplier-rating').value = '0';
                }
                modal.style.display = 'flex';
            }

            openPaymentModal(entityType = null, entityId = null) {
                const modal = document.getElementById('payment-modal');
                
                if (entityType && entityId) {
                    document.getElementById('payment-entity-type').value = entityType;
                    document.getElementById('payment-entity-id').value = entityId;
                    this.updatePaymentOptions();
                } else {
                    document.getElementById('payment-form').reset();
                    document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
                }
                
                modal.style.display = 'flex';
            }

            updatePaymentOptions() {
                const entityType = document.getElementById('payment-entity-type').value;
                const select = document.getElementById('payment-entity-id');
                
                select.innerHTML = '<option value="">Selecione um item</option>';
                
                if (entityType === 'service') {
                    this.data.services.forEach(service => {
                        const option = document.createElement('option');
                        option.value = service.id;
                        option.textContent = `${service.name} (R$ ${parseFloat(service.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})})`;
                        select.appendChild(option);
                    });
                } else if (entityType === 'supplier') {
                    this.data.suppliers.forEach(supplier => {
                        const option = document.createElement('option');
                        option.value = supplier.id;
                        option.textContent = `${supplier.name} (R$ ${parseFloat(supplier.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})})`;
                        select.appendChild(option);
                    });
                }
            }

            closeModal(modalId) {
                document.getElementById(modalId).style.display = 'none';
            }

            // API Methods
            
            async apiCall(action, data = {}) {
                try {
                    if (!this.supabase) {
                        throw new Error('Supabase não configurado. Preencha js/config.js antes de publicar no GitHub Pages.');
                    }

                    switch (action) {
                        case 'load_data':
                            return await this.loadFromSupabase();

                        case 'save_service': {
                            const payload = {
                                name: data.name,
                                category: data.category,
                                value: Number(data.value || 0),
                                due_date: data.due_date || null,
                                notes: data.notes || ''
                            };

                            const { error } = await this.supabase
                                .from('services')
                                .insert(payload);

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'update_service': {
                            const payload = {
                                name: data.name,
                                category: data.category,
                                value: Number(data.value || 0),
                                due_date: data.due_date || null,
                                notes: data.notes || ''
                            };

                            const { error } = await this.supabase
                                .from('services')
                                .update(payload)
                                .eq('id', Number(data.id));

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'delete_service': {
                            const serviceId = Number(data.id);

                            const { error: paymentsError } = await this.supabase
                                .from('payments')
                                .delete()
                                .eq('entity_type', 'service')
                                .eq('entity_id', serviceId);

                            if (paymentsError) throw paymentsError;

                            const { error } = await this.supabase
                                .from('services')
                                .delete()
                                .eq('id', serviceId);

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'save_supplier': {
                            const payload = {
                                name: data.name,
                                category: data.category,
                                price: Number(data.price || 0),
                                description: data.description || '',
                                contact_phone: data.contact_phone || '',
                                contact_email: data.contact_email || '',
                                notes: data.notes || '',
                                rating: Number(data.rating || 0)
                            };

                            const { error } = await this.supabase
                                .from('suppliers')
                                .insert(payload);

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'update_supplier': {
                            const payload = {
                                name: data.name,
                                category: data.category,
                                price: Number(data.price || 0),
                                description: data.description || '',
                                contact_phone: data.contact_phone || '',
                                contact_email: data.contact_email || '',
                                notes: data.notes || '',
                                rating: Number(data.rating || 0)
                            };

                            const { error } = await this.supabase
                                .from('suppliers')
                                .update(payload)
                                .eq('id', Number(data.id));

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'delete_supplier': {
                            const supplierId = Number(data.id);

                            const { error: paymentsError } = await this.supabase
                                .from('payments')
                                .delete()
                                .eq('entity_type', 'supplier')
                                .eq('entity_id', supplierId);

                            if (paymentsError) throw paymentsError;

                            const { error } = await this.supabase
                                .from('suppliers')
                                .delete()
                                .eq('id', supplierId);

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'select_supplier': {
                            const payload = {
                                category: data.category,
                                supplier_id: Number(data.supplier_id)
                            };

                            const { error } = await this.supabase
                                .from('selected_suppliers')
                                .upsert(payload, { onConflict: 'category' });

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'register_payment': {
                            const payload = {
                                entity_type: data.entity_type,
                                entity_id: Number(data.entity_id),
                                amount: Number(data.amount || 0),
                                payment_method: data.payment_method || null,
                                payment_date: data.payment_date || null,
                                description: data.description || '',
                                receipt_number: data.receipt_number || '',
                                status: 'completed'
                            };

                            const { error } = await this.supabase
                                .from('payments')
                                .insert(payload);

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'delete_payment': {
                            const { error } = await this.supabase
                                .from('payments')
                                .delete()
                                .eq('id', Number(data.payment_id));

                            if (error) throw error;
                            return { success: true };
                        }

                        case 'save_wedding_settings': {
                            const payload = {
                                id: 1,
                                couple_name: data.couple_name || '',
                                wedding_date: data.wedding_date || null,
                                guest_count: data.guest_count ? Number(data.guest_count) : null,
                                budget_total: data.budget_total ? Number(data.budget_total) : null,
                                theme: data.theme || '',
                                location: data.location || ''
                            };

                            const { error } = await this.supabase
                                .from('wedding_settings')
                                .upsert(payload, { onConflict: 'id' });

                            if (error) throw error;
                            return { success: true };
                        }

                        default:
                            throw new Error(`Ação não suportada: ${action}`);
                    }
                } catch (error) {
                    console.error('Supabase Error:', error);
                    const message = error?.message || 'Erro desconhecido';
                    return { success: false, error: message };
                }
            }

            async loadFromSupabase() {
                const [servicesRes, suppliersRes, selectedRes, paymentsRes, settingsRes] = await Promise.all([
                    this.supabase
                        .from('services')
                        .select('*')
                        .order('created_at', { ascending: false }),
                    this.supabase
                        .from('suppliers')
                        .select('*')
                        .order('name', { ascending: true }),
                    this.supabase
                        .from('selected_suppliers')
                        .select('category, supplier_id, supplier:suppliers!selected_suppliers_supplier_id_fkey(id, name, price)'),
                    this.supabase
                        .from('payments')
                        .select('*')
                        .order('payment_date', { ascending: false })
                        .limit(10),
                    this.supabase
                        .from('wedding_settings')
                        .select('*')
                        .eq('id', 1)
                        .maybeSingle()
                ]);

                for (const res of [servicesRes, suppliersRes, selectedRes, paymentsRes, settingsRes]) {
                    if (res.error) throw res.error;
                }

                const services = (servicesRes.data || []).map((item) => ({
                    ...item,
                    id: Number(item.id),
                    value: Number(item.value || 0),
                    paid: Number(item.paid || 0)
                }));

                const suppliers = (suppliersRes.data || []).map((item) => ({
                    ...item,
                    id: Number(item.id),
                    price: Number(item.price || 0),
                    rating: Number(item.rating || 0),
                    paid: Number(item.paid || 0)
                }));

                const serviceMap = new Map(services.map((item) => [Number(item.id), item.name]));
                const supplierMap = new Map(suppliers.map((item) => [Number(item.id), item.name]));

                const selectedSuppliers = {};
                for (const item of selectedRes.data || []) {
                    const supplier = item.supplier;
                    selectedSuppliers[item.category] = {
                        supplier_id: Number(item.supplier_id),
                        supplier_name: supplier?.name || 'Fornecedor removido',
                        price: Number(supplier?.price || 0)
                    };
                }

                const recentPayments = (paymentsRes.data || []).map((payment) => ({
                    ...payment,
                    id: Number(payment.id),
                    entity_id: Number(payment.entity_id),
                    amount: Number(payment.amount || 0),
                    entity_name:
                        payment.entity_type === 'service'
                            ? (serviceMap.get(Number(payment.entity_id)) || 'Serviço removido')
                            : (supplierMap.get(Number(payment.entity_id)) || 'Fornecedor removido')
                }));

                return {
                    success: true,
                    data: {
                        services,
                        suppliers,
                        selectedSuppliers,
                        recentPayments,
                        weddingSettings: settingsRes.data || {}
                    }
                };
            }

            async saveService() {
                try {
                    const formData = {
                        name: document.getElementById('service-name').value,
                        category: document.getElementById('service-category').value,
                        value: document.getElementById('service-value').value,
                        due_date: document.getElementById('service-due-date').value || null,
                        notes: document.getElementById('service-notes').value
                    };

                    const serviceId = document.getElementById('service-id').value;
                    const action = serviceId ? 'update_service' : 'save_service';
                    
                    if (serviceId) {
                        formData.id = serviceId;
                    }

                    const result = await this.apiCall(action, formData);
                    
                    if (result.success) {
                        this.closeModal('service-modal');
                        await this.loadData();
                        this.showStatus('Serviço salvo com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao salvar serviço: ' + error.message, 'error');
                }
            }

            async deleteService(serviceId) {
                if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

                try {
                    const result = await this.apiCall('delete_service', { id: serviceId });
                    
                    if (result.success) {
                        await this.loadData();
                        this.showStatus('Serviço excluído com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao excluir serviço: ' + error.message, 'error');
                }
            }

            async saveSupplier() {
                try {
                    const formData = {
                        name: document.getElementById('supplier-name').value,
                        category: document.getElementById('supplier-category').value,
                        price: document.getElementById('supplier-price').value,
                        description: document.getElementById('supplier-description').value,
                        contact_phone: document.getElementById('supplier-phone').value,
                        contact_email: document.getElementById('supplier-email').value,
                        notes: document.getElementById('supplier-notes').value,
                        rating: document.getElementById('supplier-rating').value
                    };

                    const supplierId = document.getElementById('supplier-id').value;
                    const action = supplierId ? 'update_supplier' : 'save_supplier';
                    
                    if (supplierId) {
                        formData.id = supplierId;
                    }

                    const result = await this.apiCall(action, formData);
                    
                    if (result.success) {
                        this.closeModal('supplier-modal');
                        await this.loadData();
                        this.showStatus('Fornecedor salvo com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao salvar fornecedor: ' + error.message, 'error');
                }
            }

            async deleteSupplier(supplierId) {
                if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;

                try {
                    const result = await this.apiCall('delete_supplier', { id: supplierId });
                    
                    if (result.success) {
                        await this.loadData();
                        this.showStatus('Fornecedor excluído com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao excluir fornecedor: ' + error.message, 'error');
                }
            }

            async selectSupplier(category, supplierId) {
                try {
                    const result = await this.apiCall('select_supplier', {
                        category: category,
                        supplier_id: supplierId
                    });
                    
                    if (result.success) {
                        await this.loadData();
                        this.showStatus('Fornecedor selecionado com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao selecionar fornecedor: ' + error.message, 'error');
                }
            }

            async registerPayment() {
                try {
                    const formData = {
                        entity_type: document.getElementById('payment-entity-type').value,
                        entity_id: document.getElementById('payment-entity-id').value,
                        amount: document.getElementById('payment-amount').value,
                        payment_method: document.getElementById('payment-method').value,
                        payment_date: document.getElementById('payment-date').value,
                        description: document.getElementById('payment-description').value,
                        receipt_number: document.getElementById('payment-receipt').value
                    };

                    const result = await this.apiCall('register_payment', formData);
                    
                    if (result.success) {
                        this.closeModal('payment-modal');
                        await this.loadData();
                        this.showStatus('Pagamento registrado com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao registrar pagamento: ' + error.message, 'error');
                }
            }

            // NOVA FUNÇÃO: Excluir pagamento
            async deletePayment(paymentId) {
                if (!confirm('Tem certeza que deseja excluir este pagamento? O valor será subtraído do serviço/fornecedor.')) return;

                try {
                    const result = await this.apiCall('delete_payment', { payment_id: paymentId });
                    
                    if (result.success) {
                        await this.loadData();
                        this.showStatus('Pagamento excluído com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao excluir pagamento: ' + error.message, 'error');
                }
            }

            async saveWeddingSettings() {
                try {
                    const formData = {
                        couple_name: document.getElementById('couple-name').value,
                        wedding_date: document.getElementById('wedding-date').value,
                        guest_count: document.getElementById('guest-count').value,
                        budget_total: document.getElementById('budget-total').value,
                        theme: document.getElementById('wedding-theme').value,
                        location: document.getElementById('wedding-location').value
                    };

                    const result = await this.apiCall('save_wedding_settings', formData);
                    
                    if (result.success) {
                        await this.loadData();
                        this.showStatus('Configurações salvas com sucesso!', 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    this.showStatus('Erro ao salvar configurações: ' + error.message, 'error');
                }
            }

            // Utility methods
            getCategoryName(category) {
                const names = {
                    'vestuario': 'Vestuário',
                    'beleza': 'Beleza e Maquiagem',
                    'cerimonia': 'Cerimônia',
                    'recepcao': 'Recepção',
                    'hospedagem': 'Hospedagem',
                    'transporte': 'Transporte',
                    'lua-de-mel': 'Lua de Mel',
                    'photographers': 'Fotógrafos',
                    'buffet': 'Buffet e Doces',
                    'decoracao': 'Decoração',
                    'music': 'Música e Som',
                    'florista': 'Florista',
                    'cerimonia': 'Cerimonialista',
                    'outros': 'Outros'
                };
                return names[category] || category;
            }

            getPaymentMethodName(method) {
                const names = {
                    'cash': 'Dinheiro',
                    'card': 'Cartão',
                    'transfer': 'Transferência',
                    'pix': 'PIX'
                };
                return names[method] || method;
            }

            showStatus(message, type = 'success') {
                const statusEl = document.getElementById('status-message');
                statusEl.textContent = message;
                statusEl.className = `status-message status-${type}`;
                statusEl.style.display = 'block';
                
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 5000);
            }
        }

        // Inicializar o sistema
        let weddingCRM;
        document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM Carregado - Inicializando WeddingCRM");
            weddingCRM = new WeddingCRM();
        });

        // Funções globais para acesso via HTML
        function openServiceModal(serviceId = null) {
            weddingCRM.openServiceModal(serviceId);
        }

        function openSupplierModal(supplierId = null) {
            weddingCRM.openSupplierModal(supplierId);
        }

        function openPaymentModal(entityType = null, entityId = null) {
            weddingCRM.openPaymentModal(entityType, entityId);
        }

        function closeModal(modalId) {
            weddingCRM.closeModal(modalId);
        }

        function loadData() {
            weddingCRM.loadData();
        }
