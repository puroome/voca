/**
 * @OnlyCurrentDoc
 */
const ADMIN_SHEET_ID = "1MLVexVqtryQheeneLxOmCgn6_HZ-DSRgWy0SRVP9d2E"; 

const VOCAB_SHEET_ID = "1F4rQSsNMpP0ODUHvOz9WRUGgwsqwPNifu42va2zCPFs"; 
const FIREBASE_SECRET = "yflesjEHGDcA4B7xClzOBjqOPFs2eY1tsFTU3RCe"; 
const FIREBASE_RTDB_URL = "https://wordapp-91c0a-default-rtdb.asia-southeast1.firebasedatabase.app/";

const GRADE_SHEETS = ['1y', '2y', '3y'];

/**
 * 스프레드시트가 열릴 때 사용자 정의 메뉴를 만듭니다.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('🔥 어휘 동기화')
      .addItem('🐤 현재 학년만 동기화', 'syncActiveSheetToFirebase')
      .addItem('🪰🐞🪲 모든 학년 동기화', 'syncAllVocabularyToFirebase')
      .addSeparator()
      .addItem('🧹 겹치는 어휘 정리 (앞 행 삭제)', 'removeEarlierDuplicateWords')
      .addToUi();
}

/**
 * 현재 활성화된 시트(예: '1y')의 데이터만 Firebase RTDB에 동기화합니다.
 */
function syncActiveSheetToFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const grade = activeSheet.getName();

  if (!GRADE_SHEETS.includes(grade)) {
    SpreadsheetApp.getUi().alert(`오류: 시트 이름 '${grade}'은(는) 동기화할 수 있는 학년 이름(1y, 2y, 3y)이 아닙니다.`);
    return;
  }
  
  const result = syncSheetWithDuplicateCleanup(activeSheet, grade);
  const notes = result.notes ? `\n\n${result.notes}` : '';
  
  if (result.success) {
    SpreadsheetApp.getUi().alert(`✅ '${grade}' 시트 동기화 완료!${notes}`);
  } else {
    SpreadsheetApp.getUi().alert(`🛑 '${grade}' 시트 동기화 실패: ${result.message}${notes}`);
  }
}

/**
 * 모든 학년 시트의 데이터를 Firebase RTDB에 동기화합니다. (전체 동기화)
 */
function syncAllVocabularyToFirebase() {
    const vocabSS = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    let successCount = 0;
    let failMessages = [];
    const cleanupNotes = [];

    GRADE_SHEETS.forEach(grade => {
        const sheet = vocabSS.getSheetByName(grade);
        if (sheet) {
            const result = syncSheetWithDuplicateCleanup(sheet, grade);
            if (result.notes) cleanupNotes.push(`[${grade}] ${result.notes}`);
            if (result.success) {
                successCount++;
            } else {
                failMessages.push(`[${grade}] ${result.message}`);
            }
        }
    });

    const notesText = cleanupNotes.length > 0 ? `\n\n${cleanupNotes.join('\n')}` : '';
    if (failMessages.length > 0) {
        SpreadsheetApp.getUi().alert(`⚠️ 전체 동기화 중 일부 실패 (${successCount}/${GRADE_SHEETS.length} 성공):\n${failMessages.join('\n')}${notesText}`);
    } else {
        SpreadsheetApp.getUi().alert(`✅ 전체 학년 동기화 완료!${notesText}`);
    }
}


/**
 * 특정 시트와 학년 정보를 받아 동기화 프로세스를 실행합니다.
 */
