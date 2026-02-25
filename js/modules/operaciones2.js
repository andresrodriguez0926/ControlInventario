// Continuación de operaciones.js - Agregando las partes faltantes

// ==========================================
// 4. DESPACHO AL CLIENTE
// ==========================================
window.appModules['despacho-cliente'] = () => {
    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();
    const clientes = window.appStore.getClientes();

    // Solo permitir seleccionar almacenes y productos donde haya existencias
    const invAlmacen = window.appStore.getInventarioPorAlmacen();
    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente');

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Despacho a Clientes</h2>
            <p class="text-text-secondary mb-8">Venta o envío de mercancía a clientes finales.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-desp" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nuevo Despacho</button>
                <button id="tab-btn-historial-desp" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-desp" class="block">
            <form id="form-desp-cliente" class="surface-card p-6 md:p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="form-group">
                        <label class="form-label mb-1">Fecha de Despacho</label>
                        <input type="date" id="desp-fecha" class="form-input text-lg" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label mb-1">Cliente / Destinatario</label>
                        <select id="desc-cliente" class="form-select text-lg" required>
                            <option value="" disabled selected>Seleccione un cliente...</option>
                            ${clientes.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="mt-6 border border-border rounded-xl p-4 bg-surface-light/30">
                    <h4 class="text-primary font-semibold mb-4 flex items-center gap-2">
                        <i data-lucide="package-check" class="w-5 h-5"></i> Detalle de Despacho
                    </h4>
                    
                    <div id="desp-detalle-container" class="space-y-4">
                        <!-- Fila 1 de detalle -->
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end desp-fila relative p-4 border border-border rounded-lg">
                            <div class="form-group mb-0 md:col-span-1">
                                <label class="form-label mb-1 text-xs">Almacén Orígen</label>
                                <select class="form-select text-sm elm-almacen" required>
                                    ${generateSelectOptions(almacenes, 'Almacén...')}
                                </select>
                            </div>
                            <div class="form-group mb-0 md:col-span-2">
                                <label class="form-label mb-1 text-xs">Producto / Fruta</label>
                                <select class="form-select text-sm elm-producto" required>
                                    ${generateSelectOptions(productos, 'Producto...')}
                                </select>
                            </div>
                            <div class="form-group mb-0 md:col-span-1">
                                <label class="form-label mb-1 text-xs">Cant. Llenas</label>
                                <input type="number" class="form-input text-sm elm-cantidad" min="1" required placeholder="Cant.">
                            </div>
                        </div>
                    </div>
                    
                    <button type="button" id="btn-add-fila" class="mt-4 text-sm flex items-center gap-1 text-primary hover:text-primary-hover transition-colors font-medium">
                        <i data-lucide="plus" class="w-4 h-4 bg-primary/20 rounded-full p-1 box-content"></i> Añadir Lote
                    </button>
                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-primary w-full md:w-auto md:min-w-[200px]">Procesar Despacho</button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-desp" class="hidden">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <p class="text-text-secondary text-sm">Resumen de registros y tickets de despacho generados.</p>
                    <div class="flex items-center gap-3 bg-surface-light p-2 rounded-lg border border-border">
                        <label for="filtro-semana-despacho" class="text-sm font-medium text-text-secondary whitespace-nowrap">
                            <i data-lucide="calendar" class="w-4 h-4 inline mr-1"></i>Filtrar Semana:
                        </label>
                        <input type="week" id="filtro-semana-despacho" class="form-input bg-background/50 border-border text-sm py-1.5 focus:border-primary px-3">
                    </div>
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
                                    <th class="py-3 px-4 font-semibold">Canastas</th>
                                    <th class="py-3 px-4 font-semibold text-center w-32">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-historial-despacho">
                                <!-- Re-rendered via JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['despacho-cliente'] = () => {
    window.UI.makeSelectSearchable('desc-cliente');

    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-desp');
    const btnHistorial = document.getElementById('tab-btn-historial-desp');
    const contentNueva = document.getElementById('tab-content-nueva-desp');
    const contentHistorial = document.getElementById('tab-content-historial-desp');

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

    // Lógica Historial Semana
    const dateInput = document.getElementById('filtro-semana-despacho');
    const tbody = document.getElementById('tbody-historial-despacho');

    // Función compartida para obtener el rango de la semana (similar a charts.js)
    const getWeekRange = (weekString) => {
        const [yearStr, weekStr] = weekString.split('-W');
        const year = parseInt(yearStr, 10);
        const week = parseInt(weekStr, 10);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7;
        const p = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
        const startOfWeek = new Date(p.getTime() + (week - 1) * 7 * 86400000);
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
        endOfWeek.setUTCHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
    };

    const currentUser = window.appStore.currentUser;
    const isAdmin = currentUser && currentUser.rol?.toLowerCase() === 'admin';

    const loadHistoryWeek = () => {
        if (!dateInput || !tbody) return;

        let filteredHistorial = window.appStore.getActividad(300).filter(a => a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente');

        if (dateInput.value) {
            const { start, end } = getWeekRange(dateInput.value);
            // Tomamos una muestra más grande si filtramos por semana (para no perder records en 300 base)
            const globalFilter = window.appStore.getActividad(5000).filter(a => a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente');

            filteredHistorial = globalFilter.filter(a => {
                const d = new Date(a.date || a.fecha);
                return d >= start && d <= end;
            });
        }

        if (filteredHistorial.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No hay despachos ${dateInput.value ? 'en la semana seleccionada' : 'recientes'}.</td></tr>`;
        } else {
            tbody.innerHTML = filteredHistorial.map(a => {
                // Admin: siempre puede intentar editar (error aparece si no hay rawPayload)
                // Empleado: solo sus propios registros Y que tengan rawPayload
                const puedeEditar = isAdmin
                    ? true
                    : (a.rawPayload && (!a.usuario || (currentUser && a.usuario === currentUser.usuario)));
                const editBtn = puedeEditar
                    ? `<button type="button" onclick="window.prepararEdicionDespacho('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-2 flex items-center justify-center gap-1 border-primary/30 text-primary hover:bg-primary/10" title="Editar Registro"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>`
                    : '';
                return `
                <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                    <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                    <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${new Date(a.date).toLocaleDateString()}</td>
                    <td class="py-2.5 px-4 text-white">${a.detalle}</td>
                    <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${a.usuario || 'Sistema'}</td>
                    <td class="py-2.5 px-4 font-bold text-success">${a.cantidad}</td>
                    <td class="py-2.5 px-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-2 flex items-center justify-center gap-1 whitespace-nowrap" title="Ver Documento Origen">
                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                            </button>
                            ${editBtn}
                        </div>
                    </td>
                </tr>`;
            }).join('');
            if (window.lucide) window.lucide.createIcons({ root: tbody });
        }
    };

    if (dateInput) {
        // Set Current Week string default (optional or let it show "latest" if empty)
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const now = new Date(d.getTime() - offset);
        now.setUTCDate(now.getUTCDate() + 4 - (now.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((now - yearStart) / 86400000) + 1) / 7);
        dateInput.value = `${now.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;

        dateInput.addEventListener('change', loadHistoryWeek);
        loadHistoryWeek(); // initial load
    }

    const form = document.getElementById('form-desp-cliente');
    if (!form) return;

    const despFecha = document.getElementById('desp-fecha');
    if (despFecha) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const formatDate = (date) => {
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
            return localDate.toISOString().split('T')[0];
        };

        despFecha.min = formatDate(yesterday);
        despFecha.max = formatDate(tomorrow);
        despFecha.value = formatDate(today);
    }

    // Logica para agregar filas dinamicas
    const btnAdd = document.getElementById('btn-add-fila');
    const container = document.getElementById('desp-detalle-container');

    const addFila = (data = null) => {
        const firstRow = container.querySelector('.desp-fila');
        if (firstRow) {
            const newRow = firstRow.cloneNode(true);
            // add remove button
            const btnRemoveContainer = document.createElement('div');
            btnRemoveContainer.className = 'absolute -right-3 -top-3';
            const btnRemove = document.createElement('button');
            btnRemove.type = 'button';
            btnRemove.className = 'w-7 h-7 rounded-full bg-danger text-white flex items-center justify-center hover:bg-red-600 shadow-md transform transition hover:scale-110';
            btnRemove.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
            btnRemove.onclick = () => newRow.remove();

            btnRemoveContainer.appendChild(btnRemove);
            newRow.appendChild(btnRemoveContainer);

            if (data) {
                newRow.querySelector('.elm-almacen').value = data.almacenOrigenId;
                newRow.querySelector('.elm-producto').value = data.productoId;
                newRow.querySelector('.elm-cantidad').value = data.cantidad;
            } else {
                newRow.querySelector('.elm-cantidad').value = '';
            }

            container.appendChild(newRow);
            if (window.lucide) window.lucide.createIcons();
        }
    };

    if (btnAdd && container) {
        btnAdd.addEventListener('click', () => addFila());
    }

    // Preparar Edición Global
    window.prepararEdicionDespacho = (idActividad) => {
        const currentUser = window.appStore.currentUser;
        const isAdmin = currentUser && currentUser.rol?.toLowerCase() === 'admin';

        // Buscar usando el API correcto (getActividad) con límite alto para no perder registros
        const actividad = window.appStore.getActividad(10000).find(a => a.id === idActividad);
        if (!actividad || !actividad.rawPayload) {
            window.UI.showToast("No se puede editar este registro. Es demasiado antiguo o no tiene datos técnicos.", "error");
            return;
        }

        // Verificar permisos: admin puede editar todo, empleado solo sus propios registros
        if (!isAdmin && actividad.usuario && currentUser && actividad.usuario !== currentUser.usuario) {
            window.UI.showToast("Solo puedes editar tus propios registros.", "error");
            return;
        }

        const payload = actividad.rawPayload;

        // Switch Tab
        if (btnNueva) btnNueva.click();

        // Populate Main Form
        document.getElementById('desp-fecha').value = payload.fecha;
        document.getElementById('desc-cliente').value = payload.clienteNombre;

        // Custom search select update if needed
        const selCliente = document.getElementById('desc-cliente');
        if (selCliente.dispatchEvent) selCliente.dispatchEvent(new Event('change'));

        // Populate Rows
        // First clear added rows
        const allRows = container.querySelectorAll('.desp-fila');
        for (let i = 1; i < allRows.length; i++) allRows[i].remove();

        // Populate first row
        const firstRow = allRows[0];
        if (payload.detalles && payload.detalles.length > 0) {
            firstRow.querySelector('.elm-almacen').value = payload.detalles[0].almacenOrigenId;
            firstRow.querySelector('.elm-producto').value = payload.detalles[0].productoId;
            firstRow.querySelector('.elm-cantidad').value = payload.detalles[0].cantidad;

            // Add remaining rows
            for (let i = 1; i < payload.detalles.length; i++) {
                addFila(payload.detalles[i]);
            }
        }

        // Change Submit Button
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.innerHTML = 'Actualizar Despacho';
        btnSubmit.classList.replace('btn-primary', 'btn-warning');

        // Store edit ID in form
        form.dataset.editId = idActividad;

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.UI.showToast("Cargado para edición", "info");
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...';
        btn.disabled = true;

        try {
            const filas = document.querySelectorAll('.desp-fila');
            const detalles = [];
            let total = 0;

            filas.forEach(fila => {
                const cant = parseInt(fila.querySelector('.elm-cantidad').value);
                detalles.push({
                    almacenOrigenId: fila.querySelector('.elm-almacen').value,
                    productoId: fila.querySelector('.elm-producto').value,
                    cantidad: cant
                });
                total += cant;
            });

            const payload = {
                fecha: document.getElementById('desp-fecha').value,
                clienteNombre: document.getElementById('desc-cliente').value,
                detalles,
                total
            };

            const editId = form.dataset.editId;
            if (editId) {
                await window.appStore.editarDespachoCliente(editId, payload);
                window.UI.showToast('Despacho actualizado con éxito.');
                delete form.dataset.editId;
            } else {
                await window.appStore.despachoCliente(payload);
                window.UI.showToast('Despacho completado con éxito.');
            }

            form.reset();

            // remove added rows
            const allRows = document.querySelectorAll('.desp-fila');
            for (let i = 1; i < allRows.length; i++) allRows[i].remove();

            window.UI.renderModuleContainer('despacho-cliente');

        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 5. RECEPCIÓN DE CANASTAS (CLIENTES Y PRODUCTORES)
// ==========================================
window.appModules['recepcion-canastas'] = () => {
    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();
    const clientes = window.appStore.getClientes();
    const productores = window.appStore.getProductores();

    // Opciones para Radio Button
    const optProducts = generateSelectOptions(productos, 'Seleccione producto...');
    const optAlmacenes = generateSelectOptions(almacenes, 'Seleccione almacén destino...');
    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Devolución');

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Devolución de Canastas</h2>
            <p class="text-text-secondary mb-8">Recepción de canastas devueltas por clientes (vacías o retornos llenos).</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-dev" class="pb-3 px-2 font-semibold text-primary border-b-2 border-primary transition-colors">Nueva Devolución</button>
                <button id="tab-btn-historial-dev" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-dev" class="block">
            <form id="form-dev-canastas" class="surface-card p-6 md:p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-primary font-semibold">Datos de Devolución</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="dev-fecha" class="form-input text-sm py-1" required>
                        </div>
                    </div>

                    <div class="form-group md:col-span-2">
                        <label class="form-label mb-2 block text-primary">Tipo de Origen</label>
                        <div class="flex gap-4">
                            <label class="cursor-pointer flex items-center gap-2">
                                <input type="radio" name="dev-tipo-origen" value="cliente" class="form-radio text-primary" checked>
                                <span>Cliente</span>
                            </label>
                            <label class="cursor-pointer flex items-center gap-2">
                                <input type="radio" name="dev-tipo-origen" value="productor" class="form-radio text-primary">
                                <span>Productor</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group" id="container-dev-cliente">
                        <label class="form-label mb-1">Nombre del Cliente</label>
                        <select id="dev-cliente" class="form-select" required>
                            <option value="" disabled selected>Seleccione un cliente...</option>
                            ${clientes.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group hidden" id="container-dev-productor">
                        <label class="form-label mb-1">Nombre del Productor</label>
                        <select id="dev-productor" class="form-select">
                            <option value="" disabled selected>Seleccione un productor...</option>
                            ${productores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1">Cantidad Total de Canastas</label>
                        <input type="number" id="dev-cantidad" class="form-input text-lg font-bold" min="1" required placeholder="Ej: 20">
                    </div>

                    <div class="form-group md:col-span-2 mt-2">
                        <label class="form-label mb-2 block text-primary">Estado de las Canastas</label>
                        <div class="flex flex-col md:flex-row gap-4">
                            <label class="flex-1 cursor-pointer group">
                                <input type="radio" name="dev-estado" value="vacia" class="hidden peer" checked>
                                <div class="p-4 border border-border rounded-xl text-center peer-checked:border-warning peer-checked:bg-warning/10 transition-all transform peer-checked:scale-[1.02]">
                                    <div class="w-12 h-12 bg-warning/20 text-warning mx-auto rounded-full flex items-center justify-center mb-3">
                                        <i data-lucide="box" class="w-6 h-6"></i>
                                    </div>
                                    <span class="font-bold text-lg block mb-1">Vacías</span>
                                    <span class="text-xs text-text-secondary font-medium">Solo plástico a reciclar o reusar</span>
                                </div>
                            </label>
                            <label class="flex-1 cursor-pointer group">
                                <input type="radio" name="dev-estado" value="llena" class="hidden peer">
                                <div class="p-4 border border-border rounded-xl text-center peer-checked:border-success peer-checked:bg-success/10 transition-all transform peer-checked:scale-[1.02]">
                                    <div class="w-12 h-12 bg-success/20 text-success mx-auto rounded-full flex items-center justify-center mb-3">
                                        <i data-lucide="package" class="w-6 h-6"></i>
                                    </div>
                                    <span class="font-bold text-lg block mb-1">Llenas</span>
                                    <span class="text-xs text-text-secondary font-medium">Retorno o rechazo de mercancía</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Campos Condicionales (Se muestran si es Llena) -->
                    <div id="dev-llenas-fields" class="md:col-span-2 hidden animate-fade-in p-5 bg-surface-light border border-dashed border-success/30 rounded-xl mt-2 mb-2">
                        <div class="form-group mb-0">
                            <label class="form-label mb-2 text-success font-semibold flex items-center gap-2">
                                <i data-lucide="apple" class="w-4 h-4"></i> ¿De qué producto están llenas?
                            </label>
                            <select id="dev-producto" class="form-select border-success/20 focus:border-success">
                                ${optProducts}
                            </select>
                        </div>
                    </div>

                    <div class="form-group md:col-span-2 border-t border-border pt-6 mt-2">
                        <label class="form-label mb-1 font-semibold flex items-center gap-2">
                            <i data-lucide="warehouse" class="w-4 h-4 text-primary"></i> Almacén de Destino General
                        </label>
                        <select id="dev-almacen" class="form-select" required>
                            ${optAlmacenes}
                        </select>
                    </div>

                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-primary w-full md:w-auto md:min-w-[200px] shadow-lg shadow-primary/20 hover:shadow-primary/40">
                        Registrar Devolución
                    </button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-dev" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0">
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
                                        <td class="py-2.5 px-4 font-bold text-success">${a.cantidad}</td>
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

window.appModuleEvents['recepcion-canastas'] = () => {
    window.UI.makeSelectSearchable('dev-cliente');
    window.UI.makeSelectSearchable('dev-productor');

    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-dev');
    const btnHistorial = document.getElementById('tab-btn-historial-dev');
    const contentNueva = document.getElementById('tab-content-nueva-dev');
    const contentHistorial = document.getElementById('tab-content-historial-dev');

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

    const form = document.getElementById('form-dev-canastas');
    if (!form) return;

    // Logica toggle radio
    const radios = document.querySelectorAll('input[name="dev-estado"]');
    const fieldsLlena = document.getElementById('dev-llenas-fields');
    const selProducto = document.getElementById('dev-producto');

    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            if (e.target.value === 'llena') {
                fieldsLlena.classList.remove('hidden');
                selProducto.required = true;
            } else {
                fieldsLlena.classList.add('hidden');
                selProducto.required = false;
            }
        });
    });

    const radiosOrigen = document.querySelectorAll('input[name="dev-tipo-origen"]');
    const containerCliente = document.getElementById('container-dev-cliente');
    const containerProductor = document.getElementById('container-dev-productor');
    const selCliente = document.getElementById('dev-cliente');
    const selProductor = document.getElementById('dev-productor');

    radiosOrigen.forEach(r => {
        r.addEventListener('change', (e) => {
            if (e.target.value === 'cliente') {
                containerCliente.classList.remove('hidden');
                containerProductor.classList.add('hidden');
                selCliente.required = true;
                selProductor.required = false;
            } else {
                containerCliente.classList.add('hidden');
                containerProductor.classList.remove('hidden');
                selCliente.required = false;
                selProductor.required = true;
            }
        });
    });

    const devFecha = document.getElementById('dev-fecha');
    if (devFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        devFecha.min = minDate;
        devFecha.max = maxDate;
        devFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Registrando...';
        btn.disabled = true;

        try {
            const esLlena = document.querySelector('input[name="dev-estado"]:checked').value === 'llena';
            const tipoOrigen = document.querySelector('input[name="dev-tipo-origen"]:checked').value;

            await window.appStore.recepcionCanastas({
                tipoOrigen: tipoOrigen,
                clienteNombre: tipoOrigen === 'cliente' ? selCliente.value : null,
                productorId: tipoOrigen === 'productor' ? selProductor.value : null,
                cantidad: document.getElementById('dev-cantidad').value,
                esLlena: esLlena,
                productoId: esLlena ? selProducto.value : null,
                almacenDestinoId: document.getElementById('dev-almacen').value,
                fechaRecepcion: document.getElementById('dev-fecha').value
            });

            window.UI.showToast('Devolución registrada con éxito.');
            form.reset();
            fieldsLlena.classList.add('hidden');
            selProducto.required = false;
            containerCliente.classList.remove('hidden');
            containerProductor.classList.add('hidden');
            selCliente.required = true;
            selProductor.required = false;

            window.UI.renderModuleContainer('recepcion-canastas');

        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 6. DECOMISO DE PRODUCTO
// ==========================================
window.appModules['decomiso'] = () => {
    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();

    const optProducts = generateSelectOptions(productos, 'Seleccione producto...');
    const optAlmacenes = generateSelectOptions(almacenes, 'Seleccione almacén...');
    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Decomiso');

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-danger mb-2 flex items-center gap-2">
                <i data-lucide="trash-2" class="w-6 h-6"></i> Decomiso de Producto
            </h2>
            <p class="text-text-secondary mb-8">Descarte de fruta por mal estado. La fruta será descontada del inventario y la canasta quedará en estado vacío.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-dec" class="pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors">Nuevo Decomiso</button>
                <button id="tab-btn-historial-dec" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-dec" class="block">
            <form id="form-decomiso" class="surface-card p-6 md:p-8 border-2 border-danger/20 relative overflow-hidden">
                <!-- Decoración -->
                <div class="absolute -right-12 -top-12 w-48 h-48 bg-danger/5 rounded-full blur-3xl pointer-events-none"></div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-danger font-semibold flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> Datos de Decomiso</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="dec-fecha" class="form-input text-sm py-1 bg-danger/5 border-danger/30 focus:border-danger" required>
                        </div>
                    </div>

                    <div class="form-group border-b border-border pb-4 md:col-span-2">
                        <label class="form-label mb-2 text-danger font-semibold flex items-center gap-2">
                            <i data-lucide="apple" class="w-4 h-4"></i> Fruta / Producto a Decomisar
                        </label>
                        <select id="dec-producto" class="form-select bg-danger/5 border-danger/30 focus:border-danger" required>
                            ${optProducts}
                        </select>
                    </div>

                    <div class="form-group bg-surface-light/50 p-4 rounded-xl border border-border">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Paso 1: Salida</label>
                        <label class="form-label mb-2 font-semibold">Almacén Orígen (Dónde está la fruta)</label>
                        <select id="dec-almacen-origen" class="form-select" required>
                            ${optAlmacenes}
                        </select>
                    </div>

                    <div class="form-group bg-warning/5 p-4 rounded-xl border border-warning/20">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-warning/70">Paso 2: Destino</label>
                        <label class="form-label mb-2 font-semibold text-warning">Almacén Destino (A dónde va la vacía)</label>
                        <select id="dec-almacen-vacia" class="form-select border-warning/50 focus:border-warning" required>
                            ${optAlmacenes}
                        </select>
                    </div>

                    <div class="form-group md:col-span-2 border-t border-border pt-6">
                        <label class="form-label mb-2 font-bold text-white">Motivo del Decomiso / Movimiento</label>
                        <select id="dec-motivo" class="form-select bg-surface border-border text-lg mb-4" required>
                            <option value="">Seleccione un motivo...</option>
                            <option value="DE REGALO">DE REGALO</option>
                            <option value="BAJO PESO">BAJO PESO</option>
                            <option value="MAL ESTADO">MAL ESTADO</option>
                        </select>
                        
                        <label class="form-label mb-1 text-text-secondary">Descripción (Opcional)</label>
                        <input type="text" id="dec-desc" class="form-input" placeholder="Agregue información extra, lote, a quién se regaló, etc.">
                    </div>

                    <div class="form-group md:col-span-2 pt-2 pb-2">
                        <label class="form-label mb-2 font-bold text-lg text-danger">Cantidad a Mover (Nº Canastas Llenas)</label>
                        <div class="relative">
                            <input type="number" id="dec-cantidad" class="form-input text-xl py-4 pl-14 font-bold border-danger/30 text-danger focus:border-danger" min="1" required placeholder="Ej: 5">
                            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-danger">
                                <i data-lucide="alert-triangle" class="w-6 h-6"></i>
                            </div>
                        </div>
                    </div>

                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-danger w-full shadow-lg shadow-danger/20 hover:shadow-danger/40 text-lg py-3 flex items-center justify-center gap-2">
                        <i data-lucide="trash-2" class="w-5 h-5"></i> Confirmar Decomiso Definitivo
                    </button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-dec" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0 border border-danger/20 rounded-xl">
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
                                        <td class="py-2.5 px-4 font-bold text-danger">${a.cantidad}</td>
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

window.appModuleEvents['decomiso'] = () => {
    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-dec');
    const btnHistorial = document.getElementById('tab-btn-historial-dec');
    const contentNueva = document.getElementById('tab-content-nueva-dec');
    const contentHistorial = document.getElementById('tab-content-historial-dec');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-decomiso');
    if (!form) return;

    const decFecha = document.getElementById('dec-fecha');
    if (decFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        decFecha.min = minDate;
        decFecha.max = maxDate;
        decFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!confirm("⚠️ CONFIRMACIÓN REQUERIDA\n\n¿Está totalmente seguro de decomisar este producto?\nEsta acción descontará la fruta del inventario de lleno y aumentará el conteo de canastas vacías en el destino.\n\nEsta acción no se puede deshacer de forma sencilla.")) return;

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Eliminando...';
        btn.disabled = true;

        try {
            await window.appStore.decomiso({
                productoId: document.getElementById('dec-producto').value,
                cantidad: document.getElementById('dec-cantidad').value,
                almacenOrigenId: document.getElementById('dec-almacen-origen').value,
                almacenVaciasId: document.getElementById('dec-almacen-vacia').value,
                motivo: document.getElementById('dec-motivo').value,
                descripcion: document.getElementById('dec-desc').value,
                fechaDecomiso: document.getElementById('dec-fecha').value
            });

            window.UI.showToast('Decomiso procesado con éxito. El inventario ha sido actualizado.');
            form.reset();
            window.UI.renderModuleContainer('decomiso');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 7. CANASTAS DEMÁS (LLENADO EXCEDENTE)
// ==========================================
window.appModules['canastas-demas'] = () => {
    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();

    const optProducts = generateSelectOptions(productos, 'Seleccione producto...');
    const optAlmacenes = generateSelectOptions(almacenes, 'Seleccione almacén...');
    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás');

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-success mb-2 flex items-center gap-2">
                <i data-lucide="package-plus" class="w-6 h-6"></i> Canastas de Fruta Demás
            </h2>
            <p class="text-text-secondary mb-8">Convierte canastas vacías en canastas llenas. Útil cuando hay excedente de fruta o reclasificación.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-dem" class="pb-3 px-2 font-semibold text-success border-b-2 border-success transition-colors">Nuevo Llenado</button>
                <button id="tab-btn-historial-dem" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA OPERACIÓN -->
            <div id="tab-content-nueva-dem" class="block">
            <form id="form-demas" class="surface-card p-6 md:p-8 border-2 border-success/20 relative overflow-hidden">
                <!-- Decoración -->
                <div class="absolute -right-12 -top-12 w-48 h-48 bg-success/5 rounded-full blur-3xl pointer-events-none"></div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    
                    <div class="form-group md:col-span-2 border-b border-border pb-4 mb-2 flex justify-between items-center">
                        <h4 class="text-success font-semibold flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> Datos de Ingreso</h4>
                        <div class="w-48">
                            <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                            <input type="date" id="dem-fecha" class="form-input text-sm py-1 bg-success/5 border-success/30 focus:border-success" required>
                        </div>
                    </div>

                    <div class="form-group border-b border-border pb-4 md:col-span-2">
                        <label class="form-label mb-2 text-success font-semibold flex items-center gap-2">
                            <i data-lucide="apple" class="w-4 h-4"></i> Fruta / Producto a Agregar
                        </label>
                        <select id="dem-producto" class="form-select bg-success/5 border-success/30 focus:border-success" required>
                            ${optProducts}
                        </select>
                    </div>

                    <div class="form-group bg-warning/5 p-4 rounded-xl border border-warning/20">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-warning/70">Paso 1: Salida de Vacías</label>
                        <label class="form-label mb-2 font-semibold text-warning">Almacén Orígen (Dónde están las vacías)</label>
                        <select id="dem-almacen-origen" class="form-select border-warning/50 focus:border-warning" required>
                            ${optAlmacenes}
                        </select>
                    </div>

                    <div class="form-group bg-surface-light/50 p-4 rounded-xl border border-border">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Paso 2: Destino Llenas</label>
                        <label class="form-label mb-2 font-semibold">Almacén Destino (A dónde va la Fruta)</label>
                        <select id="dem-almacen-destino" class="form-select" required>
                            ${optAlmacenes}
                        </select>
                    </div>

                    <div class="form-group md:col-span-2 pt-6 border-t border-border">
                        <label class="form-label mb-2 font-bold text-lg text-success">Cantidad a Convertir (Nº Canastas)</label>
                        <div class="relative">
                            <input type="number" id="dem-cantidad" class="form-input text-xl py-4 pl-14 font-bold border-success/30 text-success focus:border-success" min="1" required placeholder="Ej: 5">
                            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-success">
                                <i data-lucide="plus-circle" class="w-6 h-6"></i>
                            </div>
                        </div>
                    </div>

                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="btn btn-primary w-full shadow-lg shadow-success/20 hover:shadow-success/40 text-lg py-3 flex items-center justify-center gap-2" style="background-color: var(--accent-success); border-color: var(--accent-success); color: #000;">
                        <i data-lucide="check-circle" class="w-5 h-5"></i> Confirmar Ingreso de Fruta
                    </button>
                </div>
            </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-dem" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0 border border-success/20 rounded-xl">
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
                                        <td class="py-2.5 px-4 font-bold text-success">${a.cantidad}</td>
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

window.appModuleEvents['canastas-demas'] = () => {
    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-dem');
    const btnHistorial = document.getElementById('tab-btn-historial-dem');
    const contentNueva = document.getElementById('tab-content-nueva-dem');
    const contentHistorial = document.getElementById('tab-content-historial-dem');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-success border-b-2 border-success transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-success border-b-2 border-success transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-demas');
    if (!form) return;

    const demFecha = document.getElementById('dem-fecha');
    if (demFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        demFecha.min = minDate;
        demFecha.max = maxDate;
        demFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            await window.appStore.canastasDemas({
                productoId: document.getElementById('dem-producto').value,
                cantidad: document.getElementById('dem-cantidad').value,
                almacenOrigenId: document.getElementById('dem-almacen-origen').value,
                almacenDestinoId: document.getElementById('dem-almacen-destino').value,
                fechaLlenado: document.getElementById('dem-fecha').value
            });

            window.UI.showToast('Fruta demás añadida con éxito. El inventario ha sido actualizado.');
            form.reset();
            window.UI.renderModuleContainer('canastas-demas');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

// ==========================================
// 6. SALIDA DE CANASTAS (Baja)
// ==========================================

window.appModules['salida-canastas'] = () => {
    const almacenes = window.appStore.getAlmacenes();
    const optsAlmacenes = generateSelectOptions(almacenes, 'Seleccione un almacén...');

    const historial = window.appStore.getActividad(300).filter(a => a.operacion === 'Salida Canastas');

    return `
        <div class="animate-fade-in max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Salida de Canastas Vacías (Baja)</h2>
            <p class="text-text-secondary mb-8">Elimina canastas vacías del inventario debido a deterioro, pérdida u otros motivos autorizados.</p>
            
            <!-- Tabs Navigation -->
            <div class="flex flex-wrap gap-4 border-b border-border mb-6">
                <button id="tab-btn-nueva-salida" class="pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors">Registrar Nueva Baja</button>
                <button id="tab-btn-historial-salida" class="pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors">Consultar Registros Anteriores</button>
            </div>

            <!-- TAB 1: NUEVA SALIDA -->
            <div id="tab-content-nueva-salida" class="block">
                <form id="form-salida-canastas" class="surface-card p-6 md:p-8">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        
                        <div class="form-group border-b border-border/30 pb-4 mb-2 md:col-span-2 flex justify-between items-center">
                            <div>
                                <h4 class="text-primary font-semibold">Datos de la Baja</h4>
                                <label class="form-label mb-1 mt-2">Nombre de quien da de baja</label>
                                <input type="text" id="salida-persona" class="form-input" required placeholder="Ej: Administrador / Encargado">
                            </div>
                            <div class="w-48 self-start mt-2">
                                <label class="form-label mb-1 text-xs text-text-muted">Fecha (Máx. 3 días)</label>
                                <input type="date" id="salida-fecha" class="form-input text-sm py-1" required>
                            </div>
                        </div>

                        <div class="surface-card p-4 border-dashed border-danger/30 bg-danger/5">
                            <h4 class="text-danger font-semibold mb-4 text-center">Detalle de Canastas</h4>
                            <div class="form-group mb-4">
                                <label class="form-label mb-1">Cantidad a dar de baja</label>
                                <input type="number" id="salida-cantidad" class="form-input border-danger/50 focus:border-danger" min="1" required placeholder="Ej: 5">
                            </div>
                            <div class="form-group">
                                <label class="form-label mb-1">Almacén de origen</label>
                                <select id="salida-almacen" class="form-select" required>
                                    ${optsAlmacenes}
                                </select>
                            </div>
                        </div>

                        <div class="surface-card p-4 border-dashed bg-surface-light/30">
                            <h4 class="text-text-secondary font-semibold mb-4 text-center">Justificación</h4>
                            <div class="form-group h-full">
                                <label class="form-label mb-1">Descripción o Motivo</label>
                                <textarea id="salida-descripcion" class="form-input resize-none h-24" required placeholder="Razón por la cual se extraen del inventario estas canastas."></textarea>
                            </div>
                        </div>

                    </div>
                    
                    <div class="mt-8 flex justify-end">
                        <button type="submit" class="btn bg-danger hover:bg-danger-hover text-white w-full md:w-auto md:min-w-[200px] border-none">
                            <i data-lucide="archive-x" class="w-4 h-4 mr-2"></i> Confirmar Baja
                        </button>
                    </div>
                </form>
            </div>

            <!-- TAB 2: HISTORIAL -->
            <div id="tab-content-historial-salida" class="hidden">
                <div class="surface-card overflow-hidden">
                    <div class="overflow-x-auto p-0 border border-danger/20 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-surface text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold">Doc #</th>
                                    <th class="py-3 px-4 font-semibold">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Detalle</th>
                                    <th class="py-3 px-4 font-semibold">Usuario</th>
                                    <th class="py-3 px-4 font-semibold">Cantidad</th>
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
                                        <td class="py-2.5 px-4 font-bold text-danger">${a.cantidad}</td>
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


window.appModuleEvents['salida-canastas'] = () => {
    // Tab Logic
    const btnNueva = document.getElementById('tab-btn-nueva-salida');
    const btnHistorial = document.getElementById('tab-btn-historial-salida');
    const contentNueva = document.getElementById('tab-content-nueva-salida');
    const contentHistorial = document.getElementById('tab-content-historial-salida');

    if (btnNueva && btnHistorial) {
        btnNueva.addEventListener('click', () => {
            btnNueva.className = 'pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors';
            btnHistorial.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentNueva.classList.remove('hidden');
            contentNueva.classList.add('block');
            contentHistorial.classList.add('hidden');
            contentHistorial.classList.remove('block');
        });

        btnHistorial.addEventListener('click', () => {
            btnHistorial.className = 'pb-3 px-2 font-semibold text-danger border-b-2 border-danger transition-colors';
            btnNueva.className = 'pb-3 px-2 font-medium text-text-secondary hover:text-white border-b-2 border-transparent hover:border-border transition-colors';
            contentHistorial.classList.remove('hidden');
            contentHistorial.classList.add('block');
            contentNueva.classList.add('hidden');
            contentNueva.classList.remove('block');
        });
    }

    const form = document.getElementById('form-salida-canastas');
    if (!form) return;

    const salidaFecha = document.getElementById('salida-fecha');
    if (salidaFecha) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        const maxDate = localISOTime;

        const minDateObj = new Date(today);
        minDateObj.setDate(today.getDate() - 3);
        const minLocalISOTime = (new Date(minDateObj - offset)).toISOString().slice(0, 10);
        const minDate = minLocalISOTime;

        salidaFecha.min = minDate;
        salidaFecha.max = maxDate;
        salidaFecha.value = maxDate;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!confirm("¿Está seguro que desea dar de baja estas canastas? Esta acción las descontará de forma permanente del inventario físico.")) return;

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando Baja...';
        btn.disabled = true;

        try {
            await window.appStore.bajaCanastasVacias({
                personaBaja: document.getElementById('salida-persona').value,
                cantidad: document.getElementById('salida-cantidad').value,
                almacenId: document.getElementById('salida-almacen').value,
                descripcion: document.getElementById('salida-descripcion').value,
                fechaBaja: document.getElementById('salida-fecha').value
            });

            window.UI.showToast('Baja de canastas registrada con éxito. Inventario descontado.');
            form.reset();
            window.UI.renderModuleContainer('salida-canastas');
        } catch (error) {
            window.UI.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};
