// ==========================================
// GOOGLE APPS SCRIPT BACKEND CHO GIA PHẢ
// ==========================================
//
// SAU KHI DÁN CODE NÀY VÀO APPS SCRIPT (lần đầu, hoặc sau khi cập nhật từ bản cũ):
//   1. Chọn hàm "runOneTimeSetup" ở dropdown trên thanh công cụ > bấm Run (chỉ 1 lần).
//      Hàm này tự tạo các Sheet còn thiếu (Users, Sessions, AuditLog, PendingEdits) và
//      tự thêm các cột mới (isDeleted, telegramChatId...) vào Sheet Members/Events cũ.
//      Nó cũng tự tạo 1 tài khoản đăng nhập mặc định: username "admin", mật khẩu chính
//      là giá trị ADMIN_PASSWORD bên dưới — ĐĂNG NHẬP XONG NHỚ ĐỔI MẬT KHẨU trong app.
//   2. Triển khai lại (New deployment) như hướng dẫn trong README.
//   3. (Tùy chọn) Chạy "createDailyReminderTrigger" và "createWeeklyBackupTrigger" 1 lần
//      để bật nhắc lịch qua email/Telegram và tự sao lưu Sheet hàng tuần.

const ADMIN_PASSWORD = "admin"; // Chỉ dùng để tạo tài khoản "admin" mặc định lúc runOneTimeSetup(). Đổi mật khẩu qua app sau khi đăng nhập lần đầu.

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data;
    // Giữ tên field cũ "password" để không phải sửa lại toàn bộ Frontend cũ — nhưng từ giờ
    // giá trị này là SESSION TOKEN trả về từ hành động LOGIN, không còn là mật khẩu thô nữa.
    const credential = payload.password;

    // Các hành động công khai: không cần đăng nhập (hiển thị Trang Chủ/Lịch sự kiện, đăng
    // nhập, đăng xuất, và cho khách gửi đề xuất chỉnh sửa hồ sơ để admin duyệt sau).
    const PUBLIC_ACTIONS = ['GET_MEMBERS', 'GET_EVENTS', 'LOGIN', 'LOGOUT', 'SUBMIT_EDIT_REQUEST'];

    let session = null;
    if (PUBLIC_ACTIONS.indexOf(action) === -1) {
      session = getValidSession_(credential);
      if (!session) throw new Error('Unauthorized: Phiên đăng nhập hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại.');
      if (session.role !== 'ADMIN') throw new Error('Unauthorized: Tài khoản của bạn không có quyền thực hiện thao tác này.');
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
      case 'GET_EVENTS':
        result = getEvents();
        break;
      case 'ADD_EVENT':
        result = addEvent(data);
        break;
      case 'DELETE_EVENT':
        result = deleteEvent(data);
        break;
      case 'UPLOAD_AVATAR':
        result = uploadAvatar(data);
        break;

      // --- Đăng nhập đa tài khoản (thay cho 1 mật khẩu chung) ---
      case 'LOGIN':
        result = login(data);
        break;
      case 'LOGOUT':
        result = logout(credential);
        break;
      case 'CHANGE_PASSWORD':
        result = changePassword(session, data);
        break;
      case 'GET_USERS':
        result = getUsers();
        break;
      case 'ADD_USER':
        result = addUser(data);
        break;
      case 'DELETE_USER':
        result = deleteUser(data, session);
        break;

      // --- Thùng rác (xóa mềm, khôi phục được) ---
      case 'GET_TRASH':
        result = getTrash();
        break;
      case 'RESTORE_MEMBER':
        result = restoreMember(data);
        break;
      case 'PURGE_MEMBER':
        result = purgeMember(data);
        break;
      case 'SHIFT_GENERATIONS':
        result = shiftGenerations(data);
        break;
      case 'RESTORE_EVENT':
        result = restoreEvent(data);
        break;
      case 'PURGE_EVENT':
        result = purgeEvent(data);
        break;

      // --- Nhật ký thao tác ---
      case 'GET_AUDIT_LOG':
        result = getAuditLog();
        break;

      // --- Gửi thông báo (cả dòng họ / theo nhánh, gửi ngay hoặc hẹn giờ) ---
      case 'SEND_NOTIFICATION':
        result = sendNotification(data, session);
        break;
      case 'PREVIEW_NOTIFICATION_RECIPIENTS':
        result = previewNotificationRecipients(data);
        break;
      case 'GET_SCHEDULED_NOTIFICATIONS':
        result = getScheduledNotifications();
        break;
      case 'CANCEL_SCHEDULED_NOTIFICATION':
        result = cancelScheduledNotification(data);
        break;

      // --- Đề xuất chỉnh sửa từ khách (chờ Admin duyệt) ---
      case 'SUBMIT_EDIT_REQUEST':
        result = submitEditRequest(data);
        break;
      case 'GET_PENDING_EDITS':
        result = getPendingEdits();
        break;
      case 'APPROVE_PENDING_EDIT':
        result = approvePendingEdit(data);
        break;
      case 'REJECT_PENDING_EDIT':
        result = rejectPendingEdit(data);
        break;

      // --- Nhập hàng loạt (khôi phục từ bản sao lưu JSON, VD: khi chuyển sang Sheet mới) ---
      case 'BULK_IMPORT_MEMBERS':
        result = bulkImportMembers(data);
        break;
      case 'BULK_IMPORT_EVENTS':
        result = bulkImportEvents(data);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    // Ghi Nhật ký thao tác cho các hành động làm thay đổi dữ liệu (không chặn thao tác
    // chính nếu ghi log lỗi — xem try/catch bên trong logAudit_).
    const MUTATING_ACTIONS = [
      'ADD_MEMBER', 'ADD_PARENT', 'ADD_SPOUSE', 'MARK_DECEASED', 'UPDATE_MEMBER', 'DELETE_MEMBER',
      'RESTORE_MEMBER', 'PURGE_MEMBER', 'ADD_EVENT', 'DELETE_EVENT', 'RESTORE_EVENT', 'PURGE_EVENT',
      'ADD_USER', 'DELETE_USER', 'CHANGE_PASSWORD', 'SUBMIT_EDIT_REQUEST', 'APPROVE_PENDING_EDIT', 'REJECT_PENDING_EDIT',
      'BULK_IMPORT_MEMBERS', 'BULK_IMPORT_EVENTS', 'SHIFT_GENERATIONS',
      'SEND_NOTIFICATION', 'CANCEL_SCHEDULED_NOTIFICATION'
    ];
    if (MUTATING_ACTIONS.indexOf(action) > -1) {
      logAudit_(action, data, result, session);
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
      sheet.appendRow(['id', 'name', 'gender', 'birthDate', 'isDeceased', 'deathDate', 'generation', 'birthOrder', 'fatherId', 'motherId', 'relationType', 'avatarUrl', 'academicLevel', 'career', 'biography', 'email', 'isDeleted', 'telegramChatId']);
    } else if (sheetName === 'Spouses') {
      sheet.appendRow(['id', 'memberId', 'spouseId', 'isPrimary', 'order']);
    } else if (sheetName === 'Events') {
      sheet.appendRow(['id', 'title', 'day', 'month', 'year', 'isLunar', 'memberId', 'note', 'isDeleted']);
    } else if (sheetName === 'Users') {
      sheet.appendRow(['id', 'username', 'passwordHash', 'salt', 'role', 'displayName', 'createdAt']);
    } else if (sheetName === 'Sessions') {
      sheet.appendRow(['token', 'userId', 'username', 'role', 'createdAt', 'expiresAt']);
    } else if (sheetName === 'AuditLog') {
      sheet.appendRow(['id', 'timestamp', 'action', 'targetId', 'targetName', 'actor', 'details']);
    } else if (sheetName === 'ScheduledNotifications') {
      sheet.appendRow(['id', 'sendAt', 'target', 'branchMemberId', 'alsoIndividuals', 'channels', 'message', 'status', 'createdBy', 'createdAt', 'sentAt', 'result']);
    } else if (sheetName === 'PendingEdits') {
      sheet.appendRow(['id', 'memberId', 'memberName', 'proposedChanges', 'submitterName', 'submitterContact', 'status', 'createdAt', 'reviewedAt']);
    }
  }
  return sheet;
}

