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
        const selectorA = document.getElementById('sem-semana-selector');
        const selectorB = document.getElementById('sem-semana-selector-b');
        if (!selectorA || !selectorB) return;

        // Init values if empty
        if (!selectorA.value) {
            selectorA.value = this.getCurrentWeekString();
        }
        if (!selectorB.value) {
            selectorB.value = this.getPreviousWeekString(selectorA.value);
        }

        // Add event listeners if not already present
        if (!selectorA.dataset.bound) {
            selectorA.addEventListener('change', () => this.renderWeeklyDashboard());
            selectorA.dataset.bound = "true";
        }
        if (!selectorB.dataset.bound) {
            selectorB.addEventListener('change', () => this.renderWeeklyDashboard());
            selectorB.dataset.bound = "true";
        }

        const weekA = selectorA.value;
        const weekB = selectorB.value;

        // Labels UI
        const labelA = document.getElementById('label-semana-a');
        const labelB = document.getElementById('label-semana-b');
        if (labelA) labelA.innerText = `Semana ${weekA.split('-W')[1]} (${weekA.split('-W')[0]})`;
        if (labelB) labelB.innerText = `Semana ${weekB.split('-W')[1]} (${weekB.split('-W')[0]})`;

        const rangeA = this.getWeekRange(weekA);
        const rangeB = this.getWeekRange(weekB);

        // Los balances semanales y tablas diarias se basan primordialmente en la Semana A (la principal)
        this.calculateWeeklyBalances(rangeA.start, rangeA.end);
        this.renderWeeklyCharts(rangeA.start, rangeA.end);

        // El Gráfico comparativo usa ambas
        this.renderComparisonChart(rangeA, rangeB, weekA, weekB);

        this.renderCanastasPorCobrar();
    },

    getPreviousWeekString(weekStr) {
        const [yearStr, weekNumStr] = weekStr.split('-W');
        let year = parseInt(yearStr, 10);
        let week = parseInt(weekNumStr, 10);

        if (week > 1) {
            week--;
        } else {
            year--;
            // Buscar la última semana del año anterior
            const d = new Date(year, 11, 28);
            week = this.getISOWeek(d);
        }
        return `${year}-W${String(week).padStart(2, '0')}`;
    },

    getISOWeek(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
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
            if (a.operacion === 'Recepción' || a.operacion === 'Recepción de Fruta') {
                currentLlenas -= a_cantidad;
                currentDespProd += a_cantidad; // Recepción decrementó deuda productor, revertir: sumar
                updateLlenasBreakdown(payload, a_cantidad, true);
                applyDebtDelta(currentDeudaProductor, payload.productorId, a_cantidad);
            } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                currentLlenas += a_cantidad;
                currentDespCli -= a_cantidad; // Despacho cliente aumentó su deuda, revertir: restar
                updateLlenasBreakdown(payload, a_cantidad, false);
                applyDebtDelta(currentDeudaCliente, payload.clienteId, -a_cantidad);
            } else if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho de Vacías') {
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
            } else if (a.operacion === 'Transf. Fincas' || a.operacion === 'Transferencia entre Fincas') {
                applyDebtDelta(currentDeudaProductor, payload.productorOrigenId, a_cantidad);
                applyDebtDelta(currentDeudaProductor, payload.productorDestinoId, -a_cantidad);
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas' || a.operacion === 'Compra de Canastas') {
                currentVacias -= a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Decomiso' || a.operacion === 'Decomiso de Fruta') {
                currentLlenas += a_cantidad;
                currentVacias -= a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenVaciasId, -a_cantidad);
                updateLlenasBreakdown(payload, a_cantidad, false);
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                currentLlenas -= a_cantidad;
                currentVacias += a_cantidad;
                applyVaciasDelta(currentVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                updateLlenasBreakdown(payload, a_cantidad, true);
            } else if (a.operacion === 'Salida Canastas' || a.operacion === 'Baja de Canastas') {
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
            } else if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho de Vacías') {
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
            } else if (a.operacion === 'Transf. Fincas' || a.operacion === 'Transferencia entre Fincas') {
                applyDebtDelta(initialDeudaProductor, payload.productorOrigenId, a_cantidad);
                applyDebtDelta(initialDeudaProductor, payload.productorDestinoId, -a_cantidad);
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas' || a.operacion === 'Compra de Canastas') {
                initialVacias -= a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenDestinoId, -a_cantidad);
            } else if (a.operacion === 'Decomiso' || a.operacion === 'Decomiso de Fruta') {
                initialLlenas += a_cantidad;
                initialVacias -= a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenVaciasId, -a_cantidad);
                updateInitialLlenasBreakdown(payload, a_cantidad, false);
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás') {
                initialLlenas -= a_cantidad;
                initialVacias += a_cantidad;
                applyVaciasDelta(initialVaciasPorAlm, payload.almacenOrigenId, a_cantidad);
                updateInitialLlenasBreakdown(payload, a_cantidad, true);
            } else if (a.operacion === 'Salida Canastas' || a.operacion === 'Baja de Canastas') {
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
                // Use local date for dayKey to avoid UTC midnight rollover shifting e.g. Friday → Saturday
                const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

                if (!txDataByDay[dayKey]) {
                    txDataByDay[dayKey] = {
                        dateObj: dateObj,
                        total: 0,
                        prods: {}
                    };
                }

                if (a.rawPayload) {
                    const items = a.rawPayload.detalles || a.rawPayload.lotes || [];
                    let addedAnyProd = false;
                    items.forEach(lote => {
                        if (!lote.productoId) return; // skip nulls — will try detalle fallback below
                        const cant = parseInt(lote.cantidad) || 0;
                        txDataByDay[dayKey].prods[lote.productoId] = (txDataByDay[dayKey].prods[lote.productoId] || 0) + cant;
                        txDataByDay[dayKey].total += cant;
                        totalTx += cant;
                        addedAnyProd = true;
                    });

                    // Si ningún item tenía productoId (rawPayload reparado sin info de producto),
                    // intentar extraer nombres de frutas del campo detalle
                    if (!addedAnyProd && a.detalle && a.detalle.includes('|')) {
                        const parts = a.detalle.split('|');
                        if (parts.length > 1) {
                            parts[1].trim().split(',').forEach(item => {
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

    getDispatchDataForPeriod(startDate, endDate) {
        const allActivity = window.appStore.getActividad(20000);
        const productos = window.appStore.getProductos();
        const totals = {};

        allActivity.forEach(a => {
            if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                const d = new Date(a.date || a.fecha);
                if (d >= startDate && d <= endDate) {
                    if (a.rawPayload) {
                        const items = a.rawPayload.detalles || a.rawPayload.lotes || [];
                        let addedAnyProd = false;
                        items.forEach(lote => {
                            if (lote.productoId) {
                                totals[lote.productoId] = (totals[lote.productoId] || 0) + (parseInt(lote.cantidad) || 0);
                                addedAnyProd = true;
                            }
                        });

                        if (!addedAnyProd && a.detalle && a.detalle.includes('|')) {
                            this._parseDetailToTotals(a.detalle, productos, totals);
                        }
                    } else if (a.detalle && a.detalle.includes('|')) {
                        this._parseDetailToTotals(a.detalle, productos, totals);
                    }
                }
            }
        });
        return totals;
    },

    _parseDetailToTotals(detalle, productos, totals) {
        const parts = detalle.split('|');
        if (parts.length > 1) {
            parts[1].trim().split(',').forEach(item => {
                const match = item.match(/(.+?)\s*\((\d+)\)/);
                if (match) {
                    const prodName = match[1].trim();
                    const qty = parseInt(match[2], 10);
                    const foundProd = productos.find(p => p.nombre.toLowerCase() === prodName.toLowerCase());
                    if (foundProd) {
                        totals[foundProd.id] = (totals[foundProd.id] || 0) + qty;
                    }
                }
            });
        }
    },

    renderComparisonChart(rangeA, rangeB, weekA, weekB) {
        const ctx = document.getElementById('comparisonWeeklyChart');
        if (!ctx) return;

        if (this.instances.comparisonChart) {
            this.instances.comparisonChart.destroy();
        }

        const dataA = this.getDispatchDataForPeriod(rangeA.start, rangeA.end);
        const dataB = this.getDispatchDataForPeriod(rangeB.start, rangeB.end);

        const productos = window.appStore.getProductos();

        const activeProds = productos.filter(p => (dataA[p.id] || 0) > 0 || (dataB[p.id] || 0) > 0);

        if (activeProds.length === 0) {
            this.showEmptyState(ctx, 'No hay despachos registrados para comparar en estas semanas.');
            return;
        }

        activeProds.sort((a, b) => {
            const totalA = (dataA[a.id] || 0) + (dataB[a.id] || 0);
            const totalB = (dataA[b.id] || 0) + (dataB[b.id] || 0);
            return totalB - totalA;
        });

        const labels = activeProds.map(p => p.nombre.toUpperCase());
        const datasetA = activeProds.map(p => dataA[p.id] || 0);
        const datasetB = activeProds.map(p => dataB[p.id] || 0);

        const colorA = '#3b82f6';
        const colorB = '#f59e0b';

        this.instances.comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Semana ${weekA.split('-W')[1]}`,
                        data: datasetA,
                        backgroundColor: colorA,
                        borderRadius: 4,
                        borderSkipped: false,
                        barPercentage: 0.8,
                        categoryPercentage: 0.7
                    },
                    {
                        label: `Semana ${weekB.split('-W')[1]}`,
                        data: datasetB,
                        backgroundColor: colorB,
                        borderRadius: 4,
                        borderSkipped: false,
                        barPercentage: 0.8,
                        categoryPercentage: 0.7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            font: { weight: '600', size: 10 },
                            maxRotation: 0,
                            minRotation: 0,
                            padding: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(161, 161, 170, 0.1)', drawBorder: false },
                        ticks: {
                            font: { size: 11 },
                            callback: value => value.toLocaleString()
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#18181b',
                        titleColor: '#fff',
                        bodyColor: '#cbcbcb',
                        borderColor: '#27272a',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()} canastas`;
                            }
                        }
                    }
                }
            }
        });

        ctx.style.display = 'block';
        const emptyMsg = ctx.parentElement.querySelector('.empty-chart-message');
        if (emptyMsg) emptyMsg.remove();
    },

    shareWhatsAppDay(isoDateStr, txDataByDay, diasSemana, formatter) {
        const d = new Date(isoDateStr);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

        // Helper interno para calcular el impacto (delta) de una actividad en el balance del almacén/producto
        const calcularImpactoActividad = (a, targetAlmacenId, targetProductoId) => {
            const payload = a.rawPayload || {};
            let sumCantLlenas = 0;
            let sumCantVacias = 0;
            let isNegative = false;
            let matched = false;
            let impactaVaciasDirecto = false; // Flag to force counting as Vacias

            const checkLotesOrDetalles = () => {
                let foundMatch = false;
                if (payload.lotes) {
                    payload.lotes.forEach(l => {
                        if (l.almacenId === targetAlmacenId || l.almacenDestinoId === targetAlmacenId) {
                            if (!targetProductoId || l.productoId === targetProductoId) {
                                if (l.productoId === 'vacias') sumCantVacias += parseInt(l.cantidad) || 0;
                                else sumCantLlenas += parseInt(l.cantidad) || 0;
                                foundMatch = true;
                            }
                        }
                    });
                }
                if (payload.detalles) {
                    payload.detalles.forEach(d => {
                        if (d.almacenOrigenId === targetAlmacenId || d.almacenId === targetAlmacenId || d.almacenDestinoId === targetAlmacenId) {
                            if (!targetProductoId || d.productoId === targetProductoId) {
                                if (d.productoId === 'vacias') sumCantVacias += parseInt(d.cantidad) || 0;
                                else sumCantLlenas += parseInt(d.cantidad) || 0;
                                foundMatch = true;
                            }
                        }
                    });
                }

                // Fallback for flat payloads
                if (!foundMatch) {
                    if (payload.almacenDestinoId === targetAlmacenId || payload.almacenId === targetAlmacenId || payload.almacenOrigenId === targetAlmacenId) {
                        if (!targetProductoId || payload.productoId === targetProductoId || payload.productoIdActual === targetProductoId || payload.productoIdNuevo === targetProductoId) {
                            const pId = payload.productoId || payload.productoIdActual || payload.productoIdNuevo;
                            if (pId === 'vacias' || impactaVaciasDirecto) sumCantVacias += parseInt(payload.cantidad || a.cantidad) || 0;
                            else sumCantLlenas += parseInt(payload.cantidad || a.cantidad) || 0;
                        }
                    }
                }
            };

            if (a.operacion === 'Recepción' || a.operacion === 'Recepción de Fruta') {
                isNegative = false;
                checkLotesOrDetalles();
                matched = true;
            } else if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho de Vacías') {
                isNegative = true;
                impactaVaciasDirecto = true;
                if (payload.almacenOrigenId === targetAlmacenId) {
                    if (!targetProductoId || targetProductoId === 'vacias') {
                        sumCantVacias += parseInt(payload.cantidad) || 0;
                    }
                }
                matched = true;
            } else if (a.operacion === 'Devolución' || a.operacion === 'Devolución de Canastas') {
                isNegative = false;
                if (payload.almacenDestinoId === targetAlmacenId) {
                    if (a.detalle && a.detalle.toLowerCase().includes('vacías')) {
                        if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                    } else {
                        if (!targetProductoId || payload.productoId === targetProductoId) sumCantLlenas += parseInt(payload.cantidad) || 0;
                    }
                }
                matched = true;
            } else if (a.operacion === 'Compra' || a.operacion === 'Compra Canastas' || a.operacion === 'Compra de Canastas') {
                isNegative = false;
                impactaVaciasDirecto = true;
                if (payload.almacenDestinoId === targetAlmacenId) {
                    if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                }
                matched = true;
            } else if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                isNegative = true;
                checkLotesOrDetalles();
                matched = true;
            } else if (a.operacion === 'Decomiso' || a.operacion === 'Decomiso de Fruta') {
                if (payload.almacenOrigenId === targetAlmacenId) {
                    isNegative = true;
                    if (!targetProductoId || payload.productoId === targetProductoId) sumCantLlenas += parseInt(payload.cantidad) || 0;
                } else if (payload.almacenVaciasId === targetAlmacenId) {
                    isNegative = false;
                    impactaVaciasDirecto = true;
                    if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                }
                matched = true;
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás' || a.operacion === 'Ingreso Fruta Demás') {
                if (payload.almacenOrigenId === targetAlmacenId) {
                    isNegative = true;
                    impactaVaciasDirecto = true;
                    if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                } else if (payload.almacenDestinoId === targetAlmacenId) {
                    isNegative = false;
                    if (!targetProductoId || payload.productoId === targetProductoId) sumCantLlenas += parseInt(payload.cantidad) || 0;
                }
                matched = true;
            } else if (a.operacion === 'Salida Canastas' || a.operacion === 'Salida de Canastas' || a.operacion === 'Baja de Canastas') {
                isNegative = true;
                impactaVaciasDirecto = true;
                if (payload.almacenId === targetAlmacenId) sumCantVacias += parseInt(payload.cantidad) || 0;
                matched = true;
            } else if (a.operacion === 'Transf. Interna' || a.operacion === 'Transferencia entre Almacenes') {
                if (payload.almacenOrigenId === targetAlmacenId) {
                    isNegative = true;
                    if (!targetProductoId || payload.productoIdActual === targetProductoId) {
                        if (payload.productoIdActual === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                        else sumCantLlenas += parseInt(payload.cantidad) || 0;
                    }
                } else if (payload.almacenDestinoId === targetAlmacenId) {
                    isNegative = false;
                    if (!targetProductoId || payload.productoIdNuevo === targetProductoId) {
                        if (payload.productoIdNuevo === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                        else sumCantLlenas += parseInt(payload.cantidad) || 0;
                    }
                }
                // Handle vacias destination in Transferencia entre Almacenes
                if (payload.almacenDestinoVaciasId === targetAlmacenId) {
                    isNegative = false;
                    impactaVaciasDirecto = true; // We are receiving vacias here
                    if (!targetProductoId || targetProductoId === 'vacias') {
                        sumCantVacias += parseInt(payload.canastasVacias) || 0; // Transf uses canastasVacias field
                    }
                }
                // If it was origen and there were canastasVacias explicitly moved, handled?
                // In store.js, Transferencia entre Almacenes moves 'cantidad' of product AND 'canastasVacias' empty baskets from origen.
                if (payload.almacenOrigenId === targetAlmacenId && payload.canastasVacias > 0) {
                    if (!targetProductoId || targetProductoId === 'vacias') {
                        sumCantVacias += parseInt(payload.canastasVacias) || 0;
                    }
                }
                matched = true;
            }

            return matched ? {
                llenas: (isNegative ? -sumCantLlenas : sumCantLlenas),
                vacias: (isNegative ? -sumCantVacias : sumCantVacias)
            } : { llenas: 0, vacias: 0 };
        };

        setTimeout(() => {
            try {
                // Fetch virtually all transaction history safely (cap at 20,000 to be safe on memory)
                const todas = window.appStore.getActividad(30000);
                const start = new Date(desdeVal + 'T00:00:00');
                const end = new Date(hastaVal + 'T23:59:59.999');

                const almacenes = window.appStore.getAlmacenes();
                const almacen = almacenes.find(x => x.id === almacenId);
                const nombreAlm = almacen ? almacen.nombre : '';

                const productos = window.appStore.getProductos();
                const producto = productos.find(x => x.id === productoId);
                const nombreProd = producto ? producto.nombre : '';

                const filtradas = todas.filter(a => {
                    // Normalize date
                    let dt = new Date(a.date);
                    if (isNaN(dt.getTime()) && a.fecha) dt = new Date(a.fecha);

                    if (dt < start || dt > end) return false;

                    const payload = a.rawPayload || {};

                    // Desp. Cliente: always include if it has rawPayload — the render
                    // loop will show only items matching the selected warehouse.
                    if ((a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') && a.rawPayload) {
                        // Still apply the product filter if active
                        if (productoId) {
                            if (!payload.detalles || !Array.isArray(payload.detalles)) return true; // show without product filter
                            return payload.detalles.some(d => d.productoId === productoId);
                        }
                        return true;
                    }

                    let afectoAlmacen = false;

                    // Direct checks
                    if (payload.almacenOrigenId === almacenId || payload.almacenDestinoId === almacenId || payload.almacenId === almacenId || payload.almacenVaciasId === almacenId) {
                        afectoAlmacen = true;
                    }

                    // Fallback para datos antiguos (Búsqueda por texto en detalle)
                    if (!afectoAlmacen && nombreAlm && a.detalle && a.detalle.toLowerCase().includes(nombreAlm.toLowerCase())) {
                        afectoAlmacen = true;
                    }

                    // Deep checks in arrays (lotes - Recepción uses this)
                    if (!afectoAlmacen && payload.lotes && Array.isArray(payload.lotes)) {
                        if (payload.lotes.some(l => l.almacenId === almacenId || l.almacenDestinoId === almacenId)) afectoAlmacen = true;
                    }

                    // Deep checks in arrays (detalles - other ops)
                    if (!afectoAlmacen && payload.detalles && Array.isArray(payload.detalles)) {
                        if (payload.detalles.some(d =>
                            d.almacenOrigenId === almacenId ||
                            d.almacenId === almacenId ||
                            d.almacenDestinoId === almacenId
                        )) afectoAlmacen = true;
                    }

                    if (!afectoAlmacen) return false;

                    // Product filter (optional)
                    if (productoId) {
                        let afectoProducto = false;
                        if (payload.productoId === productoId || payload.productoIdActual === productoId || payload.productoIdNuevo === productoId) {
                            afectoProducto = true;
                        }

                        // Fallback para producto en texto
                        if (!afectoProducto && nombreProd && a.detalle && a.detalle.toLowerCase().includes(nombreProd.toLowerCase())) {
                            afectoProducto = true;
                        }

                        if (!afectoProducto && payload.lotes && Array.isArray(payload.lotes)) {
                            if (payload.lotes.some(l => l.productoId === productoId && (l.almacenId === almacenId || l.almacenDestinoId === almacenId))) afectoProducto = true;
                        }
                        if (!afectoProducto && payload.detalles && Array.isArray(payload.detalles)) {
                            if (payload.detalles.some(d => d.productoId === productoId && (d.almacenOrigenId === almacenId || d.almacenId === almacenId || d.almacenDestinoId === almacenId))) afectoProducto = true;
                        }
                        return afectoProducto;
                    }

                    return true;
                });

                filtradas.sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha));

                if (filtradas.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos específicos para los filtros seleccionados.</td></tr>`;
                } else {
                    // --- CÁLCULO DEL BALANCE INICIAL (STARTING BALANCE) ---
                    // Estrategia: Balance Inicial = Balance Actual - Suma de Deltas(Desde START hasta HOY)

                    const invPorAlm = window.appStore.getInventarioPorAlmacen();
                    let balanceActualLlenas = 0;
                    let balanceActualVacias = 0;

                    if (invPorAlm[almacenId]) {
                        if (productoId) {
                            if (productoId === 'vacias') {
                                balanceActualVacias = invPorAlm[almacenId]['vacias'] || 0;
                            } else {
                                balanceActualLlenas = invPorAlm[almacenId][productoId] || 0;
                            }
                        } else {
                            // Sumar todas
                            Object.entries(invPorAlm[almacenId]).forEach(([pid, val]) => {
                                if (pid === 'vacias') balanceActualVacias += (parseInt(val) || 0);
                                else balanceActualLlenas += (parseInt(val) || 0);
                            });
                        }
                    }

                    // Calcular suma de movimientos desde la fecha de inicio del reporte hasta hoy
                    const actividadesDesdeStart = todas.filter(a => {
                        let dt = new Date(a.date);
                        if (isNaN(dt.getTime()) && a.fecha) dt = new Date(a.fecha);
                        return dt >= start;
                    });

                    let deltaTotalDesdeStartLlenas = 0;
                    let deltaTotalDesdeStartVacias = 0;

                    actividadesDesdeStart.forEach(a => {
                        const imp = calcularImpactoActividad(a, almacenId, productoId);
                        deltaTotalDesdeStartLlenas += imp.llenas;
                        deltaTotalDesdeStartVacias += imp.vacias;
                    });

                    // El balance con el que inicia el primer registro del reporte
                    let balAcumLlenas = balanceActualLlenas - deltaTotalDesdeStartLlenas;
                    let balAcumVacias = balanceActualVacias - deltaTotalDesdeStartVacias;

                    // Procesar de más antiguo a más reciente para calcular balance inline.
                    const filtAscendente = [...filtradas].reverse();
                    const rows = [];

                    filtAscendente.forEach(a => {
                        const dateObj = new Date(a.date || a.fecha);
                        const fechaStr = `${dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

                        const imp = calcularImpactoActividad(a, almacenId, productoId);

                        // Si hay filtro de producto y el delta es 0, verificar si realmente la actividad tiene que ver
                        if (productoId && imp.llenas === 0 && imp.vacias === 0) {
                            // Podría ser una actividad del almacén pero de otro producto. 
                            return;
                        }

                        balAcumLlenas += imp.llenas;
                        balAcumVacias += imp.vacias;

                        let descCantidad = [];
                        if (imp.llenas !== 0) {
                            const lColor = imp.llenas < 0 ? 'text-danger' : 'text-success';
                            descCantidad.push(`<span class="${lColor}">${imp.llenas > 0 ? '+' : ''}${imp.llenas} ll</span>`);
                        }
                        if (imp.vacias !== 0) {
                            const vColor = imp.vacias < 0 ? 'text-danger' : 'text-success';
                            descCantidad.push(`<span class="${vColor}">${imp.vacias > 0 ? '+' : ''}${imp.vacias} vc</span>`);
                        }
                        if (descCantidad.length === 0) descCantidad.push('0');

                        const cantHtml = descCantidad.join(' | ');

                        const balLColor = balAcumLlenas >= 0 ? 'text-success' : 'text-danger';
                        const balLHtml = `<span class="font-bold font-mono ${balLColor}">${balAcumLlenas.toLocaleString()}</span>`;

                        const balVColor = balAcumVacias >= 0 ? 'text-success' : 'text-danger';
                        const balVHtml = `<span class="font-bold font-mono ${balVColor}">${balAcumVacias.toLocaleString()}</span>`;

                        rows.push(`
                        <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                            <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${fechaStr}</td>
                            <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || '-'}</td>
                            <td class="py-2.5 px-4 font-medium text-white">${a.operacion}</td>
                            <td class="py-2.5 px-4 text-text-secondary italic text-xs leading-tight" title="${a.detalle}">${a.detalle}</td>
                            <td class="py-2.5 px-4 text-right font-bold whitespace-nowrap text-xs">${cantHtml}</td>
                            <td class="py-2.5 px-4 text-right whitespace-nowrap">${balLHtml}</td>
                            <td class="py-2.5 px-4 text-right whitespace-nowrap">${balVHtml}</td>
                        </tr>
                        `);
                    });


                    // Mostrar de más reciente a más antiguo (invertir el array)
                    const html = rows.reverse().join('');

                    if (html === '') {
                        tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos específicos de ese producto en este almacén para el rango actual.</td></tr>`;
                    } else {
                        tbody.innerHTML = html;
                    }
                }
            } catch (err) {
                console.error(err);
                tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-danger">Error al cargar datos. Reporte al soporte.</td></tr>`;
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
    const btnBuscar = document.getElementById('btn-canastas-cobrar-buscar');
    const btnLimpiar = document.getElementById('btn-canastas-cobrar-limpiar');
    const inputDesde = document.getElementById('canastas-cobrar-desde');
    const inputHasta = document.getElementById('canastas-cobrar-hasta');

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

    // Pre-llenar fechas con el mes actual si están vacías
    if (inputDesde && !inputDesde.value) {
        const hoy = new Date();
        const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
        const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10);
        inputDesde.value = primerDia;
        inputHasta.value = ultimoDia;
    }

    // Función principal que llena la tabla de movimientos
    const cargarMovimientos = (usarFiltroFecha) => {
        const prodId = select.value;
        if (!prodId) return;

        const productor = productores.find(p => p.id === prodId);
        const nombreProd = productor ? productor.nombre : '';
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
            let involucraProductor = payload.productorId === prodId ||
                payload.productorOrigenId === prodId ||
                payload.productorDestinoId === prodId;

            // Fallback para datos antiguos sin rawPayload completo
            if (!involucraProductor && nombreProd) {
                involucraProductor = a.detalle && a.detalle.toLowerCase().includes(nombreProd.toLowerCase());
            }

            if (!involucraProductor) return false;

            // Aplicar filtro de fecha si fue solicitado
            if (usarFiltroFecha && inputDesde && inputHasta && inputDesde.value && inputHasta.value) {
                const start = new Date(inputDesde.value + 'T00:00:00');
                const end = new Date(inputHasta.value + 'T23:59:59.999');
                const dt = new Date(a.date || a.fecha);
                if (dt < start || dt > end) return false;
            }

            return true;
        });

        // Ordenar por fecha más reciente primero
        historialProd.sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha));

        if (historialProd.length === 0) {
            const msg = usarFiltroFecha && inputDesde.value
                ? 'No se encontraron movimientos en el rango de fechas seleccionado.'
                : 'No se encontraron movimientos.';
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-text-secondary italic">${msg}</td></tr>`;
            return;
        }

        // --- NUEVA LÓGICA DE BALANCE ANCLADO (Backwards calculation) ---
        // 1. Obtener TODO el historial sin filtros para calcular el balance real exacto
        const historialCompletoCalculo = todasActividades.filter(a => {
            const payload = a.rawPayload || {};
            let involucraP = payload.productorId === prodId ||
                payload.productorOrigenId === prodId ||
                payload.productorDestinoId === prodId;

            if (!involucraP && nombreProd) {
                involucraP = a.detalle && a.detalle.toLowerCase().includes(nombreProd.toLowerCase());
            }

            return involucraP;
        }).sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha)); // Del más nuevo al más antiguo

        let balanceMovil = deudaTotal;
        const balancePorId = {};

        historialCompletoCalculo.forEach(a => {
            // Guardamos el balance QUE HABÍA después de este movimiento
            balancePorId[a.id] = balanceMovil;

            const payload = a.rawPayload || {};
            const mCantidad = parseInt(payload.cantidad || a.cantidad) || 0;

            // Como vamos hacia atrás en el tiempo, revertimos el efecto de la operación
            if (a.operacion === 'Desp. Vacías' || a.operacion === 'Despacho Canastas Vacías') {
                balanceMovil -= mCantidad; // En el pasado había menos deuda
            } else if (a.operacion === 'Recepción') {
                balanceMovil += mCantidad; // En el pasado había más deuda
            } else if (a.operacion === 'Devolución' && payload.tipoOrigen === 'productor') {
                balanceMovil += mCantidad; // En el pasado había más deuda
            } else if (a.operacion === 'Transf. Fincas') {
                if (payload.productorOrigenId === prodId) {
                    balanceMovil += mCantidad; // Era origen: soltó deuda, antes tenía más
                } else {
                    balanceMovil -= mCantidad; // Era destino: ganó deuda, antes tenía menos
                }
            }
        });

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
                    impactHtml = `<span class="text-success font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (- Deuda)</span>`;
                } else {
                    impactHtml = `<span class="text-danger font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> ${formatter.format(mCantidad)} (+ Deuda)</span>`;
                }
            } else {
                impactHtml = `<span class="text-text-muted font-mono">${formatter.format(mCantidad)} (N/A)</span>`;
            }

            const balFila = balancePorId[a.id] ?? 0;
            const balColor = balFila > 0 ? 'text-danger' : (balFila < 0 ? 'text-success' : 'text-text-muted');
            const balanceHtml = `<span class="font-bold font-mono ${balColor}">${formatter.format(balFila)}</span>`;

            htmlTbody += `
                <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm">
                    <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${fechaStr}</td>
                    <td class="py-2.5 px-4"><span class="bg-surface border border-border px-2 py-0.5 rounded text-xs font-semibold text-white">${a.operacion}</span></td>
                    <td class="py-2.5 px-4 text-white text-xs truncate max-w-xs" title="${a.detalle}">${a.detalle}</td>
                    <td class="py-2.5 px-4 text-right">${impactHtml}</td>
                    <td class="py-2.5 px-4 text-right">${balanceHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlTbody;
        if (window.lucide) window.lucide.createIcons({ root: tbody });
    };

    // Cambio de productor: auto-carga con filtro de fecha activo si hay fechas
    select.onchange = () => {
        const tieneFecha = inputDesde && inputDesde.value && inputHasta && inputHasta.value;
        cargarMovimientos(tieneFecha);
    };

    // Botón Consultar (con filtro de fecha)
    if (btnBuscar) {
        btnBuscar.onclick = () => {
            if (!select.value) {
                window.UI.showToast('Seleccione un productor primero.', 'warning');
                return;
            }
            if (!inputDesde.value || !inputHasta.value) {
                window.UI.showToast('Ingrese un rango de fechas válido.', 'warning');
                return;
            }
            cargarMovimientos(true);
        };
    }

    // Botón Todo (sin filtro de fecha)
    if (btnLimpiar) {
        btnLimpiar.onclick = () => {
            if (!select.value) {
                window.UI.showToast('Seleccione un productor primero.', 'warning');
                return;
            }
            cargarMovimientos(false);
        };
    }

    // Si había uno seleccionado por actualización, forzar update
    if (select.value) {
        const tieneFecha = inputDesde && inputDesde.value && inputHasta && inputHasta.value;
        cargarMovimientos(tieneFecha);
    }
};

window.exportCanastasCobrarToExcel = function () {
    try {
        if (typeof XLSX === 'undefined') {
            window.UI.showToast("La librería de Excel no ha cargado. Verifique su conexión.", "error");
            return;
        }

        const tbody = document.getElementById('canastas-cobrar-tbody');
        const select = document.getElementById('canastas-cobrar-productor');
        const producerName = select.options[select.selectedIndex]?.text || 'Productor';

        if (!tbody || tbody.rows.length === 0 || tbody.innerText.includes('Seleccione') || tbody.innerText.includes('No se encontraron')) {
            window.UI.showToast("No hay datos para exportar.", "warning");
            return;
        }

        const data = [];
        // Headers
        data.push(["Fecha", "Operación", "Detalle", "Impacto", "Balance"]);

        for (let i = 0; i < tbody.rows.length; i++) {
            const row = tbody.rows[i];
            if (row.cells.length < 5) continue;

            const impactoText = row.cells[3].innerText.trim();
            const balanceText = row.cells[4].innerText.trim();

            // Robust parsing for Spanish formatting (Thousands: dot, Decimals: comma)
            // 1. Remove dots (thousands)
            // 2. Replace comma with dot (decimal)
            // 3. Remove non-numeric chars except minus sign and decimal dot
            const cleanImpacto = impactoText.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
            const cleanBalance = balanceText.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');

            let impactoNum = parseFloat(cleanImpacto) || 0;
            const balanceNum = parseFloat(cleanBalance) || 0;

            // Apply negative sign for debt increases if requested
            // if texto contains "(+ Deuda)" -> Negative
            if (impactoText.includes('(+ Deuda)')) {
                impactoNum = -Math.abs(impactoNum);
            } else {
                impactoNum = Math.abs(impactoNum);
            }

            data.push([
                row.cells[0].innerText.trim(),
                row.cells[1].innerText.trim(),
                row.cells[2].innerText.trim(),
                { v: impactoNum, t: 'n' },
                { v: balanceNum, t: 'n' }
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Canastas por Cobrar");

        // Auto-size columns
        ws['!cols'] = data[0].map((_, i) => ({ wch: Math.max(15, i === 2 ? 40 : 15) }));

        const fileName = `Canastas_Cobrar_${producerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        window.UI.showToast("Excel generado correctamente", "success");
    } catch (err) {
        console.error("Error exporting to Excel:", err);
        window.UI.showToast("Error al exportar: " + err.message, "error");
    }
};

