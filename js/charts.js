/**
 * Gráficos y Dashboard
 */

const Charts = {
    instances: {},

    init() {
        // Establecer estilos por defecto para Chart.js
        Chart.defaults.color = '#a1a1aa'; // var(--text-secondary)
        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = '#18181b'; // var(--bg-surface)
        Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
        Chart.defaults.plugins.tooltip.bodyColor = '#ededed';
        Chart.defaults.plugins.tooltip.borderColor = '#27272a';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;

        window.addEventListener('store:updated', () => {
            if (document.getElementById('page-dashboard').classList.contains('active')) {
                this.render();
            }
            if (document.getElementById('page-dashboard-semanal').classList.contains('active')) {
                this.renderWeeklyDashboard();
            }
            this.populateReporteInventarioSelects();
        });

        const btnBuscarInv = document.getElementById('btn-rep-inv-buscar');
        if (btnBuscarInv) {
            btnBuscarInv.addEventListener('click', () => this.generarReporteInventario());
        }
    },

    render() {
        this.renderWarehouseChart();
        this.renderBasketStatusChart();
    },

    renderWarehouseChart() {
        const ctx = document.getElementById('warehouseChart');
        if (!ctx) return;

        // Limpiar instancia previa
        if (this.instances.warehouseChart) {
            this.instances.warehouseChart.destroy();
        }

        const almacenes = window.appStore ? window.appStore.getAlmacenes() : [];
        const productos = window.appStore ? window.appStore.getProductos() : [];
        const invAlmacen = window.appStore ? window.appStore.getInventarioPorAlmacen() : {};

        if (almacenes.length === 0 || productos.length === 0) {
            this.showEmptyState(ctx, 'No hay datos suficientes (Agregue Almacenes y Frutas)');
            return;
        }

        const labels = almacenes.map(a => a.nombre);
        const datasets = [];

        // Paleta base (azules, verdes, púrpuras)
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

        productos.forEach((prod, index) => {
            const data = almacenes.map(a => {
                const inv = invAlmacen[a.id];
                return inv && inv[prod.id] ? inv[prod.id] : 0;
            });

            // Solo agregar si hay algun dato de esta fruta
            if (data.some(v => v > 0)) {
                datasets.push({
                    label: prod.nombre,
                    data: data,
                    backgroundColor: colors[index % colors.length],
                    borderRadius: 4,
                });
            }
        });

        if (datasets.length === 0) {
            this.showEmptyState(ctx, 'No hay frutas almacenadas actualmente');
            return;
        }

        this.instances.warehouseChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false, drawBorder: false }
                    },
                    y: {
                        stacked: true,
                        grid: { color: '#27272a', drawBorder: false }, // var(--border-color)
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { usePointStyle: true, boxWidth: 8 }
                    }
                }
            }
        });
    },

    renderBasketStatusChart() {
        const ctx = document.getElementById('basketStatusChart');
        if (!ctx) return;

        if (this.instances.basketChart) {
            this.instances.basketChart.destroy();
        }

        const stats = window.appStore ? window.appStore.getStats() : { canastasLlenas: 0, canastasVacias: 0 };

        if (stats.canastasLlenas === 0 && stats.canastasVacias === 0) {
            this.showEmptyState(ctx, 'No hay canastas registradas');
            return;
        }

        this.instances.basketChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Llenas', 'Vacías'],
                datasets: [{
                    data: [stats.canastasLlenas, stats.canastasVacias],
                    backgroundColor: ['#10b981', '#f59e0b'], // success, warning
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 }
                    }
                }
            }
        });
    },

    showEmptyState(canvasElement, message) {
        const parent = canvasElement.parentElement;

        // Remover vacio previo si existe
        const existingMessage = parent.querySelector('.empty-chart-message');
        if (existingMessage) existingMessage.remove();

        // Agregar mensaje div sobre el canvas
        const msgDiv = document.createElement('div');
        msgDiv.className = 'empty-chart-message absolute inset-0 flex items-center justify-center text-text-secondary text-sm text-center px-4';
        msgDiv.innerHTML = `<div class="flex flex-col items-center gap-2"><i data-lucide="bar-chart-2" class="w-8 h-8 opacity-50"></i><span>${message}</span></div>`;
        parent.appendChild(msgDiv);

        // Inicializar iconos en el html nuevo
        if (window.lucide) window.lucide.createIcons({ root: msgDiv });

        // Ocultar canvas
        canvasElement.style.display = 'none';
    },

    // ==========================================
    // DASHBOARD SEMANAL LOGIC
    // ==========================================
    getWeekRange(weekStr) {
        // weekStr format: "2026-W08"
        const [yearStr, weekNumStr] = weekStr.split('-W');
        const year = parseInt(yearStr, 10);
        const week = parseInt(weekNumStr, 10);

        // Get first day of the year
        const getJan1 = new Date(year, 0, 1);
        const offset = getJan1.getTimezoneOffset() * 60000;
        const jan1 = new Date(getJan1.getTime() - offset);

        // ISO weeks start on Monday. Find the first Monday of the year.
        let days = jan1.getUTCDay() || 7;
        let p = jan1;
        if (days !== 1) {
            p = new Date(jan1.getTime() - (days - 1) * 86400000);
        }

        // Add (week - 1) weeks
        const startOfWeek = new Date(p.getTime() + (week - 1) * 7 * 86400000);

        // End of week (Sunday 23:59:59.999)
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
        endOfWeek.setUTCHours(23, 59, 59, 999);

        return { start: startOfWeek, end: endOfWeek };
    },

    getCurrentWeekString() {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const now = new Date(d.getTime() - offset);

        now.setUTCDate(now.getUTCDate() + 4 - (now.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((now - yearStart) / 86400000) + 1) / 7);
        return `${now.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    },

    renderWeeklyDashboard() {
        const selector = document.getElementById('sem-semana-selector');
        if (!selector) return;

        if (!selector.value) {
            selector.value = this.getCurrentWeekString();
            selector.addEventListener('change', () => this.renderWeeklyDashboard());
        }

        const selectedWeek = selector.value;
        const { start, end } = this.getWeekRange(selectedWeek);

        this.calculateWeeklyBalances(start, end);
        this.renderWeeklyCharts(start, end);
        this.renderCanastasPorCobrar();
    },

    calculateWeeklyBalances(startDate, endDate) {
        const stats = window.appStore.getStats();
        let currentLlenas = stats.canastasLlenas;
        let currentVacias = stats.canastasVacias;
        let currentDespProd = stats.despachadasProductor || 0;
        let currentDespCli = stats.despachadasCliente || 0;

        // Initialize per-warehouse empty baskets
        const invPorAlmacen = window.appStore.getInventarioPorAlmacen() || {};
        let currentVaciasPorAlm = {};
        Object.keys(invPorAlmacen).forEach(almId => {
            currentVaciasPorAlm[almId] = invPorAlmacen[almId]?.vacias || 0;
        });

        // Initialize per-product full baskets
        let currentLlenasPorProducto = {};
        if (invPorAlmacen) {
            Object.values(invPorAlmacen).forEach(almacenData => {
                Object.entries(almacenData).forEach(([key, val]) => {
                    if (key !== 'vacias' && val > 0) {
                        if (currentLlenasPorProducto[key] === undefined) currentLlenasPorProducto[key] = { cantidad: 0 };
                        currentLlenasPorProducto[key].cantidad += val;
                    }
                });
            });
        }

        // Initialize per-user debts arrays into maps for fast arithmetic
        const currentDeudaProductor = {};
        window.appStore.getProductores().forEach(p => {
            currentDeudaProductor[p.id] = p.canastasPrestadas || 0;
        });

        const currentDeudaCliente = {};
        window.appStore.getClientes().forEach(c => {
            currentDeudaCliente[c.id] = c.canastasPrestadas || 0;
        });

        const allActivity = window.appStore.getActividad(10000); // Get as much as possible

        // Helper to safely apply delta to user debt
        const applyDebtDelta = (balances, entityId, delta) => {
            if (!entityId) entityId = 'no-especificado';
            if (balances[entityId] === undefined) balances[entityId] = 0;
            balances[entityId] += delta;
        };

        // Helper to safely apply delta to warehouse for empty baskets
        const applyVaciasDelta = (balances, almacenId, delta) => {
            if (!almacenId) almacenId = 'no-especificado';
            if (balances[almacenId] === undefined) balances[almacenId] = 0;
            balances[almacenId] += delta;
        };

        // Helper to safely apply delta to product for full baskets
        const applyLlenasDelta = (balances, productoId, delta) => {
            if (!productoId) return; // Fallback to 'no-especificado' not strictly required if we lack an ID, but can be added
            if (balances[productoId] === undefined) balances[productoId] = { cantidad: 0 };
            balances[productoId].cantidad += delta;
        };

        // Extract products for safe delta calculations if possible
        const updateLlenasBreakdown = (payload = {}, a_cantidad = 0, revert = false) => {
            // Operacion standard 
            if (payload.productoId || payload.productoIdActual || payload.productoIdNuevo) {
                const pid = payload.productoId || payload.productoIdActual || payload.productoIdNuevo;
                applyLlenasDelta(currentLlenasPorProducto, pid, revert ? -a_cantidad : a_cantidad);
            } else if (payload.lotes) {
                payload.lotes.forEach(l => applyLlenasDelta(currentLlenasPorProducto, l.productoId, revert ? -l.cantidad : l.cantidad));
            } else if (payload.detalles) {
                payload.detalles.forEach(d => applyLlenasDelta(currentLlenasPorProducto, d.productoId, revert ? -d.cantidad : d.cantidad));
            }
        };

        // Revert transactions that happened AFTER the selected week
        const postWeekActivity = allActivity.filter(a => new Date(a.date || a.fecha) > endDate);

        postWeekActivity.forEach(a => {
            const payload = a.rawPayload || {};
            const qtyStr = a.cantidad ? a.cantidad.toString() : '0';
            const match = qtyStr.match(/\d+/);
            const a_cantidad = match ? parseInt(match[0], 10) : 0;

            // Revert changes conceptually
            if (a.operacion === 'Recepción') {
                currentLlenas -= a_cantidad;
                currentDespProd += a_cantidad; // Recepción decrementó deuda productor, revertir: sumar
                updateLlenasBreakdown(payload, a_cantidad, true);
                applyDebtDelta(currentDeudaProductor, payload.productorId, a_cantidad);
            } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                currentLlenas += a_cantidad;
                currentDespCli -= a_cantidad; // Despacho cliente aumentó su deuda, revertir: restar
                updateLlenasBreakdown(payload, a_cantidad, false);
                applyDebtDelta(currentDeudaCliente, payload.clienteId, -a_cantidad);
            } else if (a.operacion === 'Desp. Vacías') {
                currentVacias += a_cantidad;
                currentDespProd -= a_cantidad; // Desp vacías aumentó deuda productor, revertir: restar
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                applyDebtDelta(currentDeudaProductor, payload.productorId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Vacías')) {
                currentVacias -= a_cantidad;
                if (payload.tipoOrigen === 'productor') {
                    currentDespProd += a_cantidad;
                    applyDebtDelta(currentDeudaProductor, payload.productorId, a_cantidad);
                } else {
                    currentDespCli += a_cantidad; // Devolución vacías disminuyó deuda cliente, revertir: sumar
                    applyDebtDelta(currentDeudaCliente, payload.clienteId, a_cantidad);
                }
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Llenas')) {
                currentLlenas -= a_cantidad;
                updateLlenasBreakdown(payload, a_cantidad, true);
                if (payload.tipoOrigen === 'productor') {
                    currentDespProd += a_cantidad;
                    applyDebtDelta(currentDeudaProductor, payload.productorId, a_cantidad);
                } else {
                    currentDespCli += a_cantidad; // Devolución llenas disminuyó deuda cliente, revertir: sumar
                    applyDebtDelta(currentDeudaCliente, payload.clienteId, a_cantidad);
                }
            } else if (a.operacion === 'Transf. Fincas') {
                applyDebtDelta(currentDeudaProductor, payload.productorOrigenId, a_cantidad);
                applyDebtDelta(currentDeudaProductor, payload.productorDestinoId, -a_cantidad);
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas') {
                currentVacias -= a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Decomiso') {
                currentLlenas += a_cantidad;
                currentVacias -= a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenVaciasId, -a_cantidad);
                updateLlenasBreakdown(payload, a_cantidad, false);
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                currentLlenas -= a_cantidad;
                currentVacias += a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                updateLlenasBreakdown(payload, a_cantidad, true);
            } else if (a.operacion === 'Salida Canastas') {
                currentVacias += a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenId, a_cantidad);
            }
        });

        const finalLlenas = Math.max(0, currentLlenas);
        const finalVacias = Math.max(0, currentVacias);
        const finalDespProd = Math.max(0, currentDespProd);
        const finalDespCli = Math.max(0, currentDespCli);
        const finalTotal = finalLlenas + finalVacias + finalDespProd + finalDespCli;

        document.getElementById('sem-final-llenas').innerText = finalLlenas.toLocaleString();
        document.getElementById('sem-final-vacias').innerText = finalVacias.toLocaleString();
        document.getElementById('sem-final-desp-prod').innerText = finalDespProd.toLocaleString();
        document.getElementById('sem-final-desp-cli').innerText = finalDespCli.toLocaleString();
        document.getElementById('sem-final-total').innerText = finalTotal.toLocaleString();

        // Now revert transactions that happened DURING the selected week to get the Starting Balance
        const duringWeekActivity = allActivity.filter(a => {
            const d = new Date(a.date || a.fecha);
            return d >= startDate && d <= endDate;
        });

        let initialLlenas = finalLlenas;
        let initialVacias = finalVacias;
        let initialDespProd = finalDespProd;
        let initialDespCli = finalDespCli;
        let initialVaciasPorAlm = { ...currentVaciasPorAlm };
        let initialLlenasPorProducto = JSON.parse(JSON.stringify(currentLlenasPorProducto));
        let initialDeudaProductor = { ...currentDeudaProductor };
        let initialDeudaCliente = { ...currentDeudaCliente };

        // Helper for initial states iteration
        const updateInitialLlenasBreakdown = (payload = {}, a_cantidad = 0, revert = false) => {
            if (payload.productoId || payload.productoIdActual || payload.productoIdNuevo) {
                const pid = payload.productoId || payload.productoIdActual || payload.productoIdNuevo;
                applyLlenasDelta(initialLlenasPorProducto, pid, revert ? -a_cantidad : a_cantidad);
            } else if (payload.lotes) {
                payload.lotes.forEach(l => applyLlenasDelta(initialLlenasPorProducto, l.productoId, revert ? -l.cantidad : l.cantidad));
            } else if (payload.detalles) {
                payload.detalles.forEach(d => applyLlenasDelta(initialLlenasPorProducto, d.productoId, revert ? -d.cantidad : d.cantidad));
            }
        };

        duringWeekActivity.forEach(a => {
            const payload = a.rawPayload || {};
            const qtyStr = a.cantidad ? a.cantidad.toString() : '0';
            const match = qtyStr.match(/\d+/);
            const a_cantidad = match ? parseInt(match[0], 10) : 0;

            if (a.operacion === 'Recepción') {
                initialLlenas -= a_cantidad;
                initialDespProd += a_cantidad;
                updateInitialLlenasBreakdown(payload, a_cantidad, true);
                applyDebtDelta(initialDeudaProductor, payload.productorId, a_cantidad);
            } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                initialLlenas += a_cantidad;
                initialDespCli -= a_cantidad;
                updateInitialLlenasBreakdown(payload, a_cantidad, false);
                applyDebtDelta(initialDeudaCliente, payload.clienteId, -a_cantidad);
            } else if (a.operacion === 'Desp. Vacías') {
                initialVacias += a_cantidad;
                initialDespProd -= a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                applyDebtDelta(initialDeudaProductor, payload.productorId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Vacías')) {
                initialVacias -= a_cantidad;
                if (payload.tipoOrigen === 'productor') {
                    initialDespProd += a_cantidad;
                    applyDebtDelta(initialDeudaProductor, payload.productorId, a_cantidad);
                } else {
                    initialDespCli += a_cantidad;
                    applyDebtDelta(initialDeudaCliente, payload.clienteId, a_cantidad);
                }
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Devolución' && a.detalle && a.detalle.includes('Llenas')) {
                initialLlenas -= a_cantidad;
                updateInitialLlenasBreakdown(payload, a_cantidad, true);
                if (payload.tipoOrigen === 'productor') {
                    initialDespProd += a_cantidad;
                    applyDebtDelta(initialDeudaProductor, payload.productorId, a_cantidad);
                } else {
                    initialDespCli += a_cantidad;
                    applyDebtDelta(initialDeudaCliente, payload.clienteId, a_cantidad);
                }
            } else if (a.operacion === 'Transf. Fincas') {
                applyDebtDelta(initialDeudaProductor, payload.productorOrigenId, a_cantidad);
                applyDebtDelta(initialDeudaProductor, payload.productorDestinoId, -a_cantidad);
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas') {
                initialVacias -= a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Decomiso') {
                initialLlenas += a_cantidad;
                initialVacias -= a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenVaciasId, -a_cantidad);
                updateInitialLlenasBreakdown(payload, a_cantidad, false);
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                initialLlenas -= a_cantidad;
                initialVacias += a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                updateInitialLlenasBreakdown(payload, a_cantidad, true);
            } else if (a.operacion === 'Salida Canastas') {
                initialVacias += a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenId, a_cantidad);
            }
        });

        initialLlenas = Math.max(0, initialLlenas);
        initialVacias = Math.max(0, initialVacias);
        initialDespProd = Math.max(0, initialDespProd);
        initialDespCli = Math.max(0, initialDespCli);
        const initialTotal = initialLlenas + initialVacias + initialDespProd + initialDespCli;

        document.getElementById('sem-inicial-llenas').innerText = initialLlenas.toLocaleString();
        document.getElementById('sem-inicial-vacias').innerText = initialVacias.toLocaleString();
        document.getElementById('sem-inicial-desp-prod').innerText = initialDespProd.toLocaleString();
        document.getElementById('sem-inicial-desp-cli').innerText = initialDespCli.toLocaleString();
        document.getElementById('sem-inicial-total').innerText = initialTotal.toLocaleString();

        // Export state internally so the modal can pick it up
        this._lastWeeklyBalances = {
            inicial: {
                totalLlenas: initialLlenas,
                totalVacias: initialVacias,
                totalDespProd: initialDespProd,
                totalDespCli: initialDespCli,
                llenasPorProducto: initialLlenasPorProducto,
                vaciasPorAlmacen: initialVaciasPorAlm,
                deudaProductor: initialDeudaProductor,
                deudaCliente: initialDeudaCliente
            },
            final: {
                totalLlenas: finalLlenas,
                totalVacias: finalVacias,
                totalDespProd: finalDespProd,
                totalDespCli: finalDespCli,
                llenasPorProducto: currentLlenasPorProducto,
                vaciasPorAlmacen: currentVaciasPorAlm,
                deudaProductor: currentDeudaProductor,
                deudaCliente: currentDeudaCliente
            }
        };
    },

    renderWeeklyCharts(startDate, endDate) {
        const txContainer = document.getElementById('sem-despacho-diario-container');

        if (!txContainer) return;

        txContainer.innerHTML = '';

        const allActivity = window.appStore.getActividad(10000);
        const duringWeek = allActivity.filter(a => {
            const d = new Date(a.date || a.fecha);
            return d >= startDate && d <= endDate;
        });

        const productos = window.appStore.getProductos();
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

        const txDataByDay = {}; // Estructura: { 'YYYY-MM-DD': { dateObj: Date, total: 0, prods: { prodId: qty } } }

        let totalTx = 0;

        duringWeek.forEach(a => {
            if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                const dateObj = new Date(a.date || a.fecha);
                const dayKey = dateObj.toISOString().split('T')[0];

                if (!txDataByDay[dayKey]) {
                    txDataByDay[dayKey] = {
                        dateObj: dateObj,
                        total: 0,
                        prods: {}
                    };
                }

                if (a.rawPayload) {
                    const items = a.rawPayload.detalles || a.rawPayload.lotes || [];
                    items.forEach(lote => {
                        const cant = parseInt(lote.cantidad) || 0;
                        txDataByDay[dayKey].prods[lote.productoId] = (txDataByDay[dayKey].prods[lote.productoId] || 0) + cant;
                        txDataByDay[dayKey].total += cant;
                        totalTx += cant;
                    });
                } else if (a.detalle && a.detalle.includes('|')) {
                    // Fallback to parsing history strings e.g., "A cliente: Juan | Aguacate (10), Mango (5)"
                    const parts = a.detalle.split('|');
                    if (parts.length > 1) {
                        const itemsStr = parts[1].trim().split(',');
                        itemsStr.forEach(item => {
                            const match = item.match(/(.+?)\s*\((\d+)\)/);
                            if (match) {
                                const prodName = match[1].trim();
                                const qty = parseInt(match[2], 10);
                                const foundProd = productos.find(p => p.nombre.toLowerCase() === prodName.toLowerCase());
                                if (foundProd) {
                                    txDataByDay[dayKey].prods[foundProd.id] = (txDataByDay[dayKey].prods[foundProd.id] || 0) + qty;
                                    txDataByDay[dayKey].total += qty;
                                    totalTx += qty;
                                }
                            }
                        });
                    }
                }
            }
        });

        if (totalTx === 0) {
            txContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-text-secondary italic opacity-70"><i data-lucide="bar-chart-2" class="w-8 h-8 mb-2"></i> No hubo despachos a clientes esta semana</div>`;
            if (window.lucide) window.lucide.createIcons({ root: txContainer });
        } else {
            // Sort days
            const daysArr = Object.values(txDataByDay).sort((a, b) => a.dateObj - b.dateObj);
            const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

            let html = '';

            daysArr.forEach(dayData => {
                const diaNombre = diasSemana[dayData.dateObj.getDay()];
                const fechaStr = dayData.dateObj.toLocaleDateString();

                let rowsHtml = '';
                productos.forEach(p => {
                    if (dayData.prods[p.id] > 0) {
                        const cantHtml = formatter.format(dayData.prods[p.id]);
                        rowsHtml += `
                            <div class="flex justify-between py-1 border-b border-[#a1d9f4] last:border-0 text-sm bg-white text-black px-2">
                                <span class="font-medium">${p.nombre.toUpperCase()}</span>
                                <span class="font-mono text-right w-24">$ ${cantHtml}</span>
                            </div>
                        `;
                    }
                });

                html += `
                <div class="rounded-t-sm shadow-md overflow-hidden bg-white border border-[#a1d9f4] mb-4">
                    <!-- Header -->
                    <div class="bg-[#c8f0fc] text-black border-b border-[#a1d9f4] px-2 py-1 flex justify-between items-center text-sm font-semibold">
                        <div class="flex gap-4">
                           <span>FECHA</span>
                           <span>${fechaStr}</span>
                        </div>
                        <button class="bg-[#25D366] hover:bg-[#128C7E] text-white p-1 rounded transition-colors btn-share-wa" data-date="${dayData.dateObj.toISOString()}" title="Compartir vía WhatsApp">
                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <!-- Day Name -->
                    <div class="text-center font-bold text-black border-b border-[#a1d9f4] py-1 uppercase tracking-widest text-sm bg-[#ffffff]">
                        ${diaNombre}
                    </div>
                    <!-- Column Headers -->
                    <div class="flex justify-between font-bold text-black border-b border-black py-1 px-2 text-sm bg-[#c8f0fc]">
                        <span>Etiquetas de fila ▼</span>
                        <span>Suma de CANASTAS</span>
                    </div>
                    <!-- Data Rows -->
                    <div class="bg-[#fbfcff]">
                        ${rowsHtml}
                    </div>
                    <!-- Footer Total -->
                    <div class="flex justify-between font-bold text-black p-2 border-t-2 border-black text-sm bg-[#c8f0fc]">
                        <span>Total general</span>
                        <span class="font-mono text-right w-24">$ ${formatter.format(dayData.total)}</span>
                    </div>
                </div>
                `;
            });

            txContainer.innerHTML = html;
            if (window.lucide) window.lucide.createIcons({ root: txContainer });

            // Agarrar botones de whatsapp
            const waBtns = txContainer.querySelectorAll('.btn-share-wa');
            waBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const isoDate = btn.getAttribute('data-date');
                    this.shareWhatsAppDay(isoDate, txDataByDay, diasSemana, formatter);
                });
            });
        }
    },

    shareWhatsAppDay(isoDateStr, txDataByDay, diasSemana, formatter) {
        const dayKey = isoDateStr.split('T')[0];
        const dayData = txDataByDay[dayKey];
        if (!dayData) return;

        const productos = window.appStore.getProductos();
        const diaNombre = diasSemana[dayData.dateObj.getDay()];
        const fechaStr = dayData.dateObj.toLocaleDateString();

        let message = `*DESPACHOS ${diaNombre} ${fechaStr}*\n\n`;
        message += `*PRODUCTO* | *CANASTAS*\n`;
        message += `------------------------\n`;

        productos.forEach(p => {
            if (dayData.prods[p.id] > 0) {
                message += `${p.nombre.toUpperCase()} : ${formatter.format(dayData.prods[p.id])}\n`;
            }
        });

        message += `------------------------\n`;
        message += `*TOTAL CANASTAS:* ${formatter.format(dayData.total)}`;

        // Encode and open WhatsApp tab
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    },

    // ==========================================
    // REPORTE DE MOVIMIENTOS A INVENTARIO
    // ==========================================
    populateReporteInventarioSelects() {
        const selAlmacen = document.getElementById('rep-inv-almacen');
        const selProducto = document.getElementById('rep-inv-producto');
        if (!selAlmacen || !selProducto) return;

        const almacenes = window.appStore.getAlmacenes();
        const productos = window.appStore.getProductos();

        if (selAlmacen.options.length <= 1 && almacenes.length > 0) {
            let htmlA = '<option value="">-- Seleccionar Almacén --</option>';
            almacenes.forEach(a => htmlA += `<option value="${a.id}">${a.nombre}</option>`);
            selAlmacen.innerHTML = htmlA;
        }

        if (selProducto.options.length <= 1 && productos.length > 0) {
            let htmlP = '<option value="">-- Todos --</option>';
            productos.forEach(p => htmlP += `<option value="${p.id}">${p.nombre}</option>`);
            selProducto.innerHTML = htmlP;
        }

        // Initialize today in dates if empty
        const desde = document.getElementById('rep-inv-desde');
        const hasta = document.getElementById('rep-inv-hasta');
        if (desde && !desde.value) {
            const todayISO = new Date().toISOString().slice(0, 10);
            desde.value = todayISO;
            hasta.value = todayISO;
        }
    },

    generarReporteInventario() {
        const almacenId = document.getElementById('rep-inv-almacen').value;
        const productoId = document.getElementById('rep-inv-producto').value;
        const desdeVal = document.getElementById('rep-inv-desde').value;
        const hastaVal = document.getElementById('rep-inv-hasta').value;
        const tbody = document.getElementById('rep-inv-tbody');

        if (!almacenId) {
            window.UI.showToast("Debe seleccionar un almacén limitante.", "warning");
            return;
        }
        if (!desdeVal || !hastaVal) {
            window.UI.showToast("Debe especificar las fechas.", "warning");
            return;
        }

        const btn = document.getElementById('btn-rep-inv-buscar');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline-block mr-1"></i>Buscando...';
        btn.disabled = true;

        setTimeout(() => {
            try {
                // Fetch virtually all transaction history safely (cap at 20,000 to be safe on memory)
                const todas = window.appStore.getActividad(30000);
                const start = new Date(desdeVal + 'T00:00:00');
                const end = new Date(hastaVal + 'T23:59:59.999');

                const filtradas = todas.filter(a => {
                    // Normalize date
                    let dt = new Date(a.date);
                    // Support legacy format just in case
                    if (isNaN(dt.getTime()) && a.fecha) dt = new Date(a.fecha);

                    if (dt < start || dt > end) return false;

                    const payload = a.rawPayload || {};
                    let afectoAlmacen = false;

                    // Direct checks
                    if (payload.almacenOrigenId === almacenId || payload.almacenDestinoId === almacenId || payload.almacenId === almacenId || payload.almacenVaciasId === almacenId) {
                        afectoAlmacen = true;
                    }

                    // Deep checks in arrays
                    if (!afectoAlmacen && payload.lotes && Array.isArray(payload.lotes)) {
                        if (payload.lotes.some(l => l.almacenId === almacenId)) afectoAlmacen = true;
                    }
                    if (!afectoAlmacen && payload.detalles && Array.isArray(payload.detalles)) {
                        if (payload.detalles.some(d => d.almacenOrigenId === almacenId || d.almacenId === almacenId)) afectoAlmacen = true;
                    }

                    // Fallback para transacciones sin payload (legacy), no podemos rastrear de forma segura, descartar:
                    if (!payload && !a.rawPayload) {
                        return false;
                    }

                    if (!afectoAlmacen) return false;

                    // Filtrado por Producto opcional
                    if (productoId) {
                        let afectoProducto = false;
                        if (payload.productoId === productoId || payload.productoIdActual === productoId || payload.productoIdNuevo === productoId) {
                            afectoProducto = true;
                        }
                        if (!afectoProducto && payload.lotes && Array.isArray(payload.lotes)) {
                            if (payload.lotes.some(l => l.productoId === productoId && l.almacenId === almacenId)) afectoProducto = true;
                        }
                        if (!afectoProducto && payload.detalles && Array.isArray(payload.detalles)) {
                            if (payload.detalles.some(d => d.productoId === productoId && (d.almacenOrigenId === almacenId || d.almacenId === almacenId))) afectoProducto = true;
                        }
                        return afectoProducto;
                    }

                    return true;
                });

                filtradas.sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha));

                if (filtradas.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos específicos para los filtros seleccionados.</td></tr>`;
                } else {
                    let html = '';
                    filtradas.forEach(a => {
                        const dateObj = new Date(a.date || a.fecha);
                        const fechaStr = `${dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

                        // Determinar la cantidad específica que impactó a ESTE almacén y ESTE producto (si aplica)
                        let isNegative = false;
                        let sumCant = 0;
                        let foundSpecificQty = false;
                        const payload = a.rawPayload || {};

                        // Helper para mapear lotes/detalles
                        const checkLotesOrDetalles = () => {
                            if (payload.lotes) {
                                payload.lotes.forEach(l => {
                                    if (l.almacenId === almacenId) {
                                        if (!productoId || l.productoId === productoId) {
                                            sumCant += parseInt(l.cantidad) || 0;
                                        }
                                    }
                                });
                            }
                            if (payload.detalles) {
                                payload.detalles.forEach(d => {
                                    if (d.almacenOrigenId === almacenId || d.almacenId === almacenId) {
                                        if (!productoId || d.productoId === productoId) {
                                            sumCant += parseInt(d.cantidad) || 0;
                                        }
                                    }
                                });
                            }
                        };

                        // Evaluar direccion (Salida "isNegative" = true)
                        if (a.operacion === 'Recepción') {
                            isNegative = false;
                            checkLotesOrDetalles();
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Desp. Vacías') {
                            isNegative = true;
                            if (payload.almacenOrigenId === almacenId) {
                                if (!productoId || productoId === 'vacias') {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Devolución') {
                            if (a.detalle && a.detalle.toLowerCase().includes('vacías')) {
                                isNegative = false;
                                if (payload.almacenDestinoId === almacenId) {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            } else {
                                isNegative = false;
                                if (payload.almacenDestinoId === almacenId) {
                                    if (!productoId || payload.productoId === productoId) {
                                        sumCant = parseInt(payload.cantidad);
                                    }
                                }
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas') {
                            isNegative = false;
                            if (payload.almacenDestinoId === almacenId) {
                                if (!productoId || productoId === 'vacias') {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                            isNegative = true;
                            checkLotesOrDetalles();
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Decomiso') {
                            if (payload.almacenOrigenId === almacenId) {
                                isNegative = true; // Salió fruta
                                if (!productoId || payload.productoId === productoId) {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            } else if (payload.almacenVaciasId === almacenId) {
                                isNegative = false; // Entró vacías
                                if (!productoId || productoId === 'vacias') {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                            if (payload.almacenOrigenId === almacenId) {
                                isNegative = true; // Salieron vacías
                                if (!productoId || productoId === 'vacias') {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            } else if (payload.almacenDestinoId === almacenId) {
                                isNegative = false; // Entraron llenas
                                if (!productoId || payload.productoId === productoId) {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Salida Canastas') {
                            isNegative = true;
                            if (payload.almacenId === almacenId) {
                                sumCant = parseInt(payload.cantidad);
                            }
                            foundSpecificQty = true;
                        } else if (a.operacion === 'Transf. Interna') {
                            if (payload.almacenOrigenId === almacenId) {
                                isNegative = true; // Salió la fruta especificada
                                if (!productoId || payload.productoIdActual === productoId) {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            } else if (payload.almacenDestinoId === almacenId) {
                                isNegative = false; // Entró la fruta
                                if (!productoId || payload.productoIdNuevo === productoId) {
                                    sumCant = parseInt(payload.cantidad);
                                }
                            }
                            foundSpecificQty = true;
                        }

                        let descCantidad = a.cantidad;
                        if (foundSpecificQty && sumCant > 0) {
                            descCantidad = `${isNegative ? '-' : '+'}${sumCant}`;
                        } else if (foundSpecificQty && sumCant === 0) {
                            return; // Ignoramos si para el producto filtrado esto resolvió a 0 en este almacén.
                        }

                        const cantColor = descCantidad && descCantidad.startsWith('-') ? 'text-danger' : 'text-success';

                        html += `
                        <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                            <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${fechaStr}</td>
                            <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || '-'}</td>
                            <td class="py-2.5 px-4 font-medium text-white">${a.operacion}</td>
                            <td class="py-2.5 px-4 text-text-secondary italic text-xs leading-tight" title="${a.detalle}">${a.detalle}</td>
                            <td class="py-2.5 px-4 text-right font-bold ${cantColor} whitespace-nowrap">${descCantidad}</td>
                        </tr>
                        `;
                    });

                    if (html === '') {
                        tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos específicos de ese producto en este almacén para el rango actual.</td></tr>`;
                    } else {
                        tbody.innerHTML = html;
                    }
                }
            } catch (err) {
                console.error(err);
                tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-danger">Error al cargar datos. Reporte al soporte.</td></tr>`;
                window.UI.showToast("Ocurrió un error al generar el reporte", "error");
            } finally {
                btn.innerHTML = oldText;
                btn.disabled = false;
                if (window.lucide) window.lucide.createIcons({ root: tbody });
            }
        }, 50);
    }
};

window.verDetalleBalanceSemanal = function (tipo) {
    const modal = document.getElementById('modal-detalle-balance');
    const chartState = window.appCharts._lastWeeklyBalances || {};
    const data = chartState[tipo];

    if (!data || !modal) {
        window.UI.showToast("No hay datos de balance cargados.", "warning");
        return;
    }

    window.appCharts._activeBalanceModalType = tipo;

    const titleEl = document.getElementById('detalle-balance-titulo');
    titleEl.innerHTML = `<i data-lucide="bar-chart-2" class="w-5 h-5 text-primary"></i> Detalle de Inventario ${tipo === 'inicial' ? 'Inicial' : 'Final'}`;

    document.getElementById('db-total-llenas').textContent = data.totalLlenas.toLocaleString();
    document.getElementById('db-total-vacias').textContent = data.totalVacias.toLocaleString();
    document.getElementById('db-total-dprod').textContent = data.totalDespProd.toLocaleString();
    document.getElementById('db-total-dcli').textContent = data.totalDespCli.toLocaleString();

    // Render LLenas List
    const listaLlenas = document.getElementById('db-lista-llenas');
    const productos = window.appStore.getProductos();
    let htmlLlenas = '';

    // Convert to array and sort to show non-zeros first
    const llenasArr = Object.entries(data.llenasPorProducto || {})
        .filter(([pid, info]) => info.cantidad > 0)
        .sort((a, b) => b[1].cantidad - a[1].cantidad);

    if (llenasArr.length > 0) {
        llenasArr.forEach(([pid, info]) => {
            const pName = productos.find(p => p.id === pid)?.nombre || 'Producto Desconocido';
            htmlLlenas += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1 last:pb-0"><span>${pName}</span><span class="font-bold text-white">${info.cantidad.toLocaleString()}</span></div>`;
        });
    } else {
        htmlLlenas = '<span class="italic opacity-70 block text-center">No hay canastas llenas.</span>';
    }
    listaLlenas.innerHTML = htmlLlenas;

    // Render Vacias List
    const listaVacias = document.getElementById('db-lista-vacias');
    const almacenes = window.appStore.getAlmacenes();
    let htmlVacias = '';

    const vaciasArr = Object.entries(data.vaciasPorAlmacen || {})
        .filter(([aid, qty]) => qty > 0)
        .sort((a, b) => b[1] - a[1]);

    if (vaciasArr.length > 0) {
        vaciasArr.forEach(([aid, qty]) => {
            const aName = aid === 'no-especificado' ? 'S/N' : (almacenes.find(a => a.id === aid)?.nombre || 'Almacén Desconocido');
            htmlVacias += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1 last:pb-0"><span>${aName}</span><span class="font-bold text-white">${qty.toLocaleString()}</span></div>`;
        });
    } else {
        htmlVacias = '<span class="italic opacity-70 block text-center">No hay canastas vacías en almacenes.</span>';
    }
    listaVacias.innerHTML = htmlVacias;

    // Render Deuda Productores
    const listaDProd = document.getElementById('db-lista-dprod');
    const productores = window.appStore.getProductores();
    let htmlDProd = '';
    const dProdArr = Object.entries(data.deudaProductor || {})
        .filter(([id, qty]) => qty !== 0)
        .sort((a, b) => b[1] - a[1]); // Sort by highest debt first

    if (dProdArr.length > 0) {
        dProdArr.forEach(([uid, qty]) => {
            const uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || `Inactivo (${uid.substring(0, 4)})`);
            const color = qty < 0 ? 'text-success' : 'text-danger';
            htmlDProd += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1 last:pb-0"><span class="truncate pr-2" title="${uName}">${uName}</span><span class="font-bold cursor-default ${color}" title="Un número negativo significa que el productor prestó canastas">${qty.toLocaleString()}</span></div>`;
        });
    } else {
        htmlDProd = '<span class="italic opacity-70 block text-center">Nadie debe.</span>';
    }
    listaDProd.innerHTML = htmlDProd;

    // Render Deuda Clientes
    const listaDCli = document.getElementById('db-lista-dcli');
    const clientes = window.appStore.getClientes();
    let htmlDCli = '';
    const dCliArr = Object.entries(data.deudaCliente || {})
        .filter(([id, qty]) => qty !== 0)
        .sort((a, b) => b[1] - a[1]);

    if (dCliArr.length > 0) {
        dCliArr.forEach(([uid, qty]) => {
            const uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || `Inactivo (${uid.substring(0, 4)})`);
            const color = qty < 0 ? 'text-success' : 'text-danger';
            htmlDCli += `<div class="flex justify-between border-b border-border/30 last:border-0 pb-1 last:pb-0"><span class="truncate pr-2" title="${uName}">${uName}</span><span class="font-bold cursor-default ${color}" title="Un número negativo significa que el cliente tiene canastas a favor">${qty.toLocaleString()}</span></div>`;
        });
    } else {
        htmlDCli = '<span class="italic opacity-70 block text-center">Nadie debe.</span>';
    }
    listaDCli.innerHTML = htmlDCli;

    // Show modal and icons
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons({ root: modal });
};

window.compartirDetalleBalanceWhatsApp = function () {
    const tipo = window.appCharts._activeBalanceModalType;
    if (!tipo) return;

    const btn = document.getElementById('btn-compartir-balance-wa');
    if (btn) btn.disabled = true;

    try {
        const data = window.appCharts._lastWeeklyBalances[tipo];
        if (!data) throw new Error("Datos no encontrados");

        const tipoTit = tipo === 'inicial' ? 'Inicial' : 'Final';
        const productos = window.appStore.getProductos();
        const productores = window.appStore.getProductores();
        const clientes = window.appStore.getClientes();

        let message = `📊 *Detalle de Inventario ${tipoTit}*\n\n`;

        message += `🟢 *CANASTAS LLENAS: ${data.totalLlenas.toLocaleString()}*\n`;
        const llenasArr = Object.entries(data.llenasPorProducto || {})
            .filter(([pid, info]) => info.cantidad > 0)
            .sort((a, b) => b[1].cantidad - a[1].cantidad);
        if (llenasArr.length > 0) {
            llenasArr.forEach(([pid, info]) => {
                const pName = productos.find(p => p.id === pid)?.nombre || 'Producto Desconocido';
                message += `  • ${pName}: ${info.cantidad.toLocaleString()}\n`;
            });
        }
        message += `\n`;

        message += `⚠️ *DEUDA PRODUCTORES: ${data.totalDespProd.toLocaleString()}*\n`;
        const dProdArr = Object.entries(data.deudaProductor || {})
            .filter(([id, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        if (dProdArr.length > 0) {
            dProdArr.forEach(([uid, qty]) => {
                const uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || `Inactivo`);
                message += `  • ${uName}: ${qty.toLocaleString()}\n`;
            });
        }
        message += `\n`;

        message += `⚠️ *DEUDA CLIENTES: ${data.totalDespCli.toLocaleString()}*\n`;
        const dCliArr = Object.entries(data.deudaCliente || {})
            .filter(([id, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
        if (dCliArr.length > 0) {
            dCliArr.forEach(([uid, qty]) => {
                const uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || `Inactivo`);
                message += `  • ${uName}: ${qty.toLocaleString()}\n`;
            });
        }

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } catch (err) {
        console.error(err);
        window.UI.showToast("Error al generar mensaje", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
};

Charts.renderCanastasPorCobrar = function () {
    const select = document.getElementById('canastas-cobrar-productor');
    const balanceDisplay = document.getElementById('canastas-cobrar-balance');
    const tbody = document.getElementById('canastas-cobrar-tbody');

    if (!select || !balanceDisplay || !tbody) return;

    const productores = window.appStore.getProductores();

    // Solo poblar si está vacío o solo tiene la opción por defecto
    if (select.options.length <= 1) {
        let htmlP = '<option value="" disabled selected>-- Elija un productor --</option>';
        productores.forEach(p => {
            htmlP += `<option value="${p.id}">${p.nombre}</option>`;
        });
        select.innerHTML = htmlP;
        window.UI.makeSelectSearchable('canastas-cobrar-productor');
    }

    // Remover listener viejo si existe (clonando el nodo o creando una propiedad flag, pero un named function funciona mejor)
    // Para simplificar, lo registramos una vez y usamos appStore
    select.onchange = () => {
        const prodId = select.value;
        if (!prodId) return;

        const productor = productores.find(p => p.id === prodId);
        const deudaTotal = productor ? (productor.canastasPrestadas || 0) : 0;

        balanceDisplay.innerText = deudaTotal.toLocaleString();

        if (deudaTotal > 0) {
            balanceDisplay.classList.remove('text-success');
            balanceDisplay.classList.add('text-danger');
        } else {
            balanceDisplay.classList.remove('text-danger');
            balanceDisplay.classList.add('text-success');
        }

        const todasActividades = window.appStore.getActividad(30000);

        let historialProd = todasActividades.filter(a => {
            const payload = a.rawPayload || {};
            if (payload.productorId === prodId) return true;
            if (payload.productorOrigenId === prodId) return true;
            if (payload.productorDestinoId === prodId) return true;

            // Transacciones viejas o mal estructuradas pueden no tener prodId directo si no se usaba
            return false;
        });

        if (historialProd.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos.</td></tr>`;
            return;
        }

        const formatter = new Intl.NumberFormat('es-DO');
        let htmlTbody = '';

        historialProd.forEach(a => {
            const dateObj = new Date(a.date || a.fecha);
            const fechaStr = `${dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

            let impactHtml = '-';
            const payload = a.rawPayload || {};
            const mCantidad = parseInt(payload.cantidad || a.cantidad) || 0;

            if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho Canastas Vacías') {
                impactHtml = `<span class="text-danger font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (+ Deuda)</span>`;
            } else if (a.operacion === 'Recepción') {
                impactHtml = `<span class="text-success font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (- Deuda)</span>`;
            } else if (a.operacion === 'Devolución' && payload.tipoOrigen === 'productor') {
                impactHtml = `<span class="text-success font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (- Deuda)</span>`;
            } else if (a.operacion === 'Transf. Fincas') {
                if (payload.productorOrigenId === prodId) {
                    impactHtml = `<span class="text-danger font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (+ Deuda)</span>`;
                } else {
                    impactHtml = `<span class="text-success font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (- Deuda)</span>`;
                }
            } else {
                impactHtml = `<span class="text-text-muted font-mono">${formatter.format(mCantidad)} (N/A)</span>`;
            }

            htmlTbody += `
                <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm">
                    <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${fechaStr}</td>
                    <td class="py-2.5 px-4"><span class="bg-surface border border-border px-2 py-0.5 rounded text-xs font-semibold text-white">${a.operacion}</span></td>
                    <td class="py-2.5 px-4 text-white text-xs truncate max-w-xs" title="${a.detalle}">${a.detalle}</td>
                    <td class="py-2.5 px-4 text-right">${impactHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlTbody;
        if (window.lucide) window.lucide.createIcons({ root: tbody });
    };

    // Si había uno seleccionado por actualización, forzar update
    if (select.value) {
        select.onchange();
    }
};

window.appCharts = Charts;
