// ==========================================
// GOOGLE APPS SCRIPT BACKEND CHO GIA PHẢ
// ==========================================

const ADMIN_PASSWORD = "admin"; // TODO: Thay đổi mật khẩu này

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data;
    const password = payload.password;
    
    // Authentication Check
    if (action !== 'GET_MEMBERS' && password !== ADMIN_PASSWORD) {
      throw new Error('Unauthorized: Sai mật khẩu quản trị!');
    }
    
    let result = null;
    
    switch (action) {
      case 'GET_MEMBERS':
        result = getMembers();
        break;
      case 'ADD_MEMBER':
        result = addMember(data);
        break;
      case 'ADD_PARENT':
        result = addParent(data);
        break;
      case 'ADD_SPOUSE':
        result = addSpouse(data);
        break;
      case 'MARK_DECEASED':
        result = markDeceased(data);
        break;
      case 'UPDATE_MEMBER':
        result = updateMember(data);
        break;
      case 'DELETE_MEMBER':
        result = deleteMember(data);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Cấp quyền CORS nếu cần gọi GET (mặc dù frontend dùng POST để lách preflight)
function doGet(e) {
  return ContentService.createTextOutput("Backend is running")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Helper: Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Initialize headers if new
    if (sheetName === 'Members') {
      sheet.appendRow(['id', 'name', 'gender', 'birthDate', 'isDeceased', 'deathDate', 'generation', 'birthOrder', 'fatherId', 'motherId', 'relationType', 'avatarUrl', 'academicLevel', 'career', 'biography', 'email']);
    } else if (sheetName === 'Spouses') {
      sheet.appendRow(['id', 'memberId', 'spouseId', 'isPrimary', 'order']);
    }
  }
  return sheet;
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      obj[header] = val === "" ? null : val;
    });
    return obj;
  });
}

function getMembers() {
  const members = sheetToObjects('Members');
  const spouses = sheetToObjects('Spouses');
  
  // Format lại boolean/number do Google Sheets có thể đọc thành chuỗi
  members.forEach(m => {
    m.isDeceased = m.isDeceased === true || m.isDeceased === 'true' || m.isDeceased === 'TRUE';
    m.generation = parseInt(m.generation) || 1;
    m.birthOrder = parseInt(m.birthOrder) || 1;
    
    // Gắn spouses
    m.spouses = spouses
      .filter(s => s.memberId === m.id)
      .map(s => ({
        id: s.spouseId,
        isPrimary: s.isPrimary === true || s.isPrimary === 'true' || s.isPrimary === 'TRUE',
        order: parseInt(s.order) || 1
      }));
      
    // Gắn spouseOf (nếu người này là vợ/chồng được ghép vào)
    const spouseOf = spouses
      .filter(s => s.spouseId === m.id)
      .map(s => ({
        id: s.memberId,
        isPrimary: s.isPrimary === true || s.isPrimary === 'true' || s.isPrimary === 'TRUE',
        order: parseInt(s.order) || 1
      }));
      
    m.spouses = [...m.spouses, ...spouseOf];
  });
  
  return members;
}

function addMember(data) {
  const sheet = getSheet('Members');
  const newMember = {
    id: generateUUID(),
    name: data.name || '',
    gender: data.gender || 'male',
    birthDate: data.birthDate || '',
    isDeceased: data.isDeceased || false,
    deathDate: data.deathDate || '',
    generation: data.generation || 1,
    birthOrder: data.birthOrder || 1,
    fatherId: data.fatherId || '',
    motherId: data.motherId || '',
    relationType: data.relationType || 'BIOLOGICAL',
    avatarUrl: data.avatarUrl || '',
    academicLevel: data.academicLevel || '',
    career: data.career || '',
    biography: data.biography || '',
    email: data.email || ''
  };

  sheet.appendRow([
    newMember.id, newMember.name, newMember.gender, newMember.birthDate, newMember.isDeceased,
    newMember.deathDate, newMember.generation, newMember.birthOrder, newMember.fatherId,
    newMember.motherId, newMember.relationType, newMember.avatarUrl, newMember.academicLevel,
    newMember.career, newMember.biography, newMember.email
  ]);

  newMember.spouses = [];
  return newMember;
}