window.exportReporteInventarioToExcel = function () {
    try {
        if (typeof XLSX === 'undefined') {
            window.UI.showToast("La librería de Excel no ha cargado. Verifique su conexión.", "error");
            return;
        }

        const tbody = document.getElementById('rep-inv-tbody');
        const selAlmacen = document.getElementById('rep-inv-almacen');
        const almacenNombre = selAlmacen.options[selAlmacen.selectedIndex]?.text || 'Almacen';

        if (!tbody || tbody.rows.length === 0 || tbody.innerText.includes('Seleccione') || tbody.innerText.includes('No se encontraron')) {
            window.UI.showToast("No hay datos para exportar.", "warning");
            return;
        }

        const data = [];
        // Headers
        data.push(["Fecha y Hora", "Doc #", "Operación", "Detalle", "Cantidad", "Balance"]);

        for (let i = 0; i < tbody.rows.length; i++) {
            const row = tbody.rows[i];
            if (row.cells.length < 6) continue;

            const cantText = row.cells[4].innerText.trim();
            const balanceText = row.cells[5].innerText.trim();

            // Robust parsing for Spanish formatting (Thousands: dot, Decimals: comma)
            const cleanCant = cantText.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
            const cleanBalance = balanceText.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');

            let cantNum = parseFloat(cleanCant) || 0;
            const balanceNum = parseFloat(cleanBalance) || 0;

            // "en el archivo de excel que me salga en negativo las transacciones que aumenten la deuda"
            // Deuda aumenta si el texto dice "(+ Deuda)"
            if (cantText.includes('(+ Deuda)')) {
                cantNum = -Math.abs(cantNum);
            } else if (cantText.includes('(- Deuda)')) {
                cantNum = Math.abs(cantNum);
            }

            data.push([
                row.cells[0].innerText.trim(),
                row.cells[1].innerText.trim(),
                row.cells[2].innerText.trim(),
                row.cells[3].innerText.trim(),
                { v: cantNum, t: 'n' },
                { v: balanceNum, t: 'n' }
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movimientos Inventario");

        // Auto-size columns
        ws['!cols'] = data[0].map((_, i) => ({ wch: Math.max(15, (i === 3) ? 50 : 15) }));

        const fileName = `Movimientos_${almacenNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        window.UI.showToast("Excel generado correctamente", "success");
    } catch (err) {
        console.error("Error exporting to Excel:", err);
        window.UI.showToast("Error al exportar: " + err.message, "error");
    }
};

window.appCharts = Charts;
