document.addEventListener('DOMContentLoaded', function() {
    // Theme Initialization
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // Initialize Flatpickr
    flatpickr("#todo-due-date", {
        locale: "ar",
        dateFormat: "Y-m-d",
        minDate: "today",
        altInput: true,
        altFormat: "j F Y",
        theme: "material_blue"
    });

    // Initialize variables
    let todos = [];
    let categories = [];
    const todoForm = document.getElementById('todo-form');
    const todoContainer = document.getElementById('todos-container');
    const todoTemplate = document.getElementById('todo-template');
    const categoryTemplate = document.getElementById('category-template');
    const categoriesList = document.getElementById('categories-list');
    const categorySelect = document.getElementById('todo-category');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const saveCategoryBtn = document.getElementById('save-category-btn');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('[data-filter]');
    const themeSwitch = document.getElementById('theme-switch');

    // Theme Switch Event Listener
    themeSwitch.addEventListener('change', function(e) {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        showToast(theme === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
    });

    // Set initial theme switch state
    themeSwitch.checked = theme === 'dark';

    // Load initial data
    loadTodos();
    loadCategories();
    updateStats();

    // Event Listeners
    todoForm.addEventListener('submit', handleTodoSubmit);
    addCategoryBtn.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('add-category-modal'));
        modal.show();
    });
    saveCategoryBtn.addEventListener('click', handleCategorySubmit);
    searchInput.addEventListener('input', handleSearch);
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterTodos(e.target.dataset.filter);
        });
    });

    // Functions
    async function loadTodos() {
        showLoading(todoContainer);
        try {
            const response = await fetch('/api/todos');
            if (!response.ok) throw new Error('فشل تحميل المهام');
            todos = await response.json();
            renderTodos();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading(todoContainer);
        }
    }

    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('فشل تحميل التصنيفات');
            categories = await response.json();
            renderCategories();
            updateCategorySelect();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function updateStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('فشل تحديث الإحصائيات');
            const stats = await response.json();
            
            document.getElementById('total-tasks').textContent = stats.total;
            document.getElementById('completed-tasks').textContent = stats.completed;
            
            const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            const progressBar = document.getElementById('completion-rate');
            progressBar.style.width = `${completionRate}%`;
            progressBar.setAttribute('aria-valuenow', completionRate);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function handleTodoSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> جاري الإضافة...';
            
            const formData = new FormData(form);
            const todoData = {
                title: formData.get('title'),
                description: formData.get('description'),
                priority: formData.get('priority'),
                due_date: formData.get('due_date'),
                category_id: formData.get('category_id') || null
            };

            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrf_token')
                },
                body: JSON.stringify(todoData)
            });

            if (!response.ok) {
                throw new Error('فشل إضافة المهمة');
            }

            form.reset();
            await loadTodos();
            await updateStats();
            showToast('تم إضافة المهمة بنجاح');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async function handleCategorySubmit() {
        const form = document.getElementById('category-form');
        const submitBtn = saveCategoryBtn;
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> جاري الحفظ...';
            
            const formData = new FormData(form);
            const categoryData = {
                name: formData.get('name'),
                color: formData.get('color')
            };

            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrf_token')
                },
                body: JSON.stringify(categoryData)
            });

            if (!response.ok) {
                throw new Error('فشل إضافة التصنيف');
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('add-category-modal'));
            modal.hide();
            form.reset();
            await loadCategories();
            showToast('تم إضافة التصنيف بنجاح');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async function handleTodoAction(todoId, action, data = {}) {
        try {
            const response = await fetch(`/api/todos/${todoId}`, {
                method: action === 'delete' ? 'DELETE' : 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrf_token')
                },
                body: action === 'delete' ? null : JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('فشل تنفيذ العملية');
            }

            await loadTodos();
            await updateStats();
            showToast('تم تنفيذ العملية بنجاح');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function renderTodos(filteredTodos = todos) {
        todoContainer.innerHTML = '';
        if (filteredTodos.length === 0) {
            todoContainer.innerHTML = '<div class="text-center text-muted p-4">لا توجد مهام</div>';
            return;
        }

        filteredTodos.forEach(todo => {
            const todoElement = todoTemplate.content.cloneNode(true);
            
            const title = todoElement.querySelector('.todo-title');
            const description = todoElement.querySelector('.todo-description');
            const checkbox = todoElement.querySelector('.todo-checkbox');
            const priority = todoElement.querySelector('.todo-priority');
            const category = todoElement.querySelector('.todo-category');
            const dueDate = todoElement.querySelector('.todo-due-date');
            const deleteBtn = todoElement.querySelector('.delete-btn');
            const editBtn = todoElement.querySelector('.edit-btn');
            
            title.textContent = todo.title;
            description.textContent = todo.description;
            checkbox.checked = todo.completed;
            
            if (todo.priority) {
                priority.textContent = getPriorityText(todo.priority);
                priority.classList.add(getPriorityClass(todo.priority));
                priority.dataset.priority = todo.priority;
            }
            
            if (todo.category) {
                category.textContent = todo.category.name;
                category.style.backgroundColor = todo.category.color;
            } else {
                category.remove();
            }
            
            if (todo.due_date) {
                const date = new Date(todo.due_date);
                dueDate.textContent = date.toLocaleDateString('ar-SA');
                
                // Add warning for due tasks
                const today = new Date();
                const dueDateTime = new Date(todo.due_date);
                if (dueDateTime < today && !todo.completed) {
                    dueDate.classList.add('text-danger', 'fw-bold');
                }
            } else {
                dueDate.remove();
            }
            
            const todoItem = todoElement.querySelector('.todo-item');
            if (todo.completed) {
                todoItem.classList.add('completed');
            }
            
            checkbox.addEventListener('change', () => {
                handleTodoAction(todo.id, 'update', { completed: checkbox.checked });
            });
            
            deleteBtn.addEventListener('click', () => {
                if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                    handleTodoAction(todo.id, 'delete');
                }
            });
            
            editBtn.addEventListener('click', () => {
                showEditTodoModal(todo);
            });
            
            todoContainer.appendChild(todoElement);
        });
    }

    function renderCategories() {
        categoriesList.innerHTML = '';
        if (categories.length === 0) {
            categoriesList.innerHTML = '<div class="text-center text-muted p-2">لا توجد تصنيفات</div>';
            return;
        }

        categories.forEach(category => {
            const categoryElement = categoryTemplate.content.cloneNode(true);
            
            const name = categoryElement.querySelector('.category-name');
            const count = categoryElement.querySelector('.category-count');
            const item = categoryElement.querySelector('.category-item');
            
            name.textContent = category.name;
            count.textContent = todos.filter(todo => todo.category && todo.category.id === category.id).length;
            item.style.borderLeft = `4px solid ${category.color}`;
            
            item.addEventListener('click', () => {
                const filteredTodos = todos.filter(todo => todo.category && todo.category.id === category.id);
                renderTodos(filteredTodos);
                filterButtons.forEach(btn => btn.classList.remove('active'));
            });
            
            categoriesList.appendChild(categoryElement);
        });
    }

    function updateCategorySelect() {
        categorySelect.innerHTML = '<option value="">-- اختر تصنيف --</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }

    function showEditTodoModal(todo) {
        const modal = new bootstrap.Modal(document.getElementById('edit-todo-modal'));
        const form = document.getElementById('edit-todo-form');
        
        form.elements['title'].value = todo.title;
        form.elements['description'].value = todo.description;
        form.elements['priority'].value = todo.priority;
        form.elements['category_id'].value = todo.category ? todo.category.id : '';
        form.elements['due_date'].value = todo.due_date;
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            await handleTodoAction(todo.id, 'update', {
                title: formData.get('title'),
                description: formData.get('description'),
                priority: formData.get('priority'),
                category_id: formData.get('category_id') || null,
                due_date: formData.get('due_date')
            });
            modal.hide();
        };
        
        modal.show();
    }

    function getPriorityText(priority) {
        const priorities = {
            low: 'منخفضة',
            medium: 'متوسطة',
            high: 'عالية'
        };
        return priorities[priority] || priority;
    }

    function getPriorityClass(priority) {
        const classes = {
            low: 'bg-success',
            medium: 'bg-warning',
            high: 'bg-danger'
        };
        return classes[priority] || 'bg-secondary';
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredTodos = todos.filter(todo => 
            todo.title.toLowerCase().includes(searchTerm) ||
            todo.description.toLowerCase().includes(searchTerm)
        );
        renderTodos(filteredTodos);
    }

    function filterTodos(filter) {
        let filteredTodos = todos;
        if (filter === 'active') {
            filteredTodos = todos.filter(todo => !todo.completed);
        } else if (filter === 'completed') {
            filteredTodos = todos.filter(todo => todo.completed);
        } else if (filter === 'due-today') {
            const today = new Date().toISOString().split('T')[0];
            filteredTodos = todos.filter(todo => todo.due_date === today);
        } else if (filter === 'overdue') {
            const today = new Date().toISOString().split('T')[0];
            filteredTodos = todos.filter(todo => 
                todo.due_date < today && !todo.completed
            );
        }
        renderTodos(filteredTodos);
    }

    function showToast(message, type = 'success') {
        const toastContainer = document.querySelector('.toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'bg-danger text-white' : ''}`;
        toast.innerHTML = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    function showLoading(container) {
        container.innerHTML = '<div class="text-center p-4"><span class="loading-spinner"></span> جاري التحميل...</div>';
    }

    function hideLoading(container) {
        container.innerHTML = '';
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
});