// Thêm 1 cột mới vào cuối Sheet nếu Sheet đó được tạo TRƯỚC KHI cột này tồn tại
// (dùng cho việc di trú dữ liệu cũ, xem hàm runOneTimeSetup()).
function ensureColumn_(sheetName, columnName) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (headers.indexOf(columnName) === -1) {
    sheet.getRange(1, lastCol + 1).setValue(columnName);
  }
}

// Chạy hàm này 1 LẦN (chọn trong dropdown Apps Script editor > Run) mỗi khi cập nhật
// code từ bản cũ hơn — tự tạo các Sheet/cột còn thiếu, không đụng tới dữ liệu đã có.
function runOneTimeSetup() {
  ensureColumn_('Members', 'email');
  ensureColumn_('Members', 'isDeleted');
  ensureColumn_('Members', 'telegramChatId');
  ensureColumn_('Members', 'branchChatId');
  ensureColumn_('Events', 'isDeleted');
  getSheet('ScheduledNotifications');
  getSheet('Sessions');
  getSheet('AuditLog');
  getSheet('PendingEdits');
  ensureUsersSeed_();
  Logger.log('Hoàn tất khởi tạo/di trú Sheet. Tài khoản đăng nhập mặc định: username "admin", mật khẩu = giá trị hằng số ADMIN_PASSWORD trong code (đổi ngay sau khi đăng nhập lần đầu).');
}

// Giữ lại để tương thích ngược nếu ai đó vẫn chọn chạy hàm cũ này riêng lẻ.
function ensureEmailColumn() {
  ensureColumn_('Members', 'email');
  Logger.log('Đã đảm bảo cột "email" tồn tại trong Sheet Members.');
}

function isTruthy_(val) {
  return val === true || val === 'true' || val === 'TRUE';
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

// ==========================================
// CACHE (giảm số lần đọc Sheet cho 2 API được gọi nhiều nhất)
// ==========================================
// Google Sheets đọc khá chậm khi có nhiều dòng; cache tạm 60 giây giúp Trang Chủ/Cây
// Phả Hệ tải nhanh hơn hẳn khi nhiều người cùng xem. Mọi thao tác ghi dữ liệu đều tự
// xóa cache để không bao giờ hiển thị dữ liệu cũ quá 60 giây.

function getCache_() {
  return CacheService.getScriptCache();
}

function invalidateCache_() {
  try {
    getCache_().removeAll(['members_v1', 'events_v1']);
  } catch (err) {
    Logger.log('Xóa cache lỗi (bỏ qua): ' + err);
  }
}

function getMembers() {
  const cache = getCache_();
  const cached = cache.get('members_v1');
  if (cached) return JSON.parse(cached);

  const members = sheetToObjects('Members');
  const spouses = sheetToObjects('Spouses');

  // Format lại boolean/number do Google Sheets có thể đọc thành chuỗi
  members.forEach(m => {
    m.isDeceased = isTruthy_(m.isDeceased);
    m.isDeleted = isTruthy_(m.isDeleted);
    m.generation = parseInt(m.generation) || 1;
    m.birthOrder = parseInt(m.birthOrder) || 1;

    // Gắn spouses
    m.spouses = spouses
      .filter(s => s.memberId === m.id)
      .map(s => ({
        id: s.spouseId,
        isPrimary: isTruthy_(s.isPrimary),
        order: parseInt(s.order) || 1
      }));

    // Gắn spouseOf (nếu người này là vợ/chồng được ghép vào)
    const spouseOf = spouses
      .filter(s => s.spouseId === m.id)
      .map(s => ({
        id: s.memberId,
        isPrimary: isTruthy_(s.isPrimary),
        order: parseInt(s.order) || 1
      }));

    m.spouses = [...m.spouses, ...spouseOf];
  });

  // Ẩn các thành viên đã bị xóa (mềm) khỏi kết quả trả về cho Frontend, đồng thời dọn
  // các tham chiếu vợ/chồng trỏ tới người đã bị ẩn để tránh hiển thị lỗi trên cây phả hệ.
  const visibleIds = new Set(members.filter(m => !m.isDeleted).map(m => m.id));
  members.forEach(m => {
    m.spouses = m.spouses.filter(s => visibleIds.has(s.id));
  });
  const visible = members.filter(m => visibleIds.has(m.id));

  try {
    cache.put('members_v1', JSON.stringify(visible), 60);
  } catch (err) {
    Logger.log('Cache members bỏ qua (có thể do dữ liệu quá lớn >100KB): ' + err);
  }

  return visible;
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
  invalidateCache_();
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
  invalidateCache_();
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
    birthDate: data.birthDate || '',
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

  invalidateCache_();
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

  invalidateCache_();
  return { id: data.id, isDeceased: true, deathDate: data.deathDate || '' };
}

// Cập nhật hồ sơ thành viên — đọc/ghi theo TÊN cột (header-driven) thay vì vị trí cố
// định, để luôn hoạt động đúng dù Sheet cũ/mới có thứ tự cột lệch nhau do các lần thêm
// cột mới (email, isDeleted, telegramChatId...) qua ensureColumn_()/runOneTimeSetup().
const MEMBER_EDITABLE_FIELDS = [
  'name', 'gender', 'birthDate', 'isDeceased', 'deathDate', 'generation', 'birthOrder',
  'fatherId', 'motherId', 'relationType', 'avatarUrl', 'academicLevel', 'career',
  'biography', 'email', 'telegramChatId', 'branchChatId', 'isDeleted'
];

function updateMember(data) {
  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  let updatedRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      MEMBER_EDITABLE_FIELDS.forEach(function (field) {
        if (data[field] !== undefined) {
          const colIdx = headers.indexOf(field);
          if (colIdx > -1) values[i][colIdx] = data[field];
        }
      });
      updatedRow = i;
      break;
    }
  }

  if (updatedRow === -1) throw new Error("Member not found");

  // Ghi toàn bộ dữ liệu trở lại trong 1 lệnh API (tối ưu hóa tốc độ O(1))
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  invalidateCache_();
  return data;
}

// --- Dời số đời của TOÀN BỘ thành viên đi `offset` đời (VD: gia phả bắt đầu ghi từ đời 5
// thay vì đời 1 vì không còn thông tin các đời trước). Không cho phép đời nhỏ nhất < 1. ---
function shiftGenerations(data) {
  const offset = parseInt(data.offset, 10);
  if (!offset) return { shifted: 0 };

  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  const genIdx = values[0].indexOf('generation');
  if (genIdx === -1) throw new Error('Không tìm thấy cột generation');

  for (let i = 1; i < values.length; i++) {
    const current = parseInt(values[i][genIdx], 10) || 1;
    if (current + offset < 1) throw new Error('Số đời sau khi dời phải từ 1 trở lên');
  }
  for (let i = 1; i < values.length; i++) {
    values[i][genIdx] = (parseInt(values[i][genIdx], 10) || 1) + offset;
  }
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  invalidateCache_();
  return { shifted: values.length - 1, offset: offset };
}

