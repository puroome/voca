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
  
  const result = processSyncForSheet(activeSheet, grade);
  
  if (result.success) {
    SpreadsheetApp.getUi().alert(`✅ '${grade}' 시트 동기화 완료!`);
  } else {
    SpreadsheetApp.getUi().alert(`🛑 '${grade}' 시트 동기화 실패: ${result.message}`);
  }
}

/**
 * 모든 학년 시트의 데이터를 Firebase RTDB에 동기화합니다. (전체 동기화)
 */
function syncAllVocabularyToFirebase() {
    const vocabSS = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    let successCount = 0;
    let failMessages = [];

    GRADE_SHEETS.forEach(grade => {
        const sheet = vocabSS.getSheetByName(grade);
        if (sheet) {
            const result = processSyncForSheet(sheet, grade);
            if (result.success) {
                successCount++;
            } else {
                failMessages.push(`[${grade}] ${result.message}`);
            }
        }
    });

    if (failMessages.length > 0) {
        SpreadsheetApp.getUi().alert(`⚠️ 전체 동기화 중 일부 실패 (${successCount}/${GRADE_SHEETS.length} 성공):\n${failMessages.join('\n')}`);
    } else {
        SpreadsheetApp.getUi().alert(`✅ 전체 학년 동기화 완료!`);
    }
}


/**
 * 특정 시트와 학년 정보를 받아 동기화 프로세스를 실행합니다.
 */
function processSyncForSheet(sheet, grade) {
  try {
      
      const dataRange = sheet.getRange(1, 1, sheet.getLastRow(), 6); 
      const data = dataRange.getValues();
      const headers = data[0].map(h => h.toString().trim().toUpperCase());

      const idIndex = headers.indexOf('INDEX'); 
      const wordIndex = headers.indexOf('WORD'); 
      const meaningIndex = headers.indexOf('MEANING'); 
      const posIndex = headers.indexOf('POS');
      const explanationIndex = headers.indexOf('EXPLANATION'); 
      const sampleIndex = headers.indexOf('SAMPLE'); 

      if (idIndex === -1 || wordIndex === -1 || meaningIndex === -1) {
          throw new Error("필수 컬럼 (Index, Word, Meaning) 중 누락된 항목이 있습니다.");
      }
      
      const vocabularyData = {};
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const id = row[idIndex] ? row[idIndex].toString().trim() : '';
        const word = row[wordIndex] ? row[wordIndex].toString().trim() : '';
        
        if (id && word) {
          // 🎯 수정된 부분: word를 키로 사용하고, 소문자로 통일
          vocabularyData[word.toLowerCase()] = { 
            id: parseInt(id),
            word: word,
            meaning: row[meaningIndex] ? row[meaningIndex].toString().trim() : '',
            pos: posIndex !== -1 && row[posIndex] ? row[posIndex].toString().trim() : '',
            explanation: explanationIndex !== -1 && row[explanationIndex] ? row[explanationIndex].toString().trim() : '',
            sample: sampleIndex !== -1 && row[sampleIndex] ? row[sampleIndex].toString().trim() : ''
          };
        }
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
    return { success: false, message: error.message };
  }
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