function addParent(data) {
  const membersSheet = getSheet('Members');
  const membersData = membersSheet.getDataRange().getValues();
  
  // Find child
  let childRowIndex = -1;
  let childGeneration = 1;
  
  for (let i = 1; i < membersData.length; i++) {
    if (membersData[i][0] === data.childId) {
      childRowIndex = i;
      childGeneration = parseInt(membersData[i][6]) || 1;
      break;
    }
  }
  
  if (childRowIndex === -1) throw new Error("Child not found");
  
  let targetGeneration = childGeneration - 1;
  
  if (targetGeneration < 1) {
    // Shift ALL members down by 1 generation
    for (let i = 1; i < membersData.length; i++) {
      membersData[i][6] = (parseInt(membersData[i][6]) || 1) + 1;
    }
    // Write back to sheet
    membersSheet.getRange(1, 1, membersData.length, membersData[0].length).setValues(membersData);
    
    // Now target is generation 1
    targetGeneration = 1;
  }
  
  // Create parent
  const newParent = {
    id: generateUUID(),
    name: data.name || '',
    gender: data.gender || 'male',
    birthDate: data.birthDate || '',
    isDeceased: data.isDeceased || false,
    deathDate: data.deathDate || '',
    generation: targetGeneration,
    birthOrder: 1,
    fatherId: '',
    motherId: '',
    relationType: 'BIOLOGICAL',
    avatarUrl: '',
    academicLevel: '',
    career: '',
    biography: ''
  };
  
  membersSheet.appendRow([
    newParent.id, newParent.name, newParent.gender, newParent.birthDate, newParent.isDeceased, 
    newParent.deathDate, newParent.generation, newParent.birthOrder, newParent.fatherId, 
    newParent.motherId, newParent.relationType, newParent.avatarUrl, newParent.academicLevel, 
    newParent.career, newParent.biography
  ]);
  
  // Update child's fatherId or motherId
  if (newParent.gender === 'male') {
    membersSheet.getRange(childRowIndex + 1, 9).setValue(newParent.id); // index 8 is fatherId -> col 9
  } else {
    membersSheet.getRange(childRowIndex + 1, 10).setValue(newParent.id); // index 9 is motherId -> col 10
  }
  
  newParent.spouses = [];
  return newParent;
}

function addSpouse(data) {
  // data có memberId, name, isPrimary, order, targetMember
  const targetId = data.memberId;
  const targetMember = data.targetMember; // Truyền từ FE lên cho nhanh
  
  const membersSheet = getSheet('Members');
  const newSpouse = {
    id: generateUUID(),
    name: data.name || '',
    gender: targetMember.gender === 'male' ? 'female' : 'male',
    birthDate: '',
    isDeceased: false,
    deathDate: '',
    generation: targetMember.generation,
    birthOrder: 1,
    fatherId: '',
    motherId: '',
    relationType: 'BIOLOGICAL',
    avatarUrl: '',
    academicLevel: '',
    career: '',
    biography: ''
  };
  
  membersSheet.appendRow([
    newSpouse.id, newSpouse.name, newSpouse.gender, newSpouse.birthDate, newSpouse.isDeceased, 
    newSpouse.deathDate, newSpouse.generation, newSpouse.birthOrder, newSpouse.fatherId, 
    newSpouse.motherId, newSpouse.relationType, newSpouse.avatarUrl, newSpouse.academicLevel, 
    newSpouse.career, newSpouse.biography
  ]);
  
  const spousesSheet = getSheet('Spouses');
  spousesSheet.appendRow([
    generateUUID(),
    targetId,
    newSpouse.id,
    data.isPrimary || false,
    data.order || 1
  ]);
  
  // Trả về spouse mới kèm relationships để FE tự ghép
  newSpouse.spouses = [{
    id: targetId,
    isPrimary: data.isPrimary || false,
    order: data.order || 1
  }];
  
  return newSpouse;
}

function markDeceased(data) {
  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  let updatedRow = -1;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) { // Cột 0 là ID
      sheet.getRange(i + 1, 5).setValue(true); // Cột 5 (index 4) là isDeceased
      sheet.getRange(i + 1, 6).setValue(data.deathDate || ''); // Cột 6 (index 5) là deathDate
      updatedRow = i;
      break;
    }
  }
  
  if (updatedRow === -1) throw new Error("Member not found");
  
  return { id: data.id, isDeceased: true, deathDate: data.deathDate || '' };
}

