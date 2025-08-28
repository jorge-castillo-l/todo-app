document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores base ---
    const form = document.querySelector('.todo__form');
    const input = document.querySelector('.todo__input');
    const list = document.querySelector('.todo__list');
    const filtersMobile = document.querySelector('.todo__filters-mobile');
    const filtersDesktop = document.querySelector('.todo__filters-desktop');
    const clearBtn = document.querySelector('.todo__clear');
    const ALL_FILTER_BTNS = document.querySelectorAll('.todo__filter');

    // --- Storage keys ---
    const STORAGE_KEY = 'todos';
    const FILTER_KEY = 'todo_current_filter';

    // --- Filtros: estado único ---
    const VALID_FILTERS = new Set(['all', 'active', 'completed']);
    let currentFilter = loadSavedFilter(); // 'all' | 'active' | 'completed'

    // ===============================
    //       CREAR Y RENDER ITEM
    // ===============================
    function createItem(task, completed = false) {
        const img_check = document.createElement('img');
        img_check.src = './images/icon-check.svg';
        img_check.alt = 'Task completed checkmark';

        const img_tododelete = document.createElement('img');
        img_tododelete.src = './images/icon-cross.svg';
        img_tododelete.alt = 'Delete icon';

        const button_delete = document.createElement('button');
        button_delete.classList.add('todo__delete');

        const button_check = document.createElement('button');
        button_check.classList.add('todo__check');

        const p_item = document.createElement('p');
        p_item.classList.add('todo__text');
        p_item.textContent = task;

        const item = document.createElement('li');
        item.classList.add('todo__item');

        // Estructura
        item.appendChild(button_check);
        button_check.appendChild(img_check);
        item.appendChild(p_item);
        item.appendChild(button_delete);
        button_delete.appendChild(img_tododelete);

        // Estado completado (si viene desde storage)
        if (completed) {
        item.classList.add('completed');
        button_check.classList.add('checked');
        }

        list.appendChild(item);
    }

    // ========================
    //         ENTRADA
    // ========================
    function enterTask() {
        form.addEventListener('submit', (e) => {
        e.preventDefault();
        const task = input.value.trim();
        if (task === '') return;
        createItem(task);
        saveTodos();
        applyFilter(); // respeta el filtro activo
        updateItemsLeft();
        input.value = '';
        });
    }

    // ========================
    //         ELIMINAR
    // ========================
    function deleteTask() {
        list.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.todo__delete');
        if (btnDelete) {
            const item = btnDelete.closest('.todo__item');
            item.remove();
            saveTodos();
            applyFilter();
            updateItemsLeft();
        }
        });
    }

    // =========================
    //     COMPLETAR / DES
    // =========================
    function checkTask() {
        list.addEventListener('click', (e) => {
        const checkBtn = e.target.closest('.todo__check');
        if (checkBtn) {
            checkBtn.classList.toggle('checked');
            const item = checkBtn.closest('.todo__item');
            if (item) {
            item.classList.toggle('completed');
            saveTodos();
            applyFilter();
            updateItemsLeft();
            }
        }
        });
    }

    // =========================
    //         FILTROS
    // =========================
    function loadSavedFilter() {
        const raw = localStorage.getItem(FILTER_KEY);
        return VALID_FILTERS.has(raw) ? raw : 'all';
    }

    function saveFilter(filter) {
        localStorage.setItem(FILTER_KEY, filter);
    }

    function setCurrentFilter(next) {
        const normalized = String(next).toLowerCase();
        if (!VALID_FILTERS.has(normalized) || normalized === currentFilter) return;
        currentFilter = normalized;
        saveFilter(currentFilter);
        syncActiveFilterUI(currentFilter);
        applyFilter();
        updateItemsLeft();
    }

    function syncActiveFilterUI(active) {
        const target = (active || '').trim().toLowerCase();
        ALL_FILTER_BTNS.forEach((btn) => {
        const value = (btn.dataset.filter || '').trim().toLowerCase();
        const isActive = value === target;
        btn.classList.toggle('todo__filter--active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function applyFilter() {
        const items = list.querySelectorAll('.todo__item');
        items.forEach((li) => {
        const isCompleted = li.classList.contains('completed');
        let show = true;
        if (currentFilter === 'active') show = !isCompleted;
        if (currentFilter === 'completed') show = isCompleted;
        li.style.display = show ? '' : 'none';
        });
    }

    function handleFilterDelegation(e) {
        const btn = e.target.closest('.todo__filter');
        if (!btn) return;
        setCurrentFilter(btn.dataset.filter);
    }

    function initFilters() {
        filtersDesktop.addEventListener('click', handleFilterDelegation);
        filtersMobile.addEventListener('click', handleFilterDelegation);
        syncActiveFilterUI(currentFilter);
        applyFilter();
    }

    // =========================
    //     CONTADOR PENDIENTES
    // =========================
    function updateItemsLeft() {
        const count = document.querySelectorAll('.todo__item:not(.completed)').length;
        document.querySelector('.todo__items-left').textContent = `${count} items left`;
    }

    // =========================
    //     CLEAR COMPLETED
    // =========================
    function clearCompleted() {
        clearBtn.addEventListener('click', () => {
        const itemsCompleted = document.querySelectorAll('.todo__item.completed');
        itemsCompleted.forEach((item) => item.remove());
        updateItemsLeft();
        saveTodos();
        applyFilter();
        });
    }

    // =========================
    //   STORAGE: GUARDAR/LEER
    // =========================
    function saveTodos() {
        // snapshot del DOM actual (formato actual)
        const items = document.querySelectorAll('.todo__item');
        const snapshot = [];
        items.forEach((li) => {
        const text = li.querySelector('.todo__text')?.textContent ?? '';
        const completed = li.classList.contains('completed');
        if (text.trim() !== '') {
            snapshot.push({ text, completed });
        }
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }

    function loadTodos() {
        try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { updateItemsLeft(); return; }
        const todos = JSON.parse(raw);
        if (!Array.isArray(todos)) { updateItemsLeft(); return; }

        todos.forEach((t) => {
            const text = typeof t.text === 'string' ? t.text : '';
            const completed = Boolean(t.completed);
            if (text.trim() !== '') createItem(text, completed);
        });

        updateItemsLeft();
        syncActiveFilterUI(currentFilter);
        applyFilter();
        } catch (err) {
        console.error('Error leyendo localStorage:', err);
        updateItemsLeft();
        syncActiveFilterUI(currentFilter);
        applyFilter();
        }
    }

    // =========================
    //       BOOTSTRAP APP
    // =========================
    loadTodos();
    enterTask();
    deleteTask();
    checkTask();
    initFilters();
    clearCompleted();
});
