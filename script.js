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
    
    // Генерируем классическую таблицу
    generateClassicView();
    
    // Настраиваем MainButton
    tg.MainButton.hide();
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

// ==================== КЛАССИЧЕСКАЯ ТАБЛИЦА ====================

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

// ==================== ОБРАБОТКА ВЫБОРА КВАРТИРЫ ====================

function handleApartmentClick(floor, apartment, aptData) {
    const isOccupied = !!aptData;
    
    // Сохраняем выбранную квартиру
    selectedApartment = {
        floor: floor,
        apartment: apartment,
        occupied: isOccupied,
        owner: aptData?.owner || null,
        area: aptData?.area || null,
        block: aptData?.block || null,
        clientId: aptData?.client_id || null
    };
    
    // Показываем соответствующую кнопку
    if (isOccupied && aptData) {
        // Занятая квартира - предлагаем создать квитанцию
        showOccupiedApartmentInfo(floor, apartment, aptData);
    } else {
        // Свободная квартира - предлагаем создать договор
        showFreeApartmentInfo(floor, apartment);
    }
    
    // Тактильная отдача
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
}

// Показать информацию о занятой квартире
function showOccupiedApartmentInfo(floor, apartment, aptData) {
    // Показываем popup с информацией
    const message = `👤 Владелец: ${aptData.owner}\n📐 Площадь: ${aptData.area} м²\n🏢 Блок: ${aptData.block}\n📍 Квартира: ${floor}-${apartment}\n\n💡 Нажмите кнопку ниже чтобы создать квитанцию`;
    
    tg.showAlert(message);
    
    // Настраиваем MainButton для создания квитанции
    tg.MainButton.setText('📝 Создать ежемесячную квитанцию');
    tg.MainButton.color = '#3390ec';
    tg.MainButton.show();
    
    // Удаляем предыдущие обработчики
    tg.MainButton.offClick();
    
    // Добавляем новый обработчик
    tg.MainButton.onClick(function handler() {
        sendDataToBot('create_receipt', floor, apartment, aptData.client_id);
        tg.MainButton.offClick(handler);
    });
}

// Показать информацию о свободной квартире
function showFreeApartmentInfo(floor, apartment) {
    // Определяем примерную площадь (можно взять из справочника)
    const estimatedArea = '40.71'; // По умолчанию
    const estimatedRooms = 2;
    
    const message = `📍 Квартира: ${floor}-${apartment}\n📐 Площадь: ~${estimatedArea} м²\n🛏️ Комнат: ${estimatedRooms}\n🏢 Этаж: ${floor}\n✅ Статус: Свободна\n\n💡 Нажмите кнопку ниже чтобы создать договор`;
    
    tg.showAlert(message);
    
    // Настраиваем MainButton для создания договора
    tg.MainButton.setText('✍️ Создать договор');
    tg.MainButton.color = '#4caf50';
    tg.MainButton.show();
    
    // Удаляем предыдущие обработчики
    tg.MainButton.offClick();
    
    // Добавляем новый обработчик
    tg.MainButton.onClick(function handler() {
        sendDataToBot('create_contract', floor, apartment, null);
        tg.MainButton.offClick(handler);
    });
}

// Отправка данных боту
function sendDataToBot(action, floor, apartment, clientId) {
    const data = {
        action: action,
        floor: floor,
        apartment: apartment,
        client_id: clientId
    };
    
    console.log('📤 Отправка данных боту:', data);
    
    // Отправляем данные боту
    tg.sendData(JSON.stringify(data));
    
    // Закрываем Mini App
    tg.close();
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