// --- Xóa mềm: đánh dấu isDeleted=true, dữ liệu vẫn còn nguyên, khôi phục được ---
function deleteMember(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing member ID");

  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  const idxIsDeleted = values[0].indexOf('isDeleted');
  if (idxIsDeleted === -1) throw new Error('Sheet Members thiếu cột "isDeleted". Hãy chạy hàm runOneTimeSetup() trong Apps Script editor rồi thử lại.');

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === targetId) {
      sheet.getRange(i + 1, idxIsDeleted + 1).setValue(true);
      invalidateCache_();
      return { success: true, id: targetId, softDeleted: true };
    }
  }

  throw new Error("Member not found");
}

function restoreMember(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing member ID");

  const sheet = getSheet('Members');
  const values = sheet.getDataRange().getValues();
  const idxIsDeleted = values[0].indexOf('isDeleted');
  if (idxIsDeleted === -1) throw new Error('Sheet Members thiếu cột "isDeleted".');

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === targetId) {
      sheet.getRange(i + 1, idxIsDeleted + 1).setValue(false);
      invalidateCache_();
      return { success: true, id: targetId };
    }
  }

  throw new Error("Member not found");
}

// Xóa vĩnh viễn (dùng trong màn "Thùng rác" của Admin) — không thể khôi phục.
function purgeMember(data) {
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

  invalidateCache_();
  return { success: true, id: targetId };
}

// ==========================================
// SỰ KIỆN GIA PHẢ (Giỗ Tổ, Họp Họ, hoặc ngày kỷ niệm riêng của 1 thành viên)
// ==========================================
// memberId rỗng => sự kiện chung của cả dòng họ. memberId có giá trị => gắn với 1 thành viên cụ thể.

function getEvents() {
  const cache = getCache_();
  const cached = cache.get('events_v1');
  if (cached) return JSON.parse(cached);

  const events = sheetToObjects('Events');
  events.forEach(ev => {
    ev.day = parseInt(ev.day) || 0;
    ev.month = parseInt(ev.month) || 0;
    ev.year = ev.year ? parseInt(ev.year) : null;
    ev.isLunar = isTruthy_(ev.isLunar);
    ev.isDeleted = isTruthy_(ev.isDeleted);
  });

  const visible = events.filter(ev => !ev.isDeleted);

  try {
    cache.put('events_v1', JSON.stringify(visible), 60);
  } catch (err) {
    Logger.log('Cache events bỏ qua: ' + err);
  }

  return visible;
}

function addEvent(data) {
  const sheet = getSheet('Events');
  const newEvent = {
    id: generateUUID(),
    title: data.title || '',
    day: data.day || 1,
    month: data.month || 1,
    year: data.year || '',
    isLunar: data.isLunar || false,
    memberId: data.memberId || '',
    note: data.note || ''
  };

  sheet.appendRow([
    newEvent.id, newEvent.title, newEvent.day, newEvent.month,
    newEvent.year, newEvent.isLunar, newEvent.memberId, newEvent.note
  ]);

  invalidateCache_();
  return newEvent;
}

function deleteEvent(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing event ID");

  const sheet = getSheet('Events');
  const values = sheet.getDataRange().getValues();
  const idxIsDeleted = values[0].indexOf('isDeleted');
  if (idxIsDeleted === -1) throw new Error('Sheet Events thiếu cột "isDeleted". Hãy chạy hàm runOneTimeSetup() trong Apps Script editor rồi thử lại.');

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === targetId) {
      sheet.getRange(i + 1, idxIsDeleted + 1).setValue(true);
      invalidateCache_();
      return { success: true, id: targetId, softDeleted: true };
    }
  }

  throw new Error("Event not found");
}

function restoreEvent(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing event ID");

  const sheet = getSheet('Events');
  const values = sheet.getDataRange().getValues();
  const idxIsDeleted = values[0].indexOf('isDeleted');
  if (idxIsDeleted === -1) throw new Error('Sheet Events thiếu cột "isDeleted".');

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === targetId) {
      sheet.getRange(i + 1, idxIsDeleted + 1).setValue(false);
      invalidateCache_();
      return { success: true, id: targetId };
    }
  }

  throw new Error("Event not found");
}

function purgeEvent(data) {
  const targetId = data.id;
  if (!targetId) throw new Error("Missing event ID");

  const sheet = getSheet('Events');
  const values = sheet.getDataRange().getValues();
  const newValues = values.filter((row, i) => i === 0 || row[0] !== targetId);

  if (newValues.length === values.length) {
    throw new Error("Event not found");
  }

  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);

  invalidateCache_();
  return { success: true, id: targetId };
}

function getTrash() {
  const members = sheetToObjects('Members').filter(m => isTruthy_(m.isDeleted));
  const events = sheetToObjects('Events').filter(ev => isTruthy_(ev.isDeleted));
  return { members: members, events: events };
}

// ==========================================
// NHẬP HÀNG LOẠT (khôi phục từ bản sao lưu JSON)
// ==========================================
// Dùng khi chuyển dữ liệu sang 1 Sheet mới (VD: mất/thất lạc Sheet cũ) — nhận đúng cấu
// trúc dữ liệu mà GET_MEMBERS/GET_EVENTS trả về, GIỮ NGUYÊN id gốc để các liên kết
// cha/mẹ/vợ-chồng (fatherId, motherId, spouses) không bị đứt gãy. Bỏ qua id nào đã tồn
// tại sẵn để chạy lại nhiều lần cũng không bị nhân đôi dữ liệu.

function bulkImportMembers(data) {
  const members = data && data.members;
  if (!Array.isArray(members)) throw new Error('Thiếu danh sách "members" cần nhập');

  const sheet = getSheet('Members');
  const spousesSheet = getSheet('Spouses');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existingIds = new Set(sheetToObjects('Members').map(m => m.id));

  let imported = 0;
  const addedPairs = new Set();
  const spouseRows = [];

  members.forEach(function (m) {
    if (!m || !m.id || existingIds.has(m.id)) return;

    const row = headers.map(function (h) {
      if (h === 'isDeceased' || h === 'isDeleted') return !!m[h];
      const val = m[h];
      return (val === undefined || val === null) ? '' : val;
    });
    sheet.appendRow(row);
    imported++;

    (m.spouses || []).forEach(function (s) {
      if (!s || !s.id) return;
      const pairKey = [m.id, s.id].sort().join('|');
      if (addedPairs.has(pairKey)) return;
      addedPairs.add(pairKey);
      spouseRows.push([generateUUID(), m.id, s.id, !!s.isPrimary, s.order || 1]);
    });
  });

  spouseRows.forEach(function (row) { spousesSheet.appendRow(row); });

  invalidateCache_();
  return { success: true, imported: imported, spousesImported: spouseRows.length };
}

function bulkImportEvents(data) {
  const events = data && data.events;
  if (!Array.isArray(events)) throw new Error('Thiếu danh sách "events" cần nhập');

  const sheet = getSheet('Events');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existingIds = new Set(sheetToObjects('Events').map(e => e.id));

  let imported = 0;
  events.forEach(function (ev) {
    if (!ev || !ev.id || existingIds.has(ev.id)) return;
    const row = headers.map(function (h) {
      if (h === 'isLunar' || h === 'isDeleted') return !!ev[h];
      const val = ev[h];
      return (val === undefined || val === null) ? '' : val;
    });
    sheet.appendRow(row);
    imported++;
  });

  invalidateCache_();
  return { success: true, imported: imported };
}

// ==========================================
// NHẬT KÝ THAO TÁC (Audit Log)
// ==========================================
// Ghi lại ai đã thêm/sửa/xóa gì và khi nào — admin xem lại trong app hoặc mở thẳng
// Sheet "AuditLog". Lỗi khi ghi log KHÔNG được để làm hỏng thao tác chính của người dùng.

