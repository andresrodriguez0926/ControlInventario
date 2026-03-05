/**
 * Módulo: Movimientos por Fruta
 * Permite seleccionar una fruta y un rango de fechas para ver su historial completo de (+ y -) 
 * y obtener su balance o flujo.
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['reporte-fruta'] = () => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    // Default "Desde" a 30 días atrás
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoISO = monthAgo.toISOString().slice(0, 10);

    const productos = window.appStore.getProductos();
    const optsProductos = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

    return `
        <div class="animate-fade-in max-w-6xl mx-auto pb-12">
            <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <i data-lucide="bar-chart-2" class="w-6 h-6 text-primary"></i> 
                Movimientos por Fruta
            </h2>
            <p class="text-text-secondary mb-8">Consulta el flujo completo de entradas y salidas de una fruta específica.</p>
            
            <!-- Panel de Filtros -->
            <div class="surface-card p-4 md:p-6 mb-6">
                <form id="form-filtro-fruta" class="flex flex-col md:flex-row gap-4 items-end">
                    <div class="form-group flex-1">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Fruta a Consultar <span class="text-danger">*</span></label>
                        <select id="rf-producto" class="form-select border-primary/50 text-white" required>
                            <option value="">Seleccione una fruta...</option>
                            ${optsProductos}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Desde</label>
                        <input type="date" id="rf-desde" class="form-input text-sm" value="${monthAgoISO}">
                    </div>

                    <div class="form-group">
                        <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Hasta</label>
                        <input type="date" id="rf-hasta" class="form-input text-sm" value="${todayISO}">
                    </div>

                    <div class="form-group flex gap-2">
                        <button type="submit" class="btn btn-primary text-sm px-6 h-[42px] flex items-center gap-2">
                            <i data-lucide="search" class="w-4 h-4"></i> Buscar
                        </button>
                    </div>
                </form>
            </div>

            <div id="rf-resultados-container" class="hidden animate-fade-in space-y-6">
                <!-- Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="surface-card p-5 border-l-4 border-success flex flex-col justify-center">
                        <span class="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1">Total Entradas (+)</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="trending-up" class="w-8 h-8 text-success/50"></i>
                            <span class="text-3xl font-black text-white" id="rf-total-in">0</span>
                        </div>
                    </div>
                    
                    <div class="surface-card p-5 border-l-4 border-danger flex flex-col justify-center">
                        <span class="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1">Total Salidas (-)</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="trending-down" class="w-8 h-8 text-danger/50"></i>
                            <span class="text-3xl font-black text-white" id="rf-total-out">0</span>
                        </div>
                    </div>

                    <div class="surface-card p-5 border-l-4 border-info flex flex-col justify-center bg-info/5">
                        <span class="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1">Balance Neto del Periodo</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="scale" class="w-8 h-8 text-info/50"></i>
                            <span class="text-3xl font-black text-info" id="rf-balance">0</span>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Resultados -->
                <div class="w-full">
                    <div class="surface-card overflow-hidden h-full flex flex-col">
                        <div class="p-4 border-b border-border bg-surface-light flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h3 class="font-semibold text-white flex items-center gap-2">
                                <i data-lucide="list" class="w-4 h-4 text-text-muted"></i>
                                Detalle de Movimientos
                            </h3>
                            <button type="button" id="rf-btn-export-csv" class="btn btn-secondary text-sm py-1.5 px-4 flex items-center gap-2">
                                <i data-lucide="file-spreadsheet" class="w-4 h-4 text-[#10b981]"></i> 
                                Descargar Excel (CSV)
                            </button>
                        </div>
                        
                        <div class="overflow-x-auto p-0 custom-scrollbar" style="max-height: 60vh;">
                            <table class="w-full text-left border-collapse" id="tabla-rf">
                                <thead>
                                    <tr class="bg-surface sticky top-0 z-10 text-text-secondary text-xs uppercase tracking-wider border-b border-border shadow-sm">
                                        <th class="py-3 px-4 font-semibold w-24">Doc #</th>
                                        <th class="py-3 px-4 font-semibold">Fecha Op.</th>
                                        <th class="py-3 px-4 font-semibold">Operación</th>
                                        <th class="py-3 px-4 font-semibold">Detalle / Destino / Origen</th>
                                        <th class="py-3 px-4 font-semibold text-center text-success bg-success/5">Entrada (+)</th>
                                        <th class="py-3 px-4 font-semibold text-center text-danger bg-danger/5">Salida (-)</th>
                                        <th class="py-3 px-4 font-semibold">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody id="rf-tbody">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.appModuleEvents['reporte-fruta'] = () => {
    const form = document.getElementById('form-filtro-fruta');
    if (!form) return;

    const btnExport = document.getElementById('rf-btn-export-csv');
    const container = document.getElementById('rf-resultados-container');
    const tbody = document.getElementById('rf-tbody');
    let currentData = [];
    let currentProductName = '';

    const dateToYMD = (dateString) => {
        try {
            return new Date(dateString).toISOString().slice(0, 10);
        } catch (e) {
            return "";
        }
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const selProductoId = document.getElementById('rf-producto').value;
        const dDesde = document.getElementById('rf-desde').value;
        const dHasta = document.getElementById('rf-hasta').value;

        if (!selProductoId) {
            window.UI.showToast('Debe seleccionar una fruta.', 'warning');
            return;
        }

        const productoObj = window.appStore.getProductos().find(p => p.id === selProductoId);
        currentProductName = productoObj ? productoObj.nombre : 'Fruta Desconocida';

        // 1. Obtener toda la actividad (amplio espectro)
        const act = window.appStore.getActividad(20000);

        // Rango de fechas
        let dateStart = null;
        let dateEnd = null;
        if (dDesde) {
            dateStart = new Date(dDesde);
            dateStart.setHours(0, 0, 0, 0);
        }
        if (dHasta) {
            dateEnd = new Date(dHasta);
            dateEnd.setHours(23, 59, 59, 999);
        }

        const reportRows = [];
        let tIn = 0;
        let tOut = 0;

        act.forEach(a => {
            if (a.anulado || a.eliminado) return;

            const raw = a.rawPayload || {};
            const qtyStr = a.cantidad ? a.cantidad.toString() : '0';
            const match = qtyStr.match(/\d+/);
            const a_cantidad = match ? parseInt(match[0], 10) : 0;

            // Filtro por fecha
            const logDate = new Date(a.date);
            if (dateStart && logDate < dateStart) return;
            if (dateEnd && logDate > dateEnd) return;

            let qtyIn = 0;
            let qtyOut = 0;
            let isRelated = false;

            // Helper para sumar entradas/salidas si el producto coincide
            const incrementIfMatch = (pId, amount, isIn) => {
                let matches = false;
                if (pId === selProductoId) {
                    matches = true;
                } else if (!pId && a.detalle && a.detalle.toLowerCase().includes(currentProductName.toLowerCase())) {
                    // Fallback para registros muy antiguos ("legacy") sin productoId
                    matches = true;
                }

                if (matches) {
                    if (isIn) qtyIn += amount;
                    else qtyOut += amount;
                    isRelated = true;
                }
            };

            // Helper general para recorrer lotes/detalles
            const processLlenasForward = (isIn) => {
                if (raw.lotes) {
                    raw.lotes.forEach(l => {
                        incrementIfMatch(l.productoId, parseInt(l.cantidad) || 0, isIn);
                    });
                } else if (raw.detalles) {
                    raw.detalles.forEach(d => {
                        let pId = d.productoId;
                        if (!pId && raw.detalles.length === 1) pId = selProductoId; // Fallback optimista
                        incrementIfMatch(pId, parseInt(d.cantidad) || 0, isIn);
                    });
                } else {
                    const pId = raw.productoId || raw.productoIdActual || raw.productoIdNuevo;
                    incrementIfMatch(pId, a_cantidad, isIn);
                }
            };

            // Reglas de negocio (iguales a inventario-fecha.js pero hacia adelante)
            // A) Recepciones (Entrada)
            if (a.operacion.includes('Recepción')) {
                processLlenasForward(true);
            }
            // B) Devoluciones Llenas (Entrada)
            else if (a.operacion.includes('Devolución') && a.detalle && a.detalle.includes('Llenas')) {
                processLlenasForward(true);
            }
            // C) Despachos (Salida)
            else if (a.operacion.includes('Desp. Cliente') || a.operacion.includes('Despacho a Cliente')) {
                processLlenasForward(false);
            }
            // D) Decomisos (Salida)
            else if (a.operacion.includes('Decomiso')) {
                processLlenasForward(false);
            }
            // E) Fruta Demás / Ajustes (Entrada)
            else if (a.operacion.includes('Fruta Demás') || a.operacion.includes('Ingreso Fruta Demás')) {
                processLlenasForward(true);
            }
            // F) Transferencia Interna (Reclasificación o movimiento)
            else if (a.operacion.includes('Transf. Interna') || a.operacion.includes('Transferencia entre Almacenes')) {
                const pOrig = raw.productoIdActual;
                const pDest = raw.productoIdNuevo || raw.productoIdActual;

                if (pOrig === selProductoId && pDest !== selProductoId) {
                    // Sale de la fruta actual
                    qtyOut += a_cantidad;
                    isRelated = true;
                } else if (pOrig !== selProductoId && pDest === selProductoId) {
                    // Entra como fruta nueva
                    qtyIn += a_cantidad;
                    isRelated = true;
                } else if (pOrig === selProductoId && pDest === selProductoId) {
                    // Movimiento interno. Mostramos neutral para trazabilidad.
                    isRelated = true;
                }
            }

            if (isRelated) {
                tIn += qtyIn;
                tOut += qtyOut;

                reportRows.push({
                    doc: a.numeroDocumento || 'S/N',
                    fecha: dateToYMD(a.date),
                    fechaCompleta: new Date(a.date).toLocaleString(),
                    operacion: a.operacion,
                    detalle: a.detalle,
                    qtyIn,
                    qtyOut,
                    usuario: a.usuario || 'Sistema',
                    origId: a.id
                });
            }
        });

        // Ordenamos más recientes primero
        reportRows.sort((a, b) => new Date(b.fechaCompleta) - new Date(a.fechaCompleta));

        currentData = reportRows;

        // --- Render results ---
        document.getElementById('rf-total-in').textContent = tIn.toLocaleString();
        document.getElementById('rf-total-out').textContent = tOut.toLocaleString();

        const balance = tIn - tOut;
        const balEl = document.getElementById('rf-balance');
        balEl.textContent = (balance > 0 ? '+' : '') + balance.toLocaleString();
        balEl.className = `text-3xl font-black ${balance >= 0 ? 'text-info' : 'text-danger'}`;

        if (reportRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos para esta fruta en el rango seleccionado.</td></tr>`;
        } else {
            tbody.innerHTML = reportRows.map(r => `
                <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                    <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${r.doc}</td>
                    <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${r.fechaCompleta.split(',')[0]}</td>
                    <td class="py-2.5 px-4 text-white font-medium">${r.operacion}</td>
                    <td class="py-2.5 px-4 text-text-secondary italic text-xs max-w-sm" title="${r.detalle}">${r.detalle}</td>
                    
                    <td class="py-2.5 px-4 text-center font-bold ${r.qtyIn > 0 ? 'text-success bg-success/10' : 'text-text-muted'} border-l border-border/50">
                        ${r.qtyIn > 0 ? '+' + r.qtyIn : '-'}
                    </td>
                    
                    <td class="py-2.5 px-4 text-center font-bold ${r.qtyOut > 0 ? 'text-danger bg-danger/10' : 'text-text-muted'} border-r border-border/50">
                        ${r.qtyOut > 0 ? '-' + r.qtyOut : '-'}
                    </td>
                    
                    <td class="py-2.5 px-4 text-text-secondary w-32 truncate" title="${r.usuario}">${r.usuario}</td>
                </tr>
            `).join('');
        }

        container.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    });

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (currentData.length === 0) {
                window.UI.showToast("No hay datos para exportar.", "warning");
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF8 BOM
            csvContent += `Reporte de Movimientos - Fruta: ${currentProductName}\n`;
            csvContent += "ID Documento,Fecha,Operacion,Detalle,Entradas (+),Salidas (-),Usuario\n";

            currentData.forEach(r => {
                const row = [
                    r.doc,
                    r.fechaCompleta.replace(/,/g, ''),
                    `"${r.operacion}"`,
                    `"${r.detalle.replace(/"/g, '""')}"`,
                    r.qtyIn,
                    r.qtyOut,
                    `"${r.usuario}"`
                ].join(",");
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Reporte_Fruta_${currentProductName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

};