function updateMember(data) {
  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  const emailCol = values[0].indexOf('email'); // -1 nếu Sheet cũ chưa chạy ensureEmailColumn()
  let updatedRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      // ['id', 'name', 'gender', 'birthDate', 'isDeceased', 'deathDate', 'generation', 'birthOrder', 'fatherId', 'motherId', 'relationType', 'avatarUrl', 'academicLevel', 'career', 'biography']
      if (data.name !== undefined) values[i][1] = data.name;
      if (data.gender !== undefined) values[i][2] = data.gender;
      if (data.birthDate !== undefined) values[i][3] = data.birthDate;
      if (data.isDeceased !== undefined) values[i][4] = data.isDeceased;
      if (data.deathDate !== undefined) values[i][5] = data.deathDate;
      if (data.generation !== undefined) values[i][6] = data.generation;
      if (data.birthOrder !== undefined) values[i][7] = data.birthOrder;
      if (data.fatherId !== undefined) values[i][8] = data.fatherId;
      if (data.motherId !== undefined) values[i][9] = data.motherId;
      if (data.relationType !== undefined) values[i][10] = data.relationType;
      if (data.avatarUrl !== undefined) values[i][11] = data.avatarUrl;
      if (data.academicLevel !== undefined) values[i][12] = data.academicLevel;
      if (data.career !== undefined) values[i][13] = data.career;
      if (data.biography !== undefined) values[i][14] = data.biography;
      if (data.email !== undefined && emailCol > -1) values[i][emailCol] = data.email;

      updatedRow = i;
      break;
    }
  }

  if (updatedRow === -1) throw new Error("Member not found");

  // Ghi toàn bộ dữ liệu trở lại trong 1 lệnh API (tối ưu hóa tốc độ O(1))
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  return data;
}

// Chạy hàm này 1 LẦN (chọn hàm trong dropdown Apps Script editor > Run) nếu Sheet
// Members của bạn được tạo TRƯỚC KHI tính năng email được thêm vào, để bật tính
// năng lưu email liên hệ qua giao diện web (mục "Sửa hồ sơ").
function ensureEmailColumn() {
  const sheet = getSheet('Members');
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('email') === -1) {
    sheet.getRange(1, lastCol + 1).setValue('email');
    Logger.log('Đã thêm cột "email" vào Sheet Members.');
  } else {
    Logger.log('Cột "email" đã tồn tại, không cần thêm.');
  }
}

function deleteMember(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing member ID");
  
  // --- Tối ưu hóa: Đọc toàn bộ vào RAM, lọc và ghi lại 1 lần (O(1) API calls) ---
  const membersSheet = getSheet('Members');
  const membersData = membersSheet.getDataRange().getValues();
  const newMembersData = membersData.filter((row, i) => i === 0 || row[0] !== targetId);
  
  if (newMembersData.length === membersData.length) {
    throw new Error("Member not found");
  }
  
  // Xóa trắng vùng cũ và ghi đè vùng mới
  membersSheet.getDataRange().clearContent();
  membersSheet.getRange(1, 1, newMembersData.length, newMembersData[0].length).setValues(newMembersData);
  
  // --- Tương tự cho Spouses ---
  const spousesSheet = getSheet('Spouses');
  const spousesData = spousesSheet.getDataRange().getValues();
  if (spousesData.length > 1) {
    const newSpousesData = spousesData.filter((row, i) => i === 0 || (row[1] !== targetId && row[2] !== targetId));
    if (newSpousesData.length < spousesData.length) {
      spousesSheet.getDataRange().clearContent();
      spousesSheet.getRange(1, 1, newSpousesData.length, newSpousesData[0].length).setValues(newSpousesData);
    }
  }
  
  return { success: true, id: targetId };
}

// ==========================================
// NHẮC LỊCH GIỖ / SINH NHẬT QUA EMAIL
// ==========================================
// Cách kích hoạt: mở file này trong Apps Script editor, chọn hàm
// "createDailyReminderTrigger" ở dropdown trên thanh công cụ rồi bấm Run
// (chỉ cần chạy 1 LẦN). Từ đó hệ thống sẽ tự kiểm tra & gửi email mỗi ngày
// lúc ~7h sáng, không cần ai mở web app. Người nhận là tất cả thành viên
// có điền "email" trong hồ sơ (xem hàm ensureEmailColumn()).

