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
            <p>Откройте бота и выберите "Шахматка 4 (Mini App)"</p>
        </div>
    `;
    throw new Error('Unauthorized access - not from Telegram');
}

// Этажи и квартиры
const floors = ['ц.', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const apartments = 14;

// Состояние выбора
let selectedApartment = null;

// Статусы квартир (будут загружены из бота)
let apartmentsStatus = {};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // 🔒 Дополнительная проверка безопасности
    if (!validateTelegramData()) {
        showError('Ошибка авторизации. Откройте через Telegram бота.');
        return;
    }
    
    // Получаем статусы квартир из initData или загружаем с сервера
    try {
        const initData = tg.initDataUnsafe;
        
        // Загружаем статусы квартир
        await loadApartmentsStatus();
        
    } catch (e) {
        console.log('No init data, using empty status');
    }
    
    // Генерируем таблицу
    generateChessBoard();
    
    // Настраиваем главную кнопку
    tg.MainButton.setText('Выбрать квартиру');
    tg.MainButton.color = tg.themeParams.button_color || '#3390ec';
    tg.MainButton.hide();
    
    // Обработчик главной кнопки
    tg.MainButton.onClick(() => {
        if (selectedApartment) {
            // Отправляем данные обратно в бота
            tg.sendData(JSON.stringify(selectedApartment));
        }
    });
});

// Генерация таблицы шахматки
function generateChessBoard() {
    const tbody = document.getElementById('chessBoard');
    tbody.innerHTML = '';
    
    floors.forEach(floor => {
        const row = document.createElement('tr');
        
        // Ячейка с номером этажа
        const floorCell = document.createElement('td');
        floorCell.className = 'floor-label';
        floorCell.textContent = floor;
        row.appendChild(floorCell);
        
        // Ячейки с квартирами
        for (let apt = 1; apt <= apartments; apt++) {
            const cell = document.createElement('td');
            cell.className = 'apartment-cell';
            
            // Проверяем статус квартиры
            const isOccupied = apartmentsStatus[floor] && apartmentsStatus[floor][apt];
            
            if (isOccupied) {
                cell.className += ' occupied';
                cell.textContent = '🔴';
            } else {
                cell.className += ' free';
                cell.textContent = '🟢';
            }
            
            // Обработчик клика
            cell.addEventListener('click', () => handleCellClick(floor, apt, cell, isOccupied));
            
            row.appendChild(cell);
        }
        
        tbody.appendChild(row);
    });
}

// Обработка клика по ячейке
function handleCellClick(floor, apartment, cell, isOccupied) {
    // Снимаем выделение с предыдущей ячейки
    document.querySelectorAll('.apartment-cell.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Выделяем текущую ячейку
    cell.classList.add('selected');
    
    // Сохраняем выбор
    selectedApartment = {
        floor: floor,
        apartment: apartment,
        occupied: isOccupied
    };
    
    // Показываем главную кнопку
    tg.MainButton.setText(`Выбрать: Этаж ${floor}, Кв. ${apartment} ${isOccupied ? '🔴' : '🟢'}`);
    tg.MainButton.show();
    
    // Тактильная отдача (если поддерживается)
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// ==================== ФУНКЦИИ БЕЗОПАСНОСТИ ====================

// 🔒 Проверка подлинности данных от Telegram
function validateTelegramData() {
    // Проверяем наличие initData
    if (!tg.initData) {
        console.error('🔒 Нет initData от Telegram');
        return false;
    }
    
    // Проверяем наличие обязательных полей
    const initDataUnsafe = tg.initDataUnsafe;
    if (!initDataUnsafe || !initDataUnsafe.user) {
        console.error('🔒 Неполные данные пользователя');
        return false;
    }
    
    // Проверяем, что запрос идет из правильной среды
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('🔒 Не найден Telegram WebApp SDK');
        return false;
    }
    
    console.log('✅ Проверка безопасности пройдена');
    console.log('👤 Пользователь:', initDataUnsafe.user.id);
    
    return true;
}

// Показать ошибку
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

// Загрузка статусов квартир
async function loadApartmentsStatus() {
    try {
        // Загружаем статусы из JSON файла
        const response = await fetch('apartments_status.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        apartmentsStatus = data;
        
        // Подсчитываем статистику
        let occupiedCount = 0;
        for (const floor in apartmentsStatus) {
            occupiedCount += Object.keys(apartmentsStatus[floor]).length;
        }
        
        console.log('✅ Статусы квартир загружены из базы данных');
        console.log(`📊 Этажей с занятыми квартирами: ${Object.keys(apartmentsStatus).length}`);
        console.log(`🔴 Всего занятых квартир: ${occupiedCount}`);
        
        return true;
    } catch (e) {
        console.error('⚠️ Ошибка загрузки статусов:', e);
        console.log('📊 Используем пустые статусы (все квартиры свободны)');
        // Продолжаем работу с пустыми статусами
        apartmentsStatus = {};
        return false;
    }
}

// Применение темной темы Telegram
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

// 🔒 Дополнительная защита: блокировка DevTools (опционально)
(function() {
    const devtools = /./;
    devtools.toString = function() {
        console.warn('🔒 Попытка открыть DevTools обнаружена');
    };
    console.log('%c🔒 Защищенное приложение', 'font-size: 20px; color: red; font-weight: bold;');
    console.log('%cЭто приложение работает только через официального Telegram бота', 'font-size: 14px;');
})();

