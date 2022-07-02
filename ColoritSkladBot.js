// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const fileBase = 'https://api.telegram.org/file/bot' + token + '/'

let update
let message

const DEBUG = 0

function doPost(e){
  try{
    update = JSON.parse(e.postData.contents)
    if(!update){
      throw Error('No contents')
    }
    DEBUG ? debug() : processMessage()
  }
  catch(e){
    const SGrodnikChatId = 326258443
    sendMessage(SGrodnikChatId, e)
    tableAppend(now(), 'Ошибка', e)
  }
}

function debug(){
  const SGrodnikChatId = 326258443
  if(update.message && update.message.from.id === SGrodnikChatId){
    sendMessage(SGrodnikChatId, JSON.stringify(update, null, 8))
  }
}

function processMessage(){
  message = update.message
  if(!message){return}
  if(message.photo){}
}

function sendMessage(chatId, text){
  let data = {
    method: 'post',
    payload: {
      method: 'sendMessage',
      chat_id: String(chatId),
      text: text,
      disable_notification: true,
      parse_mode: 'HTML'
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId]
}

function tableAppend(){
  let [ssId, sheetName] = ssIdAndSheetNameByChatId[String(message.chat.id)]
  if(sheetName){
    const ssApp = SpreadsheetApp.openById(ssId)
    ssApp.getSheetByName(sheetName).appendRow([].slice.call(arguments))
  }
}

function pass(){console.log(123)}