function logAudit_(action, data, result, session) {
  try {
    const sheet = getSheet('AuditLog');
    const actorName = session ? session.username : 'Khách (chưa đăng nhập)';
    const targetId = (data && (data.id || data.childId || data.memberId)) || (result && result.id) || '';
    const targetName = (data && data.name) || (result && result.name) || (result && result.memberName) || '';
    let details = '';
    try { details = JSON.stringify(data || {}).slice(0, 500); } catch (e) { details = ''; }
    sheet.appendRow([generateUUID(), new Date(), action, targetId, targetName, actorName, details]);
  } catch (err) {
    Logger.log('Ghi Nhật ký thao tác lỗi (bỏ qua, không ảnh hưởng thao tác chính): ' + err);
  }
}

function getAuditLog() {
  const logs = sheetToObjects('AuditLog');
  return logs.slice(-200).reverse();
}

// ==========================================
// TÀI KHOẢN & ĐĂNG NHẬP (thay cho 1 mật khẩu Admin dùng chung)
// ==========================================
// Mỗi người quản trị (VD: từng chi/nhánh trong họ) có thể có 1 tài khoản riêng, thay vì
// tất cả cùng dùng chung 1 mật khẩu như bản cũ. Mật khẩu được băm (SHA-256 + salt riêng
// từng tài khoản) trước khi lưu vào Sheet "Users" — Sheet không bao giờ lưu mật khẩu gốc.
// Đăng nhập thành công sẽ được cấp 1 "phiên" (session token) lưu trong Sheet "Sessions",
// hết hạn sau 30 ngày; token này được Frontend lưu & gửi kèm mỗi request thay cho mật khẩu.

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password);
  return bytes.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Tự tạo tài khoản "admin" mặc định (mật khẩu = ADMIN_PASSWORD) nếu Sheet Users
// còn trống — đảm bảo không ai bị khóa ngoài sau khi nâng cấp từ bản cũ.
function ensureUsersSeed_() {
  const sheet = getSheet('Users');
  if (sheet.getLastRow() > 1) return; // đã có tài khoản, không cần seed nữa

  const salt = generateUUID();
  sheet.appendRow([
    generateUUID(), 'admin', hashPassword_(ADMIN_PASSWORD, salt), salt,
    'ADMIN', 'Quản trị viên', new Date()
  ]);
  Logger.log('Đã tạo tài khoản đăng nhập mặc định: admin / ' + ADMIN_PASSWORD + ' — hãy đổi mật khẩu ngay sau khi đăng nhập.');
}

function getValidSession_(token) {
  if (!token) return null;
  const sheet = getSheet('Sessions');
  const values = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === token) {
      const expiresAt = new Date(values[i][5]);
      if (isNaN(expiresAt.getTime()) || expiresAt < now) return null;
      return { token: token, userId: values[i][1], username: values[i][2], role: values[i][3] };
    }
  }
  return null;
}

function login(data) {
  const username = ((data && data.username) || '').trim();
  const password = (data && data.password) || '';
  if (!username || !password) throw new Error('Thiếu tài khoản hoặc mật khẩu');

  ensureUsersSeed_();

  // Chống dò mật khẩu: khóa tạm 15 phút sau 5 lần đăng nhập sai liên tiếp cho 1 username.
  const cache = getCache_();
  const lockKey = 'loginfail_' + username.toLowerCase();
  const failCount = parseInt(cache.get(lockKey)) || 0;
  if (failCount >= 5) {
    throw new Error('Tài khoản tạm khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.');
  }

  const usersSheet = getSheet('Users');
  const values = usersSheet.getDataRange().getValues();
  const headers = values[0];
  const idxUsername = headers.indexOf('username');
  const idxHash = headers.indexOf('passwordHash');
  const idxSalt = headers.indexOf('salt');
  const idxRole = headers.indexOf('role');
  const idxId = headers.indexOf('id');
  const idxDisplayName = headers.indexOf('displayName');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxUsername]).toLowerCase() === username.toLowerCase()) {
      const matches = hashPassword_(password, values[i][idxSalt]) === values[i][idxHash];
      if (!matches) {
        cache.put(lockKey, String(failCount + 1), 900); // khóa 15 phút
        throw new Error('Sai tài khoản hoặc mật khẩu');
      }

      cache.remove(lockKey);

      const token = generateUUID();
      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
      const sessionsSheet = getSheet('Sessions');
      sessionsSheet.appendRow([token, values[i][idxId], values[i][idxUsername], values[i][idxRole], now, expires]);

      return {
        token: token,
        user: {
          id: values[i][idxId],
          username: values[i][idxUsername],
          role: values[i][idxRole],
          displayName: values[i][idxDisplayName] || values[i][idxUsername]
        }
      };
    }
  }

  cache.put(lockKey, String(failCount + 1), 900);
  throw new Error('Sai tài khoản hoặc mật khẩu');
}

function logout(token) {
  if (!token) return { success: true };
  const sheet = getSheet('Sessions');
  const values = sheet.getDataRange().getValues();
  const newValues = values.filter((row, i) => i === 0 || row[0] !== token);
  if (newValues.length < values.length) {
    sheet.getDataRange().clearContent();
    sheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);
  }
  return { success: true };
}

// Đổi mật khẩu của chính tài khoản đang đăng nhập.
function changePassword(session, data) {
  const currentPassword = data && data.currentPassword;
  const newPassword = data && data.newPassword;
  if (!newPassword || String(newPassword).length < 4) throw new Error('Mật khẩu mới phải có ít nhất 4 ký tự');

  const usersSheet = getSheet('Users');
  const values = usersSheet.getDataRange().getValues();
  const headers = values[0];
  const idxId = headers.indexOf('id');
  const idxHash = headers.indexOf('passwordHash');
  const idxSalt = headers.indexOf('salt');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idxId] === session.userId) {
      if (currentPassword && hashPassword_(currentPassword, values[i][idxSalt]) !== values[i][idxHash]) {
        throw new Error('Mật khẩu hiện tại không đúng');
      }
      const newSalt = generateUUID();
      usersSheet.getRange(i + 1, idxSalt + 1).setValue(newSalt);
      usersSheet.getRange(i + 1, idxHash + 1).setValue(hashPassword_(newPassword, newSalt));
      return { success: true };
    }
  }

  throw new Error('Không tìm thấy tài khoản');
}

function getUsers() {
  return sheetToObjects('Users').map(u => ({
    id: u.id, username: u.username, role: u.role, displayName: u.displayName, createdAt: u.createdAt
  }));
}

// Admin tạo thêm tài khoản mới (VD: 1 tài khoản riêng cho mỗi chi/nhánh quản lý).
function addUser(data) {
  ensureUsersSeed_();
  const username = ((data && data.username) || '').trim();
  const password = (data && data.password) || '';
  if (!username || !password) throw new Error('Thiếu tài khoản hoặc mật khẩu');
  if (password.length < 4) throw new Error('Mật khẩu phải có ít nhất 4 ký tự');

  const usersSheet = getSheet('Users');
  const values = usersSheet.getDataRange().getValues();
  const idxUsername = values[0].indexOf('username');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxUsername]).toLowerCase() === username.toLowerCase()) {
      throw new Error('Tài khoản này đã tồn tại');
    }
  }

  const salt = generateUUID();
  const newUser = {
    id: generateUUID(),
    username: username,
    passwordHash: hashPassword_(password, salt),
    salt: salt,
    // Hiện tại mọi tài khoản đều có quyền ADMIN (toàn quyền chỉnh sửa) — hệ thống chưa
    // phân biệt cấp quyền chi tiết hơn (VD: chỉ được sửa 1 nhánh riêng).
    role: 'ADMIN',
    displayName: data.displayName || username,
    createdAt: new Date()
  };

  usersSheet.appendRow([newUser.id, newUser.username, newUser.passwordHash, newUser.salt, newUser.role, newUser.displayName, newUser.createdAt]);
  return { id: newUser.id, username: newUser.username, role: newUser.role, displayName: newUser.displayName };
}

