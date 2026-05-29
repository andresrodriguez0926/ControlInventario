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

            <!-- Reporte Global de Salidas -->
            <div id="reporte-salidas-programadas" class="mb-6"></div>

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

window.addProgramacionFrizzer = async (almacenId) => {
    const diaEl = document.getElementById(`prog-dia-${almacenId}`);
    const cantEl = document.getElementById(`prog-cant-${almacenId}`);
    if (!diaEl || !cantEl || !cantEl.value) {
        window.UI?.showToast('Por favor ingrese una cantidad', 'warning');
        return;
    }
    const dia = diaEl.value;
    const cantidad = parseInt(cantEl.value);
    if (cantidad <= 0) return;
    
    const resultado = calcularEdadFIFO();
    const cuarto = resultado.matriz.find(c => c.almacen.id === almacenId);
    if (!cuarto) return;

    const yaProgramado = (cuarto.almacen.programacionSalidas || []).reduce((sum, p) => sum + parseInt(p.cantidad), 0);
    const disponibleParaProgramar = cuarto.totalProceso - yaProgramado;
    
    if (cantidad > disponibleParaProgramar) {
        window.UI?.showToast(`No puedes programar más del inventario disponible. Máximo a programar: ${disponibleParaProgramar} canastas.`, 'warning');
        return;
    }

    const almacenes = window.appStore.getAlmacenes();
    const almacen = almacenes.find(a => a.id === almacenId);
    if (!almacen) return;
    
    const programacion = almacen.programacionSalidas || [];
    programacion.push({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        dia,
        cantidad
    });
    
    try {
        await window.appStore.updateAlmacen(almacenId, { programacionSalidas: programacion });
        window.UI?.showToast(`Salida programada agregada`);
        renderMaduracionTabs();
    } catch(e) {
        window.UI?.showToast(e.message, 'error');
    }
};

window.deleteProgramacionFrizzer = async (almacenId, progId) => {
    const almacenes = window.appStore.getAlmacenes();
    const almacen = almacenes.find(a => a.id === almacenId);
    if (!almacen) return;
    
    const programacion = (almacen.programacionSalidas || []).filter(p => p.id !== progId);
    try {
        await window.appStore.updateAlmacen(almacenId, { programacionSalidas: programacion });
        window.UI?.showToast(`Programación eliminada`);
        renderMaduracionTabs();
    } catch(e) {
        window.UI?.showToast(e.message, 'error');
    }
};

