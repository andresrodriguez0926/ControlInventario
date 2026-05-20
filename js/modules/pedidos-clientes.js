/**
 * Módulo de Pedidos de Clientes y Reporte de Cumplimiento
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

// Helpers (global object to hold state/methods for this module)
window.PedidosClientesController = {
    populateSelects: function () {
        const clientes = window.appStore.getClientes();
        
        const selCliente = document.getElementById('pedido-cliente');
        const selCumpCliente = document.getElementById('cumplimiento-cliente');
        
        if (selCliente && selCliente.options.length <= 1) {
            clientes.forEach(c => {
                selCliente.add(new Option(c.nombre, c.id));
            });
        }
        
        if (selCumpCliente && selCumpCliente.options.length <= 1) {
            clientes.forEach(c => {
                selCumpCliente.add(new Option(c.nombre, c.id));
            });
        }
    },

    addPedidoRow: function () {
        const tbody = document.getElementById('pedido-filas-tbody');
        if (!tbody) return;

        const tr = document.createElement('tr');
        
        let opts = `<option value="" disabled selected>Seleccione...</option>`;
        window.appStore.getProductos().forEach(p => {
            opts += `<option value="${p.id}">${p.nombre}</option>`;
        });

        tr.innerHTML = `
            <td class="py-2 pr-2">
                <select class="form-select select-producto py-1.5 text-sm" required>${opts}</select>
            </td>
            <td class="py-2 pr-2">
                <input type="number" class="form-input input-cantidad py-1.5 text-sm" min="1" required>
            </td>
            <td class="py-2 text-right">
                <button type="button" class="btn-remove-row text-danger hover:text-danger-light p-1">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
        if (window.lucide) window.lucide.createIcons({root: tr});
    },

    renderHistorial: function () {
        const tbody = document.getElementById('historial-pedidos-tbody');
        if (!tbody) return;

        const pedidos = window.appStore.getPedidos().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const productos = window.appStore.getProductos();
        const clientes = window.appStore.getClientes();

        tbody.innerHTML = '';

        if (pedidos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-text-secondary italic">No hay pedidos registrados.</td></tr>`;
            return;
        }

        pedidos.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-border/50 hover:bg-surface-light/30 transition-colors";

            const fechaDisplay = new Date(p.fecha).toLocaleDateString();
            const clienteName = clientes.find(c => c.id === p.clienteId)?.nombre || 'Desconocido';
            
            let detalleStr = p.detalles.map(d => {
                const pName = productos.find(prod => prod.id === d.productoId)?.nombre || 'Desconocido';
                return `${d.cantidad}x ${pName}`;
            }).join(', ');

            tr.innerHTML = `
                <td class="py-3 px-4 text-sm">${fechaDisplay}</td>
                <td class="py-3 px-4 text-sm font-medium">${clienteName}</td>
                <td class="py-3 px-4 text-sm text-text-secondary">${detalleStr}</td>
                <td class="py-3 px-4 text-center">
                    <button class="text-danger hover:text-danger-light transition-colors" onclick="window.PedidosClientesController.eliminarPedido('${p.id}')" title="Eliminar Pedido">
                        <i data-lucide="trash-2" class="w-4 h-4 inline-block"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons({root: tbody});
    },

    eliminarPedido: async function (id) {
        if (!confirm("¿Seguro que deseas eliminar este pedido?")) return;
        try {
            await window.appStore.deletePedido(id);
            window.UI.showToast("Pedido eliminado.", "success");
            this.renderHistorial();
        } catch (e) {
            window.UI.showToast(e.message, "error");
        }
    },

    generarReporteCumplimiento: async function () {
        const clienteId = document.getElementById('cumplimiento-cliente').value;
        const tipoFiltro = document.getElementById('cumplimiento-tipo-filtro').value;
        
        let fechaInicio, fechaFin;

        if (tipoFiltro === 'semana') {
            const sem = document.getElementById('cumplimiento-semana').value;
            if (!sem) return window.UI.showToast("Seleccione una semana.", "warning");
            
            const year = parseInt(sem.substring(0, 4));
            const week = parseInt(sem.substring(6, 8));
            
            const simple = new Date(year, 0, 1 + (week - 1) * 7);
            const dow = simple.getDay();
            const ISOweekStart = simple;
            if (dow <= 4)
                ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            else
                ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
            
            fechaInicio = new Date(ISOweekStart);
            fechaFin = new Date(ISOweekStart);
            fechaFin.setDate(fechaFin.getDate() + 6);
        } else {
            const d1 = document.getElementById('cumplimiento-desde').value;
            const d2 = document.getElementById('cumplimiento-hasta').value;
            if (!d1 || !d2) return window.UI.showToast("Seleccione el rango de fechas.", "warning");
            fechaInicio = new Date(d1 + "T00:00:00");
            fechaFin = new Date(d2 + "T23:59:59");
        }

        const tbody = document.getElementById('cumplimiento-tbody');
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center"><div class="spinner border-primary mx-auto"></div><p class="mt-2 text-sm text-text-secondary">Calculando cumplimiento...</p></td></tr>`;

        // Wait a tick for UI
        await new Promise(r => setTimeout(r, 100));

        // 1. Recopilar todos los pedidos en el rango
        const todosPedidos = window.appStore.getPedidos();
        const pedidosEnRango = todosPedidos.filter(p => {
            const pDate = new Date(p.fecha);
            const matchCliente = clienteId === 'TODOS' || p.clienteId === clienteId;
            return matchCliente && pDate >= fechaInicio && pDate <= fechaFin;
        });

        const sumPedidos = {}; // productoId -> cantidad
        pedidosEnRango.forEach(p => {
            p.detalles.forEach(d => {
                sumPedidos[d.productoId] = (sumPedidos[d.productoId] || 0) + d.cantidad;
            });
        });

        // 2. Recopilar entregado (Despacho - Devolucion Llenas)
        await window.appStore.loadFullActivity();
        const actividad = window.appStore.actividadCache;
        
        const sumEntregado = {};

        actividad.forEach(a => {
            let aDate;
            let dateStr = "";
            if (a.rawPayload && a.rawPayload.fecha) dateStr = a.rawPayload.fecha;
            else if (a.fechaOperacion) dateStr = a.fechaOperacion;
            else if (a.rawPayload && a.rawPayload.fechaRecepcion) dateStr = a.rawPayload.fechaRecepcion;
            
            if (dateStr) {
                // Si es solo YYYY-MM-DD, le agregamos tiempo para que sea local
                if (dateStr.length === 10) aDate = new Date(dateStr + "T12:00:00");
                else aDate = new Date(dateStr);
            } else {
                aDate = new Date(a.date);
            }

            if (aDate < fechaInicio || aDate > fechaFin) return;

            const isDespacho = a.operacion.includes('Despacho a Cliente') || a.operacion.includes('Desp. Cliente');
            const isDevolucion = a.operacion.includes('Devolución');

            if (isDespacho && a.rawPayload && a.rawPayload.detalles) {
                const matchC = clienteId === 'TODOS' || (a.rawPayload.clienteId === clienteId || a.rawPayload.clienteNombre === document.querySelector(`#cumplimiento-cliente option[value="${clienteId}"]`)?.text);
                
                if (matchC) {
                    a.rawPayload.detalles.forEach(d => {
                        sumEntregado[d.productoId] = (sumEntregado[d.productoId] || 0) + parseInt(d.cantidad);
                    });
                }
            } else if (isDevolucion && a.rawPayload) {
                if (a.rawPayload.tipoOrigen === 'cliente' && a.rawPayload.esLlena) {
                    const matchC = clienteId === 'TODOS' || (a.rawPayload.clienteId === clienteId || a.rawPayload.clienteNombre === document.querySelector(`#cumplimiento-cliente option[value="${clienteId}"]`)?.text);
                    if (matchC && a.rawPayload.productoId) {
                        sumEntregado[a.rawPayload.productoId] = (sumEntregado[a.rawPayload.productoId] || 0) - parseInt(a.rawPayload.cantidad);
                    }
                }
            }
        });

        // 3. Generar filas combinando ambos
        const productos = window.appStore.getProductos();
        const allProductIds = new Set([...Object.keys(sumPedidos), ...Object.keys(sumEntregado)]);

        tbody.innerHTML = '';

        if (allProductIds.size === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-text-secondary italic">No se encontraron pedidos ni entregas en este periodo.</td></tr>`;
            return;
        }

        const rows = Array.from(allProductIds).map(pId => {
            const pName = productos.find(p => p.id === pId)?.nombre || 'Desconocido';
            const pedido = sumPedidos[pId] || 0;
            const entregado = sumEntregado[pId] || 0;
            
            let cumplimiento = 0;
            if (pedido > 0) {
                cumplimiento = (entregado / pedido) * 100;
            } else if (entregado > 0) {
                cumplimiento = 100;
            }
            
            let pctColor = "text-white";
            if (cumplimiento < 80) pctColor = "text-danger";
            else if (cumplimiento < 95) pctColor = "text-warning";
            else if (cumplimiento >= 100) pctColor = "text-success";

            return {
                pName,
                pedido,
                entregado,
                cumplimientoStr: pedido === 0 && entregado > 0 ? '>100.00%' : cumplimiento.toFixed(2) + '%',
                pctColor
            };
        });

        rows.sort((a, b) => a.pName.localeCompare(b.pName));

        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-border hover:bg-surface-light transition-colors";
            tr.innerHTML = `
                <td class="py-3 px-4 font-medium text-white">${r.pName}</td>
                <td class="py-3 px-4 text-right font-semibold">${r.pedido.toLocaleString()}</td>
                <td class="py-3 px-4 text-right font-semibold">${r.entregado.toLocaleString()}</td>
                <td class="py-3 px-4 text-right font-bold ${r.pctColor}">${r.cumplimientoStr}</td>
            `;
            tbody.appendChild(tr);
        });

    },

    populateWaProductos: function() {
        const container = document.getElementById('wa-productos-container');
        if (!container) return;
        container.innerHTML = '';
        const productos = window.appStore.getProductos();
        productos.forEach(p => {
            const lbl = document.createElement('label');
            lbl.className = "flex items-center gap-2 cursor-pointer bg-surface p-2 rounded border border-border hover:border-primary transition-colors";
            lbl.innerHTML = `
                <input type="checkbox" class="wa-prod-checkbox form-checkbox text-primary rounded bg-surface w-4 h-4" value="${p.id}">
                <span class="text-sm font-medium text-white">${p.nombre}</span>
            `;
            container.appendChild(lbl);
        });
    },

    generarReporteWhatsapp: function() {
        const fechaStr = document.getElementById('wa-fecha').value;
        if (!fechaStr) {
            window.UI.showToast("Seleccione una fecha válida.", "error");
            return;
        }

        const selectedProductIds = Array.from(document.querySelectorAll('.wa-prod-checkbox:checked')).map(cb => cb.value);
        if (selectedProductIds.length === 0) {
            window.UI.showToast("Seleccione al menos un producto.", "error");
            return;
        }

        const dateObj = new Date(fechaStr + "T12:00:00");
        
        // Formatear Fecha (ej: 22-may-26)
        const mesNames = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = mesNames[dateObj.getMonth()];
        const year = dateObj.getFullYear().toString().substring(2);
        const dateFormatted = `${day}-${month}-${year}`;

        // Formatear Día (ej: VIERNES)
        const dayNames = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
        const dayOfWeek = dayNames[dateObj.getDay()];

        // Obtener todos los pedidos
        const todosPedidos = window.appStore.getPedidos();
        const clientes = window.appStore.getClientes();
        const productos = window.appStore.getProductos();

        // Filtrar pedidos que coincidan con la fecha exacta (misma cadena YYYY-MM-DD o misma fecha parseada)
        const pedidosDelDia = todosPedidos.filter(p => {
            // p.fecha tiene formato YYYY-MM-DDT12:00:00
            if (p.fecha && p.fecha.startsWith(fechaStr)) return true;
            return false;
        });

        // Agrupar por producto
        const resultsByProduct = {};
        
        pedidosDelDia.forEach(pedido => {
            const cliente = clientes.find(c => c.id === pedido.clienteId);
            const clienteNombre = cliente ? cliente.nombre : "CLIENTE DESCONOCIDO";

            pedido.detalles.forEach(det => {
                if (!selectedProductIds.includes(det.productoId)) return;

                if (!resultsByProduct[det.productoId]) {
                    resultsByProduct[det.productoId] = {
                        productoObj: productos.find(p => p.id === det.productoId),
                        porCliente: {},
                        totalCanastas: 0
                    };
                }

                if (!resultsByProduct[det.productoId].porCliente[clienteNombre]) {
                    resultsByProduct[det.productoId].porCliente[clienteNombre] = 0;
                }

                const cant = parseInt(det.cantidad) || 0;
                resultsByProduct[det.productoId].porCliente[clienteNombre] += cant;
                resultsByProduct[det.productoId].totalCanastas += cant;
            });
        });

        if (Object.keys(resultsByProduct).length === 0) {
            window.UI.showToast("No se encontraron pedidos de los productos seleccionados en esta fecha.", "warning");
            return;
        }

        const canvasTarget = document.getElementById('wa-canvas-target');
        canvasTarget.innerHTML = '';

        const colorMap = {
            'guineo maduro': '#ffff00',
            'guineo verde': '#92d050',
            'platano verde': '#00b050',
            'platano maduro': '#ffc000',
            'mini sandia': '#e6b8b7',
            'sandia': '#e6b8b7',
            'platano malla': '#548235'
        };

        // Renderizar cada producto
        for (const prodId of selectedProductIds) {
            const data = resultsByProduct[prodId];
            if (!data) continue;

            const pName = data.productoObj ? data.productoObj.nombre : "PRODUCTO";
            const pNameLower = pName.toLowerCase();
            let bgColor = '#ffffff'; // Default
            for (const key in colorMap) {
                if (pNameLower.includes(key)) {
                    bgColor = colorMap[key];
                    break;
                }
            }

            const isDark = (bgColor === '#548235');
            // Though the original images show black text on the dark green too, we'll just use black text.
            const textColor = 'black'; 

            let html = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-weight: bold; border: 2px solid black; font-size: 16px;">
                  <tr>
                    <td style="border: 2px solid black; padding: 4px 8px; text-transform: uppercase; width: 60%;">${pName}</td>
                    <td style="border: 2px solid black; padding: 4px 8px; text-align: center;">${dateFormatted}</td>
                  </tr>
                  <tr>
                    <td style="border: 2px solid black; padding: 4px 8px; text-transform: uppercase;">TIENDAS</td>
                    <td style="border: 2px solid black; padding: 4px 8px; text-align: center; text-transform: uppercase;">${dayOfWeek}</td>
                  </tr>
            `;

            // Filas por cliente
            for (const cName in data.porCliente) {
                const cant = data.porCliente[cName];
                html += `
                  <tr style="background-color: ${bgColor}; color: ${textColor};">
                    <td style="border: 2px solid black; padding: 4px 8px; text-transform: uppercase; font-weight: normal;">${cName}</td>
                    <td style="border: 2px solid black; padding: 4px 8px; text-align: right; font-weight: normal;">${cant.toLocaleString()}</td>
                  </tr>
                `;
            }

            // Total Canastas
            html += `
                  <tr style="background-color: ${bgColor}; color: ${textColor};">
                    <td style="border: 2px solid black; padding: 4px 8px; text-transform: uppercase;">TOTAL CANASTAS</td>
                    <td style="border: 2px solid black; padding: 4px 8px; text-align: right;">${data.totalCanastas.toLocaleString()}</td>
                  </tr>
            `;

            // Total Unidades
            const factor = data.productoObj.factorConversion || 1;
            const unidadMedida = (data.productoObj.unidadMedida === 'libras') ? 'LIBRAS' : 'UNIDAD';
            const firstName = pName.split(" ")[0]; // Ej: "GUINEOS"
            const labelTotal = `TOTAL ${firstName} ${unidadMedida}`.toUpperCase();
            const totalUnidades = data.totalCanastas * factor;

            html += `
                  <tr style="background-color: ${bgColor}; color: ${textColor};">
                    <td style="border: 2px solid black; padding: 4px 8px; text-transform: uppercase;">${labelTotal}</td>
                    <td style="border: 2px solid black; padding: 4px 8px; text-align: right;">${totalUnidades.toLocaleString()}</td>
                  </tr>
                </table>
            `;

            canvasTarget.innerHTML += html;
        }

        document.getElementById('wa-preview-container').classList.remove('hidden');
        window.UI.showToast("Previsualización generada. Puedes descargar la imagen.", "success");
    }
};

window.appModules['pedidos-clientes'] = () => {
    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-white">Pedidos de Clientes</h2>
                    <p class="text-text-secondary text-sm">Gestión de pedidos y reporte de cumplimiento de despachos.</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-border mb-6 flex-wrap">
                <button id="tab-btn-nuevo-pedido" class="tab-btn active pb-3 px-4 font-semibold text-info border-b-2 border-info transition-colors">Nuevo Pedido</button>
                <button id="tab-btn-historial-pedidos" class="tab-btn pb-3 px-4 font-semibold text-text-muted border-b-2 border-transparent hover:text-white transition-colors">Historial de Pedidos</button>
                <button id="tab-btn-reporte-cumplimiento" class="tab-btn pb-3 px-4 font-semibold text-text-muted border-b-2 border-transparent hover:text-white transition-colors">Reporte de Cumplimiento</button>
                <button id="tab-btn-exportar-whatsapp" class="tab-btn pb-3 px-4 font-semibold text-text-muted border-b-2 border-transparent hover:text-white transition-colors flex items-center gap-2"><i data-lucide="smartphone" class="w-4 h-4"></i> WhatsApp</button>
            </div>

            <!-- Tab Content: Nuevo Pedido -->
            <div id="tab-nuevo-pedido" class="tab-content block animate-fade-in">
                <div class="surface-card p-6 border border-info/20">
                    <h3 class="text-lg font-semibold text-white mb-4">Registrar Nuevo Pedido</h3>
                    
                    <form id="form-nuevo-pedido" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="form-group">
                                <label class="form-label">Fecha del Pedido</label>
                                <input type="date" id="pedido-fecha" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Cliente</label>
                                <select id="pedido-cliente" class="form-select" required>
                                    <option value="" disabled selected>-- Seleccione un Cliente --</option>
                                </select>
                            </div>
                        </div>

                        <div class="border-t border-border pt-4">
                            <div class="flex justify-between items-center mb-4">
                                <h4 class="text-md font-semibold text-info">Productos del Pedido</h4>
                                <button type="button" id="btn-add-pedido-fila" class="btn bg-info/20 text-info hover:bg-info/30 px-3 py-1.5 text-sm flex items-center gap-1 rounded-md">
                                    <i data-lucide="plus" class="w-4 h-4"></i> Añadir Producto
                                </button>
                            </div>
                            
                            <div class="overflow-x-auto">
                                <table class="w-full text-left" id="tabla-pedido-productos">
                                    <thead>
                                        <tr class="bg-surface-light text-text-secondary text-xs uppercase tracking-wider">
                                            <th class="py-2 px-3 rounded-tl-lg">Producto</th>
                                            <th class="py-2 px-3 w-32">Cantidad</th>
                                            <th class="py-2 px-3 w-16 rounded-tr-lg"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="pedido-filas-tbody">
                                        <!-- Filas dinámicas -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="flex justify-end pt-4">
                            <button type="submit" class="btn btn-primary h-11 px-8 rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/40">Guardar Pedido</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Tab Content: Historial Pedidos -->
            <div id="tab-historial-pedidos" class="tab-content hidden animate-fade-in">
                <div class="surface-card p-6">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead>
                                <tr class="bg-surface-light text-text-secondary text-xs uppercase tracking-wider border-b border-border">
                                    <th class="py-3 px-4 font-semibold rounded-tl-lg">Fecha</th>
                                    <th class="py-3 px-4 font-semibold">Cliente</th>
                                    <th class="py-3 px-4 font-semibold">Detalle (Productos)</th>
                                    <th class="py-3 px-4 font-semibold w-24 text-center rounded-tr-lg">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="historial-pedidos-tbody">
                                <!-- Filas dinámicas -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Reporte Cumplimiento -->
            <div id="tab-reporte-cumplimiento" class="tab-content hidden animate-fade-in">
                <div class="surface-card p-6 border border-primary/20">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                        <h3 class="text-lg font-semibold text-white">Cumplimiento de Pedidos vs Entregas</h3>
                    </div>

                    <div class="flex flex-col md:flex-row gap-4 mb-6 items-end bg-surface-light p-4 rounded-xl border border-border">
                        <div class="form-group flex-1 mb-0">
                            <label class="form-label text-xs">Cliente</label>
                            <select id="cumplimiento-cliente" class="form-select text-sm">
                                <option value="TODOS">-- Todos los Clientes --</option>
                            </select>
                        </div>
                        
                        <div class="form-group mb-0 border-l border-border pl-4">
                            <label class="form-label text-xs">Filtrar Por</label>
                            <select id="cumplimiento-tipo-filtro" class="form-select text-sm w-32">
                                <option value="semana">Semana</option>
                                <option value="rango">Rango Fechas</option>
                            </select>
                        </div>

                        <div id="filtro-semana-container" class="form-group mb-0">
                            <label class="form-label text-xs">Semana</label>
                            <input type="week" id="cumplimiento-semana" class="form-input text-sm">
                        </div>

                        <div id="filtro-rango-container" class="form-group mb-0 hidden flex gap-2">
                            <div>
                                <label class="form-label text-xs">Desde</label>
                                <input type="date" id="cumplimiento-desde" class="form-input text-sm">
                            </div>
                            <div>
                                <label class="form-label text-xs">Hasta</label>
                                <input type="date" id="cumplimiento-hasta" class="form-input text-sm">
                            </div>
                        </div>

                        <div class="form-group mb-0">
                            <button type="button" id="btn-generar-cumplimiento" class="btn btn-primary h-[38px] px-6 flex items-center gap-2 text-sm rounded-lg shadow-md hover:shadow-primary/30">
                                <i data-lucide="bar-chart-2" class="w-4 h-4"></i> Generar
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto border border-border rounded-lg bg-surface">
                        <table class="w-full text-left">
                            <thead>
                                <tr class="bg-surface-light text-text-secondary text-xs uppercase tracking-wider border-b border-border shadow-sm">
                                    <th class="py-3 px-4 font-semibold">Descripción (Producto)</th>
                                    <th class="py-3 px-4 font-semibold text-right">Pedido</th>
                                    <th class="py-3 px-4 font-semibold text-right">Entregado</th>
                                    <th class="py-3 px-4 font-semibold text-right">Cumplimiento %</th>
                                </tr>
                            </thead>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Exportar WhatsApp -->
            <div id="tab-exportar-whatsapp" class="tab-content hidden animate-fade-in">
                <div class="surface-card p-6 border border-success/20">
                    <h3 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <i data-lucide="smartphone" class="w-5 h-5 text-success"></i> Generar Reporte Visual (WhatsApp)
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div class="form-group">
                            <label class="form-label">Fecha del Pedido (Día exacto)</label>
                            <input type="date" id="wa-fecha" class="form-input" required>
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Productos a incluir</label>
                            <div id="wa-productos-container" class="flex flex-wrap gap-3 mt-2">
                                <!-- Checkboxes generados dinámicamente -->
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 border-t border-border pt-4 mb-6">
                        <button type="button" id="btn-generar-wa" class="btn btn-primary h-[38px] px-6 text-sm flex items-center gap-2 rounded-lg">
                            <i data-lucide="image" class="w-4 h-4"></i> Generar Tabla
                        </button>
                    </div>

                    <!-- Contenedor del Reporte Visual (Oculto hasta generar) -->
                    <div id="wa-preview-container" class="hidden">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="text-md font-semibold text-white">Previsualización</h4>
                            <div class="flex gap-2">
                                <button type="button" id="btn-copiar-wa" class="btn bg-info/20 text-info hover:bg-info/30 px-4 py-2 text-sm flex items-center gap-2 rounded-md font-bold">
                                    <i data-lucide="copy" class="w-4 h-4"></i> Copiar Imagen
                                </button>
                                <button type="button" id="btn-descargar-wa" class="btn bg-success/20 text-success hover:bg-success/30 px-4 py-2 text-sm flex items-center gap-2 rounded-md font-bold">
                                    <i data-lucide="download" class="w-4 h-4"></i> Descargar / Guardar
                                </button>
                            </div>
                        </div>
                        <div class="overflow-auto bg-surface-light p-6 rounded-xl border border-border flex justify-center">
                            <!-- Aquí se inyecta el HTML dibujable -->
                            <div id="wa-canvas-target" class="bg-white p-4" style="width: 400px; color: black; font-family: Arial, sans-serif;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.appModuleEvents['pedidos-clientes'] = () => {
    // Init default date
    const today = new Date().toISOString().split('T')[0];
    const elFecha = document.getElementById('pedido-fecha');
    if(elFecha) elFecha.value = today;

    // Populate selects
    window.PedidosClientesController.populateSelects();

    // Populate WhatsApp products
    window.PedidosClientesController.populateWaProductos();

    // Add first row
    document.getElementById('pedido-filas-tbody').innerHTML = '';
    window.PedidosClientesController.addPedidoRow();

    // Tabs
    ['nuevo-pedido', 'historial-pedidos', 'reporte-cumplimiento', 'exportar-whatsapp'].forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        if (btn) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#page-pedidos-clientes .tab-btn').forEach(b => {
                    b.classList.remove('active', 'text-info', 'border-info');
                    b.classList.add('text-text-muted', 'border-transparent');
                });
                btn.classList.remove('text-text-muted', 'border-transparent');
                btn.classList.add('active', 'text-info', 'border-info');

                document.querySelectorAll('#page-pedidos-clientes .tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`tab-${tab}`).classList.remove('hidden');

                if (tab === 'historial-pedidos') {
                    window.PedidosClientesController.renderHistorial();
                } else if (tab === 'exportar-whatsapp') {
                    const todayInput = document.getElementById('wa-fecha');
                    if (todayInput && !todayInput.value) {
                        todayInput.value = new Date().toISOString().split('T')[0];
                    }
                }
            });
        }
    });

    // Add Row
    document.getElementById('btn-add-pedido-fila')?.addEventListener('click', () => {
        window.PedidosClientesController.addPedidoRow();
    });

    // Remove Row (Event Delegation)
    document.getElementById('pedido-filas-tbody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-row');
        if (btn) {
            const tr = btn.closest('tr');
            if (document.querySelectorAll('#pedido-filas-tbody tr').length > 1) {
                tr.remove();
            } else {
                window.UI.showToast("El pedido debe tener al menos un producto.", "warning");
            }
        }
    });

    // Form Submit
    document.getElementById('form-nuevo-pedido')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        
        const fecha = document.getElementById('pedido-fecha').value;
        const clienteId = document.getElementById('pedido-cliente').value;
        
        const detalles = [];
        const rows = document.querySelectorAll('#pedido-filas-tbody tr');
        
        let valid = true;
        rows.forEach(row => {
            const prodId = row.querySelector('.select-producto').value;
            const cant = parseInt(row.querySelector('.input-cantidad').value);
            if (!prodId || isNaN(cant) || cant <= 0) {
                valid = false;
            } else {
                const existe = detalles.find(d => d.productoId === prodId);
                if (existe) existe.cantidad += cant;
                else detalles.push({ productoId: prodId, cantidad: cant });
            }
        });

        if (!valid || detalles.length === 0) {
            window.UI.showToast("Complete todos los productos y cantidades correctamente.", "error");
            return;
        }

        try {
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin inline-block"></i> Guardando...`;
            
            const fechaEstandar = fecha + "T12:00:00"; 

            await window.appStore.addPedido({
                fecha: fechaEstandar,
                clienteId,
                detalles
            });

            window.UI.showToast("Pedido guardado exitosamente.", "success");
            
            // Reset form partially
            document.getElementById('pedido-filas-tbody').innerHTML = '';
            window.PedidosClientesController.addPedidoRow();
            
            btn.innerHTML = orig;
            btn.disabled = false;
        } catch (error) {
            console.error(error);
            window.UI.showToast(error.message, "error");
            btn.disabled = false;
        }
    });

    // Report filters toggle
    document.getElementById('cumplimiento-tipo-filtro')?.addEventListener('change', (e) => {
        const tipo = e.target.value;
        if (tipo === 'semana') {
            document.getElementById('filtro-semana-container').classList.remove('hidden');
            document.getElementById('filtro-rango-container').classList.add('hidden');
        } else {
            document.getElementById('filtro-semana-container').classList.add('hidden');
            document.getElementById('filtro-rango-container').classList.remove('hidden');
        }
    });

    // Generate Report
    document.getElementById('btn-generar-cumplimiento')?.addEventListener('click', () => {
        window.PedidosClientesController.generarReporteCumplimiento();
    });

    // Generate WhatsApp
    document.getElementById('btn-generar-wa')?.addEventListener('click', () => {
        window.PedidosClientesController.generarReporteWhatsapp();
    });

    // Download / Export WhatsApp image
    document.getElementById('btn-descargar-wa')?.addEventListener('click', async () => {
        if (typeof html2canvas === 'undefined') {
            window.UI.showToast("La librería de captura no está cargada.", "error");
            return;
        }

        const target = document.getElementById('wa-canvas-target');
        const btn = document.getElementById('btn-descargar-wa');
        const orig = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generando...`;
        btn.disabled = true;

        try {
            const canvas = await html2canvas(target, {
                scale: 2, // High resolution
                backgroundColor: "#ffffff"
            });
            
            const imgData = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = `Pedido-${document.getElementById('wa-fecha').value}.png`;
            link.href = imgData;
            link.click();
            
            window.UI.showToast("Imagen descargada con éxito.", "success");
        } catch (err) {
            console.error("Error al generar imagen", err);
            window.UI.showToast("Hubo un error al generar la imagen.", "error");
        } finally {
            btn.innerHTML = orig;
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // Copy to clipboard WhatsApp image
    document.getElementById('btn-copiar-wa')?.addEventListener('click', async () => {
        if (typeof html2canvas === 'undefined') {
            window.UI.showToast("La librería de captura no está cargada.", "error");
            return;
        }

        const target = document.getElementById('wa-canvas-target');
        const btn = document.getElementById('btn-copiar-wa');
        const orig = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Copiando...`;
        btn.disabled = true;

        try {
            const canvas = await html2canvas(target, {
                scale: 2, 
                backgroundColor: "#ffffff"
            });
            
            canvas.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    window.UI.showToast("¡Imagen copiada! Ve a WhatsApp y pega (Ctrl+V)", "success");
                } catch (clipboardErr) {
                    console.error("Error en portapapeles", clipboardErr);
                    window.UI.showToast("Tu navegador no permite copiar imágenes. Usa el botón descargar.", "warning");
                } finally {
                    btn.innerHTML = orig;
                    btn.disabled = false;
                    if (window.lucide) window.lucide.createIcons();
                }
            }, 'image/png');

        } catch (err) {
            console.error("Error al generar imagen", err);
            window.UI.showToast("Hubo un error al copiar la imagen.", "error");
            btn.innerHTML = orig;
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();
        }
    });
};
