/**
 * Módulo: Control de Maduración de Fruta (Frizzers)
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['maduracion'] = () => {
    return `
        <div class="animate-fade-in max-w-6xl mx-auto relative pb-10">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                        <i data-lucide="thermometer" class="w-6 h-6 text-warning"></i>
                        Control de Maduración
                    </h2>
                    <p class="text-text-secondary text-sm mt-1">Monitoreo de edad de fruta en cuartos Frizzer utilizando Lógica FIFO.</p>
                </div>
                <div class="mt-4 md:mt-0 bg-surface-light px-4 py-2 rounded-lg border border-border flex items-center gap-4">
                    <div class="text-center">
                        <span class="text-text-secondary text-xs block uppercase tracking-wider">Total en Proceso</span>
                        <span class="text-warning font-bold text-lg" id="mad-total-proceso">0</span>
                    </div>
                    <div class="w-px h-8 bg-border"></div>
                    <div class="text-center">
                        <span class="text-text-secondary text-xs block uppercase tracking-wider text-danger">Listas p/ Despacho</span>
                        <span class="text-danger font-bold text-lg" id="mad-total-listas">0</span>
                    </div>
                </div>
            </div>

            <div class="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex gap-3 text-sm text-text-secondary">
                <i data-lucide="info" class="w-5 h-5 text-primary shrink-0"></i>
                <div>
                    La edad de la fruta se calcula automáticamente deduciendo los despachos. Asume que la fruta más vieja sale primero ("First In, First Out").<br>
                    Para configurar un cuarto de maduración, edite las propiedades del Almacén en el catálogo de <a href="#almacenes" class="text-primary hover:underline font-medium">Almacenes</a>.
                </div>
            </div>

            <!-- Frizzers Grid -->
            <div id="maduracion-grid" class="grid grid-cols-1 gap-6">
                <div class="surface-card p-12 text-center text-text-secondary animate-pulse">
                    <i data-lucide="loader" class="w-8 h-8 animate-spin mx-auto mb-2 text-primary"></i>
                    Calculando historial de fruta...
                </div>
            </div>
        </div>
    `;
};

window.appModuleEvents['maduracion'] = () => {
    renderMaduracionTabs();
};

function calcularEdadFIFO() {
    // 1. Obtener Almacenes configurados como Frizzer
    const almacenes = window.appStore.getAlmacenes();
    const frizzers = almacenes.filter(a => a.esFrizzer);

    if (frizzers.length === 0) return { error: "No hay almacenes configurados como 'Cuarto de Maduración'. Vaya a Inventario > Almacenes y edite un cuarto para marcarlo." };

    const invAlmacen = window.appStore.getInventarioPorAlmacen();
    const productos = window.appStore.getProductos();

    // Obtener historial profundo ordenado del más nuevo al más viejo
    // 10000 registros deberían ser suficientes para reconstruir 4 días de entradas, incluso en meses picos
    const actividad = window.appStore.getActividad(10000).sort((a, b) => new Date(b.date) - new Date(a.date));

    const NOW = new Date();
    NOW.setHours(23, 59, 59, 999); // Set to end of day to calculate whole days properly relative to past

    // Función auxiliar para calcular días enteros de diferencia
    const calcularDias = (fechaIngresoISO) => {
        const ingreso = new Date(fechaIngresoISO);
        ingreso.setHours(0, 0, 0, 0); // Normalize to start of day

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalize to start of day

        const diffTime = Math.abs(hoy - ingreso);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const matriz = [];
    let granTotalListas = 0;
    let granTotalProceso = 0;

    frizzers.forEach(frizzer => {
        const inv = invAlmacen[frizzer.id] || {};
        const limiteDias = parseInt(frizzer.diasMaduracion) || 4;

        const datosCuarto = {
            almacen: frizzer,
            totalListas: 0,
            totalProceso: 0,
            productos: []
        };

        // Iterar sobre todos los productos en este frizzer que tengan inventario
        productos.forEach(prod => {
            const stockActual = inv[prod.id];
            if (!stockActual || stockActual <= 0) return; // No hay stock de este producto aquí

            // 2. Caminar el historial hacia atrás buscando el origen real de esta fruta
            function traceBackward(origenAlmacenId, productoId, qtyNeeded, startIndex) {
                let origins = [];
                let missing = qtyNeeded;

                for (let i = startIndex; i < actividad.length && missing > 0; i++) {
                    const act = actividad[i];
                    if (!act.rawPayload) continue;

                    let sumadas = 0;
                    let fechaIngreso = act.date;

                    // Recepciones
                    if (act.operacion === 'Recepción') {
                        const lotes = act.rawPayload.lotes || [{ productoId: act.rawPayload.productoId, almacenId: act.rawPayload.almacenDestinoId, cantidad: act.rawPayload.cantidad }];
                        for (const l of lotes) {
                            if (l.almacenId === origenAlmacenId && l.productoId === productoId) {
                                sumadas += parseInt(l.cantidad);
                            }
                        }
                        if (act.rawPayload.fechaRecepcion) {
                            fechaIngreso = act.rawPayload.fechaRecepcion + "T12:00:00.000Z";
                        }
                    }
                    // Transferencias Internas (Destino = Este Almacen)
                    else if (act.operacion === 'Transf. Interna') {
                        if (act.rawPayload.almacenDestinoId === origenAlmacenId && act.rawPayload.productoIdNuevo === productoId) {
                            sumadas += parseInt(act.rawPayload.cantidad);
                            if (act.rawPayload.fechaTransferencia) {
                                fechaIngreso = act.rawPayload.fechaTransferencia + "T12:00:00.000Z";
                            }

                            if (sumadas > 0) {
                                const origenDelTransfer = act.rawPayload.almacenOrigenId;
                                const qtyFromTransfer = Math.min(sumadas, missing);

                                // REGLA ORO: Si vino de OTRO Frizzer, trazamos el origen recursivamente desde ese momento hacia atrás!
                                const vinoDeFrizzer = frizzers.some(f => f.id === origenDelTransfer);
                                if (vinoDeFrizzer) {
                                    const subOrigins = traceBackward(origenDelTransfer, act.rawPayload.productoIdActual, qtyFromTransfer, i + 1);

                                    let subTotal = 0;
                                    subOrigins.forEach(subReq => {
                                        origins.push(subReq);
                                        subTotal += subReq.cantidad;
                                    });

                                    // Si por pérdida de historia subOrigins trajo menos cantidad que qtyFromTransfer, rellenamos
                                    if (subTotal < qtyFromTransfer) {
                                        origins.push({ cantidad: qtyFromTransfer - subTotal, fecha: fechaIngreso });
                                    }

                                    missing -= qtyFromTransfer;
                                    sumadas = 0; // El lote fue rastreado en profundidad, no lo agregamos genéricamente.
                                }
                            }
                        }
                    }

                    if (sumadas > 0) {
                        const aTomar = Math.min(sumadas, missing);
                        origins.push({ cantidad: aTomar, fecha: fechaIngreso });
                        missing -= aTomar;
                    }
                }

                return origins;
            }

            const origenes = traceBackward(frizzer.id, prod.id, stockActual, 0);

            const lotesReconstruidos = [];
            let canastasRestantesParaEncontrar = stockActual;

            origenes.forEach(ori => {
                lotesReconstruidos.push({
                    cantidad: ori.cantidad,
                    fechaAsignada: ori.fecha,
                    edadDias: calcularDias(ori.fecha)
                });
                canastasRestantesParaEncontrar -= ori.cantidad;
            });

            // Si aún faltan canastas por encontrar en el historial (inventario inicial antiguo o datos faltantes)
            if (canastasRestantesParaEncontrar > 0) {
                lotesReconstruidos.push({
                    cantidad: canastasRestantesParaEncontrar,
                    fechaAsignada: null,
                    edadDias: 999, // Desconocido, muy viejo
                    esDesconocido: true
                });
            }

            // 3. Agrupar lotes por su "Edad" en días
            let grupos = {
                'hoy': 0,
                'max_2': 0, // 1 a 2 dias
                'max_3': 0, // 3 dias (o límite-1)
                'listas': 0 // límite o más
            };

            lotesReconstruidos.forEach(l => {
                if (l.edadDias >= limiteDias || l.esDesconocido) {
                    grupos.listas += l.cantidad;
                    datosCuarto.totalListas += l.cantidad;
                    granTotalListas += l.cantidad;
                } else if (l.edadDias === 0) {
                    grupos.hoy += l.cantidad;
                } else if (l.edadDias <= 2) {
                    grupos.max_2 += l.cantidad;
                } else {
                    grupos.max_3 += l.cantidad;
                }
            });

            datosCuarto.totalProceso += stockActual;
            granTotalProceso += stockActual;

            datosCuarto.productos.push({
                nombre: prod.nombre,
                total: stockActual,
                grupos
            });
        });

        matriz.push(datosCuarto);
    });

    return { matriz, granTotalListas, granTotalProceso };
}

function renderMaduracionTabs() {
    const gridEl = document.getElementById('maduracion-grid');
    if (!gridEl) return;

    // Ejecutar lógica pesada asíncronamente para no bloquear la UI
    setTimeout(() => {
        const resultado = calcularEdadFIFO();

        if (resultado.error) {
            gridEl.innerHTML = `
                <div class="surface-card p-12 text-center flex flex-col items-center justify-center">
                    <i data-lucide="info" class="w-12 h-12 text-warning mb-4"></i>
                    <p class="text-white text-lg font-medium">${resultado.error}</p>
                    <button onclick="window.location.hash='#almacenes'" class="btn btn-primary mt-6">Ir a Configurar Almacenes</button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Actualizar Cabecera
        document.getElementById('mad-total-proceso').textContent = resultado.granTotalProceso;
        document.getElementById('mad-total-listas').textContent = resultado.granTotalListas;

        if (resultado.matriz.length === 0 || resultado.granTotalProceso === 0) {
            gridEl.innerHTML = `
                <div class="surface-card p-12 text-center text-text-secondary">
                    <i data-lucide="package-open" class="w-12 h-12 opacity-30 mx-auto mb-4"></i>
                    <p>No hay fruta actualmente en los cuartos de maduración.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Renderizar Frizzers
        let html = '';
        resultado.matriz.forEach(cuarto => {
            if (cuarto.totalProceso === 0) return; // Skip empty coolers

            const limiteDias = parseInt(cuarto.almacen.diasMaduracion) || 4;
            const statusColor = cuarto.totalListas > 0 ? 'border-danger/40' : 'border-border';
            const alertBadge = cuarto.totalListas > 0 ? `<div class="bg-danger text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-danger/20"><i data-lucide="flame" class="w-3 h-3"></i> ¡Despachar!</div>` : '';

            html += `
                <div class="surface-card p-0 overflow-hidden relative border ${statusColor} transition-colors">
                    ${cuarto.totalListas > 0 ? `<div class="absolute top-0 right-0 w-32 h-32 bg-danger/10 rounded-full blur-3xl pointer-events-none"></div>` : ''}
                    
                    <div class="p-5 border-b border-border bg-surface-light flex justify-between items-center relative z-10">
                        <div class="flex items-center gap-3">
                            <div class="p-2 ${cuarto.totalListas > 0 ? 'bg-danger/10 text-danger' : 'bg-info/10 text-info'} rounded-lg">
                                <i data-lucide="snowflake" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                                    ${cuarto.almacen.nombre}
                                </h3>
                                <p class="text-xs text-text-secondary">Meta: Madura a los ${limiteDias} días.</p>
                            </div>
                        </div>
                        ${alertBadge}
                    </div>

                    <div class="p-0 overflow-x-auto relative z-10">
                        <table class="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr class="text-text-secondary text-xs uppercase tracking-wider bg-surface-light/30 border-b border-border">
                                    <th class="py-3 px-5 font-medium">Producto Depositado</th>
                                    <th class="py-3 px-5 font-medium text-center">Fresco (Hoy)</th>
                                    <th class="py-3 px-5 font-medium text-center">1-2 Días</th>
                                    <th class="py-3 px-5 font-medium text-center">Casi (${limiteDias - 1} Días)</th>
                                    <th class="py-3 px-5 font-black text-center text-danger bg-danger/5 w-40">¡LISTAS! (${limiteDias}+ Días)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cuarto.productos.map(p => {
                return `
                                        <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors">
                                            <td class="py-3 px-5 font-bold text-white flex items-center gap-2">
                                                <i data-lucide="apple" class="w-4 h-4 text-primary"></i> ${p.nombre}
                                                <span class="text-xs text-text-muted font-normal">(${p.total} tot.)</span>
                                            </td>
                                            <td class="py-3 px-5 text-center text-text-secondary font-mono">${p.grupos.hoy > 0 ? p.grupos.hoy : '-'}</td>
                                            <td class="py-3 px-5 text-center text-text-secondary font-mono">${p.grupos.max_2 > 0 ? p.grupos.max_2 : '-'}</td>
                                            <td class="py-3 px-5 text-center text-warning font-semibold font-mono">${p.grupos.max_3 > 0 ? p.grupos.max_3 : '-'}</td>
                                            <td class="py-3 px-5 text-center bg-danger/5 border-l border-r border-danger/10">
                                                ${p.grupos.listas > 0
                        ? `<span class="text-danger font-black text-lg bg-danger/10 px-3 py-1 rounded shadow-inner drop-shadow-md animate-pulse">${p.grupos.listas}</span>`
                        : '<span class="text-text-muted opacity-50">-</span>'}
                                            </td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        gridEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

    }, 300); // Pequeño delay para permitir animación de entrada
}
