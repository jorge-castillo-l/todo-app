document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.todo__form');
    const input = document.querySelector('.todo__input');
    const list = document.querySelector('.todo__list');
    const topics = document.querySelector('.todo__topics');
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
    const LISTS_KEY = 'todo_lists';
    const FILTER_KEY = 'todo_current_filter';
    const VALID_FILTERS = new Set(['all', 'active', 'completed']);

    let currentFilter = loadSavedFilter();
    let confirmOpen = false;
    let lists = [];
    let currentListId = null;

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

    function buildCompletedMarkdown(tasks, listName) {
        const fecha = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date());
        const resumen = tasks.length === 1 ? '1 tarea hecha.' : `${tasks.length} tareas hechas.`;
        const cuerpo = tasks
            .map((task) => `- [x] ${task.replace(/[\r\n]+/g, ' ')}`)
            .join('\n');

        return `# Tareas hechas: ${listName}\n\nExportado el ${fecha}. ${resumen}\n\n${cuerpo}\n`;
    }

    function listFileSlug(name) {
        const slug = name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return slug || 'lista';
    }

    function exportCompleted() {
        exportBtn.addEventListener('click', () => {
            const tasks = [...list.querySelectorAll('.todo__item.completed')]
                .map((item) => taskText(item))
                .filter(Boolean);
            if (tasks.length === 0) return;

            const listName = currentList()?.name || 'Lista';
            const markdown = buildCompletedMarkdown(tasks, listName);
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tareas-hechas-${listFileSlug(listName)}.md`;
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

    function createListId() {
        if (window.crypto?.randomUUID) return crypto.randomUUID();
        return `lista-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function normalizeTodos(value) {
        if (!Array.isArray(value)) return [];
        return value.flatMap((todo) => {
            const text = typeof todo?.text === 'string' ? todo.text.trim() : '';
            if (text === '') return [];
            return [{ text, completed: Boolean(todo.completed) }];
        });
    }

    function readLegacyTodos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            return normalizeTodos(JSON.parse(raw));
        } catch (err) {
            return [];
        }
    }

    function currentList() {
        return lists.find((entry) => entry.id === currentListId) || lists[0] || null;
    }

    function saveLists() {
        const active = currentList();
        currentListId = active?.id || null;
        localStorage.setItem(LISTS_KEY, JSON.stringify({
            currentId: currentListId,
            lists
        }));
        localStorage.removeItem(STORAGE_KEY);
    }

    function loadLists() {
        try {
            const raw = localStorage.getItem(LISTS_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            const savedLists = Array.isArray(saved?.lists)
                ? saved.lists.flatMap((entry) => {
                    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
                    const id = typeof entry?.id === 'string' && entry.id !== '' ? entry.id : createListId();
                    if (name === '') return [];
                    return [{ id, name, todos: normalizeTodos(entry.todos) }];
                })
                : [];

            if (savedLists.length > 0) {
                lists = savedLists;
                currentListId = savedLists.some((entry) => entry.id === saved.currentId)
                    ? saved.currentId
                    : savedLists[0].id;
                return;
            }
        } catch (err) {
            console.error('Error leyendo las listas:', err);
        }

        lists = [{
            id: createListId(),
            name: 'Personal',
            todos: readLegacyTodos()
        }];
        currentListId = lists[0].id;
        saveLists();
    }

    function paintTodos(todos) {
        list.replaceChildren();
        normalizeTodos(todos).forEach((todo) => createItem(todo.text, todo.completed));
        syncActiveFilterUI(currentFilter);
        applyFilter();
        updateItemsLeft();
    }

    function saveTodos() {
        const active = currentList();
        if (!active) return;
        active.todos = [...list.querySelectorAll('.todo__item')].flatMap((item) => {
            const text = taskText(item);
            if (text === '') return [];
            return [{ text, completed: item.classList.contains('completed') }];
        });
        saveLists();
    }

    function renderTopics() {
        const fragment = document.createDocumentFragment();
        lists.forEach((entry) => {
            const group = document.createElement('div');
            group.className = 'todo__topic-group';
            group.dataset.id = entry.id;
            if (entry.id === currentListId) group.classList.add('todo__topic-group--active');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'todo__topic';
            button.textContent = entry.name;
            button.title = entry.id === currentListId ? 'Clic para cambiar el nombre' : `Ver ${entry.name}`;
            button.setAttribute('aria-pressed', entry.id === currentListId ? 'true' : 'false');
            if (entry.id === currentListId) button.classList.add('todo__topic--active');
            group.appendChild(button);

            if (lists.length > 1) {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'todo__topic-delete';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `Eliminar lista ${entry.name}`);
                group.appendChild(remove);
            }

            fragment.appendChild(group);
        });

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'todo__topic-add';
        add.textContent = 'Nueva lista';
        fragment.appendChild(add);
        topics.replaceChildren(fragment);
    }

    function switchList(id) {
        if (!id || id === currentListId) return;
        if (!lists.some((entry) => entry.id === id)) return;
        saveTodos();
        currentListId = id;
        saveLists();
        paintTodos(currentList().todos);
        renderTopics();
        announce(`Lista ${currentList().name}`);
    }

    function nextListName(base) {
        const names = new Set(lists.map((entry) => entry.name));
        if (!names.has(base)) return base;
        let index = 2;
        while (names.has(`${base} ${index}`)) index += 1;
        return `${base} ${index}`;
    }

    function addList() {
        saveTodos();
        const created = {
            id: createListId(),
            name: nextListName('Nueva lista'),
            todos: []
        };
        lists.push(created);
        currentListId = created.id;
        saveLists();
        paintTodos([]);
        renderTopics();
        const button = topics.querySelector(`[data-id="${CSS.escape(created.id)}"] .todo__topic`);
        startTopicEdit(button);
        announce('Nueva lista creada');
    }

    async function deleteList(id) {
        if (lists.length < 2) return;
        const target = lists.find((entry) => entry.id === id);
        if (!target) return;
        const confirmed = await askConfirm(`¿Seguro que quieres eliminar la lista «${target.name}» y todas sus tareas?`);
        if (!confirmed) return;

        if (id !== currentListId) saveTodos();
        lists = lists.filter((entry) => entry.id !== id);
        if (!lists.some((entry) => entry.id === currentListId)) currentListId = lists[0].id;
        saveLists();
        paintTodos(currentList().todos);
        renderTopics();
        announce(`Lista ${target.name} eliminada`);
    }

    function startTopicEdit(button) {
        if (!button || !button.isConnected) return;
        const group = button.closest('.todo__topic-group');
        const listData = lists.find((entry) => entry.id === group?.dataset.id);
        if (!listData || topics.querySelector('.todo__topic-edit')) return;

        const original = listData.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo__topic-edit';
        input.value = original;
        input.maxLength = 40;
        input.setAttribute('aria-label', 'Editar nombre de la lista');
        button.replaceWith(input);

        let closed = false;
        let armed = false;
        const finish = (save) => {
            if (closed) return;
            closed = true;
            const next = input.value.trim();
            listData.name = save && next !== '' ? next : original;
            saveLists();
            renderTopics();
            if (listData.name !== original) announce(`Lista actualizada a ${listData.name}`);
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
        input.addEventListener('blur', () => {
            if (!armed) return;
            finish(true);
        });
        window.setTimeout(() => {
            if (closed || !input.isConnected) return;
            armed = true;
            input.focus();
            input.select();
        }, 0);
    }

    function initTopics() {
        topics.addEventListener('click', (event) => {
            if (event.target.closest('.todo__topic-add')) {
                addList();
                return;
            }

            const remove = event.target.closest('.todo__topic-delete');
            if (remove) {
                deleteList(remove.closest('.todo__topic-group')?.dataset.id);
                return;
            }

            const topic = event.target.closest('.todo__topic');
            if (!topic) return;
            const id = topic.closest('.todo__topic-group')?.dataset.id;
            if (id === currentListId) startTopicEdit(topic);
            else switchList(id);
        });
    }

    loadLists();
    paintTodos(currentList().todos);
    renderTopics();
    enterTask();
    deleteTask();
    checkTask();
    initFilters();
    clearCompleted();
    exportCompleted();
    initDragAndDrop();
    initEdit();
    initTopics();
    initConfirmDialog();
});
