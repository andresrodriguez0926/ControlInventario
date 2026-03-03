/**
 * Módulo: Inventario a Fecha
 * Permite visualizar el estado del inventario para una fecha específica (incluyendo fechas futuras),
 * revirtiendo temporalmente las transacciones ocurridas después del final de ese día.
 * Detalla la fruta llena por almacén, junto con inventario de vacías y deudores.
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['inventario-fecha'] = () => {
    const todayISO = new Date().toISOString().slice(0, 10);

    return `
        <div class="animate-fade-in max-w-5xl mx-auto pb-12">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                        <i data-lucide="calendar-clock" class="w-6 h-6 text-primary"></i>
                        Inventario a la Fecha
                    </h2>
                    <p class="text-text-secondary">Consulta el estado del inventario (incluyendo registros a futuro) hasta la fecha seleccionada.</p>
                </div>
                <button type="button" id="btn-if-share-wa" class="btn bg-[#25D366] hover:bg-[#128C7E] text-white flex items-center gap-2 border-none">
                    <i data-lucide="message-circle" class="w-4 h-4"></i>
                    Compartir por WhatsApp
                </button>
            </div>

            <div class="surface-card p-4 md:p-6 mb-6">
                <div class="flex flex-col md:flex-row gap-4 items-end">
                    <div class="form-group flex-1">
                        <label class="form-label mb-1">Seleccionar Fecha de Corte</label>
                        <input type="date" id="if-fecha" class="form-input text-lg py-2" value="${todayISO}">
                        <p class="text-xs text-text-muted mt-1">Calcula los saldos usando las transacciones hasta las 23:59:59 de esta fecha.</p>
                    </div>
                    <div class="form-group pb-0.5">
                        <button type="button" id="btn-if-generar" class="btn btn-primary px-8 h-[46px] text-base group">
                            <span class="flex items-center gap-2">
                                <i data-lucide="activity" class="w-4 h-4 group-hover:animate-pulse"></i>
                                Generar Reporte
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Report Content -->
            <div id="if-resultados" class="space-y-6 hidden animate-fade-in">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <!-- Canastas Llenas -->
                    <div class="surface-card p-5 h-full flex flex-col">
                        <div class="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                            <h3 class="text-lg font-bold text-[#10b981] flex items-center gap-2">
                                <i data-lucide="package" class="w-5 h-5"></i> Canastas Llenas
                            </h3>
                            <span class="text-2xl font-black text-white" id="if-total-llenas">0</span>
                        </div>
                        <div id="if-lista-llenas" class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
                            <!-- Inyectado por JS -->
                        </div>
                    </div>

                    <!-- Canastas Vacías -->
                    <div class="surface-card p-5 h-full flex flex-col">
                        <div class="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                            <h3 class="text-lg font-bold text-[#f59e0b] flex items-center gap-2">
                                <i data-lucide="box" class="w-5 h-5"></i> Canastas Vacías
                            </h3>
                            <span class="text-2xl font-black text-white" id="if-total-vacias">0</span>
                        </div>
                        <div id="if-lista-vacias" class="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
                            <!-- Inyectado por JS -->
                        </div>
                    </div>

                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    
                    <!-- Deuda Productores -->
                    <div class="surface-card p-5">
                        <div class="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                            <h3 class="text-lg font-bold text-warning flex items-center gap-2">
                                <i data-lucide="users" class="w-5 h-5"></i> Deuda Productores
                            </h3>
                            <span class="text-2xl font-black text-white" id="if-total-dprod">0</span>
                        </div>
                        <div id="if-lista-dprod" class="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        </div>
                    </div>

                    <!-- Deuda Clientes -->
                    <div class="surface-card p-5">
                        <div class="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                            <h3 class="text-lg font-bold text-warning flex items-center gap-2">
                                <i data-lucide="users-round" class="w-5 h-5"></i> Deuda Clientes
                            </h3>
                            <span class="text-2xl font-black text-white" id="if-total-dcli">0</span>
                        </div>
                        <div id="if-lista-dcli" class="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        </div>
                    </div>

                </div>
            </div>

            <!-- Grand Total Summary (Sticky at bottom if results visible) -->
            <div id="if-resumen-final" class="mt-8 hidden animate-fade-in">
                <div class="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl border border-primary/30 p-6 shadow-lg backdrop-blur-sm">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-inner">
                                <i data-lucide="calculator" class="w-8 h-8 text-primary animate-pulse"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white">Total General de Canastas</h3>
                                <p class="text-text-secondary text-sm">Suma de llenas, vacías y deudas (prod/cli)</p>
                            </div>
                        </div>
                        <div class="text-center md:text-right">
                            <span class="text-5xl font-black text-white tracking-tighter" id="if-grand-total">0</span>
                            <div class="text-primary font-bold text-sm mt-1 uppercase tracking-widest">Canastas en Sistema</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.appModuleEvents['inventario-fecha'] = () => {
    let _lastGeneratedData = null;

    const btnGenerar = document.getElementById('btn-if-generar');
    const inputFecha = document.getElementById('if-fecha');
    const contenedorResultados = document.getElementById('if-resultados');
    const btnShare = document.getElementById('btn-if-share-wa');

    if (!btnGenerar) return;

    btnShare.addEventListener('click', () => {
        if (!_lastGeneratedData) {
            window.UI.showToast("Primero genere el reporte antes de compartir.", "warning");
            return;
        }

        const data = _lastGeneratedData;
        const fechaSelect = new Date(inputFecha.value + 'T00:00:00');
        const fechaStr = fechaSelect.toLocaleDateString();

        const productos = window.appStore.getProductos();
        const almacenes = window.appStore.getAlmacenes();
        const productores = window.appStore.getProductores();
        const clientes = window.appStore.getClientes();

        let message = `📊 *INVENTARIO AL ${fechaStr}*\n\n`;

        message += `🟢 *CANASTAS LLENAS: ${data.totalLlenas.toLocaleString()}*\n`;
        const llenasArr = Object.entries(data.llenasPorAlmacenYProducto || {})
            .filter(([_, prods]) => Object.values(prods).some(q => q > 0));

        llenasArr.forEach(([almId, prods]) => {
            const aName = almId === 'no-especificado' ? 'S/N' : (almacenes.find(a => a.id === almId)?.nombre || 'Almacén Desc.');
            message += ` _${aName}_\n`;

            const pArr = Object.entries(prods).filter(([_, q]) => q > 0).sort((a, b) => b[1] - a[1]);
            pArr.forEach(([pId, q]) => {
                const pName = productos.find(p => p.id === pId)?.nombre || 'Fruta Desc.';
                message += `  • ${pName}: ${q.toLocaleString()}\n`;
            });
        });
        message += `\n`;

        message += `🟡 *CANASTAS VACÍAS: ${data.totalVacias.toLocaleString()}*\n`;
        const vaciasArr = Object.entries(data.vaciasPorAlmacen || {})
            .filter(([_, qty]) => qty > 0)
            .sort((a, b) => b[1] - a[1]);
        vaciasArr.forEach(([almId, qty]) => {
            const aName = almId === 'no-especificado' ? 'S/N' : (almacenes.find(a => a.id === almId)?.nombre || 'Almacén Desc.');
            message += `  • ${aName}: ${qty.toLocaleString()}\n`;
        });
        message += `\n`;

        message += `⚠️ *DEUDA PRODUCTORES: ${data.totalDespProd.toLocaleString()}*\n`;
        const dProdArr = Object.entries(data.deudaProductor || {})
            .filter(([_, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        dProdArr.forEach(([uid, qty]) => {
            const uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || `Inactivo`);
            message += `  • ${uName}: ${qty.toLocaleString()}\n`;
        });
        message += `\n`;

        message += `⚠️ *DEUDA CLIENTES: ${data.totalDespCli.toLocaleString()}*\n`;
        const dCliArr = Object.entries(data.deudaCliente || {})
            .filter(([_, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        dCliArr.forEach(([uid, qty]) => {
            const uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || `Inactivo`);
            message += `  • ${uName}: ${qty.toLocaleString()}\n`;
        });
        message += `\n`;

        const grandTotal = data.totalLlenas + data.totalVacias + data.totalDespProd + data.totalDespCli;
        message += `📊 *TOTAL GENERAL: ${grandTotal.toLocaleString()}*\n`;

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    });

    btnGenerar.addEventListener('click', () => {
        const fechaStr = inputFecha.value;
        if (!fechaStr) {
            window.UI.showToast("Debe seleccionar una fecha", "warning");
            return;
        }

        const [year, month, day] = fechaStr.split('-');
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(23, 59, 59, 999);

        // Fetch current base state
        const stats = window.appStore.getStats();
        let currentLlenas = stats.canastasLlenas;
        let currentVacias = stats.canastasVacias;
        let currentDespProd = stats.despachadasProductor || 0;
        let currentDespCli = stats.despachadasCliente || 0;

        const invPorAlmacen = window.appStore.getInventarioPorAlmacen() || {};

        let llenasPorAlmacenYProducto = {};
        let vaciasPorAlmacen = {};

        Object.keys(invPorAlmacen).forEach(almId => {
            vaciasPorAlmacen[almId] = invPorAlmacen[almId]?.vacias || 0;
            llenasPorAlmacenYProducto[almId] = {};

            Object.entries(invPorAlmacen[almId]).forEach(([key, val]) => {
                if (key !== 'vacias' && val > 0) {
                    llenasPorAlmacenYProducto[almId][key] = val;
                }
            });
        });

        let deudaProductor = {};
        window.appStore.getProductores().forEach(p => {
            deudaProductor[p.id] = p.canastasPrestadas || 0;
        });

        let deudaCliente = {};
        window.appStore.getClientes().forEach(c => {
            deudaCliente[c.id] = c.canastasPrestadas || 0;
        });

        const allActivity = window.appStore.getActividad(20000); // alto límite para abarcar el histórico necesario

        // Las transacciones ocurren antes o después del targetDate
        const postActivity = allActivity.filter(a => new Date(a.date || a.fecha) > targetDate);

        const applyObjDelta = (obj, key, delta) => {
            if (!key) key = 'no-especificado';
            if (obj[key] === undefined) obj[key] = 0;
            obj[key] += delta;
        };
        const applyLlenasAlmacenDelta = (almId, prodId, delta) => {
            if (!almId) almId = 'no-especificado';
            if (!prodId) return;
            if (!llenasPorAlmacenYProducto[almId]) llenasPorAlmacenYProducto[almId] = {};
            if (llenasPorAlmacenYProducto[almId][prodId] === undefined) llenasPorAlmacenYProducto[almId][prodId] = 0;
            llenasPorAlmacenYProducto[almId][prodId] += delta;
        };

        const revertLlenasBreakdown = (payload = {}, a_cantidad, isDecrease) => {
            const factor = isDecrease ? 1 : -1;

            if (payload.lotes) {
                payload.lotes.forEach(l => applyLlenasAlmacenDelta(l.almacenId || l.almacenDestinoId, l.productoId, factor * (parseInt(l.cantidad) || 0)));
            } else if (payload.detalles) {
                payload.detalles.forEach(d => applyLlenasAlmacenDelta(d.almacenOrigenId || d.almacenId, d.productoId, factor * (parseInt(d.cantidad) || 0)));
            } else if (payload.productoId || payload.productoIdActual || payload.productoIdNuevo) {
                const pId = payload.productoId || payload.productoIdActual || payload.productoIdNuevo;
                const aId = payload.almacenId || payload.almacenDestinoId || payload.almacenOrigenId;
                applyLlenasAlmacenDelta(aId, pId, factor * a_cantidad);
            }
        };

        postActivity.forEach(a => {
            const payload = a.rawPayload || {};
            const qtyStr = a.cantidad ? a.cantidad.toString() : '0';
            const match = qtyStr.match(/\d+/);
            const a_cantidad = match ? parseInt(match[0], 10) : 0;

            if (a.operacion === 'Recepción') {
                currentLlenas -= a_cantidad;
                currentDespProd += a_cantidad;
                revertLlenasBreakdown(payload, a_cantidad, false);
                applyObjDelta(deudaProductor, payload.productorId, a_cantidad);
            } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                currentLlenas += a_cantidad;
                currentDespCli -= a_cantidad;
                revertLlenasBreakdown(payload, a_cantidad, true);
                applyObjDelta(deudaCliente, payload.clienteId, -a_cantidad);
            } else if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho de Vacías') {
                currentVacias += a_cantidad;
                currentDespProd -= a_cantidad;
                applyObjDelta(vaciasPorAlmacen, payload.almacenOrigenId, a_cantidad);
                applyObjDelta(deudaProductor, payload.productorId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Vacías')) {
                currentVacias -= a_cantidad;
                if (payload.tipoOrigen === 'productor') {
                    currentDespProd += a_cantidad;
                    applyObjDelta(deudaProductor, payload.productorId, a_cantidad);
                } else {
                    currentDespCli += a_cantidad;
                    applyObjDelta(deudaCliente, payload.clienteId, a_cantidad);
                }
                applyObjDelta(vaciasPorAlmacen, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Llenas')) {
                currentLlenas -= a_cantidad;
                revertLlenasBreakdown(payload, a_cantidad, false);
                if (payload.tipoOrigen === 'productor') {
                    currentDespProd += a_cantidad;
                    applyObjDelta(deudaProductor, payload.productorId, a_cantidad);
                } else {
                    currentDespCli += a_cantidad;
                    applyObjDelta(deudaCliente, payload.clienteId, a_cantidad);
                }
            } else if (a.operacion === 'Transf. Fincas') {
                applyObjDelta(deudaProductor, payload.productorOrigenId, a_cantidad);
                applyObjDelta(deudaProductor, payload.productorDestinoId, -a_cantidad);
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas') {
                currentVacias -= a_cantidad;
                applyObjDelta(vaciasPorAlmacen, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Decomiso') {
                currentLlenas += a_cantidad;
                currentVacias -= a_cantidad;
                applyObjDelta(vaciasPorAlmacen, payload.almacenVaciasId, -a_cantidad);
                revertLlenasBreakdown(payload, a_cantidad, true);
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                currentLlenas -= a_cantidad;
                currentVacias += a_cantidad;
                applyObjDelta(vaciasPorAlmacen, payload.almacenOrigenId, a_cantidad);
                revertLlenasBreakdown(payload, a_cantidad, false);
            } else if (a.operacion === 'Salida Canastas') {
                currentVacias += a_cantidad;
                applyObjDelta(vaciasPorAlmacen, payload.almacenId, a_cantidad);
            } else if (a.operacion === 'Transf. Interna') {
                const pOrig = payload.productoIdActual;
                const pDest = payload.productoIdNuevo || payload.productoIdActual;
                applyLlenasAlmacenDelta(payload.almacenOrigenId, pOrig, a_cantidad);
                applyLlenasAlmacenDelta(payload.almacenDestinoId, pDest, -a_cantidad);
            }
        });

        _lastGeneratedData = {
            totalLlenas: Math.max(0, currentLlenas),
            totalVacias: Math.max(0, currentVacias),
            totalDespProd: Math.max(0, currentDespProd),
            totalDespCli: Math.max(0, currentDespCli),
            llenasPorAlmacenYProducto,
            vaciasPorAlmacen,
            deudaProductor,
            deudaCliente
        };

        const data = _lastGeneratedData;

        // Renderear info general
        document.getElementById('if-total-llenas').textContent = data.totalLlenas.toLocaleString();
        document.getElementById('if-total-vacias').textContent = data.totalVacias.toLocaleString();
        document.getElementById('if-total-dprod').textContent = data.totalDespProd.toLocaleString();
        document.getElementById('if-total-dcli').textContent = data.totalDespCli.toLocaleString();

        // Calcular y mostrar Gran Total
        const grandTotal = data.totalLlenas + data.totalVacias + data.totalDespProd + data.totalDespCli;
        document.getElementById('if-grand-total').textContent = grandTotal.toLocaleString();
        document.getElementById('if-resumen-final').classList.remove('hidden');

        const productos = window.appStore.getProductos();
        const almacenes = window.appStore.getAlmacenes();
        const productores = window.appStore.getProductores();
        const clientes = window.appStore.getClientes();

        // Llenas
        const lstLlenas = document.getElementById('if-lista-llenas');
        let htmlLlenas = '';
        const llenasArr = Object.entries(data.llenasPorAlmacenYProducto || {})
            .filter(([_, prods]) => Object.values(prods).some(q => q > 0));

        if (llenasArr.length > 0) {
            llenasArr.forEach(([almId, prods]) => {
                const aName = almId === 'no-especificado' ? 'S/N' : (almacenes.find(a => a.id === almId)?.nombre || 'Almacén Desc.');
                htmlLlenas += `
                    <div class="bg-surface-light rounded-lg border border-border/50 overflow-hidden mb-3">
                        <div class="bg-[#10b981]/10 border-b border-[#10b981]/20 px-3 py-2 text-sm font-bold text-[#10b981]">
                            ${aName}
                        </div>
                        <div class="px-3 py-2 space-y-1">
                `;

                const pArr = Object.entries(prods).filter(([_, q]) => q > 0).sort((a, b) => b[1] - a[1]);
                pArr.forEach(([pId, q]) => {
                    const pName = productos.find(p => p.id === pId)?.nombre || pId;
                    htmlLlenas += `<div class="flex justify-between text-sm text-text-secondary"><span>${pName}</span><span class="font-bold text-white">${q.toLocaleString()}</span></div>`;
                });
                htmlLlenas += `</div></div>`;
            });
        } else {
            htmlLlenas = '<span class="italic opacity-70 block text-center text-text-secondary py-4">No hay canastas llenas.</span>';
        }
        lstLlenas.innerHTML = htmlLlenas;

        // Vaciás
        const lstVacias = document.getElementById('if-lista-vacias');
        let htmlVacias = '';
        const vaciasArr = Object.entries(data.vaciasPorAlmacen || {})
            .filter(([_, qty]) => qty > 0)
            .sort((a, b) => b[1] - a[1]);
        if (vaciasArr.length > 0) {
            vaciasArr.forEach(([almId, qty]) => {
                const aName = almId === 'no-especificado' ? 'S/N' : (almacenes.find(a => a.id === almId)?.nombre || 'Almacén Desc.');
                htmlVacias += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-2 last:pb-0 pt-2 first:pt-0"><span class="text-sm text-text-secondary">${aName}</span><span class="font-bold text-white">${qty.toLocaleString()}</span></div>`;
            });
        } else {
            htmlVacias = '<span class="italic opacity-70 block text-center text-text-secondary py-4">No hay canastas vacías.</span>';
        }
        lstVacias.innerHTML = htmlVacias;

        // Deudas Productores
        const lstDProd = document.getElementById('if-lista-dprod');
        let htmlDProd = '';
        const dProdArr = Object.entries(data.deudaProductor || {})
            .filter(([_, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        if (dProdArr.length > 0) {
            dProdArr.forEach(([uid, qty]) => {
                const uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || `Inactivo`);
                const color = qty < 0 ? 'text-success' : 'text-danger';
                htmlDProd += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0"><span class="text-sm text-text-secondary truncate pr-2" title="${uName}">${uName}</span><span class="font-bold text-sm ${color}">${qty.toLocaleString()}</span></div>`;
            });
        } else {
            htmlDProd = '<span class="italic opacity-70 block text-center text-text-secondary py-4">Nadie debe.</span>';
        }
        lstDProd.innerHTML = htmlDProd;

        // Deudas Clientes
        const lstDCli = document.getElementById('if-lista-dcli');
        let htmlDCli = '';
        const dCliArr = Object.entries(data.deudaCliente || {})
            .filter(([_, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        if (dCliArr.length > 0) {
            dCliArr.forEach(([uid, qty]) => {
                const uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || `Inactivo`);
                const color = qty < 0 ? 'text-success' : 'text-danger';
                htmlDCli += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0"><span class="text-sm text-text-secondary truncate pr-2" title="${uName}">${uName}</span><span class="font-bold text-sm ${color}">${qty.toLocaleString()}</span></div>`;
            });
        } else {
            htmlDCli = '<span class="italic opacity-70 block text-center text-text-secondary py-4">Nadie debe.</span>';
        }
        lstDCli.innerHTML = htmlDCli;

        contenedorResultados.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons({ root: contenedorResultados });

        window.UI.showToast("Reporte generado correctamente.", "success");
    });
};