function processSyncForSheet(sheet, grade) {
  try {
      
      const dataRange = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()); 
      const data = dataRange.getValues();
      const headers = data[0].map(h => h.toString().trim().toUpperCase());

      const idIndex = headers.indexOf('INDEX'); 
      const wordIndex = headers.indexOf('WORD'); 
      const meaningIndex = headers.indexOf('MEANING'); 
      const posIndex = headers.indexOf('POS');
      const explanationIndex = headers.indexOf('EXPLANATION'); 
      const sampleIndex = headers.indexOf('SAMPLE');
      const partIndex = headers.indexOf('PART'); 

      if (idIndex === -1 || wordIndex === -1 || meaningIndex === -1) {
          throw new Error("필수 컬럼 (Index, Word, Meaning) 중 누락된 항목이 있습니다.");
      }
      
      const vocabularyData = {};
      // Part 열: 값이 적힌 행부터 다음 값이 나오기 전 행까지를 같은 Part로 봅니다.
      // partOrder는 그 Part가 시트에 처음 나온 순서(1부터)이며, 앱이 목록을 시트 순서대로 보여 줄 때 씁니다.
      const partOrders = {};
      let currentPart = '';
      // 앱에서 겹치는 단어(대소문자 무시)마다 실제 철자와 행 번호를 모읍니다.
      const rowsByKey = {};
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const partCell = partIndex !== -1 ? String(row[partIndex]).trim() : '';
        if (partCell) {
          currentPart = partCell;
          if (!partOrders[currentPart]) partOrders[currentPart] = Object.keys(partOrders).length + 1;
        }
        const id = row[idIndex] ? row[idIndex].toString().trim() : '';
        const word = row[wordIndex] ? row[wordIndex].toString().trim() : '';
        
        if (id && word) {
          const entry = rowsByKey[word.toLowerCase()] = rowsByKey[word.toLowerCase()] || { words: [], rows: [] };
          entry.rows.push(i + 1);
          if (!entry.words.includes(word)) entry.words.push(word);
          // 🎯 수정된 부분: word를 키로 사용하고, 소문자로 통일
          vocabularyData[word.toLowerCase()] = { 
            id: parseInt(id),
            word: word,
            meaning: row[meaningIndex] ? row[meaningIndex].toString().trim() : '',
            pos: posIndex !== -1 && row[posIndex] ? row[posIndex].toString().trim() : '',
            explanation: explanationIndex !== -1 && row[explanationIndex] ? row[explanationIndex].toString().trim() : '',
            sample: sampleIndex !== -1 && row[sampleIndex] ? row[sampleIndex].toString().trim() : ''
          };
          if (currentPart) {
            vocabularyData[word.toLowerCase()].part = currentPart;
            vocabularyData[word.toLowerCase()].partOrder = partOrders[currentPart];
          }
        }
      }

      // 같은 Word가 두 번 있으면 앱에는 뒤 행만 남고 앞 행은 말없이 사라지므로 동기화를 멈춥니다.
      // 대소문자만 달라도 앱에서는 같은 단어로 겹칩니다.
      const duplicateLines = Object.keys(rowsByKey)
        .filter(key => rowsByKey[key].rows.length > 1)
        .map(key => `- ${rowsByKey[key].words.join(' / ')}: ${rowsByKey[key].rows.join(', ')}행`);
      if (duplicateLines.length > 0) {
        const shown = duplicateLines.slice(0, 20).join('\n')
          + (duplicateLines.length > 20 ? `\n… 외 ${duplicateLines.length - 20}개` : '');
        const error = new Error(`겹치는 Word가 있으면 앱에서 앞 행이 사라지기 때문에 동기화를 멈췄습니다.\n${shown}\n\n'🧹 겹치는 어휘 정리' 메뉴로 앞 행을 지우거나 직접 고친 뒤 다시 동기화해 주세요.`);
        error.duplicates = true;
        throw error;
      }

      const firebasePath = `${grade}/vocabulary.json?auth=${FIREBASE_SECRET}`;
      const url = FIREBASE_RTDB_URL + firebasePath;

      const options = {
        'method' : 'put',
        'contentType': 'application/json',
        'payload' : JSON.stringify(vocabularyData),
        'muteHttpExceptions': true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      Logger.log(`Synced ${grade}: Status ${responseCode}`);
      
      if (responseCode !== 200) {
          throw new Error(`RTDB 쓰기 실패 (Status: ${responseCode})`);
      }

      updateFirebaseVersion(grade);
      return { success: true };

  } catch (error) {
    Logger.log(`Sync Error for ${grade}: ${error.message}`);
    return { success: false, message: error.message, duplicates: error.duplicates === true };
  }
}

