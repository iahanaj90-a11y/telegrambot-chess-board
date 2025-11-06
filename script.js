// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

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
    
    // Настраиваем MainButton (скрыт по умолчанию)
    tg.MainButton.hide();
    
    // Обработчик клика по MainButton - ОТПРАВКА CALLBACK БОТУ
    tg.MainButton.onClick(() => {
        if (selectedApartment) {
            console.log('✅ Квартира выбрана:', selectedApartment);
            
            const action = selectedApartment.occupied ? 'receipt' : 'contract';
            const floor = selectedApartment.floor;
            const apartment = selectedApartment.apartment;
            const area = selectedApartment.area || '40.71';
            const block = selectedApartment.block || 'A';
            const clientId = selectedApartment.clientId || 'none';
            const owner = selectedApartment.owner || '';
            
            // Сохраняем данные в localStorage для последующего использования
            const apartmentData = {
                action,
                floor,
                apartment,
                area,
                block,
                clientId,
                owner,
                timestamp: Date.now()
            };
            localStorage.setItem('selectedApartment', JSON.stringify(apartmentData));
            console.log('💾 Данные сохранены в localStorage:', apartmentData);
            
            // Формируем callback_data для отправки боту
            const callbackData = `apt_${action}_${floor}_${apartment}_${area}_${block}_${clientId}`;
            
            // Пытаемся отправить данные через sendData
            try {
                tg.sendData(callbackData);
                console.log('📤 sendData вызван:', callbackData);
            } catch (e) {
                console.warn('⚠️ sendData не сработал:', e);
            }
            
            // Формируем deep link с параметрами для бота
            // Формат: contract|receipt_floor_apartment_area_block_clientId
            const deepLinkParam = `${action}_${floor}_${apartment}_${area}_${block}_${clientId}`;
            const botUsername = 'testdogovorbot'; // Имя вашего бота
            const deepLink = `https://t.me/${botUsername}?start=${deepLinkParam}`;
            
            console.log('🔗 Deep link сформирован:', deepLink);
            
            // Открываем deep link, который автоматически запустит бота с параметрами
            tg.openTelegramLink(deepLink);
            
            // Закрываем Mini App
            console.log('🚪 Закрываем Mini App');
            tg.close();
        } else {
            tg.showAlert('❌ Сначала выберите квартиру!');
        }
    });
    
    // Обработка закрытия Mini App
    window.addEventListener('beforeunload', () => {
        if (selectedApartment) {
            console.log('🔄 Mini App закрывается с выбранной квартирой:', selectedApartment);
        }
    });
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
    
    selectedApartment = {
        floor: floor,
        apartment: apartment,
        occupied: isOccupied,
        owner: aptData?.owner || null,
        area: aptData?.area || null,
        block: aptData?.block || null,
        clientId: aptData?.client_id || null
    };
    
    console.log('🎯 Выбрана квартира:', selectedApartment);
    
    if (isOccupied && aptData) {
        // Занятая квартира
        showOccupiedApartmentInfo(floor, apartment, aptData);
    } else {
        // Свободная квартира
        showFreeApartmentInfo(floor, apartment);
    }
    
    // Тактильная отдача
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
}

// Показать информацию о занятой квартире
function showOccupiedApartmentInfo(floor, apartment, aptData) {
    // Формируем сообщение
    let message = `👤 Владелец: ${aptData.owner}\n`;
    message += `📐 Площадь: ${aptData.area} м²\n`;
    message += `🏢 Блок: ${aptData.block}\n`;
    message += `📍 Квартира: ${floor}-${apartment}`;
    
    // Показываем информацию и активируем MainButton
    tg.showPopup({
        title: `Квартира ${floor}-${apartment}`,
        message: message,
        buttons: [
            {id: 'ok', type: 'default', text: 'OK'}
        ]
    });
    
    // Активируем MainButton для создания квитанции
    tg.MainButton.setText('📝 Создать квитанцию');
    tg.MainButton.show();
    
    console.log('✅ MainButton активирована для квитанции, client_id:', aptData.client_id);
}

// Показать информацию о свободной квартире
function showFreeApartmentInfo(floor, apartment) {
    let message = `📍 Квартира: ${floor}-${apartment}\n`;
    message += `📐 Площадь: ~40.71 м²\n`;
    message += `🛏️ Комнат: 2\n`;
    message += `🏢 Этаж: ${floor}\n`;
    message += `✅ Статус: Свободна`;
    
    // Показываем информацию и активируем MainButton
    tg.showPopup({
        title: `Квартира ${floor}-${apartment}`,
        message: message,
        buttons: [
            {id: 'ok', type: 'default', text: 'OK'}
        ]
    });
    
    // Активируем MainButton для создания договора
    tg.MainButton.setText('✍️ Создать договор');
    tg.MainButton.show();
    
    console.log('✅ MainButton активирована для договора, квартира:', floor, '-', apartment);
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
