/**
 * Módulo: Historial de Canastas por Cliente
 * Lógica contable: Saldo Anterior al Período + Movimientos del Período = Saldo Real
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.CanastasClienteController = {

    /**
     * Extrae todos los movimientos de un cliente desde la actividad.
     * Retorna arreglo de { fecha, tipo, cantidad, sign }
     */
    _getMovimientosCliente(actividad, clientes) {
        const mapaClientes = {};
        clientes.forEach(c => {
            mapaClientes[c.id] = { id: c.id, nombre: c.nombre, movimientos: [] };
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

        const getFechaStr = (a, raw) => {
            const f = a.fechaOperacion || raw.fecha || raw.fechaRecepcion || '';
            return String(f).substring(0, 10);
        };

        const findOrCreate = (clienteId, clienteNombre) => {
            if (clienteId && mapaClientes[clienteId]) return mapaClientes[clienteId];
            if (clienteNombre) {
                const found = clientes.find(c => c.nombre === clienteNombre);
                if (found && mapaClientes[found.id]) return mapaClientes[found.id];
            }
            const key = 'u_' + (clienteNombre || 'SinNombre').replace(/\s+/g, '_');
            if (!mapaClientes[key]) {
                mapaClientes[key] = { id: key, nombre: clienteNombre || 'Sin Nombre', movimientos: [] };
            }
            return mapaClientes[key];
        };

        actividad.forEach(a => {
            const raw = a.rawPayload;
            if (!raw) return;
            const operacion = a.operacion || '';

            if (operacion === 'Despacho a Cliente') {
                const fechaStr = getFechaStr(a, raw);
                const fechaDate = parseFecha(fechaStr);
                const total = parseInt(raw.total) || 0;
                if (total <= 0 || !fechaDate) return;
                const entry = findOrCreate(raw.clienteId, raw.clienteNombre);
                entry.movimientos.push({ fecha: fechaStr, fechaDate, tipo: 'Entregadas', cantidad: total, sign: +1 });
            }

            if (operacion === 'Devolución de Canastas') {
                if (raw.tipoOrigen !== 'cliente') return;
                const fechaStr = getFechaStr(a, raw);
                const fechaDate = parseFecha(fechaStr);
                const cantidad = parseInt(raw.cantidad) || 0;
                if (cantidad <= 0 || !fechaDate) return;
                const entry = findOrCreate(raw.clienteId, raw.clienteNombre);
                const tipoLabel = raw.esLlena ? 'Dev. Llenas' : 'Dev. Vacías';
                entry.movimientos.push({ fecha: fechaStr, fechaDate, tipo: tipoLabel, cantidad, sign: -1 });
            }
        });

        return mapaClientes;
    },

    /**
     * Construye el resumen final para la tabla.
     * Cuando hay filtro de fecha, calcula el saldo anterior al período para
     * obtener el balance real al cierre del período.
     */
    buildResumen(filtroClienteId, desde, hasta) {
        const clientes = window.appStore.getClientes();
        const actividad = window.appStore.actividadCache || [];

        const desdeDate = desde ? new Date(desde + 'T00:00:00') : null;
        const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;
        const hayFiltroFecha = !!(desdeDate || hastaDate);

        const mapaClientes = this._getMovimientosCliente(actividad, clientes);

        // Calcular para cada cliente:
        // - saldoAnterior: acumulado de todos los movimientos ANTES del filtro 'desde'
        // - entregadasPeriodo / devueltasPeriodo: dentro del rango
        // - pendiente = saldoAnterior + entregadasPeriodo - devueltasPeriodo
        const resultado = Object.values(mapaClientes).map(c => {
            let saldoAnterior = 0;
            let entregadasPeriodo = 0;
            let devueltasPeriodo = 0;
            const movimientosPeriodo = [];

            c.movimientos.forEach(m => {
                const antes = desdeDate && m.fechaDate < desdeDate;
                const despues = hastaDate && m.fechaDate > hastaDate;

                if (antes) {
                    // Movimiento anterior al período → solo suma al saldo anterior
                    saldoAnterior += m.sign * m.cantidad;
                } else if (!despues) {
                    // Dentro del rango (o sin rango)
                    if (m.sign > 0) entregadasPeriodo += m.cantidad;
                    else devueltasPeriodo += m.cantidad;
                    movimientosPeriodo.push(m);
                }
                // Movimientos después del rango son ignorados (no afectan el reporte)
            });

            const pendiente = saldoAnterior + entregadasPeriodo - devueltasPeriodo;

            return {
                id: c.id,
                nombre: c.nombre,
                saldoAnterior,
                entregadasPeriodo,
                devueltasPeriodo,
                pendiente,
                movimientos: movimientosPeriodo,
                hayFiltroFecha,
                // Totales absolutos (para cuando no hay filtro)
                entregadasTotal: entregadasPeriodo + (saldoAnterior > 0 ? saldoAnterior : 0),
                devueltasTotal: devueltasPeriodo + (saldoAnterior < 0 ? -saldoAnterior : 0),
            };
        }).filter(c => {
            if (filtroClienteId && filtroClienteId !== 'TODOS') return c.id === filtroClienteId;
            // Solo mostrar clientes con algún movimiento
            return c.entregadasPeriodo > 0 || c.devueltasPeriodo > 0 || c.saldoAnterior !== 0;
        });

        resultado.sort((a, b) => {
            if (b.pendiente !== a.pendiente) return b.pendiente - a.pendiente;
            return a.nombre.localeCompare(b.nombre);
        });

        return resultado;
    },

    renderTabla(filtroClienteId, desde, hasta) {
        const data = this.buildResumen(filtroClienteId, desde, hasta);
        const container = document.getElementById('canastas-tabla-container');
        if (!container) return;

        const hayFiltroFecha = !!(desde || hasta);
        let sumaSaldoAnterior = 0, sumaEntregadas = 0, sumaDevueltas = 0, sumaPendiente = 0;

        const filas = data.map(c => {
            sumaSaldoAnterior += c.saldoAnterior;
            sumaEntregadas += c.entregadasPeriodo;
            sumaDevueltas += c.devueltasPeriodo;
            sumaPendiente += c.pendiente;

            const pctDevuelto = (c.saldoAnterior + c.entregadasPeriodo) > 0
                ? Math.round((c.devueltasPeriodo / (c.saldoAnterior + c.entregadasPeriodo)) * 100)
                : 0;
            const barWidth = Math.min(Math.max(pctDevuelto, 0), 100);
            const pendColor = c.pendiente <= 0 ? '#10b981' : c.pendiente > 200 ? '#ef4444' : '#f59e0b';

            // Ordenar movimientos del período de más nuevo a más viejo para el detalle
            const movsAsc = c.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));

            // Calcular saldo corrido partiendo del saldo anterior
            let saldoCorrido = c.saldoAnterior;
            const filasMovimiento = movsAsc.map(m => {
                saldoCorrido += m.sign * m.cantidad;
                const saldoColor = saldoCorrido > 0 ? '#f59e0b' : '#10b981';
                const tipoStyle = m.sign > 0
                    ? 'background:rgba(239,68,68,0.15);color:#f87171;'
                    : 'background:rgba(16,185,129,0.15);color:#34d399;';
                return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px;">
                        <td style="padding:8px 16px; color:#9ca3af;">${m.fecha}</td>
                        <td style="padding:8px 16px;">
                            <span style="padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; ${tipoStyle}">${m.tipo}</span>
                        </td>
                        <td style="padding:8px 16px; text-align:right; font-weight:bold; color:${m.sign > 0 ? '#f87171' : '#34d399'}">
                            ${m.sign > 0 ? '+' : '-'}${m.cantidad.toLocaleString()}
                        </td>
                        <td style="padding:8px 16px; text-align:right; font-weight:bold; color:${saldoColor}">
                            ${saldoCorrido.toLocaleString()}
                        </td>
                    </tr>`;
            }).reverse().join(''); // mostrar de más reciente a más antiguo

            const idSafe = c.id.replace(/[^a-zA-Z0-9]/g, '_');

            // Fila de saldo anterior (solo cuando hay filtro de fecha)
            const filaSaldoAnterior = (hayFiltroFecha && c.saldoAnterior !== 0) ? `
                <tr style="background:rgba(99,102,241,0.08); border-bottom:2px solid rgba(99,102,241,0.3); font-size:13px;">
                    <td style="padding:8px 16px; color:#818cf8; font-weight:600;">Antes de ${desde}</td>
                    <td style="padding:8px 16px;">
                        <span style="padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; background:rgba(99,102,241,0.2);color:#818cf8;">Saldo Anterior</span>
                    </td>
                    <td style="padding:8px 16px; text-align:right; font-weight:bold; color:#818cf8;">—</td>
                    <td style="padding:8px 16px; text-align:right; font-weight:bold; color:${c.saldoAnterior > 0 ? '#f59e0b' : '#10b981'}">
                        ${c.saldoAnterior.toLocaleString()}
                    </td>
                </tr>` : '';

            return `
                <!-- FILA PRINCIPAL -->
                <tr class="canasta-row-main" data-target="detalle-${idSafe}"
                    style="border-bottom:1px solid rgba(255,255,255,0.08); cursor:pointer; transition:background 0.15s;">
                    <td style="padding:12px 16px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="expand-icon-${idSafe}" style="display:inline-flex; transition:transform 0.2s; color:#6b7280;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </span>
                            <span style="font-weight:600; color:white;">${c.nombre}</span>
                        </div>
                    </td>
                    ${hayFiltroFecha ? `<td style="padding:12px 16px; text-align:right; color:${c.saldoAnterior > 0 ? '#f59e0b' : '#10b981'}; font-weight:bold;">${c.saldoAnterior.toLocaleString()}</td>` : ''}
                    <td style="padding:12px 16px; text-align:right; color:#f87171; font-weight:bold;">${c.entregadasPeriodo.toLocaleString()}</td>
                    <td style="padding:12px 16px; text-align:right; color:#34d399; font-weight:bold;">${c.devueltasPeriodo.toLocaleString()}</td>
                    <td style="padding:12px 16px; text-align:right; font-weight:bold; font-size:18px; color:${pendColor}">${c.pendiente.toLocaleString()}</td>
                    <td style="padding:12px 16px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:9999px; height:6px; overflow:hidden;">
                                <div style="width:${barWidth}%; height:6px; border-radius:9999px; background:${pendColor};"></div>
                            </div>
                            <span style="font-size:12px; color:#9ca3af; min-width:36px; text-align:right;">${pctDevuelto}%</span>
                        </div>
                    </td>
                </tr>
                <!-- FILA DETALLE EXPANDIBLE -->
                <tr id="detalle-${idSafe}" style="display:none;">
                    <td colspan="${hayFiltroFecha ? 6 : 5}" style="padding:0; background:rgba(255,255,255,0.015);">
                        <div style="border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06);">
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:rgba(255,255,255,0.04); font-size:11px; text-transform:uppercase; color:#6b7280;">
                                        <th style="padding:8px 16px; text-align:left; font-weight:600;">Fecha</th>
                                        <th style="padding:8px 16px; text-align:left; font-weight:600;">Tipo</th>
                                        <th style="padding:8px 16px; text-align:right; font-weight:600;">Cantidad</th>
                                        <th style="padding:8px 16px; text-align:right; font-weight:600;">Saldo Acumulado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filaSaldoAnterior}
                                    ${c.movimientos.length === 0
                    ? `<tr><td colspan="4" style="padding:16px; text-align:center; color:#6b7280;">Sin movimientos en este período.</td></tr>`
                    : filasMovimiento}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        const headerSaldoAnterior = hayFiltroFecha
            ? `<th style="padding:12px 16px; text-align:right; font-weight:600; color:#818cf8;">Saldo Anterior</th>`
            : '';
        const footerSaldoAnterior = hayFiltroFecha
            ? `<td style="padding:12px 16px; text-align:right; color:#818cf8; font-weight:bold;">${sumaSaldoAnterior.toLocaleString()}</td>`
            : '';

        container.innerHTML = `
            ${hayFiltroFecha ? `
            <div style="margin-bottom:12px; padding:10px 16px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:8px; font-size:13px; color:#818cf8; display:flex; align-items:center; gap:8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>El <strong>Saldo Anterior</strong> incluye todos los movimientos previos a la fecha de inicio del filtro. <strong>Pendiente = Saldo Anterior + Entregadas − Devueltas</strong>.</span>
            </div>` : ''}
            <div style="border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.05); font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:1px solid rgba(255,255,255,0.08);">
                            <th style="padding:12px 16px; text-align:left; font-weight:600;">Cliente</th>
                            ${headerSaldoAnterior}
                            <th style="padding:12px 16px; text-align:right; font-weight:600; color:#f87171;">Entregadas</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600; color:#34d399;">Devueltas</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600;">Pendiente</th>
                            <th style="padding:12px 16px; text-align:left; font-weight:600;">% Devuelto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || `<tr><td colspan="${hayFiltroFecha ? 6 : 5}" style="padding:40px; text-align:center; color:#6b7280; font-style:italic;">No hay movimientos con los filtros aplicados.</td></tr>`}
                    </tbody>
                    <tfoot>
                        <tr style="background:rgba(255,255,255,0.04); border-top:2px solid rgba(255,255,255,0.1); font-weight:bold; font-size:13px;">
                            <td style="padding:12px 16px; color:#9ca3af; text-transform:uppercase; font-size:11px;">TOTAL</td>
                            ${footerSaldoAnterior}
                            <td style="padding:12px 16px; text-align:right; color:#f87171;">${sumaEntregadas.toLocaleString()}</td>
                            <td style="padding:12px 16px; text-align:right; color:#34d399;">${sumaDevueltas.toLocaleString()}</td>
                            <td style="padding:12px 16px; text-align:right; font-size:18px; color:${sumaPendiente > 0 ? '#f59e0b' : '#10b981'}">${sumaPendiente.toLocaleString()}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;

        // Eventos de expansión
        container.querySelectorAll('.canasta-row-main').forEach(row => {
            row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.03)');
            row.addEventListener('mouseleave', () => row.style.background = '');
            row.addEventListener('click', () => {
                const targetId = row.getAttribute('data-target');
                const detalleRow = document.getElementById(targetId);
                if (!detalleRow) return;
                const isOpen = detalleRow.style.display !== 'none';
                detalleRow.style.display = isOpen ? 'none' : 'table-row';
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
                    <p class="text-text-secondary text-sm">Haz clic en un cliente para ver el detalle con fechas. El balance incluye el saldo arrastrado anterior al período.</p>
                </div>
            </div>
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
            <div id="canastas-tabla-container">
                <div class="surface-card p-12 text-center text-text-secondary">Cargando...</div>
            </div>
        </div>
    `;
};

// ===== EVENTOS DEL MÓDULO =====
window.appModuleEvents['canastas-cliente'] = () => {
    window.CanastasClienteController.renderTabla(null, null, null);

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

    document.getElementById('btn-limpiar-filtro-canastas')?.addEventListener('click', () => {
        document.getElementById('canastas-filtro-cliente').value = 'TODOS';
        document.getElementById('canastas-filtro-desde').value = '';
        document.getElementById('canastas-filtro-hasta').value = '';
        window.CanastasClienteController.renderTabla(null, null, null);
    });
};