window.compartirReporteMaduracion = () => {
    if (!window.__reporteMaduracionText) {
        window.UI?.showToast('No hay datos en el reporte para compartir', 'warning');
        return;
    }
    const text = encodeURIComponent(window.__reporteMaduracionText);
    window.open(`https://wa.me/?text=${text}`, '_blank');
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
                    if (act.operacion === 'Recepción' || act.operacion === 'Recepción de Fruta') {
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
                    else if (act.operacion === 'Transf. Interna' || act.operacion === 'Transferencia entre Almacenes') {
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

        // --- Generar Reporte Global de Salidas Programadas ---
        // --- Generar Reporte Global de Salidas Programadas ---
        const salidasTotales = {}; 
        let totalNoAsignado = 0;
        const frizzersNoAsignados = [];
        
        resultado.matriz.forEach(cuarto => {
            const a = cuarto.almacen;
            let asignadoEsteCuarto = 0;

            let maxAgeCategory = 0;
            cuarto.productos.forEach(p => {
                if (p.grupos.listas > 0) maxAgeCategory = Math.max(maxAgeCategory, 3);
                else if (p.grupos.max_3 > 0) maxAgeCategory = Math.max(maxAgeCategory, 2);
                else if (p.grupos.max_2 > 0) maxAgeCategory = Math.max(maxAgeCategory, 1);
            });

            let colorClass = "text-white";
            if (maxAgeCategory === 3) colorClass = "text-danger font-black drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]";
            else if (maxAgeCategory === 2) colorClass = "text-warning font-bold";
            else if (maxAgeCategory === 1) colorClass = "text-info font-medium";

            if (a.programacionSalidas) {
                a.programacionSalidas.forEach(prog => {
                    if (!salidasTotales[prog.dia]) {
                        salidasTotales[prog.dia] = { total: 0, frizzers: [] };
                    }
                    salidasTotales[prog.dia].total += parseInt(prog.cantidad);
                    salidasTotales[prog.dia].frizzers.push({ 
                        nombre: a.nombre, 
                        cantidad: parseInt(prog.cantidad),
                        colorClass: colorClass
                    });
                    asignadoEsteCuarto += parseInt(prog.cantidad);
                });
            }

            const noAsignado = cuarto.totalProceso - asignadoEsteCuarto;
            if (noAsignado > 0) {
                totalNoAsignado += noAsignado;
                frizzersNoAsignados.push({ 
                    nombre: a.nombre, 
                    cantidad: noAsignado,
                    colorClass: colorClass
                });
            }
        });

        const ordenDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const diasConSalida = ordenDias.filter(d => salidasTotales[d] && salidasTotales[d].total > 0);

        const getNextDateForDay = (dayName) => {
            const diasMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const targetDay = diasMap[dayName];
            if (targetDay === undefined) return '';
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = targetDay - currentDay;
            if (daysToAdd < 0) daysToAdd += 7; // Si ya pasó, próxima semana
            
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);
            return targetDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        };

        let reporteHtml = '';
        if (diasConSalida.length > 0 || totalNoAsignado > 0) {
            
            // Construir texto para WhatsApp
            let textWhatsApp = "*REPORTE DE SALIDAS PROGRAMADAS*\n\n";
            diasConSalida.forEach(dia => {
                const data = salidasTotales[dia];
                const dateStr = getNextDateForDay(dia);
                textWhatsApp += `🗓️ *${dia.toUpperCase()}* (${dateStr})\n`;
                data.frizzers.forEach(f => {
                    textWhatsApp += `  - ${f.nombre}: ${f.cantidad} canastas\n`;
                });
                textWhatsApp += `  *TOTAL: ${data.total} canastas*\n\n`;
            });
            if (totalNoAsignado > 0) {
                textWhatsApp += `⚠️ *SIN ASIGNAR (Pendiente)*\n`;
                frizzersNoAsignados.forEach(f => {
                    textWhatsApp += `  - ${f.nombre}: ${f.cantidad} canastas\n`;
                });
                textWhatsApp += `  *TOTAL PENDIENTE: ${totalNoAsignado} canastas*\n`;
            }
            window.__reporteMaduracionText = textWhatsApp;

            reporteHtml = `
                <div class="surface-card p-5 border-l-4 border-primary shadow-lg mb-6 reporte-print-area">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <div>
                            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                                <i data-lucide="calendar-days" class="w-5 h-5 text-primary"></i>
                                Reporte Detallado de Salidas
                            </h3>
                            <div class="flex flex-wrap items-center gap-4 text-[11px] mt-2 font-bold tracking-wider uppercase">
                                <span class="text-danger drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]">Listas</span>
                                <span class="text-text-muted opacity-50">&bull;</span>
                                <span class="text-warning">Casi Listas</span>
                                <span class="text-text-muted opacity-50">&bull;</span>
                                <span class="text-info">1-2 Días</span>
                                <span class="text-text-muted opacity-50">&bull;</span>
                                <span class="text-white opacity-80">Fresco</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.compartirReporteMaduracion()" class="btn border border-border bg-surface-light text-text-secondary hover:text-success hover:border-success/50 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors" title="Compartir por WhatsApp">
                                <i data-lucide="message-circle" class="w-4 h-4"></i> <span class="hidden sm:inline">WhatsApp</span>
                            </button>
                            <button onclick="window.print()" class="btn border border-border bg-surface-light text-text-secondary hover:text-white hover:border-text-secondary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors" title="Imprimir Reporte">
                                <i data-lucide="printer" class="w-4 h-4"></i> <span class="hidden sm:inline">Imprimir</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-3">
                        ${diasConSalida.map(dia => {
                            const data = salidasTotales[dia];
                            const dateStr = getNextDateForDay(dia);
                            return `
                            <div class="bg-surface-light rounded-lg p-4 border border-border flex flex-col md:flex-row justify-between items-center gap-4 hover:border-primary/50 transition-colors">
                                <div class="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                                    <div class="text-primary font-black text-lg uppercase tracking-wider w-full md:w-32 text-center md:text-left">
                                        ${dia}
                                        <span class="text-text-muted text-xs block font-medium mt-0.5">${dateStr}</span>
                                    </div>
                                    <div class="flex flex-wrap justify-center md:justify-start gap-2 md:border-l md:border-border md:pl-4">
                                        ${data.frizzers.map(f => `
                                            <span class="bg-surface border border-border px-3 py-1 rounded text-sm text-text-secondary shadow-sm">
                                                <strong class="text-white">${f.nombre}</strong> <span class="text-text-muted mx-1">&rarr;</span> <span class="${f.colorClass}">${f.cantidad}</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="text-center md:text-right mt-2 md:mt-0 bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                                    <span class="text-2xl font-black text-primary">${data.total}</span>
                                    <span class="text-xs text-text-muted uppercase tracking-widest ml-1 font-bold">Total</span>
                                </div>
                            </div>
                            `;
                        }).join('')}
                        
                        ${totalNoAsignado > 0 ? `
                            <div class="bg-surface-light rounded-lg p-4 border border-warning flex flex-col md:flex-row justify-between items-center gap-4 hover:border-warning/50 transition-colors">
                                <div class="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                                    <div class="text-warning font-black text-lg uppercase tracking-wider w-full md:w-32 text-center md:text-left">
                                        SIN ASIGNAR
                                        <span class="text-text-muted text-xs block font-medium mt-0.5">Pendiente</span>
                                    </div>
                                    <div class="flex flex-wrap justify-center md:justify-start gap-2 md:border-l md:border-border md:pl-4">
                                        ${frizzersNoAsignados.map(f => `
                                            <span class="bg-surface border border-border px-3 py-1 rounded text-sm text-text-secondary shadow-sm">
                                                <strong class="text-white">${f.nombre}</strong> <span class="text-text-muted mx-1">&rarr;</span> <span class="${f.colorClass}">${f.cantidad}</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="text-center md:text-right mt-2 md:mt-0 bg-warning/10 px-4 py-2 rounded-lg border border-warning/20">
                                    <span class="text-2xl font-black text-warning">${totalNoAsignado}</span>
                                    <span class="text-xs text-text-muted uppercase tracking-widest ml-1 font-bold">Total</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        const reporteContainer = document.getElementById('reporte-salidas-programadas');
        if (reporteContainer) reporteContainer.innerHTML = reporteHtml;
        // -----------------------------------------------------

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

            const getFutureDateText = (daysToAdd) => {
                if (daysToAdd <= 0) return 'Hoy';
                const d = new Date();
                d.setDate(d.getDate() + daysToAdd);
                return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
            };

            const saleHoyStr = getFutureDateText(limiteDias);
            let sale1_2Str = '';
            if (limiteDias <= 2) {
                sale1_2Str = 'Pronto';
            } else if (limiteDias === 3) {
                sale1_2Str = getFutureDateText(1) + ' a ' + getFutureDateText(2);
            } else {
                sale1_2Str = getFutureDateText(limiteDias - 2) + ' a ' + getFutureDateText(limiteDias - 1);
            }
            const saleCasiStr = getFutureDateText(1);

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
                                    <th class="py-3 px-5 font-medium text-center leading-tight">
                                        Fresco (Hoy)<br>
                                        <span class="text-[10px] text-info normal-case font-bold opacity-80 mt-1 block capitalize">Sale: ${saleHoyStr}</span>
                                    </th>
                                    <th class="py-3 px-5 font-medium text-center leading-tight">
                                        1-2 Días<br>
                                        <span class="text-[10px] text-info normal-case font-bold opacity-80 mt-1 block capitalize">Sale: ${sale1_2Str}</span>
                                    </th>
                                    <th class="py-3 px-5 font-medium text-center leading-tight">
                                        Casi (${limiteDias - 1} Días)<br>
                                        <span class="text-[10px] text-info normal-case font-bold opacity-80 mt-1 block capitalize">Sale: ${saleCasiStr}</span>
                                    </th>
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

                        <!-- Nueva sección: Programación de Salidas por Cuarto -->
                        <div class="p-5 bg-surface/50 relative z-10 flex flex-col md:flex-row gap-6 border-t border-border/50">
                            <!-- Lista Actual -->
                            <div class="flex-1">
                                <h4 class="text-xs font-bold text-white mb-3 uppercase tracking-wider text-text-secondary flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4 text-primary"></i> Salidas Programadas</h4>
                                ${(!cuarto.almacen.programacionSalidas || cuarto.almacen.programacionSalidas.length === 0) 
                                    ? `<p class="text-sm text-text-muted italic bg-surface-light/30 px-3 py-2 rounded-lg inline-block">No hay salidas programadas para este frizzer.</p>`
                                    : `<div class="flex flex-wrap gap-2">
                                        ${cuarto.almacen.programacionSalidas.map(prog => `
                                            <div class="flex items-center gap-2 bg-surface-light border border-border hover:border-info/30 rounded-lg px-3 py-1.5 text-sm transition-colors group">
                                                <span class="text-text-secondary font-medium uppercase text-xs tracking-wider">${prog.dia}:</span>
                                                <span class="text-white font-bold text-base">${prog.cantidad}</span>
                                                <button onclick="window.deleteProgramacionFrizzer('${cuarto.almacen.id}', '${prog.id}')" class="text-text-muted hover:text-danger ml-2 transition-colors opacity-50 group-hover:opacity-100" title="Eliminar">
                                                    <i data-lucide="x" class="w-4 h-4"></i>
                                                </button>
                                            </div>
                                        `).join('')}
                                       </div>`
                                }
                            </div>
                            
                            <!-- Formulario para agregar -->
                            <div class="md:w-72 bg-surface-light p-4 rounded-lg border border-border shadow-inner">
                                <h4 class="text-[10px] font-bold text-text-muted mb-3 uppercase tracking-wider">Añadir Nueva Salida</h4>
                                <div class="flex gap-2">
                                    <select id="prog-dia-${cuarto.almacen.id}" class="form-input text-sm py-1.5 px-2 h-auto flex-1 border-border bg-surface">
                                        <option value="Lunes">Lunes</option>
                                        <option value="Martes">Martes</option>
                                        <option value="Miércoles">Miércoles</option>
                                        <option value="Jueves">Jueves</option>
                                        <option value="Viernes">Viernes</option>
                                        <option value="Sábado">Sábado</option>
                                        <option value="Domingo">Domingo</option>
                                    </select>
                                    <input type="number" id="prog-cant-${cuarto.almacen.id}" class="form-input text-sm py-1.5 px-2 h-auto w-24 border-border bg-surface text-center" placeholder="Cant." min="1">
                                </div>
                                <button onclick="window.addProgramacionFrizzer('${cuarto.almacen.id}')" class="btn btn-primary w-full text-xs mt-3 py-1.5 flex justify-center items-center gap-1">
                                    <i data-lucide="plus" class="w-3 h-3"></i> Programar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        gridEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

    }, 300); // Pequeño delay para permitir animación de entrada
}