/**
 * Word가 겹치는 행을 찾아 지울 계획을 세웁니다. 시트는 바꾸지 않습니다.
 * 행을 지우는 일이라 다음을 지킵니다.
 * - 앞뒤 공백만 빼고 글자가 똑같을 때만 겹친다고 봅니다. 대소문자만 다르면(Polish/polish)
 *   다른 단어일 수 있어 지우지 않고 알려만 줍니다.
 * - 동기화와 똑같이 Index와 Word가 모두 있는 행만 봅니다.
 * - 단어마다 가장 아래 행만 남깁니다. 확인 창에 보여 줄 목록(preview)에는 뜻이 다르면 ⚠를,
 *   Part 표시를 어떻게 처리할지도 함께 적습니다.
 */
function planDuplicateCleanup(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: '정리할 어휘가 없습니다.' };

  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0].map(h => h.toString().trim().toUpperCase());
  const idIndex = headers.indexOf('INDEX');
  const wordIndex = headers.indexOf('WORD');
  const meaningIndex = headers.indexOf('MEANING');
  const partIndex = headers.indexOf('PART');
  if (idIndex === -1 || wordIndex === -1) return { error: '필수 컬럼 (Index, Word)을 찾을 수 없습니다.' };
  const cellText = (row, index) => index !== -1 && row[index] ? row[index].toString().trim() : '';

  const rowsByWord = {};
  const spellingsByKey = {};
  for (let i = 1; i < data.length; i++) {
    const word = cellText(data[i], wordIndex);
    if (!cellText(data[i], idIndex) || !word) continue;
    (rowsByWord[word] = rowsByWord[word] || []).push(i + 1);
    const spellings = spellingsByKey[word.toLowerCase()] = spellingsByKey[word.toLowerCase()] || [];
    if (!spellings.includes(word)) spellings.push(word);
  }
  const caseOnly = Object.keys(spellingsByKey)
    .filter(key => spellingsByKey[key].length > 1)
    .map(key => `- ${spellingsByKey[key].join(' / ')}`);
  const caseOnlyText = caseOnly.length > 0
    ? `\n\n대소문자만 다른 단어는 서로 다른 단어일 수 있어 지우지 않습니다. 직접 확인해 주세요.\n${caseOnly.join('\n')}`
    : '';

  const meaningOf = row => cellText(data[row - 1], meaningIndex).split('\n')[0];
  const deletions = [];
  Object.keys(rowsByWord).forEach(word => {
    const rows = rowsByWord[word];
    if (rows.length < 2) return;
    const keepRow = rows[rows.length - 1];
    rows.slice(0, -1).forEach(row => deletions.push({ row, word, keepRow }));
  });
  // 확인 창에 적을 Part 처리 결과를 실제로 지울 때와 똑같이 아래 행부터 미리 따져 봅니다.
  // 바로 아래 행에 이미 다른 Part가 있으면 옮길 수 없어 그 Part는 사라집니다.
  const partColumn = data.map(row => cellText(row, partIndex));
  const partOutcome = {};
  [...deletions].sort((a, b) => b.row - a.row).forEach(({ row }) => {
    const part = partColumn[row - 1];
    if (part) {
      const canMove = row < partColumn.length && !partColumn[row];
      if (canMove) partColumn[row] = part;
      partOutcome[row] = canMove
        ? ` (Part '${part}' 표시는 아래 행으로 옮김)`
        : ` (Part '${part}'는 남는 단어가 없어 사라짐)`;
    }
    partColumn.splice(row - 1, 1);
  });
  const lines = deletions.map(({ row, word, keepRow }) => {
    const differs = meaningOf(row) !== meaningOf(keepRow);
    return `${differs ? '⚠ ' : ''}${word}: ${row}행 "${meaningOf(row)}" 삭제 → ${keepRow}행 "${meaningOf(keepRow)}" 남김`
      + (partOutcome[row] || '');
  });

  const preview = lines.slice(0, 30).join('\n') + (lines.length > 30 ? `\n… 외 ${lines.length - 30}행` : '');
  return { deletions, preview, caseOnly, caseOnlyText, wordIndex, partIndex };
}

