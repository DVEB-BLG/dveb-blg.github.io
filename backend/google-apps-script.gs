/**
 * ДВЭБ — Бэкенд форм (Google Apps Script)
 * 
 * Принимает заявки с сайта, пишет в Google Таблицу,
 * отправляет email и уведомление в Telegram.
 * Файлы сохраняются на Google Drive в папки по заявкам.
 */

// ===== НАСТРОЙКИ =====

var NOTIFY_EMAIL = 'office@двэб.рф';
var TELEGRAM_BOT_TOKEN = '8634358159:AAFg_0QDArdbs6VBSX6WigK7duuqotfHHdk';
var TELEGRAM_CHAT_ID = '8746448641';

// ===== / НАСТРОЙКИ =====


/**
 * Обработка POST-запроса
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.uploadFile) {
      return handleFileUpload(data);
    }
    
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

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'DVEB Form Backend' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
//          ОБРАБОТКА ЗАЯВОК
// ============================================

/**
 * Запись заявки в Google Таблицу
 */
function writeToSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 9).setValues([[
      'Дата', 'Форма', 'Имя', 'Телефон', 'Email', 
      'Организация', 'Тип инспекции', 'Объект', 'Комментарий'
    ]]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  var phoneRaw = String(data.phone || '—');
  var phoneForSheet = phoneRaw.replace(/^\+7/, '8');
  if (phoneForSheet.charAt(0) === '+') phoneForSheet = phoneForSheet.substring(1);
  
  var nextRow = sheet.getLastRow() + 1;
  
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
 * Отправка email
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
 * Отправка в Telegram
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
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text.join('\n'),
      parse_mode: 'MarkdownV2'
    }),
    muteHttpExceptions: true
  });
}

// ============================================
//          ЗАГРУЗКА ФАЙЛОВ
// ============================================

/**
 * Приём файла → сохранение на Google Drive в папку заявки
 */
function handleFileUpload(data) {
  // Главная папка
  var rootName = 'ДВЭБ — Заявки с сайта';
  var rootFolders = DriveApp.getFoldersByName(rootName);
  var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootName);
  
  // Определяем номер и имя для папки заявки
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var requestNum = lastRow; // номер заявки = номер строки в таблице
  var clientName = data.clientName || 'Без_имени';
  
  // Очищаем имя для папки (убираем спецсимволы)
  var safeName = String(clientName).replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').trim().replace(/\s+/g, '_');
  if (!safeName) safeName = 'Без_имени';
  
  // Падка заявки: "001_Имя_Фамилия"
  var padNum = ('00' + requestNum).slice(-3);
  var folderName = padNum + '_' + safeName;
  
  // Создаём или находим папку заявки
  var subFolders = rootFolder.getFoldersByName(folderName);
  var requestFolder = subFolders.hasNext() ? subFolders.next() : rootFolder.createFolder(folderName);
  
  // Сохраняем файл
  var bytes = Utilities.base64Decode(data.fileData);
  var blob = Utilities.newBlob(bytes, data.mimeType, data.fileName);
  var file = requestFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileUrl = file.getUrl();
  var folderUrl = requestFolder.getUrl();
  
  // Уведомление в Telegram
  var tgText = [
    '📁 *Новый файл с сайта ДВЭБ*',
    '',
    'Заявка: ' + escapeMarkdown(padNum),
    'Клиент: ' + escapeMarkdown(clientName),
    'Файл: ' + escapeMarkdown(data.fileName),
    '',
    'Папка: ' + escapeMarkdown(folderUrl),
    'Файл: ' + escapeMarkdown(fileUrl)
  ].join('\n');
  
  UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: tgText,
      parse_mode: 'MarkdownV2'
    }),
    muteHttpExceptions: true
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, url: fileUrl, folder: folderUrl }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
//          УТИЛИТЫ
// ============================================

function escapeMarkdown(str) {
  return String(str).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Тест
 */
function testScript() {
  var testData = {
    formType: 'Тест',
    name: 'Тест Тестов',
    phone: '+7 999 123 45 67',
    email: 'test@example.com',
    organization: 'Тест ООО',
    inspectionType: 'Экспертиза',
    objectType: 'Проект СЗЗ',
    message: 'Тестовая заявка'
  };
  
  writeToSheet(testData);
  sendEmail(testData);
  sendTelegram(testData);
  
  Logger.log('Тест выполнен.');
}
