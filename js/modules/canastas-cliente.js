/**
 * Módulo: Historial de Canastas por Cliente
 * Muestra las canastas entregadas, devueltas y pendientes de cada cliente.
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.CanastasClienteController = {

    /**
     * Construye el resumen de canastas por cliente leyendo la actividad del sistema.
     * @param {string|null} filtroClienteId  - ID del cliente a filtrar, o null = todos
     * @param {string|null} desde            - Fecha inicio YYYY-MM-DD
     * @param {string|null} hasta            - Fecha fin YYYY-MM-DD
     */
    buildResumen(filtroClienteId, desde, hasta) {
        const clientes = window.appStore.getClientes();
        const actividad = window.appStore.getActividad(5000); // Traer todo el historial

        // Parsear fechas de filtro
        const desdeDate = desde ? new Date(desde + 'T00:00:00') : null;
        const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;

        // Construir mapa: clienteId -> { nombre, entregadas, devueltas }
        const mapaClientes = {};

        clientes.forEach(c => {
            mapaClientes[c.id] = {
                id: c.id,
                nombre: c.nombre,
                entregadas: 0,
                devueltas: 0,
                movimientos: []
            };
        });

        actividad.forEach(a => {
            const raw = a.rawPayload;
            if (!raw) return;

            // Obtener fecha del movimiento
            let fechaStr = raw.fecha || a.fechaOperacion || '';
            let fechaDate = null;
            if (fechaStr) {
                // Parsear como local (evitar UTC offset)
                if (fechaStr.length >= 10) {
                    const parts = fechaStr.substring(0, 10).split('-');
                    if (parts.length === 3) {
                        fechaDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                }
                if (!fechaDate) fechaDate = new Date(fechaStr);
            }

            // Aplicar filtro de fechas
            if (fechaDate) {
                if (desdeDate && fechaDate < desdeDate) return;
                if (hastaDate && fechaDate > hastaDate) return;
            }

            const tipo = a.tipo || '';

            // --- DESPACHO A CLIENTE (entregadas) ---
            if (tipo === 'Despacho a Cliente') {
                const clienteId = raw.clienteId;
                const clienteNombre = raw.clienteNombre;
                const total = parseInt(raw.total) || 0;
                if (total <= 0) return;

                let entry = clienteId ? mapaClientes[clienteId] : null;
                if (!entry && clienteNombre) {
                    // Buscar por nombre
                    const found = clientes.find(c => c.nombre === clienteNombre);
                    if (found) entry = mapaClientes[found.id];
                }
                if (!entry) {
                    // Cliente no en catálogo, agregar dinámicamente
                    const key = 'unknown_' + (clienteNombre || 'SinNombre');
                    if (!mapaClientes[key]) {
                        mapaClientes[key] = { id: key, nombre: clienteNombre || 'Sin Nombre', entregadas: 0, devueltas: 0, movimientos: [] };
                    }
                    entry = mapaClientes[key];
                }

                entry.entregadas += total;
                entry.movimientos.push({
                    fecha: fechaStr ? fechaStr.substring(0, 10) : '—',
                    tipo: 'Entregadas',
                    cantidad: total,
                    sign: +1,
                    claseColor: 'text-danger'
                });
            }

            // --- DEVOLUCIÓN CANASTAS (devueltas) ---
            if (tipo === 'Devolución Canastas' || tipo === 'Recepción Canastas' || tipo === 'Devolución Canastas Llenas') {
                const entidadTipo = raw.entidadTipo || raw.tipo || '';
                if (entidadTipo !== 'cliente' && entidadTipo !== 'Cliente') return;

                const clienteId = raw.entidadId || raw.clienteId;
                const clienteNombre = raw.entidadNombre || raw.clienteNombre;
                const cantidad = parseInt(raw.cantidad) || 0;
                if (cantidad <= 0) return;

                let entry = clienteId ? mapaClientes[clienteId] : null;
                if (!entry && clienteNombre) {
                    const found = clientes.find(c => c.nombre === clienteNombre);
                    if (found) entry = mapaClientes[found.id];
                }
                if (!entry) {
                    const key = 'unknown_' + (clienteNombre || 'SinNombre');
                    if (!mapaClientes[key]) {
                        mapaClientes[key] = { id: key, nombre: clienteNombre || 'Sin Nombre', entregadas: 0, devueltas: 0, movimientos: [] };
                    }
                    entry = mapaClientes[key];
                }

                entry.devueltas += cantidad;
                entry.movimientos.push({
                    fecha: fechaStr ? fechaStr.substring(0, 10) : '—',
                    tipo: 'Devueltas',
                    cantidad: cantidad,
                    sign: -1,
                    claseColor: 'text-success'
                });
            }
        });

        // Filtrar por cliente si aplica
        let resultado = Object.values(mapaClientes).filter(c => {
            if (filtroClienteId && filtroClienteId !== 'TODOS') return c.id === filtroClienteId;
            return true;
        });

        // Ordenar: primero los que tienen deuda, luego alfabético
        resultado.sort((a, b) => {
            const deudaA = a.entregadas - a.devueltas;
            const deudaB = b.entregadas - b.devueltas;
            if (deudaB !== deudaA) return deudaB - deudaA;
            return a.nombre.localeCompare(b.nombre);
        });

        return resultado;
    },

    renderTablaResumen(filtroClienteId, desde, hasta) {
        const data = this.buildResumen(filtroClienteId, desde, hasta);
        const tbody = document.getElementById('canastas-cliente-tbody');
        const totalRow = document.getElementById('canastas-cliente-total-row');
        if (!tbody) return;

        tbody.innerHTML = '';
        let sumaEntregadas = 0, sumaDevueltas = 0;

        data.forEach(c => {
            const pendiente = c.entregadas - c.devueltas;
            if (c.entregadas === 0 && c.devueltas === 0) return; // Omitir clientes sin movimiento

            sumaEntregadas += c.entregadas;
            sumaDevueltas += c.devueltas;

            const pctDev = c.entregadas > 0 ? Math.round((c.devueltas / c.entregadas) * 100) : 0;
            const pctColor = pendiente <= 0 ? 'text-success' : (pendiente > 50 ? 'text-danger' : 'text-warning');
            const barWidth = Math.min(pctDev, 100);

            const tr = document.createElement('tr');
            tr.className = 'border-b border-border hover:bg-surface-light transition-colors cursor-pointer';
            tr.setAttribute('data-cliente-id', c.id);
            tr.innerHTML = `
                <td class="py-3 px-4 font-semibold text-white">${c.nombre}</td>
                <td class="py-3 px-4 text-right text-danger font-bold">${c.entregadas.toLocaleString()}</td>
                <td class="py-3 px-4 text-right text-success font-bold">${c.devueltas.toLocaleString()}</td>
                <td class="py-3 px-4 text-right ${pctColor} font-bold text-lg">${pendiente.toLocaleString()}</td>
                <td class="py-3 px-4 min-w-[120px]">
                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-surface-light rounded-full h-2 overflow-hidden">
                            <div class="h-2 rounded-full ${pendiente <= 0 ? 'bg-success' : 'bg-warning'}" style="width:${barWidth}%"></div>
                        </div>
                        <span class="text-xs text-text-secondary w-10 text-right">${pctDev}%</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-center">
                    <button class="btn-ver-detalle-canastas text-info hover:text-info-light text-xs flex items-center gap-1 mx-auto" data-cliente-id="${c.id}">
                        <i data-lucide="list" class="w-3.5 h-3.5"></i> Ver detalle
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Totals row
        const sumaPendiente = sumaEntregadas - sumaDevueltas;
        if (totalRow) {
            totalRow.innerHTML = `
                <td class="py-3 px-4 font-bold text-text-secondary uppercase text-xs">TOTAL</td>
                <td class="py-3 px-4 text-right text-danger font-bold">${sumaEntregadas.toLocaleString()}</td>
                <td class="py-3 px-4 text-right text-success font-bold">${sumaDevueltas.toLocaleString()}</td>
                <td class="py-3 px-4 text-right ${sumaPendiente > 0 ? 'text-warning' : 'text-success'} font-bold text-lg">${sumaPendiente.toLocaleString()}</td>
                <td colspan="2"></td>
            `;
        }

        if (window.lucide) window.lucide.createIcons({ nodes: Array.from(tbody.querySelectorAll('[data-lucide]')) });
    },

    renderDetalle(clienteId, desde, hasta) {
        const data = this.buildResumen(clienteId, desde, hasta);
        const entry = data.find(c => c.id === clienteId);
        const modal = document.getElementById('canastas-detalle-modal');
        const contenido = document.getElementById('canastas-detalle-contenido');
        const titulo = document.getElementById('canastas-detalle-titulo');
        if (!modal || !contenido || !entry) return;

        titulo.textContent = `Historial de Canastas — ${entry.nombre}`;

        // Ordenar movimientos por fecha desc
        const movs = entry.movimientos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

        const pendiente = entry.entregadas - entry.devueltas;
        const pctDev = entry.entregadas > 0 ? Math.round((entry.devueltas / entry.entregadas) * 100) : 0;

        contenido.innerHTML = `
            <!-- Tarjetas de resumen -->
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="surface-card p-4 text-center border border-danger/20">
                    <p class="text-xs text-text-secondary mb-1 uppercase">Entregadas</p>
                    <p class="text-3xl font-bold text-danger">${entry.entregadas.toLocaleString()}</p>
                </div>
                <div class="surface-card p-4 text-center border border-success/20">
                    <p class="text-xs text-text-secondary mb-1 uppercase">Devueltas</p>
                    <p class="text-3xl font-bold text-success">${entry.devueltas.toLocaleString()}</p>
                </div>
                <div class="surface-card p-4 text-center border ${pendiente > 0 ? 'border-warning/20' : 'border-success/20'}">
                    <p class="text-xs text-text-secondary mb-1 uppercase">Pendiente</p>
                    <p class="text-3xl font-bold ${pendiente > 0 ? 'text-warning' : 'text-success'}">${pendiente.toLocaleString()}</p>
                    <p class="text-xs text-text-secondary mt-1">${pctDev}% devuelto</p>
                </div>
            </div>

            <!-- Tabla de movimientos -->
            <div class="overflow-x-auto border border-border rounded-lg bg-surface">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-surface-light text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                            <th class="py-3 px-4">Fecha</th>
                            <th class="py-3 px-4">Tipo</th>
                            <th class="py-3 px-4 text-right">Cantidad</th>
                            <th class="py-3 px-4 text-right">Saldo Parcial</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movs.length === 0
                ? `<tr><td colspan="4" class="py-8 text-center text-text-secondary">Sin movimientos registrados.</td></tr>`
                : (() => {
                    let saldoAcum = 0;
                    // Calcular saldo cronológico (de más viejo a más nuevo)
                    const ordenAsc = movs.slice().reverse();
                    const saldosMap = {};
                    let running = 0;
                    ordenAsc.forEach((m, i) => {
                        running += m.sign * m.cantidad;
                        saldosMap[i] = running;
                    });
                    // Ahora renderizar en desc con los saldos correctos
                    return movs.map((m, i) => {
                        // saldo en desc = saldo al final de la lista - acumulado hasta la posicion inversa
                        const idxAsc = movs.length - 1 - i;
                        const saldo = saldosMap[idxAsc];
                        const saldoColor = saldo > 0 ? 'text-warning' : 'text-success';
                        const tipoColor = m.tipo === 'Entregadas' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success';
                        return `
                            <tr class="border-b border-border hover:bg-surface-light transition-colors">
                                <td class="py-3 px-4 text-text-secondary text-sm">${m.fecha}</td>
                                <td class="py-3 px-4">
                                    <span class="text-xs px-2 py-1 rounded-full font-semibold ${tipoColor}">${m.tipo}</span>
                                </td>
                                <td class="py-3 px-4 text-right font-bold ${m.claseColor}">${m.tipo === 'Entregadas' ? '+' : '-'}${m.cantidad.toLocaleString()}</td>
                                <td class="py-3 px-4 text-right font-bold ${saldoColor}">${saldo.toLocaleString()}</td>
                            </tr>`;
                    }).join('');
                })()
            }
                    </tbody>
                </table>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

// ===== VISTA DEL MÓDULO =====
window.appModules['canastas-cliente'] = () => {
    const clientes = window.appStore.getClientes();

    return `
        <div class="animate-fade-in max-w-6xl mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-white">Historial de Canastas por Cliente</h2>
                    <p class="text-text-secondary text-sm">Control de canastas entregadas, devueltas y pendientes por cobrar.</p>
                </div>
            </div>

            <!-- Filtros -->
            <div class="surface-card p-4 mb-6 flex flex-col md:flex-row gap-4 items-end border border-border">
                <div class="form-group mb-0 flex-1">
                    <label class="form-label text-xs">Cliente</label>
                    <select id="canastas-filtro-cliente" class="form-select text-sm">
                        <option value="TODOS">— Todos los Clientes —</option>
                        ${clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label text-xs">Desde</label>
                    <input type="date" id="canastas-filtro-desde" class="form-input text-sm">
                </div>
                <div class="form-group mb-0">
                    <label class="form-label text-xs">Hasta</label>
                    <input type="date" id="canastas-filtro-hasta" class="form-input text-sm">
                </div>
                <div class="form-group mb-0">
                    <button id="btn-filtrar-canastas" type="button" class="btn btn-primary h-[38px] px-6 text-sm flex items-center gap-2 rounded-lg">
                        <i data-lucide="search" class="w-4 h-4"></i> Filtrar
                    </button>
                </div>
                <div class="form-group mb-0">
                    <button id="btn-limpiar-filtro-canastas" type="button" class="btn h-[38px] px-4 text-sm flex items-center gap-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-white">
                        <i data-lucide="x" class="w-4 h-4"></i> Limpiar
                    </button>
                </div>
            </div>

            <!-- Tabla principal -->
            <div class="surface-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-surface-light text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                <th class="py-3 px-4 font-semibold">Cliente</th>
                                <th class="py-3 px-4 font-semibold text-right">Entregadas</th>
                                <th class="py-3 px-4 font-semibold text-right">Devueltas</th>
                                <th class="py-3 px-4 font-semibold text-right">Pendiente</th>
                                <th class="py-3 px-4 font-semibold">% Devuelto</th>
                                <th class="py-3 px-4 font-semibold text-center">Detalle</th>
                            </tr>
                        </thead>
                        <tbody id="canastas-cliente-tbody">
                            <tr>
                                <td colspan="6" class="py-10 text-center text-text-secondary italic">Cargando historial...</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr id="canastas-cliente-total-row" class="bg-surface-light border-t-2 border-border text-sm">
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal Detalle -->
        <div id="canastas-detalle-modal" class="hidden fixed inset-0 bg-black/70 z-50 items-center justify-center p-4 backdrop-blur-sm">
            <div class="surface-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-border">
                <div class="flex justify-between items-center p-6 border-b border-border flex-shrink-0">
                    <h3 id="canastas-detalle-titulo" class="text-lg font-bold text-white"></h3>
                    <button id="btn-cerrar-canastas-modal" class="w-8 h-8 rounded-full bg-surface hover:bg-danger/20 text-text-secondary hover:text-danger flex items-center justify-center transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div id="canastas-detalle-contenido" class="overflow-y-auto p-6 flex-1">
                </div>
            </div>
        </div>
    `;
};

// ===== EVENTOS DEL MÓDULO =====
window.appModuleEvents['canastas-cliente'] = () => {
    // Cargar tabla inicial (sin filtros)
    window.CanastasClienteController.renderTablaResumen(null, null, null);

    // Botón filtrar
    document.getElementById('btn-filtrar-canastas')?.addEventListener('click', () => {
        const clienteId = document.getElementById('canastas-filtro-cliente').value;
        const desde = document.getElementById('canastas-filtro-desde').value;
        const hasta = document.getElementById('canastas-filtro-hasta').value;
        window.CanastasClienteController.renderTablaResumen(
            clienteId === 'TODOS' ? null : clienteId,
            desde || null,
            hasta || null
        );
    });

    // Botón limpiar
    document.getElementById('btn-limpiar-filtro-canastas')?.addEventListener('click', () => {
        document.getElementById('canastas-filtro-cliente').value = 'TODOS';
        document.getElementById('canastas-filtro-desde').value = '';
        document.getElementById('canastas-filtro-hasta').value = '';
        window.CanastasClienteController.renderTablaResumen(null, null, null);
    });

    // Botón ver detalle (event delegation)
    document.getElementById('canastas-cliente-tbody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-ver-detalle-canastas');
        if (!btn) return;
        const clienteId = btn.getAttribute('data-cliente-id');
        const desde = document.getElementById('canastas-filtro-desde').value;
        const hasta = document.getElementById('canastas-filtro-hasta').value;
        window.CanastasClienteController.renderDetalle(clienteId, desde || null, hasta || null);
    });

    // Cerrar modal
    document.getElementById('btn-cerrar-canastas-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('canastas-detalle-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });

    // Cerrar modal al hacer clic fuera
    document.getElementById('canastas-detalle-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
            e.currentTarget.classList.remove('flex');
        }
    });
};