const REMINDER_DAYS_AHEAD = 3; // Gửi nhắc trước bao nhiêu ngày

function parseDayMonth(dateString) {
  if (!dateString) return null;
  const str = String(dateString);

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { day: parseInt(isoMatch[3]), month: parseInt(isoMatch[2]) };
  }

  const match = str.match(/\b(\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day: day, month: month };
    }
  }
  return null;
}

// Số ngày còn lại đến lần xuất hiện tiếp theo của ngày/tháng đó (0 = hôm nay)
function daysUntilNextOccurrence(day, month, today) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let target = new Date(t0.getFullYear(), month - 1, day);
  if (target < t0) {
    target = new Date(t0.getFullYear() + 1, month - 1, day);
  }
  return Math.round((target - t0) / (1000 * 60 * 60 * 24));
}

function buildReminderEmailBody(upcomingEvents) {
  const rows = upcomingEvents.map(function (ev) {
    const when = ev.daysUntil === 0 ? 'Hôm nay' : (ev.daysUntil === 1 ? 'Ngày mai' : 'Còn ' + ev.daysUntil + ' ngày');
    return '<li><b>' + ev.label + '</b> — ' + ev.member.name + ' (' + ev.day + '/' + ev.month + ') — ' + when + '</li>';
  }).join('');

  return '<div style="font-family: Georgia, serif; color: #4a3728;">' +
    '<h2 style="color: #7b241c;">🌳 Nhắc lịch Gia Phả</h2>' +
    '<p>Các sự kiện sắp diễn ra trong ' + REMINDER_DAYS_AHEAD + ' ngày tới:</p>' +
    '<ul>' + rows + '</ul>' +
    '</div>';
}

function checkAndSendReminders() {
  const members = getMembers();

  const recipients = members
    .map(function (m) { return m.email; })
    .filter(function (email) { return email && String(email).indexOf('@') > -1; });

  if (recipients.length === 0) {
    Logger.log('Không có email nào được cấu hình, bỏ qua gửi nhắc nhở.');
    return;
  }

  const today = new Date();
  const upcoming = [];

  members.forEach(function (member) {
    if (!member.isDeceased && member.birthDate) {
      const dm = parseDayMonth(member.birthDate);
      if (dm) {
        const daysUntil = daysUntilNextOccurrence(dm.day, dm.month, today);
        if (daysUntil >= 0 && daysUntil <= REMINDER_DAYS_AHEAD) {
          upcoming.push({ member: member, label: 'Sinh nhật', day: dm.day, month: dm.month, daysUntil: daysUntil });
        }
      }
    }
    if (member.isDeceased && member.deathDate) {
      const dm = parseDayMonth(member.deathDate);
      if (dm) {
        const daysUntil = daysUntilNextOccurrence(dm.day, dm.month, today);
        if (daysUntil >= 0 && daysUntil <= REMINDER_DAYS_AHEAD) {
          upcoming.push({ member: member, label: 'Ngày giỗ', day: dm.day, month: dm.month, daysUntil: daysUntil });
        }
      }
    }
  });

  if (upcoming.length === 0) {
    Logger.log('Không có sự kiện nào sắp tới trong ' + REMINDER_DAYS_AHEAD + ' ngày.');
    return;
  }

  upcoming.sort(function (a, b) { return a.daysUntil - b.daysUntil; });

  const subject = '[Gia Phả] Nhắc lịch: ' + upcoming.length + ' sự kiện sắp tới';
  const body = buildReminderEmailBody(upcoming);

  recipients.forEach(function (email) {
    try {
      MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
    } catch (err) {
      Logger.log('Gửi email thất bại tới ' + email + ': ' + err);
    }
  });
}

// Chạy hàm này 1 LẦN từ Apps Script editor để đăng ký trigger tự động chạy
// checkAndSendReminders() mỗi ngày (khoảng 7h-8h sáng theo múi giờ của Script).
function createDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkAndSendReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  Logger.log('Đã tạo trigger gửi nhắc nhở hàng ngày lúc ~7h sáng.');
}
