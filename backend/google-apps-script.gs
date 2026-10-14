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
    
    var pdfUrl = '';
    try {
      pdfUrl = createRequestPdf(data);
    } catch (pdfErr) {
      // PDF не критичен: таблица и уведомления важнее
      Logger.log('PDF error: ' + pdfErr);
    }
    
    sendEmail(data, pdfUrl);
    sendTelegram(data, pdfUrl);
    
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
function sendEmail(data, pdfUrl) {
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
    pdfUrl ? 'PDF-заявление: ' + pdfUrl : '',
    'Это автоматическое уведомление. Не отвечайте на это письмо.'
  ].filter(function(l){ return l !== ''; }).join('\n');
  
  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body, {
    from: 'office@двэб.рф',
    name: 'Сайт ДВЭБ'
  });
}

/**
 * Отправка в Telegram
 */
function sendTelegram(data, pdfUrl) {
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
  if (pdfUrl) text.push('📄 PDF-заявление: ' + escapeMarkdown(pdfUrl));
  
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
//          ГЕНЕРАЦИЯ PDF-ЗАЯВЛЕНИЯ
// ============================================

/**
 * Создаёт PDF «Заявление на проведение инспекции» из данных квиза,
 * сохраняет в папку заявки на Google Drive и возвращает ссылку.
 */
function createRequestPdf(data) {
  var requestNum = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getLastRow();
  var padNum = ('00' + requestNum).slice(-3);
  
  var safeName = String(data.name || 'Без_имени')
    .replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').trim().replace(/\s+/g, '_');
  if (!safeName) safeName = 'Без_имени';
  
  // Папка заявки — та же, что для файлов (001_Имя_Фамилия)
  var rootFolders = DriveApp.getFoldersByName('ДВЭБ — Заявки с сайта');
  var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('ДВЭБ — Заявки с сайта');
  var folderName = padNum + '_' + safeName;
  var subFolders = rootFolder.getFoldersByName(folderName);
  var requestFolder = subFolders.hasNext() ? subFolders.next() : rootFolder.createFolder(folderName);
  
  var now = Utilities.formatDate(new Date(), 'Asia/Yakutsk', 'dd.MM.yyyy HH:mm');
  
  var objectType = data.objectType || '—';
  if (data.objectType === 'Другое' && data.objectTypeOther) {
    objectType += ' — ' + data.objectTypeOther;
  }
  
  function esc(s) {
    return String(s || '—')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  var html = [
    '<html><head><meta charset="UTF-8">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }',
    'h2 { text-align: center; margin-bottom: 2px; }',
    '.sub { text-align: center; color: #444; margin-top: 0; }',
    'table { width: 100%; border-collapse: collapse; margin-top: 16px; }',
    'td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }',
    'td.k { width: 35%; background: #f2f2f2; font-weight: bold; }',
    '.footer { margin-top: 24px; color: #666; font-size: 10px; }',
    '</style></head><body>',
    '<h2>ЗАЯВЛЕНИЕ</h2>',
    '<p class="sub">на проведение инспекции (с сайта двэб.рф)</p>',
    '<table>',
    row('Номер заявки', '№ ' + padNum + ' от ' + now),
    row('Тип инспекции', data.inspectionType || '—'),
    row('Тип объекта / вид деятельности', objectType),
    row('Организация', data.organization || '—'),
    row('Контактное лицо', data.name || '—'),
    row('Телефон', data.phone || '—'),
    row('Email', data.email || '—'),
    row('Дополнительная информация', data.message || data.question || '—'),
    row('Источник (форма)', data.formType || '—'),
    '</table>',
    '<p class="footer">Заявка подана через сайт https://двэб.рф. Исполнитель: ООО «Дальневосточное бюро экспертиз», RA.RU.710669.</p>',
    '</body></html>'
  ].join('\n');
  
  function row(k, v) {
    return '<tr><td class="k">' + k + '</td><td>' + esc(v) + '</td></tr>';
  }
  
  var blob = Utilities.newBlob(html, 'text/html', 'statement.html')
    .getAs('application/pdf')
    .setName('Заявление_' + padNum + '_' + safeName + '.pdf');
  
  var file = requestFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
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
  
  // Батч-режим: копим список файлов, уведомление — одно на всю пачку
  var batchId = data.batchId;
  if (batchId) {
    var props = PropertiesService.getScriptProperties();
    var key = 'batch_' + batchId;
    var batch = JSON.parse(props.getProperty(key) || '{"files":[]}');
    batch.files.push({ name: data.fileName, url: fileUrl });
    batch.padNum = padNum;
    batch.clientName = clientName;
    batch.folderUrl = folderUrl;
    
    if (batch.files.length >= Number(data.batchTotal || 1)) {
      // Последний файл пачки — отправляем сводку и чистим состояние
      var lines = [
        '📁 *Новая загрузка с сайта ДВЭБ*',
        '',
        'Заявка: ' + escapeMarkdown(batch.padNum),
        'Клиент: ' + escapeMarkdown(batch.clientName),
        'Файлов: ' + escapeMarkdown(String(batch.files.length)),
        ''
      ];
      batch.files.forEach(function(f) {
        lines.push('• ' + escapeMarkdown(f.name) + ': ' + escapeMarkdown(f.url));
      });
      lines.push('');
      lines.push('Папка: ' + escapeMarkdown(batch.folderUrl));
      
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: lines.join('\n'),
          parse_mode: 'MarkdownV2'
        }),
        muteHttpExceptions: true
      });
      props.deleteProperty(key);
    } else {
      // Ждём остальные файлы (TTL-подчистка от зависших батчей не критична,
      // ключи одноразовые, чистятся при завершении)
      props.setProperty(key, JSON.stringify(batch));
    }
  } else {
    // Одиночный файл без батча — прежнее поведение
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
  }
  
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

function testDriveUpload() {
  var data = {
    uploadFile: true,
    fileName: 'test_manual.txt',
    mimeType: 'text/plain',
    fileData: Utilities.base64Encode('Тест Drive ДВЭБ'),
    clientName: 'Тест Тестов'
  };
  var result = handleFileUpload(data);
  Logger.log(result.getContent());
}
