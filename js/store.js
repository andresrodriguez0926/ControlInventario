/**
 * Store System (Firebase Firestore wrapper)
 * Maneja el almacenamiento y sincronización en tiempo real en la Nube.
 */

// 1. Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAlULkKEZZgDLqMbDlg7LxICKtBKBlU8jM",
    authDomain: "control-de-inventario-fbc21.firebaseapp.com",
    projectId: "control-de-inventario-fbc21",
    storageBucket: "control-de-inventario-fbc21.firebasestorage.app",
    messagingSenderId: "184469564601",
    appId: "1:184469564601:web:cb4f48a27bb86819dabf68"
};

// 2. Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 3. Habilitar persistencia offline para que funcione sin internet
db.enablePersistence().catch(console.error);

// 4. Estructura Local Mínima
const defaultData = {
    productores: [],
    almacenes: [],
    productos: [],
    clientes: [],
    inventario: {
        canastasLlenas: 0,
        canastasVacias: 0,
        despachadasProductor: 0,
        despachadasCliente: 0,
        porAlmacen: {}
    },
    actividad: [],
    usuarios: [],
    nextProductorId: 1,
    nextClienteId: 1,
    secuenciaDocumento: 0
};

class Store {
    constructor() {
        this.data = structuredClone(defaultData);
        this.dbRef = db.collection('appData').doc('mainState');
        this.isLoaded = false;

        this.listenToCloud();
    }

    // Escucha todos los cambios desde la Nube en Tiempo Real
    listenToCloud() {
        this.unsubscribe = this.dbRef.onSnapshot((doc) => {
            if (doc.exists) {
                this.data = doc.data();
            } else {
                // Primera vez, inicializar documento en Firebase
                this.data = structuredClone(defaultData);
                // Crear usuario admin por defecto si está vacío
                if (!this.data.usuarios) this.data.usuarios = [];
                this.data.usuarios.push({
                    id: this.generateId(),
                    usuario: 'admin',
                    clave: 'admin123',
                    rol: 'admin',
                    modulosBloqueados: [],
                    createdAt: new Date().toISOString()
                });
                this.dbRef.set(this.data);
            }

            // Migración: Asegurar que exista el arreglo de usuarios si los datos vienen de una versión anterior
            if (!this.data.usuarios || this.data.usuarios.length === 0) {
                this.data.usuarios = [{
                    id: this.generateId(),
                    usuario: 'admin',
                    clave: 'admin123',
                    rol: 'admin',
                    modulosBloqueados: [],
                    createdAt: new Date().toISOString()
                }];
                if (this.isLoaded) this.dbRef.set(this.data); // Save back to cloud on migration if already listening
            }

            this.isLoaded = true;
            window.dispatchEvent(new Event('store:updated'));
        }, (error) => {
            console.error("Error escuchando Firebase:", error);
            window.UI.showToast("Error de conexión a la Nube", "error");
        });
    }

