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
        // GLOBAL FORCE CLEANUP OF ALL CHART EMPTY STATES
        document.querySelectorAll('.empty-chart-message').forEach(el => el.remove());

        const ctx = document.getElementById('warehouseChart');
        if (!ctx) return;

        // Limpiar instancia previa y restaurar UI
        if (this.instances.warehouseChart) {
            this.instances.warehouseChart.destroy();
        }
        ctx.style.display = 'block';
        ctx.closest('.surface-card').querySelectorAll('.empty-chart-message').forEach(el => el.remove());

        const almacenes = window.appStore ? window.appStore.getAlmacenes() : [];
        const productos = window.appStore ? window.appStore.getProductos() : [];
        const invAlmacen = window.appStore ? window.appStore.getInventarioPorAlmacen() : {};

        console.log("=== DIAGNÓSTICO CHARTS ===");
        console.log("ALMACENES:", almacenes);
        console.log("PRODUCTOS:", productos);
        console.log("appStore loaded?", window.appStore?.isLoaded);

        if (almacenes.length === 0 || productos.length === 0) {
            console.error("Fallo renderWarehouseChart porque almacenes o productos están vacíos.");
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
        ctx.style.display = 'block';
        ctx.closest('.surface-card').querySelectorAll('.empty-chart-message').forEach(el => el.remove());

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

        const selectClientFilter = document.getElementById('filtro-cliente-despacho');
        if (selectClientFilter) {
            const clientes = window.appStore.getClientes();
            const currentOptionsCount = selectClientFilter.options.length - 1; // subtract "Todos"
            
            // Si la cantidad de clientes en el store no coincide con el dropdown, lo regeneramos
            if (clientes.length > 0 && currentOptionsCount !== clientes.length) {
                // Deshacer el wrapper si existe
                if (selectClientFilter.parentElement && selectClientFilter.parentElement.classList.contains('searchable-select-container')) {
                    const container = selectClientFilter.parentElement;
                    container.parentNode.insertBefore(selectClientFilter, container);
                    container.parentNode.removeChild(container);
                    selectClientFilter.style.display = '';
                }

                let htmlC = '<option value="todos" selected>Todos los Clientes</option>';
                clientes.forEach(c => {
                    htmlC += `<option value="${c.id}">${c.nombre}</option>`;
                });
                selectClientFilter.innerHTML = htmlC;

                if (window.UI && window.UI.makeSelectSearchable) {
                    window.UI.makeSelectSearchable('filtro-cliente-despacho');
                }
            }

            // Bind de evento una sola vez
            if (!selectClientFilter.dataset.bound) {
                selectClientFilter.addEventListener('change', () => {
                    const rangeA = this.getWeekRange(selectorA.value);
                    const rangeB = this.getWeekRange(selectorB.value);
                    this.renderWeeklyCharts(rangeA.start, rangeA.end);
                    this.renderComparisonChart(rangeA, rangeB, selectorA.value, selectorB.value);
                });
                selectClientFilter.dataset.bound = "true";
            }
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
        // No await required here as UI is mostly non-blocking, but good to have
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

    async calculateWeeklyBalances(startDate, endDate) {
        // 1. Obtener toda la actividad asegurando carga completa
        const allFullHistory = await window.appStore.loadFullActivity();
        
        // El state tiene una copia local que usamos para deduplicar
        const activityFromState = (window.appStore.data && window.appStore.data.actividad) ? window.appStore.data.actividad : [];
        
        const allMap = new Map();
        [...allFullHistory, ...activityFromState].forEach(a => {
            if (a.id) allMap.set(a.id, a);
        });
        
        const allActivity = Array.from(allMap.values());
        allActivity.sort((a, b) => {
            const logicalA = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const dateA = new Date(logicalA.slice(0, 10) + 'T12:00:00');
            const logicalB = b.fechaOperacion || (b.rawPayload && (b.rawPayload.fecha || b.rawPayload.fechaRecepcion || b.rawPayload.fechaDespacho || b.rawPayload.fechaTransferencia)) || b.date || new Date().toISOString();
            const dateB = new Date(logicalB.slice(0, 10) + 'T12:00:00');
            return dateA - dateB;
        });

        console.log(`[CÁLCULO v22] Procesando ${allActivity.length} registros totales.`);
        
        // AUDIT COUNTERS
        let auditAdded = 0;   // Compras, Reparaciones(+), Fruta Demás? (si no consume vacía)
        let auditRemoved = 0; // Bajas, Reparaciones(-)
        let auditRepairsPlus = 0;
        let auditRepairsMinus = 0;
        let auditPurchases = 0;
        let auditBajas = 0;

        // 2. Inicializar contadores en cero
        let llenas = 0;
        let vacias = 0;
        let despProd = 0;
        let despCli = 0;

        let vaciasPorAlm = {};
        let llenasPorProducto = {};
        let deudaProductor = {};
        let deudaCliente = {};

        let initialBalances = null;
        let finalBalances = null;

        const applyDebtDelta = (balances, id, delta, isProductor = true) => {
            if (!id) id = 'no-especificado';
            
            // ELIMINADO Math.max(0, ...) para el motor de cálculo del Dashboard.
            // Esto permite que el balance global se mantenga íntegro (14032).
            // Si alguien devuelve algo que debía antes de marzo, la deuda simplemente
            // se vuelve negativa temporalmente en el pasado para compensar.
            balances[id] = (balances[id] || 0) + delta;
            
            if (isProductor) {
                despProd = Object.values(deudaProductor).reduce((s, v) => s + v, 0);
            } else {
                despCli = Object.values(deudaCliente).reduce((s, v) => s + v, 0);
            }
        };
        
        const applyVaciasDelta = (balances, id, delta) => {
            if (!id) id = 'no-especificado';
            balances[id] = (balances[id] || 0) + delta;
        };
        const applyLlenasDelta = (balances, id, delta) => {
            if (!id) return;
            if (!balances[id]) balances[id] = { cantidad: 0 };
            balances[id].cantidad += delta;
        };

        const updateLlenasBreakdown = (payload = {}, qty = 0) => {
            if (payload.productoId || payload.productoIdActual || payload.productoIdNuevo) {
                const pid = payload.productoId || payload.productoIdActual || payload.productoIdNuevo;
                applyLlenasDelta(llenasPorProducto, pid, qty);
            } else if (payload.lotes) {
                payload.lotes.forEach(l => applyLlenasDelta(llenasPorProducto, l.productoId, l.cantidad));
            } else if (payload.detalles) {
                payload.detalles.forEach(d => applyLlenasDelta(llenasPorProducto, d.productoId, d.cantidad));
            }
        };

        // 3. Iterar sobre toda la actividad
        allActivity.forEach(a => {
            if (a.anulado) return;

            const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const date = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
            
            if (!initialBalances && date >= startDate) {
                initialBalances = {
                    totalLlenas: llenas, totalVacias: vacias, 
                    totalDespProd: despProd, totalDespCli: despCli,
                    llenasPorProducto: JSON.parse(JSON.stringify(llenasPorProducto)),
                    vaciasPorAlmacen: { ...vaciasPorAlm },
                    deudaProductor: { ...deudaProductor }, deudaCliente: { ...deudaCliente }
                };
            }

            const payload = a.rawPayload || {};
            const qtyStr = (a.cantidad || '0').toString();
            const match = qtyStr.match(/-?\d+/);
            const a_cantidad = match ? Math.abs(parseInt(match[0], 10)) : 0;

            const op = a.operacion;

            if (op === 'Recepción' || op === 'Recepción de Fruta') {
                llenas += a_cantidad;
                updateLlenasBreakdown(payload, a_cantidad);
                applyDebtDelta(deudaProductor, payload.productorId, -a_cantidad, true);
            } 
            else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente') {
                llenas -= a_cantidad;
                updateLlenasBreakdown(payload, -a_cantidad);
                applyDebtDelta(deudaCliente, payload.clienteId, a_cantidad, false);
            } 
            else if (op === 'Desp. Vacías' || op === 'Despacho de Vacías') {
                vacias -= a_cantidad;
                applyVaciasDelta(vaciasPorAlm, payload.almacenOrigenId, -a_cantidad);
                applyDebtDelta(deudaProductor, payload.productorId, a_cantidad, true);
            } 
            else if (op === 'Devolución' || op === 'Devolución de Canastas') {
                const isLlena = a.detalle && a.detalle.toLowerCase().includes('llena');
                const isProductor = (payload.tipoOrigen === 'productor');
                if (isLlena) {
                    llenas += a_cantidad;
                    updateLlenasBreakdown(payload, a_cantidad);
                } else {
                    vacias += a_cantidad;
                    applyVaciasDelta(vaciasPorAlm, payload.almacenDestinoId, a_cantidad);
                }
                if (isProductor) applyDebtDelta(deudaProductor, payload.productorId, -a_cantidad, true);
                else applyDebtDelta(deudaCliente, payload.clienteId, -a_cantidad, false);
            } 
            else if (op === 'Transf. Fincas' || op === 'Transferencia entre Fincas') {
                applyDebtDelta(deudaProductor, payload.productorOrigenId, -a_cantidad, true);
                applyDebtDelta(deudaProductor, payload.productorDestinoId, a_cantidad, true);
            } 
            else if (op === 'Compra' || op === 'Compra Canastas' || op === 'Compra de Canastas') {
                vacias += a_cantidad;
                applyVaciasDelta(vaciasPorAlm, payload.almacenDestinoId, a_cantidad);
                auditPurchases += a_cantidad;
                auditAdded += a_cantidad;
            } 
            else if (op === 'Decomiso' || op === 'Decomiso de Fruta') {
                llenas -= a_cantidad;
                vacias += a_cantidad;
                applyVaciasDelta(vaciasPorAlm, payload.almacenVaciasId, a_cantidad);
                updateLlenasBreakdown(payload, -a_cantidad);
            } 
            else if (op === 'Fruta Demás' || op === 'Canastas Demás' || op === 'Ingreso Fruta Demás') {
                llenas += a_cantidad;
                vacias -= a_cantidad;
                applyVaciasDelta(vaciasPorAlm, payload.almacenOrigenId, -a_cantidad);
                updateLlenasBreakdown(payload, a_cantidad);
            } 
            else if (op === 'Salida Canastas' || op === 'Baja de Canastas') {
                vacias -= a_cantidad;
                applyVaciasDelta(vaciasPorAlm, payload.almacenId, -a_cantidad);
                auditBajas += a_cantidad;
                auditRemoved += a_cantidad;
            } 
            else if (op === 'Reparación Sistema') {
                const isNeg = qtyStr.includes('-');
                const diff = isNeg ? -Math.abs(a_cantidad) : Math.abs(a_cantidad);
                llenas += diff;
                applyLlenasDelta(llenasPorProducto, payload.productoId, diff);
                if (diff > 0) {
                    auditRepairsPlus += diff;
                    auditAdded += diff;
                } else {
                    auditRepairsMinus += Math.abs(diff);
                    auditRemoved += Math.abs(diff);
                }
            } 
            else if (op === 'Transferencia entre Almacenes') {
                const cantLlenas = payload ? (parseInt(payload.cantidad) || 0) : 0;
                const cantVacias = payload ? (parseInt(payload.canastasVacias) || 0) : 0;
                if (cantLlenas > 0) {
                    applyLlenasDelta(llenasPorProducto, payload.productoIdActual, -cantLlenas);
                    applyLlenasDelta(llenasPorProducto, payload.productoIdNuevo, cantLlenas);
                }
                if (cantVacias > 0) {
                    applyVaciasDelta(vaciasPorAlm, payload.almacenOrigenId, -cantVacias);
                    applyVaciasDelta(vaciasPorAlm, payload.almacenDestinoVaciasId, cantVacias);
                }
            }

            if (!finalBalances && date > endDate) {
                finalBalances = {
                    totalLlenas: llenas, totalVacias: vacias, 
                    totalDespProd: despProd, totalDespCli: despCli,
                    llenasPorProducto: JSON.parse(JSON.stringify(llenasPorProducto)),
                    vaciasPorAlmacen: { ...vaciasPorAlm },
                    deudaProductor: { ...deudaProductor }, deudaCliente: { ...deudaCliente }
                };
            }
        });

        // 4. Fallbacks y Auditoría
        const totalCalculado = llenas + vacias + despProd + despCli;
        console.log(`[AUDITORÍA v22] Total Global Final: ${totalCalculado} (Baskets)`);
        console.log(`[AUDITORÍA v22] Compras: +${auditPurchases}, Reparaciones(+): +${auditRepairsPlus}, Bajas: -${auditBajas}, Reparaciones(-): -${auditRepairsMinus}`);
        console.log(`[AUDITORÍA v22] Neto Creado: ${auditAdded - auditRemoved}`);
        
        if (totalCalculado !== 14032) {
            console.warn(`[AUDITORÍA v22] DISCREPANCIA: El sistema dice tener ${totalCalculado} pero el usuario espera 14032. Diferencia: ${totalCalculado - 14032}`);
        }

        if (!initialBalances) {
            initialBalances = {
                totalLlenas: llenas, totalVacias: vacias, 
                totalDespProd: despProd, totalDespCli: despCli,
                llenasPorProducto: JSON.parse(JSON.stringify(llenasPorProducto)),
                vaciasPorAlmacen: { ...vaciasPorAlm },
                deudaProductor: { ...deudaProductor }, deudaCliente: { ...deudaCliente }
            };
        }
        if (!finalBalances) {
            finalBalances = {
                totalLlenas: llenas, totalVacias: vacias, 
                totalDespProd: despProd, totalDespCli: despCli,
                llenasPorProducto: JSON.parse(JSON.stringify(llenasPorProducto)),
                vaciasPorAlmacen: { ...vaciasPorAlm },
                deudaProductor: { ...deudaProductor }, deudaCliente: { ...deudaCliente }
            };
        }

        // 5. Actualizar DOM
        const renderVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = Math.max(0, val).toLocaleString();
        };

        renderVal('sem-inicial-llenas', initialBalances.totalLlenas);
        renderVal('sem-inicial-vacias', initialBalances.totalVacias);
        renderVal('sem-inicial-desp-prod', initialBalances.totalDespProd);
        renderVal('sem-inicial-desp-cli', initialBalances.totalDespCli);
        renderVal('sem-inicial-total', initialBalances.totalLlenas + initialBalances.totalVacias + initialBalances.totalDespProd + initialBalances.totalDespCli);
        const stLabel = document.querySelector('h1.text-2xl');
        if (stLabel) stLabel.innerText = "Dashboard Semanal (v23)";

        renderVal('sem-final-llenas', finalBalances.totalLlenas);
        renderVal('sem-final-vacias', finalBalances.totalVacias);
        renderVal('sem-final-desp-prod', finalBalances.totalDespProd);
        renderVal('sem-final-desp-cli', finalBalances.totalDespCli);
        renderVal('sem-final-total', finalBalances.totalLlenas + finalBalances.totalVacias + finalBalances.totalDespProd + finalBalances.totalDespCli);

        // Exportar para modales de detalles
        this._lastWeeklyBalances = { inicial: initialBalances, final: finalBalances };
    },

    async renderWeeklyCharts(startDate, endDate) {
        // Aseguramos que el cálculo de balances (que actualiza los totales) termine primero
        await this.calculateWeeklyBalances(startDate, endDate);

        const txContainer = document.getElementById('sem-despacho-diario-container');
        if (!txContainer) return;
        txContainer.innerHTML = '';

        // Usamos la información cargada en el almacén (que ya es profunda si se llamó a calculateWeeklyBalances)
        const allActivity = window.appStore.actividadCache;
        const duringWeek = allActivity.filter(a => {
            const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const d = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
            return d >= startDate && d <= endDate;
        });

        const productos = window.appStore.getProductos();
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

        const txDataByDay = {}; // Estructura: { 'YYYY-MM-DD': { dateObj: Date, total: 0, prods: { prodId: qty } } }

        const filtroClienteSelect = document.getElementById('filtro-cliente-despacho');
        const selectedClienteId = filtroClienteSelect ? filtroClienteSelect.value : 'todos';
        const selectedClienteNombre = (filtroClienteSelect && selectedClienteId !== 'todos') ? filtroClienteSelect.options[filtroClienteSelect.selectedIndex].text : null;

        let totalTx = 0;

        duringWeek.forEach(a => {
            if (a.anulado || a.eliminado) return;
            const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const dateObj = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
            const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

            if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                if (selectedClienteId !== 'todos') {
                    const actClienteId = a.rawPayload?.clienteId || a.clienteId || null;
                    const actClienteNombre = a.rawPayload?.clienteNombre || a.clienteNombre || null;
                    let matchC = (actClienteId === selectedClienteId) || (actClienteNombre && actClienteNombre === selectedClienteNombre);
                    
                    if (!matchC && a.detalle) {
                        if (!a.detalle.includes(`cliente: ${selectedClienteNombre}`) && !a.detalle.includes(`Cliente: ${selectedClienteNombre}`)) {
                            return; // Skip
                        }
                    } else if (!matchC) {
                        return; // Skip
                    }
                }
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
            } else if ((a.operacion === 'Devolución' || a.operacion === 'Devolución de Canastas') && a.detalle && a.detalle.includes('Llenas')) {
                // Si es devolución de llenas de cliente, restarlo del despacho diario
                let foundProdId = null;
                let foundQty = 0;
                let isCliente = false;

                if (a.rawPayload) {
                    if (a.rawPayload.tipoOrigen === 'cliente' && a.rawPayload.productoId) {
                        isCliente = true;
                        
                        if (selectedClienteId !== 'todos') {
                            const actClienteId = a.rawPayload.clienteId || null;
                            const actClienteNombre = a.rawPayload.clienteNombre || null;
                            if (actClienteId !== selectedClienteId && actClienteNombre !== selectedClienteNombre) {
                                isCliente = false; // Doesn't match filter
                            }
                        }

                        if (isCliente) {
                            foundProdId = a.rawPayload.productoId;
                            foundQty = parseInt(a.rawPayload.cantidad) || 0;
                        }
                    }
                } else if (a.detalle && a.detalle.includes('De Cliente')) {
                    isCliente = true;
                    
                    if (selectedClienteId !== 'todos') {
                        if (!a.detalle.includes(`Cliente: ${selectedClienteNombre}`) && !a.detalle.includes(selectedClienteNombre)) {
                            isCliente = false; // Doesn't match filter
                        }
                    }
                    
                    if (isCliente) {
                        // Intenta extraer el nombre del producto "Llenas de PRODUCTO)"
                        const match = a.detalle.match(/Llenas de (.*?)\)/);
                        if (match) {
                            const prodName = match[1].trim();
                            const foundProd = productos.find(p => p.nombre.toLowerCase() === prodName.toLowerCase());
                            if (foundProd) {
                                foundProdId = foundProd.id;
                                const qtyMatch = String(a.cantidad || '').match(/\d+/);
                                foundQty = qtyMatch ? parseInt(qtyMatch[0], 10) : 0;
                            }
                        }
                    }
                }

                if (isCliente && foundProdId && foundQty > 0) {
                    if (!txDataByDay[dayKey]) {
                        txDataByDay[dayKey] = {
                            dateObj: dateObj,
                            total: 0,
                            prods: {}
                        };
                    }

                    txDataByDay[dayKey].prods[foundProdId] = (txDataByDay[dayKey].prods[foundProdId] || 0) - foundQty;
                    txDataByDay[dayKey].total -= foundQty;
                    totalTx -= foundQty;
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
                    if (dayData.prods[p.id] !== 0 && dayData.prods[p.id] !== undefined) {
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
                        <span>PRODUCTOS</span>
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

        const filtroClienteSelect = document.getElementById('filtro-cliente-despacho');
        const selectedClienteId = filtroClienteSelect ? filtroClienteSelect.value : 'todos';
        const selectedClienteNombre = (filtroClienteSelect && selectedClienteId !== 'todos') ? filtroClienteSelect.options[filtroClienteSelect.selectedIndex].text : null;

        allActivity.forEach(a => {
            if (a.anulado || a.eliminado) return;
            const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const d = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
            
            if (d >= startDate && d <= endDate) {
                if (a.operacion === 'Desp. Cliente' || a.operacion === 'Despacho a Cliente') {
                    if (selectedClienteId !== 'todos') {
                        const actClienteId = a.rawPayload?.clienteId || a.clienteId || null;
                        const actClienteNombre = a.rawPayload?.clienteNombre || a.clienteNombre || null;
                        let matchC = (actClienteId === selectedClienteId) || (actClienteNombre && actClienteNombre === selectedClienteNombre);
                        
                        if (!matchC && a.detalle) {
                            if (!a.detalle.includes(`cliente: ${selectedClienteNombre}`) && !a.detalle.includes(`Cliente: ${selectedClienteNombre}`)) {
                                return; // Skip
                            }
                        } else if (!matchC) {
                            return; // Skip
                        }
                    }

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
                } else if ((a.operacion === 'Devolución' || a.operacion === 'Devolución de Canastas') && a.detalle && a.detalle.includes('Llenas')) {
                    let isCliente = false;
                    let foundProdId = null;
                    let foundQty = 0;

                    if (a.rawPayload) {
                        if (a.rawPayload.tipoOrigen === 'cliente' && a.rawPayload.productoId) {
                            isCliente = true;
                            
                            if (selectedClienteId !== 'todos') {
                                const actClienteId = a.rawPayload.clienteId || null;
                                const actClienteNombre = a.rawPayload.clienteNombre || null;
                                if (actClienteId !== selectedClienteId && actClienteNombre !== selectedClienteNombre) {
                                    isCliente = false;
                                }
                            }

                            if (isCliente) {
                                foundProdId = a.rawPayload.productoId;
                                foundQty = parseInt(a.rawPayload.cantidad) || 0;
                            }
                        }
                    } else if (a.detalle && a.detalle.includes('De Cliente')) {
                        isCliente = true;
                        
                        if (selectedClienteId !== 'todos') {
                            if (!a.detalle.includes(`Cliente: ${selectedClienteNombre}`) && !a.detalle.includes(selectedClienteNombre)) {
                                isCliente = false;
                            }
                        }
                        
                        if (isCliente) {
                            const match = a.detalle.match(/Llenas de (.*?)\)/);
                            if (match) {
                                const prodName = match[1].trim();
                                const foundProd = productos.find(p => p.nombre.toLowerCase() === prodName.toLowerCase());
                                if (foundProd) {
                                    foundProdId = foundProd.id;
                                    const qtyMatch = String(a.cantidad || '').match(/\d+/);
                                    foundQty = qtyMatch ? parseInt(qtyMatch[0], 10) : 0;
                                }
                            }
                        }
                    }

                    if (isCliente && foundProdId && foundQty > 0) {
                        totals[foundProdId] = (totals[foundProdId] || 0) - foundQty;
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

        if (almacenes.length > 0 && selAlmacen.options.length !== almacenes.length + 1) {
            const valA = selAlmacen.value;
            let htmlA = '<option value="">-- Seleccionar Almacén --</option>';
            almacenes.forEach(a => htmlA += `<option value="${a.id}">${a.nombre}</option>`);
            selAlmacen.innerHTML = htmlA;
            if (valA) selAlmacen.value = valA;
        }

        if (productos.length > 0 && selProducto.options.length !== productos.length + 1) {
            const valP = selProducto.value;
            let htmlP = '<option value="">-- Todos --</option>';
            productos.forEach(p => htmlP += `<option value="${p.id}">${p.nombre}</option>`);
            selProducto.innerHTML = htmlP;
            if (valP) selProducto.value = valP;
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
                    if (!targetProductoId || payload.productoId === targetProductoId) sumCantLlenas -= parseInt(payload.cantidad) || 0;
                }
                if (payload.almacenVaciasId === targetAlmacenId) {
                    if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                }
                isNegative = false;
                matched = true;
            } else if (a.operacion === 'Fruta Demás' || a.operacion === 'Canastas Demás' || a.operacion === 'Ingreso Fruta Demás') {
                if (payload.almacenOrigenId === targetAlmacenId) {
                    if (!targetProductoId || targetProductoId === 'vacias') sumCantVacias -= parseInt(payload.cantidad) || 0;
                }
                if (payload.almacenDestinoId === targetAlmacenId) {
                    if (!targetProductoId || payload.productoId === targetProductoId) sumCantLlenas += parseInt(payload.cantidad) || 0;
                }
                isNegative = false;
                matched = true;
            } else if (a.operacion === 'Salida Canastas' || a.operacion === 'Salida de Canastas' || a.operacion === 'Baja de Canastas') {
                isNegative = true;
                impactaVaciasDirecto = true;
                if (payload.almacenId === targetAlmacenId) sumCantVacias += parseInt(payload.cantidad) || 0;
                matched = true;
            } else if (a.operacion === 'Transf. Interna' || a.operacion === 'Transferencia entre Almacenes') {
                if (payload.almacenOrigenId === targetAlmacenId) {
                    if (!targetProductoId || payload.productoIdActual === targetProductoId) {
                        if (payload.productoIdActual === 'vacias') sumCantVacias -= parseInt(payload.cantidad) || 0;
                        else sumCantLlenas -= parseInt(payload.cantidad) || 0;
                    }
                }
                if (payload.almacenDestinoId === targetAlmacenId) {
                    if (!targetProductoId || payload.productoIdNuevo === targetProductoId) {
                        if (payload.productoIdNuevo === 'vacias') sumCantVacias += parseInt(payload.cantidad) || 0;
                        else sumCantLlenas += parseInt(payload.cantidad) || 0;
                    }
                }
                // Handle vacias explícitas movidas
                if (payload.almacenOrigenId === targetAlmacenId && payload.canastasVacias > 0) {
                    if (!targetProductoId || targetProductoId === 'vacias') {
                        sumCantVacias -= parseInt(payload.canastasVacias) || 0;
                    }
                }
                if (payload.almacenDestinoVaciasId === targetAlmacenId && payload.canastasVacias > 0) {
                    if (!targetProductoId || targetProductoId === 'vacias') {
                        sumCantVacias += parseInt(payload.canastasVacias) || 0;
                    }
                }
                isNegative = false;
                matched = true;
            } else if (a.operacion === 'Reparación Sistema' || a.operacion === 'Auditoría' || a.operacion === 'Ajuste de Inventario') {
                if (payload.balanceNuevo && payload.balanceAnterior) {
                    const cantNueva = payload.balanceNuevo[targetAlmacenId] || 0;
                    const cantAnterior = payload.balanceAnterior[targetAlmacenId] || 0;
                    if (!targetProductoId || payload.productoId === targetProductoId) {
                        const delta = cantNueva - cantAnterior;
                        if (delta < 0) {
                            isNegative = true;
                            sumCantLlenas += Math.abs(delta);
                        } else {
                            isNegative = false;
                            sumCantLlenas += delta;
                        }
                    }
                }
                matched = true;
            }

            return matched ? {
                llenas: (isNegative ? -sumCantLlenas : sumCantLlenas),
                vacias: (isNegative ? -sumCantVacias : sumCantVacias)
            } : { llenas: 0, vacias: 0 };
        };

        setTimeout(async () => {
            try {
                // Fetch virtually all transaction history safely
                const allFullHistory = await window.appStore.loadFullActivity();
                const activityFromState = (window.appStore.data && window.appStore.data.actividad) ? window.appStore.data.actividad : [];
                
                const allMap = new Map();
                [...allFullHistory, ...activityFromState].forEach(a => { if (a.id) allMap.set(a.id, a); });
                
                const todas = Array.from(allMap.values());
                todas.sort((a, b) => {
            const logicalA = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const dateA = new Date(logicalA.slice(0, 10) + 'T12:00:00');
            const logicalB = b.fechaOperacion || (b.rawPayload && (b.rawPayload.fecha || b.rawPayload.fechaRecepcion || b.rawPayload.fechaDespacho || b.rawPayload.fechaTransferencia)) || b.date || new Date().toISOString();
            const dateB = new Date(logicalB.slice(0, 10) + 'T12:00:00');
            return dateA - dateB;
        });

                const start = new Date(desdeVal + 'T00:00:00');
                const end = new Date(hastaVal + 'T23:59:59.999');

                const almacenes = window.appStore.getAlmacenes();
                const almacen = almacenes.find(x => x.id === almacenId);
                const nombreAlm = almacen ? almacen.nombre : '';

                const productos = window.appStore.getProductos();
                const producto = productos.find(x => x.id === productoId);
                const nombreProd = producto ? producto.nombre : '';

                // --- NUEVA LÓGICA FORWARD ---
                let runningLlenas = 0;
                let runningVacias = 0;
                let balanceInicialLlenas = 0;
                let balanceInicialVacias = 0;
                const rows = [];

                // --- OPTIMIZATION: BÚSQUEDA DE SNAPSHOT ---
                // Iteramos en reversa desde el índice antes de la fecha de inicio para buscar un snapshot base.
                let startIndex = 0;
                let foundSnapshot = false;

                // Primero, encontramos dónde empieza el rango de fecha
                let startIndexRange = 0;
                for (let i = 0; i < todas.length; i++) {
                    const a = todas[i];
                    if (a.anulado || a.eliminado) continue;
                    const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
                    const dt = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
                    if (dt >= start) {
                        startIndexRange = i;
                        break;
                    }
                }
                
                // Si el rango empieza después del último, o no se encontró, será la longitud total
                if (startIndexRange === 0 && todas.length > 0 && new Date((todas[todas.length-1].fechaOperacion || todas[todas.length-1].date).slice(0, 10) + 'T12:00:00') < start) {
                    startIndexRange = todas.length;
                }

                // Buscamos un snapshot válido antes de startIndexRange
                // SE HA DESACTIVADO LA BÚSQUEDA DE SNAPSHOT PARA GARANTIZAR 
                // QUE EL REPORTE SIEMPRE CUADRE CON EL BALANCE REAL (currentRealLlenas)
                /*
                for (let i = startIndexRange - 1; i >= 0; i--) {
                    const a = todas[i];
                    if (a.anulado || a.eliminado) continue;
                    if (a.balanceSnapshot && a.balanceSnapshot[almacenId]) {
                        const snap = a.balanceSnapshot[almacenId];
                        if (!productoId) {
                            runningLlenas = Object.keys(snap).filter(k => k !== 'vacias').reduce((sum, k) => sum + (parseFloat(snap[k]) || 0), 0);
                        } else {
                            runningLlenas = (parseFloat(snap[productoId]) || 0);
                        }
                        runningVacias = (parseFloat(snap['vacias']) || 0);
                        
                        balanceInicialLlenas = runningLlenas;
                        balanceInicialVacias = runningVacias;
                        
                        startIndex = i + 1; // Comenzamos a calcular desde la SIGUIENTE actividad al snapshot
                        foundSnapshot = true;
                        break;
                    }
                }
                */

                // Si no encontramos un snapshot, calculamos hacia atrás desde el balance real actual!
                // Esto garantiza que el reporte cuadre perfectamente con la existencia real, 
                // incluso si hubo ediciones manuales en la base de datos o fallas en el historial.
                if (!foundSnapshot) {
                    let currentRealLlenas = 0;
                    let currentRealVacias = 0;
                    
                    if (window.appStore.data && window.appStore.data.inventario && window.appStore.data.inventario.porAlmacen) {
                        const invAlm = window.appStore.data.inventario.porAlmacen[almacenId];
                        if (invAlm) {
                            if (!productoId) {
                                currentRealLlenas = Object.keys(invAlm).filter(k => k !== 'vacias').reduce((sum, k) => sum + (parseFloat(invAlm[k]) || 0), 0);
                            } else {
                                currentRealLlenas = parseFloat(invAlm[productoId]) || 0;
                            }
                            currentRealVacias = parseFloat(invAlm['vacias']) || 0;
                        }
                    }

                    runningLlenas = currentRealLlenas;
                    runningVacias = currentRealVacias;

                    // Restamos todas las actividades que ocurrieron desde el inicio del rango hasta hoy
                    for (let i = todas.length - 1; i >= startIndexRange; i--) {
                        const a = todas[i];
                        if (a.anulado || a.eliminado) continue;
                        const imp = calcularImpactoActividad(a, almacenId, productoId);
                        runningLlenas -= imp.llenas;
                        runningVacias -= imp.vacias;
                    }
                    
                    balanceInicialLlenas = runningLlenas;
                    balanceInicialVacias = runningVacias;
                    startIndex = startIndexRange;
                } else {
                    // Si encontramos el snapshot, calculamos los deltas que faltan entre el snapshot y el inicio del rango
                    for (let i = startIndex; i < startIndexRange; i++) {
                        const a = todas[i];
                        if (a.anulado || a.eliminado) continue;
                        const imp = calcularImpactoActividad(a, almacenId, productoId);
                        runningLlenas += imp.llenas;
                        runningVacias += imp.vacias;
                    }
                    balanceInicialLlenas = runningLlenas;
                    balanceInicialVacias = runningVacias;
                    startIndex = startIndexRange;
                }

                // Ahora procesamos solo los que están DENTRO del rango
                for (let i = startIndex; i < todas.length; i++) {
                    const a = todas[i];
                    if (a.anulado || a.eliminado) continue;
                    
                    const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
                    const dt = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
                    
                    // Si es después del rango, paramos
                    if (dt > end) break;

                    const imp = calcularImpactoActividad(a, almacenId, productoId);

                    // Siempre acumulamos matemáticamente (sumar 0 no afecta)
                    runningLlenas += imp.llenas;
                    runningVacias += imp.vacias;

                    // Lógica de visualización (filtro visual)
                    // Si el usuario eligió un producto específico, ignoramos los movimientos puramente de canastas vacías
                    const renderRow = productoId ? (imp.llenas !== 0) : (imp.llenas !== 0 || imp.vacias !== 0);

                    if (renderRow) {
                        const fechaStr = `${dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
                        
                        let descCantidad = [];
                        if (imp.llenas !== 0) {
                            const lColor = imp.llenas < 0 ? 'text-danger' : 'text-success';
                            descCantidad.push(`<span class="${lColor}">${imp.llenas > 0 ? '+' : ''}${imp.llenas} ll</span>`);
                        }
                        if (imp.vacias !== 0) {
                            const vColor = imp.vacias < 0 ? 'text-danger' : 'text-success';
                            descCantidad.push(`<span class="${vColor}">${imp.vacias > 0 ? '+' : ''}${imp.vacias} vc</span>`);
                        }
                        const cantHtml = descCantidad.join(' | ');

                        const balLColor = runningLlenas >= 0 ? 'text-success' : 'text-danger';
                        const balVColor = runningVacias >= 0 ? 'text-success' : 'text-danger';

                        rows.push(`
                            <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                                <td class="py-2.5 px-4 text-text-secondary whitespace-nowrap">${fechaStr}</td>
                                <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || '-'}</td>
                                <td class="py-2.5 px-4 font-medium text-white">${a.operacion}</td>
                                <td class="py-2.5 px-4 text-text-secondary italic text-xs leading-tight" title="${a.detalle}">${a.detalle}</td>
                                <td class="py-2.5 px-4 text-right font-bold whitespace-nowrap text-xs">${cantHtml}</td>
                                <td class="py-2.5 px-4 text-right whitespace-nowrap"><span class="font-bold font-mono ${balLColor}">${runningLlenas.toLocaleString()}</span></td>
                                <td class="py-2.5 px-4 text-right whitespace-nowrap"><span class="font-bold font-mono ${balVColor}">${runningVacias.toLocaleString()}</span></td>
                            </tr>
                        `);
                    }
                }

                if (rows.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-text-secondary italic">No se encontraron movimientos específicos para los filtros seleccionados.</td></tr>`;
                } else {
                    tbody.innerHTML = rows.reverse().join('');
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
    const aggregatedDProd = {};
    Object.entries(data.deudaProductor || {}).forEach(([uid, qty]) => {
        let uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || uid);
        let key = uName.trim().toUpperCase();
        if (!aggregatedDProd[key]) {
            aggregatedDProd[key] = { name: uName.trim(), qty: 0 };
        }
        aggregatedDProd[key].qty += qty;
    });

    const dProdArr = Object.values(aggregatedDProd)
        .filter(item => item.qty !== 0)
        .sort((a, b) => b.qty - a.qty); // Sort by highest debt first

    if (dProdArr.length > 0) {
        dProdArr.forEach(item => {
            const uName = item.name;
            const qty = item.qty;
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
    
    const aggregatedDCli = {};
    Object.entries(data.deudaCliente || {}).forEach(([uid, qty]) => {
        let uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || uid);
        let key = uName.trim().toUpperCase();
        if (!aggregatedDCli[key]) {
            aggregatedDCli[key] = { name: uName.trim(), qty: 0 };
        }
        aggregatedDCli[key].qty += qty;
    });

    const dCliArr = Object.values(aggregatedDCli)
        .filter(item => item.qty !== 0)
        .sort((a, b) => b.qty - a.qty);

    if (dCliArr.length > 0) {
        dCliArr.forEach(item => {
            const uName = item.name;
            const qty = item.qty;
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
        const aggregatedDProd = {};
        Object.entries(data.deudaProductor || {}).forEach(([uid, qty]) => {
            let uName = uid === 'no-especificado' ? 'S/N' : (productores.find(p => p.id === uid)?.nombre || uid);
            let key = uName.trim().toUpperCase();
            if (!aggregatedDProd[key]) {
                aggregatedDProd[key] = { name: uName.trim(), qty: 0 };
            }
            aggregatedDProd[key].qty += qty;
        });

        const dProdArr = Object.values(aggregatedDProd)
            .filter(item => item.qty !== 0)
            .sort((a, b) => b.qty - a.qty);

        if (dProdArr.length > 0) {
            dProdArr.forEach(item => {
                message += `  • ${item.name}: ${item.qty.toLocaleString()}\n`;
            });
        }
        message += `\n`;

        message += `⚠️ *DEUDA CLIENTES: ${data.totalDespCli.toLocaleString()}*\n`;
        const aggregatedDCli = {};
        Object.entries(data.deudaCliente || {}).forEach(([uid, qty]) => {
            let uName = uid === 'no-especificado' ? 'S/N' : (clientes.find(c => c.id === uid)?.nombre || uid);
            let key = uName.trim().toUpperCase();
            if (!aggregatedDCli[key]) {
                aggregatedDCli[key] = { name: uName.trim(), qty: 0 };
            }
            aggregatedDCli[key].qty += qty;
        });

        const dCliArr = Object.values(aggregatedDCli)
            .filter(item => item.qty !== 0)
            .sort((a, b) => b.qty - a.qty);

        if (dCliArr.length > 0) {
            dCliArr.forEach(item => {
                message += `  • ${item.name}: ${item.qty.toLocaleString()}\n`;
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
    const cargarMovimientos = async (usarFiltroFecha) => {
        const prodId = select.value;
        if (!prodId) return;

        const productor = productores.find(p => p.id === prodId);
        const nombreProd = productor ? productor.nombre : '';
        
        // 1. Cargar historial completo
        const allFullHistory = await window.appStore.loadFullActivity();
        const activityFromState = (window.appStore.data && window.appStore.data.actividad) ? window.appStore.data.actividad : [];
        const allMap = new Map();
        [...allFullHistory, ...activityFromState].forEach(a => { if (a.id) allMap.set(a.id, a); });
        const todasActividades = Array.from(allMap.values());
        todasActividades.sort((a, b) => {
            const logicalA = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const dateA = new Date(logicalA.slice(0, 10) + 'T12:00:00');
            const logicalB = b.fechaOperacion || (b.rawPayload && (b.rawPayload.fecha || b.rawPayload.fechaRecepcion || b.rawPayload.fechaDespacho || b.rawPayload.fechaTransferencia)) || b.date || new Date().toISOString();
            const dateB = new Date(logicalB.slice(0, 10) + 'T12:00:00');
            return dateA - dateB;
        });

        // --- LÓGICA FORWARD PARA DEUDA ---
        let runningDebt = 0;
        const balancePorId = {};
        const rangeRows = [];

        const start = (usarFiltroFecha && inputDesde.value) ? new Date(inputDesde.value + 'T00:00:00') : null;
        const end = (usarFiltroFecha && inputHasta.value) ? new Date(inputHasta.value + 'T23:59:59.999') : null;

        todasActividades.forEach(a => {
            if (a.anulado || a.eliminado) return;

            const payload = a.rawPayload || {};
            let match = payload.productorId === prodId || payload.productorOrigenId === prodId || payload.productorDestinoId === prodId;
            if (!match && nombreProd) match = a.detalle && a.detalle.toLowerCase().includes(nombreProd.toLowerCase());
            
            if (!match) return;
            if (a.operacion === 'Catálogos' || a.operacion === 'Auditoría' || a.operacion === 'Inicio de Sesión') return;

            const mCantidad = parseInt(payload.cantidad || a.cantidad) || 0;
            const op = a.operacion;
            let delta = 0;

            if (op === 'Desp. Vacías' || op === 'Despacho Canastas Vacías' || op === 'Despacho de Vacías') delta = mCantidad;
            else if (op === 'Recepción' || op === 'Recepción de Fruta') delta = -mCantidad;
            else if (op === 'Devolución' || op === 'Devolución de Canastas' || op === 'Recepción Canastas') {
                if (payload.tipoOrigen === 'productor' || (a.detalle && a.detalle.toLowerCase().includes('productor:'))) delta = -mCantidad;
            }
            else if (op === 'Transf. Fincas' || op === 'Transferencia de Fincas' || op === 'Transferencia entre Fincas') {
                if (payload.productorOrigenId === prodId) delta = -mCantidad;
                else delta = mCantidad;
            }

            runningDebt += delta;
            balancePorId[a.id] = runningDebt;

            const logicalDateStr = a.fechaOperacion || (a.rawPayload && (a.rawPayload.fecha || a.rawPayload.fechaRecepcion || a.rawPayload.fechaDespacho || a.rawPayload.fechaTransferencia)) || a.date || new Date().toISOString();
            const dt = new Date(logicalDateStr.slice(0, 10) + 'T12:00:00');
            const isInRange = (!start || dt >= start) && (!end || dt <= end);
            if (isInRange) {
                rangeRows.push({ a, delta, balance: runningDebt, dt });
            }
        });

        // Actualizar el balance actual en el UI (el real final acumulado)
        balanceDisplay.innerText = runningDebt.toLocaleString();
        if (runningDebt > 0) {
            balanceDisplay.classList.remove('text-success');
            balanceDisplay.classList.add('text-danger');
        } else {
            balanceDisplay.classList.remove('text-danger');
            balanceDisplay.classList.add('text-success');
        }

        if (rangeRows.length === 0) {
            const msg = usarFiltroFecha ? 'No se encontraron movimientos en el rango de fechas.' : 'No se encontraron movimientos.';
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-text-secondary italic">${msg}</td></tr>`;
            return;
        }

        const formatter = new Intl.NumberFormat('es-DO');
        let htmlTbody = '';

        // Mostrar de más reciente a más antiguo
        [...rangeRows].reverse().forEach(({ a, delta, balance, dt }) => {
            const fechaStr = `${dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
            let impactHtml = '';

            if (delta > 0) impactHtml = `<span class="text-danger font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> ${formatter.format(delta)} (+ Deuda)</span>`;
            else if (delta < 0) impactHtml = `<span class="text-success font-bold uppercase text-xs flex items-center justify-end gap-1"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> ${formatter.format(Math.abs(delta))} (- Deuda)</span>`;
            else impactHtml = `<span class="text-text-muted font-mono">0 (N/A)</span>`;

            const balColor = balance > 0 ? 'text-danger' : (balance < 0 ? 'text-success' : 'text-text-muted');
            const balanceHtml = `<span class="font-bold font-mono ${balColor}">${formatter.format(balance)}</span>`;

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

            const opText = row.cells[1].innerText.trim().toLowerCase();
            const impactoText = row.cells[3].innerText.trim();
            const balanceText = row.cells[4].innerText.trim();

            // El formato de la vista web utiliza es-DO (separador de miles con coma, decimal con punto).
            // Ej: "1,000 (+ DEUDA)"
            // 1. Removemos TODAS las comas (separadores de miles).
            // 2. Removemos cualquier caracter que no sea número, punto (decimal) o signo negativo.
            const cleanImpacto = impactoText.replace(/,/g, '').replace(/[^\d.-]/g, '');
            const cleanBalance = balanceText.replace(/,/g, '').replace(/[^\d.-]/g, '');

            let impactoNum = parseFloat(cleanImpacto) || 0;
            const balanceNum = parseFloat(cleanBalance) || 0;

            // Fuerte comprobación para negativos:
            // Todo lo que sea "Recepción" reduce la deuda del productor (él nos entrega fruta)
            // También si el texto indica explícitamente "(- Deuda)"
            const isNegative = impactoText.includes('(-') || impactoText.toLowerCase().includes('(- deuda)') || opText.includes('recepci');
            
            if (isNegative) {
                impactoNum = -Math.abs(impactoNum);
            } else {
                impactoNum = Math.abs(impactoNum);
            }

            data.push([
                row.cells[0].innerText.trim(),
                row.cells[1].innerText.trim(),
                row.cells[2].innerText.trim(),
                { v: impactoNum, t: 'n', z: '#,##0' },
                { v: balanceNum, t: 'n', z: '#,##0' }
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

            // El formato de la vista web utiliza es-DO (separador de miles con coma, decimal con punto).
            const cleanCant = cantText.replace(/,/g, '').replace(/[^\d.-]/g, '');
            const cleanBalance = balanceText.replace(/,/g, '').replace(/[^\d.-]/g, '');

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
