/**
 * Módulos de Catálogos (Productores, Almacenes, Productos)
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

// ==========================================
// Módulo: CLIENTES
// ==========================================
window.appModules['clientes'] = () => {
    const clientes = window.appStore.getClientes();

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Directorio de Clientes</h2>
                <div class="bg-surface-light px-4 py-2 rounded-lg border border-border">
                    <span class="text-text-secondary text-sm mr-2">Total Registrados:</span>
                    <span class="text-white font-bold">${clientes.length}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Formulario -->
                <div class="lg:col-span-1">
                    <div class="surface-card p-6 sticky top-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="user-plus" class="w-5 h-5 text-primary"></i>
                            Nuevo Cliente
                        </h3>
                        <form id="form-cliente" class="space-y-4">
                            <input type="hidden" id="cli-id" value="">
                            <div class="form-group mb-4">
                                <label class="form-label mb-1 block">Nombre / Razón Social</label>
                                <input type="text" id="cli-nombre" class="form-input" required placeholder="Ej: Supermercados del Norte">
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label mb-1 block">Documento de Identidad / RIF</label>
                                <input type="text" id="cli-doc" class="form-input" required placeholder="Ej: J-12345678">
                            </div>
                            <div class="form-group mb-6">
                                <label class="form-label mb-1 block">Dirección</label>
                                <textarea id="cli-dir" class="form-input custom-scrollbar h-24" required placeholder="Ubicación física o contacto"></textarea>
                            </div>
                            <button type="submit" id="cli-submit-btn" class="btn btn-primary w-full">Guardar Cliente</button>
                            <button type="button" id="cli-cancel-btn" class="btn hidden w-full text-text-secondary hover:text-white mt-2">Cancelar Edición</button>
                        </form>
                    </div>
                </div>

                <!-- Lista -->
                <div class="lg:col-span-2">
                    <div class="surface-card">
                        <div class="mb-4 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i data-lucide="search" class="w-5 h-5 text-text-secondary"></i>
                            </div>
                            <input type="text" id="busqueda-cli" class="form-input w-full pl-10" placeholder="Buscar cliente por nombre o documento...">
                        </div>
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left border-collapse min-w-[600px]" id="tabla-clientes">
                                <thead>
                                    <tr class="border-b border-border text-text-secondary text-sm bg-surface-light/30">
                                        <th class="py-4 px-5 font-medium w-16">#</th>
                                        <th class="py-4 px-5 font-medium">Nombre / Razón Social</th>
                                        <th class="py-4 px-5 font-medium">Documento</th>
                                        <th class="py-4 px-5 font-medium">Dirección</th>
                                        <th class="py-4 px-5 font-medium text-center">Canastas (Deuda)</th>
                                        <th class="py-4 px-5 font-medium text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${clientes.length === 0
            ? `<tr><td colspan="4" class="py-12 text-center text-text-secondary">No hay clientes registrados.<br>Agregue el primero usando el formulario.</td></tr>`
            : [...clientes].sort((a, b) => (a.numeroId || 0) - (b.numeroId || 0)).map(c => `
                                            <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors group cliente-row">
                                                <td class="py-3 px-5 text-text-secondary font-mono">${c.numeroId || (clientes.indexOf(c) + 1)}</td>
                                                <td class="py-3 px-5 text-white font-medium flex items-center gap-3">
                                                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">${c.nombre.substring(0, 2)}</div>
                                                    ${c.nombre}
                                                </td>
                                                <td class="py-3 px-5 text-text-secondary">${c.documento}</td>
                                                <td class="py-3 px-5 text-text-secondary text-sm max-w-[150px] truncate" title="${c.direccion}">${c.direccion}</td>
                                                <td class="py-3 px-5 text-center font-bold ${c.canastasPrestadas > 0 ? 'text-warning' : 'text-text-muted'}">${c.canastasPrestadas || 0}</td>
                                                <td class="py-3 px-5 text-right">
                                                    <div class="flex justify-end gap-2">
                                                        <button type="button" class="btn-edit-cli flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium" data-id="${c.id}" title="Editar">
                                                            <i data-lucide="edit-2" class="w-4 h-4"></i> Editar
                                                        </button>
                                                        <button type="button" class="btn-delete-cli p-1.5 rounded bg-surface-light hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors" data-id="${c.id}" title="Eliminar">
                                                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                                                        </button>
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
        </div>
    `;
};

window.appModuleEvents['clientes'] = () => {
    const form = document.getElementById('form-cliente');
    if (!form) return;

    // Search bar logic
    const searchCli = document.getElementById('busqueda-cli');
    if (searchCli) {
        searchCli.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#tabla-clientes tbody tr.cliente-row');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

    // Handle Edit Clicks
    document.querySelectorAll('.btn-edit-cli').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const clientes = window.appStore.getClientes();
            const cliente = clientes.find(c => c.id === id);
            if (!cliente) return;

            document.getElementById('cli-id').value = cliente.id;
            document.getElementById('cli-nombre').value = cliente.nombre || '';
            document.getElementById('cli-doc').value = cliente.documento || cliente.identificacion || '';
            document.getElementById('cli-dir').value = cliente.direccion || '';

            document.getElementById('cli-submit-btn').innerHTML = 'Actualizar Cliente';
            document.getElementById('cli-cancel-btn').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Handle Cancel Edit
    const cancelBtn = document.getElementById('cli-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('cli-id').value = '';
            document.getElementById('cli-submit-btn').innerHTML = 'Guardar Cliente';
            cancelBtn.classList.add('hidden');
        });
    }

    // Handle Delete Clicks
    document.querySelectorAll('.btn-delete-cli').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("¿Está seguro de que desea eliminar este cliente?")) {
                const icon = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i>';
                try {
                    await window.appStore.deleteCliente(id);
                    window.UI.showToast("Cliente eliminado con éxito.");
                    window.UI.renderModuleContainer('clientes');
                } catch (error) {
                    window.UI.showToast(error.message, 'error');
                    btn.innerHTML = icon;
                    if (window.lucide) window.lucide.createIcons();
                }
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('cli-submit-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            const id = document.getElementById('cli-id').value;
            const nombre = document.getElementById('cli-nombre').value;
            const documento = document.getElementById('cli-doc').value;
            const direccion = document.getElementById('cli-dir').value;

            if (id) {
                await window.appStore.updateCliente(id, { nombre, documento, direccion });
                window.UI.showToast(`Cliente "${nombre}" actualizado.`);
            } else {
                await window.appStore.addCliente({ nombre, documento, direccion });
                window.UI.showToast(`Cliente "${nombre}" guardado con éxito.`);
            }
            window.UI.renderModuleContainer('clientes');
        } catch (error) {
            window.UI.showToast("Error al guardar: " + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// Módulo: PRODUCTORES
// ==========================================
window.appModules['productores'] = () => {
    const productores = window.appStore.getProductores();

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Directorio de Productores</h2>
                <div class="bg-surface-light px-4 py-2 rounded-lg border border-border">
                    <span class="text-text-secondary text-sm mr-2">Total Registrados:</span>
                    <span class="text-white font-bold">${productores.length}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Formulario -->
                <div class="lg:col-span-1">
                    <div class="surface-card p-6 sticky top-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="user-plus" class="w-5 h-5 text-primary"></i>
                            Nuevo Productor
                        </h3>
                        <form id="form-productor" class="space-y-4">
                            <input type="hidden" id="prod-id" value="">
                            <div class="form-group mb-4">
                                <label class="form-label mb-1 block">Nombre Completo</label>
                                <input type="text" id="prod-nombre" class="form-input" required placeholder="Ej: Finca Las Brisas C.A.">
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label mb-1 block">Documento de Identidad / RIF</label>
                                <input type="text" id="prod-doc" class="form-input" required placeholder="Ej: V-12345678">
                            </div>
                            <div class="form-group mb-6">
                                <label class="form-label mb-1 block">Dirección</label>
                                <textarea id="prod-dir" class="form-input custom-scrollbar h-24" required placeholder="Ubicación de la finca o contacto"></textarea>
                            </div>
                            <button type="submit" id="prod-submit-btn" class="btn btn-primary w-full">Guardar Productor</button>
                            <button type="button" id="prod-cancel-btn" class="btn hidden w-full text-text-secondary hover:text-white mt-2">Cancelar Edición</button>
                        </form>
                    </div>
                </div>

                <!-- Lista -->
                <div class="lg:col-span-2">
                    <div class="surface-card">
                        <div class="mb-4 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i data-lucide="search" class="w-5 h-5 text-text-secondary"></i>
                            </div>
                            <input type="text" id="busqueda-prod" class="form-input w-full pl-10" placeholder="Buscar productor por nombre o documento...">
                        </div>
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left border-collapse min-w-[600px]" id="tabla-productores">
                                <thead>
                                    <tr class="border-b border-border text-text-secondary text-sm bg-surface-light/30">
                                        <th class="py-4 px-5 font-medium w-16">#</th>
                                        <th class="py-4 px-5 font-medium">Nombre</th>
                                        <th class="py-4 px-5 font-medium">Documento</th>
                                        <th class="py-4 px-5 font-medium">Dirección</th>
                                        <th class="py-4 px-5 font-medium text-center">Canastas (Deuda)</th>
                                        <th class="py-4 px-5 font-medium text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productores.length === 0
            ? `<tr><td colspan="4" class="py-12 text-center text-text-secondary">No hay productores registrados.<br>Agregue el primero usando el formulario.</td></tr>`
            : [...productores].sort((a, b) => (a.numeroId || 0) - (b.numeroId || 0)).map(p => `
                                            <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors group productor-row">
                                                <td class="py-3 px-5 text-text-secondary font-mono">${p.numeroId || (productores.indexOf(p) + 1)}</td>
                                                <td class="py-3 px-5 text-white font-medium flex items-center gap-3">
                                                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">${p.nombre.substring(0, 2)}</div>
                                                    ${p.nombre}
                                                </td>
                                                <td class="py-3 px-5 text-text-secondary">${p.documento}</td>
                                                <td class="py-3 px-5 text-text-secondary text-sm max-w-xs truncate" title="${p.direccion}">${p.direccion}</td>
                                                <td class="py-3 px-5 text-center font-bold ${p.canastasPrestadas > 0 ? 'text-warning' : 'text-text-muted'}">${p.canastasPrestadas || 0}</td>
                                                <td class="py-3 px-5 text-right">
                                                    <div class="flex justify-end gap-2">
                                                        <button type="button" class="btn-edit-prod flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium" data-id="${p.id}" title="Editar">
                                                            <i data-lucide="edit-2" class="w-4 h-4"></i> Editar
                                                        </button>
                                                        <button type="button" class="btn-delete-prod p-1.5 rounded bg-surface-light hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors" data-id="${p.id}" title="Eliminar">
                                                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                                                        </button>
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
        </div >
        `;
};

window.appModuleEvents['productores'] = () => {
    const form = document.getElementById('form-productor');
    if (!form) return;

    // Search bar logic
    const searchProd = document.getElementById('busqueda-prod');
    if (searchProd) {
        searchProd.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#tabla-productores tbody tr.productor-row');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

    // Handle Edit Clicks
    document.querySelectorAll('.btn-edit-prod').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const productores = window.appStore.getProductores();
            const productor = productores.find(p => p.id === id);
            if (!productor) return;

            document.getElementById('prod-id').value = productor.id;
            document.getElementById('prod-nombre').value = productor.nombre || '';
            document.getElementById('prod-doc').value = productor.documento || '';
            document.getElementById('prod-dir').value = productor.direccion || '';

            document.getElementById('prod-submit-btn').innerHTML = 'Actualizar Productor';
            document.getElementById('prod-cancel-btn').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Handle Cancel Edit
    const cancelBtn = document.getElementById('prod-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('prod-id').value = '';
            document.getElementById('prod-submit-btn').innerHTML = 'Guardar Productor';
            cancelBtn.classList.add('hidden');
        });
    }

    // Handle Delete Clicks
    document.querySelectorAll('.btn-delete-prod').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("¿Está seguro de que desea eliminar este Productor?")) {
                const icon = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i>';
                try {
                    await window.appStore.deleteProductor(id);
                    window.UI.showToast("Productor eliminado con éxito.");
                    window.UI.renderModuleContainer('productores');
                } catch (error) {
                    window.UI.showToast(error.message, 'error');
                    btn.innerHTML = icon;
                    if (window.lucide) window.lucide.createIcons();
                }
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('prod-submit-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            const id = document.getElementById('prod-id').value;
            const nombre = document.getElementById('prod-nombre').value;
            const documento = document.getElementById('prod-doc').value;
            const direccion = document.getElementById('prod-dir').value;

            if (id) {
                await window.appStore.updateProductor(id, { nombre, documento, direccion });
                window.UI.showToast(`Productor "${nombre}" actualizado.`);
            } else {
                await window.appStore.addProductor({ nombre, documento, direccion });
                window.UI.showToast(`Productor "${nombre}" guardado con éxito.`);
            }

            // Re-render vista actual
            window.UI.renderModuleContainer('productores');
        } catch (error) {
            window.UI.showToast("Error al guardar: " + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// Módulo: ALMACENES
// ==========================================
window.appModules['almacenes'] = () => {
    const almacenes = window.appStore.getAlmacenes();
    const invAlmacen = window.appStore.getInventarioPorAlmacen();

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-6">Gestión de Almacenes / Galpones</h2>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Formulario -->
                <div class="lg:col-span-1">
                    <div class="surface-card p-6 sticky top-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="warehouse" class="w-5 h-5 text-info"></i>
                            Nuevo Almacén
                        </h3>
                        <form id="form-almacen" class="space-y-4">
                            <input type="hidden" id="alm-id" value="">
                            <div class="form-group mb-4">
                                <label class="form-label mb-1 block">Nombre del Almacén</label>
                                <input type="text" id="alm-nombre" class="form-input" required placeholder="Ej: Galpón Principal Sect. A">
                            </div>
                            <div class="form-group mb-6">
                                <label class="form-label mb-1 block">Dirección / Ubicación Física</label>
                                <textarea id="alm-dir" class="form-input custom-scrollbar h-24" required placeholder="Nave C, Planta Baja..."></textarea>
                            </div>
                            <button type="submit" id="alm-submit-btn" class="btn btn-primary w-full" style="background-color: var(--accent-info); border-color: var(--accent-info)">
                                Registrar Almacén
                            </button>
                            <button type="button" id="alm-cancel-btn" class="btn hidden w-full text-text-secondary hover:text-white mt-2">
                                Cancelar Edición
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Lista (Cards) -->
                <div class="lg:col-span-2">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${almacenes.length === 0
            ? `<div class="md:col-span-2 surface-card p-12 text-center text-text-secondary">No hay almacenes registrados.</div>`
            : almacenes.map(a => {
                const inv = invAlmacen[a.id] || { vacias: 0 };
                const totalLlenas = Object.keys(inv).filter(k => k !== 'vacias').reduce((sum, k) => sum + inv[k], 0);

                return `
                                <div class="surface-card p-5 hover:border-text-secondary/30 transition-colors relative group">
                                    <div class="absolute top-4 right-4 flex gap-2 opacity-100 transition-opacity">
                                        <button type="button" class="btn-edit-alm w-8 h-8 rounded-full bg-surface-light hover:bg-primary/20 text-text-secondary hover:text-primary flex items-center justify-center transition-colors" data-id="${a.id}" title="Editar">
                                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                                        </button>
                                        <button type="button" class="btn-delete-alm w-8 h-8 rounded-full bg-surface-light hover:bg-danger/20 text-text-secondary hover:text-danger flex items-center justify-center transition-colors" data-id="${a.id}" title="Eliminar">
                                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                                        </button>
                                    </div>
                                    <div class="flex justify-between items-start mb-4 pr-16">
                                        <div class="flex items-center gap-3">
                                            <div class="p-2 bg-info/10 rounded-lg"><i data-lucide="warehouse" class="w-5 h-5 text-info"></i></div>
                                            <h4 class="text-lg font-semibold text-white">${a.nombre}</h4>
                                        </div>
                                    </div>
                                    <p class="text-sm text-text-secondary mb-4 line-clamp-2 h-10">${a.direccion}</p>
                                    
                                    <div class="flex items-center justify-between pt-4 border-t border-border">
                                        <div class="text-center">
                                            <p class="text-xs text-text-muted mb-1 text-center">CANASTAS LLENAS</p>
                                            <p class="text-lg font-bold text-success text-center">${totalLlenas}</p>
                                        </div>
                                        <div class="h-8 w-px bg-border"></div>
                                        <div class="text-center">
                                            <p class="text-xs text-text-muted mb-1 text-center">CANASTAS VACÍAS</p>
                                            <p class="text-lg font-bold text-warning text-center">${inv.vacias || 0}</p>
                                        </div>
                                    </div>
                                </div>
                                `;
            }).join('')
        }
                    </div>
                </div>
            </div>
        </div >
        `;
};

window.appModuleEvents['almacenes'] = () => {
    const form = document.getElementById('form-almacen');
    if (!form) return;

    // Handle Edit Clicks
    document.querySelectorAll('.btn-edit-alm').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const almacenes = window.appStore.getAlmacenes();
            const almacen = almacenes.find(a => a.id === id);
            if (!almacen) return;

            document.getElementById('alm-id').value = almacen.id;
            document.getElementById('alm-nombre').value = almacen.nombre || '';
            document.getElementById('alm-dir').value = almacen.direccion || '';

            document.getElementById('alm-submit-btn').innerHTML = 'Actualizar Almacén';
            document.getElementById('alm-cancel-btn').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Handle Cancel Edit
    const cancelBtn = document.getElementById('alm-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('alm-id').value = '';
            document.getElementById('alm-submit-btn').innerHTML = 'Registrar Almacén';
            cancelBtn.classList.add('hidden');
        });
    }

    // Handle Delete Clicks
    document.querySelectorAll('.btn-delete-alm').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("¿Está seguro de que desea eliminar este almacén?")) {
                const icon = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i>';
                try {
                    await window.appStore.deleteAlmacen(id);
                    window.UI.showToast("Almacén eliminado con éxito.");
                    window.UI.renderModuleContainer('almacenes');
                } catch (error) {
                    window.UI.showToast(error.message, 'error');
                    btn.innerHTML = icon;
                    if (window.lucide) window.lucide.createIcons();
                }
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('alm-submit-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            const id = document.getElementById('alm-id').value;
            const nombre = document.getElementById('alm-nombre').value;
            const direccion = document.getElementById('alm-dir').value;

            if (id) {
                await window.appStore.updateAlmacen(id, { nombre, direccion });
                window.UI.showToast(`Almacén "${nombre}" actualizado.`);
            } else {
                await window.appStore.addAlmacen({ nombre, direccion });
                window.UI.showToast(`Almacén "${nombre}" creado.`);
            }
            window.UI.renderModuleContainer('almacenes');
        } catch (error) {
            window.UI.showToast("Error al guardar: " + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// Módulo: PRODUCTOS (Frutas/Materia Prima)
// ==========================================
window.appModules['productos'] = () => {
    const productos = window.appStore.getProductos();

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-6">Catálogo de Productos y Frutas</h2>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Formulario -->
                <div class="lg:col-span-1">
                    <div class="surface-card p-6 sticky top-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="apple" class="w-5 h-5 text-success"></i>
                            Nueva Fruta / Producto
                        </h3>
                        <form id="form-producto" class="space-y-4">
                            <div class="form-group mb-6">
                                <label class="form-label mb-1 block">Nombre / Variedad de Fruta</label>
                                <input type="text" id="prodfrut-nombre" class="form-input" required placeholder="Ej: Aguacate Hass">
                            </div>
                            <button type="submit" class="btn btn-primary w-full" style="background-color: var(--accent-success); border-color: var(--accent-success)">
                                Registrar Fruta
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Lista (Grid simple) -->
                <div class="lg:col-span-2">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${productos.length === 0
            ? `<div class="col-span-full surface-card p-12 text-center text-text-secondary">No hay tipos de fruta registrados.</div>`
            : productos.map((p, i) => {
                // Pseudo-randomized colors based on index for variety
                const colorClasses = [
                    'text-green-400 bg-green-400/10 border-green-400/20',
                    'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
                    'text-red-400 bg-red-400/10 border-red-400/20',
                    'text-purple-400 bg-purple-400/10 border-purple-400/20'
                ];
                const colorClass = colorClasses[i % colorClasses.length];

                return `
                                <div class="surface-card p-4 flex flex-col items-center justify-center text-center group border hover:border-text-secondary/50 transition-colors">
                                    <div class="w-16 h-16 rounded-full flex items-center justify-center mb-3 ${colorClass} group-hover:scale-110 transition-transform">
                                        <i data-lucide="apple" class="w-8 h-8"></i>
                                    </div>
                                    <h4 class="text-base font-semibold text-white">${p.nombre}</h4>
                                </div>
                                `;
            }).join('')
        }
                    </div>
                </div>
            </div>
        </div >
        `;
};

window.appModuleEvents['productos'] = () => {
    const form = document.getElementById('form-producto');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Registrando...';
        btn.disabled = true;

        try {
            const nombre = document.getElementById('prodfrut-nombre').value;

            await window.appStore.addProducto({ nombre });
            window.UI.showToast(`Producto "${nombre}" registrado en catálogo.`);
            window.UI.renderModuleContainer('productos');
        } catch (error) {
            window.UI.showToast("Error al guardar: " + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};