/**
 * 계획대로 앞선 행을 지웁니다. 지우기 직전에 대상 행의 Word가 그대로인지 다시 확인하고,
 * 하나라도 다르면 아무것도 지우지 않습니다. 지우는 행에 Part 값이 있으면 바로 아래 행으로 옮겨
 * Part 구간이 흐트러지지 않게 합니다.
 */
function applyDuplicateCleanup(sheet, plan) {
  const { wordIndex, partIndex } = plan;
  // 아래 행부터 지워야 아직 지우지 않은 위쪽 행의 번호가 밀리지 않습니다.
  const deletions = [...plan.deletions].sort((a, b) => b.row - a.row);
  const changed = deletions.filter(({ row, word }) =>
    sheet.getRange(row, wordIndex + 1).getValue().toString().trim() !== word);
  if (changed.length > 0) {
    return {
      success: false,
      message: `확인하는 사이 시트가 바뀌어 아무것도 지우지 않았습니다. 다시 실행해 주세요. (${changed.map(item => item.row).join(', ')}행)`
    };
  }

  const partNotes = [];
  deletions.forEach(({ row }) => {
    const part = partIndex !== -1 ? sheet.getRange(row, partIndex + 1).getValue().toString().trim() : '';
    if (part) {
      // 아래쪽 대상 행은 이미 지웠으므로 바로 아래 행이 이 Part의 다음 단어입니다.
      const nextPartCell = row + 1 <= sheet.getLastRow() ? sheet.getRange(row + 1, partIndex + 1) : null;
      if (nextPartCell && !nextPartCell.getValue().toString().trim()) {
        nextPartCell.setValue(part);
      } else {
        partNotes.push(`Part '${part}'는 남은 단어가 없어 사라졌습니다.`);
      }
    }
    sheet.deleteRow(row);
  });

  return { success: true, partNotes };
}

/**
 * 메뉴 '🧹 겹치는 어휘 정리': 현재 학년 시트에서 겹치는 Word의 앞선 행을 확인받고 지웁니다.
 */
function removeEarlierDuplicateWords() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const grade = sheet.getName();
  if (!GRADE_SHEETS.includes(grade)) {
    ui.alert(`오류: 시트 이름 '${grade}'은(는) 정리할 수 있는 학년 이름(1y, 2y, 3y)이 아닙니다.`);
    return;
  }
  const plan = planDuplicateCleanup(sheet);
  if (plan.error) {
    ui.alert(plan.error);
    return;
  }
  if (plan.deletions.length === 0) {
    ui.alert(`똑같이 겹치는 Word가 없습니다.${plan.caseOnlyText}`);
    return;
  }

  const answer = ui.alert(
    '겹치는 어휘 정리',
    `'${grade}' 시트에서 아래 ${plan.deletions.length}행을 지웁니다. 단어마다 가장 아래 행만 남깁니다.\n`
      + `⚠는 뜻이 달라 다른 뜻으로 적은 행일 수 있으니 특히 확인해 주세요.\n\n${plan.preview}${plan.caseOnlyText}\n\n지울까요?`,
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const cleanup = applyDuplicateCleanup(sheet, plan);
  if (!cleanup.success) {
    ui.alert(cleanup.message);
    return;
  }
  const nextStep = plan.caseOnly.length > 0
    ? '대소문자만 다른 단어가 남아 있어 그대로는 동기화가 멈춥니다. 직접 고친 뒤 동기화해 주세요.'
    : '이제 동기화할 수 있습니다.';
  ui.alert(`${plan.deletions.length}행을 지웠습니다. ${nextStep}`
    + (cleanup.partNotes.length > 0 ? `\n\n${cleanup.partNotes.join('\n')}` : '')
    + plan.caseOnlyText);
}

