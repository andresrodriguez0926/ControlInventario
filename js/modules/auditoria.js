/**
 * Módulo de Auditoría y Reparación de Inventario
 * Permite recalcular el inventario teórico basado en el historial completo de transacciones.
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['auditoria'] = () => {
    const productos = window.appStore.getProductos();
    const optsProductos = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

    return `
        <div class="animate-fade-in max-w-6xl mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-white">Auditoría de Inventario</h2>
                    <p class="text-text-secondary text-sm">Recalcula el balance real sumando todas las transacciones históricas.</p>
                </div>
            </div>
            
            <!-- Selector de Producto -->
            <div class="surface-card p-6 mb-8">
                <div class="flex flex-col md:flex-row gap-6 items-end">
                    <div class="form-group flex-1">
                        <label class="form-label mb-2 block">Seleccionar Producto para Auditar</label>
                        <select id="aud-producto-id" class="form-select border-primary/50 text-white bg-surface">
                            <option value="">-- Seleccione un producto --</option>
                            ${optsProductos}
                        </select>
                    </div>
                    <button type="button" id="btn-ejecutar-auditoria" class="btn btn-primary px-8 h-12 flex items-center gap-2">
                        <i data-lucide="search" class="w-5 h-5"></i> Ejecutar Auditoría
                    </button>
                </div>
            </div>

            <div id="aud-results-container" class="hidden space-y-8 pb-12">
                <!-- Resumen de Auditoría -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="surface-card p-5 border-l-4 border-success">
                        <div class="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Entradas Totales</div>
                        <div id="aud-total-entradas" class="text-3xl font-bold text-success">0</div>
                        <div class="text-xs text-text-secondary mt-1">Suma de recepciones y ajustes</div>
                    </div>
                    <div class="surface-card p-5 border-l-4 border-danger">
                        <div class="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Salidas Totales</div>
                        <div id="aud-total-salidas" class="text-3xl font-bold text-danger">0</div>
                        <div class="text-xs text-text-secondary mt-1">Suma de despachos y decomisos</div>
                    </div>
                    <div class="surface-card p-5 border-l-4 border-primary">
                        <div class="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Balance Teórico</div>
                        <div id="aud-total-teorico" class="text-3xl font-bold text-primary">0</div>
                        <div class="text-xs text-text-secondary mt-1">Resultado del historial (E - S)</div>
                    </div>
                    <div class="surface-card p-5 border-l-4 border-warning" id="aud-card-actual">
                        <div class="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Balance en Sistema</div>
                        <div id="aud-total-actual" class="text-3xl font-bold text-warning">0</div>
                        <div id="aud-diferencia-msg" class="text-xs font-medium mt-1">--</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Desglose por Almacén -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="surface-card">
                            <div class="p-4 border-b border-border bg-surface-light">
                                <h3 class="font-bold text-white flex items-center gap-2">
                                    <i data-lucide="warehouse" class="w-4 h-4 text-primary"></i>
                                    Distribución Teórica
                                </h3>
                            </div>
                            <div class="p-4">
                                <div id="aud-almacenes-list" class="space-y-3">
                                    <!-- Dinámico -->
                                </div>
                            </div>
                        </div>

                        <!-- Panel de Reparación -->
                        <div id="aud-repair-panel" class="surface-card border border-danger/30 bg-danger/5 hidden">
                            <div class="p-4 border-b border-danger/20 bg-danger/10">
                                <h3 class="font-bold text-danger flex items-center gap-2">
                                    <i data-lucide="shield-alert" class="w-4 h-4"></i>
                                    Zona de Reparación
                                </h3>
                            </div>
                            <div class="p-4">
                                <p class="text-xs text-text-secondary mb-4 italic">
                                    Si el balance teórico es diferente al actual, puedes forzar al sistema a sincronizarse con el historial de transacciones. Esta acción es irreversible.
                                </p>
                                <button id="btn-reparar-sistema" class="btn btn-danger w-full py-3 flex items-center justify-center gap-2 font-bold">
                                    <i data-lucide="wrench" class="w-4 h-4"></i> Sincronizar Sistema
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Detalle de Transacciones Auditadas -->
                    <div class="lg:col-span-2">
                        <div class="surface-card">
                            <div class="p-4 border-b border-border bg-surface-light flex justify-between items-center">
                                <h3 class="font-bold text-white flex items-center gap-2">
                                    <i data-lucide="list-checks" class="w-4 h-4 text-primary"></i>
                                    Transacciones Auditadas
                                </h3>
                                <span id="aud-count-trans" class="text-xs bg-primary/20 text-primary px-2 py-1 rounded">0 registros</span>
                            </div>
                            <div class="overflow-x-auto custom-scrollbar" style="max-height: 500px;">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-surface sticky top-0 z-10 text-text-secondary text-[10px] uppercase tracking-wider border-b border-border">
                                            <th class="py-2 px-4">Fecha</th>
                                            <th class="py-2 px-4">Documento</th>
                                            <th class="py-2 px-4">Operación</th>
                                            <th class="py-2 px-4 text-right">Impacto</th>
                                        </tr>
                                    </thead>
                                    <tbody id="aud-transactions-body" class="text-xs">
                                        <!-- Dinámico -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty state -->
            <div id="aud-empty-state" class="surface-card p-20 text-center">
                <div class="w-20 h-20 bg-surface-light rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="clipboard-check" class="w-10 h-10 text-text-muted"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">Seleccione un producto para iniciar</h3>
                <p class="text-text-secondary max-w-md mx-auto">
                    La auditoría procesará el historial de actividad para reconstruir el estado de inventario paso a paso.
                </p>
            </div>
        </div>
    `;
};

window.appModuleEvents['auditoria'] = () => {
    const btnAuditar = document.getElementById('btn-ejecutar-auditoria');
    const selectProducto = document.getElementById('aud-producto-id');
    const resultsContainer = document.getElementById('aud-results-container');
    const emptyState = document.getElementById('aud-empty-state');

    // UI targets
    const txtEntradas = document.getElementById('aud-total-entradas');
    const txtSalidas = document.getElementById('aud-total-salidas');
    const txtTeorico = document.getElementById('aud-total-teorico');
    const txtActual = document.getElementById('aud-total-actual');
    const txtDiff = document.getElementById('aud-diferencia-msg');
    const cardActual = document.getElementById('aud-card-actual');
    const listAlmacenes = document.getElementById('aud-almacenes-list');
    const bodyTrans = document.getElementById('aud-transactions-body');
    const countTrans = document.getElementById('aud-count-trans');
    const repairPanel = document.getElementById('aud-repair-panel');
    const btnReparar = document.getElementById('btn-reparar-sistema');

    let lastAuditResult = null;

    if (!btnAuditar) return;

    btnAuditar.addEventListener('click', () => {
        const productoId = selectProducto.value;
        if (!productoId) {
            window.UI.showToast("Debe seleccionar un producto", "warning");
            return;
        }

        const icon = btnAuditar.innerHTML;
        btnAuditar.innerHTML = '<i class="lucide-loader animate-spin w-5 h-5"></i> Procesando...';
        btnAuditar.disabled = true;

        // Simulamos un micro-delay para feedback visual de que está "calculando"
        setTimeout(() => {
            try {
                const summary = window.appStore.auditProductInventory(productoId);
                lastAuditResult = summary;
                renderAudit(summary);

                emptyState.classList.add('hidden');
                resultsContainer.classList.remove('hidden');
                window.UI.showToast("Auditoría completada", "success");
            } catch (err) {
                console.error(err);
                window.UI.showToast("Error en auditoría: " + err.message, "error");
            } finally {
                btnAuditar.innerHTML = icon;
                btnAuditar.disabled = false;
                if (window.lucide) window.lucide.createIcons();
            }
        }, 600);
    });

    const renderAudit = (summary) => {
        txtEntradas.textContent = summary.totalEntradas;
        txtSalidas.textContent = summary.totalSalidas;
        txtTeorico.textContent = summary.teoricoTotal;
        txtActual.textContent = summary.actualTotal;

        // Diferencia styling
        if (summary.diferencia === 0) {
            txtDiff.textContent = "Balance correcto ✓";
            txtDiff.className = "text-xs font-medium mt-1 text-success";
            cardActual.className = "surface-card p-5 border-l-4 border-success";
            repairPanel.classList.add('hidden');
        } else {
            txtDiff.textContent = `Discrepancia detectada: ${summary.diferencia > 0 ? '+' : ''}${summary.diferencia}`;
            txtDiff.className = "text-xs font-medium mt-1 text-danger";
            cardActual.className = "surface-card p-5 border-l-4 border-danger animate-pulse";
            repairPanel.classList.remove('hidden');
        }

        // Almacenes
        const almacenes = window.appStore.getAlmacenes();
        listAlmacenes.innerHTML = Object.entries(summary.porAlmacen).map(([almId, cantTeorica]) => {
            const alm = almacenes.find(a => a.id === almId);
            const cantActual = summary.actualPorAlmacen[almId] || 0;
            const diff = cantTeorica - cantActual;

            return `
                <div class="flex flex-col p-3 bg-surface rounded-lg border border-border/50">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-sm font-semibold text-white truncate max-w-[150px]">${alm?.nombre || 'Almacén'}</span>
                        <span class="text-xs font-bold ${diff === 0 ? 'text-text-secondary' : 'text-danger'}">
                             ${diff !== 0 ? `(Dif: ${diff > 0 ? '+' : ''}${diff})` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between text-[11px] text-text-secondary">
                        <span>Teórico: <b>${cantTeorica}</b></span>
                        <span>Sistema: <b>${cantActual}</b></span>
                    </div>
                </div>
            `;
        }).join('');

        // Transacciones
        countTrans.textContent = `${summary.transacciones.length} registros`;
        bodyTrans.innerHTML = summary.transacciones.map(t => {
            const dateStr = new Date(t.date || t.fecha).toLocaleDateString();
            const colorClass = t.impact > 0 ? 'text-success' : 'text-danger';
            const legacyBadge = t.isLegacy ? `<span class="ml-1 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[9px] font-bold border border-warning/20 cursor-help" title="Registro antiguo sin ID de producto. Asociado automáticamente por ser el único en el despacho.">LEGACY</span>` : '';
            return `
                <tr class="border-b border-border/30 hover:bg-surface-light/20 transition-colors">
                    <td class="py-2 px-4 whitespace-nowrap text-text-muted">${dateStr}</td>
                    <td class="py-2 px-4 font-mono text-text-secondary">${t.numeroDocumento || 'S/N'}</td>
                    <td class="py-2 px-4">${t.operacion}${legacyBadge}</td>
                    <td class="py-2 px-4 text-right font-bold ${colorClass}">${t.impact > 0 ? '+' : ''}${t.impact}</td>
                </tr>
            `;
        }).join('');
    };

    btnReparar.addEventListener('click', async () => {
        if (!lastAuditResult) return;

        const confirmName = window.appStore.getProductos().find(p => p.id === lastAuditResult.productoId)?.nombre || 'este producto';

        if (!confirm(`¿REPARAR INVENTARIO?\n\nEsta acción forzará el inventario de "${confirmName}" a ${lastAuditResult.teoricoTotal} canastas.\n\nEsto sobrescribirá los valores actuales por los calculados en el historial.`)) {
            return;
        }

        const icon = btnReparar.innerHTML;
        btnReparar.innerHTML = '<i class="lucide-loader animate-spin w-4 h-4"></i> Sincronizando...';
        btnReparar.disabled = true;

        try {
            await window.appStore.repararInventarioProducto(lastAuditResult.productoId, lastAuditResult.porAlmacen);
            window.UI.showToast("Inventario sincronizado correctamente", "success");

            // Re-ejecutar auditoría para refrescar vista
            const summary = window.appStore.auditProductInventory(lastAuditResult.productoId);
            lastAuditResult = summary;
            renderAudit(summary);

            if (window.lucide) window.lucide.createIcons();
        } catch (err) {
            window.UI.showToast("Error al reparar: " + err.message, "error");
        } finally {
            btnReparar.innerHTML = icon;
            btnReparar.disabled = false;
        }
    });
};
