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
                Movimientos por Fruta (v25)
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
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="surface-card p-4 border-t-4 border-t-primary flex flex-col justify-center bg-primary/5">
                        <span class="text-text-secondary text-xs uppercase tracking-wider mb-1" title="Suma total de esta fruta que existe físicamente en el sistema AHORA MISMO.">Inventario Actual Real</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="package" class="w-6 h-6 text-primary/70"></i>
                            <span class="text-2xl font-black text-white" id="rf-actual-inv">0</span>
                        </div>
                    </div>
                    
                    <div class="surface-card p-4 border-l-4 border-success flex flex-col justify-center">
                        <span class="text-text-secondary text-xs uppercase tracking-wider mb-1" title="Entradas de fruta en el rango de fechas consultado">Entradas del Rango (+)</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="trending-up" class="w-6 h-6 text-success/50"></i>
                            <span class="text-2xl font-black text-white" id="rf-total-in">0</span>
                        </div>
                    </div>
                    
                    <div class="surface-card p-4 border-l-4 border-danger flex flex-col justify-center">
                        <span class="text-text-secondary text-xs uppercase tracking-wider mb-1" title="Salidas de fruta en el rango de fechas consultado">Salidas del Rango (-)</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="trending-down" class="w-6 h-6 text-danger/50"></i>
                            <span class="text-2xl font-black text-white" id="rf-total-out">0</span>
                        </div>
                    </div>

                    <div class="surface-card p-4 border-l-4 border-info flex flex-col justify-center">
                        <span class="text-text-secondary text-xs uppercase tracking-wider mb-1" title="Diferencia entre Entradas y Salidas durante el rango de fechas">Flujo Neto del Rango</span>
                        <div class="flex items-end gap-3">
                            <i data-lucide="scale" class="w-6 h-6 text-info/50"></i>
                            <span class="text-2xl font-black text-info" id="rf-balance">0</span>
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selProductoId = document.getElementById('rf-producto').value;
        const dDesde = document.getElementById('rf-desde').value;
        const dHasta = document.getElementById('rf-hasta').value;

        if (!selProductoId) {
            window.UI.showToast('Debe seleccionar una fruta.', 'warning');
            return;
        }

        // Indicador de carga
        const btnSearch = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btnSearch.innerHTML;
        btnSearch.disabled = true;
        btnSearch.innerHTML = `<i class="animate-spin" data-lucide="loader-2"></i> Cargando...`;
        if (window.lucide) window.lucide.createIcons({ root: btnSearch });

        const productoObj = window.appStore.getProductos().find(p => p.id === selProductoId);
        currentProductName = productoObj ? productoObj.nombre : 'Fruta Desconocida';

        // 1. Obtener toda la actividad (Deep Load)
        const allFullHistory = await window.appStore.loadFullActivity();
        const activityFromState = (window.appStore.data && window.appStore.data.actividad) ? window.appStore.data.actividad : [];
        
        const allMap = new Map();
        [...allFullHistory, ...activityFromState].forEach(a => { if (a.id) allMap.set(a.id, a); });
        
        const allActivity = Array.from(allMap.values());
        allActivity.sort((a, b) => new Date(a.date || a.fecha) - new Date(b.date || b.fecha));

        // Rango de fechas
        let dateStart = dDesde ? new Date(dDesde + 'T00:00:00') : null;
        let dateEnd = dHasta ? new Date(dHasta + 'T23:59:59') : null;

        const reportRows = [];
        let tIn = 0;
        let tOut = 0;
        let runningInventory = 0;

        // 2. Loop Forward para reconstruir inventario real y flujo neto
        allActivity.forEach(a => {
            if (a.anulado || a.eliminado) return;

            const logDate = new Date(a.date || a.fecha);
            const raw = a.rawPayload || {};
            const qtyStr = (a.cantidad || '0').toString();
            const match = qtyStr.match(/-?\d+/);
            const a_cantidad = match ? Math.abs(parseInt(match[0], 10)) : 0;
            const op = a.operacion;

            let qtyChange = 0;

            const checkMatch = (pId) => {
                if (pId === selProductoId) return true;
                if (!pId && a.detalle && a.detalle.toLowerCase().includes(currentProductName.toLowerCase())) return true;
                return false;
            };

            // Reglas de negocio (iguales a charts.js)
            if (op === 'Recepción' || op === 'Recepción de Fruta' || op === 'Devolución' || op === 'Devolución de Canastas' || op === 'Fruta Demás' || op === 'Ingreso Fruta Demás') {
                const isLlena = (op !== 'Devolución' && op !== 'Devolución de Canastas') || (a.detalle && a.detalle.toLowerCase().includes('llena'));
                if (isLlena) {
                    if (raw.lotes) raw.lotes.forEach(l => { if (checkMatch(l.productoId)) qtyChange += (parseInt(l.cantidad) || 0); });
                    else if (raw.detalles) raw.detalles.forEach(d => { if (checkMatch(d.productoId)) qtyChange += (parseInt(d.cantidad) || 0); });
                    else if (checkMatch(raw.productoId || raw.productoIdActual || raw.productoIdNuevo)) qtyChange += a_cantidad;
                }
            } else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente' || op === 'Decomiso' || op === 'Decomiso de Fruta') {
                if (raw.lotes) raw.lotes.forEach(l => { if (checkMatch(l.productoId)) qtyChange -= (parseInt(l.cantidad) || 0); });
                else if (raw.detalles) raw.detalles.forEach(d => { if (checkMatch(d.productoId)) qtyChange -= (parseInt(d.cantidad) || 0); });
                else if (checkMatch(raw.productoId || raw.productoIdActual || raw.productoIdNuevo)) qtyChange -= a_cantidad;
            } else if (op === 'Reparación Sistema') {
                if (checkMatch(raw.productoId)) {
                    const diff = qtyStr.includes('-') ? -Math.abs(a_cantidad) : Math.abs(a_cantidad);
                    qtyChange += diff;
                }
            } else if (op === 'Transf. Interna' || op === 'Transferencia entre Almacenes') {
                const pOrig = raw.productoIdActual;
                const pDest = raw.productoIdNuevo || raw.productoIdActual;
                const cantL = raw ? (parseInt(raw.cantidad) || 0) : 0;
                if (pOrig === selProductoId && pDest !== selProductoId) qtyChange -= cantL;
                else if (pOrig !== selProductoId && pDest === selProductoId) qtyChange += cantL;
            }

            // Actualizar inventario acumulado (Running Balance)
            runningInventory += qtyChange;

            // Si está en el rango de fechas, guardar fila
            const isInRange = (!dateStart || logDate >= dateStart) && (!dateEnd || logDate <= dateEnd);
            if (isInRange && qtyChange !== 0) {
                if (qtyChange > 0) tIn += qtyChange;
                else tOut += Math.abs(qtyChange);

                reportRows.push({
                    doc: a.numeroDocumento || 'S/N',
                    fecha: logDate.toLocaleDateString(),
                    fechaCompleta: logDate.toLocaleString(),
                    operacion: op,
                    detalle: a.detalle || '',
                    qtyIn: qtyChange > 0 ? qtyChange : 0,
                    qtyOut: qtyChange < 0 ? Math.abs(qtyChange) : 0,
                    usuario: a.usuario || 'Sistema',
                    origId: a.id
                });
            }
        });

        // Ordenamos más recientes primero
        reportRows.sort((a, b) => new Date(b.fechaCompleta) - new Date(a.fechaCompleta));
        currentData = reportRows;

        // Mostrar Resultados
        document.getElementById('rf-actual-inv').textContent = runningInventory.toLocaleString();

        // --- Render results ---
        document.getElementById('rf-total-in').textContent = tIn.toLocaleString();
        document.getElementById('rf-total-out').textContent = tOut.toLocaleString();

        const balance = tIn - tOut;
        const balEl = document.getElementById('rf-balance');
        balEl.textContent = (balance > 0 ? '+' : '') + balance.toLocaleString();
        balEl.className = `text-2xl font-black ${balance >= 0 ? 'text-info' : 'text-danger'}`;

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

        // Restaurar botón
        btnSearch.disabled = false;
        btnSearch.innerHTML = originalBtnHTML;
        if (window.lucide) window.lucide.createIcons({ root: btnSearch });

        window.UI.showToast("Reporte generado correctamente.", "success");
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