/**
 * 동기화하다 겹치는 Word를 만나면 지울 앞 행을 보여 주고, "예"를 누르면 앞 행을 지운 뒤 이어서 동기화합니다.
 * "아니오"를 누르면 시트를 바꾸지 않고 멈추므로 직접 정리한 뒤 다시 동기화하면 됩니다.
 * 대소문자만 달라 지울 행이 없으면 묻지 않고 멈춘 이유만 돌려줍니다.
 */
function syncSheetWithDuplicateCleanup(sheet, grade) {
  const result = processSyncForSheet(sheet, grade);
  if (result.success || !result.duplicates) return result;

  const plan = planDuplicateCleanup(sheet);
  if (plan.error || plan.deletions.length === 0) return result;

  const ui = SpreadsheetApp.getUi();
  const question = plan.caseOnly.length > 0
    ? `아래 ${plan.deletions.length}행을 지울까요? 대소문자만 다른 단어가 남아 있어 지운 뒤에도 동기화는 멈춥니다.`
    : `아래 ${plan.deletions.length}행을 지우고 이어서 동기화할까요?`;
  const answer = ui.alert(
    `'${grade}' 시트에 겹치는 어휘가 있습니다`,
    `겹치는 Word가 있어 동기화를 멈췄습니다. ${question}\n`
      + `단어마다 가장 아래 행만 남깁니다. ⚠는 뜻이 달라 다른 뜻으로 적은 행일 수 있으니 특히 확인해 주세요.\n\n`
      + `${plan.preview}${plan.caseOnlyText}\n\n`
      + `아니오를 누르면 시트를 바꾸지 않고 멈춥니다. 직접 정리한 뒤 다시 동기화해 주세요.`,
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) {
    return { success: false, message: '겹치는 Word를 정리하지 않아 동기화를 멈췄습니다. 직접 정리한 뒤 다시 동기화해 주세요.' };
  }

  const cleanup = applyDuplicateCleanup(sheet, plan);
  if (!cleanup.success) return cleanup;
  const retried = processSyncForSheet(sheet, grade);
  retried.notes = [`겹치는 앞 행 ${plan.deletions.length}개를 지웠습니다.`, ...cleanup.partNotes].join('\n');
  return retried;
}

/**
 * Firebase의 버전 정보를 업데이트합니다.
 * 기존 버전을 읽지 않고 '현재 시간'을 버전으로 사용하여 무조건 업데이트가 일어나도록 수정했습니다.
 */
function updateFirebaseVersion(grade) {
    try {
        const versionRefPath = `app_config/vocab_version_${grade}.json?auth=${FIREBASE_SECRET}`;
        const timestampRefPath = `app_config/vocab_timestamp_${grade}.json?auth=${FIREBASE_SECRET}`;
        
        const versionUrl = FIREBASE_RTDB_URL + versionRefPath;
        const timestampUrl = FIREBASE_RTDB_URL + timestampRefPath;
        
        // [핵심 변경] 
        // 기존 버전을 읽어오는 과정(GET)을 생략하고, 
        // 현재 시간(Date.now())을 버전 번호로 사용합니다.
        // 이렇게 하면 항상 이전 버전보다 큰 숫자가 되어 학생 앱이 업데이트를 감지합니다.
        const newVersion = Date.now(); 
        
        // 1. 버전 업데이트 (PUT)
        UrlFetchApp.fetch(versionUrl, {
            'method': 'put',
            'contentType': 'application/json',
            'payload': JSON.stringify(newVersion),
            'muteHttpExceptions': true
        });

        // 2. 타임스탬프 업데이트 (PUT)
        UrlFetchApp.fetch(timestampUrl, {
            'method': 'put',
            'contentType': 'application/json',
            'payload': JSON.stringify(newVersion),
            'muteHttpExceptions': true
        });
        
        Logger.log(`Updated Firebase Version for ${grade} to ${newVersion} (Timestamp)`);

    } catch(e) {
        Logger.log(`Failed to update Firebase Version for ${grade}: ${e.message}`);
    }
}