function deleteUser(data, session) {
  const targetId = data && data.id;
  if (!targetId) throw new Error('Thiếu ID tài khoản');
  if (targetId === session.userId) throw new Error('Không thể tự xóa tài khoản đang đăng nhập');

  const sheet = getSheet('Users');
  const values = sheet.getDataRange().getValues();
  if (values.length <= 2) throw new Error('Không thể xóa: hệ thống cần giữ lại ít nhất 1 tài khoản quản trị');

  const newValues = values.filter((row, i) => i === 0 || row[0] !== targetId);
  if (newValues.length === values.length) throw new Error('Không tìm thấy tài khoản');

  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);
  return { success: true, id: targetId };
}

// ==========================================
// ĐỀ XUẤT CHỈNH SỬA TỪ KHÁCH (chờ Admin duyệt)
// ==========================================
// Người xem thường (không có tài khoản Admin) có thể gửi đề xuất chỉnh sửa 1 hồ sơ —
// KHÔNG áp dụng ngay, chỉ lưu vào Sheet "PendingEdits" chờ Admin vào duyệt trong app
// (hoặc mở thẳng Sheet để xem thủ công).

function submitEditRequest(data) {
  if (!data || !data.memberId) throw new Error('Thiếu thông tin thành viên cần đề xuất sửa');
  const members = sheetToObjects('Members');
  const member = members.find(m => m.id === data.memberId);
  if (!member) throw new Error('Không tìm thấy thành viên');
  if (!data.changes || Object.keys(data.changes).length === 0) throw new Error('Chưa có nội dung đề xuất chỉnh sửa');

  const sheet = getSheet('PendingEdits');
  sheet.appendRow([
    generateUUID(),
    data.memberId,
    member.name,
    JSON.stringify(data.changes),
    data.submitterName || 'Ẩn danh',
    data.submitterContact || '',
    'PENDING',
    new Date(),
    ''
  ]);

  return { success: true };
}

function getPendingEdits() {
  return sheetToObjects('PendingEdits')
    .filter(r => r.status === 'PENDING')
    .map(r => {
      let changes = {};
      try { changes = JSON.parse(r.proposedChanges); } catch (e) { /* ignore */ }
      return {
        id: r.id, memberId: r.memberId, memberName: r.memberName, changes: changes,
        submitterName: r.submitterName, submitterContact: r.submitterContact, createdAt: r.createdAt
      };
    });
}

function approvePendingEdit(data) {
  const id = data && data.id;
  if (!id) throw new Error('Thiếu ID đề xuất');

  const sheet = getSheet('PendingEdits');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idxId = headers.indexOf('id');
  const idxMemberId = headers.indexOf('memberId');
  const idxChanges = headers.indexOf('proposedChanges');
  const idxStatus = headers.indexOf('status');
  const idxReviewedAt = headers.indexOf('reviewedAt');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idxId] === id) {
      let changes = {};
      try { changes = JSON.parse(values[i][idxChanges]); } catch (e) { /* ignore */ }
      changes.id = values[i][idxMemberId];
      updateMember(changes); // áp dụng thay đổi thật vào Members

      sheet.getRange(i + 1, idxStatus + 1).setValue('APPROVED');
      sheet.getRange(i + 1, idxReviewedAt + 1).setValue(new Date());
      return { success: true };
    }
  }

  throw new Error('Không tìm thấy đề xuất');
}

function rejectPendingEdit(data) {
  const id = data && data.id;
  if (!id) throw new Error('Thiếu ID đề xuất');

  const sheet = getSheet('PendingEdits');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idxId = headers.indexOf('id');
  const idxStatus = headers.indexOf('status');
  const idxReviewedAt = headers.indexOf('reviewedAt');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idxId] === id) {
      sheet.getRange(i + 1, idxStatus + 1).setValue('REJECTED');
      sheet.getRange(i + 1, idxReviewedAt + 1).setValue(new Date());
      return { success: true };
    }
  }

  throw new Error('Không tìm thấy đề xuất');
}

// ==========================================
// ẢNH ĐẠI DIỆN (Lưu trên Google Drive, cùng tài khoản với Sheet)
// ==========================================

const AVATAR_FOLDER_NAME = 'GiaPha_Avatars';

// Lấy (hoặc tạo mới nếu chưa có) thư mục Drive dùng riêng để chứa ảnh đại diện
function getAvatarFolder_() {
  const folders = DriveApp.getFoldersByName(AVATAR_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(AVATAR_FOLDER_NAME);
}

// data: { base64, mimeType } (đã được resize/nén phía trình duyệt trước khi gửi lên)
function uploadAvatar(data) {
  if (!data || !data.base64) throw new Error('Thiếu dữ liệu ảnh');

  const mimeType = data.mimeType || 'image/jpeg';
  const ext = mimeType === 'image/webp' ? 'webp' : (mimeType === 'image/png' ? 'png' : 'jpg');
  const bytes = Utilities.base64Decode(data.base64);
  const blob = Utilities.newBlob(bytes, mimeType, 'avatar_' + Date.now() + '.' + ext);

  const folder = getAvatarFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w500';
  return { url: url };
}

// ==========================================
// SAO LƯU TỰ ĐỘNG (Google Drive)
// ==========================================
// Vì toàn bộ dữ liệu chỉ nằm trong 1 Google Sheet, thao tác nhầm hoặc mất file gốc là rủi
// ro lớn nhất. Hàm này tự tạo 1 bản sao (copy) của cả Spreadsheet vào thư mục riêng, chạy
// định kỳ qua trigger, tự dọn bớt bản cũ để không phình dung lượng Drive.

const BACKUP_FOLDER_NAME = 'GiaPha_Backups';
const BACKUP_KEEP_COUNT = 8; // Giữ lại tối đa 8 bản backup gần nhất

function getBackupFolder_() {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

function backupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(ss.getId());
  const folder = getBackupFolder_();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  file.makeCopy('Backup_GiaPha_' + timestamp, folder);

  // Dọn bớt bản cũ, chỉ giữ lại BACKUP_KEEP_COUNT bản gần nhất
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (let i = BACKUP_KEEP_COUNT; i < files.length; i++) {
    files[i].setTrashed(true);
  }

  Logger.log('Đã sao lưu Spreadsheet vào thư mục Drive "' + BACKUP_FOLDER_NAME + '".');
}

// Chạy hàm này 1 LẦN từ Apps Script editor để tự động sao lưu mỗi tuần (3h sáng Thứ Hai).
function createWeeklyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupSpreadsheet') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('backupSpreadsheet')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(3)
    .create();

  Logger.log('Đã tạo trigger tự động sao lưu Spreadsheet vào ~3h sáng Thứ Hai hàng tuần.');
}

// ==========================================
// NHẮC LỊCH GIỖ / SINH NHẬT QUA EMAIL & TELEGRAM
// ==========================================
// Cách kích hoạt: mở file này trong Apps Script editor, chọn hàm
// "createDailyReminderTrigger" ở dropdown trên thanh công cụ rồi bấm Run
// (chỉ cần chạy 1 LẦN). Từ đó hệ thống sẽ tự kiểm tra & gửi nhắc mỗi ngày
// lúc ~7h sáng, không cần ai mở web app. Người nhận email là tất cả thành viên
// có điền "email" trong hồ sơ; người nhận Telegram là thành viên có điền
// "Telegram Chat ID" (chỉ hoạt động nếu điền TELEGRAM_BOT_TOKEN bên dưới).

const REMINDER_DAYS_AHEAD = 3; // Gửi nhắc trước bao nhiêu ngày

// Điền Token Bot Telegram vào đây nếu muốn nhận nhắc lịch qua Telegram thay vì/thêm email
// (tạo bot miễn phí qua @BotFather trên Telegram để lấy Token). Để trống "" = bỏ qua.
const TELEGRAM_BOT_TOKEN = "";

