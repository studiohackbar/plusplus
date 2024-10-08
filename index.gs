function setProperties() {
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('SLACK_TOKEN', 'xoxb-00000000000000000000000000000000');
  scriptProperties.setProperty('SPREADSHEET_ID', '00000000');
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.getDataAsString());

    // チャレンジ認証の処理
    if (params.type === 'url_verification') {
      return ContentService.createTextOutput(params.challenge);
    }

    var text = params.event.text;
    var userId = params.event.user;
    var channel = params.event.channel;
    var thread_ts = params.event.thread_ts ? params.event.thread_ts : params.event.ts;

    // メンションと「++」が含まれるかチェック
    if (text.includes('++') && text.includes('<@' + userId + '>')) {
      var displayName = getSlackDisplayName(userId); // 表示名を取得
      var newPoints = updateSpreadsheet(userId, displayName); // ポイントを更新または追加
      sendSlackMessage(channel, thread_ts, userId, newPoints); // Slackに通知
    }

    // ログの記録
    logToSpreadsheet('Request processed successfully.');
  } catch (error) {
    // エラーログの記録
    logToSpreadsheet('Error in doPost: ' + error.message);
  }
}

function updateSpreadsheet(userId, displayName) {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('シート1');
  var data = sheet.getDataRange().getValues();
  var newPoints = 0;
  var userExists = false;

  // 既存のユーザーをチェック
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === userId) {
      newPoints = data[i][2] + 1; // C列（インデックス2）のポイントを更新
      sheet.getRange(i + 1, 3).setValue(newPoints); // C列（インデックス3）への書き込み
      userExists = true;
      break;
    }
  }

  // ユーザーが見つからなかった場合、新しい行を追加して1ポイントを設定
  if (!userExists) {
    newPoints = 1;
    sheet.appendRow([userId, displayName, newPoints]); // 新しい行にユーザーID、表示名、1ポイントを追加
  }

  return newPoints;
}

function getSlackDisplayName(userId) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
    var url = 'https://slack.com/api/users.info?user=' + userId;

    var options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };

    var response = UrlFetchApp.fetch(url, options);
    var userInfo = JSON.parse(response.getContentText());

    if (userInfo.ok) {
      return userInfo.user.profile.display_name || userInfo.user.real_name; // 表示名がなければ実名を使用
    } else {
      throw new Error('Unable to fetch display name: ' + userInfo.error);
    }
  } catch (error) {
    logToSpreadsheet('getSlackDisplayName: Error - ' + error.message);
    return 'Unknown User';
  }
}

function sendSlackMessage(channel, thread_ts, userId, points) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
    var userName = '[APP_NAME]くん';
    var message = '<@' + userId + '>さんは ' + points + ' ポイントを持ってるニャ！';

    var payload = JSON.stringify({
      channel: channel,
      text: message,
      username: userName,
      thread_ts: thread_ts
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: payload
    };

    var response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
    logToSpreadsheet('sendSlackMessage: Success - ' + response.getContentText());
  } catch (error) {
    logToSpreadsheet('sendSlackMessage: Error - ' + error.message);
  }
}

function logToSpreadsheet(logMessage) {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('シート2');
  var currentTime = new Date();
  sheet.appendRow([currentTime, logMessage]);
}