function requestPermission(email, name, grade) {
  const ss = SpreadsheetApp.openById(ADMIN_SHEET_ID);
  const sheet = ss.getSheetByName('학생명단');
  if (!sheet) return { success: false, message: "시트를 찾을 수 없습니다." };
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const emailColIndex = header.findIndex(h => h.toString().trim() === 'Email');
  const nameColIndex = header.findIndex(h => h.toString().trim() === 'Name');
  const gradeColIndex = header.findIndex(h => h.toString().trim() === 'Grade');
  const permissionColIndex = header.findIndex(h => h.toString().trim() === 'Permission');
  if (emailColIndex === -1 || nameColIndex === -1 || gradeColIndex === -1) {
       return { success: false, message: "필수 컬럼(Email, Name, Grade) 중 일부를 찾을 수 없습니다."
};
  }
  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][emailColIndex] ?
    data[i][emailColIndex].toString().trim() : '';
    if (rowEmail.toLowerCase() === email.toLowerCase()) {
      return { success: true, message: "이미 요청 목록에 존재합니다. 승인을 기다려주세요."
};
    }
  }
  const newRow = [];
  const columnCount = sheet.getLastColumn();
  const colMap = {};
  header.forEach((h, i) => colMap[h.toString().trim()] = i);
  for(let i = 0; i < columnCount; i++) {
      newRow.push('');
  }
  if(colMap['Email'] !== undefined) newRow[colMap['Email']] = email;
  if(colMap['Name'] !== undefined) newRow[colMap['Name']] = name;
  if(colMap['Grade'] !== undefined) newRow[colMap['Grade']] = grade;
  sheet.appendRow(newRow);
  return { success: true, message: "권한 요청이 성공적으로 기록되었습니다." };
}
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'requestPermission') {
      const email = e.parameter.email;
      const name = e.parameter.name;
      const grade = e.parameter.grade;
      const result = requestPermission(email, name, grade);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action == 'getStudentAdminData') {
    return getStudentAdminData(e);
    }
    if (action === 'translateText') {
      const textToTranslate = e.parameter.text;
      if (!textToTranslate) throw new Error("Missing 'text' parameter.");
      const result = translateText(textToTranslate);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error("Unsupported action. This script is for translation and Firebase sync only.");
  } catch (error) {
    Logger.log(error.stack);
    const errorResponse = { success: false, message: `Script error: ${error.message}` };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function translateText(text) {
  try {
    const translatedText = LanguageApp.translate(text, 'en', 'ko');
    return { success: true, translatedText: translatedText };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
function getStudentAdminData() {
  try {
    const ss = SpreadsheetApp.openById(ADMIN_SHEET_ID);
    const sheet = ss.getSheetByName('학생명단');
    if (!sheet) {
      throw new Error("Google Sheets에서 '학생명단' 시트를 찾을 수 없습니다.");
    }
    const data = sheet.getDataRange().getValues();
    const studentNameMap = {};
    const gradeStudentMap = { '1y': [], '2y': [], '3y': [] };
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const email = row[0] ? row[0].toString().trim() : '';
      const name = row[1] ? row[1].toString().trim() : '';
      const grade = row[2] ? row[2].toString().trim() : '';
      if (email) {
        studentNameMap[email] = name ||
'';
        if (grade && gradeStudentMap[grade]) {
          gradeStudentMap[grade].push(email);
        } else if (grade) {
           const gradeKey = grade.toString().trim().toLowerCase().replace(/[^0-9y]/g, '');
        if (gradeStudentMap[gradeKey]) {
              gradeStudentMap[gradeKey].push(email);
            }
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, studentNameMap: studentNameMap, gradeStudentMap: gradeStudentMap }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(error.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: `Script error in getStudentAdminData: ${error.message}` }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
