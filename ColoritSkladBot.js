// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const fileBase = 'https://api.telegram.org/file/bot' + token + '/'
const ssId = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ssApp = SpreadsheetApp.openById(ssId)

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
  // if(update.message && update.message.from.id === SGrodnikChatId){
    let properties = PropertiesService.getScriptProperties()
    properties.setProperty('qwe', 'asd')
    // sendMessage(SGrodnikChatId, JSON.stringify(PropertiesService.getScriptProperties(), null, 8))
    sendMessage(SGrodnikChatId, PropertiesService.getScriptProperties().getProperties())

  // }
}

function processMessage(){
  message = update.message
  // if(!message){return}
  if(message && message.text && message.text === '/start'){greetUser()}
  if(message && message.text && message.text.startsWith('Выбрать')){selectMat()}
  if(message && message.text && isFloat(message.text)){confirmWriteOff()}
  if(update.callback_query && update.callback_query.data.startsWith('Списать')){writeOff()}
  inline_query = update.inline_query
  if(update.inline_query){processInlineQuery()}
}

function greetUser() {
  let text = `Привет, ${message.from.first_name || message.from.username}! Давай найдём материал:`
  createButtonsByGroup()
  let keyboard = {inline_keyboard: createButtonsByGroup()}
  sendMessage(message.from.id, text, keyboard)
}

function createButtonsByGroup() {
  const groups = {}
  for (const row of getTable()) {
    if (row[0] === '') {continue}
    if (!(row[0] in groups)) {
      groups[row[0]] = 0
    }
    groups[row[0]]++
  }
  const buttons = [{ "text": "Общий поиск 🔍", 'switch_inline_query_current_chat': '' }]
  for (const groupName in groups) {
    buttons.push({ "text": `${groupName} (${groups[groupName]})`, 'switch_inline_query_current_chat': groupName})
  }
  const buttonRows = []
  let count = buttons.length;
  if ((count % 2) === 0){
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  } else {
    count--
    buttonRows.push([buttons.shift()])
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  }
  // console.log(getTable())
  return buttonRows
}

function selectMat() {
  let [matName, matId, ostatok] = JSON.parse(message.text.replaceAll('Выбрать ', ''))
  // let matName = message.text.match(/".+?"/g)[0].replaceAll('"', '')
  // let matId = message.text.match(/\(id.+?\)/g)[0].replaceAll('(id', '').replaceAll(')', '')
  // let value = JSON.stringify([matName, matId])
  // sendMessage(message.from.id, ('a'.repeat(10000).length))
  // PropertiesService.getScriptProperties().getProperty('qwe')
  PropertiesService.getScriptProperties().setProperty(message.from.id, matName + ',id=' + matId)
  let text = `Введите количество ≤ ${ostatok}`
  let keyboard = {inline_keyboard:
        [[{ "text": "Другая позиция 🔍", 'switch_inline_query_current_chat': '' }]]
  }
  sendMessage(message.from.id, text)
}

function isFloat(str){
  str = str.replaceAll(',', '.')
  const allowedChars = ['1','2','3','4','5','6','7','8','9','0','.']
  for (let i = 0; i < str.length; i++) {
    if(!(allowedChars.includes(str[i]))){
      return false
    }
  }
  return !isNaN(str)
}

function confirmWriteOff() {
  let amount = String(parseFloat(message.text.replace(',', '.'))).replace('.', ',')
  let properties = PropertiesService.getScriptProperties()
  let [matName, matId] = properties.getProperty(message.from.id).split(',id=')
  // sendMessage(message.from.id, amount.length)
  let text = `Подтвердите списание <b>${amount}</b> кг <b>${matName}</b> или введите другое количество`
  let keyboard = {inline_keyboard:
        [[{ "text": `Списать ✓`, 'callback_data': `Списать ${amount}` }]]
  }
  sendMessage(message.from.id, text, keyboard)
}