// Cấu hình nên đặt trong Apps Script > Cài đặt dự án (⚙️) > Thuộc tính tập lệnh (Script Properties)
// thay vì viết thẳng vào code — để đưa code lên GitHub không bị lộ Token:
//   TELEGRAM_BOT_TOKEN      = Token bot lấy từ @BotFather
//   TELEGRAM_GROUP_CHAT_ID  = Chat ID nhóm Telegram chung của dòng họ (số âm, VD: -1001234567890)
// Hằng số TELEGRAM_BOT_TOKEN ở trên vẫn dùng được (dự phòng) nếu không đặt Script Properties.
function getConfig_(key, fallback) {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (value) return String(value).trim();
  } catch (err) {
    Logger.log('Đọc Script Properties lỗi: ' + err);
  }
  return fallback || '';
}

function getTelegramToken_() {
  return getConfig_('TELEGRAM_BOT_TOKEN', TELEGRAM_BOT_TOKEN);
}

function getFamilyGroupChatId_() {
  return getConfig_('TELEGRAM_GROUP_CHAT_ID', '');
}

// Trả về true nếu Telegram nhận tin thành công
function sendTelegramMessage_(chatId, text) {
  const token = getTelegramToken_();
  if (!token || !chatId) return false;
  try {
    const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: String(chatId).trim(), text: text }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Telegram từ chối tin gửi tới ' + chatId + ': ' + res.getContentText());
      return false;
    }
    return true;
  } catch (err) {
    Logger.log('Gửi Telegram thất bại tới ' + chatId + ': ' + err);
    return false;
  }
}

// ==========================================
// CHUYỂN ĐỔI ÂM LỊCH <-> DƯƠNG LỊCH
// ==========================================
// Thuật toán thiên văn của Hồ Ngọc Đức, dùng phổ biến trong các phần mềm lịch Việt Nam.
// Múi giờ mặc định UTC+7. (Bản sao của src/utils/lunarCalendar.ts để chạy độc lập trên GAS.)

