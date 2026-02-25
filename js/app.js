/**
 * Archivo Principal - Inicialización
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Interfaz (UI, Rutas, Sidebar)
    window.UI.init();

    // 2. Inicializar Gráficos Chart.js
    window.appCharts.init();

    // 3. Esperar a que la tienda (Firebase) envíe los datos iniciales
    // Escuchando el evento personalizado emitido por store.js
    let initialRenderDone = false;

    window.addEventListener('store:updated', () => {
        // Renderizar Dashboard si estamos en él
        if (!window.location.hash || window.location.hash === '#dashboard') {
            window.appCharts.render();
            initialRenderDone = true;
        } else if (window.location.hash === '#dashboard-semanal') {
            if (window.appCharts) window.appCharts.renderWeeklyDashboard();
            initialRenderDone = true;
        } else {
            const hashResult = window.location.hash.replace('#', '');

            // Renderizar la vista actual basada en el hash
            // Verificar si hay datos en algún formulario activo para no borrarlos
            let hasUnsavedData = false;
            if (initialRenderDone) {
                const activeView = document.querySelector('.page-view.active');
                if (activeView) {
                    const inputs = activeView.querySelectorAll('input:not([type="hidden"]):not(.searchable-select-container input), select, textarea');
                    inputs.forEach(el => {
                        if (el.tagName === 'SELECT') {
                            if (el.selectedIndex > 0 && el.options[0].disabled) hasUnsavedData = true; // Selected something other than placeholder
                            else if (el.selectedIndex > -1 && el.value !== '') hasUnsavedData = true;
                        } else if (el.type === 'checkbox' || el.type === 'radio') {
                            if (el.checked) hasUnsavedData = true;
                        } else {
                            if (el.value && el.value.trim() !== '' && el.value !== '0') hasUnsavedData = true;
                        }
                    });
                }
            }

            if (!initialRenderDone || !hasUnsavedData) {
                window.UI.renderModuleContainer(hashResult);
                initialRenderDone = true;
            }
        }
    });

    // Timeout de fallback por si falla la conexión y no se dispara store:updated
    setTimeout(() => {
        if (!window.appStore.isLoaded) {
            window.UI.showToast("Cargando web offline, esperando conexión...", "info");
            if (!window.location.hash || window.location.hash === '#dashboard') {
                window.appCharts.render();
            }
        }
    }, 5000);
});

// ==========================================
// Funciones Globales UI (Modales)
// ==========================================
window.modificarRecepcion = function (idActividad) {
    const user = window.appStore.currentUser;
    if (!user || user.rol !== 'admin') {
        window.UI.showToast("No tienes permisos para editar registros.", "error");
        return;
    }

    const actividad = window.appStore.getActividad(1000).find(a => a.id === idActividad);
    if (!actividad || !actividad.rawPayload) {
        window.UI.showToast("Este registro es muy antiguo y no contiene los datos técnicos necesarios para revertirlo.", "error");
        return;
    }

    const payload = actividad.rawPayload;

    // Rellenar Modal Basico
    document.getElementById('edit-rec-id').value = idActividad;
    document.getElementById('edit-rec-fecha').value = payload.fechaRecepcion || actividad.date.slice(0, 10);
    document.getElementById('edit-rec-entrega').value = payload.personaEntrega;
    document.getElementById('edit-rec-recibe').value = payload.personaRecibe;

    const selectProductor = document.getElementById('edit-rec-productor');
    selectProductor.innerHTML = window.appStore.getProductores().map(p => `<option value="${p.id}" ${p.id === payload.productorId ? 'selected' : ''}>${p.nombre}</option>`).join('');

    // Lotes Dinámicos
    const tbodyLotes = document.querySelector('#tabla-edit-rec-lotes tbody');
    tbodyLotes.innerHTML = ''; // Limpiar previo

    let lotesToEdit = payload.lotes;
    if (!lotesToEdit) {
        // Retrocompatibilidad
        lotesToEdit = [{
            productoId: payload.productoId,
            cantidad: payload.cantidad,
            almacenId: payload.almacenDestinoId
        }];
    }

    const productos = window.appStore.getProductos();
    const almacenes = window.appStore.getAlmacenes();

    const generateOptions = (items, selectedId) => {
        return items.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.nombre}</option>`).join('');
    };

    lotesToEdit.forEach(lote => {
        const tr = document.createElement('tr');
        tr.className = 'edit-rec-lote-row border-b border-border/50';
        tr.innerHTML = `
            <td class="p-2">
                <select class="form-select text-sm edit-lot-prod" required>
                    ${generateOptions(productos, lote.productoId)}
                </select>
            </td>
            <td class="p-2">
                <input type="number" class="form-input text-sm edit-lot-cant" min="1" required value="${lote.cantidad}">
            </td>
            <td class="p-2">
                <select class="form-select text-sm edit-lot-alm" required>
                    ${generateOptions(almacenes, lote.almacenId || payload.almacenDestinoId)}
                </select>
            </td>
            <td class="p-2 text-center">
                <button type="button" class="text-text-muted hover:text-danger p-1 disabled:opacity-50 btn-remove-edit-rec-lote">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbodyLotes.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons({ root: tbodyLotes });

    const updateRemoveButtons = () => {
        const rows = tbodyLotes.querySelectorAll('tr');
        const btns = tbodyLotes.querySelectorAll('.btn-remove-edit-rec-lote');
        btns.forEach(btn => btn.disabled = rows.length <= 1);
    };
    updateRemoveButtons();

    // Mostrar modal
    document.getElementById('modal-editar-recepcion').classList.remove('hidden');
};

// Event Listener Submit Edicion Recepcion
document.addEventListener('DOMContentLoaded', () => {
    const formEditRec = document.getElementById('form-editar-recepcion');
    if (formEditRec) {
        // Event listener para añadir lote
        const btnAddEditLote = document.getElementById('btn-add-edit-rec-lote');
        const tbodyEditLotes = document.querySelector('#tabla-edit-rec-lotes tbody');

        if (btnAddEditLote && tbodyEditLotes) {
            btnAddEditLote.addEventListener('click', () => {
                const firstRow = tbodyEditLotes.querySelector('tr');
                if (!firstRow) return;
                const newRow = firstRow.cloneNode(true);

                newRow.querySelector('.edit-lot-prod').value = '';
                newRow.querySelector('.edit-lot-cant').value = '';
                newRow.querySelector('.edit-lot-alm').value = '';

                tbodyEditLotes.appendChild(newRow);
                if (window.lucide) window.lucide.createIcons({ root: newRow });

                const updateRemoveButtons = () => {
                    const rows = tbodyEditLotes.querySelectorAll('tr');
                    const btns = tbodyEditLotes.querySelectorAll('.btn-remove-edit-rec-lote');
                    btns.forEach(btn => btn.disabled = rows.length <= 1);
                };
                updateRemoveButtons();
            });

            // Delegación de eventos para eliminar fila
            tbodyEditLotes.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-remove-edit-rec-lote');
                if (btn && !btn.disabled) {
                    btn.closest('tr').remove();
                    const rows = tbodyEditLotes.querySelectorAll('tr');
                    const btns = tbodyEditLotes.querySelectorAll('.btn-remove-edit-rec-lote');
                    btns.forEach(b => b.disabled = rows.length <= 1);
                }
            });
        }

        formEditRec.addEventListener('submit', async (e) => {
            e.preventDefault();

            const rows = document.querySelectorAll('.edit-rec-lote-row');
            const lotes = [];
            let hasErrors = false;
            let totalCantidad = 0;

            rows.forEach(row => {
                const prod = row.querySelector('.edit-lot-prod').value;
                const cant = parseInt(row.querySelector('.edit-lot-cant').value);
                const alm = row.querySelector('.edit-lot-alm').value;

                if (!prod || !cant || isNaN(cant) || cant <= 0 || !alm) {
                    hasErrors = true;
                } else {
                    lotes.push({ productoId: prod, cantidad: cant, almacenId: alm });
                    totalCantidad += cant;
                }
            });

            if (hasErrors || lotes.length === 0) {
                window.UI.showToast('Revise la mercancía ingresada. Faltan productos, cantidades o almacenes de destino.', 'error');
                return;
            }

            const btn = formEditRec.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
            btn.disabled = true;

            const idActividad = document.getElementById('edit-rec-id').value;
            const nuevoPayload = {
                productorId: document.getElementById('edit-rec-productor').value,
                lotes: lotes,
                cantidad: totalCantidad,
                personaEntrega: document.getElementById('edit-rec-entrega').value,
                personaRecibe: document.getElementById('edit-rec-recibe').value,
                fechaRecepcion: document.getElementById('edit-rec-fecha').value
            };

            try {
                await window.appStore.editarRecepcion(idActividad, nuevoPayload);
                window.UI.showToast("Recepción actualizada. Inventarios recalculados correctamente.", "success");
                document.getElementById('modal-editar-recepcion').classList.add('hidden');

                // Refrescar tabla si estamos en la vista
                if (window.location.hash.includes('recepcion')) {
                    window.UI.renderModuleContainer('recepcion');
                    // Cambiar a la tab historial de nuevo automáticamente
                    setTimeout(() => {
                        document.getElementById('tab-btn-historial')?.click();
                    }, 100);
                }
            } catch (error) {
                window.UI.showToast(error.message, "error");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    const formEditVac = document.getElementById('form-editar-despacho-vacias');
    if (formEditVac) {
        formEditVac.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formEditVac.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
            btn.disabled = true;

            const idActividad = document.getElementById('edit-vac-id').value;
            const nuevoPayload = {
                productorId: document.getElementById('edit-vac-productor').value,
                cantidad: document.getElementById('edit-vac-cantidad').value,
                personaRetira: document.getElementById('edit-vac-retira').value,
                almacenOrigenId: document.getElementById('edit-vac-almacen').value,
                fechaDespacho: document.getElementById('edit-vac-fecha').value
            };

            try {
                await window.appStore.editarDespachoVacias(idActividad, nuevoPayload);
                window.UI.showToast("Despacho de vacías actualizado correctamente.", "success");
                document.getElementById('modal-editar-despacho-vacias').classList.add('hidden');

                // Refrescar tabla si estamos en la vista
                if (window.location.hash.includes('despacho-vacias')) {
                    window.UI.renderModuleContainer('despacho-vacias');
                    setTimeout(() => {
                        document.getElementById('tab-btn-historial-vac')?.click();
                    }, 100);
                }
            } catch (error) {
                window.UI.showToast(error.message, "error");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});

window.modificarDespachoVacias = function (idActividad) {
    const user = window.appStore.currentUser;
    if (!user || user.rol !== 'admin') {
        window.UI.showToast("No tienes permisos para editar registros.", "error");
        return;
    }

    const actividad = window.appStore.getActividad(1000).find(a => a.id === idActividad);
    if (!actividad || !actividad.rawPayload) {
        window.UI.showToast("Este registro es muy antiguo y no contiene los datos técnicos necesarios para revertirlo.", "error");
        return;
    }

    const payload = actividad.rawPayload;

    // Rellenar Modal
    document.getElementById('edit-vac-id').value = idActividad;
    document.getElementById('edit-vac-fecha').value = payload.fechaDespacho || actividad.date.slice(0, 10);
    document.getElementById('edit-vac-retira').value = payload.personaRetira;
    document.getElementById('edit-vac-cantidad').value = payload.cantidad;

    // Llenar Selects Dinámicos
    const selectProductor = document.getElementById('edit-vac-productor');
    const selectAlmacen = document.getElementById('edit-vac-almacen');

    selectProductor.innerHTML = window.appStore.getProductores().map(p => `<option value="${p.id}" ${p.id === payload.productorId ? 'selected' : ''}>${p.nombre}</option>`).join('');
    selectAlmacen.innerHTML = window.appStore.getAlmacenes().map(a => `<option value="${a.id}" ${a.id === payload.almacenOrigenId ? 'selected' : ''}>${a.nombre}</option>`).join('');

    // Mostrar modal
    document.getElementById('modal-editar-despacho-vacias').classList.remove('hidden');
};

// ==========================================
// Visor de Documento de Orígen
// ==========================================
window.exportarRecepcionesExcel = function (startDateStr = '', endDateStr = '') {
    let actividad = window.appStore.getActividad(2000).filter(a => a.operacion === 'Recepción');

    // Filter by dates if provided (Avoiding timezone UTC shift by parsing explicitly)
    if (startDateStr) {
        const [year, month, day] = startDateStr.split('-');
        const start = new Date(year, month - 1, day);
        start.setHours(0, 0, 0, 0);
        actividad = actividad.filter(a => new Date(a.date) >= start);
    }
    if (endDateStr) {
        const [year, month, day] = endDateStr.split('-');
        const end = new Date(year, month - 1, day);
        end.setHours(23, 59, 59, 999);
        actividad = actividad.filter(a => new Date(a.date) <= end);
    }

    if (actividad.length === 0) {
        window.UI.showToast("No hay registros en el rango de fechas para exportar.", "warning");
        return;
    }

    const productores = window.appStore.getProductores();
    const productos = window.appStore.getProductos();

    // CSV Headers con UTF-8 BOM y sep=; para que Excel lea columnas y acentos automáticamente
    let csvContent = "\uFEFF"; // BOM
    csvContent += "sep=;\n"; // Le dice a Excel qué separador usar explícitamente
    csvContent += "Numero de Documento;Fecha;Nombre del Productor;No. de Conduce;Persona que Recibe;Productos;Cantidad de Canastas\n";

    actividad.forEach(a => {
        const doc = a.numeroDocumento || 'S/N';
        const fecha = new Date(a.date).toLocaleDateString();

        let nomProductor = 'Desconocido';
        let personaRecibe = 'Desconocido';
        let noConduce = 'N/A';

        if (a.rawPayload) {
            const p = productores.find(x => x.id === a.rawPayload.productorId);
            nomProductor = p ? p.nombre : (a.rawPayload.productorId || 'Desconocido');
            personaRecibe = a.rawPayload.personaRecibe || '';
            noConduce = a.rawPayload.numeroConduce || 'N/A';
        }

        if (a.rawPayload && a.rawPayload.lotes && a.rawPayload.lotes.length > 0) {
            a.rawPayload.lotes.forEach(lote => {
                const prodName = productos.find(x => x.id === lote.productoId)?.nombre || lote.productoId;
                const cantStr = typeof lote.cantidad === 'string' ? lote.cantidad.replace(/[^0-9]/g, '') : lote.cantidad;
                const row = [
                    `"${doc}"`,
                    `"${fecha}"`,
                    `"${nomProductor}"`,
                    `"${noConduce}"`,
                    `"${personaRecibe}"`,
                    `"${prodName}"`,
                    `"${cantStr}"`
                ];
                csvContent += row.join(";") + "\n";
            });
        } else {
            let prodsStr = 'Varios';
            let cantStr = typeof a.cantidad === 'string' ? a.cantidad.replace(/[^0-9]/g, '') : a.cantidad;

            if (a.rawPayload && a.rawPayload.productoId) {
                prodsStr = productos.find(x => x.id === a.rawPayload.productoId)?.nombre || a.rawPayload.productoId;
            }

            const row = [
                `"${doc}"`,
                `"${fecha}"`,
                `"${nomProductor}"`,
                `"${noConduce}"`,
                `"${personaRecibe}"`,
                `"${prodsStr}"`,
                `"${cantStr}"`
            ];
            csvContent += row.join(";") + "\n";
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `Reporte_Recepciones_${dateStr}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

// ==========================================
window.verDocumentoOrigen = function (idActividad) {
    const actividad = window.appStore.getActividad(2000).find(a => a.id === idActividad);
    if (!actividad) {
        window.UI.showToast("Documento no encontrado.", "error");
        return;
    }

    // 1. Cabecera
    document.getElementById('doc-view-numero').textContent = actividad.numeroDocumento || 'S/N';
    document.getElementById('doc-view-fecha').textContent = new Date(actividad.date).toLocaleString();
    document.getElementById('doc-view-operacion').textContent = actividad.operacion;
    document.getElementById('doc-view-cantidad').textContent = actividad.cantidad;

    // 2. Detalles Técnicos (Raw Payload)
    const container = document.getElementById('doc-view-dinamico');
    container.innerHTML = ''; // Limpiar previo

    let payload = actividad.rawPayload;

    // Tratamos de reconstruir un payload básico para documentos antiguos de "Transf. Fincas"
    if (!payload && (actividad.operacion.includes('Transf. Fincas') || actividad.operacion.includes('Transferencia'))) {
        const match = actividad.detalle.match(/De:\s*(.*?)\s*a\s*(.*?)(?:\s*por\s*(.*))?$/);
        if (match) {
            payload = {
                esHeredado: true,
                productorOrigenText: match[1],
                productorDestinoText: match[2],
                personaTransfiereText: match[3] || 'No registrado'
            };
        }
    }

    // Tratamos de reconstruir un payload básico para documentos antiguos de "Desp. Cliente"
    if (!payload && (actividad.operacion.includes('Desp. Cliente') || actividad.operacion.includes('Despacho a Cliente'))) {
        const match = actividad.detalle.match(/A cliente:\s*(.*?)\s*\|\s*(.*)$/);
        if (match) {
            payload = {
                esHeredado: true,
                clienteNombre: match[1],
                frutasStr: match[2]
            };
        }
    }

    if (payload) {
        const addRow = (label, value) => {
            if (value === undefined || value === null || value === '') return;
            container.innerHTML += `
                <div class="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-border/30">
                    <span class="text-text-muted text-sm">${label}</span>
                    <span class="text-white text-sm font-medium text-right">${value}</span>
                </div>
            `;
        };

        // Resolviendo nombres legibles desde IDs
        const getProductorName = id => window.appStore.getProductores().find(p => p.id === id)?.nombre || id;
        const getProductoName = id => window.appStore.getProductos().find(p => p.id === id)?.nombre || id;
        const getAlmacenName = id => window.appStore.getAlmacenes().find(a => a.id === id)?.nombre || id;

        // Mostrar datos según el tipo de operación
        if (actividad.operacion === 'Recepción') {
            addRow('Productor', getProductorName(payload.productorId));

            if (payload.lotes && payload.lotes.length > 0) {
                payload.lotes.forEach((lote, index) => {
                    const extraData = lote.almacenId ? ` -> ${getAlmacenName(lote.almacenId)}` : '';
                    addRow(`Producto ${index + 1}`, `${getProductoName(lote.productoId)} (${lote.cantidad} canastas)${extraData}`);
                });
            } else {
                addRow('Producto', getProductoName(payload.productoId));
            }

            if (!payload.lotes || payload.lotes.length === 0 || !payload.lotes[0].almacenId) {
                // Retrocompatibilidad: Muestra un destino global si es rec antigua sin almacén en lote
                addRow('Almacén Destino', getAlmacenName(payload.almacenDestinoId));
            }

            if (payload.numeroConduce) {
                addRow('No. de conduce', payload.numeroConduce);
            }

            addRow('Entregado por', payload.personaEntrega);
            addRow('Recibido por', payload.personaRecibe);
            addRow('Fecha Técnica', payload.fechaRecepcion);
        } else if (actividad.operacion === 'Desp. Vacías') {
            addRow('Productor Destino', getProductorName(payload.productorId));
            addRow('Almacén Orígen', getAlmacenName(payload.almacenOrigenId));
            addRow('Retirado por', payload.personaRetira);
            addRow('Fecha Técnica', payload.fechaDespacho);
        } else if (actividad.operacion.includes('Transf. Fincas') || actividad.operacion.includes('Transferencia')) {
            if (payload.esHeredado) {
                // Caso reconstruido (Heredado)
                addRow('Productor Orígen', payload.productorOrigenText);
                addRow('Productor Destino', payload.productorDestinoText);
                addRow('Transferido por', payload.personaTransfiereText);
            } else {
                // Caso moderno
                addRow('Productor Orígen', getProductorName(payload.productorOrigenId));
                addRow('Productor Destino', getProductorName(payload.productorDestinoId));
                addRow('Transferido por', payload.personaTransfiere);
                if (payload.fechaTransferencia) addRow('Fecha Técnica', payload.fechaTransferencia);
            }
        } else if (actividad.operacion === 'Transf. Interna') {
            addRow('Almacén Orígen', getAlmacenName(payload.almacenOrigenId));
            addRow('Almacén Destino', getAlmacenName(payload.almacenDestinoId));
            addRow('Producto Transferido', getProductoName(payload.productoIdActual));
            if (payload.productoIdActual !== payload.productoIdNuevo) {
                addRow('Reclasificado a', getProductoName(payload.productoIdNuevo));
            }
            addRow('Transferido por', payload.personaTransfiere);
            if (payload.fechaTransferencia) addRow('Fecha Técnica', payload.fechaTransferencia);
        } else if (actividad.operacion.includes('Desp. Cliente') || actividad.operacion.includes('Despacho a Cliente')) {
            if (payload.esHeredado) {
                // Caso reconstruido
                addRow('Cliente Destino', payload.clienteNombre);
                addRow('Frutas Canastas', payload.frutasStr);
            } else {
                // Caso moderno
                addRow('Cliente Destino', payload.clienteNombre);
                if (payload.fecha) addRow('Fecha Técnica', payload.fecha);

                if (payload.detalles && payload.detalles.length > 0) {
                    payload.detalles.forEach((det, idx) => {
                        const pname = getProductoName(det.productoId);
                        const aname = getAlmacenName(det.almacenId);
                        addRow(`Detalle ${idx + 1}`, `${pname} (${det.cantidad} canastas) desde ${aname}`);
                    });
                }
            }
        } else {
            // Fallback genérico para otros payloads
            Object.entries(payload).forEach(([key, val]) => {
                if (key !== 'cantidad' && key !== 'esHeredado') addRow(key, val);
            });
        }
    } else {
        // No hay rawPayload ni pudo ser reconstruido (Transacción genérica antigua)
        container.innerHTML = `
            <div class="bg-surface-light border border-border p-4 rounded-lg">
                <p class="text-text-secondary text-sm mb-2"><strong>Detalle Original:</strong></p>
                <p class="text-white text-sm">${actividad.detalle}</p>
                <div class="mt-4 flex gap-2 items-center text-warning text-xs">
                    <i data-lucide="info" class="w-4 h-4"></i>
                    <span>Este es un documento heredado. No contiene trazabilidad rápida extendida.</span>
                </div>
            </div>
        `;
    }

    // Agregar el usuario que registró la actividad si está disponible
    if (actividad.usuario) {
        container.innerHTML += `
            <div class="flex flex-col md:flex-row md:items-center justify-between mt-4 border-t border-border/50 pt-4">
                <span class="text-text-secondary text-sm flex items-center gap-1"><i data-lucide="shield-check" class="w-4 h-4 text-primary"></i> Registrado en el sistema por el usuario:</span>
                <span class="text-white text-sm font-bold px-3 py-1 bg-surface-light rounded-md border border-border">
                    ${actividad.usuario}
                </span>
            </div>
        `;
    }

    if (window.lucide) window.lucide.createIcons();
    document.getElementById('modal-ver-documento').classList.remove('hidden');
};
