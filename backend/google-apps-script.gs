/**
 * ДВЭБ — Бэкенд форм (Google Apps Script)
 * 
 * Принимает заявки с сайта, пишет в Google Таблицу,
 * отправляет email и уведомление в Telegram.
 * 
 * === ИНСТРУКЦИЯ ПО УСТАНОВКЕ ===
 * 
 * 1. Откройте https://sheets.google.com → создайте пустую таблицу
 * 2. Назовите её «ДВЭБ — Заявки с сайта»
 * 3. Меню: Расширения → Apps Script
 * 4. Удалите весь код, вставьте этот файл
 * 5. Заполните НАСТРОЙКИ ниже
 * 6. Нажмите «Сохранить»
 * 7. Нажмите «Начать развертывание» → «Новое развертывание»
 * 8. Тип: «Веб-приложение»
 * 9. Выполнять от имени: «Меня»
 * 10. Доступ: «Все»
 * 11. Скопируйте URL веб-приложения
 * 12. Вставьте его в файл js/form-config.js на сайте
 * 
 * ================================
 */

// ===== НАСТРОЙКИ =====

// Email для уведомлений о новых заявках
var NOTIFY_EMAIL = 'office@двэб.рф';

// Telegram-бот (создать через @BotFather)
var TELEGRAM_BOT_TOKEN = '8634358159:AAFg_0QDArdbs6VBSX6WigK7duuqotfHHdk';
var TELEGRAM_CHAT_ID = '8746448641';

// ===== / НАСТРОЙКИ =====


/**
 * Обработка POST-запроса с сайта
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Если это загрузка файла
    if (data.uploadFile) {
      return handleFileUpload(data);
    }
    
    // Обычная заявка
    writeToSheet(data);
    sendEmail(data);
    sendTelegram(data);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Загрузка файла на Google Drive
 */
function handleFileUpload(data) {
  var folderName = 'ДВЭБ — Заявки с сайта';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  
  var bytes = Utilities.base64Decode(data.fileData);
  var blob = Utilities.newBlob(bytes, data.mimeType, data.fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var url = file.getUrl();
  
  // Уведомление в Telegram
  var text = '📁 *Новый файл с сайта ДВЭБ*\n\n' +
    'Имя: ' + escapeMarkdown(data.fileName) + '\n' +
    'Ссылка: ' + escapeMarkdown(url);
  
  var tgUrl = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  UrlFetchApp.fetch(tgUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'MarkdownV2'
    }),
    muteHttpExceptions: true
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, url: url }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Обработка GET-запроса (проверка что работает)
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'DVEB Form Backend' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Запись заявки в Google Таблицу
 */
function writeToSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  
  // Заголовки при первом запуске
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 9).setValues([[
      'Дата', 'Форма', 'Имя', 'Телефон', 'Email', 
      'Организация', 'Тип инспекции', 'Объект', 'Комментарий'
    ]]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Для таблицы: заменяем +7 на 8 (Google воспринимает + как формулу)
  var phoneRaw = String(data.phone || '—');
  var phoneForSheet = phoneRaw.replace(/^\+7/, '8');
  if (phoneForSheet.charAt(0) === '+') phoneForSheet = phoneForSheet.substring(1);
  
  var nextRow = sheet.getLastRow() + 1;
  
  // Записываем по ячейкам — обходим appendRow
  sheet.getRange(nextRow, 1).setValue(new Date());
  sheet.getRange(nextRow, 2).setValue(data.formType || '—');
  sheet.getRange(nextRow, 3).setValue(data.name || '—');
  sheet.getRange(nextRow, 4).setValue(phoneForSheet);
  sheet.getRange(nextRow, 5).setValue(data.email || '—');
  sheet.getRange(nextRow, 6).setValue(data.organization || '—');
  sheet.getRange(nextRow, 7).setValue(data.inspectionType || '—');
  sheet.getRange(nextRow, 8).setValue(data.objectType || '—');
  sheet.getRange(nextRow, 9).setValue(data.message || data.question || '—');
}

/**
 * Отправка email с полным текстом заявки
 */
function sendEmail(data) {
  var subject = 'Новая заявка с сайта ДВЭБ — ' + (data.formType || 'Форма');
  
  var body = [
    'Поступила новая заявка с сайта ДВЭБ.',
    '',
    'Форма: ' + (data.formType || '—'),
    'Дата: ' + new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yakutsk' }),
    '',
    'Имя: ' + (data.name || '—'),
    'Телефон: ' + (data.phone || '—'),
    'Email: ' + (data.email || '—'),
    'Организация: ' + (data.organization || '—'),
    '',
    'Тип инспекции: ' + (data.inspectionType || '—'),
    'Объект: ' + (data.objectType || '—'),
    '',
    'Комментарий:',
    data.message || data.question || '—',
    '',
    '—',
    'Сайт: https://dveb-blg.github.io',
    'Это автоматическое уведомление. Не отвечайте на это письмо.'
  ].join('\n');
  
  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

/**
 * Отправка короткого уведомления в Telegram
 */
function sendTelegram(data) {
  if (TELEGRAM_BOT_TOKEN === '') return;
  
  var text = [
    '📋 *Новая заявка с сайта ДВЭБ*',
    '',
    'Форма: ' + escapeMarkdown(data.formType || '—'),
    'Имя: ' + escapeMarkdown(data.name || '—'),
    'Телефон: ' + escapeMarkdown(data.phone || '—')
  ];
  
  if (data.organization) text.push('Орг: ' + escapeMarkdown(data.organization));
  if (data.objectType) text.push('Объект: ' + escapeMarkdown(data.objectType));
  if (data.message) {
    var msg = data.message;
    if (msg.length > 200) msg = msg.substring(0, 200) + '...';
    text.push('Коммент: ' + escapeMarkdown(msg));
  }
  
  var url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  var payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text.join('\n'),
    parse_mode: 'MarkdownV2'
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function escapeMarkdown(str) {
  return String(str).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Тестовая функция — запустить вручную для проверки
 */
function testScript() {
  var testData = {
    formType: 'Консультация',
    name: 'Тест Тестов',
    phone: '+7 999 123 45 67',
    email: 'test@example.com',
    organization: 'Тест ООО',
    inspectionType: 'Санитарно-эпидемиологическая экспертиза',
    objectType: 'Проект СЗЗ',
    message: 'Это тестовая заявка для проверки работы бэкенда.'
  };
  
  writeToSheet(testData);
  sendEmail(testData);
  sendTelegram(testData);
  
  Logger.log('Тест выполнен. Проверьте таблицу, почту и Telegram.');
}
