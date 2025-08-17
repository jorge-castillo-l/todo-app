document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores base ---
    const form = document.querySelector('.todo__form');
    const input = document.querySelector('.todo__input');
    const list = document.querySelector('.todo__list');
    const filtersMobile = document.querySelector('.todo__filters-mobile');
    const filters = document.querySelectorAll('.todo__filter');
    const filtersDesktop = document.querySelector('.todo__filters-desktop');
    const clearBtn = document.querySelector('.todo__clear')
    
    // --- Clave de almacenamiento ---
    const STORAGE_KEY = 'todos';

    // ===============================
    //       CREAR Y RENDER ITEM
    // ===============================
    function createItem(task, completed = false) {
        const img_check = document.createElement('img');
        img_check.src = './images/icon-check.svg';
        img_check.alt = 'Completed task completed';

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
            if (task === "") return;
            createItem(task);
            updateItemsLeft();
            saveTodos();
            input.value = '';
        });
    }

    // ========================
    //         ELIMINAR
    // ========================
    function deleteTask() {
        list.addEventListener('click', (e) => {
            const btnDelete = e.target.closest('.todo__delete');
            if(btnDelete) {
                const item = btnDelete.closest('.todo__item');
                item.remove();
                updateItemsLeft()
                saveTodos();
            }
        })
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
                    updateItemsLeft();
                    saveTodos();
                }
            }
        })
    }
    
    // =========================
    //         FILTROS
    // =========================
    function handleFilterClick(container) { 
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.todo__filter'); 
            if (!btn) return;

            updateActiveFilter(btn);
            
            const filter = btn.dataset.filter.toLowerCase(); 
            const items = document.querySelectorAll('.todo__item'); 
            items.forEach((element) => { 
                const isCompleted = element.classList.contains('completed'); 
                switch(filter) {
                    case 'all':
                        element.style.display = '';
                        break;
                    case 'active':
                        element.style.display = isCompleted ? 'none' : '';
                        break;
                    case 'completed':
                        element.style.display = isCompleted ? '' : 'none';
                        break;
                }
            })
        })
    }

    function updateActiveFilter(btn) {
        filters.forEach((el) => el.classList.remove('todo__filter--active'));
        btn.classList.add('todo__filter--active');
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
            itemsCompleted.forEach( item => item.remove())
            updateItemsLeft();
            saveTodos();
        })
    }

    // =========================
    //   STORAGE: GUARDAR/LEER
    // =========================
    function saveTodos() {
        // tomar un "snapshot" del DOM actual
        const items = document.querySelectorAll('.todo__item');
        const snapshot = [];
        items.forEach((li) => {
            const text = li.querySelector('.todo__text')?.textContent ?? '';
            const completed = li.classList.contains('completed');
            if(text.trim() !== '') {
                snapshot.push( { text, completed });
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
        } catch (err) {
            console.error('Error leyendo localStorage:', err);
            updateItemsLeft();
        }
    }

    // =========================
    //       BOOTSTRAP APP
    // =========================
    loadTodos();
    enterTask();
    deleteTask();
    checkTask();
    handleFilterClick(filtersMobile);
    handleFilterClick(filtersDesktop);
    updateItemsLeft();
    clearCompleted();
})