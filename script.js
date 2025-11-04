// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Этажи и квартиры
const floors = ['ц.', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const apartments = 14;

// Состояние выбора
let selectedApartment = null;

// Статусы квартир (будут загружены из бота)
let apartmentsStatus = {};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Получаем статусы квартир из initData или используем пустой объект
    try {
        const initData = tg.initDataUnsafe;
        if (initData && initData.start_param) {
            // Если бот передал данные, парсим их
            apartmentsStatus = JSON.parse(decodeURIComponent(initData.start_param));
        }
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