function writeOff() {
  const callbackQuery = update.callback_query
  const amount = callbackQuery.data.replace('Списать ', '')
  const properties = PropertiesService.getScriptProperties()
  // const matName = properties.getProperty(callbackQuery.from.id)
  const [matName, matId] = properties.getProperty(callbackQuery.from.id).split(',id=')
  const text = `👌 списано <b>${amount}</b> кг <b>${matName}</b>`
  const message = callbackQuery.message
  const date = toDate(message.date)
  // function findId() {
  //   const sheet = ssApp.getSheetByName('СКЛАД')
  //   const range = sheet.getRange(2, 1, 500, 2)
  //   for (const row of range.getValues()) {
  //     // tableAppend(clear(row[1]).toLowerCase(), matName.toLowerCase())
  //     if (clear(row[1]).toLowerCase() === matName.toLowerCase()) {
  //       return row[0]
  //     }
  //   }
  // }
  // let matId = findId() || '?'
  tableAppend(date, callbackQuery.from.id, matId, amount)
  editMessage(message.chat.id, message.message_id, text)
}

function toDate(unixTimestamp){
  const milliseconds = unixTimestamp * 1000
  const dateObject = new Date(milliseconds)
  return now(date=dateObject)
}

function now(date=0){
  if(!date){
    date = new Date()
  }
  let y = date.getFullYear()
  let m = date.getMonth() + 1
  let d = date.getDate()
  let hh = date.getHours()
  let mm = date.getMinutes()
  let ss = date.getSeconds()
  return `${y}.${m}.${d} ${hh}:${mm}:${ss}`
}

function clear(s) {
  return String(s).replaceAll('\n', ' ').replaceAll('"', '')
}

function tableAppend(){
  const sheet = ssApp.getSheetByName('ЖУРНАЛ')
  sheet.appendRow([].slice.call(arguments))
}

function editMessage(chatId, messageId, text){
  let data = {
    method: 'post',
    payload: {
      method: 'editMessageText',
      chat_id: String(chatId),
      message_id: Number(messageId),
      text: text,
      parse_mode: 'HTML'
    }
  }
  let response = UrlFetchApp.fetch(base, data)
}

function getTable() {
  const sheet = ssApp.getSheetByName('СКЛАД')
  const range = sheet.getRange(3, 1, 500, 10)
  return range.getValues()
}

function processInlineQuery(){
  const query = update.inline_query.query
  if (!query || query.length < 1){
    answerInlineQuery(update.inline_query.id, [])
    return
  }
  const results = []
  const table = getTable();

  let counter = 0
  for (const row of table) {
    if(row[2].toLowerCase().includes(query.toLowerCase())) {
    counter++
    const row8 = Math.round(row[9] * 100) / 100
    const s = String(row8)
      const ostatok = s.replaceAll('.', ',')
      const noZak = row[4] === '-' || row[4] === '' ? '' : ` | ${row[4]}`
      const messageText = 'Выбрать ' + JSON.stringify([clear(row[2]), clear(row[1]), ostatok])
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `${row[2]} | ${row[3]}${noZak}`,
        description: `Остаток ${ostatok} кг | Расположение: ${row[5]} ${row[6]}`,
        input_message_content: {
          message_text: messageText
        }
      })
    }
  }
  // sendMessage(326258443, '2')
  // sendMessage(326258443, results.length)
  if(results.length === 0){
    results.push({
      id: 1,
      type: 'article',
      title: `По запросу "${query}" ничего не найдено 👀 🤔`,
      input_message_content: {
        message_text: `-`
      }
    })
  }
  answerInlineQuery(update.inline_query.id, results.slice(0, 50))
}

function answerInlineQuery(inline_query_id, results){
  let data = {
    method: 'post',
    payload: {
      method: 'answerInlineQuery',
      inline_query_id: String(inline_query_id),
      results: JSON.stringify(results),
      cache_time: Number(0)
    }
  }
  UrlFetchApp.fetch(base, data)
}

function sendMessage(chatId, text, keyboard=null){
  let data = {
    method: 'post',
    payload: {
      method: 'sendMessage',
      chat_id: String(chatId),
      text: text,
      disable_notification: true,
      parse_mode: 'HTML',
      reply_markup: keyboard ? JSON.stringify(keyboard) : ''
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId]
}

function pass(){console.log(123)}
