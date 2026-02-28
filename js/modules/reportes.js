/**
 * Módulo de Reportes Diarios
 * Filtra y analiza la actividad guardada en el Store (Recepciones, Decomisos, Despachos).
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['reportes'] = () => {
    const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const productos = window.appStore.getProductos();
    const optsProductos = productos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');

    return `
        <div class="animate-fade-in max-w-6xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">Reportes Consolidados</h2>
            <p class="text-text-secondary mb-8">Filtra y visualiza transacciones de recepciones, decomisos y despachos de forma detallada.</p>
            
            <!-- Barra de Herramientas Principal -->
            <div class="surface-card p-4 md:p-6 mb-6">
                <div class="flex flex-col md:flex-row gap-4 items-end">
                    <div class="form-group flex-1">
                        <label class="form-label mb-1">Tipo de Reporte a Consultar</label>
                        <select id="rep-tipo" class="form-select border-primary/50 text-white">
                            <option value="recepciones">Canastas Compradas (Recepciones)</option>
                            <option value="decomisos">Fruta Decomisada</option>
                            <option value="despachos">Fruta Despachada a Clientes</option>
                        </select>
                    </div>
                    <div class="form-group">
                         <button type="button" id="rep-btn-export-csv" class="btn btn-primary text-sm py-2 px-4 whitespace-nowrap flex items-center gap-2">
                             <i data-lucide="download" class="w-4 h-4"></i> Exportar Historial Completo (CSV)
                         </button>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                
                <!-- Panel de Filtros -->
                <div class="surface-card p-4">
                    <form id="form-filtros-reportes" class="flex flex-col md:flex-row gap-4 items-end">
                        <div class="form-group flex-1">
                            <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Fecha Específica</label>
                            <input type="date" id="rep-fecha" class="form-input text-sm" value="${todayISO}">
                        </div>

                        <!-- Filtro dinámico según pestaña activa -->
                        <div id="filter-wrapper-productor" class="form-group flex-1 border-l border-border pl-4">
                            <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Productor</label>
                            <input type="text" id="rep-productor" class="form-input text-sm" placeholder="Buscar por nombre...">
                        </div>

                        <div id="filter-wrapper-cliente" class="form-group flex-1 hidden border-l border-border pl-4">
                            <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Cliente</label>
                            <input type="text" id="rep-cliente" class="form-input text-sm" placeholder="Buscar por nombre...">
                        </div>

                        <div id="filter-wrapper-producto" class="form-group flex-1 border-l border-border pl-4">
                            <label class="form-label mb-1 text-xs uppercase tracking-wider text-text-muted">Producto (Fruta)</label>
                            <select id="rep-producto" class="form-select text-sm">
                                <option value="">-- Todos --</option>
                                ${optsProductos}
                            </select>
                        </div>

                        <div class="flex gap-2">
                            <button type="submit" class="btn btn-primary text-sm py-2 px-4 whitespace-nowrap">Aplicar Filtros</button>
                            <button type="button" id="rep-btn-clear" class="btn btn-secondary text-sm py-2 px-4 whitespace-nowrap">Limpiar</button>
                        </div>
                    </form>
                </div>

                <!-- Tabla de Resultados -->
                <div class="w-full">
                    <div class="surface-card overflow-hidden h-full flex flex-col">
                        <div class="p-4 border-b border-border bg-surface-light flex justify-between items-center">
                            <h3 id="rep-titulo-tabla" class="font-semibold text-white">Resultados: Canastas Compradas (Recepciones)</h3>
                            <span id="rep-total-txt" class="text-sm font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                Total Canastas: 0
                            </span>
                        </div>
                        
                        <div class="overflow-x-auto p-0 custom-scrollbar" style="max-height: 55vh;">
                            <table class="w-full text-left border-collapse" id="tabla-reportes">
                                <thead>
                                    <tr class="bg-surface sticky top-0 z-10 text-text-secondary text-xs uppercase tracking-wider border-b border-border shadow-sm">
                                        <th class="py-3 px-4 font-semibold w-24">Doc #</th>
                                        <th class="py-3 px-4 font-semibold">Fecha</th>
                                        <th class="py-3 px-4 font-semibold" id="rep-col-entidad">Productor</th>
                                        <th class="py-3 px-4 font-semibold" id="rep-col-producto">Producto</th>
                                        <th class="py-3 px-4 font-semibold">Detalle/Operación</th>
                                        <th class="py-3 px-4 font-semibold text-right">Canastas</th>
                                        <th class="py-3 px-4 font-semibold text-center w-16">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="rep-tbody">
                                    <tr><td colspan="7" class="py-12 text-center text-text-secondary italic">Haz clic en Aplicar Filtros para buscar...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
};

window.appModuleEvents['reportes'] = () => {
    const form = document.getElementById('form-filtros-reportes');
    const tipoSelect = document.getElementById('rep-tipo');

    // UI Elements
    const wrpProductor = document.getElementById('filter-wrapper-productor');
    const wrpCliente = document.getElementById('filter-wrapper-cliente');
    const wrpProducto = document.getElementById('filter-wrapper-producto');

    const colEntidad = document.getElementById('rep-col-entidad');
    const colProducto = document.getElementById('rep-col-producto');
    const tituloTabla = document.getElementById('rep-titulo-tabla');
    const tbody = document.getElementById('rep-tbody');
    const totalTxt = document.getElementById('rep-total-txt');

    if (!form) return;

    // Helper functions for parsing
    const dateToYMD = (dateString) => {
        try {
            return new Date(dateString).toISOString().slice(0, 10);
        } catch (e) {
            return "";
        }
    };

    const extractNumber = (str) => {
        const match = str.match(/\\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    // Cambiar la UI dinámica según el tipo
    tipoSelect.addEventListener('change', () => {
        const val = tipoSelect.value;
        if (val === 'recepciones') {
            wrpProductor.classList.remove('hidden');
            wrpCliente.classList.add('hidden');
            wrpProducto.classList.remove('hidden');
            colEntidad.textContent = 'Productor';
            colProducto.style.display = 'table-cell';
            tituloTabla.textContent = 'Resultados: Canastas Compradas (Recepciones)';
        } else if (val === 'decomisos') {
            wrpProductor.classList.add('hidden');
            wrpCliente.classList.add('hidden');
            wrpProducto.classList.remove('hidden');
            colEntidad.textContent = '----';
            colProducto.style.display = 'table-cell';
            tituloTabla.textContent = 'Resultados: Fruta Decomisada';
        } else if (val === 'despachos') {
            wrpProductor.classList.add('hidden');
            wrpCliente.classList.remove('hidden');
            wrpProducto.classList.remove('hidden'); // Despachos ahora muestran el desglose
            colEntidad.textContent = 'Cliente';
            colProducto.style.display = 'table-cell';
            tituloTabla.textContent = 'Resultados: Fruta Despachada a Clientes';
        }

        // Auto trigger search on tab change to refresh info
        form.dispatchEvent(new Event('submit'));
    });

    document.getElementById('rep-btn-clear').addEventListener('click', () => {
        document.getElementById('rep-fecha').value = '';
        document.getElementById('rep-productor').value = '';
        document.getElementById('rep-cliente').value = '';
        document.getElementById('rep-producto').value = '';
        form.dispatchEvent(new Event('submit'));
    });

    // Funcionalidad de Exportar a CSV
    const btnExport = document.getElementById('rep-btn-export-csv');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            try {
                const prevHtml = btnExport.innerHTML;
                btnExport.innerHTML = '<i class="lucide-loader animate-spin w-4 h-4"></i> Generando CSV...';
                btnExport.disabled = true;

                // Extraemos TODO el historial de la colección directamente (puede ser pesado, pero es lo pedido)
                const snapshot = await db.collection('actividad').orderBy('date', 'desc').get();

                if (snapshot.empty) {
                    window.UI.showToast("No hay registros en el historial.", "warning");
                    btnExport.innerHTML = prevHtml;
                    btnExport.disabled = false;
                    return;
                }

                const docs = snapshot.docs.map(doc => doc.data());

                // Construir CSV
                let csvContent = "data:text/csv;charset=utf-8,";
                // Cabeceras
                csvContent += "ID,Documento,Fecha,Operacion,Detalle,Cantidad,Usuario\n";

                docs.forEach(a => {
                    const row = [
                        a.id || '',
                        a.numeroDocumento || 'S/N',
                        new Date(a.date).toLocaleString().replace(',', ''),
                        `"${(a.operacion || '').replace(/"/g, '""')}"`,
                        `"${(a.detalle || '').replace(/"/g, '""')}"`,
                        `"${(a.cantidad || '').replace(/"/g, '""')}"`,
                        a.usuario || ''
                    ].join(",");
                    csvContent += row + "\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Historial_Completo_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                window.UI.showToast("Archivo CSV descargado con éxito.", "success");
                btnExport.innerHTML = prevHtml;
                btnExport.disabled = false;
                if (window.lucide) window.lucide.createIcons();
            } catch (err) {
                console.error("Error exportando CSV:", err);
                window.UI.showToast("Error al exportar: " + err.message, "error");
                btnExport.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i> Exportar Historial Completo (CSV)';
                btnExport.disabled = false;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    // Formulario de filtrado real
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const act = window.appStore.getActividad(10000); // Hack para obtener todas (o límite muy alto) ya que en store está sin límite directo (el getter devuelve una copia de data.actividad).

        const fTipo = tipoSelect.value;
        const fFecha = document.getElementById('rep-fecha').value;
        const fProductor = document.getElementById('rep-productor').value.toLowerCase();
        const fCliente = document.getElementById('rep-cliente').value.toLowerCase();
        const fProducto = document.getElementById('rep-producto').value.toLowerCase();

        let filtered = act.filter(a => {
            // Filtrar Fechas
            if (fFecha) {
                if (dateToYMD(a.date) !== fFecha) return false;
            }

            // Filtrar Opciones Principales
            if (fTipo === 'recepciones') {
                if (a.operacion !== 'Recepción') return false;

                // detalle -> "De: ProductorX, Prod: ProductoY, Recibe: PersonaZ"
                if (fProductor && !a.detalle.toLowerCase().includes(`de: ${fProductor}`)) return false;
                if (fProducto && !a.detalle.toLowerCase().includes(`prod: ${fProducto}`)) return false;
            }
            else if (fTipo === 'decomisos') {
                if (a.operacion !== 'Decomiso') return false;

                // detalle -> "Producto: Producto Nombre"
                if (fProducto && !a.detalle.toLowerCase().includes(`producto: ${fProducto}`)) return false;
            }
            else if (fTipo === 'despachos') {
                if (a.operacion !== 'Desp. Cliente') return false;

                // detalle -> "A cliente: NombreCliente | ProductoA (X), ProductoB (Y)"
                if (fCliente && !a.detalle.toLowerCase().includes(`a cliente: ${fCliente}`)) return false;
                if (fProducto && !a.detalle.toLowerCase().includes(fProducto)) return false;
            }

            return true;
        });

        // Orden cronológico inverso (más nuevos primero)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Renderizar tabla
        let totalAcumulado = 0;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-text-secondary italic">No se encontraron resultados para los filtros indicados.</td></tr>`;
        } else {
            tbody.innerHTML = filtered.map(a => {
                const cantNum = extractNumber(a.cantidad);
                totalAcumulado += cantNum;

                let entidad = '-';
                let prod = '-';

                // Parsear detalle rudimentariamente para mostrarlo mejor en tabla
                if (fTipo === 'recepciones') {
                    const matchDe = a.detalle.match(/De:([^,]+)/i);
                    const matchProd = a.detalle.match(/Prod:([^,]+)/i);
                    if (matchDe) entidad = matchDe[1].trim();
                    if (matchProd) prod = matchProd[1].trim();
                } else if (fTipo === 'decomisos') {
                    const matchProd = a.detalle.split('|')[0].match(/Producto:([^,]+)/i);
                    if (matchProd) prod = matchProd[1].trim();
                } else if (fTipo === 'despachos') {
                    const parts = a.detalle.split('|');
                    const matchCli = parts[0].match(/cliente:([^,]+)/i);
                    if (matchCli) entidad = matchCli[1].trim();
                    if (parts.length > 1) prod = parts[1].trim();
                }

                // Render de Fila
                return `
                    <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors text-sm group">
                        <td class="py-2.5 px-4 font-mono text-xs text-text-secondary">${a.numeroDocumento || 'S/N'}</td>
                        <td class="py-2.5 px-4 text-text-secondary">${new Date(a.date).toLocaleDateString()}</td>
                        <td class="py-2.5 px-4 font-medium text-white">${entidad}</td>
                        <td class="py-2.5 px-4 text-text-secondary">${prod}</td>
                        <td class="py-2.5 px-4 text-text-secondary italic text-xs max-w-xs truncate" title="${a.detalle}">${a.operacion}</td>
                        <td class="py-2.5 px-4 text-right font-bold ${a.cantidad.includes('-') ? 'text-danger' : 'text-success'}">${a.cantidad}</td>
                        <td class="py-2.5 px-4 text-center">
                            <button type="button" onclick="window.verDocumentoOrigen('${a.id}')" class="btn btn-secondary text-xs py-1.5 px-3 flex items-center justify-center gap-1 mx-auto whitespace-nowrap" title="Ver Documento Origen">
                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        totalTxt.textContent = `Total Canastas: ${totalAcumulado}`;
    });

    // Auto load today's data initially
    form.dispatchEvent(new Event('submit'));
};
