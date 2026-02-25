/**
 * Módulo de Gestión de Usuarios
 * Solo accesible para roles de Administrador.
 */

window.appModules = window.appModules || {};
window.appModuleEvents = window.appModuleEvents || {};

window.appModules['usuarios'] = () => {
    const usuarios = window.appStore.getUsuarios();
    // Obtener las rutas base disponibles en index.html (excluyendo dashboard)
    const allModules = [
        { id: 'recepcion', label: 'Recepción de Mercancía' },
        { id: 'despacho-vacias', label: 'Despacho Canastas Vacías' },
        { id: 'compra-canastas', label: 'Compra Canastas' },
        { id: 'transferencia', label: 'Transferencia Fincas' },
        { id: 'transferencia-interna', label: 'Transferencia Interna' },
        { id: 'despacho-cliente', label: 'Despacho a Cliente' },
        { id: 'recepcion-canastas', label: 'Devolución Canastas' },
        { id: 'decomiso', label: 'Decomiso' },
        { id: 'clientes', label: 'Catálogo: Clientes' },
        { id: 'productores', label: 'Catálogo: Productores' },
        { id: 'almacenes', label: 'Catálogo: Almacenes' },
        { id: 'productos', label: 'Catálogo: Productos' },
        { id: 'canastas-demas', label: 'Canastas de Fruta Demás' },
        { id: 'dashboard-semanal', label: 'Dashboard Semanal' }
    ];

    return `
        <div class="animate-fade-in max-w-5xl mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-white mb-2">Gestión de Usuarios</h2>
                    <p class="text-text-secondary">Administra los accesos y contraseñas de los empleados del sistema.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- User Form -->
                <div class="lg:col-span-1">
                    <form id="form-usuario" class="surface-card p-6 sticky top-6">
                        <h3 class="text-lg font-semibold text-white mb-4 border-b border-border pb-3">Nuevo Usuario</h3>
                        <input type="hidden" id="user-id">

                        <div class="space-y-4">
                            <div class="form-group">
                                <label class="form-label mb-1">Nombre de Usuario (Login)</label>
                                <input type="text" id="user-name" class="form-input" required autocomplete="off" placeholder="ej. juan.perez">
                            </div>

                            <div class="form-group">
                                <label class="form-label mb-1">Contraseña</label>
                                <input type="text" id="user-pass" class="form-input" required autocomplete="new-password" placeholder="Min. 6 caracteres">
                            </div>

                            <div class="form-group">
                                <label class="form-label mb-1">Rol en el Sistema</label>
                                <select id="user-rol" class="form-select" required>
                                    <option value="empleado" selected>Empleado (Restringible)</option>
                                    <option value="admin">Administrador (Acceso Total)</option>
                                </select>
                            </div>

                            <div id="permissions-block" class="pt-4 border-t border-border mt-4 transition-all">
                                <label class="form-label mb-2 text-warning font-semibold">Módulos Bloqueados (Sin Acceso)</label>
                                <p class="text-xs text-text-muted mb-3 leading-relaxed">Marca las casillas de las pantallas que este empleado <strong>NO podrá ver ni acceder</strong>.</p>
                                
                                <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2" id="modules-checkboxes">
                                    ${allModules.map(m => `
                                        <label class="flex items-start gap-3 p-2 rounded hover:bg-surface-light border border-transparent hover:border-border cursor-pointer transition-colors">
                                            <input type="checkbox" value="${m.id}" class="mt-1 module-block-cb rounded border-border bg-background text-danger focus:ring-danger/50 focus:ring-offset-background">
                                            <span class="text-sm text-text-secondary select-none">${m.label}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 flex gap-3">
                            <button type="reset" id="btn-cancel-user" class="btn btn-secondary flex-1 hidden">Cancelar</button>
                            <button type="submit" class="btn btn-primary flex-1 whitespace-nowrap">Guardar Usuario</button>
                        </div>
                    </form>
                </div>

                <!-- User List -->
                <div class="lg:col-span-2">
                    <div class="surface-card overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-surface-light text-text-secondary text-sm uppercase tracking-wider border-b border-border">
                                        <th class="py-4 px-5 font-semibold">Usuario</th>
                                        <th class="py-4 px-5 font-semibold w-24">Rol</th>
                                        <th class="py-4 px-5 font-semibold">Restricciones</th>
                                        <th class="py-4 px-5 font-semibold text-right w-24">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${usuarios.length === 0 ? `<tr><td colspan="4" class="py-12 text-center text-text-secondary">No hay usuarios.</td></tr>` : ''}
                                    ${usuarios.map(u => {
        const badgeColor = u.rol === 'admin' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface-light text-text-secondary border-border';
        return `
                                        <tr class="border-b border-border/50 hover:bg-surface-light/30 transition-colors group">
                                            <td class="py-3 px-5 text-white font-medium flex items-center gap-3">
                                                <div class="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border">
                                                    <i data-lucide="user" class="w-4 h-4 text-text-secondary"></i>
                                                </div>
                                                ${u.usuario}
                                            </td>
                                            <td class="py-3 px-5">
                                                <span class="px-2.5 py-1 rounded text-xs font-medium border ${badgeColor} uppercase tracking-wider">
                                                    ${u.rol}
                                                </span>
                                            </td>
                                            <td class="py-3 px-5 text-sm text-text-secondary">
                                                ${u.rol === 'admin' ?
                '<span class="text-success"><i data-lucide="shield-check" class="w-4 h-4 inline mr-1 pb-0.5"></i>Acceso Total</span>' :
                (u.modulosBloqueados?.length ? `${u.modulosBloqueados.length} bloqueados` : '<span class="text-text-muted">Sin restricciones</span>')}
                                            </td>
                                            <td class="py-3 px-5 text-right">
                                                <div class="flex justify-end gap-2">
                                                    <button type="button" class="btn-edit-user p-1.5 rounded hover:bg-primary/20 text-text-secondary hover:text-primary transition-colors" data-id="${u.id}" title="Editar Módulos">
                                                        <i data-lucide="edit-2" class="w-4 h-4 pointer-events-none"></i>
                                                    </button>
                                                    <button type="button" class="btn-delete-user p-1.5 rounded hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors ${u.usuario === 'admin' ? 'hidden' : ''}" data-id="${u.id}" title="Eliminar">
                                                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>`;
    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.appModuleEvents['usuarios'] = () => {
    const form = document.getElementById('form-usuario');
    const rolSelect = document.getElementById('user-rol');
    const permsBlock = document.getElementById('permissions-block');
    const btnCancel = document.getElementById('btn-cancel-user');

    if (!form) return;

    // Toggle permissions block based on role
    rolSelect.addEventListener('change', (e) => {
        if (e.target.value === 'admin') {
            permsBlock.style.opacity = '0.3';
            permsBlock.style.pointerEvents = 'none';
        } else {
            permsBlock.style.opacity = '1';
            permsBlock.style.pointerEvents = 'auto';
        }
    });

    btnCancel.addEventListener('click', () => {
        document.getElementById('user-id').value = '';
        btnCancel.classList.add('hidden');
        rolSelect.disabled = false;
        document.getElementById('user-name').disabled = false;
        permsBlock.style.opacity = '1';
        permsBlock.style.pointerEvents = 'auto';
    });

    // Form Submit (Crear/Actualizar)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('user-id').value;
        const usuario = document.getElementById('user-name').value.trim();
        const clave = document.getElementById('user-pass').value;
        const rol = rolSelect.value;

        if (clave.length < 4) {
            window.UI.showToast('La contraseña debe tener al menos 4 caracteres.', 'warning');
            return;
        }

        // Gather blocked modules
        const blocked = [];
        if (rol !== 'admin') {
            document.querySelectorAll('.module-block-cb:checked').forEach(cb => {
                blocked.push(cb.value);
            });
        }

        const btn = form.querySelector('button[type="submit"]');
        const orig = btn.innerHTML;
        btn.innerHTML = 'Guardando...';
        btn.disabled = true;

        try {
            await window.appStore.runTransaction(state => {
                if (!state.usuarios) state.usuarios = [];

                if (id) {
                    // Actualizar
                    const idx = state.usuarios.findIndex(u => u.id === id);
                    if (idx > -1) {
                        state.usuarios[idx].clave = clave;
                        state.usuarios[idx].modulosBloqueados = blocked;
                        // El nombre de usuario y rol de un usuario existente (especialmente admin) 
                        // puede ser editado pero restringiremos cambiar nombre por simplicidad.
                    }
                } else {
                    // Crear nuevo
                    if (state.usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())) {
                        throw new Error("Ya existe un usuario con este nombre.");
                    }
                    state.usuarios.push({
                        id: window.appStore.generateId(),
                        usuario,
                        clave,
                        rol,
                        modulosBloqueados: blocked,
                        createdAt: new Date().toISOString()
                    });
                }
            });
            window.UI.showToast('Usuario guardado exitosamente.');
            btnCancel.click(); // Reset form
        } catch (err) {
            window.UI.showToast(err.message, 'error');
        } finally {
            btn.innerHTML = orig;
            btn.disabled = false;
        }
    });

    // Edit and Delete buttons
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            const u = window.appStore.getUsuarios().find(x => x.id === id);
            if (!u) return;

            document.getElementById('user-id').value = u.id;
            document.getElementById('user-name').value = u.usuario;
            document.getElementById('user-name').disabled = true; // No rename for safety
            document.getElementById('user-pass').value = u.clave;
            rolSelect.value = u.rol;
            rolSelect.disabled = u.id === window.appStore.currentUser?.id; // Can't change own role easily

            // Dispatch change to apply visual styles
            rolSelect.dispatchEvent(new Event('change'));

            // Set checkboxes
            document.querySelectorAll('.module-block-cb').forEach(cb => {
                cb.checked = u.modulosBloqueados?.includes(cb.value);
            });

            btnCancel.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.closest('button').dataset.id;
            if (!confirm("¿Borrar definitivamente a este usuario?")) return;

            try {
                await window.appStore.runTransaction(state => {
                    const u = state.usuarios.find(x => x.id === id);
                    if (u?.usuario === 'admin') throw new Error("No puedes eliminar al administrador principal.");
                    state.usuarios = state.usuarios.filter(x => x.id !== id);
                });
                window.UI.showToast("Usuario eliminado.");
            } catch (err) {
                window.UI.showToast(err.message, "error");
            }
        });
    });
};
