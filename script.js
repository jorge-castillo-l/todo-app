document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.todo__form');
    const input = document.querySelector('.todo__input');
    const list = document.querySelector('.todo__list');
    const filtersMobile = document.querySelector('.todo__filters-mobile');
    const filtersDesktop = document.querySelector('.todo__filters-desktop');
    const clearBtn = document.querySelector('.todo__clear');
    const exportBtn = document.querySelector('.todo__export');
    const itemsLeft = document.querySelector('.todo__items-left');
    const live = document.querySelector('.todo__live');
    const dialog = document.querySelector('.todo__dialog');
    const confirmMessage = document.querySelector('#confirm-message');
    const allFilterBtns = document.querySelectorAll('.todo__filter');

    const STORAGE_KEY = 'todos';
    const FILTER_KEY = 'todo_current_filter';
    const VALID_FILTERS = new Set(['all', 'active', 'completed']);

    let currentFilter = loadSavedFilter();
    let confirmOpen = false;

    function createHandle() {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'todo__handle';
        handle.setAttribute('aria-label', 'Arrastrar para reordenar. Con el teclado, flecha arriba o abajo.');
        handle.innerHTML = `
            <svg viewBox="0 0 16 22" width="16" height="22" aria-hidden="true" focusable="false">
                <circle cx="4.5" cy="4" r="1.35"></circle>
                <circle cx="11.5" cy="4" r="1.35"></circle>
                <circle cx="4.5" cy="11" r="1.35"></circle>
                <circle cx="11.5" cy="11" r="1.35"></circle>
                <circle cx="4.5" cy="18" r="1.35"></circle>
                <circle cx="11.5" cy="18" r="1.35"></circle>
            </svg>`;
        return handle;
    }

    function syncCheckButton(button, completed) {
        button.classList.toggle('checked', completed);
        button.setAttribute('aria-pressed', completed ? 'true' : 'false');
        button.setAttribute('aria-label', completed ? 'Marcar como pendiente' : 'Marcar como hecha');
    }

    function createItem(task, completed = false) {
        const imgCheck = document.createElement('img');
        imgCheck.src = './assets/icon-check.svg';
        imgCheck.alt = '';
        imgCheck.setAttribute('aria-hidden', 'true');

        const imgDelete = document.createElement('img');
        imgDelete.src = './assets/icon-cross.svg';
        imgDelete.alt = '';
        imgDelete.setAttribute('aria-hidden', 'true');

        const buttonDelete = document.createElement('button');
        buttonDelete.type = 'button';
        buttonDelete.className = 'todo__delete';
        buttonDelete.setAttribute('aria-label', 'Eliminar tarea');

        const buttonCheck = document.createElement('button');
        buttonCheck.type = 'button';
        buttonCheck.className = 'todo__check';

        const text = createTextButton(task);

        const item = document.createElement('li');
        item.className = 'todo__item';
        item.draggable = true;

        item.append(createHandle(), buttonCheck, text, buttonDelete);
        buttonCheck.appendChild(imgCheck);
        buttonDelete.appendChild(imgDelete);

        if (completed) item.classList.add('completed');
        syncCheckButton(buttonCheck, completed);

        list.appendChild(item);
        return item;
    }

    function createTextButton(task) {
        const text = document.createElement('button');
        text.type = 'button';
        text.className = 'todo__text';
        text.textContent = task;
        text.title = 'Clic para editar';
        text.setAttribute('aria-label', `Editar «${task}»`);
        return text;
    }

    function taskText(item) {
        const node = item.querySelector('.todo__edit, .todo__text');
        if (!node) return '';
        const value = node.classList.contains('todo__edit') ? node.value : node.textContent;
        return value.trim();
    }

    function startEdit(item) {
        if (!item || item.classList.contains('todo__item--editing')) return;
        const text = item.querySelector('.todo__text');
        if (!text) return;

        const original = text.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo__edit';
        input.value = original;
        input.setAttribute('aria-label', 'Editar tarea');
        input.maxLength = 200;

        item.classList.add('todo__item--editing');
        item.draggable = false;
        text.replaceWith(input);
        input.focus();
        input.select();

        let closed = false;
        const finish = (save) => {
            if (closed) return;
            closed = true;

            const next = input.value.trim();
            const finalText = save && next !== '' ? next : original;
            input.replaceWith(createTextButton(finalText));
            item.classList.remove('todo__item--editing');
            item.draggable = true;

            if (finalText !== original) {
                saveTodos();
                announce(`Tarea actualizada a ${finalText}`);
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));
    }

    function initEdit() {
        list.addEventListener('click', (event) => {
            const text = event.target.closest('.todo__text');
            if (!text || !list.contains(text)) return;
            startEdit(text.closest('.todo__item'));
        });
    }

    function visibleItems() {
        return [...list.querySelectorAll('.todo__item')].filter((item) => item.style.display !== 'none');
    }

    function enterTask() {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const task = input.value.trim();
            if (task === '') return;
            createItem(task);
            saveTodos();
            applyFilter();
            updateItemsLeft();
            input.value = '';
        });
    }

    function askConfirm(message) {
        if (!dialog || typeof dialog.showModal !== 'function') {
            return Promise.resolve(window.confirm(message));
        }
        if (confirmOpen) return Promise.resolve(false);

        confirmOpen = true;
        confirmMessage.textContent = message;
        dialog.returnValue = '';

        return new Promise((resolve) => {
            const finish = () => {
                confirmOpen = false;
                resolve(dialog.returnValue === 'confirm');
            };
            dialog.addEventListener('close', finish, { once: true });

            // El clic que abre el diálogo no debe caer sobre «Eliminar».
            window.setTimeout(() => {
                if (!confirmOpen) return;
                try {
                    dialog.showModal();
                } catch (err) {
                    dialog.removeEventListener('close', finish);
                    confirmOpen = false;
                    resolve(window.confirm(message));
                }
            }, 0);
        });
    }

    function initConfirmDialog() {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close('cancel');
        });
    }

    function deleteTask() {
        list.addEventListener('click', async (event) => {
            const btnDelete = event.target.closest('.todo__delete');
            if (!btnDelete) return;

            const item = btnDelete.closest('.todo__item');
            if (!item) return;

            const text = taskText(item);
            const confirmed = await askConfirm(`¿Seguro que quieres eliminar «${text}»?`);
            if (!confirmed || !item.isConnected) return;

            item.remove();
            saveTodos();
            applyFilter();
            updateItemsLeft();
        });
    }

    function checkTask() {
        list.addEventListener('click', (event) => {
            const checkBtn = event.target.closest('.todo__check');
            if (!checkBtn) return;

            const item = checkBtn.closest('.todo__item');
            if (!item) return;

            const completed = !item.classList.contains('completed');
            item.classList.toggle('completed', completed);
            syncCheckButton(checkBtn, completed);
            saveTodos();
            applyFilter();
            updateItemsLeft();
        });
    }

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
        allFilterBtns.forEach((btn) => {
            const value = (btn.dataset.filter || '').trim().toLowerCase();
            const isActive = value === target;
            btn.classList.toggle('todo__filter--active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function applyFilter() {
        list.querySelectorAll('.todo__item').forEach((item) => {
            const isCompleted = item.classList.contains('completed');
            let show = true;
            if (currentFilter === 'active') show = !isCompleted;
            if (currentFilter === 'completed') show = isCompleted;
            item.style.display = show ? '' : 'none';
        });
    }

    function handleFilterDelegation(event) {
        const btn = event.target.closest('.todo__filter');
        if (!btn) return;
        setCurrentFilter(btn.dataset.filter);
    }

    function initFilters() {
        filtersDesktop.addEventListener('click', handleFilterDelegation);
        filtersMobile.addEventListener('click', handleFilterDelegation);
        syncActiveFilterUI(currentFilter);
        applyFilter();
    }

    function updateItemsLeft() {
        const pending = list.querySelectorAll('.todo__item:not(.completed)').length;
        const completed = list.querySelectorAll('.todo__item.completed').length;
        itemsLeft.textContent = pending === 1
            ? '1 tarea pendiente'
            : `${pending} tareas pendientes`;

        clearBtn.disabled = completed === 0;
        exportBtn.disabled = completed === 0;
        clearBtn.title = completed === 0
            ? 'No hay tareas hechas para borrar'
            : 'Borrar todas las tareas hechas';
        exportBtn.title = completed === 0
            ? 'No hay tareas hechas para exportar'
            : 'Descargar las tareas hechas en un archivo Markdown';
    }

    function clearCompleted() {
        clearBtn.addEventListener('click', async () => {
            const items = [...list.querySelectorAll('.todo__item.completed')];
            if (items.length === 0) return;

            const message = items.length === 1
                ? `¿Seguro que quieres eliminar «${taskText(items[0])}»?`
                : `¿Seguro que quieres eliminar las ${items.length} tareas hechas?`;
            const confirmed = await askConfirm(message);
            if (!confirmed) return;

            items.forEach((item) => item.remove());
            saveTodos();
            applyFilter();
            updateItemsLeft();
        });
    }

    function buildCompletedMarkdown(tasks) {
        const fecha = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date());
        const resumen = tasks.length === 1 ? '1 tarea hecha.' : `${tasks.length} tareas hechas.`;
        const cuerpo = tasks
            .map((task) => `- [x] ${task.replace(/[\r\n]+/g, ' ')}`)
            .join('\n');

        return `# Tareas hechas\n\nExportado el ${fecha}. ${resumen}\n\n${cuerpo}\n`;
    }

    function exportCompleted() {
        exportBtn.addEventListener('click', () => {
            const tasks = [...list.querySelectorAll('.todo__item.completed')]
                .map((item) => taskText(item))
                .filter(Boolean);
            if (tasks.length === 0) return;

            const markdown = buildCompletedMarkdown(tasks);
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'tareas-hechas.md';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        });
    }

    function announce(message) {
        live.textContent = '';
        window.setTimeout(() => {
            live.textContent = message;
        }, 20);
    }

    function moveItem(item, direction) {
        if (!item) return false;
        const items = visibleItems();
        const index = items.indexOf(item);
        const target = items[index + direction];
        if (!target) return false;

        if (direction > 0) {
            list.insertBefore(item, target.nextSibling);
        } else {
            list.insertBefore(item, target);
        }

        saveTodos();
        const position = visibleItems().indexOf(item) + 1;
        announce(`Tarea en la posición ${position} de ${visibleItems().length}`);
        item.querySelector('.todo__handle')?.focus();
        return true;
    }

    function getDragAfterElement(y) {
        const items = visibleItems().filter((item) => !item.classList.contains('todo__item--dragging'));
        let closest = null;
        let closestOffset = Number.NEGATIVE_INFINITY;

        items.forEach((item) => {
            const box = item.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closestOffset) {
                closestOffset = offset;
                closest = item;
            }
        });

        return closest;
    }

    function placeDragItem(y) {
        const after = getDragAfterElement(y);
        if (after == null) {
            list.appendChild(dragState.item);
        } else if (after !== dragState.item) {
            list.insertBefore(dragState.item, after);
        }
    }

    const dragState = {
        item: null,
        pointerId: null
    };

    function finishDrag() {
        if (!dragState.item) return;
        dragState.item.classList.remove('todo__item--dragging');
        dragState.item = null;
        dragState.pointerId = null;
        saveTodos();
    }

    function initDragAndDrop() {
        let pendingItem = null;
        let startY = 0;

        const beginPointerDrag = (item) => {
            dragState.item = item;
            item.classList.add('todo__item--dragging');
        };

        list.addEventListener('dragstart', (event) => {
            if (dragState.pointerId !== null) {
                event.preventDefault();
                return;
            }

            const item = event.target.closest('.todo__item');
            if (!item || event.target.closest('.todo__check, .todo__delete, .todo__handle, .todo__text, .todo__edit')) {
                event.preventDefault();
                return;
            }

            dragState.item = item;
            item.classList.add('todo__item--dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', taskText(item));
            event.dataTransfer.setDragImage(item, 24, 24);
        });

        list.addEventListener('dragover', (event) => {
            if (!dragState.item || dragState.pointerId !== null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            placeDragItem(event.clientY);
        });

        list.addEventListener('drop', (event) => {
            if (!dragState.item || dragState.pointerId !== null) return;
            event.preventDefault();
        });

        list.addEventListener('dragend', () => {
            if (dragState.pointerId !== null) return;
            finishDrag();
        });

        list.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const handle = event.target.closest('.todo__handle');
            if (!handle) return;
            const item = handle.closest('.todo__item');
            if (!item) return;

            pendingItem = item;
            startY = event.clientY;
            dragState.pointerId = event.pointerId;
            try {
                handle.setPointerCapture(event.pointerId);
            } catch (err) {
                // Los eventos sintéticos no tienen un puntero activo.
            }
        });

        list.addEventListener('pointermove', (event) => {
            if (event.pointerId !== dragState.pointerId || !pendingItem) return;
            if (!dragState.item && Math.abs(event.clientY - startY) >= 4) {
                beginPointerDrag(pendingItem);
            }
            if (!dragState.item) return;
            event.preventDefault();
            placeDragItem(event.clientY);
        }, { passive: false });

        const stopTouchDrag = (event) => {
            if (event.pointerId !== dragState.pointerId) return;
            pendingItem = null;
            if (dragState.item) finishDrag();
            dragState.pointerId = null;
        };

        list.addEventListener('pointerup', stopTouchDrag);
        list.addEventListener('pointercancel', stopTouchDrag);

        list.addEventListener('keydown', (event) => {
            const handle = event.target.closest('.todo__handle');
            if (!handle) return;
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            moveItem(handle.closest('.todo__item'), event.key === 'ArrowUp' ? -1 : 1);
        });
    }

    function saveTodos() {
        const snapshot = [...list.querySelectorAll('.todo__item')].flatMap((item) => {
            const text = taskText(item);
            if (text === '') return [];
            return [{ text, completed: item.classList.contains('completed') }];
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }

    function loadTodos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                updateItemsLeft();
                return;
            }

            const todos = JSON.parse(raw);
            if (!Array.isArray(todos)) {
                updateItemsLeft();
                return;
            }

            todos.forEach((todo) => {
                const text = typeof todo.text === 'string' ? todo.text : '';
                if (text.trim() !== '') createItem(text, Boolean(todo.completed));
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

    loadTodos();
    enterTask();
    deleteTask();
    checkTask();
    initFilters();
    clearCompleted();
    exportCompleted();
    initDragAndDrop();
    initEdit();
    initConfirmDialog();
});
