/**
 * Módulo: Historial de Canastas por Cliente
 * Muestra las canastas entregadas, devueltas y pendientes de cada cliente.
 * Tabla expandible con detalle de cada movimiento.
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
        // Use actividadCache directly for full access to all records
        const actividad = window.appStore.actividadCache || [];

        const desdeDate = desde ? new Date(desde + 'T00:00:00') : null;
        const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;

        // Mapa clienteId -> datos
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

        const parseFecha = (str) => {
            if (!str) return null;
            const s = String(str).substring(0, 10);
            const parts = s.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            return null;
        };

        actividad.forEach(a => {
            const raw = a.rawPayload;
            if (!raw) return;
            // NOTE: The field is 'operacion', NOT 'tipo'
            const operacion = a.operacion || '';

            // ======= DESPACHO A CLIENTE =======
            if (operacion === 'Despacho a Cliente') {
                // Date: fechaOperacion holds the user-selected date (YYYY-MM-DD)
                const fechaStr = a.fechaOperacion
                    ? String(a.fechaOperacion).substring(0, 10)
                    : (raw.fecha ? String(raw.fecha).substring(0, 10) : null);
                const fechaDate = parseFecha(fechaStr);

                if (desdeDate && fechaDate && fechaDate < desdeDate) return;
                if (hastaDate && fechaDate && fechaDate > hastaDate) return;

                const clienteId = raw.clienteId;
                const clienteNombre = raw.clienteNombre;
                const total = parseInt(raw.total) || 0;
                if (total <= 0) return;

                let entry = clienteId && mapaClientes[clienteId] ? mapaClientes[clienteId] : null;
                if (!entry && clienteNombre) {
                    const found = clientes.find(c => c.nombre === clienteNombre);
                    if (found) entry = mapaClientes[found.id];
                }
                if (!entry) {
                    const key = 'u_' + (clienteNombre || 'SinNombre').replace(/\s+/g, '_');
                    if (!mapaClientes[key]) {
                        mapaClientes[key] = { id: key, nombre: clienteNombre || 'Sin Nombre', entregadas: 0, devueltas: 0, movimientos: [] };
                    }
                    entry = mapaClientes[key];
                }

                entry.entregadas += total;
                entry.movimientos.push({
                    fecha: fechaStr || '—',
                    tipo: 'Entregadas',
                    cantidad: total,
                    sign: +1,
                    claseColor: 'text-danger'
                });
            }

            // ======= DEVOLUCIÓN DE CANASTAS (solo cliente) =======
            if (operacion === 'Devolución de Canastas') {
                if (raw.tipoOrigen !== 'cliente') return;

                // Date: fechaOperacion holds the user-selected date
                const fechaStr = a.fechaOperacion
                    ? String(a.fechaOperacion).substring(0, 10)
                    : (raw.fechaRecepcion ? String(raw.fechaRecepcion).substring(0, 10) : null);
                const fechaDate = parseFecha(fechaStr);

                if (desdeDate && fechaDate && fechaDate < desdeDate) return;
                if (hastaDate && fechaDate && fechaDate > hastaDate) return;

                const clienteId = raw.clienteId;
                const clienteNombre = raw.clienteNombre;
                const cantidad = parseInt(raw.cantidad) || 0;
                if (cantidad <= 0) return;

                let entry = clienteId && mapaClientes[clienteId] ? mapaClientes[clienteId] : null;
                if (!entry && clienteNombre) {
                    const found = clientes.find(c => c.nombre === clienteNombre);
                    if (found) entry = mapaClientes[found.id];
                }
                if (!entry) {
                    const key = 'u_' + (clienteNombre || 'SinNombre').replace(/\s+/g, '_');
                    if (!mapaClientes[key]) {
                        mapaClientes[key] = { id: key, nombre: clienteNombre || 'Sin Nombre', entregadas: 0, devueltas: 0, movimientos: [] };
                    }
                    entry = mapaClientes[key];
                }

                const tipoLabel = raw.esLlena ? 'Dev. Llenas' : 'Dev. Vacías';
                entry.devueltas += cantidad;
                entry.movimientos.push({
                    fecha: fechaStr || '—',
                    tipo: tipoLabel,
                    cantidad: cantidad,
                    sign: -1,
                    claseColor: 'text-success'
                });
            }
        });

        // Filtrar por cliente seleccionado
        let resultado = Object.values(mapaClientes).filter(c => {
            if (filtroClienteId && filtroClienteId !== 'TODOS') return c.id === filtroClienteId;
            return c.entregadas > 0 || c.devueltas > 0;
        });

        // Ordenar: primero mayor deuda, luego alfabético
        resultado.sort((a, b) => {
            const dA = a.entregadas - a.devueltas;
            const dB = b.entregadas - b.devueltas;
            if (dB !== dA) return dB - dA;
            return a.nombre.localeCompare(b.nombre);
        });

        return resultado;
    },

    renderTabla(filtroClienteId, desde, hasta) {
        const data = this.buildResumen(filtroClienteId, desde, hasta);
        const container = document.getElementById('canastas-tabla-container');
        if (!container) return;

        let sumaEntregadas = 0, sumaDevueltas = 0;

        const filas = data.map(c => {
            const pendiente = c.entregadas - c.devueltas;
            sumaEntregadas += c.entregadas;
            sumaDevueltas += c.devueltas;

            const pctDev = c.entregadas > 0 ? Math.round((c.devueltas / c.entregadas) * 100) : 0;
            const barWidth = Math.min(pctDev, 100);
            const pendColor = pendiente <= 0 ? 'text-success' : (pendiente > 100 ? 'text-danger' : 'text-warning');

            // Ordenar movimientos por fecha desc
            const movs = c.movimientos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

            // Calcular saldo corrido (cronológico ascendente)
            const movsAsc = c.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
            const saldosAsc = [];
            let saldo = 0;
            movsAsc.forEach(m => {
                saldo += m.sign * m.cantidad;
                saldosAsc.push(saldo);
            });
            // Mapeo: índice en desc -> saldo
            const saldoMap = {};
            movs.forEach((m, iDesc) => {
                const iAsc = movsAsc.findIndex((x, ix) => x === m && !saldoMap['used_' + ix]);
                // Simple mapping: find matching item
            });

            // Construir tabla de movimientos
            let saldoCorrido = 0;
            const filaDetalle = movsAsc.map(m => {
                saldoCorrido += m.sign * m.cantidad;
                const saldoColor = saldoCorrido > 0 ? 'color:#f59e0b' : 'color:#10b981';
                const tipoStyle = m.tipo === 'Entregadas'
                    ? 'background:rgba(239,68,68,0.15);color:#f87171;'
                    : 'background:rgba(16,185,129,0.15);color:#34d399;';
                return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px;">
                        <td style="padding:8px 16px; color:#9ca3af;">${m.fecha}</td>
                        <td style="padding:8px 16px;">
                            <span style="padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; ${tipoStyle}">${m.tipo}</span>
                        </td>
                        <td style="padding:8px 16px; text-align:right; font-weight:bold; ${m.tipo === 'Entregadas' ? 'color:#f87171' : 'color:#34d399'}">
                            ${m.tipo === 'Entregadas' ? '+' : '-'}${m.cantidad.toLocaleString()}
                        </td>
                        <td style="padding:8px 16px; text-align:right; font-weight:bold; ${saldoColor}">
                            ${saldoCorrido.toLocaleString()}
                        </td>
                    </tr>`;
            }).reverse().join(''); // mostrar de más reciente a más antiguo

            const idSafe = c.id.replace(/[^a-zA-Z0-9]/g, '_');

            return `
                <!-- FILA PRINCIPAL (expandible) -->
                <tr class="canasta-row-main border-b border-border hover:bg-surface-light transition-colors cursor-pointer"
                    data-target="detalle-${idSafe}"
                    style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <td style="padding:12px 16px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="display:inline-block; width:20px; transition:transform 0.2s;" class="expand-icon-${idSafe}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </span>
                            <span style="font-weight:600; color:white;">${c.nombre}</span>
                        </div>
                    </td>
                    <td style="padding:12px 16px; text-align:right; color:#f87171; font-weight:bold;">${c.entregadas.toLocaleString()}</td>
                    <td style="padding:12px 16px; text-align:right; color:#34d399; font-weight:bold;">${c.devueltas.toLocaleString()}</td>
                    <td style="padding:12px 16px; text-align:right; font-weight:bold; font-size:18px; ${pendiente <= 0 ? 'color:#34d399' : pendiente > 100 ? 'color:#f87171' : 'color:#f59e0b'}">${pendiente.toLocaleString()}</td>
                    <td style="padding:12px 16px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:9999px; height:6px; overflow:hidden;">
                                <div style="width:${barWidth}%; height:6px; border-radius:9999px; background:${pendiente <= 0 ? '#10b981' : '#f59e0b'};"></div>
                            </div>
                            <span style="font-size:12px; color:#9ca3af; min-width:32px; text-align:right;">${pctDev}%</span>
                        </div>
                    </td>
                </tr>
                <!-- FILA EXPANDIBLE -->
                <tr id="detalle-${idSafe}" style="display:none;">
                    <td colspan="5" style="padding:0; background:rgba(255,255,255,0.02);">
                        <div style="border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06);">
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:rgba(255,255,255,0.04); font-size:11px; text-transform:uppercase; color:#6b7280;">
                                        <th style="padding:8px 16px; text-align:left; font-weight:600;">Fecha</th>
                                        <th style="padding:8px 16px; text-align:left; font-weight:600;">Tipo</th>
                                        <th style="padding:8px 16px; text-align:right; font-weight:600;">Cantidad</th>
                                        <th style="padding:8px 16px; text-align:right; font-weight:600;">Saldo Canastas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${movs.length === 0
                    ? `<tr><td colspan="4" style="padding:16px; text-align:center; color:#6b7280;">Sin movimientos</td></tr>`
                    : filaDetalle}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        const sumaPendiente = sumaEntregadas - sumaDevueltas;
        const sumaPctDev = sumaEntregadas > 0 ? Math.round((sumaDevueltas / sumaEntregadas) * 100) : 0;

        container.innerHTML = `
            <div style="border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.05); font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:1px solid rgba(255,255,255,0.08);">
                            <th style="padding:12px 16px; text-align:left; font-weight:600;">Cliente</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600; color:#f87171;">Entregadas</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600; color:#34d399;">Devueltas</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600;">Pendiente</th>
                            <th style="padding:12px 16px; text-align:left; font-weight:600;">% Devuelto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || `<tr><td colspan="5" style="padding:40px; text-align:center; color:#6b7280; font-style:italic;">No hay movimientos con los filtros aplicados.</td></tr>`}
                    </tbody>
                    <tfoot>
                        <tr style="background:rgba(255,255,255,0.04); border-top:2px solid rgba(255,255,255,0.1); font-weight:bold; font-size:13px;">
                            <td style="padding:12px 16px; color:#9ca3af; text-transform:uppercase; font-size:11px;">TOTAL</td>
                            <td style="padding:12px 16px; text-align:right; color:#f87171;">${sumaEntregadas.toLocaleString()}</td>
                            <td style="padding:12px 16px; text-align:right; color:#34d399;">${sumaDevueltas.toLocaleString()}</td>
                            <td style="padding:12px 16px; text-align:right; font-size:18px; ${sumaPendiente > 0 ? 'color:#f59e0b' : 'color:#34d399'}">${sumaPendiente.toLocaleString()}</td>
                            <td style="padding:12px 16px; color:#9ca3af; font-size:11px;">${sumaPctDev}% devuelto global</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;

        // Registrar eventos de expansión
        container.querySelectorAll('.canasta-row-main').forEach(row => {
            row.addEventListener('click', () => {
                const targetId = row.getAttribute('data-target');
                const detalleRow = document.getElementById(targetId);
                if (!detalleRow) return;

                const isOpen = detalleRow.style.display !== 'none';
                detalleRow.style.display = isOpen ? 'none' : 'table-row';

                // Rotar icono
                const iconEl = row.querySelector('[class^="expand-icon"]');
                if (iconEl) iconEl.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
            });
        });
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
                    <p class="text-text-secondary text-sm">Control de canastas entregadas, devueltas y pendientes. Haz clic en un cliente para ver el detalle.</p>
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

            <!-- Tabla principal (dinámica) -->
            <div id="canastas-tabla-container">
                <div class="surface-card p-12 text-center text-text-secondary">Cargando...</div>
            </div>
        </div>
    `;
};

// ===== EVENTOS DEL MÓDULO =====
window.appModuleEvents['canastas-cliente'] = () => {
    // Carga inicial (todos los clientes, sin filtro de fecha)
    window.CanastasClienteController.renderTabla(null, null, null);

    // Botón Filtrar
    document.getElementById('btn-filtrar-canastas')?.addEventListener('click', () => {
        const clienteId = document.getElementById('canastas-filtro-cliente').value;
        const desde = document.getElementById('canastas-filtro-desde').value;
        const hasta = document.getElementById('canastas-filtro-hasta').value;
        window.CanastasClienteController.renderTabla(
            clienteId === 'TODOS' ? null : clienteId,
            desde || null,
            hasta || null
        );
    });

    // Botón Limpiar
    document.getElementById('btn-limpiar-filtro-canastas')?.addEventListener('click', () => {
        document.getElementById('canastas-filtro-cliente').value = 'TODOS';
        document.getElementById('canastas-filtro-desde').value = '';
        document.getElementById('canastas-filtro-hasta').value = '';
        window.CanastasClienteController.renderTabla(null, null, null);
    });
};
