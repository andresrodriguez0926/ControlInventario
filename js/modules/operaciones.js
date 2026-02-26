/**
 * Módulos de Operaciones Transaccionales
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

// Helpers
function generateSelectOptions(items, defaultText) {
    if (items.length === 0) return `<option value="" disabled selected>No hay registros. Creados primero en catálogo.</option>`;
    return `<option value="" disabled selected>${defaultText}</option>` +
        items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
}

// ==========================================
// 1. RECEPCIÓN DE MERCANCÍA
// ==========================================
window.appModules['recepcion'] = () => {
    const productores = window.appStore.getProductores();
    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();

    const today = new Date();
    // Prevenir problemas de zona horaria usando format local
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
    const maxDate = localISOTime;

    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() - 3);
    const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
    const minDate = minLocalISOTime;

    const isAdmin = window.appStore.currentUser && (window.appStore.currentUser.rol?.toLowerCase() === 'admin' || window.appStore.currentUser.rol?.toLowerCase() === 'administrador');

    // Obtener y filtrar historial reciente
    const historial = window.appStore.getActividad(200).filter(a => a.operacion === 'Recepción');

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <h2 class="text-2xl md:text-3xl font-bold text-white mb-2 text-center uppercase tracking-wide">Recepción de Mercancía</h2>
            <p class="text-text-secondary mb-6 text-center">Ingreso de fruta desde los productores hacia los almacenes.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nueva Recepción</button>
                <button id="tab-btn-historial" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA RECEPCIÓN -->
            <div id="tab-content-nueva" class="block">
                <form id="form-recepcion" class="surface-card p-6 md:p-8">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                        
                        <div class="form-group">
                            <label class="form-label mb-1">Fecha:</label>
                            <input type="date" id="rec-fecha" class="form-input text-sm py-1" required min="${minDate}" max="${maxDate}" value="${maxDate}">
                        </div>

                        <div class="form-group">
                            <label class="form-label mb-1">No. de conduce (Opcional):</label>
                            <input type="text" id="rec-conduce" class="form-input" placeholder="Ej: COND-12345">
                        </div>

                        <div class="form-group">
                            <label class="form-label mb-1">Persona que entrega:</label>
                            <input type="text" id="rec-entrega" class="form-input" required placeholder="P. ej. Juan Pérez">
                        </div>

                        <div class="form-group">
                            <label class="form-label mb-1">Nombre del Productor:</label>
                            <select id="rec-productor" class="form-select" required>
                                ${generateSelectOptions(productores, 'Seleccione un productor...')}
                            </select>
                        </div>

                        <div class="form-group md:col-span-3 lg:col-span-1">
                            <label class="form-label mb-1">Persona que recibe:</label>
                            <input type="text" id="rec-recibe" class="form-input" required placeholder="P. ej. María Gómez">
                        </div>
                        
                        <div class="form-group md:col-span-3 mt-2">
                            <button type="button" id="btn-add-rec-lote" class="btn btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity uppercase shadow-lg shadow-primary/20">
                                <i data-lucide="plus-circle" class="w-5 h-5"></i> Añadir Mercancía
                            </button>
                        </div>

                        <div class="form-group md:col-span-3">
                            <div class="overflow-x-auto rounded-lg border border-border">
                                <table class="w-full text-left bg-surface" id="tabla-rec-lotes">
                                    <thead>
                                        <tr class="bg-surface-light text-text-secondary text-xs uppercase border-b border-border">
                                            <th class="p-3 font-semibold">Producto</th>
                                            <th class="p-3 font-semibold w-40">Cantidad Canasta</th>
                                            <th class="p-3 font-semibold">Almacén</th>
                                            <th class="p-3 font-semibold w-16 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="rec-lote-row border-b border-border/50">
                                            <td class="p-2">
                                                <select class="form-select text-sm rec-lot-prod" required>
                                                    ${generateSelectOptions(productos, 'Seleccione...')}
                                                </select>
                                            </td>
                                            <td class="p-2">
                                                <input type="number" class="form-input text-sm rec-lot-cant" min="1" required placeholder="Ej: 50">
                                            </td>
                                            <td class="p-2">
                                                <select class="form-select text-sm rec-lot-alm" required>
                                                    ${generateSelectOptions(almacenes, 'Seleccione...')}
                                                </select>
                                            </td>
                                            <td class="p-2 text-center">
                                                <button type="button" class="text-text-muted hover:text-danger p-1 disabled:opacity-50 btn-remove-rec-lote" disabled>
                                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                    
                    <div class="mt-8 flex justify-end gap-4 border-t border-border pt-6">
                        <button type="reset" class="btn btn-secondary">Limpiar Formulario</button>
                        <button type="submit" class="btn btn-primary min-w-[200px]">Registrar Entrada</button>
                    </div>
                </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial" class="hidden">
                <div class="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 gap-4 bg-surface-light p-3 rounded-lg border border-border">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                        <div class="flex items-center gap-2">
                            <label class="text-sm text-text-secondary font-medium">Desde:</label>
                            <input type="date" id="export-rec-start" class="form-input text-sm py-1.5 px-3 h-9 w-36">
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-sm text-text-secondary font-medium">Hasta:</label>
                            <input type="date" id="export-rec-end" class="form-input text-sm py-1.5 px-3 h-9 w-36">
                        </div>
                    </div>
                    <button type="button" onclick="window.exportarRecepcionesExcel(document.getElementById('export-rec-start').value, document.getElementById('export-rec-end').value)" class="btn btn-secondary flex items-center justify-center gap-2 text-sm py-2 px-4 shadow-sm border border-border hover:bg-success/20 hover:text-success hover:border-success transition-all whitespace-nowrap w-full md:w-auto">
                        <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> Exportar Rango a Excel
                    </button>
                </div>
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-surface text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold">Doc #</th>
                                    <th class="py-3 px-4 font-semibold">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Detalle</th>
                                    <th class="py-3 px-4 font-semibold">Usuario</th>
                                    <th class="py-3 px-4 font-semibold text-right">Canastas</th>
                                    <th class="py-3 px-4 font-semibold text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historial.length === 0 ? `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No hay registros de recepción recientes.</td></tr>` :
            historial.map(a => `
                                    <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                                        <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${new Date(a.date).toLocaleDateString()}</td>
                                        <td class="py-2.5 px-4 text-white">${a.detalle}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${a.usuario || 'Sistema'}</td>
                                        <td class="py-2.5 px-4 text-right font-bold text-success">${a.cantidad}</td>
                                        <td class="py-2.5 px-4 text-center">
                                            <div class="flex items-center justify-center gap-2 opacity-100 transition-opacity">
                                                <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="text-text-secondary hover:text-white tooltip-trigger" title="Ver Documento">
                                                    <i data-lucide="file-text" class="w-4 h-4"></i>
                                                </button>
                                                ${isAdmin ? `
                                                    <button type="button" onclick="window.modificarRecepcion('${a.id}')" class="text-primary hover:text-primary-hover tooltip-trigger" title="Modificar Registro">
                                                        <i data-lucide="edit" class="w-4 h-4"></i>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                    `).join('')
        }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['recepcion'] = () => {
    // Activar dropdown buscable para productor
    window.UI.makeSelectSearchable('rec-productor');

    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva');
    const btnHistorial = document.getElementById('tab-btn-historial');
    const contentNueva = document.getElementById('tab-content-nueva');
    const contentHistorial = document.getElementById('tab-content-historial');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-recepcion');
    if (!form) return;

    // Lotes dinámicos Recepción
    const tbodyLotes = document.querySelector('#tabla-rec-lotes tbody');
    const btnAddLote = document.getElementById('btn-add-rec-lote');

    if (btnAddLote && tbodyLotes) {
        const updateRemoveButtons = () => {
            const rows = tbodyLotes.querySelectorAll('tr');
            const btns = tbodyLotes.querySelectorAll('.btn-remove-rec-lote');
            btns.forEach(btn => btn.disabled = rows.length <= 1);
        };

        btnAddLote.addEventListener('click', () => {
            const firstRow = tbodyLotes.querySelector('tr');
            if (!firstRow) return;
            const newRow = firstRow.cloneNode(true);

            // Limpiar inputs
            newRow.querySelector('.rec-lot-prod').value = '';
            newRow.querySelector('.rec-lot-cant').value = '';
            newRow.querySelector('.rec-lot-alm').value = '';

            tbodyLotes.appendChild(newRow);

            if (window.lucide) window.lucide.createIcons({ root: newRow });

            updateRemoveButtons();

            // Bind remove event on NEW buttons (because cloneNode doesn't clone event listeners)
            newRow.querySelector('.btn-remove-rec-lote').addEventListener('click', function () {
                if (tbodyLotes.querySelectorAll('tr').length > 1) {
                    this.closest('tr').remove();
                    updateRemoveButtons();
                }
            });
        });

        // Bind initial remove button
        tbodyLotes.querySelector('.btn-remove-rec-lote').addEventListener('click', function () {
            if (tbodyLotes.querySelectorAll('tr').length > 1) {
                this.closest('tr').remove();
                updateRemoveButtons();
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Recopilar lotes
        const rows = document.querySelectorAll('.rec-lote-row');
        const lotes = [];
        let hasErrors = false;

        rows.forEach(row => {
            const prod = row.querySelector('.rec-lot-prod').value;
            const cant = parseInt(row.querySelector('.rec-lot-cant').value);
            const alm = row.querySelector('.rec-lot-alm').value;

            if (!prod || !cant || isNaN(cant) || cant <= 0 || !alm) {
                hasErrors = true;
            } else {
                lotes.push({ productoId: prod, cantidad: cant, almacenId: alm });
            }
        });

        if (hasErrors || lotes.length === 0) {
            window.UI.showToast('Revise la mercancía ingresada. Faltan productos, cantidades o almacenes de destino.', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...';
        btn.disabled = true;

        try {
            await window.appStore.recepcionMercancia({
                productorId: document.getElementById('rec-productor').value,
                lotes: lotes,
                personaEntrega: document.getElementById('rec-entrega').value,
                personaRecibe: document.getElementById('rec-recibe').value,
                fechaRecepcion: document.getElementById('rec-fecha').value,
                numeroConduce: document.getElementById('rec-conduce').value
            });

            window.UI.showToast('Recepción de mercancía registrada exitosamente.');
            form.reset();
            // Limpiar filas extra
            const allRows = document.querySelectorAll('.rec-lote-row');
            if (allRows.length > 1) {
                for (let i = 1; i < allRows.length; i++) {
                    allRows[i].remove();
                }
                const firstBtn = document.querySelector('.btn-remove-rec-lote');
                if (firstBtn) firstBtn.disabled = true;
            }

            // Recargar la vista para ver el historial actualizado
            window.UI.renderModuleContainer('recepcion');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
            console.error(error);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    });

    if (window.lucide) window.lucide.createIcons();
};

// ==========================================
// 2. DESPACHO DE CANASTAS VACÍAS
// ==========================================
window.appModules['despacho-vacias'] = () => {
    const productores = window.appStore.getProductores();
    const almacenes = window.appStore.getAlmacenes();

    const isAdmin = window.appStore.currentUser && (window.appStore.currentUser.rol?.toLowerCase() === 'admin' || window.appStore.currentUser.rol?.toLowerCase() === 'administrador');
    const historial = window.appStore.getActividad(200).filter(a => a.operacion === 'Desp. Vacías');

    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
    const maxDate = localISOTime;

    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() - 3);
    const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
    const minDate = minLocalISOTime;

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Despacho de Canastas Vacías</h2>
            <p class="text-text-secondary mb-6">Entrega de canastas vacías a los productores para futura recolección.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-vac" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nuevo Despacho</button>
                <button id="tab-btn-historial-vac" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVO DESPACHO -->
            <div id="tab-content-nueva-vac" class="block">
                <form id="form-vacias" class="surface-card p-6 md:p-8">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    
                        <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                            <h4 class="text-warning font-semibold">Datos del Orígen</h4>
                            <div class="w-48">
                                <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                                <input type="date" id="vac-fecha" class="form-input text-sm py-1" required min="${minDate}" max="${maxDate}" value="${maxDate}">
                            </div>
                        </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Productor Destino</label>
                        <select id="vac-productor" class="form-select" required>
                            ${generateSelectOptions(productores, 'Seleccione un productor...')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Persona que Retira</label>
                        <input type="text" id="vac-retira" class="form-input" required placeholder="Nombre de quien se las lleva">
                    </div>

                    <div class="form-group md:col-span-2 border-b border-border pb-4 mt-4 mb-2">
                        <h4 class="text-warning font-semibold mb-2">Despacho de</h4>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Almacén de Orígen (De dónde salen)</label>
                        <select id="vac-almacen" class="form-select" required>
                            ${generateSelectOptions(almacenes, 'Seleccione almacén origen...')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Cantidad a Entregar</label>
                        <input type="number" id="vac-cantidad" class="form-input" min="1" required placeholder="Ej: 50">
                    </div>
                    </div>
                
                    <div class="mt-8 flex justify-end gap-4 p-4 bg-warning/10 rounded-lg border border-warning/20">
                        <div class="flex-1 flex items-center gap-3">
                            <i data-lucide="info" class="w-5 h-5 text-warning"></i>
                            <p class="text-sm text-text-secondary">Verifique tener suficientes canastas vacías en el almacén seleccionado antes de procesar.</p>
                        </div>
                        <button type="submit" class="btn btn-primary" style="background-color: var(--accent-warning); border-color: var(--accent-warning); color: #000">Despachar Vacías</button>
                    </div>
                </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-vac" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-surface text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold">Doc #</th>
                                    <th class="py-3 px-4 font-semibold">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Detalle</th>
                                    <th class="py-3 px-4 font-semibold">Usuario</th>
                                    <th class="py-3 px-4 font-semibold text-right">Canastas</th>
                                    <th class="py-3 px-4 font-semibold text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historial.length === 0 ? `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No hay registros de despacho recientes.</td></tr>` :
            historial.map(a => `
                                    <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                                        <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${new Date(a.date).toLocaleDateString()}</td>
                                        <td class="py-2.5 px-4 text-white">${a.detalle}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${a.usuario || 'Sistema'}</td>
                                        <td class="py-2.5 px-4 text-right font-bold text-warning">${a.cantidad}</td>
                                        <td class="py-2.5 px-4 text-center">
                                            <div class="flex items-center justify-center gap-2 opacity-100 transition-opacity">
                                                <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-3 flex items-center justify-center gap-1 whitespace-nowrap" title="Ver Documento Origen">
                                                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                                                </button>
                                                ${isAdmin ? `
                                                    <button type="button" onclick="window.modificarDespachoVacias('${a.id}')" class="text-warning hover:text-warning tooltip-trigger" title="Modificar Registro">
                                                        <i data-lucide="edit" class="w-4 h-4"></i>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                    `).join('')
        }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['despacho-vacias'] = () => {
    // Activar dropdown buscable para productor
    window.UI.makeSelectSearchable('vac-productor');

    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-vac');
    const btnHistorial = document.getElementById('tab-btn-historial-vac');
    const contentNueva = document.getElementById('tab-content-nueva-vac');
    const contentHistorial = document.getElementById('tab-content-historial-vac');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-vacias');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...';
        btn.disabled = true;

        try {
            await window.appStore.despachoVacias({
                productorId: document.getElementById('vac-productor').value,
                personaRetira: document.getElementById('vac-retira').value,
                cantidad: document.getElementById('vac-cantidad').value,
                almacenOrigenId: document.getElementById('vac-almacen').value,
                fechaDespacho: document.getElementById('vac-fecha').value
            });

            window.UI.showToast('Despacho de canastas vacías registrado exitosamente.');
            form.reset();
            window.UI.renderModuleContainer('despacho-vacias');

        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 3. TRANSFERENCIA ENTRE FINCAS
// ==========================================
window.appModules['transferencia'] = () => {
    const productores = window.appStore.getProductores();
    const opts = generateSelectOptions(productores, 'Seleccione un productor...');
    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Transf. Fincas' || a.operacion === 'Transferencia Fincas' || a.operacion === 'Transferencia' || a.operacion === 'Transferencia Entre Fincas');
    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Transferencia Entre Fincas</h2>
            <p class="text-text-secondary mb-8">Movimiento de canastas vacías directamente entre productores (sin pasar por nuestro almacén).</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-trnf" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nueva Transferencia</button>
                <button id="tab-btn-historial-trnf" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-trnf" class="block">
            <form id="form-transfer" class="surface-card p-6 md:p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-primary font-semibold">Datos de Transferencia</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="trans-fecha" class="form-input text-sm py-1" required>
                        </div>
                    </div>

                    <!-- Flecha decorativa en desktop -->
                    <div class="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10" style="top: 40px;">
                        <div class="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                            <i data-lucide="arrow-right" class="w-5 h-5 text-text-secondary"></i>
                        </div>
                    </div>

                    <div class="surface-card p-4 border-dashed bg-surface-light/30">
                        <h4 class="text-primary font-semibold mb-4 text-center">Orígen</h4>
                        <div class="form-group">
                            <label class="form-label mb-1">Productor Orígen</label>
                            <select id="trans-origen" class="form-select" required>
                                ${opts}
                            </select>
                        </div>
                    </div>

                    <div class="surface-card p-4 border-dashed bg-surface-light/30">
                        <h4 class="text-success font-semibold mb-4 text-center">Destino Final</h4>
                        <div class="form-group">
                            <label class="form-label mb-1">Productor Final</label>
                            <select id="trans-destino" class="form-select" required>
                                ${opts}
                            </select>
                        </div>
                    </div>

                    <div class="form-group md:col-span-2 border-t border-border pt-6 mt-2">
                        <label class="form-label mb-1">Persona que Transfiere</label>
                        <input type="text" id="trans-persona" class="form-input" required placeholder="Nombre de quien las mueve">
                    </div>

                    <div class="form-group md:col-span-2">
                        <label class="form-label mb-1">Cantidad de Canastas Transferidas</label>
                        <input type="number" id="trans-cantidad" class="form-input" min="1" required placeholder="Ej: 30">
                    </div>
                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-primary w-full md:w-auto md:min-w-[200px]">Registrar Transferencia</button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-trnf" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0 border border-border/30 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-surface text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold">Doc #</th>
                                    <th class="py-3 px-4 font-semibold">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Detalle</th>
                                    <th class="py-3 px-4 font-semibold">Usuario</th>
                                    <th class="py-3 px-4 font-semibold">Canastas</th>
                                    <th class="py-3 px-4 font-semibold text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historial.length === 0 ? `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No hay registros recientes.</td></tr>` :
            historial.map(a => `
                                    <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                                        <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${new Date(a.date).toLocaleDateString()}</td>
                                        <td class="py-2.5 px-4 text-white">${a.detalle}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${a.usuario || 'Sistema'}</td>
                                        <td class="py-2.5 px-4 font-bold text-warning">${a.cantidad}</td>
                                        <td class="py-2.5 px-4 text-center">
                                            <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-3 flex items-center justify-center gap-1 mx-auto whitespace-nowrap opacity-100 transition-opacity" title="Ver Documento Origen">
                                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                                            </button>
                                        </td>
                                    </tr>
                                    `).join('')
        }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['transferencia'] = () => {
    // Activar dropdown buscable para productores
    window.UI.makeSelectSearchable('trans-origen');
    window.UI.makeSelectSearchable('trans-destino');

    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-trnf');
    const btnHistorial = document.getElementById('tab-btn-historial-trnf');
    const contentNueva = document.getElementById('tab-content-nueva-trnf');
    const contentHistorial = document.getElementById('tab-content-historial-trnf');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-transfer');
    if (!form) return;

    const transFecha = document.getElementById('trans-fecha');
    if (transFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        transFecha.min = minDate;
        transFecha.max = maxDate;
        transFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...';
        btn.disabled = true;

        try {
            const origenId = document.getElementById('trans-origen').value;
            const destinoId = document.getElementById('trans-destino').value;

            if (origenId === destinoId) throw new Error("El productor orígen y destino no pueden ser el mismo.");

            await window.appStore.transferenciaFincas({
                productorOrigenId: origenId,
                productorDestinoId: destinoId,
                personaTransfiere: document.getElementById('trans-persona').value,
                cantidad: document.getElementById('trans-cantidad').value,
                fechaTransferencia: document.getElementById('trans-fecha').value
            });

            window.UI.showToast('Transferencia entre fincas registrada.');
            form.reset();
            window.UI.renderModuleContainer('transferencia');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 4. TRANSFERENCIA INTERNA
// ==========================================
window.appModules['transferencia-interna'] = () => {
    const almacenes = window.appStore.getAlmacenes();
    const productos = window.appStore.getProductos();
    const historial = window.appStore.getActividad(200).filter(a => a.operacion === 'Transf. Interna');

    const optsAlmacen = generateSelectOptions(almacenes, 'Seleccione almacén...');
    const optsProductos = generateSelectOptions(productos, 'Seleccione fruta...');

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Transferencia Interna (Almacenes)</h2>
            <p class="text-text-secondary mb-8">Movimiento de canastas llenas entre almacenes, con opción a reclasificar la fruta.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-tint" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nueva Transferencia</button>
                <button id="tab-btn-historial-tint" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-tint" class="block">
                <form id="form-trans-int" class="surface-card p-6 md:p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-primary font-semibold">Datos de Transferencia</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="tint-fecha" class="form-input text-sm py-1" required>
                        </div>
                    </div>

                    <!-- Flecha decorativa en desktop -->
                    <div class="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10" style="top: 40px;">
                        <div class="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                            <i data-lucide="arrow-right" class="w-5 h-5 text-text-secondary"></i>
                        </div>
                    </div>

                    <div class="surface-card p-4 border-dashed bg-surface-light/30 border-warning/30">
                        <h4 class="text-warning font-semibold mb-4 text-center">Salida (Orígen)</h4>
                        <div class="form-group mb-4">
                            <label class="form-label mb-1">Almacén Orígen</label>
                            <select id="tint-origen" class="form-select" required>
                                ${optsAlmacen}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label mb-1">Fruta Actual</label>
                            <select id="tint-prod-actual" class="form-select" required>
                                ${optsProductos}
                            </select>
                        </div>
                    </div>

                    <div class="surface-card p-4 border-dashed bg-surface-light/30 border-success/30">
                        <h4 class="text-success font-semibold mb-4 text-center">Entrada (Destino)</h4>
                        <div class="form-group mb-4">
                            <label class="form-label mb-1">Almacén Destino</label>
                            <select id="tint-destino" class="form-select" required>
                                ${optsAlmacen}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label mb-1">Nueva Clasificación (Fruta)</label>
                            <select id="tint-prod-nuevo" class="form-select" required>
                                ${optsProductos}
                            </select>
                            <p class="text-xs text-text-muted mt-1">* Puede ser la misma o cambiar si se reclasifica.</p>
                        </div>
                    </div>

                    <div class="form-group md:col-span-2 border-t border-border pt-6 mt-2">
                        <label class="form-label mb-1">Responsable del Movimiento</label>
                        <input type="text" id="tint-persona" class="form-input" required placeholder="Nombre de quien autoriza/mueve">
                    </div>

                    <div class="form-group md:col-span-2">
                        <label class="form-label mb-1">Cantidad de Canastas Llenas</label>
                        <input type="number" id="tint-cantidad" class="form-input" min="1" required placeholder="Ej: 50">
                    </div>

                    <!-- TRAZABILIDAD DE VACÍAS -->
                    <div class="form-group md:col-span-2 border-t border-border pt-5 mt-1">
                        <div class="flex items-center gap-3 mb-3">
                            <label class="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" id="tint-toggle-vacias" class="w-4 h-4 accent-warning">
                                <span class="font-semibold text-warning flex items-center gap-2">
                                    <i data-lucide="package" class="w-4 h-4"></i>
                                    ¿También se trasladan canastas vacías?
                                </span>
                            </label>
                        </div>
                        <div id="tint-vacias-fields" class="hidden animate-fade-in p-4 bg-warning/5 border border-dashed border-warning/30 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="form-group mb-0">
                                <label class="form-label mb-1 text-warning font-semibold">Cant. Vacías a Trasladar</label>
                                <input type="number" id="tint-vacias" class="form-input border-warning/30 focus:border-warning" min="1" placeholder="Ej: 20">
                            </div>
                            <div class="form-group mb-0">
                                <label class="form-label mb-1 text-warning font-semibold">Destino de las Vacías</label>
                                <select id="tint-destino-vacias" class="form-select border-warning/30 focus:border-warning">
                                    <option value="">Mismo destino que la fruta</option>
                                    ${optsAlmacen}
                                </select>
                                <p class="text-xs text-text-muted mt-1">* Deja en blanco si van al mismo almacén que la fruta.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-primary w-full md:w-auto md:min-w-[200px]">Procesar Transferencia Interna</button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-tint" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-surface text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold">Doc #</th>
                                    <th class="py-3 px-4 font-semibold">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Detalle</th>
                                    <th class="py-3 px-4 font-semibold">Usuario</th>
                                    <th class="py-3 px-4 font-semibold">Llenas</th>
                                    <th class="py-3 px-4 font-semibold text-warning">Vacías</th>
                                    <th class="py-3 px-4 font-semibold text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historial.length === 0 ? `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No hay registros recientes.</td></tr>` :
            historial.map(a => `
                                    <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                                        <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${new Date(a.date).toLocaleDateString()}</td>
                                        <td class="py-2.5 px-4 text-white">${a.detalle}</td>
                                        <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${a.usuario || 'Sistema'}</td>
                                        <td class="py-2.5 px-4 font-bold text-info">${a.rawPayload?.cantidad || a.cantidad}</td>
                                        <td class="py-2.5 px-4 font-bold ${a.rawPayload?.canastasVacias > 0 ? 'text-warning' : 'text-text-muted'}">${a.rawPayload?.canastasVacias > 0 ? a.rawPayload.canastasVacias : '-'}</td>
                                        <td class="py-2.5 px-4 text-center">
                                            <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-3 flex items-center justify-center gap-1 mx-auto whitespace-nowrap opacity-100 transition-opacity" title="Ver Documento Origen">
                                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                                            </button>
                                        </td>
                                    </tr>
                                    `).join('')
        }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['transferencia-interna'] = () => {
    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-tint');
    const btnHistorial = document.getElementById('tab-btn-historial-tint');
    const contentNueva = document.getElementById('tab-content-nueva-tint');
    const contentHistorial = document.getElementById('tab-content-historial-tint');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-trans-int');
    if (!form) return;

    // Toggle vacías section
    const toggleVacias = document.getElementById('tint-toggle-vacias');
    const vaciasFields = document.getElementById('tint-vacias-fields');
    if (toggleVacias && vaciasFields) {
        toggleVacias.addEventListener('change', () => {
            if (toggleVacias.checked) {
                vaciasFields.classList.remove('hidden');
                vaciasFields.classList.add('grid');
            } else {
                vaciasFields.classList.add('hidden');
                vaciasFields.classList.remove('grid');
            }
        });
    }

    const tintFecha = document.getElementById('tint-fecha');
    if (tintFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        tintFecha.min = minDate;
        tintFecha.max = maxDate;
        tintFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...';
        btn.disabled = true;

        try {
            const toggleVaciasEl = document.getElementById('tint-toggle-vacias');
            const canastasVacias = (toggleVaciasEl?.checked) ? parseInt(document.getElementById('tint-vacias')?.value || 0) : 0;
            const destinoVaciasRaw = document.getElementById('tint-destino-vacias')?.value;
            const almacenDestinoId = document.getElementById('tint-destino').value;
            // If no specific destination for vacias is chosen, use the same as fruit destination
            const almacenDestinoVaciasId = (destinoVaciasRaw && destinoVaciasRaw !== '') ? destinoVaciasRaw : almacenDestinoId;

            await window.appStore.transferenciaInterna({
                almacenOrigenId: document.getElementById('tint-origen').value,
                almacenDestinoId,
                productoIdActual: document.getElementById('tint-prod-actual').value,
                productoIdNuevo: document.getElementById('tint-prod-nuevo').value,
                personaTransfiere: document.getElementById('tint-persona').value,
                cantidad: document.getElementById('tint-cantidad').value,
                fechaTransferencia: document.getElementById('tint-fecha').value,
                canastasVacias,
                almacenDestinoVaciasId
            });

            window.UI.showToast('Transferencia de almacén a almacén procesada.');
            form.reset();
            window.UI.renderModuleContainer('transferencia-interna');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 5. COMPRA DE CANASTAS
// ==========================================
window.appModules['compra-canastas'] = () => {
    const almacenes = window.appStore.getAlmacenes();

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Compra de Canastas</h2>
            <p class="text-text-secondary mb-8">Ingreso de canastas nuevas al inventario desde un proveedor.</p>
            
            <form id="form-compra" class="surface-card p-6 md:p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-primary font-semibold mb-2">Datos de la Compra</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="comp-fecha" class="form-input text-sm py-1" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label mb-1">A quién se le compró (Proveedor)</label>
                        <input type="text" id="comp-proveedor" class="form-input" required placeholder="Ej. Plastinova S.A.">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label mb-1">Cantidad de Canastas Compradas</label>
                        <input type="number" id="comp-cantidad" class="form-input" min="1" required placeholder="Ej. 500">
                    </div>

                    <div class="form-group md:col-span-2 border-b border-border pb-4 mt-4 mb-2">
                        <h4 class="text-primary font-semibold mb-2">Recepción Interna</h4>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Almacén de Destino</label>
                        <select id="comp-almacen" class="form-select" required>
                            ${generateSelectOptions(almacenes, 'Seleccione almacén que recibe...')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Persona que Recibe</label>
                        <input type="text" id="comp-recibe" class="form-input" required placeholder="Nombre de quien recibe">
                    </div>
                    
                </div>
                
                <div class="mt-8 flex justify-end gap-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div class="flex-1 flex items-center gap-3">
                        <i data-lucide="plus-circle" class="w-5 h-5 text-primary"></i>
                        <p class="text-sm text-text-secondary">Esta operación sumará inventario general de canastas.</p>
                    </div>
                    <button type="submit" class="btn btn-primary min-w-[200px]">Guardar Compra</button>
                </div>
            </form>
        </div>
    `;
};

window.appModuleEvents['compra-canastas'] = () => {
    const form = document.getElementById('form-compra');
    if (!form) return;

    const compFecha = document.getElementById('comp-fecha');
    if (compFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        compFecha.min = minDate;
        compFecha.max = maxDate;
        compFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            await window.appStore.compraCanastas({
                proveedorNombre: document.getElementById('comp-proveedor').value,
                cantidad: document.getElementById('comp-cantidad').value,
                almacenDestinoId: document.getElementById('comp-almacen').value,
                personaRecibe: document.getElementById('comp-recibe').value,
                fechaCompra: document.getElementById('comp-fecha').value
            });

            window.UI.showToast('Nuevas canastas sumadas al inventario.');
            form.reset();
        } catch (error) {
            window.UI.showToast("Error al procesar: " + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