function jdFromDate_(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

function jdToDate_(jd) {
  let a, b, c;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

function newMoon_(k) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function sunLongitude_(jdn) {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return L;
}

function getSunLongitude_(dayNumber, timeZone) {
  return Math.floor(sunLongitude_(dayNumber - 0.5 - timeZone / 24) / Math.PI * 6);
}

function getNewMoonDay_(k, timeZone) {
  return Math.floor(newMoon_(k) + 0.5 + timeZone / 24);
}

function getLunarMonth11_(yy, timeZone) {
  const off = jdFromDate_(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay_(k, timeZone);
  const sl = getSunLongitude_(nm, timeZone);
  if (sl >= 9) {
    nm = getNewMoonDay_(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset_(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude_(getNewMoonDay_(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude_(getNewMoonDay_(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

// Trả về [ngày âm, tháng âm, năm âm, có phải tháng nhuận không (0/1)]
function convertSolar2Lunar_(dd, mm, yy, timeZone) {
  timeZone = timeZone || 7;
  const dayNumber = jdFromDate_(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay_(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay_(k, timeZone);
  }
  let a11 = getLunarMonth11_(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11_(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11_(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset_(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

// Trả về [ngày dương, tháng dương, năm dương]
function convertLunar2Solar_(lunarDay, lunarMonth, lunarYear, lunarLeap, timeZone) {
  timeZone = timeZone || 7;
  lunarLeap = lunarLeap || 0;
  let a11, b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11_(lunarYear - 1, timeZone);
    b11 = getLunarMonth11_(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11_(lunarYear, timeZone);
    b11 = getLunarMonth11_(lunarYear + 1, timeZone);
  }
  let off = lunarMonth - 11;
  if (off < 0) off += 12;

  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset_(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) {
      return [0, 0, 0];
    } else if (lunarLeap !== 0 || off >= leapOff) {
      off += 1;
    }
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  const monthStart = getNewMoonDay_(k + off, timeZone);
  return jdToDate_(monthStart + lunarDay - 1);
}

// Quy đổi ngày Âm lịch (lặp lại hàng năm) sang ngày Dương lịch tương ứng trong 1 năm dương lịch cho trước.
function lunarToSolarInYear_(lunarDay, lunarMonth, forSolarYear) {
  const candidates = [forSolarYear, forSolarYear - 1, forSolarYear + 1];
  for (let i = 0; i < candidates.length; i++) {
    const r = convertLunar2Solar_(lunarDay, lunarMonth, candidates[i], 0);
    if (r[2] === forSolarYear) {
      return { day: r[0], month: r[1], year: r[2] };
    }
  }
  const fallback = convertLunar2Solar_(lunarDay, lunarMonth, forSolarYear, 0);
  return { day: fallback[0], month: fallback[1], year: fallback[2] };
}

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

// Ghi chú "(Âm lịch)" trong chuỗi ngày sinh/ngày mất đánh dấu đây là ngày Âm lịch
function isLunarDateString(dateString) {
  return /\(\s*Âm\s*lịch\s*\)/i.test(String(dateString || ''));
}

// Số ngày còn lại đến lần xuất hiện tiếp theo của ngày/tháng đó (0 = hôm nay).
// isLunar=true nghĩa là day/month là ngày Âm lịch, ngày Dương lịch tương ứng đổi mỗi năm.
function daysUntilNextOccurrence(day, month, today, isLunar) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (isLunar) {
    let solar = lunarToSolarInYear_(day, month, t0.getFullYear());
    let target = new Date(solar.year, solar.month - 1, solar.day);
    if (target < t0) {
      solar = lunarToSolarInYear_(day, month, t0.getFullYear() + 1);
      target = new Date(solar.year, solar.month - 1, solar.day);
    }
    return Math.round((target - t0) / (1000 * 60 * 60 * 24));
  }

  let target = new Date(t0.getFullYear(), month - 1, day);
  if (target < t0) {
    target = new Date(t0.getFullYear() + 1, month - 1, day);
  }
  return Math.round((target - t0) / (1000 * 60 * 60 * 24));
}

function buildReminderEmailBody(upcomingEvents) {
  const rows = upcomingEvents.map(function (ev) {
    const when = ev.daysUntil === 0 ? 'Hôm nay' : (ev.daysUntil === 1 ? 'Ngày mai' : 'Còn ' + ev.daysUntil + ' ngày');
    const calendarLabel = ev.isLunar ? ' (ÂL)' : '';
    return '<li><b>' + ev.title + '</b> (' + ev.day + '/' + ev.month + calendarLabel + ') — ' + when + '</li>';
  }).join('');

  return '<div style="font-family: Georgia, serif; color: #4a3728;">' +
    '<h2 style="color: #7b241c;">🌳 Nhắc lịch Gia Phả</h2>' +
    '<p>Các sự kiện sắp diễn ra trong ' + REMINDER_DAYS_AHEAD + ' ngày tới:</p>' +
    '<ul>' + rows + '</ul>' +
    '</div>';
}

function buildReminderPlainText_(upcomingEvents) {
  const lines = upcomingEvents.map(function (ev) {
    const when = ev.daysUntil === 0 ? 'Hôm nay' : (ev.daysUntil === 1 ? 'Ngày mai' : 'Còn ' + ev.daysUntil + ' ngày');
    const calendarLabel = ev.isLunar ? ' (ÂL)' : '';
    return '• ' + ev.title + ' (' + ev.day + '/' + ev.month + calendarLabel + ') — ' + when;
  });
  return '🌳 Nhắc lịch Gia Phả\nCác sự kiện sắp diễn ra trong ' + REMINDER_DAYS_AHEAD + ' ngày tới:\n' + lines.join('\n');
}

function checkAndSendReminders() {
  const members = getMembers();

  const emailRecipients = members
    .map(function (m) { return m.email; })
    .filter(function (email) { return email && String(email).indexOf('@') > -1; });

  const telegramRecipients = members
    .map(function (m) { return m.telegramChatId; })
    .filter(function (chatId) { return chatId; });

  const familyGroupChatId = getFamilyGroupChatId_();

  if (emailRecipients.length === 0 && telegramRecipients.length === 0 && !familyGroupChatId) {
    Logger.log('Không có email/Telegram nào được cấu hình, bỏ qua gửi nhắc nhở.');
    return;
  }

  const events = getEvents();
  const today = new Date();
  const upcoming = [];

  members.forEach(function (member) {
    if (!member.isDeceased && member.birthDate) {
      const dm = parseDayMonth(member.birthDate);
      if (dm) {
        const isLunar = isLunarDateString(member.birthDate);
        const daysUntil = daysUntilNextOccurrence(dm.day, dm.month, today, isLunar);
        if (daysUntil >= 0 && daysUntil <= REMINDER_DAYS_AHEAD) {
          upcoming.push({ title: 'Sinh nhật - ' + member.name, day: dm.day, month: dm.month, isLunar: isLunar, daysUntil: daysUntil });
        }
      }
    }
    if (member.isDeceased && member.deathDate) {
      const dm = parseDayMonth(member.deathDate);
      if (dm) {
        const isLunar = isLunarDateString(member.deathDate);
        const daysUntil = daysUntilNextOccurrence(dm.day, dm.month, today, isLunar);
        if (daysUntil >= 0 && daysUntil <= REMINDER_DAYS_AHEAD) {
          upcoming.push({ title: 'Ngày giỗ - ' + member.name, day: dm.day, month: dm.month, isLunar: isLunar, daysUntil: daysUntil });
        }
      }
    }
  });

  events.forEach(function (ev) {
    if (!ev.day || !ev.month) return;
    const daysUntil = daysUntilNextOccurrence(ev.day, ev.month, today, ev.isLunar);
    if (daysUntil >= 0 && daysUntil <= REMINDER_DAYS_AHEAD) {
      const linkedMember = ev.memberId ? members.find(function (m) { return m.id === ev.memberId; }) : null;
      const title = linkedMember ? ev.title + ' - ' + linkedMember.name : ev.title;
      upcoming.push({ title: title, day: ev.day, month: ev.month, isLunar: ev.isLunar, daysUntil: daysUntil });
    }
  });

  if (upcoming.length === 0) {
    Logger.log('Không có sự kiện nào sắp tới trong ' + REMINDER_DAYS_AHEAD + ' ngày.');
    return;
  }

  upcoming.sort(function (a, b) { return a.daysUntil - b.daysUntil; });

  if (emailRecipients.length > 0) {
    const subject = '[Gia Phả] Nhắc lịch: ' + upcoming.length + ' sự kiện sắp tới';
    const body = buildReminderEmailBody(upcoming);
    emailRecipients.forEach(function (email) {
      try {
        MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
      } catch (err) {
        Logger.log('Gửi email thất bại tới ' + email + ': ' + err);
      }
    });
  }

  if ((telegramRecipients.length > 0 || familyGroupChatId) && getTelegramToken_()) {
    const textBody = buildReminderPlainText_(upcoming);
    telegramRecipients.forEach(function (chatId) {
      sendTelegramMessage_(chatId, textBody);
    });
    // Gửi thêm 1 bản tổng hợp vào nhóm Telegram chung của dòng họ
    if (familyGroupChatId) sendTelegramMessage_(familyGroupChatId, textBody);
  }
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


// ==========================================
// GỬI THÔNG BÁO: cả dòng họ hoặc theo nhánh, gửi ngay hoặc hẹn giờ
// ==========================================
// - Cả dòng họ ('ALL'): gửi vào nhóm Telegram chung (TELEGRAM_GROUP_CHAT_ID). Tùy chọn
//   alsoIndividuals = gửi thêm riêng cho từng thành viên có Telegram Chat ID / email.
// - Theo nhánh ('BRANCH'): người đứng đầu nhánh + toàn bộ con cháu + vợ/chồng của họ, gửi
//   riêng cho từng người, cộng nhóm Telegram của nhánh (cột branchChatId của người đứng đầu).
// - Hẹn giờ: lưu vào Sheet "ScheduledNotifications"; trigger processScheduledNotifications
//   (tạo bằng createNotificationTrigger, chạy mỗi 15 phút) gửi các tin đã đến giờ.

// Người đứng đầu nhánh + mọi hậu duệ (theo cha hoặc mẹ) + vợ/chồng của những người đó
function getBranchMembers_(members, rootId) {
  const byId = {};
  members.forEach(function (m) { byId[m.id] = m; });
  if (!byId[rootId]) throw new Error('Không tìm thấy người đứng đầu nhánh');

  const bloodIds = {};
  const queue = [rootId];
  bloodIds[rootId] = true;
  while (queue.length > 0) {
    const id = queue.shift();
    members.forEach(function (m) {
      if ((m.fatherId === id || m.motherId === id) && !bloodIds[m.id]) {
        bloodIds[m.id] = true;
        queue.push(m.id);
      }
    });
  }

  const result = {};
  Object.keys(bloodIds).forEach(function (id) {
    result[id] = byId[id];
    (byId[id].spouses || []).forEach(function (s) {
      if (byId[s.id]) result[s.id] = byId[s.id];
    });
  });
  return Object.keys(result).map(function (id) { return result[id]; });
}

function isValidEmail_(email) {
  return email && String(email).indexOf('@') > -1;
}

// Xác định nơi nhận: danh sách nhóm Telegram + danh sách từng người + người chưa có liên lạc
function resolveRecipients_(data) {
  const members = getMembers();
  const channels = data.channels || { telegram: true, email: false };
  const groups = [];
  let people = [];
  let label = 'Cả dòng họ';

  if (data.target === 'BRANCH') {
    const root = members.find(function (m) { return m.id === data.branchMemberId; });
    if (!root) throw new Error('Chưa chọn nhánh hoặc không tìm thấy người đứng đầu nhánh');
    label = 'Nhánh ' + root.name;
    people = getBranchMembers_(members, root.id);
    if (root.branchChatId) groups.push({ label: 'Nhóm Telegram nhánh ' + root.name, chatId: String(root.branchChatId) });
  } else {
    const familyGroup = getFamilyGroupChatId_();
    if (familyGroup) groups.push({ label: 'Nhóm Telegram dòng họ', chatId: familyGroup });
    if (data.alsoIndividuals) people = members;
  }

  const reachable = [];
  const missing = [];
  people.forEach(function (m) {
    const hasTelegram = channels.telegram && m.telegramChatId;
    const hasEmail = channels.email && isValidEmail_(m.email);
    if (hasTelegram || hasEmail) {
      reachable.push({ name: m.name, telegramChatId: hasTelegram ? String(m.telegramChatId) : '', email: hasEmail ? String(m.email) : '' });
    } else if (!m.isDeceased) {
      missing.push(m.name);
    }
  });

  return {
    label: label,
    groups: channels.telegram ? groups : [],
    reachable: reachable,
    missing: missing,
    telegramConfigured: Boolean(getTelegramToken_())
  };
}

// Xem trước người nhận (không trả Chat ID/email ra ngoài, chỉ tên)
function previewNotificationRecipients(data) {
  const r = resolveRecipients_(data);
  return {
    label: r.label,
    groups: r.groups.map(function (g) { return g.label; }),
    reachable: r.reachable.map(function (p) { return p.name; }),
    missing: r.missing,
    telegramConfigured: r.telegramConfigured,
    familyGroupConfigured: Boolean(getFamilyGroupChatId_())
  };
}

function deliverNotification_(data, senderName) {
  if (!data.message || !String(data.message).trim()) throw new Error('Nội dung thông báo đang trống');
  const r = resolveRecipients_(data);
  const header = '📢 THÔNG BÁO DÒNG HỌ' + (data.target === 'BRANCH' ? ' — ' + r.label : '');
  const text = header + '\n\n' + String(data.message).trim() + (senderName ? '\n\n— ' + senderName : '');

  const summary = { label: r.label, groupsSent: [], groupsFailed: [], telegramSent: 0, emailSent: 0, failed: [], missing: r.missing };

  if (r.groups.length > 0 && !r.telegramConfigured) throw new Error('Chưa cấu hình TELEGRAM_BOT_TOKEN');
  r.groups.forEach(function (g) {
    if (sendTelegramMessage_(g.chatId, text)) summary.groupsSent.push(g.label);
    else summary.groupsFailed.push(g.label);
  });

  r.reachable.forEach(function (p) {
    let ok = false;
    if (p.telegramChatId && sendTelegramMessage_(p.telegramChatId, text)) { summary.telegramSent++; ok = true; }
    if (p.email) {
      try {
        MailApp.sendEmail({ to: p.email, subject: '[Gia Phả] ' + header.replace('📢 ', ''), body: text });
        summary.emailSent++;
        ok = true;
      } catch (err) {
        Logger.log('Gửi email thất bại tới ' + p.email + ': ' + err);
      }
    }
    if (!ok) summary.failed.push(p.name);
  });

  if (summary.groupsSent.length === 0 && summary.telegramSent === 0 && summary.emailSent === 0) {
    throw new Error('Không gửi được tới ai. Kiểm tra lại cấu hình Telegram (Token, Chat ID nhóm) hoặc liên lạc của thành viên.');
  }
  return summary;
}

function sendNotification(data, session) {
  const senderName = session ? session.username : '';
  const sendAt = data.sendAt ? new Date(data.sendAt) : null;

  // Hẹn giờ: chỉ lưu lại, trigger sẽ gửi khi đến giờ
  if (sendAt && !isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now() + 60 * 1000) {
    resolveRecipients_(data); // kiểm tra hợp lệ ngay (VD: nhánh không tồn tại)
    const sheet = getSheet('ScheduledNotifications');
    const id = generateUUID();
    sheet.appendRow([
      id, sendAt, data.target === 'BRANCH' ? 'BRANCH' : 'ALL', data.branchMemberId || '',
      Boolean(data.alsoIndividuals), JSON.stringify(data.channels || { telegram: true }), String(data.message || ''),
      'PENDING', senderName, new Date(), '', ''
    ]);
    return { scheduled: true, id: id, sendAt: sendAt.toISOString() };
  }

  return Object.assign({ scheduled: false }, deliverNotification_(data, senderName));
}

function scheduledRowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  const toIso = function (v) { return v ? new Date(v).toISOString() : ''; };
  return {
    id: obj.id,
    sendAt: toIso(obj.sendAt),
    target: obj.target,
    branchMemberId: obj.branchMemberId,
    alsoIndividuals: isTruthy_(obj.alsoIndividuals),
    channels: (function () { try { return JSON.parse(obj.channels); } catch (e) { return { telegram: true }; } })(),
    message: obj.message,
    status: obj.status,
    createdBy: obj.createdBy,
    createdAt: toIso(obj.createdAt),
    sentAt: toIso(obj.sentAt),
    result: obj.result
  };
}

function getScheduledNotifications() {
  const sheet = getSheet('ScheduledNotifications');
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1)
    .map(function (row) { return scheduledRowToObject_(headers, row); })
    .sort(function (a, b) { return b.sendAt.localeCompare(a.sendAt); })
    .slice(0, 100);
}

function cancelScheduledNotification(data) {
  const sheet = getSheet('ScheduledNotifications');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('status');
  for (let i = 1; i < values.length; i++) {
    if (values[i][idIdx] === data.id) {
      if (values[i][statusIdx] !== 'PENDING') throw new Error('Thông báo này đã được gửi hoặc đã hủy');
      sheet.getRange(i + 1, statusIdx + 1).setValue('CANCELLED');
      return { id: data.id, status: 'CANCELLED' };
    }
  }
  throw new Error('Không tìm thấy thông báo đã hẹn');
}

// Trigger chạy mỗi 15 phút: gửi các thông báo hẹn giờ đã đến giờ
function processScheduledNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // lần chạy trước chưa xong
  try {
    const sheet = getSheet('ScheduledNotifications');
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return;
    const headers = values[0];
    const col = function (name) { return headers.indexOf(name); };
    const now = Date.now();

    for (let i = 1; i < values.length; i++) {
      const n = scheduledRowToObject_(headers, values[i]);
      if (n.status !== 'PENDING' || !n.sendAt || new Date(n.sendAt).getTime() > now) continue;

      let status = 'SENT';
      let result = '';
      try {
        const summary = deliverNotification_(n, n.createdBy);
        result = JSON.stringify(summary);
      } catch (err) {
        status = 'FAILED';
        result = String(err);
      }
      sheet.getRange(i + 1, col('status') + 1).setValue(status);
      sheet.getRange(i + 1, col('sentAt') + 1).setValue(new Date());
      sheet.getRange(i + 1, col('result') + 1).setValue(result.slice(0, 1000));
    }
  } finally {
    lock.releaseLock();
  }
}

// Chạy 1 LẦN từ Apps Script editor để bật gửi thông báo hẹn giờ (kiểm tra mỗi 15 phút)
function createNotificationTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processScheduledNotifications') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processScheduledNotifications').timeBased().everyMinutes(15).create();
  Logger.log('Đã bật trigger gửi thông báo hẹn giờ (mỗi 15 phút).');
}

// Chạy từ Apps Script editor để TÌM CHAT ID: liệt kê các nhóm/người vừa nhắn cho bot.
// Cách dùng: thêm bot vào nhóm, nhắn 1 tin bất kỳ trong nhóm (VD: "/start"), rồi chạy hàm này
// và xem mục "Nhật ký thực thi" (Execution log).
function listTelegramChats() {
  const token = getTelegramToken_();
  if (!token) { Logger.log('Chưa cấu hình TELEGRAM_BOT_TOKEN trong Script Properties.'); return; }
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
  const body = JSON.parse(res.getContentText());
  if (!body.ok) { Logger.log('Telegram báo lỗi: ' + res.getContentText()); return; }
  const seen = {};
  (body.result || []).forEach(function (u) {
    const msg = u.message || u.my_chat_member || u.channel_post || u.edited_message;
    const chat = msg && msg.chat;
    if (!chat || seen[chat.id]) return;
    seen[chat.id] = true;
    const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '';
    Logger.log((chat.type === 'private' ? 'Người' : 'Nhóm') + ': ' + name + '  →  Chat ID: ' + chat.id);
  });
  if (Object.keys(seen).length === 0) {
    Logger.log('Chưa thấy tin nhắn nào. Hãy nhắn 1 tin cho bot (hoặc trong nhóm có bot) rồi chạy lại.');
  }
}

// Chạy từ Apps Script editor để thử gửi 1 tin vào nhóm dòng họ
function testTelegramGroup() {
  const groupId = getFamilyGroupChatId_();
  if (!groupId) { Logger.log('Chưa cấu hình TELEGRAM_GROUP_CHAT_ID trong Script Properties.'); return; }
  const ok = sendTelegramMessage_(groupId, '✅ Kết nối thành công! Nhóm này sẽ nhận thông báo từ Gia Phả.');
  Logger.log(ok ? 'Đã gửi tin thử vào nhóm.' : 'Gửi thất bại — xem lỗi ở dòng log phía trên.');
}