    // Método Core Transaccional
    // Asegura que las operaciones se apliquen sobre el estado más reciente del servidor
    async runTransaction(operationFn) {
        if (!this.isLoaded) throw new Error("Cargando datos de la nube... Intente de nuevo.");

        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(this.dbRef);
                let serverData = doc.exists ? doc.data() : structuredClone(defaultData);

                // Ejecutamos la logica sobre serverData
                operationFn(serverData);

                transaction.set(this.dbRef, serverData);
            });
        } catch (e) {
            console.error("Error en Transacción Nube:", e);
            throw e;
        }
    }

    // Identificadores únicos
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // --- Getters Síncronos (Leen el caché local en tiempo real de 'this.data') ---
    getProductores() { return this.data.productores || []; }
    getAlmacenes() { return this.data.almacenes || []; }
    getProductos() { return this.data.productos || []; }
    getClientes() { return this.data.clientes || []; }
    getUsuarios() { return this.data.usuarios || []; }

    getActividad(limit = 10) {
        return [...(this.data.actividad || [])]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }

    getStats() {
        const inv = this.data.inventario || { canastasLlenas: 0, canastasVacias: 0 };

        const topDeudoresProductores = (this.data.productores || [])
            .filter(p => (p.canastasPrestadas || 0) > 0)
            .sort((a, b) => b.canastasPrestadas - a.canastasPrestadas)
            .slice(0, 5)
            .map(p => ({ nombre: p.nombre, deuda: p.canastasPrestadas }));

        const topDeudoresClientes = (this.data.clientes || [])
            .filter(c => (c.canastasPrestadas || 0) > 0)
            .sort((a, b) => b.canastasPrestadas - a.canastasPrestadas)
            .slice(0, 5)
            .map(c => ({ nombre: c.nombre, deuda: c.canastasPrestadas }));

        // Calcular resumen de frutas (canastas llenas por tipo)
        const resumenFrutasMap = {};
        if (inv.porAlmacen) {
            Object.values(inv.porAlmacen).forEach(almacenData => {
                Object.entries(almacenData).forEach(([key, val]) => {
                    if (key !== 'vacias' && val > 0) {
                        resumenFrutasMap[key] = (resumenFrutasMap[key] || 0) + val;
                    }
                });
            });
        }

        const resumenFrutas = Object.entries(resumenFrutasMap)
            .map(([productoId, cantidad]) => {
                const p = (this.data.productos || []).find(x => x.id === productoId);
                return {
                    nombre: p ? p.nombre : 'Producto ' + productoId,
                    cantidad
                };
            })
            .sort((a, b) => b.cantidad - a.cantidad);

        return {
            totalProductos: (this.data.productos || []).length,
            totalAlmacenes: (this.data.almacenes || []).length,
            canastasLlenas: inv.canastasLlenas || 0,
            canastasVacias: inv.canastasVacias || 0,
            despachadasProductor: inv.despachadasProductor || 0,
            despachadasCliente: inv.despachadasCliente || 0,
            topDeudoresProductores,
            topDeudoresClientes,
            resumenFrutas
        };
    }

    getInventarioPorAlmacen() {
        return (this.data.inventario && this.data.inventario.porAlmacen) ? this.data.inventario.porAlmacen : {};
    }

    // Helper interno para actividad
    _registrarActividad(state, operacion, detalle, cantidad, customDate = null, rawPayload = null) {
        if (!state.actividad) state.actividad = [];

        // Autoincrementar Secuencia de Documento
        state.secuenciaDocumento = (state.secuenciaDocumento || 0) + 1;
        const numDocFormateado = "DOC-" + String(state.secuenciaDocumento).padStart(4, '0');

        let actDate = new Date();
        if (customDate) {
            // Adjust to keep the current time for sorting purposes but with the selected date
            const [year, month, day] = customDate.split('-');
            actDate.setFullYear(year, month - 1, day);
        }

        const logItem = {
            id: this.generateId(),
            numeroDocumento: numDocFormateado,
            date: actDate.toISOString(),
            operacion,
            detalle,
            cantidad,
            usuario: this.currentUser?.usuario || 'Sistema'
        };

        if (rawPayload) {
            logItem.rawPayload = rawPayload;
        }

        state.actividad.push(logItem);
        if (state.actividad.length > 1500) {
            state.actividad = state.actividad.slice(-1500);
        }
    }

    // ===============================================
    // AUTENTICACIÓN
    // ===============================================

    async login(usuario, clave) {
        if (!this.isLoaded) throw new Error("Cargando datos de la nube... Intente de nuevo en un segundo.");

        const usrStr = String(usuario).trim().toLowerCase();
        const passStr = String(clave).trim();

        const user = this.data.usuarios?.find(u => u.usuario.toLowerCase() === usrStr && u.clave === passStr);
        if (!user) {
            throw new Error("Usuario o contraseña incorrectos.");
        }

        // Guardar la sesión local (en memoria/caché del navegador)
        // No almacenamos contraseñas, solo el estado activo
        const sesion = {
            id: user.id,
            usuario: user.usuario,
            rol: user.rol,
            modulosBloqueados: user.modulosBloqueados || []
        };
        sessionStorage.setItem('app_session', JSON.stringify(sesion));

        return sesion;
    }

    logout() {
        sessionStorage.removeItem('app_session');
        window.location.reload(); // Recargar la UI para forzar la pantalla de login
    }

    get currentUser() {
        const sesion = sessionStorage.getItem('app_session');
        return sesion ? JSON.parse(sesion) : null;
    }

    // ===============================================
    // OPERACIONES (Todas son Asincronas ahora)
    // ===============================================

    // --- Mantenimientos ---

    async addProductor(productor) {
        await this.runTransaction(state => {
            productor.id = this.generateId();
            productor.numeroId = state.nextProductorId || 1;
            state.nextProductorId = (state.nextProductorId || 1) + 1;
            productor.createdAt = new Date().toISOString();
            if (!state.productores) state.productores = [];
            state.productores.push(productor);
        });
    }

    async updateProductor(id, data) {
        await this.runTransaction(state => {
            if (!state.productores) state.productores = [];
            const index = state.productores.findIndex(p => p.id === id);
            if (index === -1) throw new Error("Productor no encontrado en la Nube.");
            state.productores[index] = { ...state.productores[index], ...data };
        });
    }

    async deleteProductor(id) {
        await this.runTransaction(state => {
            if (!state.productores) return;
            const b = state.productores.find(p => p.id === id);
            if (!b) return;

            // Verificación de historial
            if (state.actividad && state.actividad.some(a => a.detalle.includes(b.nombre))) {
                throw new Error("No se puede eliminar: El Productor tiene historial de transacciones y está bloqueado por seguridad contable.");
            }
            state.productores = state.productores.filter(p => p.id !== id);
        });
    }

    async addCliente(cliente) {
        await this.runTransaction(state => {
            cliente.id = this.generateId();
            cliente.numeroId = state.nextClienteId || 1;
            state.nextClienteId = (state.nextClienteId || 1) + 1;
            cliente.createdAt = new Date().toISOString();
            if (!state.clientes) state.clientes = [];
            state.clientes.push(cliente);
        });
    }

    async updateCliente(id, data) {
        await this.runTransaction(state => {
            if (!state.clientes) state.clientes = [];
            const index = state.clientes.findIndex(c => c.id === id);
            if (index === -1) throw new Error("Cliente no encontrado en la Nube.");
            state.clientes[index] = { ...state.clientes[index], ...data };
        });
    }

    async deleteCliente(id) {
        await this.runTransaction(state => {
            if (!state.clientes) return;
            const b = state.clientes.find(c => c.id === id);
            if (!b) return;

            // Verificación de historial
            if (state.actividad && state.actividad.some(a => a.detalle.includes(b.nombre))) {
                throw new Error("No se puede eliminar: El Cliente tiene historial de transacciones y está bloqueado por seguridad contable.");
            }
            state.clientes = state.clientes.filter(c => c.id !== id);
        });
    }

    async addAlmacen(almacen) {
        await this.runTransaction(state => {
            almacen.id = this.generateId();
            almacen.createdAt = new Date().toISOString();
            if (!state.almacenes) state.almacenes = [];
            state.almacenes.push(almacen);

            if (!state.inventario) state.inventario = { canastasLlenas: 0, canastasVacias: 0, porAlmacen: {} };
            if (!state.inventario.porAlmacen) state.inventario.porAlmacen = {};
            state.inventario.porAlmacen[almacen.id] = { vacias: 0 };
        });
    }

    async updateAlmacen(id, data) {
        await this.runTransaction(state => {
            const index = state.almacenes.findIndex(a => a.id === id);
            if (index === -1) throw new Error("Almacén no encontrado en la Nube.");
            state.almacenes[index] = { ...state.almacenes[index], ...data };
        });
    }

    async deleteAlmacen(id) {
        await this.runTransaction(state => {
            const inv = state.inventario.porAlmacen[id];

            // Verificación estricta de historial o inventario
            if (inv) {
                const total = Object.values(inv).reduce((sum, val) => sum + val, 0);
                if (total > 0) {
                    throw new Error("No se puede eliminar: El almacén contiene canastas actualmente.");
                }
                if (Object.keys(inv).length > 1) {
                    throw new Error("No se puede eliminar: El almacén tiene historial de transacciones. Está bloqueado por seguridad contable.");
                }
            }

            state.almacenes = state.almacenes.filter(a => a.id !== id);
            if (state.inventario.porAlmacen[id]) {
                delete state.inventario.porAlmacen[id];
            }
        });
    }

    async addProducto(producto) {
        await this.runTransaction(state => {
            producto.id = this.generateId();
            producto.createdAt = new Date().toISOString();
            if (!state.productos) state.productos = [];
            state.productos.push(producto);
        });
    }

    // --- Core Operacional ---

    async recepcionMercancia({ productorId, lotes, personaEntrega, personaRecibe, fechaRecepcion, numeroConduce }) {
        await this.runTransaction(state => {
            const productor = state.productores.find(p => p.id === productorId);
            const prestadas = productor ? (productor.canastasPrestadas || 0) : 0;
            const productorName = productor?.nombre || 'Desconocido';

            // Calculate total quantity across all lots
            const totalCantidad = lotes.reduce((sum, lote) => sum + parseInt(lote.cantidad), 0);

            if (prestadas < totalCantidad) {
                throw new Error(`El productor solo tiene prestadas ${prestadas} canastas. No puede registrar recepción de ${totalCantidad}.`);
            }

            // Process each lot specifically to its target warehouse
            lotes.forEach(lote => {
                const cant = parseInt(lote.cantidad);
                const almId = lote.almacenId;

                if (!state.inventario.porAlmacen[almId]) {
                    state.inventario.porAlmacen[almId] = { vacias: 0 };
                }
                const invAlmacen = state.inventario.porAlmacen[almId];
                invAlmacen[lote.productoId] = (invAlmacen[lote.productoId] || 0) + cant;
            });

            state.inventario.canastasLlenas += totalCantidad;
            state.inventario.despachadasProductor = Math.max(0, (state.inventario.despachadasProductor || 0) - totalCantidad);

            if (productor) productor.canastasPrestadas = Math.max(0, prestadas - totalCantidad);

            // Resumen for history display
            let detalleStr = `De: ${productorName}, Recibe: ${personaRecibe}`;
            if (lotes.length === 1) {
                const productoName = state.productos.find(p => p.id === lotes[0].productoId)?.nombre || 'Desconocido';
                detalleStr += `, Prod: ${productoName}`;
            } else {
                detalleStr += `, Prod: Varios (+${lotes.length})`;
            }

            const rawPayload = { productorId, lotes, personaEntrega, personaRecibe, fechaRecepcion, numeroConduce };
            // For backward compatibility with older widgets that might still read rawPayload.productoId, rawPayload.cantidad, and rawPayload.almacenDestinoId
            rawPayload.productoId = lotes[0].productoId;
            rawPayload.cantidad = totalCantidad;
            rawPayload.almacenDestinoId = lotes[0].almacenId;

            this._registrarActividad(state, 'Recepción', detalleStr, `+${totalCantidad} llenas`, fechaRecepcion, rawPayload);
        });
    }

    async editarRecepcion(idActividad, nuevoPayload) {
        const nuevaCantidadTotal = parseInt(nuevoPayload.cantidad);
        await this.runTransaction(state => {
            const actIndex = state.actividad.findIndex(a => a.id === idActividad);
            if (actIndex === -1) throw new Error("No se encontró el registro de actividad para modificar.");

            const actividadObj = state.actividad[actIndex];
            if (!actividadObj.rawPayload) {
                throw new Error("No se puede editar: Este registro es demasiado antiguo y no contiene los datos técnicos necesarios para revertir el inventario seguramente.");
            }

            const old = actividadObj.rawPayload;
            const cantAntigua = parseInt(old.cantidad);

            let lotesOld = old.lotes;
            if (!lotesOld) {
                lotesOld = [{
                    productoId: old.productoId,
                    cantidad: old.cantidad,
                    almacenId: old.almacenDestinoId
                }];
            }

            // 1. REVERTIR IMPACTO ANTIGUO
            const oldProductor = state.productores.find(p => p.id === old.productorId);
            if (oldProductor) {
                // Devolver deuda al productor (antes se le había restado)
                oldProductor.canastasPrestadas = (oldProductor.canastasPrestadas || 0) + cantAntigua;
            }

            lotesOld.forEach(lote => {
                const almId = lote.almacenId || old.almacenDestinoId;
                const invAlmacenOld = state.inventario.porAlmacen[almId];
                if (invAlmacenOld && invAlmacenOld[lote.productoId]) {
                    invAlmacenOld[lote.productoId] = Math.max(0, invAlmacenOld[lote.productoId] - parseInt(lote.cantidad));
                }
            });

            state.inventario.canastasLlenas = Math.max(0, state.inventario.canastasLlenas - cantAntigua);
            state.inventario.despachadasProductor = (state.inventario.despachadasProductor || 0) + cantAntigua;

            // 2. APLICAR NUEVO IMPACTO
            const newProductor = state.productores.find(p => p.id === nuevoPayload.productorId);
            const prestadasActuales = newProductor ? (newProductor.canastasPrestadas || 0) : 0;

            if (prestadasActuales < nuevaCantidadTotal) {
                throw new Error(`El productor solo tiene prestadas ${prestadasActuales} canastas en este momento. La nueva edición falla matemáticamente.`);
            }

            nuevoPayload.lotes.forEach(lote => {
                const cant = parseInt(lote.cantidad);
                const almId = lote.almacenId;
                if (!state.inventario.porAlmacen[almId]) {
                    state.inventario.porAlmacen[almId] = { vacias: 0 };
                }
                const invAlmacenNew = state.inventario.porAlmacen[almId];
                invAlmacenNew[lote.productoId] = (invAlmacenNew[lote.productoId] || 0) + cant;
            });

            state.inventario.canastasLlenas += nuevaCantidadTotal;
            state.inventario.despachadasProductor = Math.max(0, (state.inventario.despachadasProductor || 0) - nuevaCantidadTotal);

            if (newProductor) newProductor.canastasPrestadas = Math.max(0, prestadasActuales - nuevaCantidadTotal);

            // 3. ACTUALIZAR REGISTRO DE ACTIVIDAD
            const productorName = newProductor?.nombre || 'Desconocido';
            let detalleStr = `De: ${productorName}, Recibe: ${nuevoPayload.personaRecibe} (EDITADO)`;

            if (nuevoPayload.lotes.length === 1) {
                const productoName = state.productos.find(p => p.id === nuevoPayload.lotes[0].productoId)?.nombre || 'Desconocido';
                detalleStr += `, Prod: ${productoName}`;
            } else {
                detalleStr += `, Prod: Varios (+${nuevoPayload.lotes.length})`;
            }

            actividadObj.detalle = detalleStr;
            actividadObj.cantidad = `+${nuevaCantidadTotal} llenas`;

            const rawPayload = { ...old, ...nuevoPayload };
            // For backward compatibility
            rawPayload.productoId = nuevoPayload.lotes[0].productoId;
            rawPayload.cantidad = nuevaCantidadTotal;
            rawPayload.almacenDestinoId = nuevoPayload.lotes[0].almacenId;
            actividadObj.rawPayload = rawPayload;

            if (nuevoPayload.fechaRecepcion) {
                const [year, month, day] = nuevoPayload.fechaRecepcion.split('-');
                let actDate = new Date(actividadObj.date);
                actDate.setFullYear(year, month - 1, day);
                actividadObj.date = actDate.toISOString();
            }
        });
    }

    async despachoVacias({ personaRetira, cantidad, productorId, almacenOrigenId, fechaDespacho }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            const invAlmacen = state.inventario.porAlmacen[almacenOrigenId];
            if (!invAlmacen || invAlmacen.vacias < cantidad) {
                throw new Error(`En la Nube: No hay vacías suficientes. Disponibles: ${invAlmacen?.vacias || 0}`);
            }

            invAlmacen.vacias -= cantidad;
            state.inventario.canastasVacias -= cantidad;
            state.inventario.despachadasProductor = (state.inventario.despachadasProductor || 0) + cantidad;

            const productor = state.productores.find(p => p.id === productorId);
            if (productor) productor.canastasPrestadas = (productor.canastasPrestadas || 0) + cantidad;

            const productorName = productor?.nombre || 'Desconocido';

            const rawPayload = { personaRetira, cantidad, productorId, almacenOrigenId, fechaDespacho };
            this._registrarActividad(state, 'Desp. Vacías', `A productor: ${productorName}, Retira: ${personaRetira}`, `-${cantidad} vacías`, fechaDespacho, rawPayload);
        });
    }

    async editarDespachoVacias(idActividad, nuevoPayload) {
        const nuevaCantidad = parseInt(nuevoPayload.cantidad);
        await this.runTransaction(state => {
            const actIndex = state.actividad.findIndex(a => a.id === idActividad);
            if (actIndex === -1) throw new Error("No se encontró el registro de actividad para modificar.");

            const actividadObj = state.actividad[actIndex];
            if (!actividadObj.rawPayload) {
                throw new Error("No se puede editar: Este registro es antiguo y no contiene los datos técnicos necesarios para revertirlo.");
            }

            const old = actividadObj.rawPayload;
            const cantAntigua = parseInt(old.cantidad);

            // 1. REVERTIR IMPACTO ANTIGUO
            const invAlmacenOld = state.inventario.porAlmacen[old.almacenOrigenId];
            if (invAlmacenOld) {
                invAlmacenOld.vacias = (invAlmacenOld.vacias || 0) + cantAntigua;
            }
            state.inventario.canastasVacias = (state.inventario.canastasVacias || 0) + cantAntigua;
            state.inventario.despachadasProductor = Math.max(0, (state.inventario.despachadasProductor || 0) - cantAntigua);

            const oldProductor = state.productores.find(p => p.id === old.productorId);
            if (oldProductor) {
                oldProductor.canastasPrestadas = Math.max(0, (oldProductor.canastasPrestadas || 0) - cantAntigua);
            }

            // 2. APLICAR NUEVO IMPACTO
            const invAlmacenNew = state.inventario.porAlmacen[nuevoPayload.almacenOrigenId];
            if (!invAlmacenNew || (invAlmacenNew.vacias || 0) < nuevaCantidad) {
                throw new Error(`Matemáticamente inválido: El almacén de origen no tiene suficientes vacías para la nueva cantidad (${nuevaCantidad}). Disponibles: ${invAlmacenNew?.vacias || 0}`);
            }

            invAlmacenNew.vacias -= nuevaCantidad;
            state.inventario.canastasVacias -= nuevaCantidad;
            state.inventario.despachadasProductor = (state.inventario.despachadasProductor || 0) + nuevaCantidad;

            const newProductor = state.productores.find(p => p.id === nuevoPayload.productorId);
            if (newProductor) {
                newProductor.canastasPrestadas = (newProductor.canastasPrestadas || 0) + nuevaCantidad;
            }

            // 3. ACTUALIZAR REGISTRO DE ACTIVIDAD
            const productorName = newProductor?.nombre || 'Desconocido';

            actividadObj.detalle = `A productor: ${productorName}, Retira: ${nuevoPayload.personaRetira} (EDITADO)`;
            actividadObj.cantidad = `-${nuevaCantidad} vacías`;
            actividadObj.rawPayload = { ...old, ...nuevoPayload };

            if (nuevoPayload.fechaDespacho) {
                const [year, month, day] = nuevoPayload.fechaDespacho.split('-');
                let actDate = new Date(actividadObj.date);
                actDate.setFullYear(year, month - 1, day);
                actividadObj.date = actDate.toISOString();
            }
        });
    }

    async transferenciaFincas({ personaTransfiere, productorOrigenId, productorDestinoId, cantidad, fechaTransferencia }) {
        cantidad = parseInt(cantidad);
        // productorOrigenId y productorDestinoId son strings (base36 generados), NO usar parseInt()
        await this.runTransaction(state => {
            const pOrigenObj = state.productores.find(p => p.id === productorOrigenId);
            const prestadasOrigen = pOrigenObj ? (pOrigenObj.canastasPrestadas || 0) : 0;

            if (prestadasOrigen < cantidad) {
                throw new Error(`El productor origen solo tiene prestadas ${prestadasOrigen} canastas. No puede transferir ${cantidad}.`);
            }

            const pDestinoObj = state.productores.find(p => p.id === productorDestinoId);

            if (pOrigenObj) pOrigenObj.canastasPrestadas = Math.max(0, prestadasOrigen - cantidad);
            if (pDestinoObj) pDestinoObj.canastasPrestadas = (pDestinoObj.canastasPrestadas || 0) + cantidad;

            const pOrigen = pOrigenObj?.nombre || 'Desconocido';
            const pDestino = pDestinoObj?.nombre || 'Desconocido';

            const rawPayload = { personaTransfiere, productorOrigenId, productorDestinoId, cantidad, fechaTransferencia };
            this._registrarActividad(state, 'Transf. Fincas', `De: ${pOrigen} a ${pDestino} por ${personaTransfiere}`, `${cantidad} canastas`, fechaTransferencia, rawPayload);
        });
    }

    async despachoCliente({ fecha, clienteNombre, detalles }) {
        await this.runTransaction(state => {
            let total = 0;
            const frutasDespachadas = {};

            for (const det of detalles) {
                const cant = parseInt(det.cantidad);
                const invAlmacen = state.inventario.porAlmacen[det.almacenOrigenId];

                if (!invAlmacen || !invAlmacen[det.productoId] || invAlmacen[det.productoId] < cant) {
                    const pName = state.productos.find(p => p.id === det.productoId)?.nombre || 'Producto';
                    throw new Error(`Cloud Alert: Inventario insuficiente de ${pName} en este almacén.`);
                }
                invAlmacen[det.productoId] -= cant;
                state.inventario.canastasLlenas -= cant;
                total += cant;

                const pName = state.productos.find(p => p.id === det.productoId)?.nombre || 'Producto';
                frutasDespachadas[pName] = (frutasDespachadas[pName] || 0) + cant;
            }
            state.inventario.despachadasCliente = (state.inventario.despachadasCliente || 0) + total;

            const cliente = state.clientes.find(c => c.nombre === clienteNombre);
            if (cliente) cliente.canastasPrestadas = (cliente.canastasPrestadas || 0) + total;

            const detallesStr = Object.entries(frutasDespachadas).map(([f, c]) => `${f} (${c})`).join(', ');

            const rawPayload = { clienteNombre, detalles, total, fecha };
            this._registrarActividad(state, 'Desp. Cliente', `A cliente: ${clienteNombre} | ${detallesStr}`, `-${total} llenas`, fecha, rawPayload);
        });
    }

    async editarDespachoCliente(idActividad, nuevoPayload) {
        const nuevaCantidadTotal = parseInt(nuevoPayload.total);
        await this.runTransaction(state => {
            const actIndex = state.actividad.findIndex(a => a.id === idActividad);
            if (actIndex === -1) throw new Error("No se encontró el registro de actividad para modificar.");

            const actividadObj = state.actividad[actIndex];
            if (!actividadObj.rawPayload) {
                throw new Error("No se puede editar: Este registro es demasiado antiguo y no contiene los datos técnicos necesarios.");
            }

            const old = actividadObj.rawPayload;
            const cantAntigua = parseInt(old.total);

            // 1. REVERTIR IMPACTO ANTIGUO
            // Devolver mercancía a almacenes
            old.detalles.forEach(det => {
                const invAlmacenOld = state.inventario.porAlmacen[det.almacenOrigenId];
                if (invAlmacenOld) {
                    invAlmacenOld[det.productoId] = (invAlmacenOld[det.productoId] || 0) + parseInt(det.cantidad);
                }
            });

            state.inventario.canastasLlenas += cantAntigua;
            state.inventario.despachadasCliente = Math.max(0, (state.inventario.despachadasCliente || 0) - cantAntigua);

            const oldCliente = state.clientes.find(c => c.nombre === old.clienteNombre);
            if (oldCliente) {
                oldCliente.canastasPrestadas = Math.max(0, (oldCliente.canastasPrestadas || 0) - cantAntigua);
            }

            // 2. APLICAR NUEVO IMPACTO
            const frutasDespachadas = {};
            for (const det of nuevoPayload.detalles) {
                const cant = parseInt(det.cantidad);
                const invAlmacen = state.inventario.porAlmacen[det.almacenOrigenId];

                if (!invAlmacen || !invAlmacen[det.productoId] || invAlmacen[det.productoId] < cant) {
                    const pName = state.productos.find(p => p.id === det.productoId)?.nombre || 'Producto';
                    throw new Error(`Error en Edición: Inventario insuficiente de ${pName} en el almacén seleccionado.`);
                }
                invAlmacen[det.productoId] -= cant;
                state.inventario.canastasLlenas -= cant;

                const pName = state.productos.find(p => p.id === det.productoId)?.nombre || 'Producto';
                frutasDespachadas[pName] = (frutasDespachadas[pName] || 0) + cant;
            }

            state.inventario.despachadasCliente += nuevaCantidadTotal;

            const newCliente = state.clientes.find(c => c.nombre === nuevoPayload.clienteNombre);
            if (newCliente) {
                newCliente.canastasPrestadas = (newCliente.canastasPrestadas || 0) + nuevaCantidadTotal;
            }

            // 3. ACTUALIZAR REGISTRO DE ACTIVIDAD
            const detallesStr = Object.entries(frutasDespachadas).map(([f, c]) => `${f} (${c})`).join(', ');
            actividadObj.detalle = `A cliente: ${nuevoPayload.clienteNombre} | ${detallesStr} (EDITADO)`;
            actividadObj.cantidad = `-${nuevaCantidadTotal} llenas`;
            actividadObj.rawPayload = { ...nuevoPayload };

            if (nuevoPayload.fecha) {
                const [year, month, day] = nuevoPayload.fecha.split('-');
                let actDate = new Date(actividadObj.date);
                actDate.setFullYear(year, month - 1, day);
                actividadObj.date = actDate.toISOString();
            }
        });
    }

    async recepcionCanastas({ tipoOrigen = 'cliente', clienteNombre, productorId, cantidad, esLlena, productoId, almacenDestinoId, fechaRecepcion }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            let entidadName = 'Desconocido';
            let deudaActual = 0;
            let cliente = null;
            let productor = null;

            if (tipoOrigen === 'productor') {
                productor = state.productores.find(p => p.id === productorId);
                deudaActual = productor ? (productor.canastasPrestadas || 0) : 0;
                entidadName = productor?.nombre || 'Productor';
            } else {
                cliente = state.clientes.find(c => c.nombre === clienteNombre);
                deudaActual = cliente ? (cliente.canastasPrestadas || 0) : 0;
                entidadName = clienteNombre;
            }

            if (deudaActual < cantidad) {
                const tipoStr = tipoOrigen === 'productor' ? 'El productor' : 'El cliente';
                throw new Error(`${tipoStr} solo debe ${deudaActual} canastas. No puede devolver ${cantidad}.`);
            }

            if (!state.inventario.porAlmacen[almacenDestinoId]) state.inventario.porAlmacen[almacenDestinoId] = { vacias: 0 };
            const invAlmacen = state.inventario.porAlmacen[almacenDestinoId];

            if (esLlena && productoId) {
                invAlmacen[productoId] = (invAlmacen[productoId] || 0) + cantidad;
                state.inventario.canastasLlenas += cantidad;
                const pName = state.productos.find(p => p.id === productoId)?.nombre || 'Producto';

                const rawPayload = { tipoOrigen, clienteNombre, productorId, esLlena, productoId, almacenDestinoId, pName, fechaRecepcion };
                const dtStr = tipoOrigen === 'productor' ? `De Productor: ${entidadName} (Llenas de ${pName})` : `De Cliente: ${clienteNombre} (Llenas de ${pName})`;
                this._registrarActividad(state, 'Devolución', dtStr, `+${cantidad} llenas`, fechaRecepcion, rawPayload);
            } else {
                invAlmacen.vacias += cantidad;
                state.inventario.canastasVacias += cantidad;

                const rawPayload = { tipoOrigen, clienteNombre, productorId, cantidad, esLlena, productoId, almacenDestinoId, fechaRecepcion };
                const dtStr = tipoOrigen === 'productor' ? `De Productor: ${entidadName} (Vacías)` : `De Cliente: ${entidadName} (Vacías)`;
                this._registrarActividad(state, 'Devolución', dtStr, `+${cantidad} vacías`, fechaRecepcion, rawPayload);
            }

            if (tipoOrigen === 'productor') {
                state.inventario.despachadasProductor = Math.max(0, (state.inventario.despachadasProductor || 0) - cantidad);
                if (productor) productor.canastasPrestadas = Math.max(0, (productor.canastasPrestadas || 0) - cantidad);
            } else {
                state.inventario.despachadasCliente = Math.max(0, (state.inventario.despachadasCliente || 0) - cantidad);
                if (cliente) cliente.canastasPrestadas = Math.max(0, (cliente.canastasPrestadas || 0) - cantidad);
            }
        });
    }

    async compraCanastas({ proveedorNombre, cantidad, almacenDestinoId, personaRecibe, fechaCompra }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            if (!state.inventario.porAlmacen[almacenDestinoId]) state.inventario.porAlmacen[almacenDestinoId] = { vacias: 0 };

            const invAlmacen = state.inventario.porAlmacen[almacenDestinoId];
            invAlmacen.vacias += cantidad;
            state.inventario.canastasVacias += cantidad;

            this._registrarActividad(state, 'Compra', `De: ${proveedorNombre}, Recibe: ${personaRecibe}`, `+${cantidad} vacías`, fechaCompra, { proveedorNombre, cantidad, almacenDestinoId, personaRecibe, fechaCompra });
        });
    }

    async transferenciaInterna({ almacenOrigenId, almacenDestinoId, productoIdActual, productoIdNuevo, cantidad, personaTransfiere, fechaTransferencia, canastasVacias, almacenDestinoVaciasId }) {
        cantidad = parseInt(cantidad);
        canastasVacias = parseInt(canastasVacias) || 0;
        await this.runTransaction(state => {
            if (almacenOrigenId === almacenDestinoId && productoIdActual === productoIdNuevo && canastasVacias === 0) {
                throw new Error("El origen/producto y destino/producto no pueden ser exactamente los mismos.");
            }

            const invOrigen = state.inventario.porAlmacen[almacenOrigenId];
            if (!invOrigen || !invOrigen[productoIdActual] || invOrigen[productoIdActual] < cantidad) {
                const pName = state.productos.find(p => p.id === productoIdActual)?.nombre || 'Producto';
                throw new Error(`Inventario insuficiente: No hay ${cantidad} canastas llenas de ${pName} en el almacén de origen.`);
            }

            // Descontar llenas del origen
            invOrigen[productoIdActual] -= cantidad;

            // Sumar llenas al destino (con el producto que será ahora)
            if (!state.inventario.porAlmacen[almacenDestinoId]) state.inventario.porAlmacen[almacenDestinoId] = { vacias: 0 };
            const invDestino = state.inventario.porAlmacen[almacenDestinoId];
            invDestino[productoIdNuevo] = (invDestino[productoIdNuevo] || 0) + cantidad;

            // (La cantidad GLOBAL de "canastas llenas" no cambia, solo se mueven de lugar/tipo)

            // --- TRAZABILIDAD DE VACÍAS ---
            let vaciasStr = '';
            if (canastasVacias > 0 && almacenDestinoVaciasId) {
                const disponiblesVacias = invOrigen.vacias || 0;
                if (disponiblesVacias < canastasVacias) {
                    throw new Error(`Vacías insuficientes en origen. Disponibles: ${disponiblesVacias}, solicitadas: ${canastasVacias}.`);
                }
                // Descontar vacías del origen
                invOrigen.vacias -= canastasVacias;
                state.inventario.canastasVacias -= canastasVacias;

                // Sumar vacías al destino de vacías
                if (!state.inventario.porAlmacen[almacenDestinoVaciasId]) state.inventario.porAlmacen[almacenDestinoVaciasId] = { vacias: 0 };
                state.inventario.porAlmacen[almacenDestinoVaciasId].vacias += canastasVacias;
                state.inventario.canastasVacias += canastasVacias;

                vaciasStr = ` | Vacías: ${canastasVacias}`;
            }

            const pStr = productoIdActual === productoIdNuevo ? 'Misma Fruta' : 'Cambio Fruta';
            const rawPayload = { almacenOrigenId, almacenDestinoId, productoIdActual, productoIdNuevo, cantidad, personaTransfiere, fechaTransferencia, canastasVacias, almacenDestinoVaciasId };
            this._registrarActividad(state, 'Transf. Interna', `Mueve: ${personaTransfiere} (${pStr})${vaciasStr}`, `${cantidad} llenas${canastasVacias > 0 ? ` + ${canastasVacias} vacías` : ''}`, fechaTransferencia, rawPayload);
        });
    }

    async decomiso({ cantidad, productoId, almacenOrigenId, almacenVaciasId, motivo, descripcion, fechaDecomiso }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            const invOrigen = state.inventario.porAlmacen[almacenOrigenId];
            if (!invOrigen || !invOrigen[productoId] || invOrigen[productoId] < cantidad) {
                throw new Error(`Cloud Alert: Fruta insuficiente para decomisar.`);
            }
            if (!state.inventario.porAlmacen[almacenVaciasId]) state.inventario.porAlmacen[almacenVaciasId] = { vacias: 0 };
            const invVacias = state.inventario.porAlmacen[almacenVaciasId];

            invOrigen[productoId] -= cantidad;
            state.inventario.canastasLlenas -= cantidad;
            invVacias.vacias += cantidad;
            state.inventario.canastasVacias += cantidad;

            const pName = state.productos.find(p => p.id === productoId)?.nombre || 'Producto';
            const descStr = descripcion ? ` - ${descripcion}` : '';
            this._registrarActividad(state, 'Decomiso', `Producto: ${pName} | Motivo: ${motivo}${descStr}`, `${cantidad} vaciadas`, fechaDecomiso, { cantidad, productoId, almacenOrigenId, almacenVaciasId, motivo, descripcion, fechaDecomiso });
        });
    }

    async canastasDemas({ cantidad, productoId, almacenOrigenId, almacenDestinoId, fechaLlenado }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            const invOrigen = state.inventario.porAlmacen[almacenOrigenId];

            if (!invOrigen || invOrigen.vacias < cantidad) {
                throw new Error(`Cloud Alert: Vacías insuficientes en el almacén de origen. Disponibles: ${invOrigen?.vacias || 0}`);
            }

            // Descontar vacías
            invOrigen.vacias -= cantidad;
            state.inventario.canastasVacias -= cantidad;

            // Sumar llenas
            if (!state.inventario.porAlmacen[almacenDestinoId]) state.inventario.porAlmacen[almacenDestinoId] = { vacias: 0 };
            const invDestino = state.inventario.porAlmacen[almacenDestinoId];
            invDestino[productoId] = (invDestino[productoId] || 0) + cantidad;
            state.inventario.canastasLlenas += cantidad;

            const pName = state.productos.find(p => p.id === productoId)?.nombre || 'Producto';
            this._registrarActividad(state, 'Fruta Demás', `Llenadas con: ${pName}`, `+${cantidad} llenadas`, fechaLlenado, { cantidad, productoId, almacenOrigenId, almacenDestinoId, fechaLlenado });
        });
    }

    async bajaCanastasVacias({ almacenId, cantidad, personaBaja, descripcion, fechaBaja }) {
        cantidad = parseInt(cantidad);
        await this.runTransaction(state => {
            const invOrigen = state.inventario.porAlmacen[almacenId];

            if (!invOrigen || invOrigen.vacias < cantidad) {
                throw new Error(`Vacías insuficientes en el almacén. Disponibles: ${invOrigen?.vacias || 0}`);
            }

            // Descontar vacías físicamente
            invOrigen.vacias -= cantidad;
            state.inventario.canastasVacias -= cantidad;

            this._registrarActividad(
                state,
                'Salida Canastas',
                `Baja autorizada por: ${personaBaja} - ${descripcion}`,
                `-${cantidad} vacías`,
                fechaBaja,
                { almacenId, cantidad, personaBaja, descripcion, fechaBaja }
            );
        });
    }

    async applyDataFixes() {
        await this.runTransaction(state => {
            // 1. Fix date for known documents
            const docsToFixDate = ["DOC-0137", "DOC-0139", "DOC-0140", "DOC-0143"];
            const newDateStr = "2026-02-26T12:00:00.000Z";

            let processedCount = 0;
            if (state.actividad) {
                // Pre-buscar IDs para reparaciones por nombre
                const almRampa = state.almacenes.find(a => a.nombre.toUpperCase().includes('RAMPA'))?.id;
                const almFrizzer10 = state.almacenes.find(a => a.nombre.toUpperCase().includes('FRIZZER 10') || a.nombre.toUpperCase().includes('FREEZER 10'))?.id;
                const almMaduracion = state.almacenes.find(a => a.nombre.toUpperCase().includes('MADURACI'))?.id;
                const prodGuineoMaduro = state.productos.find(p => p.nombre.toUpperCase().includes('GUINEO MADURO'))?.id;
                const prodGuineoVerde = state.productos.find(p => p.nombre.toUpperCase().includes('GUINEO VERDE'))?.id;

                // Mapa de almacén por documento para DOC-0177 a DOC-0180
                const almacenPorDoc = {
                    'DOC-0177': almRampa,
                    'DOC-0178': almMaduracion,
                    'DOC-0179': almRampa,
                    'DOC-0180': almRampa,
                };

                state.actividad.forEach(act => {
                    // Fix fechas grupo 1: documentos al 2026-02-26
                    if (docsToFixDate.includes(act.numeroDocumento)) {
                        act.date = newDateStr;
                        processedCount++;
                    }

                    // Fix fechas grupo 2: documentos 177-180 al 2026-02-27
                    if (['DOC-0177', 'DOC-0178', 'DOC-0179', 'DOC-0180'].includes(act.numeroDocumento)) {
                        act.date = '2026-02-27T12:00:00.000Z';
                        processedCount++;
                    }

                    // Reparación Quirúrgica DOC-0177 a DOC-0180 (Despachos sin rawPayload)
                    if (almacenPorDoc[act.numeroDocumento] && !act.rawPayload) {
                        const almId = almacenPorDoc[act.numeroDocumento];
                        // Intentar extraer cantidad del campo 'cantidad' (ej: "-50 llenas")
                        const cantMatch = String(act.cantidad || '').match(/\d+/);
                        const cant = cantMatch ? parseInt(cantMatch[0]) : 0;
                        act.rawPayload = {
                            clienteNombre: act.detalle?.match(/A cliente:\s*(.*?)\s*\|/)?.[1] || 'No registrado',
                            fecha: act.date?.slice(0, 10),
                            total: cant,
                            detalles: [{
                                almacenOrigenId: almId,
                                productoId: null,   // No se puede recuperar sin el dato original
                                cantidad: cant
                            }]
                        };
                        processedCount++;
                    }

                    // Reparación Quirúrgica DOC-0150 (Guineo Maduro - Filling)
                    if (act.numeroDocumento === 'DOC-0150' && !act.rawPayload) {
                        act.operacion = 'Fruta Demás';
                        act.detalle = 'Llenadas con: GUINEO MADURO';
                        act.cantidad = '+111 llenadas';
                        act.rawPayload = {
                            cantidad: 111,
                            productoId: prodGuineoMaduro || 'guineo-maduro-id', // Fallback if find fails
                            almacenOrigenId: almRampa || 'rampa-id',
                            almacenDestinoId: almFrizzer10 || 'frizzer-10-id',
                            fechaLlenado: act.date.slice(0, 10)
                        };
                        processedCount++;
                    }

                    // Reparación Quirúrgica DOC-0151 (Guineo Verde - Filling)
                    // Según el historial anterior, 151 es "GUINEO VERDE (40)"
                    if (act.numeroDocumento === 'DOC-0151' && !act.rawPayload) {
                        act.operacion = 'Fruta Demás';
                        act.detalle = 'Llenadas con: GUINEO VERDE';
                        act.cantidad = '+40 llenadas';
                        act.rawPayload = {
                            cantidad: 40,
                            productoId: prodGuineoVerde || 'guineo-verde-id',
                            almacenOrigenId: almRampa || 'rampa-id', // Asumimos mismo origen si no se especificó
                            almacenDestinoId: almFrizzer10 || 'frizzer-10-id',
                            fechaLlenado: act.date.slice(0, 10)
                        };
                        processedCount++;
                    }
                });
            }
            console.log(`[DataFix] Processed ${processedCount} records.`);
        });
    }

    async reset() {
        await this.dbRef.set(structuredClone(defaultData));
    }
}

window.appStore = new Store();
