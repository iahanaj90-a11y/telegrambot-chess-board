// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// 🔒 ЗАЩИТА: Проверка что приложение запущено из Telegram
if (!tg.initData || tg.initData.length === 0) {
    document.body.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
            <h1>🔒 Доступ запрещен</h1>
            <p>Это приложение работает только через Telegram бота.</p>
            <p>Откройте бота и выберите "Шахматка квартир"</p>
        </div>
    `;
    throw new Error('Unauthorized access - not from Telegram');
}

// Глобальные данные
const floors = ['ц.', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const apartmentsPerFloor = 14;
let apartmentsData = {};
let selectedApartment = null;
let currentFilter = 'all';
let currentTab = 'classic';

// Флаги для lazy loading
const tabsLoaded = {
    classic: false,
    cards: false,
    list: false,
    heatmap: false
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // 🔒 Проверка безопасности
    if (!validateTelegramData()) {
        showError('Ошибка авторизации. Откройте через Telegram бота.');
        return;
    }
    
    // Загружаем данные о квартирах
    await loadApartmentsData();
    
    // Обновляем статистику
    updateStats();
    
    // Загружаем первый таб (Классика)
    generateClassicView();
    tabsLoaded.classic = true;
    
    // Восстанавливаем последний выбранный таб
    const savedTab = sessionStorage.getItem('selectedTab');
    if (savedTab && savedTab !== 'classic') {
        switchTab(savedTab);
    }
    
    // Добавляем обработчики поиска
    document.getElementById('cardsSearch')?.addEventListener('input', (e) => searchCards(e.target.value));
    document.getElementById('listSearch')?.addEventListener('input', (e) => searchList(e.target.value));
});

// ==================== ЗАГРУЗКА ДАННЫХ ====================

async function loadApartmentsData() {
    try {
        const response = await fetch('apartments_status.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        apartmentsData = await response.json();
        
        console.log('✅ Данные о квартирах загружены');
        console.log(`📊 Этажей: ${Object.keys(apartmentsData).length}`);
        
        return true;
    } catch (e) {
        console.error('⚠️ Ошибка загрузки данных:', e);
        console.log('📊 Используем пустые данные (все квартиры свободны)');
        apartmentsData = {};
        return false;
    }
}

// ==================== СТАТИСТИКА ====================

function updateStats() {
    const totalApartments = floors.length * apartmentsPerFloor;
    let occupiedCount = 0;
    
    for (const floor in apartmentsData) {
        occupiedCount += Object.keys(apartmentsData[floor]).length;
    }
    
    const freeCount = totalApartments - occupiedCount;
    
    document.getElementById('totalApartments').textContent = totalApartments;
    document.getElementById('occupiedCount').textContent = occupiedCount;
    document.getElementById('freeCount').textContent = freeCount;
}

// ==================== ПЕРЕКЛЮЧЕНИЕ ТАБОВ ====================

function switchTab(tabName) {
    // Сохраняем выбор
    currentTab = tabName;
    sessionStorage.setItem('selectedTab', tabName);
    
    // Обновляем кнопки табов
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Обновляем контент табов
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    // Lazy loading: генерируем контент только при первом открытии
    if (!tabsLoaded[tabName]) {
        switch(tabName) {
            case 'classic':
                generateClassicView();
                break;
            case 'cards':
                generateCardsView();
                break;
            case 'list':
                generateListView();
                break;
            case 'heatmap':
                generateHeatmapView();
                break;
        }
        tabsLoaded[tabName] = true;
    }
    
    // Тактильная отдача
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// ==================== ВАРИАНТ 1: КЛАССИКА (Excel) ====================

function generateClassicView() {
    const tbody = document.getElementById('classicBody');
    tbody.innerHTML = '';
    
    floors.forEach(floor => {
        const row = document.createElement('tr');
        
        // Ячейка с номером этажа
        const floorCell = document.createElement('td');
        floorCell.className = 'floor-label';
        floorCell.textContent = floor;
        row.appendChild(floorCell);
        
        // Ячейки с квартирами
        for (let apt = 1; apt <= apartmentsPerFloor; apt++) {
            const cell = document.createElement('td');
            const cellDiv = document.createElement('div');
            cellDiv.className = 'apartment-cell';
            
            const aptData = apartmentsData[floor]?.[apt];
            const isOccupied = !!aptData;
            
            cellDiv.classList.add(isOccupied ? 'occupied' : 'free');
            
            // Иконка статуса
            const icon = document.createElement('div');
            icon.className = 'status-icon';
            icon.textContent = isOccupied ? '🔴' : '🟢';
            cellDiv.appendChild(icon);
            
            // Номер квартиры
            const number = document.createElement('div');
            number.className = 'apt-number';
            number.textContent = `${floor}-${apt}`;
            cellDiv.appendChild(number);
            
            // ФИО владельца (если занята)
            if (isOccupied && aptData.owner) {
                const owner = document.createElement('div');
                owner.className = 'owner-name';
                owner.textContent = aptData.owner;
                cellDiv.appendChild(owner);
            }
            
            // Обработчик клика
            cellDiv.addEventListener('click', () => handleApartmentClick(floor, apt, aptData));
            
            cell.appendChild(cellDiv);
            row.appendChild(cell);
        }
        
        tbody.appendChild(row);
    });
}

// ==================== ВАРИАНТ 2: КАРТОЧКИ ====================

function generateCardsView() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';
    
    const allApartments = [];
    
    // Собираем все квартиры
    floors.forEach(floor => {
        for (let apt = 1; apt <= apartmentsPerFloor; apt++) {
            const aptData = apartmentsData[floor]?.[apt];
            allApartments.push({
                floor,
                apartment: apt,
                data: aptData,
                occupied: !!aptData
            });
        }
    });
    
    // Сортируем: сначала занятые, потом свободные
    allApartments.sort((a, b) => {
        if (a.occupied && !b.occupied) return -1;
        if (!a.occupied && b.occupied) return 1;
        return 0;
    });
    
    // Генерируем карточки
    allApartments.forEach(apt => {
        const card = document.createElement('div');
        card.className = `apartment-card ${apt.occupied ? 'occupied' : 'free'}`;
        card.dataset.floor = apt.floor;
        card.dataset.apartment = apt.apartment;
        card.dataset.owner = apt.data?.owner || '';
        
        // Иконка
        const icon = document.createElement('div');
        icon.className = 'card-icon';
        icon.textContent = apt.occupied ? '🔴' : '🟢';
        card.appendChild(icon);
        
        // Номер квартиры
        const number = document.createElement('div');
        number.className = 'card-number';
        number.textContent = `${apt.floor}-${apt.apartment}`;
        card.appendChild(number);
        
        // Этаж
        const floor = document.createElement('div');
        floor.className = 'card-floor';
        floor.textContent = `Этаж: ${apt.floor}`;
        card.appendChild(floor);
        
        // Владелец
        if (apt.occupied && apt.data?.owner) {
            const owner = document.createElement('div');
            owner.className = 'card-owner';
            owner.textContent = apt.data.owner;
            card.appendChild(owner);
        }
        
        // Площадь
        if (apt.data?.area) {
            const area = document.createElement('div');
            area.className = 'card-area';
            area.textContent = `${apt.data.area} м²`;
            card.appendChild(area);
        }
        
        // Клик
        card.addEventListener('click', () => handleApartmentClick(apt.floor, apt.apartment, apt.data));
        
        container.appendChild(card);
    });
}

function searchCards(query) {
    const cards = document.querySelectorAll('.apartment-card');
    const searchLower = query.toLowerCase();
    
    cards.forEach(card => {
        const number = `${card.dataset.floor}-${card.dataset.apartment}`;
        const owner = card.dataset.owner.toLowerCase();
        
        const matches = number.includes(searchLower) || owner.includes(searchLower);
        card.style.display = matches ? 'flex' : 'none';
    });
}

// ==================== ВАРИАНТ 3: СПИСОК ====================

function generateListView() {
    const container = document.getElementById('listContainer');
    container.innerHTML = '';
    
    floors.forEach(floor => {
        const group = document.createElement('div');
        group.className = 'floor-group';
        
        // Заголовок этажа
        const header = document.createElement('div');
        header.className = 'floor-header-list';
        
        const floorApts = apartmentsData[floor] || {};
        const occupiedInFloor = Object.keys(floorApts).length;
        
        header.innerHTML = `
            <span>Этаж ${floor} (${occupiedInFloor}/${apartmentsPerFloor})</span>
            <span class="floor-toggle">▼</span>
        `;
        
        header.addEventListener('click', () => {
            group.classList.toggle('collapsed');
            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
        
        group.appendChild(header);
        
        // Список квартир
        const list = document.createElement('div');
        list.className = 'apartments-list';
        
        for (let apt = 1; apt <= apartmentsPerFloor; apt++) {
            const aptData = apartmentsData[floor]?.[apt];
            const isOccupied = !!aptData;
            
            const item = document.createElement('div');
            item.className = `list-item ${isOccupied ? 'occupied' : 'free'}`;
            item.dataset.status = isOccupied ? 'occupied' : 'free';
            item.dataset.owner = aptData?.owner || '';
            
            const info = document.createElement('div');
            info.className = 'list-item-info';
            
            const title = document.createElement('div');
            title.className = 'list-item-title';
            title.textContent = `Квартира ${floor}-${apt}`;
            info.appendChild(title);
            
            const details = document.createElement('div');
            details.className = 'list-item-details';
            
            if (isOccupied && aptData) {
                details.textContent = `${aptData.owner} • ${aptData.area} м² • Блок ${aptData.block}`;
            } else {
                details.textContent = 'Свободна';
            }
            
            info.appendChild(details);
            item.appendChild(info);
            
            const status = document.createElement('div');
            status.className = 'list-item-status';
            status.textContent = isOccupied ? '🔴' : '🟢';
            item.appendChild(status);
            
            // Клик
            item.addEventListener('click', () => handleApartmentClick(floor, apt, aptData));
            
            list.appendChild(item);
        }
        
        group.appendChild(list);
        container.appendChild(group);
    });
}

function filterList(filter) {
    currentFilter = filter;
    
    // Обновляем кнопки фильтра
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    // Фильтруем элементы
    const items = document.querySelectorAll('.list-item');
    items.forEach(item => {
        const status = item.dataset.status;
        
        if (filter === 'all') {
            item.style.display = 'flex';
        } else {
            item.style.display = status === filter ? 'flex' : 'none';
        }
    });
    
    // Тактильная отдача
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function searchList(query) {
    const items = document.querySelectorAll('.list-item');
    const searchLower = query.toLowerCase();
    
    items.forEach(item => {
        const title = item.querySelector('.list-item-title').textContent.toLowerCase();
        const owner = item.dataset.owner.toLowerCase();
        
        const matches = title.includes(searchLower) || owner.includes(searchLower);
        
        // Учитываем текущий фильтр
        if (currentFilter === 'all') {
            item.style.display = matches ? 'flex' : 'none';
        } else {
            const status = item.dataset.status;
            item.style.display = (matches && status === currentFilter) ? 'flex' : 'none';
        }
    });
}

// ==================== ВАРИАНТ 4: ТЕПЛОВАЯ КАРТА ====================

function generateHeatmapView() {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '';
    
    floors.forEach(floor => {
        for (let apt = 1; apt <= apartmentsPerFloor; apt++) {
            const aptData = apartmentsData[floor]?.[apt];
            const isOccupied = !!aptData;
            
            const cell = document.createElement('div');
            cell.className = `heatmap-cell ${isOccupied ? 'occupied' : 'free'}`;
            cell.title = `${floor}-${apt}${aptData ? ': ' + aptData.owner : ''}`;
            
            // Номер квартиры
            const number = document.createElement('div');
            number.className = 'heatmap-cell-number';
            number.textContent = apt;
            cell.appendChild(number);
            
            // Этаж
            const floorLabel = document.createElement('div');
            floorLabel.className = 'heatmap-cell-floor';
            floorLabel.textContent = floor;
            cell.appendChild(floorLabel);
            
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            
            if (isOccupied && aptData) {
                tooltip.innerHTML = `
                    Кв. ${floor}-${apt}<br>
                    ${aptData.owner}<br>
                    ${aptData.area} м²
                `;
            } else {
                tooltip.innerHTML = `Кв. ${floor}-${apt}<br>Свободна`;
            }
            
            cell.appendChild(tooltip);
            
            // Клик
            cell.addEventListener('click', () => handleApartmentClick(floor, apt, aptData));
            
            container.appendChild(cell);
        }
    });
}

// ==================== ОБРАБОТКА ВЫБОРА КВАРТИРЫ ====================

function handleApartmentClick(floor, apartment, aptData) {
    const isOccupied = !!aptData;
    
    selectedApartment = {
        floor,
        apartment,
        occupied: isOccupied,
        owner: aptData?.owner || null,
        area: aptData?.area || null,
        block: aptData?.block || null
    };
    
    // Формируем сообщение для MainButton
    let message = `Этаж ${floor}, Кв. ${apartment}`;
    
    if (isOccupied && aptData) {
        message += ` • ${aptData.owner}`;
    } else {
        message += ` • Свободна`;
    }
    
    // Показываем информацию через Telegram
    tg.showPopup({
        title: `Квартира ${floor}-${apartment}`,
        message: isOccupied && aptData ? 
            `Владелец: ${aptData.owner}\nПлощадь: ${aptData.area} м²\nБлок: ${aptData.block}\nСтатус: Занята 🔴` :
            `Статус: Свободна 🟢`,
        buttons: [
            {id: 'close', type: 'close'}
        ]
    });
    
    // Тактильная отдача
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
}

// ==================== БЕЗОПАСНОСТЬ ====================

function validateTelegramData() {
    if (!tg.initData) {
        console.error('🔒 Нет initData от Telegram');
        return false;
    }
    
    const initDataUnsafe = tg.initDataUnsafe;
    if (!initDataUnsafe || !initDataUnsafe.user) {
        console.error('🔒 Неполные данные пользователя');
        return false;
    }
    
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('🔒 Не найден Telegram WebApp SDK');
        return false;
    }
    
    console.log('✅ Проверка безопасности пройдена');
    console.log('👤 Пользователь:', initDataUnsafe.user.id);
    
    return true;
}

function showError(message) {
    document.body.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
            <h1>⚠️ Ошибка</h1>
            <p>${message}</p>
            <button onclick="location.reload()" style="
                padding: 12px 24px;
                background: #3390ec;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 16px;
            ">Попробовать снова</button>
        </div>
    `;
}

// ==================== ТЕМА ====================

// Применение темы Telegram
if (tg.colorScheme === 'dark') {
    document.body.classList.add('dark-theme');
}

// Обработка изменения темы
tg.onEvent('themeChanged', () => {
    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
});

// 🔒 Дополнительная защита
(function() {
    console.log('%c🔒 Защищенное приложение', 'font-size: 20px; color: red; font-weight: bold;');
    console.log('%cЭто приложение работает только через официального Telegram бота', 'font-size: 14px;');
})();
