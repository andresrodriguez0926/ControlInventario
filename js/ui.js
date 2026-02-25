/**
 * UI Controls and Navigation Model
 */

const UI = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.initLucideIcons();
        this.updateDashboard();

        // -----------------------------
        // Auth Check
        // -----------------------------
        const user = window.appStore.currentUser;
        if (!user) {
            // Not logged in
            document.getElementById('login-wrapper').classList.remove('hidden');
            document.getElementById('app-wrapper').classList.add('hidden', 'opacity-0');
        } else {
            // Logged in
            document.getElementById('login-wrapper').classList.add('hidden');
            const appWrapper = document.getElementById('app-wrapper');
            appWrapper.classList.remove('hidden');

            // Set user display name
            const displayEl = document.getElementById('current-user-display');
            if (displayEl) displayEl.textContent = user.usuario;

            // Apply Roles & Permissions to Sidebar Menus
            this.applyPermissions(user);

            // Cargar primera vista (dashboard)
            setTimeout(() => {
                appWrapper.classList.remove('opacity-0');
                this.navigate(window.location.hash || '#dashboard');
            }, 50);
        }

        // Escuchar cambios en store
        window.addEventListener('store:updated', () => {
            this.updateDashboard();
        });
    },

    cacheDOM() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.btnOpenSidebar = document.getElementById('open-sidebar');
        this.btnCloseSidebar = document.getElementById('close-sidebar');
        this.navItems = document.querySelectorAll('.nav-item');
        this.pagesContainer = document.getElementById('pages-container');
        this.dynamicContainer = document.getElementById('dynamic-pages-container');
        this.toastContainer = document.getElementById('toast-container');
        this.btnReset = document.getElementById('reset-data');

        // Auth DOM
        this.loginForm = document.getElementById('login-form');
        this.btnLogout = document.getElementById('btn-logout');
    },

    bindEvents() {
        // Mobile Sidebar
        this.btnOpenSidebar.addEventListener('click', () => this.toggleSidebar(true));
        this.btnCloseSidebar.addEventListener('click', () => this.toggleSidebar(false));
        this.sidebarOverlay.addEventListener('click', () => this.toggleSidebar(false));

        // Navigation
        window.addEventListener('hashchange', () => {
            this.navigate(window.location.hash);
        });

        // Navigation links
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (window.innerWidth < 768) {
                    this.toggleSidebar(false);
                }
            });
        });

        // Reset
        this.btnReset.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) {
                window.appStore.reset();
                this.showToast('Datos limpiados correctamente', 'success');
                window.location.reload();
            }
        });

        // Login Submit
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = document.getElementById('login-user').value;
                const pass = document.getElementById('login-pass').value;
                const btn = this.loginForm.querySelector('button[type="submit"]');

                try {
                    btn.disabled = true;
                    btn.innerHTML = `<span class="relative z-10 flex items-center justify-center gap-2"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Validando...</span>`;
                    await window.appStore.login(user, pass);
                    window.location.reload(); // Reload to initialize authorized app
                } catch (err) {
                    this.showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `<span class="relative z-10 flex items-center justify-center gap-2"><span>Iniciar Sesión</span><i data-lucide="arrow-right" class="w-4 h-4 transition-transform group-hover:translate-x-1"></i></span>`;
                    this.initLucideIcons();
                }
            });
        }

        // Logout
        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', () => {
                window.appStore.logout();
            });
        }
    },

    toggleSidebar(show) {
        if (show) {
            this.sidebar.classList.add('open');
            this.sidebarOverlay.classList.remove('hidden');
            setTimeout(() => this.sidebarOverlay.classList.remove('opacity-0'), 10);
        } else {
            this.sidebar.classList.remove('open');
            this.sidebarOverlay.classList.add('opacity-0');
            setTimeout(() => this.sidebarOverlay.classList.add('hidden'), 300);
        }
    },

    makeSelectSearchable(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Si ya fue convertido, no hacer nada
        if (select.parentElement.classList.contains('searchable-select-container')) return;

        // Ocultar select original (pero mantenerlo para que los form.values sigan funcionando)
        select.style.display = 'none';

        // Contenedor principal
        const container = document.createElement('div');
        container.className = 'relative searchable-select-container w-full';
        select.parentNode.insertBefore(container, select);
        container.appendChild(select);

        // Input visual de búsqueda
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input w-full pr-8 truncate cursor-pointer bg-surface';
        input.placeholder = 'Buscar o seleccionar...';

        // Mantener texto seleccionado inicial si lo hay
        if (select.options[select.selectedIndex] && !select.options[select.selectedIndex].disabled) {
            input.value = select.options[select.selectedIndex].text;
        }

        // Icono de chevron
        const iconContainer = document.createElement('div');
        iconContainer.className = 'absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-text-muted';
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

        // Lista de opciones flotante
        const dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 min-w-full w-max mt-1 bg-surface border border-border rounded-lg shadow-xl hidden flex-col max-h-60 overflow-y-auto';

        container.appendChild(input);
        container.appendChild(iconContainer);
        container.appendChild(dropdown);

        // Poblar lista visual desde el select oculto
        const populateDropdown = (searchTerm = '') => {
            dropdown.innerHTML = '';
            let hasResults = false;

            Array.from(select.options).forEach((opt, index) => {
                if (opt.disabled) return; // Saltar el placeholder por defecto

                const text = opt.text;
                if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
                    hasResults = true;
                    const item = document.createElement('div');
                    item.className = 'px-4 py-2 text-sm cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors border-b border-border/30 last:border-0 whitespace-nowrap';
                    item.textContent = text;

                    if (select.value === opt.value) {
                        item.classList.add('bg-primary/10', 'text-primary', 'font-medium');
                    }

                    const selectItem = (e) => {
                        e.preventDefault(); // Evitar que el input pierda foco prematuramente en mousedown
                        e.stopPropagation();
                        // Actualizar select original
                        select.value = opt.value;
                        // Disparar evento para que si hay listeners onchange enganchen la actualización
                        select.dispatchEvent(new Event('change'));

                        input.value = text;
                        dropdown.classList.add('hidden');
                        input.classList.remove('ring-2', 'ring-primary', 'border-primary');
                    };

                    item.addEventListener('mousedown', selectItem);
                    item.addEventListener('click', selectItem);
                    dropdown.appendChild(item);
                }
            });

            if (!hasResults) {
                dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-text-muted italic text-center">No se encontraron resultados</div>';
            }
        };

        // Eventos
        input.addEventListener('focus', () => {
            input.value = ''; // Limpiar para permitir ver todo y buscar
            populateDropdown('');
            dropdown.classList.remove('hidden');
            input.classList.add('ring-2', 'ring-primary', 'border-primary');
        });

        input.addEventListener('input', (e) => {
            populateDropdown(e.target.value);
        });

        // Click fuera para cerrar
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.add('hidden');
                input.classList.remove('ring-2', 'ring-primary', 'border-primary');

                // Restaurar texto del seleccionado si no eligieron nada nuevo
                if (select.options[select.selectedIndex] && !select.options[select.selectedIndex].disabled) {
                    input.value = select.options[select.selectedIndex].text;
                } else {
                    input.value = '';
                }
            }
        });
    },

    initLucideIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // --- Navigation System ---

    applyPermissions(user) {
        if (!user || user.rol === 'admin') return; // Admin sees everything

        // Hide links that are in modulosBloqueados
        const blocked = user.modulosBloqueados || [];
        this.navItems.forEach(item => {
            const href = item.getAttribute('href').replace('#', '');
            if (blocked.includes(href)) {
                item.style.display = 'none'; // Completely hide from sidebar
            }
        });

        // Hide sensible areas for non-admins (like data reset)
        if (this.btnReset) this.btnReset.classList.add('hidden');
    },

    navigate(hash) {
        const route = hash.replace('#', '') || 'dashboard';
        const user = window.appStore.currentUser;

        if (!user) return; // Prevent navigation if not logged in

        // Permission check
        if (user.rol !== 'admin' && user.modulosBloqueados && user.modulosBloqueados.includes(route)) {
            this.showToast("No tienes permisos para acceder a esta vista.", "error");
            window.location.hash = '#dashboard';
            return;
        }

        // Actualizar UI enlaces
        this.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${route}`) {
                item.classList.add('active');
            }
        });

        // Ocultar todas las paginas
        document.querySelectorAll('.page-view').forEach(page => {
            page.classList.remove('active');
        });

        // Mostrar principal o renderizar dinámica
        if (route === 'dashboard') {
            document.getElementById('page-dashboard').classList.add('active');
            // Re-render charts
            if (window.appCharts) window.appCharts.render();
        } else if (route === 'dashboard-semanal') {
            const semDash = document.getElementById('page-dashboard-semanal');
            if (semDash) semDash.classList.add('active');
            // Limpiar contenedor dinamico
            this.dynamicContainer.innerHTML = '';
            // Render weekly charts
            if (window.appCharts) window.appCharts.renderWeeklyDashboard();
        } else {
            this.renderModuleContainer(route);
        }
    },

    renderModuleContainer(route) {
        // Ocultar dashboards
        document.getElementById('page-dashboard').classList.remove('active');
        const semDash = document.getElementById('page-dashboard-semanal');
        if (semDash) semDash.classList.remove('active');

        // Limpiar contenedor dinamico si hay otra vista
        this.dynamicContainer.innerHTML = '';

        // Crear wrapper
        const view = document.createElement('div');
        view.className = 'page-view active page-transition';
        view.id = `page-${route}`;

        // Delegate to specific module renderer based on route
        let content = '';
        if (window.appModules[route]) {
            content = window.appModules[route]();
        } else {
            content = `
                <div class="flex flex-col items-center justify-center h-full text-center p-8">
                    <i data-lucide="alert-circle" class="w-16 h-16 text-warning mb-4"></i>
                    <h2 class="text-2xl font-bold text-white mb-2">Módulo en construcción</h2>
                    <p class="text-text-secondary">El módulo ${route} estará disponible pronto.</p>
                </div>
            `;
        }

        view.innerHTML = content;
        this.dynamicContainer.appendChild(view);
        this.initLucideIcons();

        // Bind form events if function exists
        if (window.appModuleEvents && window.appModuleEvents[route]) {
            window.appModuleEvents[route]();
        }
    },

    // --- Toast Notifications ---

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'alert-circle';

        toast.innerHTML = `
            <i data-lucide="${icon}" class="w-5 h-5 shrink-0"></i>
            <span class="text-sm font-medium">${message}</span>
        `;

        this.toastContainer.appendChild(toast);
        this.initLucideIcons();

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- Dashboard Updaters ---

    updateDashboard() {
        const stats = window.appStore ? window.appStore.getStats() : { totalProductos: 0, canastasLlenas: 0, canastasVacias: 0, totalAlmacenes: 0, despachadasProductor: 0, despachadasCliente: 0 };
        const activity = window.appStore ? window.appStore.getActividad() : [];

        // Update stats
        if (document.getElementById('stat-total-products')) {
            document.getElementById('stat-total-products').textContent = stats.totalProductos;
            document.getElementById('stat-full-baskets').textContent = stats.canastasLlenas;
            document.getElementById('stat-empty-baskets').textContent = stats.canastasVacias;
            document.getElementById('stat-warehouses').textContent = stats.totalAlmacenes;
            if (document.getElementById('stat-desp-productor')) {
                document.getElementById('stat-desp-productor').textContent = stats.despachadasProductor;
                document.getElementById('stat-desp-cliente').textContent = stats.despachadasCliente;
            }
        }

        // Update resumen frutas
        const frutasContainer = document.getElementById('resumen-frutas-container');
        if (frutasContainer) {
            if (!stats.resumenFrutas || stats.resumenFrutas.length === 0) {
                frutasContainer.innerHTML = `<div class="col-span-full text-center text-text-secondary py-4 surface-card italic">No hay canastas llenas en inventario.</div>`;
            } else {
                frutasContainer.innerHTML = stats.resumenFrutas.map(f => `
                    <div class="surface-card p-3 flex flex-col items-center justify-center border-l-2 border-primary">
                        <span class="text-xs text-text-secondary uppercase tracking-wider mb-1 text-center truncate w-full" title="${f.nombre}">${f.nombre}</span>
                        <span class="text-xl font-bold text-white">${f.cantidad}</span>
                    </div>
                `).join('');
            }
        }

        // Update table
        const tbody = document.getElementById('recent-activity-table');
        if (tbody) {
            if (activity.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-text-secondary">No hay actividad reciente</td></tr>`;
            } else {
                tbody.innerHTML = activity.map(act => `
                    <tr class="border-b border-border/50 hover:bg-surface-light/50 transition-colors">
                        <td class="py-3 px-4 text-sm whitespace-nowrap">${new Date(act.date).toLocaleDateString()} ${new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td class="py-3 px-4 text-sm font-medium text-white">
                            <span class="inline-flex items-center px-2 py-1 rounded-md bg-surface-light border border-border text-xs">
                                ${act.operacion}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-sm text-text-secondary truncate max-w-xs" title="${act.detalle}">${act.detalle}</td>
                        <td class="py-3 px-4 text-sm font-semibold ${act.cantidad.includes('+') ? 'text-success' : act.cantidad.includes('-') ? 'text-warning' : 'text-primary'}">${act.cantidad}</td>
                    </tr>
                `).join('');
            }
        }
        // Update Top Deudores
        const renderTopList = (elementId, dataList, emptyMessage) => {
            const container = document.getElementById(elementId);
            if (!container) return;

            if (!dataList || dataList.length === 0) {
                container.innerHTML = `<p class="text-sm text-text-secondary italic">${emptyMessage}</p>`;
                return;
            }

            container.innerHTML = dataList.map((item, index) => `
                <div class="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-surface-light/20">
                    <div class="flex items-center gap-3">
                        <span class="text-text-secondary font-mono text-xs w-4">${index + 1}.</span>
                        <span class="text-white font-medium text-sm truncate max-w-[150px]" title="${item.nombre}">${item.nombre}</span>
                    </div>
                    <span class="text-warning font-bold text-sm bg-warning/10 px-2 py-0.5 rounded">${item.deuda}</span>
                </div>
            `).join('');
        };

        renderTopList('top-productores-list', stats.topDeudoresProductores, 'Ningún productor debe canastas.');
        renderTopList('top-clientes-list', stats.topDeudoresClientes, 'Ningún cliente debe canastas.');
    }
};

window.UI = UI;
